import { describe, expect, it } from 'vitest'
import { noMagicBonus } from '../calculation/magicBonus'
import { inventoryRowKey, type ItemRef } from '../inventory/inventoryData'
import type { Character } from '../storage/character'
import { buildHeldWeapons, featureNamesFor, formatTableDice, martialArtsDieFrom } from './weaponAttackData'

const itemRefs: ItemRef[] = [
	{ name: 'Longsword', source: 'XPHB', typeCode: 'M', weapon: true, weaponCategory: 'martial', dmg1: '1d8', dmg2: '1d10', dmgTypeFull: 'slashing', propertyFull: ['Versatile'], masteryFull: ['Sap'] },
	{ name: 'Rapier', source: 'XPHB', typeCode: 'M', weapon: true, weaponCategory: 'martial', dmg1: '1d8', dmgTypeFull: 'piercing', propertyFull: ['Finesse'], masteryFull: ['Vex'] },
	{ name: 'Shield', source: 'XPHB', typeCode: 'S', ac: 2 },
	{ name: 'Chain Mail', source: 'XPHB', typeCode: 'HA', armor: true, ac: 16, strength: '13', stealth: true },
	{ name: 'Moon Sickle', source: 'TCE', typeCode: 'M', weaponCategory: 'martial', dmg1: '1d4', dmgTypeFull: 'slashing', bonusWeapon: 1, requiresAttunement: true },
]

describe('buildHeldWeapons', () => {
	it('takes only the held weapons, skipping carried ones, worn armour and a held shield', () => {
		const held = buildHeldWeapons(
			[
				{ name: 'Longsword', source: 'XPHB', quantity: 1, equipped: 'held' },
				{ name: 'Rapier', source: 'XPHB', quantity: 1 },
				{ name: 'Shield', source: 'XPHB', quantity: 1, equipped: 'held' },
				{ name: 'Chain Mail', source: 'XPHB', quantity: 1, equipped: 'worn' },
			],
			itemRefs,
		)
		expect(held.map((row) => row.name)).toEqual(['Longsword'])
		expect(held[0].weapon).toMatchObject({ dmg1: '1d8', dmg2: '1d10', propertyFull: ['Versatile'], masteryFull: ['Sap'] })
	})

	it('carries the stored Finesse pick through', () => {
		const held = buildHeldWeapons([{ name: 'Rapier', source: 'XPHB', quantity: 1, equipped: 'held', attackAbility: 'strength' }], itemRefs)
		expect(held[0].chosenAbility).toBe('strength')
	})

	it('keeps a held row the item data does not know, with no weapon (D43)', () => {
		const held = buildHeldWeapons([{ name: 'Sword of Nothing', source: 'HOMEBREW', quantity: 1, equipped: 'held' }], itemRefs)
		expect(held).toEqual([
			{
				key: inventoryRowKey({ name: 'Sword of Nothing', source: 'HOMEBREW', quantity: 1, equipped: 'held' }),
				name: 'Sword of Nothing',
				source: 'HOMEBREW',
				weapon: null,
				chosenAbility: null,
				magicBonus: noMagicBonus('Sword of Nothing'),
			},
		])
	})

	/* Slice e: two rows of the same weapon are two attack lines, so the key has to come off the ROW. */
	it('gives each row its own key and resolves the item’s bonus against the player’s and attunement', () => {
		const held = buildHeldWeapons(
			[
				{ name: 'Moon Sickle', source: 'TCE', quantity: 1, equipped: 'held' },
				{ name: 'Longsword', source: 'XPHB', quantity: 1, equipped: 'held', magicBonus: 2 },
				{ name: 'Longsword', source: 'XPHB', quantity: 1, equipped: 'held' },
			],
			itemRefs,
		)
		expect(new Set(held.map((row) => row.key)).size).toBe(3)
		// Moon Sickle requires attunement and is not attuned: carried but withheld (D76).
		expect(held[0].magicBonus).toMatchObject({ carried: 1, applied: 0, label: 'Moon Sickle +1' })
		expect(held[1].magicBonus).toMatchObject({ carried: 2, applied: 2, origin: 'player' })
		expect(held[2].magicBonus).toMatchObject({ carried: 0, applied: 0 })
	})
})

