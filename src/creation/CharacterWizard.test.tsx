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
		{ name: 'Rogue', source: 'XPHB', hd: { number: 1, faces: 8 } },
	]),
}))

vi.mock('../species/speciesData', () => ({
	loadSpecies: vi.fn(async () => [
		{ name: 'Elf', source: 'XPHB' },
		{ name: 'Dwarf', source: 'XPHB' },
		{ name: 'Bugbear', source: 'XPHB' },
	]),
	speciesDisplayName: (entry: { name: string }) => entry.name,
}))

/** Elf offers a choice, Bugbear grants a fixed skill, Dwarf grants none — covers all three picker states. */
vi.mock('../speciesSkills/speciesSkillData', () => ({
	loadSpeciesSkillProficiencies: vi.fn(async (speciesName: string) => {
		if (speciesName === 'Elf') {
			return { kind: 'choice', count: 1, options: ['insight', 'perception', 'survival'] }
		}
		if (speciesName === 'Bugbear') {
			return { kind: 'fixed', skills: ['stealth'] }
		}
		return null
	}),
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
		{
			name: 'Artisan',
			source: 'XPHB',
			abilityChoices: ['strength', 'dexterity', 'intelligence'],
			skillProficiencies: ['investigation', 'perception'],
			toolProficiency: { kind: 'category', category: 'anyArtisansTool', label: "Artisan's tools (your choice)" },
			originFeat: { name: 'Crafter', source: 'XPHB' },
			equipmentOptionA: [{ kind: 'item', label: "Smith's Tools" }],
			equipmentOptionB: [{ kind: 'coins', copper: 3200 }],
		},
	]),
}))

vi.mock('../toolProficiencies/toolProficiencyData', () => ({
	loadToolCategoryOptions: vi.fn(async (category: string) => {
		if (category === 'anyArtisansTool') return ["Carpenter's Tools", "Smith's Tools"]
		return []
	}),
}))

vi.mock('../classSkills/classSkillData', () => ({
	loadClassSkillChoice: vi.fn(async () => ({ count: 2, options: ['athletics', 'intimidation', 'perception'] })),
}))

vi.mock('../masteries/masteryData', () => ({
	MASTERY_DESCRIPTIONS: {},
	loadMasteryCountFor: vi.fn(async () => 1),
	loadMasteryWeaponsFor: vi.fn(async () => [
		{ name: 'Longsword', source: 'XPHB', masteryFull: 'Sap' },
		{ name: 'Greatsword', source: 'XPHB', masteryFull: 'Graze' },
	]),
}))

vi.mock('../fightingStyle/fightingStyleData', () => ({
	loadFightingStyleGrantLevel: vi.fn(async () => 1),
	fightingStyleOptions: vi.fn(async () => [
		{ name: 'Archery', source: 'XPHB', entries: ['+2 to ranged attack rolls.'] },
		{ name: 'Defense', source: 'XPHB', entries: ['+1 AC while wearing armor.'] },
	]),
}))

vi.mock('../subclass/subclassData', () => ({
	loadSubclassLevelFor: vi.fn(async () => 3),
	loadSubclassesFor: vi.fn(async () => [
		{ name: 'Champion', source: 'XPHB', entries: ['Simple, brutal effectiveness.'], featureType: null },
		{ name: 'Battle Master', source: 'XPHB', entries: ['Maneuvers and superiority dice.'], featureType: 'MV:B' },
	]),
}))

/** Rogue grants expertise from level 1 (2 skills, any proficiency); Fighter and Wizard grant none in these tests. */
vi.mock('../expertise/expertiseData', async () => {
	const actual = await vi.importActual<typeof import('../expertise/expertiseData')>('../expertise/expertiseData')
	return {
		...actual,
		loadExpertiseEligibility: vi.fn(async (className: string, _classSource: string, level: number) => {
			if (className === 'Rogue' && level >= 1) return { count: 2, restrictedTo: null }
			return null
		}),
	}
})

