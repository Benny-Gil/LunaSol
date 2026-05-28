import { test, expect } from '@playwright/test';

test('homepage loads successfully', async ({ page }) => {
  await page.goto('/');
  // Basic verification that the page loaded (e.g. body exists)
  const body = page.locator('body');
  await expect(body).toBeVisible();
});
