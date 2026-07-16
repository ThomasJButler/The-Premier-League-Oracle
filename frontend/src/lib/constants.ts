/**
 * App-level constants.
 *
 * This file once held ~40 tuning knobs for the pre-Butler prediction
 * ensemble (ELO scales, form weights, confidence boosts, Poisson clamps…).
 * The Butler model (lib/engine/) carries its parameters in fitted
 * coefficients.json instead — constants earned by walk-forward evidence, not
 * hand-tuning — so only genuinely app-level values remain here.
 */

/**
 * Synthetic bookmaker margin used ONLY by the legacy valueOdds fallback in
 * lib/context/defaultPorts.ts (inverting odds back to probabilities for
 * injected test ports that predate the `probabilities` field).
 */
export const VALUE_ODDS_MARGIN = 1.05;

/** localStorage key for the user-supplied Anthropic API key (Settings). */
export const ANTHROPIC_API_KEY_STORAGE_KEY = 'anthropic_api_key';
