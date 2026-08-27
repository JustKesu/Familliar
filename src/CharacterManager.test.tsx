// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CharacterManager from './CharacterManager'
import { CharacterStore } from './storage/characterStore'

/*
 * Component test for the temporary character manager UI (PHASE1.md build
 * order step 2). Renders through a real DOM so it can catch a bug where the
 * store's own delete works (see characterStore.test.ts) but the UI never
 * reflects it — a gap the store's unit tests alone cannot see.
 */

afterEach(() => {
	cleanup()
	window.localStorage.clear()
	vi.restoreAllMocks()
})

beforeEach(() => {
	window.localStorage.clear()

	// The "Sheet" button mounts the real CharacterSheet, which fetches app data
	// files through dataLoader.ts. In jsdom there is no origin for a
	// root-relative URL and nothing serving it, so the real fetch rejects with
	// "Failed to parse URL from /data/…". These tests only exercise the
	// manager's list/rename/delete/sheet-toggle UI, never the sheet's contents,
	// so a stub that answers every data file with an empty array is enough — the
	// sheet mounts with its data-driven sections empty. Local to this file: the
	// other jsdom component tests mock their loader modules directly and never
	// reach fetch.
	vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
		const url = typeof input === 'string' ? input : String(input)
		if (url.includes('/data/')) {
			return new Response('[]', { headers: { 'Content-Type': 'application/json' } })
		}
		throw new Error(`unexpected fetch in CharacterManager test: ${url}`)
	})
})

describe('CharacterManager delete', () => {
	it('removes the character from the rendered list when delete is clicked', async () => {
		const store = new CharacterStore()
		store.create('Aria')
		vi.spyOn(window, 'confirm').mockReturnValue(true)

		const user = userEvent.setup()
		render(<CharacterManager />)

		expect(await screen.findByText('Aria')).not.toBeNull()

		await user.click(screen.getByRole('button', { name: 'Delete' }))

		expect(screen.queryByText('Aria')).toBeNull()
	})

	it('removes the correct row when multiple characters are present', async () => {
		const store = new CharacterStore()
		store.create('Aria')
		store.create('Bree')
		vi.spyOn(window, 'confirm').mockReturnValue(true)

		const user = userEvent.setup()
		render(<CharacterManager />)

		expect(await screen.findByText('Aria')).not.toBeNull()
		expect(screen.getByText('Bree')).not.toBeNull()

		const [firstDelete] = screen.getAllByRole('button', { name: 'Delete' })
		await user.click(firstDelete)

		expect(screen.queryByText('Aria')).toBeNull()
		expect(screen.getByText('Bree')).not.toBeNull()
	})

	it('surfaces an error instead of silently doing nothing when the row is stale', async () => {
		const store = new CharacterStore()
		const character = store.create('Aria')
		vi.spyOn(window, 'confirm').mockReturnValue(true)

		const user = userEvent.setup()
		render(<CharacterManager />)

		expect(await screen.findByText('Aria')).not.toBeNull()

		// Simulate the row going stale: something else (another tab, a hand
		// edit) removes the character from storage after the list was read,
		// but before this row's delete button is clicked.
		store.delete(character.id)

		await user.click(screen.getByRole('button', { name: 'Delete' }))

		expect(await screen.findByText(/No character with id/)).not.toBeNull()
	})
})

describe('CharacterManager sheet toggle', () => {
	it('hides the sheet when the same row\'s button is clicked again', async () => {
		const store = new CharacterStore()
		store.create('Aria')

		const user = userEvent.setup()
		render(<CharacterManager />)

		expect(await screen.findByText('Aria')).not.toBeNull()

		await user.click(screen.getByRole('button', { name: 'Sheet' }))
		expect(await screen.findByRole('button', { name: 'Hide' })).not.toBeNull()

		await user.click(screen.getByRole('button', { name: 'Hide' }))
		expect(screen.queryByRole('button', { name: 'Hide' })).toBeNull()
		expect(screen.getByRole('button', { name: 'Sheet' })).not.toBeNull()
	})

	it('switches to a different row\'s sheet, showing only one at a time', async () => {
		const store = new CharacterStore()
		store.create('Aria')
		store.create('Bree')

		const user = userEvent.setup()
		render(<CharacterManager />)

		expect(await screen.findByText('Aria')).not.toBeNull()
		expect(screen.getByText('Bree')).not.toBeNull()

		const [ariaSheet, breeSheet] = screen.getAllByRole('button', { name: 'Sheet' })
		await user.click(ariaSheet)
		expect(await screen.findByRole('button', { name: 'Hide' })).not.toBeNull()

		await user.click(breeSheet)

		expect(screen.getAllByRole('button', { name: 'Hide' })).toHaveLength(1)
		expect(screen.getAllByRole('button', { name: 'Sheet' })).toHaveLength(1)
	})
})
