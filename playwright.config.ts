import { defineConfig } from '@playwright/test';
export default defineConfig({
  timeout: 15000,
  use: { baseURL: 'http://127.0.0.1:4173', channel: process.env.IGNITE_CHROME ? 'chrome' : undefined },
  webServer: process.env.IGNITE_TEST_STATIC ? undefined : { command: 'npm run preview -- --port 4173 --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: true },
  projects: [
    { name: 'laptop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'wide', use: { viewport: { width: 1920, height: 1080 } } },
    { name: 'narrow', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' } }
  ]
});
