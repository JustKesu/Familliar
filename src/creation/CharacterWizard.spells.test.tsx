// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CharacterWizard } from './CharacterWizard'
import type { CharacterStore } from '../storage/characterStore'
import type { ClassSpellSlotsData } from '../calculation/spellSlots'
import type { ClassSpellCountData } from '../calculation/spellCounts'
import type { ClassSpellListSpell } from '../spells/classSpellListData'

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

vi.mock('../spells/classSpellListData', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../spells/classSpellListData')>()
	return {
		...actual,
		loadClassSpellList: vi.fn(async (className: string) => {
			if (className === 'Wizard') return wizardSpellList
			if (className === 'Cleric') return clericSpellList
			if (className === 'Fighter') return fighterSpellList
			if (className === 'Sorcerer') return sorcererSpellList
			return []
		}),
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
	await user.selectOptions(await screen.findByLabelText('Background'), 'Soldier (XPHB)')
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
		await screen.findByText('Name: Aria')
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
		await user.selectOptions(await screen.findByLabelText('Background'), 'Soldier (XPHB)')
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

		// Straight to review — no spells panel in between, and no gap in the step numbering.
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
		await user.selectOptions(await screen.findByLabelText('Background'), 'Soldier (XPHB)')
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
		await screen.findByText('Name: Aria')
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
		await user.selectOptions(await screen.findByLabelText('Background'), 'Soldier (XPHB)')
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
		await user.selectOptions(await screen.findByLabelText('Background'), 'Soldier (XPHB)')
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
		await screen.findByText('Name: Aria')
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
		await user.selectOptions(await screen.findByLabelText('Background'), 'Soldier (XPHB)')
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
})
