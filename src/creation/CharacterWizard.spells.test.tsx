// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CharacterWizard } from './CharacterWizard'
import type { CharacterStore } from '../storage/characterStore'
import type { ClassSpellSlotsData } from '../calculation/spellSlots'
import type { ClassSpellCountData } from '../calculation/spellCounts'
import type { ClassSpellListSpell } from '../spells/classSpellListData'
import { loadSubclassAlwaysPreparedSpells } from '../spells/subclassPreparedSpells'

/*
 * Component tests for the class spell picker wired into the wizard (build
 * order step 6, slice d2). A separate file from CharacterWizard.test.tsx
 * so the spell-specific mocks don't bloat the existing suite — the mock set
 * below mirrors it for every OTHER step, trimmed to what these tests need.
 */

vi.mock('../classes/classData', () => ({
	loadBaseClasses: vi.fn(async () => [
		{ name: 'Fighter', source: 'XPHB', hd: { number: 1, faces: 10 } },
		{ name: 'Wizard', source: 'XPHB', hd: { number: 1, faces: 6 } },
		{ name: 'Cleric', source: 'XPHB', hd: { number: 1, faces: 8 } },
		{ name: 'Rogue', source: 'XPHB', hd: { number: 1, faces: 8 } },
		{ name: 'Sorcerer', source: 'XPHB', hd: { number: 1, faces: 6 } },
		{ name: 'Warlock', source: 'XPHB', hd: { number: 1, faces: 8 } },
	]),
}))

vi.mock('../species/speciesData', () => ({
	loadSpecies: vi.fn(async () => [{ name: 'Elf', source: 'XPHB' }]),
	speciesDisplayName: (entry: { name: string }) => entry.name,
}))

vi.mock('../speciesSkills/speciesSkillData', () => ({
	loadSpeciesSkillProficiencies: vi.fn(async () => null),
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
	]),
}))

vi.mock('../toolProficiencies/toolProficiencyData', () => ({
	loadToolCategoryOptions: vi.fn(async () => []),
}))

vi.mock('../classSkills/classSkillData', () => ({
	loadClassSkillChoice: vi.fn(async () => ({ count: 2, options: ['athletics', 'intimidation', 'perception'] })),
}))

vi.mock('../masteries/masteryData', () => ({
	MASTERY_DESCRIPTIONS: {},
	loadMasteryCountFor: vi.fn(async () => 0),
	loadMasteryWeaponsFor: vi.fn(async () => []),
}))

vi.mock('../fightingStyle/fightingStyleData', () => ({
	loadFightingStyleGrantLevel: vi.fn(async () => null),
	fightingStyleOptions: vi.fn(async () => []),
}))

/**
 * Eldritch Knight offered alongside Champion (Fighter), Arcane Trickster
 * alongside Thief (Rogue) — each base class reaches level 3 and can pick
 * either subclass.
 */
vi.mock('../subclass/subclassData', () => ({
	loadSubclassLevelFor: vi.fn(async () => 3),
	loadSubclassesFor: vi.fn(async (className: string) => {
		if (className === 'Rogue') {
			return [
				{ name: 'Thief', source: 'XPHB', entries: ['Fast hands.'], featureType: null },
				{ name: 'Arcane Trickster', source: 'XPHB', entries: ['A spellcasting rogue.'], featureType: null },
			]
		}
		if (className === 'Sorcerer') {
			return [
				{ name: 'Draconic Bloodline', source: 'XPHB', entries: ['Draconic power.'], featureType: null },
				{ name: 'Divine Soul', source: 'XGE', entries: ['A sliver of divinity.'], featureType: null },
			]
		}
		if (className === 'Warlock') {
			return [
				{ name: 'The Hexblade', source: 'XGE', entries: ['A weapon-bound patron; grants spells keyed by Pact Magic slot rank.'], featureType: null },
				{ name: 'Fiend', source: 'XPHB', entries: ['A fiendish patron with ordinary level-keyed grants.'], featureType: null },
				{ name: 'The Undying', source: 'XGE', entries: ['A patron whose always-prepared load fails, for the D43 test.'], featureType: null },
			]
		}
		return [
			{ name: 'Champion', source: 'XPHB', entries: ['Simple, brutal effectiveness.'], featureType: null },
			{ name: 'Eldritch Knight', source: 'XPHB', entries: ['A spellcasting warrior.'], featureType: null },
		]
	}),
}))

vi.mock('../expertise/expertiseData', () => ({
	loadExpertiseEligibility: vi.fn(async () => null),
}))

