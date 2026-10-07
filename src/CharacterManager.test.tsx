// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { stepNav } from './creation/wizardTestNav'
import userEvent from '@testing-library/user-event'
import CharacterManager from './CharacterManager'
import { CharacterStore } from './storage/characterStore'
import { CLASSES, RESOLVER } from './levelUp/levelGains.fixtures'
import { useRoute } from './navigation/useRoute'
import type { CharacterRoute } from './navigation/route'

// The fetch stub below answers every data file with [], where no class exists; the Level up tests need a Fighter to be found.
vi.mock('./levelUp/levelGains', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./levelUp/levelGains')>()
	return {
		...actual,
		loadLevelGainsFor: async (character: Parameters<typeof actual.levelGainsFor>[0], target: Parameters<typeof actual.levelGainsFor>[1]) =>
			actual.levelGainsFor(character, target, CLASSES, RESOLVER),
	}
})
vi.mock('./levelUp/levelRemoval', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./levelUp/levelRemoval')>()
	return {
		...actual,
		loadLevelRemovalPlan: async (character: Parameters<typeof actual.levelRemovalPlan>[0]) => actual.levelRemovalPlan(character, CLASSES, RESOLVER, null),
	}
})

/*
 * Component test for the temporary character manager UI (PHASE1.md build
 * order step 2). Renders through a real DOM so it can catch a bug where the
 * store's own delete works (see characterStore.test.ts) but the UI never
 * reflects it — a gap the store's unit tests alone cannot see.
 *
 * Rework R1b: CharacterManager takes `route`/`navigate` as props (owned by
 * App's single `useRoute`, D151) rather than owning list/sheet/wizard
 * visibility itself. `Harness` stands in for App here — it is the same hook,
 * just without App's nav tabs — so these tests exercise real hash navigation.
 */

function Harness() {
	const [route, navigate] = useRoute()
	const characterRoute: CharacterRoute = route.view === 'markup-demo' ? { view: 'list' } : route
	return <CharacterManager route={characterRoute} navigate={navigate} />
}

/** Simulates the browser's own Back/Forward, or a nav tab landing on the same hash — nothing here calls `navigate`. */
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

/* D311: Delete goes through the in-app dialog, never confirm(). */
async function openDeleteDialog(user: ReturnType<typeof userEvent.setup>, name: string) {
	await user.click(screen.getByRole('button', { name: `More actions for ${name}` }))
	await user.click(screen.getByRole('button', { name: 'Delete' }))
	return screen.getByRole('alertdialog', { name: `Delete ${name}?` })
}

describe('CharacterManager delete', () => {
	it('removes the character from the rendered list once Delete is confirmed in the dialog', async () => {
		const store = new CharacterStore()
		store.create({ name: 'Aria' })

		const user = userEvent.setup()
		render(<Harness />)
		expect(await screen.findByText('Aria')).not.toBeNull()

		const dialog = await openDeleteDialog(user, 'Aria')
		expect(dialog.textContent).toContain('This removes the character from this browser. It cannot be undone.')
		await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

		expect(screen.queryByText('Aria')).toBeNull()
		expect(store.list()).toHaveLength(0)
		expect(document.activeElement).toBe(screen.getByRole('button', { name: 'New character' }))
	})

	it('writes nothing on Keep or Esc', async () => {
		const store = new CharacterStore()
		store.create({ name: 'Aria' })

		const user = userEvent.setup()
		render(<Harness />)
		await screen.findByText('Aria')

		await user.click(within(await openDeleteDialog(user, 'Aria')).getByRole('button', { name: 'Keep' }))
		expect(screen.queryByRole('alertdialog')).toBeNull()
		await openDeleteDialog(user, 'Aria')
		await user.keyboard('{Escape}')

		expect(screen.queryByRole('alertdialog')).toBeNull()
		expect(screen.getByText('Aria')).not.toBeNull()
		expect(store.list()).toHaveLength(1)
	})

	it('removes the correct row when multiple characters are present', async () => {
		const store = new CharacterStore()
		store.create({ name: 'Aria' })
		store.create({ name: 'Bree' })

		const user = userEvent.setup()
		render(<Harness />)
		expect(await screen.findByText('Aria')).not.toBeNull()

		await user.click(within(await openDeleteDialog(user, 'Aria')).getByRole('button', { name: 'Delete' }))

		expect(screen.queryByText('Aria')).toBeNull()
		expect(screen.getByText('Bree')).not.toBeNull()
	})

	it('surfaces an error instead of silently doing nothing when the card is stale', async () => {
		const store = new CharacterStore()
		const character = store.create({ name: 'Aria' })

		const user = userEvent.setup()
		render(<Harness />)
		expect(await screen.findByText('Aria')).not.toBeNull()

		// Something else (another tab, a hand edit) removes the character from
		// storage after the list was read, but before the dialog is confirmed.
		store.delete(character.id)

		await user.click(within(await openDeleteDialog(user, 'Aria')).getByRole('button', { name: 'Delete' }))

		expect(await screen.findByText(/No character with id/)).not.toBeNull()
	})
})

