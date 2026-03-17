import { test, expect } from '@playwright/test';
import { setupApp, navigateTo } from './helpers';

/**
 * Seed localStorage with settled predictions so the accuracy panel renders.
 * Uses the same team names from mockApi.ts finished matches.
 */
async function seedSettledPredictions(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const predictions: Record<string, unknown> = {};
    const settled = [
      { id: '1001', home: 'Arsenal', away: 'Manchester City', predicted: 'H', actual: 'H', correct: true, confidence: 0.72, pHG: 2, pAG: 1, aHG: 2, aAG: 1 },
      { id: '1002', home: 'Liverpool', away: 'Manchester United', predicted: 'D', actual: 'D', correct: true, confidence: 0.55, pHG: 1, pAG: 1, aHG: 0, aAG: 0 },
      { id: '1003', home: 'Tottenham', away: 'Chelsea', predicted: 'H', actual: 'H', correct: true, confidence: 0.68, pHG: 2, pAG: 0, aHG: 3, aAG: 1 },
      { id: '1004', home: 'Newcastle United', away: 'Aston Villa', predicted: 'H', actual: 'A', correct: false, confidence: 0.61, pHG: 2, pAG: 1, aHG: 1, aAG: 2 },
      { id: '1005', home: 'Brighton', away: 'West Ham United', predicted: 'D', actual: 'D', correct: true, confidence: 0.50, pHG: 1, pAG: 1, aHG: 1, aAG: 1 },
    ];

    for (const s of settled) {
      predictions[s.id] = {
        id: `pred_${s.id}`,
        matchId: s.id,
        homeTeam: s.home,
        awayTeam: s.away,
        predictedResult: s.predicted,
        predictedHomeGoals: s.pHG,
        predictedAwayGoals: s.pAG,
        confidence: s.confidence,
        actualResult: s.actual,
        actualHomeGoals: s.aHG,
        actualAwayGoals: s.aAG,
        isCorrect: s.correct,
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        matchDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        matchday: 29,
      };
    }

    localStorage.setItem('pl_oracle_predictions', JSON.stringify(predictions));
  });
}

test.describe('Predictions', () => {
  test.beforeEach(async ({ page }) => {
    await setupApp(page);
    await navigateTo(page, 'Predictions');
    await page.waitForLoadState('networkidle');
  });

  test('renders the predictions panel with gameweek selector', async ({ page }) => {
    // Gameweek select is the signature element of the Predictions view
    await expect(page.locator('select#gameweek')).toBeVisible();
  });

  test('gameweek selector has all 38 weeks', async ({ page }) => {
    const select = page.locator('select#gameweek');
    await expect(select).toBeVisible();
    const options = select.locator('option');
    await expect(options).toHaveCount(38);
  });

  test('predict gameweek button is visible and correctly labelled', async ({ page }) => {
    const predictBtn = page.locator('[data-testid="predict-gameweek"]');
    await expect(predictBtn).toBeVisible();
    await expect(predictBtn).toContainText('Predict Gameweek');
  });

  test('accuracy panel toggle works', async ({ page }) => {
    // Seed localStorage with settled predictions so the accuracy panel renders
    await seedSettledPredictions(page);

    // Full reload required: PredictionTracker is a singleton that reads
    // localStorage once on construction — navigating within the SPA won't
    // re-initialise it, but a page reload will.
    await page.reload();
    await page.waitForSelector('main', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await navigateTo(page, 'Predictions');
    await page.waitForLoadState('networkidle');

    // Accuracy panel should now be visible (5 settled predictions seeded)
    const panel = page.locator('[data-testid="accuracy-panel"]');
    await expect(panel).toBeVisible({ timeout: 5000 });

    // Click toggle to expand the breakdown
    await panel.locator('button').first().click();
    await expect(page.getByText('By Outcome')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('By Confidence Band')).toBeVisible({ timeout: 3000 });
  });

  test('prediction generation produces results on cards', async ({ page }) => {
    // The mock API provides 5 upcoming matches at matchday 30
    // Click predict and verify prediction cards show results
    const predictBtn = page.locator('[data-testid="predict-gameweek"]');
    await expect(predictBtn).toBeVisible();
    await expect(predictBtn).toBeEnabled();

    await predictBtn.click();

    // Wait for "All predictions complete!" message
    await expect(page.getByText('All predictions complete!')).toBeVisible({ timeout: 30000 });

    // Verify at least one prediction card now shows a predicted score
    // The predicted score appears as "X-Y" in the card front
    const predictedScores = page.locator('.flip-card-front .text-primary.text-2xl');
    await expect(predictedScores.first()).toBeVisible({ timeout: 5000 });

    // Verify "Tap for Analysis" button appears (indicates prediction data exists)
    const analysisBtn = page.getByText('Tap for Analysis').first();
    await expect(analysisBtn).toBeVisible();

    // Flip a card and verify Kelly stake info on the back
    await analysisBtn.click();
    await page.waitForTimeout(700); // Wait for flip animation

    // The back of the card should show analysis sections
    await expect(page.getByText('Predicted Score').first()).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Recent Form').first()).toBeVisible({ timeout: 3000 });
  });

  test('screenshot - predictions view', async ({ page }) => {
    // Verify core UI loaded before screenshot
    await expect(page.locator('select#gameweek')).toBeVisible();
    await page.screenshot({
      path: 'playwright-screenshots/predictions.png',
      fullPage: true,
    });
  });
});
