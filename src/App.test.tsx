// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { CharacterStore } from './storage/characterStore'
import { CLASSES, RESOLVER } from './levelUp/levelGains.fixtures'

/*
 * Rework R1b (D151): App owns the one `useRoute` hook and passes the route
 * down. These tests exercise navigation through the real top-nav tabs and
 * real hash changes — CharacterManager.test.tsx covers the character-only
 * routes (sheet/edit/level-up/new) in more depth via a thinner harness.
 */

vi.mock('./levelUp/levelGains', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./levelUp/levelGains')>()
	return {
		...actual,
		loadLevelGainsFor: async (character: Parameters<typeof actual.levelGainsFor>[0], level: number) =>
			actual.levelGainsFor(character, level, CLASSES, RESOLVER),
	}
})

function goTo(hash: string): void {
	window.location.hash = hash
	window.dispatchEvent(new Event('hashchange'))
}

afterEach(() => {
	cleanup()
	window.localStorage.clear()
	window.location.hash = ''
	vi.restoreAllMocks()
})

beforeEach(() => {
	window.localStorage.clear()
	window.location.hash = ''
	vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
		const url = typeof input === 'string' ? input : String(input)
		if (url.includes('/data/')) {
			return new Response('[]', { headers: { 'Content-Type': 'application/json' } })
		}
		throw new Error(`unexpected fetch in App test: ${url}`)
	})
})

describe('App routing (rework R1b, D151)', () => {
	it('starts on the character list for an empty or missing hash', async () => {
		render(<App />)
		expect(await screen.findByText('No characters saved yet.')).not.toBeNull()
		expect(screen.getByRole('button', { name: 'Characters' })).toHaveProperty('className', expect.stringContaining('tabs__button--active'))
	})

	it('selects the right view from the hash already in place on mount', async () => {
		const store = new CharacterStore()
		const created = store.create({ name: 'Aria' })
		window.location.hash = `#/character/${created.id}`

		render(<App />)

		expect(await screen.findByRole('button', { name: 'Edit character' })).not.toBeNull()
		expect(screen.queryByText('No characters saved yet.')).toBeNull()
	})

	it('has no "Familliar" page heading on the list or on a sheet (D165)', async () => {
		const store = new CharacterStore()
		const created = store.create({ name: 'Aria' })
		render(<App />)
		await screen.findByText('Aria')
		expect(screen.queryByRole('heading', { name: 'Familliar' })).toBeNull()

		window.location.hash = `#/character/${created.id}`
		window.dispatchEvent(new Event('hashchange'))
		await screen.findByRole('button', { name: 'Edit character' })
		expect(screen.queryByRole('heading', { name: 'Familliar' })).toBeNull()
	})

	it('shows "Rolls" in the top bar only while a sheet is open, and it opens the history drawer (D165)', async () => {
		const store = new CharacterStore()
		const created = store.create({ name: 'Aria' })
		const user = userEvent.setup()
		render(<App />)
		await screen.findByText('Aria')
		expect(screen.queryByRole('button', { name: 'Rolls' })).toBeNull()

		window.location.hash = `#/character/${created.id}`
		window.dispatchEvent(new Event('hashchange'))
		await user.click(await screen.findByRole('button', { name: 'Rolls' }))
		expect(screen.getByRole('dialog', { name: 'Roll history' })).not.toBeNull()
		expect(screen.getByRole('button', { name: 'Rolls' }).closest('nav')).not.toBeNull()

		await user.click(screen.getByRole('button', { name: 'Characters' }))
		expect(screen.queryByRole('button', { name: 'Rolls' })).toBeNull()
	})

	it('pushes a history entry and shows only the sheet when a character is opened', async () => {
		const store = new CharacterStore()
		const created = store.create({ name: 'Aria' })
		const before = history.length

		const user = userEvent.setup()
		render(<App />)
		await user.click(await screen.findByRole('button', { name: 'Sheet' }))

		expect(window.location.hash).toBe(`#/character/${created.id}`)
		expect(history.length).toBeGreaterThan(before)
		expect(screen.queryByText('No characters saved yet.')).toBeNull()
		expect(await screen.findByRole('button', { name: 'Edit character' })).not.toBeNull()
	})

	it('shows only the wizard, with neither the list nor the sheet, once Level up is opened', async () => {
		const store = new CharacterStore()
		store.create({ name: 'Aria', classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Champion', level: 4 }] })

		const user = userEvent.setup()
		render(<App />)
		await user.click(await screen.findByRole('button', { name: 'Sheet' }))
		await user.click(await screen.findByRole('button', { name: 'Level up to 5' }))

		expect(await screen.findByText('1. Hit points')).not.toBeNull()
		expect(screen.queryByRole('button', { name: 'Edit character' })).toBeNull()
		expect(screen.queryByText('No characters saved yet.')).toBeNull()
		expect(window.location.hash).toMatch(/\/level-up$/)
	})

	it('replaces the wizard entry on cancel, so Back does not reopen it', async () => {
		const store = new CharacterStore()
		const created = store.create({ name: 'Aria' })

		const user = userEvent.setup()
		render(<App />)
		await user.click(await screen.findByRole('button', { name: 'Sheet' }))
		await user.click(await screen.findByRole('button', { name: 'Edit character' }))
		expect(await screen.findByText('1. Class and level')).not.toBeNull()

		await user.click(screen.getByRole('button', { name: 'Cancel' }))

		expect(window.location.hash).toBe(`#/character/${created.id}`)
		expect(await screen.findByRole('button', { name: 'Edit character' })).not.toBeNull()
	})

	it('falls back to the list, replacing the hash, for an unknown character id', async () => {
		window.location.hash = '#/character/does-not-exist'
		const store = new CharacterStore()
		store.create({ name: 'Aria' })

		render(<App />)

		expect(await screen.findByText('Aria')).not.toBeNull()
		expect(window.location.hash).toBe('#/')
	})

	it('switches view on a simulated Back (hashchange), without any click', async () => {
		const store = new CharacterStore()
		const created = store.create({ name: 'Aria' })
		window.location.hash = `#/character/${created.id}`

		render(<App />)
		expect(await screen.findByRole('button', { name: 'Edit character' })).not.toBeNull()

		goTo('#/')

		expect(await screen.findByText('Aria')).not.toBeNull()
		expect(screen.queryByRole('button', { name: 'Edit character' })).toBeNull()
	})

	it('switches to the Markup demo tab and keeps it selected on that hash, leaving the character view intact underneath', async () => {
		const store = new CharacterStore()
		store.create({ name: 'Aria' })

		const user = userEvent.setup()
		render(<App />)
		await screen.findByText('Aria')

		await user.click(screen.getByRole('button', { name: 'Markup demo' }))

		expect(window.location.hash).toBe('#/markup-demo')
		expect(screen.getByRole('button', { name: 'Markup demo' })).toHaveProperty('className', expect.stringContaining('tabs__button--active'))
		expect(screen.queryByText('Aria')).toBeNull()

		await user.click(screen.getByRole('button', { name: 'Characters' }))
		expect(await screen.findByText('Aria')).not.toBeNull()
	})
})
