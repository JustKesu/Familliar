import { describe, expect, it } from 'vitest'
import {
	buildItemIndex,
	buildStartingInventory,
	categoryPickKey,
	extractBackgroundStartingEquipment,
	extractClassStartingEquipment,
	isStartingEquipmentComplete,
	itemCategoryOptions,
	missingCategoryPicks,
	type StartingEquipmentChoice,
} from './startingEquipmentData'

/*
 * Fixtures mirror the real shapes scripts/investigate-starting-equipment.js
 * reported — lowercase item codes with an explicit source, the A/B(/C) class
 * row, the lowercase a/b row EFA backgrounds use, packContents, and the two
 * elements that resolve against no item at all (an item GROUP code and
 * {special}).
 */
const ITEMS = [
	{ name: 'Longsword', source: 'XPHB', type: 'M|XPHB' },
	{ name: 'Dagger', source: 'XPHB', type: 'M|XPHB' },
	{ name: 'Leather Armor', source: 'XPHB', type: 'LA|XPHB' },
	{ name: 'Backpack', source: 'XPHB', type: 'G|XPHB' },
	{ name: 'Rope', source: 'XPHB', type: 'G|XPHB' },
	{ name: 'Candle', source: 'XPHB', type: 'G|XPHB' },
	{
		name: "Burglar's Pack",
		source: 'XPHB',
		type: 'G|XPHB',
		packContents: ['backpack|xphb', { item: 'candle|xphb', quantity: 10 }, 'rope|xphb'],
	},
	{ name: 'Flute', source: 'XPHB', type: 'INS|XPHB', rarity: 'none' },
	{ name: 'Lute', source: 'XPHB', type: 'INS|XPHB', rarity: 'none' },
	{ name: 'Instrument of the Bards', source: 'XDMG', type: 'INS|XPHB', rarity: 'rare' },
	{ name: "Smith's Tools", source: 'XPHB', type: 'AT|XPHB', rarity: 'none' },
	{ name: 'Dice Set', source: 'XPHB', type: 'GS|XPHB', rarity: 'none' },
	{ name: 'Amulet', source: 'XPHB', type: 'SCF|XPHB', scfType: 'holy', rarity: 'none' },
	{ name: 'Emblem', source: 'XPHB', type: 'SCF|XPHB', scfType: 'holy', rarity: 'none' },
	{ name: 'Yew Wand', source: 'XPHB', type: 'SCF|XPHB', scfType: 'druid', rarity: 'none' },
	{ name: 'Tome of the Stilled Tongue', source: 'XDMG', type: 'SCF|XPHB', scfType: 'arcane', rarity: 'legendary' },
]

const INDEX = buildItemIndex(ITEMS)

const CLASSES = [
	{
		entryType: 'class',
		name: 'Bard',
		source: 'XPHB',
		startingEquipment: {
			defaultData: [
				{
					A: [
						{ item: 'leather armor|xphb' },
						{ item: 'dagger|xphb', quantity: 2 },
						{ equipmentType: 'instrumentMusical' },
						{ item: "burglar's pack|xphb" },
						{ value: 1900 },
					],
					B: [{ value: 9000 }],
				},
			],
		},
	},
	{
		entryType: 'class',
		name: 'Wizard',
		source: 'XPHB',
		startingEquipment: {
			defaultData: [{ A: [{ special: 'Spellbook' }], B: [{ value: 5000 }] }],
		},
	},
	{
		entryType: 'class',
		name: 'Monk',
		source: 'XPHB',
		startingEquipment: {
			defaultData: [{ A: [{ equipmentTypes: ['instrumentMusical', 'toolArtisan'] }], B: [{ value: 1100 }] }],
		},
	},
]

const BACKGROUNDS = [
	{
		name: 'Acolyte',
		source: 'XPHB',
		startingEquipment: [{ A: [{ item: 'holy symbol|xphb' }, { value: 800 }], B: [{ value: 5000 }] }],
	},
	{
		name: 'Aberrant Heir',
		source: 'EFA',
		startingEquipment: [{ a: ['dagger|xphb', { value: 1600 }], b: [{ value: 5000 }] }],
	},
]

function choice(overrides: Partial<StartingEquipmentChoice> = {}): StartingEquipmentChoice {
	return { classOptionKey: null, backgroundOptionKey: null, categoryPicks: {}, ...overrides }
}