vi.mock('../optionalFeatures/optionalFeatureData', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../optionalFeatures/optionalFeatureData')>()
	return {
		...actual,
		loadOptionalFeatureChoicesFor: vi.fn(async () => null),
		loadClassOptionalFeatureGroups: vi.fn(async () => []),
	}
})

vi.mock('../featAsi/featAsiData', () => ({
	loadFeatAsiGrants: vi.fn(async () => []),
	loadFeats: vi.fn(async () => []),
	featsRequiringAbilityChoice: vi.fn(() => new Set<string>()),
}))

/** Starting equipment (step 7 slice a2) — a two-option offer on each side, enough for these tests to pass through the step on their way to review. */
vi.mock('../inventory/startingEquipmentData', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../inventory/startingEquipmentData')>()
	const offer = {
		options: [
			{
				key: 'A',
				label: 'Option A',
				elements: [{ kind: 'items', label: 'Dagger', items: [{ name: 'Dagger', source: 'XPHB', quantity: 1 }] }],
			},
			{ key: 'B', label: 'Option B', elements: [{ kind: 'coins', copper: 5000, label: '50 gp' }] },
		],
	}
	return {
		...actual,
		loadClassStartingEquipment: vi.fn(async () => offer),
		loadBackgroundStartingEquipment: vi.fn(async () => offer),
		loadEquipmentCategoryItems: vi.fn(async () => ({
			toolArtisan: [],
			setGaming: [],
			instrumentMusical: [],
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
	]),
}))

const spellSlotsData: ClassSpellSlotsData[] = [
	{
		className: 'Wizard',
		classSource: 'XPHB',
		casterProgression: 'full',
		spellSlotsByLevel: [
			[2, 0, 0, 0, 0, 0, 0, 0, 0],
			[3, 0, 0, 0, 0, 0, 0, 0, 0],
			[4, 2, 0, 0, 0, 0, 0, 0, 0],
		],
		pactSlotsByLevel: null,
	},
	{
		className: 'Cleric',
		classSource: 'XPHB',
		casterProgression: 'full',
		spellSlotsByLevel: [
			[2, 0, 0, 0, 0, 0, 0, 0, 0],
			[3, 0, 0, 0, 0, 0, 0, 0, 0],
			[4, 2, 0, 0, 0, 0, 0, 0, 0],
		],
		pactSlotsByLevel: null,
	},
	{
		className: 'Fighter',
		classSource: 'XPHB',
		casterProgression: null,
		spellSlotsByLevel: null,
		pactSlotsByLevel: null,
		subclasses: [
			{
				subclassName: 'Eldritch Knight',
				casterProgression: '1/3',
				spellSlotsByLevel: [
					[0, 0, 0, 0],
					[0, 0, 0, 0],
					[2, 0, 0, 0],
				],
			},
		],
	},
	{
		className: 'Rogue',
		classSource: 'XPHB',
		casterProgression: null,
		spellSlotsByLevel: null,
		pactSlotsByLevel: null,
		subclasses: [
			{
				subclassName: 'Arcane Trickster',
				casterProgression: '1/3',
				spellSlotsByLevel: [
					[0, 0, 0, 0],
					[0, 0, 0, 0],
					[2, 0, 0, 0],
				],
			},
		],
	},
	{
		className: 'Sorcerer',
		classSource: 'XPHB',
		casterProgression: 'full',
		spellSlotsByLevel: [
			[2, 0, 0, 0, 0, 0, 0, 0, 0],
			[3, 0, 0, 0, 0, 0, 0, 0, 0],
			[4, 2, 0, 0, 0, 0, 0, 0, 0],
		],
		pactSlotsByLevel: null,
	},
	{
		className: 'Warlock',
		classSource: 'XPHB',
		casterProgression: 'pact',
		spellSlotsByLevel: null,
		// slotLevel by character level 1..5: 1,1,2,2,3 — pact-slot rank 2 first reached at level 3, rank 3 at level 5.
		pactSlotsByLevel: [
			{ count: 1, slotLevel: 1 },
			{ count: 2, slotLevel: 1 },
			{ count: 2, slotLevel: 2 },
			{ count: 2, slotLevel: 2 },
			{ count: 2, slotLevel: 3 },
		],
	},
]

