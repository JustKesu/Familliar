import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme.css'
import './index.css'
import App from './App.tsx'
import { applyFlame, applyTheme, loadSettings } from './storage/settingsStore'

// Before the first render, so the page never paints in the wrong theme.
const settings = loadSettings()
applyTheme(settings.theme)
applyFlame(settings.flame)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
