import type { KeyValueStorage } from './characterStore'

/*
 * App settings (D150): a separate key, never part of a character, so no
 * schema version. A missing, corrupt or unreadable value falls back to the
 * defaults instead of throwing — a lost preference is not worth an error.
 */

export type Theme = 'dark' | 'light'

export interface AppSettings {
	theme: Theme
	flame: boolean
}

export const SETTINGS_KEY = 'familliar:settings'

export const DEFAULT_SETTINGS: AppSettings = { theme: 'dark', flame: true }

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
		const { theme, flame } = (parsed ?? {}) as { theme?: unknown; flame?: unknown }
		return {
			theme: theme === 'light' || theme === 'dark' ? theme : DEFAULT_SETTINGS.theme,
			flame: typeof flame === 'boolean' ? flame : DEFAULT_SETTINGS.flame,
		}
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

/** D224: the flame canvas watches this attribute, so a toggle never re-renders the app tree. */
export function applyFlame(flame: boolean, root: HTMLElement = document.documentElement): void {
	root.dataset.flame = flame ? 'on' : 'off'
}