describe('CharacterManager rename (D310)', () => {
	it('renames in the card on Enter, and Esc keeps the old name', async () => {
		const store = new CharacterStore()
		store.create({ name: 'Aria' })

		const user = userEvent.setup()
		render(<Harness />)
		await screen.findByText('Aria')

		await user.click(screen.getByRole('button', { name: 'More actions for Aria' }))
		await user.click(screen.getByRole('button', { name: 'Rename' }))
		await user.keyboard('Zed{Escape}')
		expect(screen.getByText('Aria')).not.toBeNull()
		expect(store.list()[0].name).toBe('Aria')

		await user.click(screen.getByRole('button', { name: 'More actions for Aria' }))
		await user.click(screen.getByRole('button', { name: 'Rename' }))
		await user.keyboard('Zed{Enter}')
		expect(await screen.findByText('Zed')).not.toBeNull()
		expect(store.list()[0].name).toBe('Zed')
	})
})

describe('CharacterManager level up (slice 8d3, rework R1b)', () => {
	it('leaves the stored character untouched when the walk is cancelled part-way', async () => {
		const store = new CharacterStore()
		const created = store.create({ name: 'Aria', classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Champion', level: 4 }] })
		const before = store.exportCharacter(created.id)

		const user = userEvent.setup()
		render(<Harness />)
		await user.click(await screen.findByRole('button', { name: 'Aria' }))
		await user.click(await screen.findByRole('button', { name: 'Level up to 5' }))
		await user.click(screen.getByRole('button', { name: 'Fighter 4 → 5' }))

		// Fighter 4 → 5 walks only hit points and review; the walk opens on hit points.
		expect(await screen.findByText('1. Hit points')).not.toBeNull()
		expect(screen.getByText('2. Review and save')).not.toBeNull()

		await user.click(stepNav().getByRole('button', { name: 'Cancel' }))

		expect(screen.queryByText('1. Hit points')).toBeNull()
		expect(store.exportCharacter(created.id)).toBe(before)
		// The list (whose row read just "Fighter 4") is gone on this route (R1b) — only the sheet's own header remains, subclass included.
		expect(await screen.findByText('Fighter 4 (Champion)')).not.toBeNull()
	})

	it('shows only the wizard, not the sheet, while the level-up walk is open', async () => {
		const store = new CharacterStore()
		store.create({ name: 'Aria', classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Champion', level: 4 }] })

		const user = userEvent.setup()
		render(<Harness />)
		await user.click(await screen.findByRole('button', { name: 'Aria' }))
		await user.click(await screen.findByRole('button', { name: 'Level up to 5' }))
		await user.click(screen.getByRole('button', { name: 'Fighter 4 → 5' }))

		expect(await screen.findByText('1. Hit points')).not.toBeNull()
		expect(screen.queryByRole('button', { name: 'Edit character' })).toBeNull()
	})
})

describe('CharacterManager remove level (slice 8e)', () => {
	function createFighter(store: CharacterStore) {
		return store.create({
			name: 'Aria',
			classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Champion', level: 5 }],
			createdAtLevel: 4,
			hitPointLevels: [{ level: 5, kind: 'roll', dieResult: 7 }],
		})
	}

	it('writes nothing when the confirmation is cancelled', async () => {
		const store = new CharacterStore()
		const created = createFighter(store)
		const before = store.exportCharacter(created.id)
		const confirmSpy = vi.spyOn(window, 'confirm')

		const user = userEvent.setup()
		render(<Harness />)
		await user.click(await screen.findByRole('button', { name: 'Aria' }))
		await user.click(await screen.findByRole('button', { name: 'Remove level 5' }))

		const dialog = screen.getByRole('alertdialog', { name: 'Remove level 5?' })
		expect(dialog.textContent).toContain('Hit points for level 5')
		await user.click(within(dialog).getByRole('button', { name: 'Keep level' }))

		expect(screen.queryByRole('alertdialog')).toBeNull()
		expect(store.exportCharacter(created.id)).toBe(before)
		expect(confirmSpy).not.toHaveBeenCalled()
	})

	it('writes the character one level down once confirmed', async () => {
		const store = new CharacterStore()
		const created = createFighter(store)

		const user = userEvent.setup()
		render(<Harness />)
		await user.click(await screen.findByRole('button', { name: 'Aria' }))
		await user.click(await screen.findByRole('button', { name: 'Remove level 5' }))
		await user.click(within(screen.getByRole('alertdialog', { name: 'Remove level 5?' })).getByRole('button', { name: 'Remove level' }))

		const stored = store.list().find((character) => character.id === created.id)
		expect(stored?.classes[0].level).toBe(4)
		expect(stored?.hitPointLevels).toBeUndefined()
		// No list on this route (R1b) to show the shorter "Fighter 4" — the sheet's own header carries the subclass too.
		expect(await screen.findByText('Fighter 4 (Champion)')).not.toBeNull()
		const unavailable = (await screen.findByRole('button', { name: 'Remove level' })) as HTMLButtonElement
		expect(unavailable.title).toMatch(/Remove level unavailable: This character was created at level 4/)
	})
})

/* Slice 9d2: the sheet's textareas through the real manager and store — the write-through round trip must not eat keystrokes, and must land on the right character. */
describe('CharacterManager appearance and notes (slice 9d2)', () => {
	it('persists what is typed to the character\'s own field, exactly, and reads it back on a fresh mount', async () => {
		const store = new CharacterStore()
		const created = store.create({ name: 'Aria' })

		const user = userEvent.setup()
		const { unmount } = render(<Harness />)
		await user.click(await screen.findByRole('button', { name: 'Aria' }))
		await user.click(await screen.findByRole('tab', { name: 'Notes' }))

		await user.type(screen.getByRole('textbox', { name: 'Příběh' }), '- Raised by owls{Enter}  - Left at dawn  ')
		await user.type(screen.getByRole('textbox', { name: 'Poznámky' }), 'Owes Cato 5 gp')
		await user.tab()

		const stored = store.list().find((character) => character.id === created.id)
		expect(stored?.backstory).toBe('- Raised by owls\n  - Left at dawn  ')
		expect(stored?.notes).toBe('Owes Cato 5 gp')
		expect(stored?.appearance).toBeUndefined()

		unmount()
		window.location.hash = `#/character/${created.id}`
		render(<Harness />)
		expect((await screen.findByRole('textbox', { name: 'Příběh' })) as HTMLTextAreaElement).toHaveProperty(
			'value',
			'- Raised by owls\n  - Left at dawn  ',
		)
		expect((screen.getByRole('textbox', { name: 'Vzhled' }) as HTMLTextAreaElement).value).toBe('')
	})

	it('does not carry one character\'s text over to another when navigating back through the list', async () => {
		const store = new CharacterStore()
		store.create({ name: 'Aria' })
		store.create({ name: 'Bree' })

		const user = userEvent.setup()
		render(<Harness />)
		await user.click(await screen.findByRole('button', { name: 'Aria' }))
		await user.type(await screen.findByRole('textbox', { name: 'Poznámky' }), 'Aria only')
		await user.tab()

		goTo('#/')
		await user.click(await screen.findByRole('button', { name: 'Bree' }))

		// A fresh CharacterSheet mount for Bree — no sheet state, tab included, survives from Aria's.
		await user.click(await screen.findByRole('tab', { name: 'Notes' }))
		expect((await screen.findByRole('textbox', { name: 'Poznámky' })) as HTMLTextAreaElement).toHaveProperty('value', '')
		expect(store.list().find((character) => character.name === 'Bree')?.notes).toBeUndefined()
		expect(store.list().find((character) => character.name === 'Aria')?.notes).toBe('Aria only')
	})
})

describe('CharacterManager routing (rework R1b)', () => {
	it('shows only the sheet, not the list, after opening a character', async () => {
		const store = new CharacterStore()
		store.create({ name: 'Aria' })

		const user = userEvent.setup()
		render(<Harness />)
		await user.click(await screen.findByRole('button', { name: 'Aria' }))

		expect(await screen.findByRole('button', { name: 'Edit character' })).not.toBeNull()
		expect(screen.queryByText('No characters yet.')).toBeNull()
		expect(screen.queryByRole('button', { name: 'New character' })).toBeNull()
	})

	it('falls back to the list for an id that does not exist', async () => {
		window.location.hash = '#/character/does-not-exist'
		const store = new CharacterStore()
		store.create({ name: 'Aria' })

		render(<Harness />)

		expect(await screen.findByText('Aria')).not.toBeNull()
		expect(window.location.hash).toBe('#/')
	})

	it('cancelling Edit character returns to the sheet', async () => {
		const store = new CharacterStore()
		store.create({ name: 'Aria' })

		const user = userEvent.setup()
		render(<Harness />)
		await user.click(await screen.findByRole('button', { name: 'Aria' }))
		await user.click(await screen.findByRole('button', { name: 'Edit character' }))

		expect(await screen.findByText('1. Class and level')).not.toBeNull()
		await user.click(stepNav().getByRole('button', { name: 'Cancel' }))

		expect(await screen.findByRole('button', { name: 'Edit character' })).not.toBeNull()
		expect(screen.queryByText('1. Class and level')).toBeNull()
	})
})
