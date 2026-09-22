import type { KeyValueStorage } from './characterStore'

/*
 * App settings (D150): a separate key, never part of a character, so no
 * schema version. A missing, corrupt or unreadable value falls back to the
 * defaults instead of throwing — a lost preference is not worth an error.
 */

export type Theme = 'dark' | 'light'

export interface AppSettings {
	theme: Theme
}

export const SETTINGS_KEY = 'familliar:settings'

export const DEFAULT_SETTINGS: AppSettings = { theme: 'dark' }

function browserStorage(): KeyValueStorage | null {
	try {
		return globalThis.localStorage ?? null
	} catch {
		return null
	}
}

export function loadSettings(storage: KeyValueStorage | null = browserStorage()): AppSettings {
	try {
		const raw = storage?.getItem(SETTINGS_KEY)
		if (!raw) return { ...DEFAULT_SETTINGS }
		const parsed: unknown = JSON.parse(raw)
		const theme = (parsed as { theme?: unknown } | null)?.theme
		return { theme: theme === 'light' || theme === 'dark' ? theme : DEFAULT_SETTINGS.theme }
	} catch {
		return { ...DEFAULT_SETTINGS }
	}
}

export function saveSettings(settings: AppSettings, storage: KeyValueStorage | null = browserStorage()): void {
	try {
		storage?.setItem(SETTINGS_KEY, JSON.stringify(settings))
	} catch {
		// Storage full or blocked: the theme still applies for this session.
	}
}

export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
	root.dataset.theme = theme
}
