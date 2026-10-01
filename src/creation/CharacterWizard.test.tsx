// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { chooseClassSkills, stepBar, stepNav } from './wizardTestNav'
import { chooseButton, isChosen } from '../pickers/choiceTestHelpers'
import userEvent from '@testing-library/user-event'
import { CharacterWizard } from './CharacterWizard'
import type { CharacterStore } from '../storage/characterStore'
import { loadSubclassLevelFor } from '../subclass/subclassData'

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

/** Slice 8b (hit points step): its own data loads, same faces as the class mock above. No feats/species/class-feature bonuses in these tests — that combination is exercised by HitPointsPicker.test.tsx directly. */
vi.mock('../sheet/sheetData', () => ({
	loadHitDiceClassData: vi.fn(async () => [
		{ className: 'Fighter', classSource: 'XPHB', faces: 10 },
		{ className: 'Wizard', classSource: 'XPHB', faces: 6 },
		{ className: 'Rogue', classSource: 'XPHB', faces: 8 },
	]),
	loadFeatEffectEntries: vi.fn(async () => []),
}))
vi.mock('../sheet/grantedClassFeatures', () => ({
	loadGrantedClassFeatures: vi.fn(async () => []),
}))
vi.mock('../sheet/speciesTraitNames', () => ({
	loadSpeciesTraitNames: vi.fn(async () => []),
}))

/** Three species with no choice inside them; the family cases have their own file (CharacterWizard.species.test.tsx). */
vi.mock('../species/speciesData', async (importOriginal) => ({
	...(await importOriginal<typeof import('../species/speciesData')>()),
	loadSpeciesOptions: vi.fn(async () => [
		{ name: 'Elf', source: 'XPHB', displayName: 'Elf', choiceLabel: null, variants: [] },
		{ name: 'Dwarf', source: 'XPHB', displayName: 'Dwarf', choiceLabel: null, variants: [] },
		{ name: 'Bugbear', source: 'XPHB', displayName: 'Bugbear', choiceLabel: null, variants: [] },
	]),
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

vi.mock('../species/speciesSizeData', () => ({ loadSpeciesSizeOptions: vi.fn(async () => ['M']) }))

vi.mock('../spells/speciesSpellcastingAbilityData', () => ({
	loadSpeciesSpellcastingAbilityChoice: vi.fn(async () => null),
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
			startingEquipment: {
				options: [
					{ key: 'A', label: 'Option A', elements: [{ kind: 'items', label: 'Chain Mail', items: [{ name: 'Chain Mail', source: 'XPHB', quantity: 1 }] }] },
					{ key: 'B', label: 'Option B', elements: [{ kind: 'coins', copper: 15000, label: '150 gp' }] },
				],
			},
		},
		{
			name: 'Sage',
			source: 'XPHB',
			abilityChoices: ['intelligence', 'wisdom', 'charisma'],
			skillProficiencies: ['arcana', 'history'],
			toolProficiency: { kind: 'named', name: "Calligrapher's Supplies" },
			originFeat: { name: 'Magic Initiate', source: 'XPHB' },
			startingEquipment: {
				options: [
					{ key: 'A', label: 'Option A', elements: [{ kind: 'items', label: 'Quarterstaff', items: [{ name: 'Quarterstaff', source: 'XPHB', quantity: 1 }] }] },
					{ key: 'B', label: 'Option B', elements: [{ kind: 'coins', copper: 5000, label: '50 gp' }] },
				],
			},
		},
		{
			name: 'Artisan',
			source: 'XPHB',
			abilityChoices: ['strength', 'dexterity', 'intelligence'],
			skillProficiencies: ['investigation', 'perception'],
			toolProficiency: { kind: 'category', category: 'anyArtisansTool', label: "Artisan's tools (your choice)" },
			originFeat: { name: 'Crafter', source: 'XPHB' },
			startingEquipment: {
				options: [
					{ key: 'A', label: 'Option A', elements: [{ kind: 'items', label: "Smith's Tools", items: [{ name: "Smith's Tools", source: 'XPHB', quantity: 1 }] }] },
					{ key: 'B', label: 'Option B', elements: [{ kind: 'coins', copper: 3200, label: '32 gp' }] },
				],
			},
		},
	]),
}))

