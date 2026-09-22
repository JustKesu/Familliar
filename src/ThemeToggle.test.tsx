// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import ThemeToggle from './ThemeToggle'
import { applyTheme, loadSettings, SETTINGS_KEY } from './storage/settingsStore'

beforeEach(() => {
	localStorage.clear()
	delete document.documentElement.dataset.theme
})
afterEach(cleanup)

describe('ThemeToggle', () => {
	it('flips data-theme on <html> and persists the choice', () => {
		applyTheme(loadSettings().theme)
		render(<ThemeToggle />)
		expect(document.documentElement.dataset.theme).toBe('dark')

		fireEvent.click(screen.getByRole('button', { name: 'Light' }))
		expect(document.documentElement.dataset.theme).toBe('light')
		expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!)).toEqual({ theme: 'light' })
		expect(screen.getByRole('button', { name: 'Dark' }).getAttribute('aria-pressed')).toBe('true')

		fireEvent.click(screen.getByRole('button', { name: 'Dark' }))
		expect(document.documentElement.dataset.theme).toBe('dark')
		expect(loadSettings().theme).toBe('dark')
	})

	it('starts from the stored settings', () => {
		localStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme: 'light' }))
		applyTheme(loadSettings().theme)
		render(<ThemeToggle />)
		expect(document.documentElement.dataset.theme).toBe('light')
		expect(screen.getByRole('button', { name: 'Dark' }).getAttribute('aria-pressed')).toBe('true')
	})
})
