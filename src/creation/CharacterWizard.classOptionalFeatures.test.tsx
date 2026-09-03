// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CharacterWizard } from './CharacterWizard'
import type { CharacterStore } from '../storage/characterStore'
import type { ClassSpellSlotsData } from '../calculation/spellSlots'
import type { ClassSpellCountData } from '../calculation/spellCounts'
import type { ClassSpellListSpell } from '../spells/classSpellListData'
import type { ClassOptionalFeatureGroup } from '../optionalFeatures/optionalFeatureData'
import type { SpellDetail } from '../spells/spellDetailData'
import type { CharacterOptionalFeatureChoice } from '../storage/character'

/*
 * D64: the class-level optional-feature picker runs as its own wizard step
 * AFTER 'spells'. A separate file from CharacterWizard.test.tsx and
 * CharacterWizard.spells.test.tsx, both of which stub
 * loadClassOptionalFeatureGroups to [] and so never see this step — the mock
 * set below mirrors theirs for every OTHER step, trimmed to what these tests
 * need. The prerequisite evaluation underneath is the REAL one: whether
 * Agonizing Blast is selectable on a first forward pass is the whole point of
 * the change and must not be faked.
 */

vi.mock('../classes/classData', () => ({
	loadBaseClasses: vi.fn(async () => [
		{ name: 'Warlock', source: 'XPHB', hd: { number: 1, faces: 8 } },
		{ name: 'Sorcerer', source: 'XPHB', hd: { number: 1, faces: 6 } },
		{ name: 'Fighter', source: 'XPHB', hd: { number: 1, faces: 10 } },
	]),
}))

vi.mock('../species/speciesData', async (importOriginal) => ({
	...(await importOriginal<typeof import('../species/speciesData')>()),
	loadSpeciesOptions: vi.fn(async () => [{ name: 'Elf', source: 'XPHB', displayName: 'Elf', choiceLabel: null, variants: [] }]),
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
			startingEquipment: {
				options: [
					{ key: 'A', label: 'Option A', elements: [{ kind: 'items', label: 'Chain Mail', items: [{ name: 'Chain Mail', source: 'XPHB', quantity: 1 }] }] },
					{ key: 'B', label: 'Option B', elements: [{ kind: 'coins', copper: 15000, label: '150 gp' }] },
				],
			},
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

vi.mock('../subclass/subclassData', () => ({
	loadSubclassLevelFor: vi.fn(async () => 3),
	loadSubclassesFor: vi.fn(async (className: string) =>
		className === 'Warlock' ? [{ name: 'Archfey Patron', source: 'XPHB', entries: ['Fey magic.'], featureType: null }] : [],
	),
}))

/** The Archfey's real level-3 grant, the case that started the spell-overlap slice. Only name/source are read by the overlap set. */
vi.mock('../spells/subclassPreparedSpells', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../spells/subclassPreparedSpells')>()
	return {
		...actual,
		loadSubclassAlwaysPreparedSpells: vi.fn(async (subclassName: string) =>
			subclassName === 'Archfey Patron'
				? [{ name: 'Misty Step', source: 'XPHB', level: 2, grantedAtLevel: 3, ritual: false, concentration: false, origin: 'subclass' as const }]
				: [],
		),
	}
})

/** Stands in for the real spells.json lookup: echoes each stored pick back as a grant from its own option, which is all the overlap set reads. */
vi.mock('../spells/optionalFeatureSpells', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../spells/optionalFeatureSpells')>()
	return {
		...actual,
		loadOptionalFeatureGrantedSpells: vi.fn(async (character: { optionalFeatureChoices?: CharacterOptionalFeatureChoice[] }) =>
			(character.optionalFeatureChoices ?? []).flatMap((entry) =>
				(entry.spellChoices ?? [])
					.filter((pick) => entry.choices.some((name) => name.toLowerCase() === pick.optionName.toLowerCase()))
					.flatMap((pick) =>
						[...pick.cantrips, ...pick.spells].map((ref) => ({
							...ref,
							level: 0,
							ritual: false,
							concentration: false,
							origin: 'optionalFeature' as const,
							optionName: pick.optionName,
						})),
					),
			),
		),
	}
})

vi.mock('../expertise/expertiseData', () => ({
	loadExpertiseEligibility: vi.fn(async () => null),
}))

vi.mock('../featAsi/featAsiData', () => ({
	loadFeatAsiGrants: vi.fn(async () => []),
	loadFeats: vi.fn(async () => []),
	featsRequiringAbilityChoice: vi.fn(() => new Set<string>()),
}))

/** Starting equipment (step 7 slice a2) — one gear option and one coin option per side, enough to pass through the step. */
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

vi.mock('../featureResolver', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../featureResolver')>()
	return { ...actual, loadResolverData: vi.fn(async () => ({ classFeatures: [], subclassFeatures: [], optionalFeatures: [], feats: [] })) }
})

