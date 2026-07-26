/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Default environment is 'node': the markup renderer is pure presentation
    // with no browser APIs, so its tests render to a static HTML string via
    // react-dom/server and never need a DOM. Component tests that simulate
    // real interaction (the creation wizard) opt into jsdom per-file with a
    // `// @vitest-environment jsdom` comment instead of paying the jsdom cost
    // for every test in the project.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
