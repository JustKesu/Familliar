import { defineConfig, devices } from '@playwright/test'

// Own port, never the dev server's 5173, so a running `npm run dev` cannot collide (E2E-1, D180).
const PORT = 4173

export default defineConfig({
  testDir: 'e2e',
  reporter: 'line',
  fullyParallel: true,
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    headless: true,
    screenshot: 'only-on-failure',
    video: 'off',
    trace: 'off',
    // D312: the first-open intro would cover every fresh tab for ~6 s; intro.spec.ts and flame.spec.ts opt back in.
    reducedMotion: 'reduce',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
