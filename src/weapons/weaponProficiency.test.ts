import { describe, expect, it } from 'vitest'
import type { Character } from '../storage/character'
import {
	extractFeatWeaponProficiencyEntries,
	isProficientWithWeapon,
	weaponProficiencyGrantsFor,
	weaponProficiencyGrantsForClass,
	weaponProficiencyGrantsForFeats,
	type FeatWeaponProficiencyEntry,
} from './weaponProficiency'

/*
 * The prose sentences verbatim from classes.json (XPHB) — the point of the
 * fixture is that the code reads THESE, markup and all, not a tidied version.
 */
const MONK_PROSE = 'Martial weapons that have the {@filter Light|items|type=martial weapon|property=light} property'
const ROGUE_PROSE = 'Martial weapons that have the {@filter Finesse or Light|items|type=martial weapon|property=finesse;light} property'

function classEntry(name: string, weapons: unknown[]): unknown {
	return { entryType: 'class', name, source: 'XPHB', startingProficiencies: { weapons } }
}

const CLASSES = [
	classEntry('Barbarian', ['simple', 'martial']),
	classEntry('Fighter', ['simple', 'martial']),
	classEntry('Monk', ['simple', MONK_PROSE]),
	classEntry('Rogue', ['simple', ROGUE_PROSE]),
	classEntry('Wizard', ['simple']),
]

const DAGGER = { name: 'Dagger', source: 'XPHB', weaponCategory: 'simple', propertyFull: ['Finesse', 'Light', 'Thrown'] }
const CLUB = { name: 'Club', source: 'XPHB', weaponCategory: 'simple', propertyFull: ['Light'] }
const SHORTSWORD = { name: 'Shortsword', source: 'XPHB', weaponCategory: 'martial', propertyFull: ['Finesse', 'Light'] }
const RAPIER = { name: 'Rapier', source: 'XPHB', weaponCategory: 'martial', propertyFull: ['Finesse'] }
const GREATAXE = { name: 'Greataxe', source: 'XPHB', weaponCategory: 'martial', propertyFull: ['Heavy', 'Two-Handed'] }
const PISTOL = { name: 'Pistol', source: 'XDMG', weaponCategory: 'martial', propertyFull: ['Ammunition', 'Loading'], firearm: true }

function character(classes: { className: string; classSource: string }[], feats: { name: string; source: string }[] = []): Character {
	return {
		id: 'c1',
		name: 'Test',
		classes: classes.map((cls) => ({ ...cls, subclass: null, level: 5 })),
		featAsiChoices: feats.map((feat) => ({ level: 4, kind: 'feat' as const, name: feat.name, source: feat.source })),
	}
}

const FEATS: FeatWeaponProficiencyEntry[] = [
	{ name: 'Martial Weapon Training', source: 'XPHB', weaponProficiencies: [{ martial: true }] },
	{ name: 'Gunner', source: 'TCE', weaponProficiencies: [{ firearms: true }] },
	{ name: 'Tavern Brawler', source: 'XPHB', weaponProficiencies: [{ improvised: true }] },
	{ name: 'Alert', source: 'XPHB' },
]

function proficientNames(weapons: object[], grants: Parameters<typeof isProficientWithWeapon>[1]): string[] {
	return weapons.filter((weapon) => isProficientWithWeapon(weapon, grants)).map((weapon) => (weapon as { name: string }).name)
}

const ALL_WEAPONS = [DAGGER, CLUB, SHORTSWORD, RAPIER, GREATAXE, PISTOL]

describe('weaponProficiencyGrantsForClass', () => {
	it('reads the structured tokens: a Wizard gets Simple weapons and nothing Martial', () => {
		const grants = weaponProficiencyGrantsForClass(CLASSES, 'Wizard', 'XPHB')
		expect(proficientNames(ALL_WEAPONS, grants)).toEqual(['Dagger', 'Club'])
	})

	it('a Fighter is proficient with every weapon — both categories, no property narrowing', () => {
		const grants = weaponProficiencyGrantsForClass(CLASSES, 'Fighter', 'XPHB')
		expect(proficientNames(ALL_WEAPONS, grants)).toEqual(['Dagger', 'Club', 'Shortsword', 'Rapier', 'Greataxe', 'Pistol'])
	})

	it('Rogue: Simple plus Martial weapons with Finesse OR Light — never a Greataxe (D70 hand table)', () => {
		const grants = weaponProficiencyGrantsForClass(CLASSES, 'Rogue', 'XPHB')
		expect(proficientNames(ALL_WEAPONS, grants)).toEqual(['Dagger', 'Club', 'Shortsword', 'Rapier'])
	})

	it('Monk: Simple plus Martial weapons with Light only — a Rapier is Finesse but not Light, so it is out', () => {
		const grants = weaponProficiencyGrantsForClass(CLASSES, 'Monk', 'XPHB')
		expect(proficientNames(ALL_WEAPONS, grants)).toEqual(['Dagger', 'Club', 'Shortsword'])
	})

	it('a prose sentence with no recorded rule grants nothing, rather than everything', () => {
		const unknownProse = [classEntry('Blood Hunter', ['simple', 'Martial weapons of some kind nobody has written down'])]
		const grants = weaponProficiencyGrantsForClass(unknownProse, 'Blood Hunter', 'XPHB')
		expect(proficientNames(ALL_WEAPONS, grants)).toEqual(['Dagger', 'Club'])
	})

	it('a class absent from the supplied data, or from another source, grants nothing', () => {
		expect(weaponProficiencyGrantsForClass(CLASSES, 'Rogue', 'PHB')).toEqual([])
		expect(weaponProficiencyGrantsForClass(CLASSES, 'Blood Hunter', 'XPHB')).toEqual([])
	})
})