describe('extractClassStartingEquipment', () => {
	it('reads the A/B option row and resolves lowercase item codes to the stored name and source', () => {
		const offer = extractClassStartingEquipment(CLASSES, 'Bard', 'XPHB', INDEX)

		expect(offer.options.map((option) => option.key)).toEqual(['A', 'B'])
		const first = offer.options[0].elements[0]
		expect(first).toEqual({
			kind: 'items',
			label: 'Leather Armor',
			items: [{ name: 'Leather Armor', source: 'XPHB', quantity: 1 }],
		})
	})

	it('expands a pack into its contents, carrying each content quantity', () => {
		const offer = extractClassStartingEquipment(CLASSES, 'Bard', 'XPHB', INDEX)
		const pack = offer.options[0].elements[3]

		expect(pack).toEqual({
			kind: 'items',
			label: "Burglar's Pack",
			items: [
				{ name: 'Backpack', source: 'XPHB', quantity: 1 },
				{ name: 'Candle', source: 'XPHB', quantity: 10 },
				{ name: 'Rope', source: 'XPHB', quantity: 1 },
			],
		})
	})

	/** items.json carries no Spellbook in any allowed source — it is written from PHB and marked unresolved rather than dropped. */
	it('writes the Wizard\'s {special} spellbook as an unresolved PHB item', () => {
		const offer = extractClassStartingEquipment(CLASSES, 'Wizard', 'XPHB', INDEX)

		expect(offer.options[0].elements[0]).toEqual({
			kind: 'items',
			label: 'Spellbook',
			items: [{ name: 'Spellbook', source: 'PHB', quantity: 1, unresolved: true }],
		})
	})

	it('reads {equipmentTypes} as one choice across both categories', () => {
		const offer = extractClassStartingEquipment(CLASSES, 'Monk', 'XPHB', INDEX)

		expect(offer.options[0].elements[0]).toEqual({
			kind: 'category',
			categories: ['instrumentMusical', 'toolArtisan'],
			label: "a musical instrument or artisan's tools (your choice)",
		})
	})

	it('throws for an element shape the survey did not describe, rather than dropping it', () => {
		const broken = [
			{ entryType: 'class', name: 'Ghost', source: 'XPHB', startingEquipment: { defaultData: [{ A: [{ mystery: 1 }] }] } },
		]
		expect(() => extractClassStartingEquipment(broken, 'Ghost', 'XPHB', INDEX)).toThrow(/unrecognised element/)
	})
})

describe('extractBackgroundStartingEquipment', () => {
	it('reads an EFA background\'s lowercase a/b keys and its bare item-code strings', () => {
		const offer = extractBackgroundStartingEquipment(BACKGROUNDS, 'Aberrant Heir', 'EFA', INDEX)

		expect(offer.options.map((option) => option.key)).toEqual(['a', 'b'])
		expect(offer.options[0].elements).toEqual([
			{ kind: 'items', label: 'Dagger', items: [{ name: 'Dagger', source: 'XPHB', quantity: 1 }] },
			{ kind: 'coins', copper: 1600, label: '1 pp, 6 gp' },
		])
	})

	/** "holy symbol|xphb" is an item GROUP (D34 excludes those from items.json), so it is a category the player picks from. */
	it('turns an item-group code into a category choice', () => {
		const offer = extractBackgroundStartingEquipment(BACKGROUNDS, 'Acolyte', 'XPHB', INDEX)

		expect(offer.options[0].elements[0]).toEqual({
			kind: 'category',
			categories: ['focusHoly'],
			label: 'a holy symbol (your choice)',
		})
	})
})

describe('itemCategoryOptions', () => {
	it('filters each category structurally, excluding the magic items sharing the type code', () => {
		expect(itemCategoryOptions(ITEMS, ['instrumentMusical'])).toEqual([
			{ name: 'Flute', source: 'XPHB' },
			{ name: 'Lute', source: 'XPHB' },
		])
		expect(itemCategoryOptions(ITEMS, ['focusHoly'])).toEqual([
			{ name: 'Amulet', source: 'XPHB' },
			{ name: 'Emblem', source: 'XPHB' },
		])
		expect(itemCategoryOptions(ITEMS, ['focusDruidic'])).toEqual([{ name: 'Yew Wand', source: 'XPHB' }])
	})

	it('merges several categories into one sorted list', () => {
		expect(itemCategoryOptions(ITEMS, ['instrumentMusical', 'toolArtisan']).map((ref) => ref.name)).toEqual([
			'Flute',
			'Lute',
			"Smith's Tools",
		])
	})
})