vi.mock('../optionalFeatures/optionalFeatureData', () => ({
	loadOptionalFeatureChoicesFor: vi.fn(async (_className: string, _classSource: string, subclassName: string) => {
		if (subclassName === 'Battle Master') {
			return {
				featureType: 'MV:B',
				count: 3,
				options: [
					{ name: 'Trip Attack', source: 'XPHB', entries: ['Knock them down.'] },
					{ name: 'Riposte', source: 'XPHB', entries: ['Strike back.'] },
				],
			}
		}
		return null
	}),
}))

/** Fighter's real class-features.json grants at 4/6/8/12/14/16 (confirmed, scripts/investigate-feat-asi-eligibility.js) — includes the bonus level 6 the flat task-brief list omitted. */
vi.mock('../featAsi/featAsiData', async () => {
	const actual = await vi.importActual<typeof import('../featAsi/featAsiData')>('../featAsi/featAsiData')
	return {
		...actual,
		loadFeatAsiGrants: vi.fn(async (className: string, _classSource: string, level: number) => {
			const table: Record<string, number[]> = { Fighter: [4, 6, 8, 12, 14, 16], Wizard: [4, 8, 12, 16], Rogue: [4, 8, 10, 12, 16] }
			return (table[className] ?? []).filter((l) => l <= level).map((l) => ({ level: l, kind: 'asi' as const }))
		}),
		loadFeats: vi.fn(async () => [
			{ name: 'Tough', source: 'XPHB', category: 'G' },
			{ name: 'Actor', source: 'XPHB', category: 'G', prerequisite: [{ level: 4, ability: [{ cha: 13 }] }] },
		]),
		loadClassPrereqInfo: vi.fn(async () => ({ armorProficiencies: [], weaponProficiencies: [], hasSpellcasting: false })),
		loadHasFightingStyleFeature: vi.fn(async () => false),
		loadSpeciesPrereqInfo: vi.fn(async () => null),
	}
})