describe('weaponProficiencyGrantsForFeats', () => {
	it('Martial Weapon Training gives a Wizard the Martial category', () => {
		const grants = weaponProficiencyGrantsForFeats(
			character([], [{ name: 'Martial Weapon Training', source: 'XPHB' }]).featAsiChoices,
			FEATS,
		)
		expect(proficientNames(ALL_WEAPONS, grants)).toEqual(['Shortsword', 'Rapier', 'Greataxe', 'Pistol'])
	})

	it("Gunner matches items.json's firearm flag, not a category", () => {
		const grants = weaponProficiencyGrantsForFeats(character([], [{ name: 'Gunner', source: 'TCE' }]).featAsiChoices, FEATS)
		expect(proficientNames(ALL_WEAPONS, grants)).toEqual(['Pistol'])
	})

	it('Tavern Brawler grants nothing here — improvised weapons are not items', () => {
		expect(
			weaponProficiencyGrantsForFeats(character([], [{ name: 'Tavern Brawler', source: 'XPHB' }]).featAsiChoices, FEATS),
		).toEqual([])
	})

	it('a feat with no weaponProficiencies field, and a feat not in the supplied data, both grant nothing', () => {
		const feats = [
			{ name: 'Alert', source: 'XPHB' },
			{ name: 'Not A Feat', source: 'XPHB' },
		]
		expect(weaponProficiencyGrantsForFeats(character([], feats).featAsiChoices, FEATS)).toEqual([])
	})
})

describe('weaponProficiencyGrantsFor', () => {
	it('combines every class the character holds with their feats', () => {
		const rogueGunner = character([{ className: 'Rogue', classSource: 'XPHB' }], [{ name: 'Gunner', source: 'TCE' }])
		const grants = weaponProficiencyGrantsFor(rogueGunner, CLASSES, FEATS)
		expect(proficientNames(ALL_WEAPONS, grants)).toEqual(['Dagger', 'Club', 'Shortsword', 'Rapier', 'Pistol'])
	})

	it('a multiclass character gets the union — the Barbarian half brings the Greataxe the Rogue half cannot use', () => {
		const rogueBarbarian = character([
			{ className: 'Rogue', classSource: 'XPHB' },
			{ className: 'Barbarian', classSource: 'XPHB' },
		])
		const grants = weaponProficiencyGrantsFor(rogueBarbarian, CLASSES, FEATS)
		expect(proficientNames(ALL_WEAPONS, grants)).toEqual(['Dagger', 'Club', 'Shortsword', 'Rapier', 'Greataxe', 'Pistol'])
	})
})

describe('extractFeatWeaponProficiencyEntries', () => {
	it('carries name/source/weaponProficiencies through and tolerates a non-array', () => {
		const parsed = [
			{ name: 'Martial Weapon Training', source: 'XPHB', weaponProficiencies: [{ martial: true }], entries: ['…'] },
			{ name: 'Alert', source: 'XPHB' },
			{ notAFeat: true },
		]
		expect(extractFeatWeaponProficiencyEntries(parsed)).toEqual([
			{ name: 'Martial Weapon Training', source: 'XPHB', weaponProficiencies: [{ martial: true }] },
			{ name: 'Alert', source: 'XPHB', weaponProficiencies: undefined },
		])
		expect(extractFeatWeaponProficiencyEntries(null)).toEqual([])
	})
})

describe('isProficientWithWeapon', () => {
	it('an item with no weaponCategory at all matches nothing', () => {
		const grants = weaponProficiencyGrantsForClass(CLASSES, 'Fighter', 'XPHB')
		expect(isProficientWithWeapon({ name: 'Potion of Healing', source: 'XPHB' }, grants)).toBe(false)
		expect(isProficientWithWeapon(null, grants)).toBe(false)
	})

	it('an empty grant list is proficient with nothing', () => {
		expect(proficientNames(ALL_WEAPONS, [])).toEqual([])
	})
})