describe('completeness', () => {
	const classOffer = extractClassStartingEquipment(CLASSES, 'Bard', 'XPHB', INDEX)
	const backgroundOffer = extractBackgroundStartingEquipment(BACKGROUNDS, 'Acolyte', 'XPHB', INDEX)

	it('needs an option from both sides', () => {
		expect(isStartingEquipmentComplete(classOffer, backgroundOffer, choice({ classOptionKey: 'B' }))).toBe(false)
		expect(
			isStartingEquipmentComplete(classOffer, backgroundOffer, choice({ classOptionKey: 'B', backgroundOptionKey: 'B' })),
		).toBe(true)
	})

	it('needs every category element in a chosen option picked', () => {
		const withGear = choice({ classOptionKey: 'A', backgroundOptionKey: 'A' })
		expect(missingCategoryPicks(classOffer, 'class', withGear)).toEqual([categoryPickKey('class', 'A', 2)])
		expect(missingCategoryPicks(backgroundOffer, 'background', withGear)).toEqual([categoryPickKey('background', 'A', 0)])
		expect(isStartingEquipmentComplete(classOffer, backgroundOffer, withGear)).toBe(false)

		const picked = choice({
			classOptionKey: 'A',
			backgroundOptionKey: 'A',
			categoryPicks: {
				[categoryPickKey('class', 'A', 2)]: { name: 'Lute', source: 'XPHB' },
				[categoryPickKey('background', 'A', 0)]: { name: 'Amulet', source: 'XPHB' },
			},
		})
		expect(isStartingEquipmentComplete(classOffer, backgroundOffer, picked)).toBe(true)
	})
})

describe('buildStartingInventory', () => {
	const classOffer = extractClassStartingEquipment(CLASSES, 'Bard', 'XPHB', INDEX)
	const backgroundOffer = extractBackgroundStartingEquipment(BACKGROUNDS, 'Aberrant Heir', 'EFA', INDEX)

	it('writes a package as its individual items, packs already expanded, and adds its coins', () => {
		const picked = choice({
			classOptionKey: 'A',
			backgroundOptionKey: 'b',
			categoryPicks: { [categoryPickKey('class', 'A', 2)]: { name: 'Lute', source: 'XPHB' } },
		})
		const { inventory, currencyCopper } = buildStartingInventory(classOffer, backgroundOffer, picked)

		expect(inventory).toEqual([
			{ name: 'Backpack', source: 'XPHB', quantity: 1 },
			{ name: 'Candle', source: 'XPHB', quantity: 10 },
			{ name: 'Dagger', source: 'XPHB', quantity: 2 },
			{ name: 'Leather Armor', source: 'XPHB', quantity: 1 },
			{ name: 'Lute', source: 'XPHB', quantity: 1 },
			{ name: 'Rope', source: 'XPHB', quantity: 1 },
		])
		expect(currencyCopper).toBe(1900 + 5000)
	})

	it('writes a coin option as copper and no items', () => {
		const { inventory, currencyCopper } = buildStartingInventory(
			classOffer,
			backgroundOffer,
			choice({ classOptionKey: 'B', backgroundOptionKey: 'b' }),
		)

		expect(inventory).toEqual([])
		expect(currencyCopper).toBe(9000 + 5000)
	})

	it('combines the class and the background, merging an item both grant', () => {
		const { inventory, currencyCopper } = buildStartingInventory(
			classOffer,
			backgroundOffer,
			choice({
				classOptionKey: 'A',
				backgroundOptionKey: 'a',
				categoryPicks: { [categoryPickKey('class', 'A', 2)]: { name: 'Lute', source: 'XPHB' } },
			}),
		)

		// 2 daggers from the class package plus the background's 1 — one line, not two.
		expect(inventory.find((item) => item.name === 'Dagger')).toEqual({ name: 'Dagger', source: 'XPHB', quantity: 3 })
		expect(currencyCopper).toBe(1900 + 1600)
	})

	it('contributes nothing for a side whose option is not chosen yet', () => {
		const { inventory, currencyCopper } = buildStartingInventory(classOffer, backgroundOffer, choice({ backgroundOptionKey: 'b' }))

		expect(inventory).toEqual([])
		expect(currencyCopper).toBe(5000)
	})
})