vi.mock('../languages/languageData', () => ({
	CHOSEN_LANGUAGE_COUNT: 2,
	AUTOMATIC_LANGUAGE: { name: 'Common', source: 'XPHB' },
	loadLanguages: vi.fn(async () => [
		{ name: 'Draconic', source: 'XPHB' },
		{ name: 'Dwarvish', source: 'XPHB' },
		{ name: 'Elvish', source: 'XPHB' },
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

async function fillLanguagesStep(user: ReturnType<typeof userEvent.setup>) {
	await user.click(await screen.findByLabelText('Draconic (XPHB)'))
	await user.click(screen.getByLabelText('Dwarvish (XPHB)'))
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

	it('species step: a chosen species skill is still shown after navigating away and back', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillClassStep(user)
		await goNext(user)
		await user.selectOptions(await screen.findByLabelText('Species'), 'Elf (XPHB)')
		await user.click(await screen.findByLabelText('Perception'))

		await goNext(user)
		await screen.findByLabelText('Background')
		await goBack(user)

		expect((await screen.findByLabelText('Perception') as HTMLInputElement).checked).toBe(true)
	})

	it('species step: a species with a fixed skill shows the grant, with nothing to pick', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillClassStep(user)
		await goNext(user)
		await user.selectOptions(await screen.findByLabelText('Species'), 'Bugbear (XPHB)')

		expect(await screen.findByText('Species grants: Stealth')).toBeTruthy()
		expect(screen.queryByRole('checkbox')).toBeNull()
	})

	it('species step: a species with no skillProficiencies field shows no picker at all', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillClassStep(user)
		await goNext(user)
		await user.selectOptions(await screen.findByLabelText('Species'), 'Dwarf (XPHB)')

		expect(screen.queryByText(/Species grants/)).toBeNull()
		expect(screen.queryByRole('checkbox')).toBeNull()
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
		await screen.findByLabelText('Draconic (XPHB)')
		await goBack(user)

		expect(value(await screen.findByLabelText('Background'))).toBe('Soldier|XPHB')
		expect(value(screen.getByLabelText('+2'))).toBe('strength')
		expect(value(screen.getByLabelText('+1'))).toBe('dexterity')
	})

	it('background step: a background with a named tool proficiency shows nothing to pick and auto-fills it', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillClassStep(user)
		await goNext(user)
		await user.selectOptions(await screen.findByLabelText('Species'), 'Elf (XPHB)')
		await goNext(user)
		await user.selectOptions(await screen.findByLabelText('Background'), 'Soldier (XPHB)')

		expect(screen.queryByLabelText('Gaming Set')).toBeNull()

		await user.selectOptions(screen.getByLabelText('+2'), 'strength')
		await user.selectOptions(screen.getByLabelText('+1'), 'dexterity')
		await goNext(user)

		// Reaching the languages step proves isStepComplete('background') passed,
		// which requires backgroundToolProficiency to already be set — nothing
		// clicked it, so the named tool must have auto-filled it.
		expect(await screen.findByLabelText('Draconic (XPHB)')).toBeTruthy()
	})

	it('background step: a background with a category tool proficiency lets the player choose one, and the choice survives navigation', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillClassStep(user)
		await goNext(user)
		await user.selectOptions(await screen.findByLabelText('Species'), 'Elf (XPHB)')
		await goNext(user)
		await user.selectOptions(await screen.findByLabelText('Background'), 'Artisan (XPHB)')
		await user.selectOptions(screen.getByLabelText('+2'), 'strength')
		await user.selectOptions(screen.getByLabelText('+1'), 'dexterity')
		await user.click(await screen.findByLabelText("Smith's Tools"))

		await goNext(user)
		await screen.findByLabelText('Draconic (XPHB)')
		await goBack(user)

		expect((await screen.findByLabelText("Smith's Tools") as HTMLInputElement).checked).toBe(true)
	})

	it('languages step: the chosen languages are still shown after navigating away and back', async () => {
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
		await fillLanguagesStep(user)
		await goNext(user)
		await screen.findByLabelText('Strength')
		await goBack(user)

		expect((screen.getByLabelText('Draconic (XPHB)') as HTMLInputElement).checked).toBe(true)
		expect((screen.getByLabelText('Dwarvish (XPHB)') as HTMLInputElement).checked).toBe(true)
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
		await fillLanguagesStep(user)
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

	it('class step: a Fighter\'s class skill, weapon mastery and fighting style are still shown after navigating away and back', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillClassStep(user)
		await user.click(await screen.findByLabelText('Athletics'))
		await user.click(await screen.findByLabelText('Longsword', { exact: false }))
		await user.click(await screen.findByLabelText('Archery'))

		await goNext(user)
		await screen.findByLabelText('Species')
		await goBack(user)

		expect((screen.getByLabelText('Athletics') as HTMLInputElement).checked).toBe(true)
		expect((screen.getByLabelText('Longsword', { exact: false }) as HTMLInputElement).checked).toBe(true)
		expect((screen.getByLabelText('Archery') as HTMLInputElement).checked).toBe(true)
	})

	it('class step: changing the class clears the class skill, weapon mastery and fighting style selections', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillClassStep(user)
		await user.click(await screen.findByLabelText('Athletics'))
		await user.click(await screen.findByLabelText('Longsword', { exact: false }))
		await user.click(await screen.findByLabelText('Archery'))

		await user.selectOptions(screen.getByLabelText('Class'), 'Wizard')

		expect((await screen.findByLabelText('Athletics') as HTMLInputElement).checked).toBe(false)
		expect((screen.getByLabelText('Longsword', { exact: false }) as HTMLInputElement).checked).toBe(false)
		expect(screen.getByText('Choose a fighting style.')).toBeTruthy()

		await user.selectOptions(screen.getByLabelText('Class'), 'Fighter')

		expect((await screen.findByLabelText('Athletics') as HTMLInputElement).checked).toBe(false)
		expect((screen.getByLabelText('Longsword', { exact: false }) as HTMLInputElement).checked).toBe(false)
		expect(screen.getByText('Choose a fighting style.')).toBeTruthy()
	})

	it('class step: a level 3 Fighter\'s subclass choice is still shown after navigating away and back', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillClassStep(user)
		await user.selectOptions(screen.getByLabelText('Level'), '3')
		await user.click(await screen.findByRole('radio', { name: /Champion/ }))

		await goNext(user)
		await screen.findByLabelText('Species')
		await goBack(user)

		expect((screen.getByRole('radio', { name: /Champion/ }) as HTMLInputElement).checked).toBe(true)
	})

	it('class step: changing the class clears the subclass selection', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillClassStep(user)
		await user.selectOptions(screen.getByLabelText('Level'), '3')
		await user.click(await screen.findByRole('radio', { name: /Champion/ }))

		await user.selectOptions(screen.getByLabelText('Class'), 'Wizard')
		await user.selectOptions(screen.getByLabelText('Class'), 'Fighter')
		await user.selectOptions(screen.getByLabelText('Level'), '3')

		expect(screen.getByText('Choose a subclass.')).toBeTruthy()
	})

	it('class step: a Battle Master\'s maneuver picks are still shown after navigating away and back', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillClassStep(user)
		await user.selectOptions(screen.getByLabelText('Level'), '3')
		await user.click(await screen.findByRole('radio', { name: /Battle Master/ }))
		await user.click(await screen.findByLabelText('Trip Attack'))

		await goNext(user)
		await screen.findByLabelText('Species')
		await goBack(user)

		expect((await screen.findByLabelText('Trip Attack') as HTMLInputElement).checked).toBe(true)
	})

	it('class step: changing the subclass clears the maneuver picks', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillClassStep(user)
		await user.selectOptions(screen.getByLabelText('Level'), '3')
		await user.click(await screen.findByRole('radio', { name: /Battle Master/ }))
		await user.click(await screen.findByLabelText('Trip Attack'))

		await user.click(screen.getByRole('radio', { name: /Champion/ }))
		expect(screen.queryByLabelText('Trip Attack')).toBeNull()

		await user.click(screen.getByRole('radio', { name: /Battle Master/ }))

		expect((await screen.findByLabelText('Trip Attack') as HTMLInputElement).checked).toBe(false)
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
		await fillLanguagesStep(user)
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

	it("a Battle Master's maneuver picks survive through to the saved character", async () => {
		const user = userEvent.setup()
		const { store } = renderWizard()

		await fillClassStep(user)
		await user.selectOptions(screen.getByLabelText('Level'), '3')
		await user.click(await screen.findByRole('radio', { name: /Battle Master/ }))
		await user.click(await screen.findByLabelText('Trip Attack'))
		await goNext(user)
		await user.selectOptions(await screen.findByLabelText('Species'), 'Elf (XPHB)')
		await goNext(user)
		await user.selectOptions(await screen.findByLabelText('Background'), 'Soldier (XPHB)')
		await user.selectOptions(screen.getByLabelText('+2'), 'strength')
		await user.selectOptions(screen.getByLabelText('+1'), 'dexterity')
		await goNext(user)
		await fillLanguagesStep(user)
		await goNext(user)
		await user.selectOptions(screen.getByLabelText('Strength'), '15')
		await user.selectOptions(screen.getByLabelText('Dexterity'), '14')
		await user.selectOptions(screen.getByLabelText('Constitution'), '13')
		await user.selectOptions(screen.getByLabelText('Intelligence'), '12')
		await user.selectOptions(screen.getByLabelText('Wisdom'), '10')
		await user.selectOptions(screen.getByLabelText('Charisma'), '8')
		await goNext(user)

		await user.click(screen.getByRole('button', { name: 'Create character' }))

		expect(store.create).toHaveBeenCalledWith(
			'Aria',
			[{ className: 'Fighter', classSource: 'XPHB', subclass: 'Battle Master', level: 3 }],
			{
				method: 'standardArray',
				scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 },
			},
			{ name: 'Elf', source: 'XPHB' },
			{ name: 'Soldier', source: 'XPHB', skillProficiencies: ['athletics', 'intimidation'], toolProficiency: 'Gaming Set' },
			{ strength: 2, dexterity: 1 },
			[
				{ name: 'Common', source: 'XPHB', grantedBy: 'automatic' },
				{ name: 'Draconic', source: 'XPHB', grantedBy: 'creation' },
				{ name: 'Dwarvish', source: 'XPHB', grantedBy: 'creation' },
			],
			[],
			[],
			null,
			[{ featureType: 'MV:B', choices: ['Trip Attack'] }],
			[],
			[],
			[],
			undefined,
		)
	})
})

