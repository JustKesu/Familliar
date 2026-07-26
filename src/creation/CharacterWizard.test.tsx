// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CharacterWizard } from './CharacterWizard'
import type { CharacterStore } from '../storage/characterStore'

/*
 * Component tests for the wizard shell, added alongside the jsdom/testing-
 * library setup (PHASE1.md section D, "Tests render to static HTML, not
 * through jsdom" — revised). These render through a real DOM and simulate
 * clicks/typing, which is the only way to catch a bug where a picker's own
 * selection lives in state that unmounts with the step: the pure reducer
 * tests in wizardState.test.ts already prove the WIZARD's data survives
 * back-navigation, but they never render a picker, so they cannot see a
 * picker fail to display what the wizard remembers.
 *
 * Data loaders are stubbed rather than hitting fetch/data on disk — this
 * project's data/ is never read into context or loaded in tests directly.
 */

vi.mock('../classes/classData', () => ({
	loadBaseClasses: vi.fn(async () => [
		{ name: 'Fighter', source: 'XPHB', hd: { number: 1, faces: 10 } },
		{ name: 'Wizard', source: 'XPHB', hd: { number: 1, faces: 6 } },
	]),
}))

vi.mock('../species/speciesData', () => ({
	loadSpecies: vi.fn(async () => [
		{ name: 'Elf', source: 'XPHB' },
		{ name: 'Dwarf', source: 'XPHB' },
	]),
	speciesDisplayName: (entry: { name: string }) => entry.name,
}))

vi.mock('../backgrounds/backgroundData', () => ({
	loadBackgrounds: vi.fn(async () => [
		{
			name: 'Soldier',
			source: 'XPHB',
			abilityChoices: ['strength', 'dexterity', 'constitution'],
			skillProficiencies: ['athletics', 'intimidation'],
			toolProficiency: { kind: 'named', name: 'Gaming Set' },
			originFeat: { name: 'Savage Attacker', source: 'XPHB' },
			equipmentOptionA: [{ kind: 'item', label: 'Chain Mail' }],
			equipmentOptionB: [{ kind: 'coins', copper: 15000 }],
		},
		{
			name: 'Sage',
			source: 'XPHB',
			abilityChoices: ['intelligence', 'wisdom', 'charisma'],
			skillProficiencies: ['arcana', 'history'],
			toolProficiency: { kind: 'named', name: "Calligrapher's Supplies" },
			originFeat: { name: 'Magic Initiate', source: 'XPHB' },
			equipmentOptionA: [{ kind: 'item', label: 'Quarterstaff' }],
			equipmentOptionB: [{ kind: 'coins', copper: 5000 }],
		},
	]),
}))

afterEach(cleanup)

/** Reads the current value off a form control, avoiding a jest-dom dependency for one matcher. */
function value(element: HTMLElement): string {
	return (element as HTMLInputElement | HTMLSelectElement).value
}

/** The visible text of a <select>'s currently chosen option. */
function selectedOptionText(element: HTMLElement): string | undefined {
	return (element as HTMLSelectElement).selectedOptions[0]?.textContent ?? undefined
}

function fakeStore(): CharacterStore {
	return {
		create: vi.fn(() => ({ id: 'x', name: 'Aria', classes: [] })),
	} as unknown as CharacterStore
}

function renderWizard() {
	const store = fakeStore()
	const onSaved = vi.fn()
	const onCancel = vi.fn()
	render(<CharacterWizard store={store} onSaved={onSaved} onCancel={onCancel} />)
	return { store, onSaved, onCancel }
}

async function fillClassStep(user: ReturnType<typeof userEvent.setup>) {
	await user.type(screen.getByLabelText('Character name'), 'Aria')
	await user.selectOptions(await screen.findByLabelText('Class'), 'Fighter')
}

async function goNext(user: ReturnType<typeof userEvent.setup>) {
	await user.click(screen.getByRole('button', { name: 'Next' }))
}

async function goBack(user: ReturnType<typeof userEvent.setup>) {
	await user.click(screen.getByRole('button', { name: 'Back' }))
}