vi.mock('../spells/subclassSpellChoiceData', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../spells/subclassSpellChoiceData')>()
	return { ...actual, loadSubclassSpellChoiceShape: vi.fn(async () => null) }
})

/** Pact of the Tome's real slots (scripts/investigate-pact-of-the-tome.js); every other option offers no choice. */
vi.mock('../spells/optionalFeatureSpellChoiceData', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../spells/optionalFeatureSpellChoiceData')>()
	return {
		...actual,
		loadOptionalFeatureSpellChoiceShape: vi.fn(async (optionName: string) =>
			optionName === 'Pact of the Tome'
				? { cantripSlot: { levels: [0], filter: { kind: 'any' as const }, count: 3 }, spellSlot: { levels: [1], filter: { kind: 'ritual' as const }, count: 2 } }
				: { cantripSlot: null, spellSlot: null },
		),
		// Dancing Lights and Misty Step are added to the real slot lists so the
		// overlap cases (a class cantrip pick, a subclass grant) are reachable
		// from inside this picker at all.
		loadOptionalFeatureSlotCandidates: vi.fn(async (slot: { levels: number[] }) =>
			slot.levels.includes(0)
				? [
						{ name: 'Mage Hand', source: 'XPHB' },
						{ name: 'Minor Illusion', source: 'XPHB' },
						{ name: 'Prestidigitation', source: 'XPHB' },
						{ name: 'Dancing Lights', source: 'XPHB' },
					]
				: [
						{ name: 'Alarm', source: 'XPHB' },
						{ name: 'Detect Magic', source: 'XPHB' },
						{ name: 'Misty Step', source: 'XPHB' },
					],
		),
	}
})

/*
 * The real filter, verbatim (scripts/investigate-damage-cantrip-prereq.js):
 * Agonizing Blast's only prerequisite is a damaging Warlock cantrip, which
 * before D64 could not be satisfied on a forward pass. Pact of the Blade
 * carries none and is the control.
 */
const INVOCATIONS: ClassOptionalFeatureGroup = {
	featureType: 'EI',
	name: 'Eldritch Invocations',
	count: 2,
	options: [
		{ name: 'Pact of the Blade', source: 'XPHB', entries: ['You can create a pact weapon.'] },
		{ name: 'Pact of the Tome', source: 'XPHB', entries: ['Your patron gives you a grimoire.'] },
		{
			name: 'Agonizing Blast',
			source: 'XPHB',
			entries: ['Add your Charisma modifier to the damage.'],
			prerequisite: [
				{ spell: [{ choose: 'level=0|class=Warlock', entry: 'a Warlock Cantrip That Deals Damage', entrySummary: 'Warlock Cantrip That Deals Damage' }] },
			],
		},
	],
}

const METAMAGIC: ClassOptionalFeatureGroup = {
	featureType: 'MM',
	name: 'Metamagic',
	count: 1,
	options: [
		{ name: 'Careful Spell', source: 'XPHB', entries: ['You can protect allies from your spell.'] },
		{ name: 'Distant Spell', source: 'XPHB', entries: ['You can double the range of a spell.'] },
	],
}

