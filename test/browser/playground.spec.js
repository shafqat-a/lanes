import { test, expect } from '@playwright/test';
test('playground compares all examples and reports invalid code', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Run & compare' })).toBeEnabled();
  await expect(page.locator('#adapter')).toHaveText('WebGPU available');
  await page.selectOption('#size', '1024');
  for (const example of ['simulation', 'hash', 'rules']) {
    await page.selectOption('#example', example); await page.click('#run');
    await expect(page.locator('#status')).toContainText('outputs matched');
    await expect(page.locator('#wgsl')).toContainText('@compute');
  }
  await page.screenshot({ path: 'results/playground-desktop.png', fullPage: true });
  await page.fill('#source', 'function f(x) { return x / 2; }'); await page.click('#run');
  await expect(page.locator('#status')).toContainText('Unsupported operator');
  expect(errors).toEqual([]);
});
test('CPU fallback works when WebGPU is absent, including mobile layout', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/'); await expect(page.locator('#adapter')).toHaveText('CPU fallback');
  await page.selectOption('#size', '1024'); await page.click('#run');
  await expect(page.locator('#status')).toContainText('outputs matched');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'results/playground-mobile.png', fullPage: true });
});