const spellCountData: ClassSpellCountData[] = [
	{ className: 'Wizard', classSource: 'XPHB', cantripProgression: [3, 3, 3], leveledSpellProgression: [2, 3, 3], label: 'prepared' },
	{ className: 'Cleric', classSource: 'XPHB', cantripProgression: [3, 3, 3], leveledSpellProgression: [2, 3, 3], label: 'prepared' },
	{
		className: 'Fighter',
		classSource: 'XPHB',
		cantripProgression: null,
		leveledSpellProgression: null,
		label: null,
		subclasses: [{ subclassName: 'Eldritch Knight', cantripProgression: [0, 0, 2], leveledSpellProgression: [0, 0, 3], label: 'known' }],
	},
	{
		className: 'Rogue',
		classSource: 'XPHB',
		cantripProgression: null,
		leveledSpellProgression: null,
		label: null,
		subclasses: [{ subclassName: 'Arcane Trickster', cantripProgression: [0, 0, 2], leveledSpellProgression: [0, 0, 3], label: 'known' }],
	},
	{ className: 'Sorcerer', classSource: 'XPHB', cantripProgression: [3, 3, 3], leveledSpellProgression: [2, 3, 3], label: 'known' },
	{ className: 'Warlock', classSource: 'XPHB', cantripProgression: [2, 2, 2, 2, 2], leveledSpellProgression: [1, 2, 2, 2, 3], label: 'known' },
]

vi.mock('../spells/spellSlotsClassData', () => ({
	loadSpellSlotsClassData: vi.fn(async () => spellSlotsData),
}))

vi.mock('../spells/spellCountClassData', () => ({
	loadSpellCountClassData: vi.fn(async () => spellCountData),
}))

function spell(name: string, level: number, extra: Partial<ClassSpellListSpell> = {}): ClassSpellListSpell {
	return { name, source: 'XPHB', level, ritual: false, concentration: false, viaVariant: false, ...extra }
}

const wizardSpellList: ClassSpellListSpell[] = [
	spell('Prestidigitation', 0),
	spell('Fire Bolt', 0),
	spell('Ray of Frost', 0),
	spell('Magic Missile', 1),
	spell('Find Familiar', 1, { ritual: true }),
	spell('Chromatic Orb', 1, { viaVariant: true }),
	spell('Misty Step', 2),
	spell('Fireball', 3),
]

const fighterSpellList: ClassSpellListSpell[] = [spell('Fire Bolt', 0), spell('Blade Ward', 0), spell('Shield', 1), spell('Magic Missile', 1)]

/** Distinct from wizardSpellList — used both as Cleric's own list and as Divine Soul's `expanded` addition. Shield overlaps sorcererSpellList (slice's de-dup case); Cure Wounds is Cleric-only (the "healing spell now offered" case). */
const clericSpellList: ClassSpellListSpell[] = [spell('Guidance', 0), spell('Cure Wounds', 1), spell('Shield', 1)]

const sorcererSpellList: ClassSpellListSpell[] = [spell('Fire Bolt', 0), spell('Prestidigitation', 0), spell('Magic Missile', 1), spell('Shield', 1)]

/** Blur and Command are also on this list so a patron grant of either shows as a DISABLED offer in the picker (D71), not just in the always-prepared list. */
const warlockSpellList: ClassSpellListSpell[] = [
	spell('Eldritch Blast', 0),
	spell('Chill Touch', 0),
	spell('Hex', 1),
	spell('Command', 1),
	spell('Blur', 2),
	spell('Fear', 3),
]

vi.mock('../spells/classSpellListData', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../spells/classSpellListData')>()
	return {
		...actual,
		loadClassSpellList: vi.fn(async (className: string) => {
			if (className === 'Wizard') return wizardSpellList
			if (className === 'Cleric') return clericSpellList
			if (className === 'Fighter') return fighterSpellList
			if (className === 'Sorcerer') return sorcererSpellList
			if (className === 'Warlock') return warlockSpellList
			return []
		}),
	}
})

/*
 * The Hexblade's grant is keyed by Pact Magic slot RANK ("s1".."s5"), so it
 * only resolves when the wizard hands the loader the Warlock's pact-slot
 * table — the wiring under test. Fiend's grant is ordinary class-level-keyed
 * and is the control (unaffected by the table). Everything else returns [],
 * matching what the real loader does in jsdom (its fetch fails, the effect
 * swallows it) for the EK/AT/Divine Soul cases in this file.
 */
