// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import FlameToggle from './FlameToggle'
import { loadSettings, SETTINGS_KEY } from './storage/settingsStore'

beforeEach(() => {
	localStorage.clear()
	delete document.documentElement.dataset.flame
})
afterEach(cleanup)

describe('FlameToggle', () => {
	it('starts on, flips data-flame on <html> and persists the choice', () => {
		render(<FlameToggle />)
		expect(screen.getByRole('button', { name: 'Flame: On' }).getAttribute('aria-pressed')).toBe('true')

		fireEvent.click(screen.getByRole('button', { name: 'Flame: On' }))
		expect(document.documentElement.dataset.flame).toBe('off')
		expect(loadSettings().flame).toBe(false)
		expect(screen.getByRole('button', { name: 'Flame: Off' }).getAttribute('aria-pressed')).toBe('false')

		fireEvent.click(screen.getByRole('button', { name: 'Flame: Off' }))
		expect(document.documentElement.dataset.flame).toBe('on')
		expect(loadSettings().flame).toBe(true)
	})

	it('starts from the stored settings', () => {
		localStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme: 'dark', flame: false }))
		render(<FlameToggle />)
		expect(screen.getByRole('button', { name: 'Flame: Off' })).toBeTruthy()
	})
})
