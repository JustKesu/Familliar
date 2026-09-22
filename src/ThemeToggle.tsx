import { useState, type ReactNode } from 'react'
import { applyTheme, loadSettings, saveSettings, type Theme } from './storage/settingsStore'

/** Owns the only React state a theme switch touches; the sheet reads colours from CSS and never re-renders for it. */
export default function ThemeToggle(): ReactNode {
	const [theme, setTheme] = useState<Theme>(() => loadSettings().theme)
	const next: Theme = theme === 'dark' ? 'light' : 'dark'

	function toggle(): void {
		applyTheme(next)
		saveSettings({ ...loadSettings(), theme: next })
		setTheme(next)
	}

	return (
		<button type="button" className="tabs__button tabs__theme" aria-pressed={theme === 'light'} onClick={toggle}>
			{next === 'light' ? 'Light' : 'Dark'}
		</button>
	)
}