describe('CharacterWizard — feat/ASI step', () => {
	async function fillThroughAbilities(user: ReturnType<typeof userEvent.setup>, level: string) {
		await fillClassStep(user)
		await user.selectOptions(screen.getByLabelText('Level'), level)
		await goNext(user)
		await user.selectOptions(await screen.findByLabelText('Species'), 'Elf (XPHB)')
		await goNext(user)
		await user.selectOptions(await screen.findByLabelText('Background'), 'Soldier (XPHB)')
		await user.selectOptions(screen.getByLabelText('+2'), 'strength')
		await user.selectOptions(screen.getByLabelText('+1'), 'dexterity')
		await goNext(user)
		await fillLanguagesStep(user)
		await goNext(user)
		await user.selectOptions(screen.getByLabelText('Strength'), '15')
		await user.selectOptions(screen.getByLabelText('Dexterity'), '14')
		await user.selectOptions(screen.getByLabelText('Constitution'), '13')
		await user.selectOptions(screen.getByLabelText('Intelligence'), '12')
		await user.selectOptions(screen.getByLabelText('Wisdom'), '10')
		await user.selectOptions(screen.getByLabelText('Charisma'), '8')
		await goNext(user)
	}

	it('a Fighter at level 4 is offered the feat/ASI step, and an ASI choice survives navigation', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillThroughAbilities(user, '4')

		expect(await screen.findByText('Level 4')).toBeTruthy()
		await user.click(screen.getByLabelText('Ability Score Improvement'))
		const abilitySelect = await screen.findByRole('combobox')
		await user.selectOptions(abilitySelect, 'strength')

		await goNext(user)
		expect(await screen.findByText(/level 4: ASI \(strength \+2\)/)).toBeTruthy()

		await goBack(user)
		expect((screen.getByLabelText('Ability Score Improvement') as HTMLInputElement).checked).toBe(true)
		expect(selectedOptionText(screen.getByRole('combobox'))).toBe('Strength')
	})

	it('a Fighter at level 3 is never offered the feat/ASI step', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillThroughAbilities(user, '3')

		// Straight to review — no feat/ASI panel in between, and no gap in the step numbering.
		expect(await screen.findByText('Name: Aria')).toBeTruthy()
		expect(screen.queryByText('Ability Score Improvement / Feat', { selector: 'li' })).toBeNull()
	})

	it('a Fighter at level 12 sees a feat/ASI choice for every level the class has granted by then — four, not the generic three, because Fighter also gets one at level 6', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillThroughAbilities(user, '12')

		expect(await screen.findByText('Level 4')).toBeTruthy()
		expect(screen.getByText('Level 6')).toBeTruthy()
		expect(screen.getByText('Level 8')).toBeTruthy()
		expect(screen.getByText('Level 12')).toBeTruthy()
	})

	it('a feat with an unmet prerequisite is shown but cannot be taken, and the reason is visible', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillThroughAbilities(user, '4')
		await user.click(screen.getByLabelText('Feat'))

		const actorRadio = (await screen.findByLabelText('Actor')) as HTMLInputElement
		expect(actorRadio.disabled).toBe(true)
		expect(screen.getByText('Requires Charisma 13+.')).toBeTruthy()

		const toughRadio = (await screen.findByLabelText('Tough')) as HTMLInputElement
		expect(toughRadio.disabled).toBe(false)

		// The level-20 ASI cap itself (D20) is exercised in FeatAsiPicker.test.tsx, which can supply a
		// near-cap final ability score directly — standard array + a +2 background bonus tops out at 17,
		// so the full wizard's own chargen tools can never reach the cap boundary to test it here.
	})
})