vi.mock('../optionalFeatures/optionalFeatureData', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../optionalFeatures/optionalFeatureData')>()
	return {
		...actual,
		loadOptionalFeatureChoicesFor: vi.fn(async () => null),
		loadClassOptionalFeatureGroups: vi.fn(async (className: string) => {
			if (className === 'Warlock') return [INVOCATIONS]
			if (className === 'Sorcerer') return [METAMAGIC]
			return []
		}),
	}
})

/** Only the two fields the `choose` prerequisites read matter here — level 0 plus a non-empty damageInflict (D21). */
function cantripDetail(name: string, damageInflict: string[], spellAttack?: string[]): SpellDetail {
	return {
		name,
		source: 'XPHB',
		level: 0,
		ritual: false,
		concentration: false,
		time: [],
		range: undefined,
		components: undefined,
		duration: [],
		spellAttack,
		entries: [],
		entriesHigherLevel: [],
		scalingLevelDice: [],
		damageInflict,
	}
}

vi.mock('../spells/spellDetailData', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../spells/spellDetailData')>()
	return {
		...actual,
		loadSpellDetails: vi.fn(async () => [
			cantripDetail('Eldritch Blast', ['force'], ['R']),
			cantripDetail('Prestidigitation', []),
			cantripDetail('Fire Bolt', ['fire'], ['R']),
		]),
	}
})

/*
 * Slot/count rows are trimmed to the smallest set that still exercises the
 * step: the walk has to CROSS the spells step for the ordering to be proven,
 * not reproduce each class's full PHB table.
 */
