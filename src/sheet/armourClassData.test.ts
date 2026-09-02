import { describe, expect, it } from 'vitest'
import { noMagicBonus } from '../calculation/magicBonus'
import type { ItemRef } from '../inventory/inventoryData'
import type { Character } from '../storage/character'
import { acFormulaKeysFrom, buildEquippedGear, hasMageArmor } from './armourClassData'

/* Mirrors the real rows scripts/investigate-armour-class.js printed. */
const CLASS_FEATURES = [
	{ name: 'Unarmored Defense', className: 'Barbarian', classSource: 'XPHB', level: 1 },
	{ name: 'Unarmored Defense', className: 'Monk', classSource: 'XPHB', level: 1 },
	{ name: 'Rage', className: 'Barbarian', classSource: 'XPHB', level: 1 },
]

const SUBCLASS_FEATURES = [
	{ name: 'Draconic Resilience', className: 'Sorcerer', classSource: 'XPHB', subclassShortName: 'Draconic', subclassSource: 'XPHB', level: 3 },
	{ name: 'Unarmored Defense', className: 'Bard', classSource: 'XPHB', subclassShortName: 'Dance', subclassSource: 'XPHB', level: 3 },
]

const CLASSES = [
	{ entryType: 'subclass', name: 'Draconic Sorcery', shortName: 'Draconic', source: 'XPHB', className: 'Sorcerer', classSource: 'XPHB' },
	{ entryType: 'subclass', name: 'Wild Magic Sorcery', shortName: 'Wild Magic', source: 'XPHB', className: 'Sorcerer', classSource: 'XPHB' },
	{ entryType: 'subclass', name: 'College of Dance', shortName: 'Dance', source: 'XPHB', className: 'Bard', classSource: 'XPHB' },
]

function character(classes: Character['classes']): Character {
	return { id: '1', name: 'Test', classes }
}

function keysFor(classes: Character['classes'], knowsMageArmor = false) {
	return acFormulaKeysFrom(character(classes), CLASS_FEATURES, SUBCLASS_FEATURES, CLASSES, knowsMageArmor)
}

describe('acFormulaKeysFrom', () => {
	it('finds a class feature the character has by their level', () => {
		expect(keysFor([{ className: 'Barbarian', classSource: 'XPHB', subclass: null, level: 1 }])).toEqual(['barbarian-unarmored-defense'])
		expect(keysFor([{ className: 'Monk', classSource: 'XPHB', subclass: null, level: 5 }])).toEqual(['monk-unarmored-defense'])
	})

	it('finds a subclass feature only for the right subclass, joining its stored NAME to the shortName its features are filed under', () => {
		expect(keysFor([{ className: 'Sorcerer', classSource: 'XPHB', subclass: 'Draconic Sorcery', level: 3 }])).toEqual(['draconic-resilience'])
		expect(keysFor([{ className: 'Sorcerer', classSource: 'XPHB', subclass: 'Wild Magic Sorcery', level: 3 }])).toEqual([])
		expect(keysFor([{ className: 'Bard', classSource: 'XPHB', subclass: 'College of Dance', level: 3 }])).toEqual(['dance-unarmored-defense'])
	})

	it('offers nothing below the level the feature is granted at, or with no subclass chosen', () => {
		expect(keysFor([{ className: 'Sorcerer', classSource: 'XPHB', subclass: 'Draconic Sorcery', level: 2 }])).toEqual([])
		expect(keysFor([{ className: 'Sorcerer', classSource: 'XPHB', subclass: null, level: 5 }])).toEqual([])
	})

	it('collects one key per eligible class of a multiclass character, plus Mage Armor when the spell is in the list', () => {
		const keys = keysFor(
			[
				{ className: 'Barbarian', classSource: 'XPHB', subclass: null, level: 1 },
				{ className: 'Sorcerer', classSource: 'XPHB', subclass: 'Draconic Sorcery', level: 3 },
			],
			true,
		)
		expect(keys).toEqual(['barbarian-unarmored-defense', 'draconic-resilience', 'mage-armor'])
	})

	it('throws on a data file that is not an array', () => {
		expect(() => acFormulaKeysFrom(character([]), {}, SUBCLASS_FEATURES, CLASSES, false)).toThrow('class-features.json')
	})
})

describe('hasMageArmor', () => {
	it('is true only when the spell is in the list, however it got there', () => {
		expect(hasMageArmor([{ name: 'Shield' }, { name: 'Mage Armor' }])).toBe(true)
		expect(hasMageArmor([{ name: 'Fire Bolt' }])).toBe(false)
	})
})