describe('CharacterWizard — selections survive back-navigation', () => {
	it('class step: class and name are still shown after navigating away and back', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillClassStep(user)
		await goNext(user)
		await screen.findByLabelText('Species')
		await goBack(user)

		expect(value(screen.getByLabelText('Character name'))).toBe('Aria')
		expect(value(await screen.findByLabelText('Class'))).toBe('Fighter|XPHB')
	})

	it('species step: the species selection is still shown after navigating away and back', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillClassStep(user)
		await goNext(user)
		await user.selectOptions(await screen.findByLabelText('Species'), 'Elf (XPHB)')
		await goNext(user)
		await screen.findByLabelText('Background')
		await goBack(user)

		expect(value(await screen.findByLabelText('Species'))).toBe('Elf|XPHB')
	})

	it('background step: the background and ability bonus distribution are still shown after navigating away and back', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillClassStep(user)
		await goNext(user)
		await user.selectOptions(await screen.findByLabelText('Species'), 'Elf (XPHB)')
		await goNext(user)
		await user.selectOptions(await screen.findByLabelText('Background'), 'Soldier (XPHB)')
		await user.selectOptions(screen.getByLabelText('+2'), 'strength')
		await user.selectOptions(screen.getByLabelText('+1'), 'dexterity')
		await goNext(user)
		await screen.findByLabelText('Strength')
		await goBack(user)

		expect(value(await screen.findByLabelText('Background'))).toBe('Soldier|XPHB')
		expect(value(screen.getByLabelText('+2'))).toBe('strength')
		expect(value(screen.getByLabelText('+1'))).toBe('dexterity')
	})

	it('abilities step: the assigned scores are still shown after navigating away and back', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillClassStep(user)
		await goNext(user)
		await user.selectOptions(await screen.findByLabelText('Species'), 'Elf (XPHB)')
		await goNext(user)
		await user.selectOptions(await screen.findByLabelText('Background'), 'Soldier (XPHB)')
		await user.selectOptions(screen.getByLabelText('+2'), 'strength')
		await user.selectOptions(screen.getByLabelText('+1'), 'dexterity')
		await goNext(user)

		await user.selectOptions(screen.getByLabelText('Strength'), '15')
		await user.selectOptions(screen.getByLabelText('Dexterity'), '14')
		await user.selectOptions(screen.getByLabelText('Constitution'), '13')
		await user.selectOptions(screen.getByLabelText('Intelligence'), '12')
		await user.selectOptions(screen.getByLabelText('Wisdom'), '10')
		await user.selectOptions(screen.getByLabelText('Charisma'), '8')

		await goNext(user)
		await screen.findByText('Ability score method: standardArray')
		await goBack(user)

		// The select's value is the standard array's slot INDEX, not the score
		// itself (STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]) — assert on the
		// visible option text, which is what the player actually sees restored.
		expect(selectedOptionText(screen.getByLabelText('Strength'))).toBe('15')
		expect(selectedOptionText(screen.getByLabelText('Dexterity'))).toBe('14')
		expect(selectedOptionText(screen.getByLabelText('Constitution'))).toBe('13')
		expect(selectedOptionText(screen.getByLabelText('Intelligence'))).toBe('12')
		expect(selectedOptionText(screen.getByLabelText('Wisdom'))).toBe('10')
		expect(selectedOptionText(screen.getByLabelText('Charisma'))).toBe('8')
	})
})

describe('CharacterWizard — storage', () => {
	it('writes nothing to the store until the review step saves', async () => {
		const user = userEvent.setup()
		const { store, onSaved } = renderWizard()

		await fillClassStep(user)
		await goNext(user)
		await user.selectOptions(await screen.findByLabelText('Species'), 'Elf (XPHB)')
		await goNext(user)
		await user.selectOptions(await screen.findByLabelText('Background'), 'Soldier (XPHB)')
		await user.selectOptions(screen.getByLabelText('+2'), 'strength')
		await user.selectOptions(screen.getByLabelText('+1'), 'dexterity')
		await goNext(user)
		await user.selectOptions(screen.getByLabelText('Strength'), '15')
		await user.selectOptions(screen.getByLabelText('Dexterity'), '14')
		await user.selectOptions(screen.getByLabelText('Constitution'), '13')
		await user.selectOptions(screen.getByLabelText('Intelligence'), '12')
		await user.selectOptions(screen.getByLabelText('Wisdom'), '10')
		await user.selectOptions(screen.getByLabelText('Charisma'), '8')
		await goNext(user)

		expect(store.create).not.toHaveBeenCalled()

		await user.click(screen.getByRole('button', { name: 'Create character' }))

		expect(store.create).toHaveBeenCalledTimes(1)
		expect(onSaved).toHaveBeenCalledTimes(1)
	})
})
