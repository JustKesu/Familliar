import { describe, expect, it } from 'vitest'
import type { KeyValueStorage } from './characterStore'
import { DEFAULT_SETTINGS, loadSettings, saveSettings, SETTINGS_KEY } from './settingsStore'

class MemoryStorage implements KeyValueStorage {
	data = new Map<string, string>()
	getItem(key: string): string | null {
		return this.data.get(key) ?? null
	}
	setItem(key: string, value: string): void {
		this.data.set(key, value)
	}
	removeItem(key: string): void {
		this.data.delete(key)
	}
}

describe('settingsStore', () => {
	it('defaults to the dark theme with the flame on when nothing is stored', () => {
		expect(loadSettings(new MemoryStorage())).toEqual({ theme: 'dark', flame: true })
		expect(DEFAULT_SETTINGS.theme).toBe('dark')
		expect(DEFAULT_SETTINGS.flame).toBe(true)
	})

	it('round-trips a saved theme and flame switch under familliar:settings', () => {
		const storage = new MemoryStorage()
		saveSettings({ theme: 'light', flame: false }, storage)
		expect(JSON.parse(storage.data.get(SETTINGS_KEY)!)).toEqual({ theme: 'light', flame: false })
		expect(loadSettings(storage)).toEqual({ theme: 'light', flame: false })
	})

	it('keeps the flame on for settings saved before it existed or with a non-boolean value', () => {
		const storage = new MemoryStorage()
		storage.setItem(SETTINGS_KEY, '{"theme":"light"}')
		expect(loadSettings(storage)).toEqual({ theme: 'light', flame: true })
		storage.setItem(SETTINGS_KEY, '{"theme":"light","flame":"off"}')
		expect(loadSettings(storage).flame).toBe(true)
	})

	it('falls back to the defaults on corrupt JSON or an unknown theme', () => {
		const storage = new MemoryStorage()
		storage.setItem(SETTINGS_KEY, '{not json')
		expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS)
		storage.setItem(SETTINGS_KEY, '{"theme":"sepia"}')
		expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS)
		storage.setItem(SETTINGS_KEY, 'null')
		expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS)
	})
})