const ITEMS: ItemRef[] = [
	{ name: 'Chain Mail', source: 'XPHB', typeCode: 'HA', armor: true, ac: 16, strength: '13', stealth: true },
	{ name: 'Leather Armor', source: 'XPHB', typeCode: 'LA', armor: true, ac: 11 },
	{ name: 'Shield', source: 'XPHB', typeCode: 'S', ac: 2 },
	{ name: 'Longsword', source: 'XPHB', typeCode: 'M', weapon: true },
	{ name: 'Torch', source: 'XPHB', typeCode: 'G' },
	{ name: 'Dragon Scale Mail', source: 'XDMG', typeCode: 'MA', ac: 14, bonusAc: 1 },
]

describe('buildEquippedGear', () => {
	it('resolves the worn suit and the held shield, parsing the Strength requirement out of its string form', () => {
		const gear = buildEquippedGear(
			[
				{ name: 'Chain Mail', source: 'XPHB', quantity: 1, equipped: 'worn' },
				{ name: 'Shield', source: 'XPHB', quantity: 1, equipped: 'held' },
				{ name: 'Longsword', source: 'XPHB', quantity: 1, equipped: 'held' },
			],
			ITEMS,
		)
		expect(gear.armour).toEqual({
			name: 'Chain Mail',
			category: 'heavy',
			ac: 16,
			strengthRequirement: 13,
			stealthDisadvantage: true,
			magicBonus: noMagicBonus('Chain Mail'),
		})
		expect(gear.shield).toEqual({ name: 'Shield', acBonus: 2, magicBonus: noMagicBonus('Shield') })
		expect(gear.unresolved).toEqual([])
	})

	it('names armour that is carried but not worn, and ignores unequipped gear otherwise', () => {
		const gear = buildEquippedGear(
			[
				{ name: 'Chain Mail', source: 'XPHB', quantity: 1 },
				{ name: 'Shield', source: 'XPHB', quantity: 1 },
				{ name: 'Torch', source: 'XPHB', quantity: 3 },
			],
			ITEMS,
		)
		expect(gear).toEqual({ armour: null, shield: null, unresolved: [], carriedArmourNotWorn: ['Chain Mail'] })
	})

	it('reports an equipped item the item data does not know rather than dropping it (D43)', () => {
		const gear = buildEquippedGear(
			[
				{ name: 'Mystery Plate', source: 'HOMEBREW', quantity: 1, equipped: 'worn' },
				{ name: 'Shield', source: 'XPHB', quantity: 1, equipped: 'held' },
			],
			ITEMS,
		)
		expect(gear.unresolved).toEqual([{ name: 'Mystery Plate', source: 'HOMEBREW' }])
		expect(gear.armour).toBeNull()
		expect(gear.shield).toEqual({ name: 'Shield', acBonus: 2, magicBonus: noMagicBonus('Shield') })
	})

	/* Slice e: the bonus is resolved here, where items.json is in hand, and handed to the pure calculation. */
	it('resolves an armour bonus off the item data and a player-set one off the row, naming the suit with it', () => {
		const own = buildEquippedGear([{ name: 'Dragon Scale Mail', source: 'XDMG', quantity: 1, equipped: 'worn' }], ITEMS)
		expect(own.armour).toMatchObject({ name: 'Dragon Scale Mail +1', ac: 14, magicBonus: { applied: 1, origin: 'item' } })

		const set = buildEquippedGear([{ name: 'Chain Mail', source: 'XPHB', quantity: 1, equipped: 'worn', magicBonus: 2 }], ITEMS)
		expect(set.armour).toMatchObject({ name: 'Chain Mail +2', ac: 16, magicBonus: { applied: 2, origin: 'player' } })
	})

	it('names a carried-but-not-worn suit and an unresolvable equipped row with the bonus they carry (D43)', () => {
		const carried = buildEquippedGear([{ name: 'Dragon Scale Mail', source: 'XDMG', quantity: 1 }], ITEMS)
		expect(carried.carriedArmourNotWorn).toEqual(['Dragon Scale Mail +1'])

		const stale = buildEquippedGear([{ name: 'Mystery Plate', source: 'HOMEBREW', quantity: 1, equipped: 'worn', magicBonus: 3 }], ITEMS)
		expect(stale.unresolved).toEqual([{ name: 'Mystery Plate +3', source: 'HOMEBREW' }])
	})
})
