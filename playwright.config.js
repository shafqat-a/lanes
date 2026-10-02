import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './test/browser', timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:4173', browserName: 'chromium', headless: true,
    launchOptions: { args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--enable-features=Vulkan'] } },
  webServer: { command: 'node scripts/serve.js', url: 'http://127.0.0.1:4173', reuseExistingServer: false },
});
