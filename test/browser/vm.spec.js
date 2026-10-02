import { test, expect } from '@playwright/test';
test('GPU VM conformance and missing features never trigger CPU fallback', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/vm.html'); await expect(page.locator('#adapter')).toHaveText('GPU VM');
  await page.click('#run'); await expect(page.locator('#status')).toContainText('Backend: GPU');
  await expect(page.locator('#output')).toContainText('0 → 0.9999999999999999');
  await page.click('#check'); await expect(page.locator('#status')).toContainText('results matched native JavaScript');
  expect((await page.evaluate(() => window.vmReport)).checked).toBeGreaterThan(80000);
  await page.fill('#source', 'function f(x) { return [x]; }');
  await page.click('#run'); await expect(page.locator('#status')).toContainText('does not support');
  await expect(page.locator('#adapter')).toHaveText('GPU VM');
  await page.fill('#source', 'function f(x) { while (true) { x++; } }');
  await page.click('#run'); await page.click('#cancel');
  await expect(page.locator('#run')).toBeEnabled(); await expect(page.locator('#status')).toHaveClass('error');
  expect(errors).toEqual([]);
});
test('VM uses whole-job CPU backend when WebGPU is absent', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/vm.html'); await expect(page.locator('#adapter')).toHaveText('CPU VM — no GPU');
  await page.click('#run'); await expect(page.locator('#status')).toContainText('Backend: CPU');
  await expect(page.locator('#output')).toContainText('0 → 0.9999999999999999');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
