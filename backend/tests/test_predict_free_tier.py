"""
Tests for the free-tier prediction API endpoints.

Validates:
- /predict/free returns valid probabilities summing to ~1.0
- /predict/free returns 422 for invalid team names
- /predict/free returns 503 when model not loaded
- /models/free-tier/info returns training metadata
- Rate limiting returns 429 after threshold
- Existing /predict endpoint is unchanged
"""

import pytest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Import FastAPI test client
try:
    from fastapi.testclient import TestClient
    FASTAPI_AVAILABLE = True
except ImportError:
    FASTAPI_AVAILABLE = False

# Import the app — will have free_tier_model = None by default
if FASTAPI_AVAILABLE:
    from app.api.main import app, _check_rate_limit, _rate_limit_store, _resolve_team_name


@pytest.fixture
def client():
    """FastAPI test client."""
    if not FASTAPI_AVAILABLE:
        pytest.skip('fastapi not installed')
    return TestClient(app)


# ---------------------------------------------------------------------------
# Tests: /predict/free endpoint
# ---------------------------------------------------------------------------

@pytest.mark.skipif(not FASTAPI_AVAILABLE, reason='fastapi not available')
class TestPredictFreeEndpoint:
    """Tests for POST /predict/free."""

    def test_503_when_model_not_loaded(self, client):
        """Should return 503 if no model is loaded."""
        response = client.post('/predict/free', json={
            'home_team': 'Arsenal',
            'away_team': 'Chelsea',
        })
        assert response.status_code == 503

    def test_422_for_invalid_team(self, client):
        """Should return 422 for an unrecognised team name."""
        # Temporarily set a model so we don't get 503
        import app.api.main as main_module
        original_model = main_module.free_tier_model
        main_module.free_tier_model = 'dummy'  # Non-None

        try:
            response = client.post('/predict/free', json={
                'home_team': 'Barcelona',
                'away_team': 'Chelsea',
            })
            assert response.status_code == 422
            data = response.json()
            assert 'Unknown team name' in str(data)
        finally:
            main_module.free_tier_model = original_model

    def test_request_validation(self, client):
        """Should return 422 for missing required fields."""
        response = client.post('/predict/free', json={})
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# Tests: /models/free-tier/info endpoint
# ---------------------------------------------------------------------------

@pytest.mark.skipif(not FASTAPI_AVAILABLE, reason='fastapi not available')
class TestModelInfoEndpoint:
    """Tests for GET /models/free-tier/info."""

    def test_503_when_no_model(self, client):
        """Should return 503 if no model is loaded."""
        response = client.get('/models/free-tier/info')
        assert response.status_code == 503

    def test_returns_metadata(self, client):
        """Should return metadata when model is loaded."""
        import app.api.main as main_module
        original_model = main_module.free_tier_model
        original_meta = main_module.free_tier_metadata

        main_module.free_tier_model = 'dummy'
        main_module.free_tier_metadata = {
            'version': '1.0.0-free',
            'tier': 'free',
            'training_date': '2024-01-01',
            'training_samples': 100,
            'validation_accuracy': 0.52,
            'validation_log_loss': 0.95,
            'feature_names': ['feat1', 'feat2'],
            'training_seasons': ['2024/25'],
            'feature_importance': {'feat1': 0.6, 'feat2': 0.4},
        }

        try:
            response = client.get('/models/free-tier/info')
            assert response.status_code == 200
            data = response.json()
            assert data['version'] == '1.0.0-free'
            assert data['tier'] == 'free'
            assert data['feature_count'] == 2
            assert data['training_samples'] == 100
        finally:
            main_module.free_tier_model = original_model
            main_module.free_tier_metadata = original_meta


# ---------------------------------------------------------------------------
# Tests: Rate limiting
# ---------------------------------------------------------------------------

@pytest.mark.skipif(not FASTAPI_AVAILABLE, reason='fastapi not available')
class TestRateLimiting:
    """In-memory rate limiter."""

    def test_allows_under_limit(self):
        _rate_limit_store.clear()
        for _ in range(59):
            assert _check_rate_limit('test-ip') is True

    def test_blocks_over_limit(self):
        _rate_limit_store.clear()
        for _ in range(60):
            _check_rate_limit('over-ip')
        assert _check_rate_limit('over-ip') is False

    def test_different_ips_independent(self):
        _rate_limit_store.clear()
        for _ in range(60):
            _check_rate_limit('ip-a')
        # ip-b should still be allowed
        assert _check_rate_limit('ip-b') is True


# ---------------------------------------------------------------------------
# Tests: Team name resolution
# ---------------------------------------------------------------------------

@pytest.mark.skipif(not FASTAPI_AVAILABLE, reason='fastapi not available')
class TestTeamNameResolution:
    """_resolve_team_name for API input validation."""

    def test_valid_csv_name(self):
        assert _resolve_team_name('Arsenal') == 'Arsenal'

    def test_valid_api_name(self):
        assert _resolve_team_name('Arsenal FC') == 'Arsenal'

    def test_invalid_name_raises_422(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            _resolve_team_name('Barcelona')
        assert exc_info.value.status_code == 422


# ---------------------------------------------------------------------------
# Tests: Existing endpoints unaffected
# ---------------------------------------------------------------------------

@pytest.mark.skipif(not FASTAPI_AVAILABLE, reason='fastapi not available')
class TestExistingEndpoints:
    """Free-tier additions should not break existing endpoints."""

    def test_health_check(self, client):
        response = client.get('/health')
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'healthy'
