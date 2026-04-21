"""
Tests for probability calibration.

Validates:
- DirichletCalibrator produces valid simplex output (sum to 1, in [0, 1]).
- apply_calibrators dispatches correctly for each method.
- Edge cases: zero-probability inputs, degenerate labels.
"""

import os
import sys

import numpy as np
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from train_free_tier import (  # noqa: E402
    DirichletCalibrator,
    _calibrate_with_method,
    apply_calibrators,
)

SIMPLEX_TOL = 1e-9


def _random_simplex(n: int, n_classes: int = 3, rng=None) -> np.ndarray:
    """Draw n rows from a uniform Dirichlet over `n_classes` (each row sums to 1)."""
    rng = rng or np.random.default_rng(42)
    return rng.dirichlet(np.ones(n_classes), size=n)


def _balanced_labels(n: int, n_classes: int = 3, rng=None) -> np.ndarray:
    """Produce labels that cover all classes so multinomial LR can fit."""
    rng = rng or np.random.default_rng(0)
    base = np.tile(np.arange(n_classes), n // n_classes + 1)[:n]
    rng.shuffle(base)
    return base.astype(int)


# ---------------------------------------------------------------------------
# Dirichlet calibrator — core invariants
# ---------------------------------------------------------------------------

def test_dirichlet_output_sums_to_one():
    rng = np.random.default_rng(0)
    raw = _random_simplex(200, rng=rng)
    y = _balanced_labels(200, rng=rng)
    cal = DirichletCalibrator().fit(raw, y)
    out = cal.predict_proba(raw)
    assert np.allclose(out.sum(axis=1), 1.0, atol=SIMPLEX_TOL)


def test_dirichlet_output_in_unit_interval():
    rng = np.random.default_rng(1)
    raw = _random_simplex(200, rng=rng)
    y = _balanced_labels(200, rng=rng)
    cal = DirichletCalibrator().fit(raw, y)
    out = cal.predict_proba(raw)
    assert (out >= 0).all()
    assert (out <= 1).all()


def test_dirichlet_output_shape():
    rng = np.random.default_rng(2)
    raw = _random_simplex(100, rng=rng)
    y = _balanced_labels(100, rng=rng)
    cal = DirichletCalibrator().fit(raw, y)
    out = cal.predict_proba(raw)
    assert out.shape == (100, 3)


def test_dirichlet_handles_zero_probs():
    """log(0) = -inf. DirichletCalibrator must clip to avoid non-finite values."""
    raw = np.array([
        [0.0, 0.5, 0.5],
        [1.0, 0.0, 0.0],
        [0.33, 0.33, 0.34],
        [0.0, 1.0, 0.0],
        [0.5, 0.0, 0.5],
        [0.0, 0.0, 1.0],
    ])
    y = np.array([1, 0, 2, 1, 0, 2])
    cal = DirichletCalibrator().fit(raw, y)
    out = cal.predict_proba(raw)
    assert np.isfinite(out).all()
    assert np.allclose(out.sum(axis=1), 1.0, atol=SIMPLEX_TOL)


def test_dirichlet_predict_before_fit_raises():
    cal = DirichletCalibrator()
    with pytest.raises(RuntimeError):
        cal.predict_proba(np.array([[0.3, 0.3, 0.4]]))


# ---------------------------------------------------------------------------
# apply_calibrators dispatch — all methods preserve the simplex
# ---------------------------------------------------------------------------

def test_apply_calibrators_dirichlet_preserves_simplex():
    rng = np.random.default_rng(3)
    raw = _random_simplex(80, rng=rng)
    y = _balanced_labels(80, rng=rng)
    cal = DirichletCalibrator().fit(raw, y)
    out = apply_calibrators(raw, cal, 'dirichlet')
    assert out.shape == raw.shape
    assert np.allclose(out.sum(axis=1), 1.0, atol=SIMPLEX_TOL)


def test_apply_calibrators_isotonic_renormalises():
    rng = np.random.default_rng(4)
    raw = _random_simplex(120, rng=rng)
    y = _balanced_labels(120, rng=rng)
    cals, _ = _calibrate_with_method(raw, y, 'isotonic')
    out = apply_calibrators(raw, cals, 'isotonic')
    assert np.allclose(out.sum(axis=1), 1.0, atol=SIMPLEX_TOL)


def test_apply_calibrators_platt_renormalises():
    rng = np.random.default_rng(5)
    raw = _random_simplex(120, rng=rng)
    y = _balanced_labels(120, rng=rng)
    cals, _ = _calibrate_with_method(raw, y, 'platt')
    out = apply_calibrators(raw, cals, 'platt')
    assert np.allclose(out.sum(axis=1), 1.0, atol=SIMPLEX_TOL)


# ---------------------------------------------------------------------------
# Dirichlet λ grid — different reg strengths produce valid simplex
# ---------------------------------------------------------------------------

def test_dirichlet_reg_lambda_grid_simplex():
    """Every λ in the P11d grid must still yield a valid simplex."""
    rng = np.random.default_rng(6)
    raw = _random_simplex(150, rng=rng)
    y = _balanced_labels(150, rng=rng)
    for lam in (1e-3, 1e-2, 1e-1, 1.0, 10.0):
        cal = DirichletCalibrator(reg_lambda=lam).fit(raw, y)
        out = cal.predict_proba(raw)
        assert np.allclose(out.sum(axis=1), 1.0, atol=SIMPLEX_TOL)
        assert (out >= 0).all() and (out <= 1).all()


def test_apply_calibrators_dirichlet_reg_dispatch():
    """'dirichlet_reg' dispatch must delegate to the calibrator's predict_proba."""
    rng = np.random.default_rng(7)
    raw = _random_simplex(100, rng=rng)
    y = _balanced_labels(100, rng=rng)
    cal = DirichletCalibrator(reg_lambda=1e-2).fit(raw, y)
    out = apply_calibrators(raw, cal, 'dirichlet_reg')
    assert out.shape == raw.shape
    assert np.allclose(out.sum(axis=1), 1.0, atol=SIMPLEX_TOL)