vi.mock('../spells/subclassPreparedSpells', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../spells/subclassPreparedSpells')>()
	return {
		...actual,
		loadSubclassAlwaysPreparedSpells: vi.fn(
			async (
				subclassName: string,
				_subclassSource: string,
				_className: string,
				_classSource: string,
				classLevel: number,
				pactSlotsByLevel?: { count: number; slotLevel: number }[],
			) => {
				if (subclassName === 'The Hexblade') {
					if (!pactSlotsByLevel) return []
					const rank2Level = pactSlotsByLevel.findIndex((row) => row.slotLevel >= 2) + 1
					if (rank2Level === 0 || classLevel < rank2Level) return []
					return [{ name: 'Blur', source: 'XPHB', level: 2, grantedAtLevel: rank2Level, ritual: false, concentration: false, origin: 'subclass' as const }]
				}
				if (subclassName === 'Fiend') {
					return classLevel >= 1
						? [{ name: 'Command', source: 'XPHB', level: 1, grantedAtLevel: 1, ritual: false, concentration: false, origin: 'subclass' as const }]
						: []
				}
				// The Undying's load always fails — the D43 case: the wizard must show the failure, not an empty list.
				if (subclassName === 'The Undying') {
					throw new Error('data/classes.json — HTTP 500')
				}
				return []
			},
		),
	}
})

afterEach(cleanup)

function fakeStore(): CharacterStore {
	return { create: vi.fn(() => ({ id: 'x', name: 'Aria', classes: [] })) } as unknown as CharacterStore
}

function renderWizard() {
	const store = fakeStore()
	const onSaved = vi.fn()
	render(<CharacterWizard store={store} onSaved={onSaved} onCancel={() => {}} />)
	return { store, onSaved }
}

async function fillClassStep(user: ReturnType<typeof userEvent.setup>, className: string, level: string) {
	await user.type(screen.getByLabelText('Character name'), 'Aria')
	await user.selectOptions(await screen.findByLabelText('Class'), className)
	await user.selectOptions(screen.getByLabelText('Level'), level)
}

async function goNext(user: ReturnType<typeof userEvent.setup>) {
	await user.click(screen.getByRole('button', { name: 'Next' }))
}

async function goBack(user: ReturnType<typeof userEvent.setup>) {
	await user.click(screen.getByRole('button', { name: 'Back' }))
}

/** The equipment step (step 7 slice a2) sits between the last picker step and review; these tests only need to pass through it. */
async function passEquipmentStep(user: ReturnType<typeof userEvent.setup>) {
	const fromClass = await screen.findByRole('group', { name: /From your class/ })
	await user.click(within(fromClass).getByRole('radio', { name: 'Option A' }))
	const fromBackground = screen.getByRole('group', { name: /From your background/ })
	await user.click(within(fromBackground).getByRole('radio', { name: 'Option B' }))
	await goNext(user)
}

/** STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] — each score used exactly once, assigned in the order the picker offers them so every pick is still in that ability's own dropdown. */
async function fillThroughAbilities(
	user: ReturnType<typeof userEvent.setup>,
	className: string,
	level: string,
	scores: { str: string; dex: string; con: string; int: string; wis: string; cha: string } = {
		str: '15',
		dex: '14',
		con: '13',
		int: '12',
		wis: '10',
		cha: '8',
	},
) {
	await fillClassStep(user, className, level)
	await goNext(user)
	await user.selectOptions(await screen.findByLabelText('Species'), 'Elf (XPHB)')
	await goNext(user)
	await user.click(await screen.findByRole('radio', { name: 'Soldier (XPHB)' }))
	await user.selectOptions(screen.getByLabelText('+2'), 'strength')
	await user.selectOptions(screen.getByLabelText('+1'), 'dexterity')
	await goNext(user)
	await user.click(await screen.findByLabelText('Draconic (XPHB)'))
	await user.click(screen.getByLabelText('Dwarvish (XPHB)'))
	await goNext(user)
	await user.selectOptions(screen.getByLabelText('Strength'), scores.str)
	await user.selectOptions(screen.getByLabelText('Dexterity'), scores.dex)
	await user.selectOptions(screen.getByLabelText('Constitution'), scores.con)
	await user.selectOptions(screen.getByLabelText('Intelligence'), scores.int)
	await user.selectOptions(screen.getByLabelText('Wisdom'), scores.wis)
	await user.selectOptions(screen.getByLabelText('Charisma'), scores.cha)
	await goNext(user)
}