vi.mock('../toolProficiencies/toolProficiencyData', () => ({
	loadToolCategoryOptions: vi.fn(async (category: string) => {
		if (category === 'anyArtisansTool') return ["Carpenter's Tools", "Smith's Tools"]
		return []
	}),
}))

vi.mock('../classSkills/classSkillData', async (importOriginal) => ({
	...(await importOriginal<typeof import('../classSkills/classSkillData')>()),
	loadClassSkillChoice: vi.fn(async () => ({ count: 2, options: ['athletics', 'intimidation', 'perception', 'survival'] })),
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

vi.mock('../optionalFeatures/optionalFeatureData', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../optionalFeatures/optionalFeatureData')>()
	return {
		...actual,
		loadOptionalFeatureChoicesFor: vi.fn(async (_className: string, _classSource: string, subclassName: string) => {
			if (subclassName === 'Battle Master') {
				return {
					featureType: 'MV:B',
					count: 3,
					options: [
						{ name: 'Trip Attack', source: 'XPHB', entries: ['Knock them down.'] },
						{ name: 'Riposte', source: 'XPHB', entries: ['Strike back.'] },
						{ name: 'Parry', source: 'XPHB', entries: ['Reduce the damage.'] },
					],
				}
			}
			return null
		}),
		/** Fighter grants no class-level optional features; the Warlock/Sorcerer path has its own test file. */
		loadClassOptionalFeatureGroups: vi.fn(async () => []),
	}
})

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

/*
 * Starting equipment (step 7 slice a2). Only the three loaders are stubbed;
 * the parsing, completeness and combining functions stay real, so what gates
 * the step here is the code the app runs. Option C carries a category element,
 * the one option that needs a further pick before the step can complete.
 */
vi.mock('../inventory/startingEquipmentData', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../inventory/startingEquipmentData')>()
	return {
		...actual,
		loadClassStartingEquipment: vi.fn(async () => ({
			options: [
				{
					key: 'A',
					label: 'Option A',
					elements: [
						{ kind: 'items', label: 'Longsword', items: [{ name: 'Longsword', source: 'XPHB', quantity: 1 }] },
						{ kind: 'items', label: 'Dagger ×2', items: [{ name: 'Dagger', source: 'XPHB', quantity: 2 }] },
						{ kind: 'coins', copper: 400, label: '4 gp' },
					],
				},
				{ key: 'B', label: 'Option B', elements: [{ kind: 'coins', copper: 15500, label: '15 pp 5 gp' }] },
				{
					key: 'C',
					label: 'Option C',
					elements: [{ kind: 'category', categories: ['instrumentMusical'], label: 'a musical instrument (your choice)' }],
				},
			],
		})),
		loadBackgroundStartingEquipment: vi.fn(async () => ({
			options: [
				{
					key: 'A',
					label: 'Option A',
					elements: [
						{ kind: 'items', label: 'Dagger', items: [{ name: 'Dagger', source: 'XPHB', quantity: 1 }] },
						{ kind: 'coins', copper: 800, label: '8 gp' },
					],
				},
				{ key: 'B', label: 'Option B', elements: [{ kind: 'coins', copper: 5000, label: '5 gp' }] },
			],
		})),
		loadEquipmentCategoryItems: vi.fn(async () => ({
			toolArtisan: [],
			setGaming: [],
			instrumentMusical: [
				{ name: 'Flute', source: 'XPHB' },
				{ name: 'Lute', source: 'XPHB' },
			],
			focusHoly: [],
			focusDruidic: [],
		})),
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
	await chooseMasteryAndStyle(user)
	await chooseClassSkills(user)
}

/** W-3: the class step's Next needs the mocked mastery (count 1) and fighting style, which the mocks offer to every class. */
async function chooseMasteryAndStyle(user: ReturnType<typeof userEvent.setup>) {
	await user.click(await screen.findByRole('button', { name: 'Choose Longsword' }))
	await user.click(await screen.findByRole('button', { name: 'Choose Archery' }))
}

/** The mocked Battle Master asks for three maneuvers. */
async function chooseManeuvers(user: ReturnType<typeof userEvent.setup>) {
	for (const name of ['Trip Attack', 'Riposte', 'Parry']) await user.click(await screen.findByRole('button', { name: `Choose ${name}` }))
}

/** Dwarf grants no species skill, so the step completes on the species alone — the species step's own gates (D81) have their own file, CharacterWizard.species.test.tsx. */
async function fillSpeciesStep(user: ReturnType<typeof userEvent.setup>) {
	await user.selectOptions(await screen.findByLabelText('Species'), 'Dwarf (XPHB)')
}

async function goNext(user: ReturnType<typeof userEvent.setup>) {
	await user.click(stepNav().getByRole('button', { name: 'Next' }))
}

async function goBack(user: ReturnType<typeof userEvent.setup>) {
	await user.click(stepNav().getByRole('button', { name: 'Back' }))
}

async function fillLanguagesStep(user: ReturnType<typeof userEvent.setup>) {
	await user.click(await screen.findByLabelText('Draconic (XPHB)'))
	await user.click(screen.getByLabelText('Dwarvish (XPHB)'))
}

/** The apply-average-to-all control fills every level in one click — enough to clear the step's gate for tests that don't care about the specific hit point choices. */
async function fillHitPointsStep(user: ReturnType<typeof userEvent.setup>) {
	await user.click(await screen.findByRole('button', { name: /Use the average/ }))
}

/** Takes the class's gear package and the background's coin option — one option from each side, which is what the step requires. */
async function fillEquipmentStep(user: ReturnType<typeof userEvent.setup>) {
	const fromClass = await screen.findByRole('group', { name: /From your class/ })
	await user.click(within(fromClass).getByRole('button', { name: 'Choose class option A' }))
	const fromBackground = screen.getByRole('group', { name: /From your background/ })
	await user.click(within(fromBackground).getByRole('button', { name: 'Choose background option B' }))
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
		await fillSpeciesStep(user)
		await goNext(user)
		await screen.findByLabelText('Search Background')
		await goBack(user)

		expect(value(await screen.findByLabelText('Species'))).toBe('Dwarf|XPHB')
	})

	it('species step: a chosen species skill is still shown after navigating away and back', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillClassStep(user)
		// The class took Perception; give it back so the Elf can pick it.
		await user.click(screen.getByLabelText('Perception'))
		await user.click(screen.getByLabelText('Athletics'))
		await goNext(user)
		await user.selectOptions(await screen.findByLabelText('Species'), 'Elf (XPHB)')
		await user.click(await screen.findByLabelText('Perception'))

		await goNext(user)
		await screen.findByLabelText('Search Background')
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
		await fillSpeciesStep(user)
		await goNext(user)
		await user.click(await screen.findByRole('radio', { name: 'Soldier (XPHB)' }))
		await user.selectOptions(screen.getByLabelText('+2'), 'strength')
		await user.selectOptions(screen.getByLabelText('+1'), 'dexterity')
		await goNext(user)
		await screen.findByLabelText('Draconic (XPHB)')
		await goBack(user)

		// The list collapses once a background is chosen; open it to read the pick back.
		await user.click(await screen.findByRole('button', { name: /^Background/ }))
		expect((screen.getByRole('radio', { name: 'Soldier (XPHB)' }) as HTMLInputElement).checked).toBe(true)
		expect(value(screen.getByLabelText('+2'))).toBe('strength')
		expect(value(screen.getByLabelText('+1'))).toBe('dexterity')
	})

	it('background step: a background picked but not yet distributed survives navigation and still blocks Next until distribution is done', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillClassStep(user)
		await goNext(user)
		await fillSpeciesStep(user)
		await goNext(user)
		await user.click(await screen.findByRole('radio', { name: 'Soldier (XPHB)' }))
		// No ability-bonus distribution made.
		expect((stepNav().getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true)

		await goBack(user) // background -> species
		await screen.findByLabelText('Species')
		await goNext(user) // species -> background

		await user.click(await screen.findByRole('button', { name: /^Background/ }))
		expect((screen.getByRole('radio', { name: 'Soldier (XPHB)' }) as HTMLInputElement).checked).toBe(true)
		expect((stepNav().getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true)

		// Finishing the distribution now completes the step.
		await user.selectOptions(screen.getByLabelText('+2'), 'strength')
		await user.selectOptions(screen.getByLabelText('+1'), 'dexterity')
		expect((stepNav().getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(false)
		await goNext(user)
		expect(await screen.findByLabelText('Draconic (XPHB)')).toBeTruthy()
	})

	it('background step: a partly-made ability bonus distribution survives navigation', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillClassStep(user)
		await goNext(user)
		await fillSpeciesStep(user)
		await goNext(user)
		await user.click(await screen.findByRole('radio', { name: 'Soldier (XPHB)' }))
		await user.selectOptions(screen.getByLabelText('+2'), 'strength')
		// +1 deliberately left unset.

		await goBack(user) // background -> species
		await screen.findByLabelText('Species')
		await goNext(user) // species -> background

		expect(value(await screen.findByLabelText('+2'))).toBe('strength')
		expect(value(screen.getByLabelText('+1'))).toBe('')
		await user.click(await screen.findByRole('button', { name: /^Background/ }))
		expect((screen.getByRole('radio', { name: 'Soldier (XPHB)' }) as HTMLInputElement).checked).toBe(true)
	})

	it('background step: a background with a named tool proficiency shows nothing to pick and auto-fills it', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillClassStep(user)
		await goNext(user)
		await fillSpeciesStep(user)
		await goNext(user)
		await user.click(await screen.findByRole('radio', { name: 'Soldier (XPHB)' }))

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
		await fillSpeciesStep(user)
		await goNext(user)
		await user.click(await screen.findByRole('radio', { name: 'Artisan (XPHB)' }))
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
		await fillSpeciesStep(user)
		await goNext(user)
		await user.click(await screen.findByRole('radio', { name: 'Soldier (XPHB)' }))
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
		await fillSpeciesStep(user)
		await goNext(user)
		await user.click(await screen.findByRole('radio', { name: 'Soldier (XPHB)' }))
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
		await fillEquipmentStep(user)
		await goNext(user)
		await screen.findByText('Ability score method: standardArray')
		await goBack(user)
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

		await goNext(user)
		await screen.findByLabelText('Species')
		await goBack(user)

		// The mastery and fighting-style lists auto-collapse once their one pick is made; reopen them.
		await user.click(await screen.findByRole('button', { name: /Weapon masteries/ }))
		await user.click(screen.getByRole('button', { name: /Fighting style/ }))
		expect((screen.getByLabelText('Intimidation') as HTMLInputElement).checked).toBe(true)
		expect((screen.getByLabelText('Perception') as HTMLInputElement).checked).toBe(true)
		expect(isChosen(chooseButton('Longsword'))).toBe(true)
		expect(isChosen(chooseButton('Archery'))).toBe(true)
	})

	it('class step: changing the class clears the class skill, weapon mastery and fighting style selections', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillClassStep(user)

		await user.selectOptions(screen.getByLabelText('Class'), 'Wizard')

		expect((await screen.findByLabelText('Intimidation') as HTMLInputElement).checked).toBe(false)
		expect(isChosen(chooseButton('Longsword'))).toBe(false)
		expect(screen.getByText('Choose a fighting style.')).toBeTruthy()

		await user.selectOptions(screen.getByLabelText('Class'), 'Fighter')

		expect((await screen.findByLabelText('Intimidation') as HTMLInputElement).checked).toBe(false)
		expect(isChosen(chooseButton('Longsword'))).toBe(false)
		expect(screen.getByText('Choose a fighting style.')).toBeTruthy()
	})

	it('class step: a level 3 Fighter\'s subclass choice is still shown after navigating away and back', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillClassStep(user)
		await user.selectOptions(screen.getByLabelText('Level'), '3')
		await user.click(await screen.findByRole('button', { name: 'Choose Champion' }))

		await goNext(user)
		await screen.findByLabelText('Species')
		await goBack(user)

		// The subclass list auto-collapses once its one pick is made; reopen it.
		await user.click(await screen.findByRole('button', { name: /Subclass/ }))
		expect(isChosen(chooseButton('Champion'))).toBe(true)
	})

	it('class step: changing the class clears the subclass selection', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillClassStep(user)
		await user.selectOptions(screen.getByLabelText('Level'), '3')
		await user.click(await screen.findByRole('button', { name: 'Choose Champion' }))

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
		await user.click(await screen.findByRole('button', { name: 'Choose Battle Master' }))
		await chooseManeuvers(user)

		await goNext(user)
		await screen.findByLabelText('Species')
		await goBack(user)

		// All three picks auto-collapse the list; reopen it.
		await user.click(await screen.findByRole('button', { name: /Options/ }))
		expect(isChosen(await screen.findByRole('button', { name: 'Choose Trip Attack' }))).toBe(true)
	})

	it('class step: changing the subclass clears the maneuver picks', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillClassStep(user)
		await user.selectOptions(screen.getByLabelText('Level'), '3')
		await user.click(await screen.findByRole('button', { name: 'Choose Battle Master' }))
		await user.click(await screen.findByRole('button', { name: 'Choose Trip Attack' }))

		await user.click(screen.getByRole('button', { name: 'Choose Champion' }))
		expect(screen.queryByRole('button', { name: 'Choose Trip Attack' })).toBeNull()

		await user.click(screen.getByRole('button', { name: 'Choose Battle Master' }))

		expect(isChosen(await screen.findByRole('button', { name: 'Choose Trip Attack' }))).toBe(false)
	})

	it('D251: lowering a new Battle Master 3 to level 1 drops the subclass and maneuvers, and Next works', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillClassStep(user)
		await user.selectOptions(screen.getByLabelText('Level'), '3')
		await user.click(await screen.findByRole('button', { name: 'Choose Battle Master' }))
		await chooseManeuvers(user)
		await user.selectOptions(screen.getByLabelText('Level'), '1')

		await vi.waitFor(() => expect((stepNav().getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(false))
		await user.selectOptions(screen.getByLabelText('Level'), '3')
		// Back at level 3 the subclass is asked for again: the old pick did not survive.
		expect(isChosen(await screen.findByRole('button', { name: 'Choose Battle Master' }))).toBe(false)
		expect(screen.queryByRole('button', { name: 'Choose Trip Attack' })).toBeNull()
	})

	it('F-1: one failing requirement loader relaxes only its own pick — the class skills are still demanded', async () => {
		const user = userEvent.setup()
		vi.mocked(loadSubclassLevelFor).mockRejectedValue(new Error('classes.json unavailable'))
		try {
			renderWizard()
			await user.type(screen.getByLabelText('Character name'), 'Aria')
			await user.selectOptions(await screen.findByLabelText('Class'), 'Fighter')
			await chooseMasteryAndStyle(user)
			await screen.findByText(/Could not load subclasses/)
			expect((stepNav().getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true)
			await chooseClassSkills(user)
			await vi.waitFor(() => expect((stepNav().getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(false))
		} finally {
			vi.mocked(loadSubclassLevelFor).mockImplementation(async () => 3)
		}
	})
})

describe('CharacterWizard — storage', () => {
	it('writes nothing to the store until the review step saves', async () => {
		const user = userEvent.setup()
		const { store, onSaved } = renderWizard()

		await fillClassStep(user)
		await goNext(user)
		await fillSpeciesStep(user)
		await goNext(user)
		await user.click(await screen.findByRole('radio', { name: 'Soldier (XPHB)' }))
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
		await fillEquipmentStep(user)
		await goNext(user)

		expect(store.create).not.toHaveBeenCalled()

		await user.click(stepNav().getByRole('button', { name: 'Create character' }))

		expect(store.create).toHaveBeenCalledTimes(1)
		expect(onSaved).toHaveBeenCalledTimes(1)
	})

	it("a Battle Master's maneuver picks survive through to the saved character", async () => {
		const user = userEvent.setup()
		const { store } = renderWizard()

		await fillClassStep(user)
		await user.selectOptions(screen.getByLabelText('Level'), '3')
		await user.click(await screen.findByRole('button', { name: 'Choose Battle Master' }))
		await chooseManeuvers(user)
		await goNext(user)
		await fillSpeciesStep(user)
		await goNext(user)
		await user.click(await screen.findByRole('radio', { name: 'Soldier (XPHB)' }))
		await user.selectOptions(screen.getByLabelText('+2'), 'strength')
		await user.selectOptions(screen.getByLabelText('+1'), 'dexterity')
		await goNext(user)
		await fillLanguagesStep(user)
		// D174: Battle Master's artisan's tool blocks the step until it is chosen.
		expect((stepNav().getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true)
		await user.selectOptions(await screen.findByRole('combobox', { name: /Battle Master tool/ }), "Smith's Tools")
		// D177: so does Student of War's Fighter skill.
		expect((stepNav().getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true)
		await user.selectOptions(screen.getByRole('combobox', { name: /Battle Master skill/ }), 'History')
		await goNext(user)
		await user.selectOptions(screen.getByLabelText('Strength'), '15')
		await user.selectOptions(screen.getByLabelText('Dexterity'), '14')
		await user.selectOptions(screen.getByLabelText('Constitution'), '13')
		await user.selectOptions(screen.getByLabelText('Intelligence'), '12')
		await user.selectOptions(screen.getByLabelText('Wisdom'), '10')
		await user.selectOptions(screen.getByLabelText('Charisma'), '8')
		await goNext(user)
		await fillHitPointsStep(user)
		await goNext(user)
		await fillEquipmentStep(user)
		await goNext(user)

		await user.click(stepNav().getByRole('button', { name: 'Create character' }))

		expect(store.create).toHaveBeenCalledWith({
			name: 'Aria',
			classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Battle Master', level: 3 }],
			abilityScores: {
				method: 'standardArray',
				scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 },
			},
			species: { name: 'Dwarf', source: 'XPHB' },
			background: { name: 'Soldier', source: 'XPHB', skillProficiencies: ['athletics', 'intimidation'], toolProficiency: 'Gaming Set' },
			abilityBonus: { strength: 2, dexterity: 1 },
			languages: [
				{ name: 'Common', source: 'XPHB', grantedBy: 'automatic' },
				{ name: 'Draconic', source: 'XPHB', grantedBy: 'creation' },
				{ name: 'Dwarvish', source: 'XPHB', grantedBy: 'creation' },
			],
			classSkills: ['intimidation', 'perception'],
			masteries: [{ name: 'Longsword' }],
			fightingStyle: 'Archery',
			optionalFeatureChoices: [{ featureType: 'MV:B', choices: [{ name: 'Trip Attack' }, { name: 'Riposte' }, { name: 'Parry' }] }],
			speciesSkills: [],
			expertiseSkills: [],
			featAsiChoices: [],
			spellChoices: undefined,
			subclassSpellChoices: undefined,
			classFeatureChoices: undefined,
			wildShapeForms: undefined,
			toolChoices: [{ grantedBy: 'battleMaster', name: "Smith's Tools" }],
			subclassSkills: [{ grantedBy: 'battleMaster', name: 'history' }],
			// The class's gear package and the background's coin option, combined:
			// the package's items, and 4 gp from it plus 50 gp from the background.
			inventory: [
				{ name: 'Dagger', source: 'XPHB', quantity: 2 },
				{ name: 'Longsword', source: 'XPHB', quantity: 1 },
			],
			currencyCopper: 5400,
			speciesSpellcastingAbility: undefined,
			hitPointLevels: [
				{ level: 2, kind: 'average', dieResult: 6 },
				{ level: 3, kind: 'average', dieResult: 6 },
			],
			createdAtLevel: 3,
			// D107: a freshly created character starts unhurt — 10 (level 1 max) + 6 + 6 (stored average) + 1 (CON mod) × 3 levels.
			currentHp: 25,
		})
	})
})

describe('CharacterWizard — starting equipment step', () => {
	async function fillThroughAbilities(user: ReturnType<typeof userEvent.setup>) {
		await fillClassStep(user)
		await goNext(user)
		await fillSpeciesStep(user)
		await goNext(user)
		await user.click(await screen.findByRole('radio', { name: 'Soldier (XPHB)' }))
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

	it('blocks Next until an option is taken from BOTH the class and the background', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillThroughAbilities(user)
		const fromClass = await screen.findByRole('group', { name: /From your class/ })
		expect((stepNav().getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true)

		await user.click(within(fromClass).getByRole('button', { name: 'Choose class option A' }))
		expect((stepNav().getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true)

		const fromBackground = screen.getByRole('group', { name: /From your background/ })
		await user.click(within(fromBackground).getByRole('button', { name: 'Choose background option B' }))
		expect((stepNav().getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(false)
	})

	it('a coin-only option on both sides saves money and no items', async () => {
		const user = userEvent.setup()
		const { store } = renderWizard()

		await fillThroughAbilities(user)
		const fromClass = await screen.findByRole('group', { name: /From your class/ })
		await user.click(within(fromClass).getByRole('button', { name: 'Choose class option B' }))
		const fromBackground = screen.getByRole('group', { name: /From your background/ })
		await user.click(within(fromBackground).getByRole('button', { name: 'Choose background option B' }))
		await goNext(user)
		await user.click(await stepNav().findByRole('button', { name: 'Create character' }))

		const call = vi.mocked(store.create).mock.calls[0][0]
		expect(call.inventory).toEqual([])
		expect(call.currencyCopper).toBe(20500)
	})

	it('a category element blocks the step until an item is picked, and that pick lands in the inventory', async () => {
		const user = userEvent.setup()
		const { store } = renderWizard()

		await fillThroughAbilities(user)
		const fromClass = await screen.findByRole('group', { name: /From your class/ })
		await user.click(within(fromClass).getByRole('button', { name: 'Choose class option C' }))
		const fromBackground = screen.getByRole('group', { name: /From your background/ })
		await user.click(within(fromBackground).getByRole('button', { name: 'Choose background option B' }))

		// Both options taken, but the instrument the option grants is still unnamed.
		expect((stepNav().getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true)

		await user.click(await screen.findByRole('button', { name: 'Choose Flute' }))
		expect((stepNav().getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(false)

		await goNext(user)
		await user.click(await stepNav().findByRole('button', { name: 'Create character' }))

		const call = vi.mocked(store.create).mock.calls[0][0]
		expect(call.inventory).toEqual([{ name: 'Flute', source: 'XPHB', quantity: 1 }])
		expect(call.currencyCopper).toBe(5000)
	})
})

describe('CharacterWizard — feat/ASI step', () => {
	async function fillThroughAbilities(user: ReturnType<typeof userEvent.setup>, level: string) {
		await fillClassStep(user)
		await user.selectOptions(screen.getByLabelText('Level'), level)
		if (Number(level) >= 3) await user.click(await screen.findByRole('button', { name: 'Choose Champion' }))
		await goNext(user)
		await fillSpeciesStep(user)
		await goNext(user)
		await user.click(await screen.findByRole('radio', { name: 'Soldier (XPHB)' }))
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

		expect(await screen.findByRole('group', { name: 'Level 4' })).toBeTruthy()
		await user.selectOptions(await screen.findByRole('combobox', { name: 'Level 4 feat or ASI' }), 'asi')
		await user.selectOptions(await screen.findByRole('combobox', { name: 'Level 4 +2 ability' }), 'strength')

		await goNext(user)
		await fillHitPointsStep(user)
		await goNext(user)
		await fillEquipmentStep(user)
		await goNext(user)
		expect(await screen.findByText(/level 4: ASI \(strength \+2\)/)).toBeTruthy()

		await goBack(user)
		await goBack(user)
		await goBack(user)
		// W17: back on the step, the complete card is collapsed with its summary.
		const header = await screen.findByRole('button', { name: 'Level 4 — Ability Score Improvement (+2 STR)' })
		expect(header.getAttribute('aria-expanded')).toBe('false')
		await user.click(header)
		expect((screen.getByRole('combobox', { name: 'Level 4 feat or ASI' }) as HTMLSelectElement).value).toBe('asi')
		expect(selectedOptionText(screen.getByRole('combobox', { name: 'Level 4 +2 ability' }))).toBe('Strength')
	})

	it('a Fighter at level 3 is never offered the feat/ASI step', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillThroughAbilities(user, '3')
		await fillHitPointsStep(user)
		await goNext(user)
		await fillEquipmentStep(user)
		await goNext(user)

		// Straight to hit points, then equipment then review — no feat/ASI panel in between, and no gap in the step numbering.
		expect(await screen.findByText('Name: Aria')).toBeTruthy()
		expect(stepBar().queryByText(/ASI \/ Feat/)).toBeNull()
	})

	it('a Fighter at level 12 sees a feat/ASI choice for every level the class has granted by then — four, not the generic three, because Fighter also gets one at level 6', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillThroughAbilities(user, '12')

		expect(await screen.findByRole('group', { name: 'Level 4' })).toBeTruthy()
		expect(screen.getByRole('group', { name: 'Level 6' })).toBeTruthy()
		expect(screen.getByRole('group', { name: 'Level 8' })).toBeTruthy()
		expect(screen.getByRole('group', { name: 'Level 12' })).toBeTruthy()
	})

	it('a feat with an unmet prerequisite is shown but cannot be taken, and the reason is visible', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillThroughAbilities(user, '4')
		const select = (await screen.findByRole('combobox', { name: 'Level 4 feat or ASI' })) as HTMLSelectElement
		const optionFor = (name: string) => Array.from(select.options).find((option) => option.textContent?.startsWith(`${name} · `))!

		expect(optionFor('Actor').disabled).toBe(true)
		expect(optionFor('Actor').textContent).toContain('(needs CHA 13)')
		expect(optionFor('Tough').disabled).toBe(false)

		// The level-20 ASI cap itself (D20) is exercised in FeatAsiPicker.test.tsx, which can supply a
		// near-cap final ability score directly — standard array + a +2 background bonus tops out at 17,
		// so the full wizard's own chargen tools can never reach the cap boundary to test it here.
	})
})

describe('CharacterWizard — expertise step', () => {
	async function fillThroughBackground(user: ReturnType<typeof userEvent.setup>, cls: string) {
		await user.type(screen.getByLabelText('Character name'), 'Aria')
		await user.selectOptions(await screen.findByLabelText('Class'), cls)
		await chooseMasteryAndStyle(user)
		await chooseClassSkills(user)
		await goNext(user)
		await fillSpeciesStep(user)
		await goNext(user)
		await user.click(await screen.findByRole('radio', { name: 'Soldier (XPHB)' }))
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

	it("D172: a Rogue's languages step has a Thieves' Cant slot that goes away with the class", async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillThroughBackground(user, 'Rogue')
		await goNext(user)
		await user.click(await screen.findByLabelText(/Athletics/))
		await user.click(screen.getByLabelText(/Intimidation/))
		await goNext(user)
		await fillLanguagesStep(user)

		const slot = await screen.findByRole('combobox', { name: /Thieves' Cant language/ })
		// The two creation picks are never offered again.
		expect(within(slot).queryByRole('option', { name: 'Draconic' })).toBeNull()
		expect((stepNav().getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true)
		await user.selectOptions(slot, 'Elvish')
		expect((stepNav().getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(false)
		// A feature pick is no longer offered as a creation pick.
		expect(screen.queryByLabelText('Elvish (XPHB)')).toBeNull()

		for (let i = 0; i < 4; i++) await goBack(user)
		await user.selectOptions(await screen.findByLabelText('Class'), 'Fighter')
		await chooseMasteryAndStyle(user)
		// Soldier (already chosen) holds Athletics and Intimidation, so the class takes the other two.
		await chooseClassSkills(user, ['Perception', 'Survival'])
		for (let i = 0; i < 3; i++) await goNext(user)
		await screen.findByLabelText('Draconic (XPHB)')
		expect(screen.queryByRole('combobox', { name: /Thieves' Cant language/ })).toBeNull()
	})

	it('a Fighter at level 1 is never offered the expertise step', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillThroughBackground(user, 'Fighter')
		await goNext(user)

		// Straight to languages — no expertise panel in between, and no gap in the step numbering.
		expect(await screen.findByLabelText('Draconic (XPHB)')).toBeTruthy()
		expect(stepBar().queryByText(/Expertise/)).toBeNull()
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
		await chooseMasteryAndStyle(user)
		await chooseClassSkills(user, ['Perception', 'Survival'])

		await goNext(user) // class -> species
		await fillSpeciesStep(user)
		await goNext(user) // species -> background
		// Background is not class-dependent, so the Soldier pick (and its ability
		// bonus) survived the class change; the list is collapsed on return.
		await user.click(await screen.findByRole('button', { name: /^Background/ }))
		expect((screen.getByRole('radio', { name: 'Soldier (XPHB)' }) as HTMLInputElement).checked).toBe(true)
		await goNext(user) // background -> expertise

		expect((await screen.findByLabelText(/Athletics/) as HTMLInputElement).checked).toBe(false)
		expect((screen.getByLabelText(/Intimidation/) as HTMLInputElement).checked).toBe(false)
	})
})