describe('CharacterWizard — expertise step', () => {
	async function fillThroughBackground(user: ReturnType<typeof userEvent.setup>, cls: string) {
		await user.type(screen.getByLabelText('Character name'), 'Aria')
		await user.selectOptions(await screen.findByLabelText('Class'), cls)
		await goNext(user)
		await user.selectOptions(await screen.findByLabelText('Species'), 'Elf (XPHB)')
		await goNext(user)
		await user.selectOptions(await screen.findByLabelText('Background'), 'Soldier (XPHB)')
		await user.selectOptions(screen.getByLabelText('+2'), 'strength')
		await user.selectOptions(screen.getByLabelText('+1'), 'dexterity')
	}

	it('a Rogue at level 1 is offered the expertise step, and the choice survives navigation', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillThroughBackground(user, 'Rogue')
		await goNext(user)

		// Soldier grants athletics and intimidation outright — enough proficient skills to pick 2 for Expertise.
		await user.click(await screen.findByLabelText(/Athletics/))
		await user.click(screen.getByLabelText(/Intimidation/))

		await goNext(user)
		await screen.findByLabelText('Draconic (XPHB)')
		await goBack(user)

		expect((screen.getByLabelText(/Athletics/) as HTMLInputElement).checked).toBe(true)
		expect((screen.getByLabelText(/Intimidation/) as HTMLInputElement).checked).toBe(true)
	})

	it('a Fighter at level 1 is never offered the expertise step', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillThroughBackground(user, 'Fighter')
		await goNext(user)

		// Straight to languages — no expertise panel in between, and no gap in the step numbering.
		expect(await screen.findByLabelText('Draconic (XPHB)')).toBeTruthy()
		expect(screen.queryByText('Expertise', { selector: 'li' })).toBeNull()
	})

	it('changing the class clears previously chosen expertise skills', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillThroughBackground(user, 'Rogue')
		await goNext(user)
		await user.click(await screen.findByLabelText(/Athletics/))
		await user.click(screen.getByLabelText(/Intimidation/))

		await goBack(user) // expertise -> background
		await goBack(user) // background -> species
		await goBack(user) // species -> class

		await user.selectOptions(screen.getByLabelText('Class'), 'Fighter')
		await user.selectOptions(screen.getByLabelText('Class'), 'Rogue')

		await goNext(user) // class -> species
		await user.selectOptions(await screen.findByLabelText('Species'), 'Elf (XPHB)')
		await goNext(user) // species -> background
		await user.selectOptions(await screen.findByLabelText('Background'), 'Soldier (XPHB)')
		await user.selectOptions(screen.getByLabelText('+2'), 'strength')
		await user.selectOptions(screen.getByLabelText('+1'), 'dexterity')
		await goNext(user) // background -> expertise

		expect((await screen.findByLabelText(/Athletics/) as HTMLInputElement).checked).toBe(false)
		expect((screen.getByLabelText(/Intimidation/) as HTMLInputElement).checked).toBe(false)
	})
})
