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
	it('defaults to the dark theme when nothing is stored', () => {
		expect(loadSettings(new MemoryStorage())).toEqual({ theme: 'dark' })
		expect(DEFAULT_SETTINGS.theme).toBe('dark')
	})

	it('round-trips a saved theme under familliar:settings', () => {
		const storage = new MemoryStorage()
		saveSettings({ theme: 'light' }, storage)
		expect(JSON.parse(storage.data.get(SETTINGS_KEY)!)).toEqual({ theme: 'light' })
		expect(loadSettings(storage)).toEqual({ theme: 'light' })
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
