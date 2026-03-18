import { test, expect } from '@playwright/test';
import { setupApp, navigateTo } from './helpers';

test.describe('Oracle Chat', () => {
  test.beforeEach(async ({ page }) => {
    await setupApp(page);
    await navigateTo(page, 'Oracle Chat');
    await page.waitForLoadState('networkidle');
  });

  test('renders chatbot container', async ({ page }) => {
    const chatbot = page.locator('[data-testid="chatbot"]');
    await expect(chatbot).toBeVisible();
  });

  test('shows API key setup when no OpenAI key is configured', async ({ page }) => {
    // setupApp sets football_data_api_key but not openai_api_key
    // So the API key setup card should be visible
    await expect(page.getByText('Connect OpenAI')).toBeVisible();
    await expect(page.getByPlaceholder('sk-...')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Connect' })).toBeVisible();
  });

  test('shows welcome message in chat area', async ({ page }) => {
    await expect(page.getByText(/Welcome to Oracle Chat/)).toBeVisible({ timeout: 3000 });
  });

  test('input field is disabled until API key is set', async ({ page }) => {
    const input = page.locator('[data-testid="chatbot-input"]');
    await expect(input).toBeVisible();
    await expect(input).toBeDisabled();
  });

  test('send button is disabled until API key is set', async ({ page }) => {
    const sendBtn = page.locator('[data-testid="chatbot-send"]');
    await expect(sendBtn).toBeVisible();
    await expect(sendBtn).toBeDisabled();
  });

  test('can enter and save an API key', async ({ page }) => {
    const keyInput = page.getByPlaceholder('sk-...');
    await keyInput.fill('sk-test-key-for-e2e-testing-1234567890');
    await page.getByRole('button', { name: 'Connect' }).click();

    // After saving, the API key setup card should disappear
    await expect(page.getByText('Connect OpenAI')).not.toBeVisible({ timeout: 3000 });

    // Input should now be enabled
    const chatInput = page.locator('[data-testid="chatbot-input"]');
    await expect(chatInput).toBeEnabled();

    // "Change key" button should appear in the header
    await expect(page.getByText('Change key')).toBeVisible();
  });

  test('rejects very short API keys', async ({ page }) => {
    const keyInput = page.getByPlaceholder('sk-...');
    await keyInput.fill('short');
    await page.getByRole('button', { name: 'Connect' }).click();

    // Error message should appear
    await expect(page.getByText(/valid OpenAI API key/i)).toBeVisible({ timeout: 3000 });
  });

  test('clear chat button works', async ({ page }) => {
    // The clear button is in the chat header
    const clearBtn = page.locator('button[title="Clear chat"]');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    // Should show cleared message
    await expect(page.getByText(/Chat cleared/)).toBeVisible({ timeout: 3000 });
  });

  test('character counter shows on input', async ({ page }) => {
    // Set API key first
    const keyInput = page.getByPlaceholder('sk-...');
    await keyInput.fill('sk-test-key-for-e2e-testing-1234567890');
    await page.getByRole('button', { name: 'Connect' }).click();
    await expect(page.locator('[data-testid="chatbot-input"]')).toBeEnabled();

    // Character counter should be visible (shows 0/500)
    await expect(page.getByText('0/500')).toBeVisible();

    // Type some text and verify counter updates
    await page.locator('[data-testid="chatbot-input"]').fill('Hello');
    await expect(page.getByText('5/500')).toBeVisible();
  });
});