describe('CharacterWizard — spells step', () => {
	it('a full caster (Wizard 3) is offered spells up to its max slot level, enforces cantrip/leveled counts separately, and picks persist through the wizard', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillThroughAbilities(user, 'Wizard', '3')

		// Level filter: max slot level 2 (row [4,2,0,...]) — Fireball (level 3) must not appear.
		expect(await screen.findByLabelText(/Prestidigitation/)).toBeTruthy()
		expect(screen.getByLabelText(/Misty Step/)).toBeTruthy()
		expect(screen.queryByLabelText(/Fireball/)).toBeNull()
		expect(screen.getByText('0 of 3 cantrips chosen.')).toBeTruthy()
		expect(screen.getByText('0 of 3 spells prepared chosen.')).toBeTruthy()

		// Variant-sourced spell (Chromatic Orb) is offered and selectable, not hidden.
		const variant = (await screen.findByLabelText(/Chromatic Orb/)) as HTMLInputElement
		expect(variant.disabled).toBe(false)

		await user.click(screen.getByLabelText(/Prestidigitation/))
		await user.click(screen.getByLabelText(/Fire Bolt/))
		await user.click(screen.getByLabelText(/Ray of Frost/))
		expect(screen.getByText('3 of 3 cantrips chosen.')).toBeTruthy()
		// Cantrip cap reached — a further cantrip cannot be selected, leveled spells are untouched by it.
		expect((screen.getByLabelText(/Prestidigitation/) as HTMLInputElement).checked).toBe(true)

		await user.click(screen.getByLabelText(/Magic Missile/))
		await user.click(screen.getByLabelText(/Find Familiar/))
		await user.click(variant)
		expect(screen.getByText('3 of 3 spells prepared chosen.')).toBeTruthy()

		await goNext(user)
		await passEquipmentStep(user)
		await screen.findByText('Name: Aria')
		await goBack(user)
		await goBack(user)

		expect((await screen.findByLabelText(/Prestidigitation/) as HTMLInputElement).checked).toBe(true)
		expect((screen.getByLabelText(/Magic Missile/) as HTMLInputElement).checked).toBe(true)
	}, 15000)

	it('a class whose count could look ability-modifier-dependent (Cleric) reads the same count regardless of the chosen Wisdom score', async () => {
		const user = userEvent.setup()
		renderWizard()

		// Minimum possible Wisdom (8) — if the count wrongly depended on the ability modifier, this would show fewer than a high-Wisdom character.
		await fillThroughAbilities(user, 'Cleric', '3', { str: '14', dex: '13', con: '12', int: '15', wis: '8', cha: '10' })

		expect(await screen.findByText('0 of 3 cantrips chosen.')).toBeTruthy()
		expect(screen.getByText('0 of 3 spells prepared chosen.')).toBeTruthy()
	})

	it('a non-caster (Fighter, Champion subclass) never sees the spells step, and numbering stays contiguous', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillClassStep(user, 'Fighter', '3')
		await user.click(await screen.findByRole('radio', { name: /Champion/ }))
		await goNext(user)
		await user.selectOptions(await screen.findByLabelText('Species'), 'Elf (XPHB)')
		await goNext(user)
		await user.click(await screen.findByRole('radio', { name: 'Soldier (XPHB)' }))
		await user.selectOptions(screen.getByLabelText('+2'), 'strength')
		await user.selectOptions(screen.getByLabelText('+1'), 'dexterity')
		await goNext(user)
		await user.click(await screen.findByLabelText('Draconic (XPHB)'))
		await user.click(screen.getByLabelText('Dwarvish (XPHB)'))
		await goNext(user)
		await user.selectOptions(screen.getByLabelText('Strength'), '15')
		await user.selectOptions(screen.getByLabelText('Dexterity'), '14')
		await user.selectOptions(screen.getByLabelText('Constitution'), '13')
		await user.selectOptions(screen.getByLabelText('Intelligence'), '12')
		await user.selectOptions(screen.getByLabelText('Wisdom'), '10')
		await user.selectOptions(screen.getByLabelText('Charisma'), '8')
		await goNext(user)
		await passEquipmentStep(user)

		// Straight to equipment then review — no spells panel in between, and no gap in the step numbering.
		expect(await screen.findByText('Name: Aria')).toBeTruthy()
		expect(screen.queryByText('Spells', { selector: 'li' })).toBeNull()
	})

	it('an Eldritch Knight (Fighter 3) is offered spells from the WIZARD list (not Fighter\'s own, empty, list), capped by its third-caster slot level, and the step can be completed with picks persisting', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillClassStep(user, 'Fighter', '3')
		await user.click(await screen.findByRole('radio', { name: /Eldritch Knight/ }))
		await goNext(user)
		await user.selectOptions(await screen.findByLabelText('Species'), 'Elf (XPHB)')
		await goNext(user)
		await user.click(await screen.findByRole('radio', { name: 'Soldier (XPHB)' }))
		await user.selectOptions(screen.getByLabelText('+2'), 'strength')
		await user.selectOptions(screen.getByLabelText('+1'), 'dexterity')
		await goNext(user)
		await user.click(await screen.findByLabelText('Draconic (XPHB)'))
		await user.click(screen.getByLabelText('Dwarvish (XPHB)'))
		await goNext(user)
		await user.selectOptions(screen.getByLabelText('Strength'), '15')
		await user.selectOptions(screen.getByLabelText('Dexterity'), '14')
		await user.selectOptions(screen.getByLabelText('Constitution'), '13')
		await user.selectOptions(screen.getByLabelText('Intelligence'), '12')
		await user.selectOptions(screen.getByLabelText('Wisdom'), '10')
		await user.selectOptions(screen.getByLabelText('Charisma'), '8')
		await goNext(user)

		// EK's own progression: 2 cantrips, 3 leveled spells known (Fighter subclass counts, not Wizard's).
		expect(await screen.findByText('0 of 2 cantrips chosen.')).toBeTruthy()
		expect(screen.getByText('0 of 3 spells known chosen.')).toBeTruthy()
		// Offered from Wizard's list, capped at EK's max slot level (1 at level 3) — Misty Step (2) and Fireball (3) must not appear.
		expect(screen.getByLabelText(/Fire Bolt/)).toBeTruthy()
		expect(screen.getByLabelText(/Magic Missile/)).toBeTruthy()
		expect(screen.queryByLabelText(/Misty Step/)).toBeNull()
		expect(screen.queryByLabelText(/Fireball/)).toBeNull()

		await user.click(screen.getByLabelText(/Fire Bolt/))
		await user.click(screen.getByLabelText(/Prestidigitation/))
		await user.click(screen.getByLabelText(/Magic Missile/))
		await user.click(screen.getByLabelText(/Find Familiar/))
		await user.click(screen.getByLabelText(/Chromatic Orb/))
		expect(screen.getByText('2 of 2 cantrips chosen.')).toBeTruthy()
		expect(screen.getByText('3 of 3 spells known chosen.')).toBeTruthy()

		await goNext(user)
		await passEquipmentStep(user)
		await screen.findByText('Name: Aria')
		await goBack(user)
		await goBack(user)

		expect((await screen.findByLabelText(/Fire Bolt/) as HTMLInputElement).checked).toBe(true)
		expect((screen.getByLabelText(/Magic Missile/) as HTMLInputElement).checked).toBe(true)
	})

	it('an Arcane Trickster (Rogue 3) is offered spells from the WIZARD list (not Rogue\'s own, empty, list), capped by its third-caster slot level', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillClassStep(user, 'Rogue', '3')
		await user.click(await screen.findByRole('radio', { name: /Arcane Trickster/ }))
		await goNext(user)
		await user.selectOptions(await screen.findByLabelText('Species'), 'Elf (XPHB)')
		await goNext(user)
		await user.click(await screen.findByRole('radio', { name: 'Soldier (XPHB)' }))
		await user.selectOptions(screen.getByLabelText('+2'), 'strength')
		await user.selectOptions(screen.getByLabelText('+1'), 'dexterity')
		await goNext(user)
		await user.click(await screen.findByLabelText('Draconic (XPHB)'))
		await user.click(screen.getByLabelText('Dwarvish (XPHB)'))
		await goNext(user)
		await user.selectOptions(screen.getByLabelText('Strength'), '15')
		await user.selectOptions(screen.getByLabelText('Dexterity'), '14')
		await user.selectOptions(screen.getByLabelText('Constitution'), '13')
		await user.selectOptions(screen.getByLabelText('Intelligence'), '12')
		await user.selectOptions(screen.getByLabelText('Wisdom'), '10')
		await user.selectOptions(screen.getByLabelText('Charisma'), '8')
		await goNext(user)

		expect(await screen.findByText('0 of 2 cantrips chosen.')).toBeTruthy()
		expect(screen.getByText('0 of 3 spells known chosen.')).toBeTruthy()
		expect(screen.getByLabelText(/Fire Bolt/)).toBeTruthy()
		expect(screen.getByLabelText(/Magic Missile/)).toBeTruthy()
		expect(screen.queryByLabelText(/Misty Step/)).toBeNull()
		expect(screen.queryByLabelText(/Fireball/)).toBeNull()
	})

	it("a Divine Soul Sorcerer's picker offers the Sorcerer list UNIONED with the Cleric list (D46 expanded pool-widening), counts stay Sorcerer's own, a spell on both lists appears once, and a chosen Cleric spell persists and renders on the sheet", async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillClassStep(user, 'Sorcerer', '3')
		await user.click(await screen.findByRole('radio', { name: /Divine Soul/ }))
		await goNext(user)
		await user.selectOptions(await screen.findByLabelText('Species'), 'Elf (XPHB)')
		await goNext(user)
		await user.click(await screen.findByRole('radio', { name: 'Soldier (XPHB)' }))
		await user.selectOptions(screen.getByLabelText('+2'), 'strength')
		await user.selectOptions(screen.getByLabelText('+1'), 'dexterity')
		await goNext(user)
		await user.click(await screen.findByLabelText('Draconic (XPHB)'))
		await user.click(screen.getByLabelText('Dwarvish (XPHB)'))
		await goNext(user)
		await user.selectOptions(screen.getByLabelText('Strength'), '15')
		await user.selectOptions(screen.getByLabelText('Dexterity'), '14')
		await user.selectOptions(screen.getByLabelText('Constitution'), '13')
		await user.selectOptions(screen.getByLabelText('Intelligence'), '12')
		await user.selectOptions(screen.getByLabelText('Wisdom'), '10')
		await user.selectOptions(screen.getByLabelText('Charisma'), '8')
		await goNext(user)

		// Counts are Sorcerer's own (spellCountData above), unaffected by the widened pool.
		expect(await screen.findByText('0 of 3 cantrips chosen.')).toBeTruthy()
		expect(screen.getByText('0 of 3 spells known chosen.')).toBeTruthy()

		// Sorcerer's own list is offered...
		expect(screen.getByLabelText(/Fire Bolt/)).toBeTruthy()
		expect(screen.getByLabelText(/Prestidigitation/)).toBeTruthy()
		expect(screen.getByLabelText(/Magic Missile/)).toBeTruthy()
		// ...and the Cleric addition from `expanded` is offered too, including a Cleric-only healing spell.
		expect(screen.getByLabelText(/Guidance/)).toBeTruthy()
		expect(screen.getByLabelText(/Cure Wounds/)).toBeTruthy()
		// Shield is on BOTH lists — it must appear exactly once, not twice.
		expect(screen.getAllByLabelText(/^Shield/)).toHaveLength(1)

		await user.click(screen.getByLabelText(/Fire Bolt/))
		await user.click(screen.getByLabelText(/Prestidigitation/))
		await user.click(screen.getByLabelText(/Guidance/))
		expect(screen.getByText('3 of 3 cantrips chosen.')).toBeTruthy()

		await user.click(screen.getByLabelText(/Magic Missile/))
		await user.click(screen.getByLabelText(/^Shield/))
		await user.click(screen.getByLabelText(/Cure Wounds/))
		expect(screen.getByText('3 of 3 spells known chosen.')).toBeTruthy()

		await goNext(user)
		await passEquipmentStep(user)
		await screen.findByText('Name: Aria')
		await goBack(user)
		await goBack(user)

		expect((await screen.findByLabelText(/Cure Wounds/) as HTMLInputElement).checked).toBe(true)
	})

	it('a non-Divine-Soul Sorcerer (Draconic Bloodline) is offered only the Sorcerer list — no Cleric addition', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillClassStep(user, 'Sorcerer', '3')
		await user.click(await screen.findByRole('radio', { name: /Draconic Bloodline/ }))
		await goNext(user)
		await user.selectOptions(await screen.findByLabelText('Species'), 'Elf (XPHB)')
		await goNext(user)
		await user.click(await screen.findByRole('radio', { name: 'Soldier (XPHB)' }))
		await user.selectOptions(screen.getByLabelText('+2'), 'strength')
		await user.selectOptions(screen.getByLabelText('+1'), 'dexterity')
		await goNext(user)
		await user.click(await screen.findByLabelText('Draconic (XPHB)'))
		await user.click(screen.getByLabelText('Dwarvish (XPHB)'))
		await goNext(user)
		await user.selectOptions(screen.getByLabelText('Strength'), '15')
		await user.selectOptions(screen.getByLabelText('Dexterity'), '14')
		await user.selectOptions(screen.getByLabelText('Constitution'), '13')
		await user.selectOptions(screen.getByLabelText('Intelligence'), '12')
		await user.selectOptions(screen.getByLabelText('Wisdom'), '10')
		await user.selectOptions(screen.getByLabelText('Charisma'), '8')
		await goNext(user)

		expect(await screen.findByText('0 of 3 cantrips chosen.')).toBeTruthy()
		expect(screen.getByLabelText(/Fire Bolt/)).toBeTruthy()
		expect(screen.getByLabelText(/^Shield/)).toBeTruthy()
		// No Cleric addition — Guidance and Cure Wounds are not offered.
		expect(screen.queryByLabelText(/Guidance/)).toBeNull()
		expect(screen.queryByLabelText(/Cure Wounds/)).toBeNull()
	})

	/** Warlock reaches its subclass on the class step (level >= 3), then the standard walk to the spells step. */
	async function fillWarlockThroughSpells(user: ReturnType<typeof userEvent.setup>, subclassPattern: RegExp, level: string) {
		await fillClassStep(user, 'Warlock', level)
		await user.click(await screen.findByRole('radio', { name: subclassPattern }))
		await goNext(user)
		await user.selectOptions(await screen.findByLabelText('Species'), 'Elf (XPHB)')
		await goNext(user)
		await user.click(await screen.findByRole('radio', { name: 'Soldier (XPHB)' }))
		await user.selectOptions(screen.getByLabelText('+2'), 'strength')
		await user.selectOptions(screen.getByLabelText('+1'), 'dexterity')
		await goNext(user)
		await user.click(await screen.findByLabelText('Draconic (XPHB)'))
		await user.click(screen.getByLabelText('Dwarvish (XPHB)'))
		await goNext(user)
		await user.selectOptions(screen.getByLabelText('Strength'), '15')
		await user.selectOptions(screen.getByLabelText('Dexterity'), '14')
		await user.selectOptions(screen.getByLabelText('Constitution'), '13')
		await user.selectOptions(screen.getByLabelText('Intelligence'), '12')
		await user.selectOptions(screen.getByLabelText('Wisdom'), '10')
		await user.selectOptions(screen.getByLabelText('Charisma'), '8')
		await goNext(user)
	}

	it('a Hexblade Warlock past the pact-slot rank sees the rank-keyed grant in the wizard\'s always-prepared list', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillWarlockThroughSpells(user, /The Hexblade/, '5')

		const heading = await screen.findByText('Always prepared from The Hexblade (free, not counted against the choices above):')
		const list = heading.closest('.spell-picker__section--always-prepared') as HTMLElement
		expect(within(list).getByText('Blur')).toBeTruthy()

		// The rank grant only resolves because the wizard now passes the Warlock's own pact-slot table (never a second slot computation).
		expect(vi.mocked(loadSubclassAlwaysPreparedSpells)).toHaveBeenCalledWith(
			'The Hexblade',
			'XGE',
			'Warlock',
			'XPHB',
			5,
			spellSlotsData.find((entry) => entry.className === 'Warlock')!.pactSlotsByLevel,
		)
	})

	it('the Hexblade rank grant is offered disabled in the class spell picker, naming the subclass (D71)', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillWarlockThroughSpells(user, /The Hexblade/, '5')

		const blur = (await screen.findByLabelText(/^Blur/)) as HTMLInputElement
		expect(blur.disabled).toBe(true)
		expect(blur.checked).toBe(false)
		expect(screen.getByText(/already have it from The Hexblade, always prepared/)).toBeTruthy()
	})

	it('a Warlock patron with ordinary level-keyed grants (Fiend) is unaffected — grant still shown and blocked', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillWarlockThroughSpells(user, /Fiend/, '5')

		const heading = await screen.findByText('Always prepared from Fiend (free, not counted against the choices above):')
		const list = heading.closest('.spell-picker__section--always-prepared') as HTMLElement
		expect(within(list).getByText('Command')).toBeTruthy()

		const command = (await screen.findByLabelText(/^Command/)) as HTMLInputElement
		expect(command.disabled).toBe(true)
		expect(screen.getByText(/already have it from Fiend, always prepared/)).toBeTruthy()
	})

	it('a failed always-prepared load is shown, not rendered as an empty list (D43)', async () => {
		const user = userEvent.setup()
		renderWizard()

		await fillWarlockThroughSpells(user, /The Undying/, '5')

		// The list's own failure message...
		expect(await screen.findByText(/Could not load The Undying.+always-prepared spells: data\/classes\.json — HTTP 500/)).toBeTruthy()
		// ...and the spells step warns that the D71 "already have it" set is incomplete.
		expect(screen.getByText(/Couldn.t load everything you already have from your other choices/)).toBeTruthy()
		// It must NOT look like the subclass simply grants nothing.
		expect(screen.queryByText(/Always prepared from The Undying/)).toBeNull()
	})
})