const spellSlotsData: ClassSpellSlotsData[] = [
	{
		className: 'Warlock',
		classSource: 'XPHB',
		casterProgression: 'pact',
		spellSlotsByLevel: null,
		pactSlotsByLevel: [
			{ count: 1, slotLevel: 1 },
			{ count: 2, slotLevel: 1 },
			{ count: 2, slotLevel: 2 },
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
	{ className: 'Fighter', classSource: 'XPHB', casterProgression: null, spellSlotsByLevel: null, pactSlotsByLevel: null },
]

const spellCountData: ClassSpellCountData[] = [
	{ className: 'Warlock', classSource: 'XPHB', cantripProgression: [2, 2, 2], leveledSpellProgression: [1, 1, 1], label: 'known' },
	{ className: 'Sorcerer', classSource: 'XPHB', cantripProgression: [2, 2, 2], leveledSpellProgression: [1, 1, 1], label: 'known' },
	{ className: 'Fighter', classSource: 'XPHB', cantripProgression: null, leveledSpellProgression: null, label: null },
]

vi.mock('../spells/spellSlotsClassData', () => ({
	loadSpellSlotsClassData: vi.fn(async () => spellSlotsData),
}))

vi.mock('../spells/spellCountClassData', () => ({
	loadSpellCountClassData: vi.fn(async () => spellCountData),
}))

function spell(name: string, level: number): ClassSpellListSpell {
	return { name, source: 'XPHB', level, ritual: false, concentration: false, viaVariant: false }
}

/** Chill Touch is on no optional-feature slot list — the one cantrip a Warlock can take without overlapping the Tome's own offers. */
const warlockSpellList: ClassSpellListSpell[] = [spell('Eldritch Blast', 0), spell('Prestidigitation', 0), spell('Chill Touch', 0), spell('Hex', 1)]
const sorcererSpellList: ClassSpellListSpell[] = [spell('Fire Bolt', 0), spell('Prestidigitation', 0), spell('Magic Missile', 1)]

vi.mock('../spells/classSpellListData', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../spells/classSpellListData')>()
	return {
		...actual,
		loadClassSpellList: vi.fn(async (className: string) => {
			if (className === 'Warlock') return warlockSpellList
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
	render(<CharacterWizard store={fakeStore()} onSaved={vi.fn()} onCancel={() => {}} />)
}

function goNext(user: ReturnType<typeof userEvent.setup>) {
	return user.click(screen.getByRole('button', { name: 'Next' }))
}

function goBack(user: ReturnType<typeof userEvent.setup>) {
	return user.click(screen.getByRole('button', { name: 'Back' }))
}

function checkbox(name: string): HTMLInputElement {
	return screen.getByRole('checkbox', { name }) as HTMLInputElement
}

function stepLabels(): string[] {
	return Array.from(document.querySelectorAll('.wizard__step')).map((li) => li.textContent ?? '')
}

/** Walks class → species → background → languages → abilities, stopping on the spells step. No back-navigation anywhere. */
async function walkToSpells(user: ReturnType<typeof userEvent.setup>, className: string, level: string, subclassName?: string) {
	await user.type(screen.getByLabelText('Character name'), 'Aria')
	await user.selectOptions(await screen.findByLabelText('Class'), className)
	await user.selectOptions(screen.getByLabelText('Level'), level)
	if (subclassName) await user.click(await screen.findByRole('radio', { name: new RegExp(subclassName) }))
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

describe('CharacterWizard — class optional features step (D64)', () => {
	it('a Warlock walked FORWARD can take Agonizing Blast: the step runs after spells, so the cantrip is already known', async () => {
		const user = userEvent.setup()
		renderWizard()

		await user.type(screen.getByLabelText('Character name'), 'Aria')
		await user.selectOptions(await screen.findByLabelText('Class'), 'Warlock')
		await user.selectOptions(screen.getByLabelText('Level'), '3')

		// The class step no longer waits on invocations — the gate moved with the picker.
		expect(await screen.findByText(/Eldritch Invocations/)).toBeTruthy()
		expect(screen.queryByRole('checkbox', { name: 'Agonizing Blast' })).toBeNull()
		expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(false)

		cleanup()
		renderWizard()
		await walkToSpells(user, 'Warlock', '3')

		await user.click(await screen.findByLabelText(/Eldritch Blast/))
		await user.click(screen.getByLabelText(/Prestidigitation/))
		await user.click(screen.getByLabelText(/Hex/))
		await goNext(user)

		// No Back was ever pressed: this is the first forward pass.
		const agonizing = await screen.findByRole('checkbox', { name: 'Agonizing Blast' })
		expect((agonizing as HTMLInputElement).disabled).toBe(false)
		await user.click(agonizing)
		expect(checkbox('Agonizing Blast').checked).toBe(true)
	})

	/*
	 * Build order step 6a: an option that lets the player pick spells gates the
	 * step the same way a spell-granting feat gates the featAsi step
	 * (isCompleteFeatAsiChoice). The group's own count being satisfied is not
	 * enough on its own.
	 */
	it('taking Pact of the Tome blocks the step until its own spell picks are filled', async () => {
		const user = userEvent.setup()
		renderWizard()
		await walkToSpells(user, 'Warlock', '3')

		await user.click(await screen.findByLabelText(/Eldritch Blast/))
		await user.click(screen.getByLabelText(/Prestidigitation/))
		await user.click(screen.getByLabelText(/Hex/))
		await goNext(user)

		await user.click(await screen.findByRole('checkbox', { name: 'Pact of the Blade' }))
		await user.click(checkbox('Pact of the Tome'))
		// Both granted invocation slots are filled, so the group itself is complete...
		expect(screen.getByText('All options chosen.')).toBeTruthy()
		// ...but the Tome's own picks are not.
		expect(await screen.findByText('0 of 3 cantrips chosen.')).toBeTruthy()
		expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true)

		// Dancing Lights, not Prestidigitation: that one is already a class cantrip pick and is no longer offered here.
		await user.click(checkbox('Mage Hand'))
		await user.click(checkbox('Minor Illusion'))
		await user.click(checkbox('Dancing Lights'))
		expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true)

		await user.click(checkbox('Alarm'))
		await user.click(checkbox('Detect Magic'))
		expect(screen.getByText('2 of 2 spells chosen.')).toBeTruthy()
		expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(false)
	})

	it('an invocation that grants no choice leaves the step completable as before', async () => {
		const user = userEvent.setup()
		renderWizard()
		await walkToSpells(user, 'Warlock', '3')

		await user.click(await screen.findByLabelText(/Eldritch Blast/))
		await user.click(screen.getByLabelText(/Prestidigitation/))
		await user.click(screen.getByLabelText(/Hex/))
		await goNext(user)

		await user.click(await screen.findByRole('checkbox', { name: 'Pact of the Blade' }))
		await user.click(checkbox('Agonizing Blast'))
		await waitFor(() => expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(false))
	})

	it('the step is named after the granted progression, not a featureType code, and sits directly after Spells', async () => {
		const user = userEvent.setup()
		renderWizard()
		await walkToSpells(user, 'Warlock', '3')

		const labels = stepLabels()
		const invocations = labels.findIndex((label) => label.includes('Eldritch Invocations'))
		expect(invocations).toBeGreaterThan(-1)
		expect(labels.some((label) => label.includes('EI'))).toBe(false)
		expect(labels[invocations - 1]).toMatch(/Spells/)
	})

	it('navigating away from the step and back preserves the picks (D8)', async () => {
		const user = userEvent.setup()
		renderWizard()
		await walkToSpells(user, 'Warlock', '3')

		await user.click(await screen.findByLabelText(/Eldritch Blast/))
		await user.click(screen.getByLabelText(/Prestidigitation/))
		await user.click(screen.getByLabelText(/Hex/))
		await goNext(user)

		await user.click(await screen.findByRole('checkbox', { name: 'Pact of the Blade' }))
		await user.click(checkbox('Agonizing Blast'))
		expect(checkbox('Pact of the Blade').checked).toBe(true)

		await goBack(user)
		expect(await screen.findByLabelText(/Eldritch Blast/)).toBeTruthy()
		await goNext(user)

		// Both invocation slots are filled, so the list comes back collapsed; open it to read the picks.
		await user.click(await screen.findByRole('button', { name: /Eldritch Invocations/ }))
		await screen.findByRole('checkbox', { name: 'Pact of the Blade' })
		expect(checkbox('Pact of the Blade').checked).toBe(true)
		expect(checkbox('Agonizing Blast').checked).toBe(true)
	})

	it('the step blocks Next until every granted count is filled', async () => {
		const user = userEvent.setup()
		renderWizard()
		await walkToSpells(user, 'Warlock', '3')

		await user.click(await screen.findByLabelText(/Eldritch Blast/))
		await user.click(screen.getByLabelText(/Prestidigitation/))
		await user.click(screen.getByLabelText(/Hex/))
		await goNext(user)

		await screen.findByRole('checkbox', { name: 'Pact of the Blade' })
		expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true)

		await user.click(checkbox('Pact of the Blade'))
		expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true)

		await user.click(checkbox('Agonizing Blast'))
		expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(false)
	})

	it('a Sorcerer (Metamagic, no spell-dependent prerequisite) reaches the step and completes it', async () => {
		const user = userEvent.setup()
		renderWizard()
		await walkToSpells(user, 'Sorcerer', '3')

		await user.click(await screen.findByLabelText(/Fire Bolt/))
		await user.click(screen.getByLabelText(/Prestidigitation/))
		await user.click(screen.getByLabelText(/Magic Missile/))
		await goNext(user)

		expect(stepLabels().some((label) => label.includes('Metamagic'))).toBe(true)
		await user.click(await screen.findByRole('checkbox', { name: 'Careful Spell' }))
		expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(false)

		// Lands on review with the save enabled: the new step satisfies isReadyToSave rather than blocking it.
		await goNext(user)
		const fromClass = await screen.findByRole('group', { name: /From your class/ })
		await user.click(within(fromClass).getByRole('radio', { name: 'Option A' }))
		await user.click(within(screen.getByRole('group', { name: /From your background/ })).getByRole('radio', { name: 'Option B' }))
		await goNext(user)
		const save = (await screen.findByRole('button', { name: 'Create character' })) as HTMLButtonElement
		expect(save.disabled).toBe(false)
	})

	/*
	 * The spell-overlap slice (D18/D44 applied to spells). The Archfey Warlock
	 * below is the hand-tested bug: the subclass grants Misty Step for free
	 * several screens earlier, and the Tome's picker used to offer it again.
	 */
	it("an Archfey Warlock cannot spend a Tome pick on Misty Step, and the reason names the subclass", async () => {
		const user = userEvent.setup()
		renderWizard()
		await walkToSpells(user, 'Warlock', '3', 'Archfey Patron')

		await user.click(await screen.findByLabelText(/Eldritch Blast/))
		await user.click(screen.getByLabelText(/Prestidigitation/))
		await user.click(screen.getByLabelText(/Hex/))
		await goNext(user)

		await user.click(await screen.findByRole('checkbox', { name: 'Pact of the Tome' }))

		const mistyStep = (await screen.findByRole('checkbox', { name: /Misty Step/ })) as HTMLInputElement
		// Still offered, never hidden (D18) — but not selectable, and it says where it comes from.
		expect(mistyStep.disabled).toBe(true)
		expect(mistyStep.labels?.[0]?.textContent).toContain('Archfey Patron')

		await user.click(mistyStep)
		expect(mistyStep.checked).toBe(false)
	})

	it('a spell picked on the class spell step is not selectable in a later picker, and the reason names that step', async () => {
		const user = userEvent.setup()
		renderWizard()
		await walkToSpells(user, 'Warlock', '3')

		await user.click(await screen.findByLabelText(/Eldritch Blast/))
		await user.click(screen.getByLabelText(/Prestidigitation/))
		await user.click(screen.getByLabelText(/Hex/))
		await goNext(user)

		await user.click(await screen.findByRole('checkbox', { name: 'Pact of the Tome' }))

		const prestidigitation = (await screen.findByRole('checkbox', { name: /Prestidigitation/ })) as HTMLInputElement
		expect(prestidigitation.disabled).toBe(true)
		expect(prestidigitation.labels?.[0]?.textContent).toContain('the Spells step')
	})

	it("a picker never disables its own picks — unselecting inside the Tome's own slots still works", async () => {
		const user = userEvent.setup()
		renderWizard()
		await walkToSpells(user, 'Warlock', '3')

		await user.click(await screen.findByLabelText(/Eldritch Blast/))
		await user.click(screen.getByLabelText(/Prestidigitation/))
		await user.click(screen.getByLabelText(/Hex/))
		await goNext(user)

		await user.click(await screen.findByRole('checkbox', { name: 'Pact of the Tome' }))
		await user.click(await screen.findByRole('checkbox', { name: 'Mage Hand' }))
		expect(checkbox('Mage Hand').checked).toBe(true)

		// The pick is now a known spell of this very option; it must stay toggleable.
		await waitFor(() => expect(checkbox('Mage Hand').disabled).toBe(false))
		await user.click(checkbox('Mage Hand'))
		expect(checkbox('Mage Hand').checked).toBe(false)
	})

	it('a character with no overlaps sees every option enabled', async () => {
		const user = userEvent.setup()
		renderWizard()
		await walkToSpells(user, 'Warlock', '3')

		// Eldritch Blast, Chill Touch and Hex — nothing the Tome's own lists offer.
		await user.click(await screen.findByLabelText(/Eldritch Blast/))
		await user.click(screen.getByLabelText(/Chill Touch/))
		await user.click(screen.getByLabelText(/Hex/))
		await goNext(user)

		await user.click(await screen.findByRole('checkbox', { name: 'Pact of the Tome' }))
		await screen.findByText('0 of 3 cantrips chosen.')

		for (const name of ['Mage Hand', 'Minor Illusion', 'Prestidigitation', 'Dancing Lights', 'Alarm', 'Detect Magic', 'Misty Step']) {
			expect(checkbox(name).disabled).toBe(false)
		}
	})

	it('a class granting nothing at class level never sees the step, and the numbering stays contiguous', async () => {
		const user = userEvent.setup()
		renderWizard()

		await user.type(screen.getByLabelText('Character name'), 'Aria')
		await user.selectOptions(await screen.findByLabelText('Class'), 'Fighter')
		await user.selectOptions(screen.getByLabelText('Level'), '3')

		const labels = stepLabels()
		expect(labels.some((label) => label.includes('Eldritch Invocations') || label.includes('Metamagic') || label.includes('Class options'))).toBe(false)
		expect(labels.map((label) => label.split('.')[0])).toEqual(labels.map((_, index) => String(index + 1)))
	})
})
