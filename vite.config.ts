/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // The renderer is pure presentation with no browser APIs, so tests render
    // to a static HTML string via react-dom/server. That keeps jsdom and the
    // testing-library stack out of the dependency tree.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