describe('formatTableDice', () => {
	it('reads a class table dice cell', () => {
		expect(formatTableDice({ type: 'dice', toRoll: [{ number: 1, faces: 6 }], rollable: true })).toBe('1d6')
	})

	it('returns null for a cell that is not dice', () => {
		expect(formatTableDice(2)).toBeNull()
		expect(formatTableDice({ type: 'bonus', value: 2 })).toBeNull()
		expect(formatTableDice({ type: 'dice', toRoll: [] })).toBeNull()
	})
})

/** The Monk's Martial Arts die is a real class-table column, not prose — scripts/investigate-weapon-attack-fields.js. */
function monkTableRow(faces: number): unknown[] {
	return [{ type: 'dice', toRoll: [{ number: 1, faces }], rollable: true }, 2, '—']
}

const parsedClasses: unknown[] = [
	{
		entryType: 'class',
		name: 'Monk',
		source: 'XPHB',
		classTableGroups: [{ colLabels: ['Martial Arts', 'Focus Points', 'Unarmored Movement'], rows: [monkTableRow(6), monkTableRow(6), monkTableRow(6), monkTableRow(6), monkTableRow(8)] }],
	},
	{ entryType: 'class', name: 'Fighter', source: 'XPHB', classTableGroups: [{ colLabels: ['Second Wind'], rows: [[2]] }] },
	{ entryType: 'subclass', name: 'Path of the Berserker', shortName: 'Berserker', source: 'XPHB', className: 'Barbarian', classSource: 'XPHB' },
]

function monk(level: number): Character {
	return { id: '1', name: 'Kai', classes: [{ className: 'Monk', classSource: 'XPHB', subclass: null, level }] }
}

describe('martialArtsDieFrom', () => {
	it('reads the die at the character’s Monk level', () => {
		expect(martialArtsDieFrom(monk(1), parsedClasses)).toBe('1d6')
		expect(martialArtsDieFrom(monk(5), parsedClasses)).toBe('1d8')
	})

	it('returns null for a class with no such column', () => {
		expect(martialArtsDieFrom({ id: '1', name: 'Gar', classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 5 }] }, parsedClasses)).toBeNull()
	})
})

const parsedClassFeatures: unknown[] = [
	{ name: 'Second Wind', className: 'Fighter', classSource: 'XPHB', level: 1 },
	{ name: 'Extra Attack', className: 'Fighter', classSource: 'XPHB', level: 5 },
	{ name: 'Two Extra Attacks', className: 'Fighter', classSource: 'XPHB', level: 11 },
	{ name: 'Three Extra Attacks', className: 'Fighter', classSource: 'XPHB', level: 20 },
	{ name: 'Rage', className: 'Barbarian', classSource: 'XPHB', level: 1 },
]

const parsedSubclassFeatures: unknown[] = [
	{ name: 'Extra Attack', className: 'Barbarian', classSource: 'XPHB', subclassShortName: 'Berserker', subclassSource: 'XPHB', level: 6 },
]

function fighter(level: number): Character {
	return { id: '1', name: 'Gar', classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level }] }
}

describe('featureNamesFor', () => {
	it('lists only the features the character has reached', () => {
		expect(featureNamesFor(fighter(11), parsedClassFeatures, parsedSubclassFeatures, parsedClasses)).toEqual(['Second Wind', 'Extra Attack', 'Two Extra Attacks'])
		expect(featureNamesFor(fighter(5), parsedClassFeatures, parsedSubclassFeatures, parsedClasses)).toEqual(['Second Wind', 'Extra Attack'])
	})

	it('includes a subclass feature, joined through the stored subclass NAME', () => {
		const berserker: Character = { id: '1', name: 'Ur', classes: [{ className: 'Barbarian', classSource: 'XPHB', subclass: 'Path of the Berserker', level: 6 }] }
		expect(featureNamesFor(berserker, parsedClassFeatures, parsedSubclassFeatures, parsedClasses)).toEqual(['Rage', 'Extra Attack'])
	})

	it('does not list the same name twice when two classes both grant it', () => {
		const both: Character = {
			id: '1',
			name: 'Mix',
			classes: [
				{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 5 },
				{ className: 'Barbarian', classSource: 'XPHB', subclass: 'Path of the Berserker', level: 6 },
			],
		}
		expect(featureNamesFor(both, parsedClassFeatures, parsedSubclassFeatures, parsedClasses).filter((name) => name === 'Extra Attack')).toHaveLength(1)
	})
})
