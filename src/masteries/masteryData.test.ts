import { describe, expect, it } from 'vitest'
import { masteryCountFor, masteryWeaponsFor } from './masteryData'

/*
 * The D70 hand table for Paladin/Ranger/Rogue, and the guarantee that it did
 * not disturb the two classes whose count comes from their own table column.
 * Tests the pure function rather than the picker: MasteryPicker.tsx renders
 * exactly what this returns (null renders nothing), and its own test file
 * stubs the loader, so this is the seam where the count is actually decided.
 */

/** classes.json's prose weapon-proficiency sentences, verbatim (XPHB). */
const MONK_PROSE = 'Martial weapons that have the {@filter Light|items|type=martial weapon|property=light} property'
const ROGUE_PROSE = 'Martial weapons that have the {@filter Finesse or Light|items|type=martial weapon|property=finesse;light} property'

const CLASS_WEAPONS: Record<string, unknown[]> = {
	Barbarian: ['simple', 'martial'],
	Fighter: ['simple', 'martial'],
	Paladin: ['simple', 'martial'],
	Ranger: ['simple', 'martial'],
	Monk: ['simple', MONK_PROSE],
	Rogue: ['simple', ROGUE_PROSE],
	Wizard: ['simple'],
}

/** classes.json's real shape for the column: one row per level, values as strings. */
function classEntry(name: string, masteryColumn?: number[]): unknown {
	return {
		entryType: 'class',
		name,
		source: 'XPHB',
		...(CLASS_WEAPONS[name] ? { startingProficiencies: { weapons: CLASS_WEAPONS[name] } } : {}),
		...(masteryColumn ? { classTableGroups: [{ colLabels: ['Weapon Mastery'], rows: masteryColumn.map((count) => [String(count)]) }] } : {}),
	}
}

const BARBARIAN_COLUMN = [...Array<number>(3).fill(2), ...Array<number>(6).fill(3), ...Array<number>(11).fill(4)]
const FIGHTER_COLUMN = [...Array<number>(3).fill(3), ...Array<number>(6).fill(4), ...Array<number>(6).fill(5), ...Array<number>(5).fill(6)]

const CLASSES = [
	classEntry('Barbarian', BARBARIAN_COLUMN),
	classEntry('Fighter', FIGHTER_COLUMN),
	classEntry('Paladin'),
	classEntry('Ranger'),
	classEntry('Monk'),
	classEntry('Rogue'),
	classEntry('Wizard'),
]

/*
 * items.json's shape for a mastery-bearing weapon — the fields the proficiency
 * test reads, plus the mastery itself and `rarity`. `rarity: 'none'` marks an
 * ordinary weapon; anything else is a magic item (Part 2 — the pool is kinds of
 * weapons, not owned magic items).
 */
const ITEMS = [
	{ name: 'Dagger', source: 'XPHB', rarity: 'none', weaponCategory: 'simple', propertyFull: ['Finesse', 'Light', 'Thrown'], masteryFull: ['Nick'] },
	{ name: 'Shortsword', source: 'XPHB', rarity: 'none', weaponCategory: 'martial', propertyFull: ['Finesse', 'Light'], masteryFull: ['Vex'] },
	{ name: 'Rapier', source: 'XPHB', rarity: 'none', weaponCategory: 'martial', propertyFull: ['Finesse'], masteryFull: ['Vex'] },
	{ name: 'Greataxe', source: 'XPHB', rarity: 'none', weaponCategory: 'martial', propertyFull: ['Heavy', 'Two-Handed'], masteryFull: ['Cleave'] },
	// A magic item that carries a mastery — a Rogue/Fighter is "proficient" with it, but it must never be offered.
	{ name: 'Sun Blade', source: 'XPHB', rarity: 'rare', reqAttune: true, weaponCategory: 'martial', propertyFull: ['Finesse', 'Light'], masteryFull: ['Vex'] },
	{ name: 'Potion of Healing', source: 'XPHB', rarity: 'none' },
]

/** feats.json slice: only Martial Weapon Training carries a weapon-proficiency grant in these fixtures. */
const FEATS = [{ name: 'Martial Weapon Training', source: 'XPHB', weaponProficiencies: [{ martial: true }] }]
const MARTIAL_WEAPON_TRAINING = [{ level: 4, kind: 'feat' as const, name: 'Martial Weapon Training', source: 'XPHB' }]

function offeredNames(className: string, featAsiChoices: typeof MARTIAL_WEAPON_TRAINING = []): string[] {
	return masteryWeaponsFor(ITEMS, CLASSES, className, 'XPHB', featAsiChoices, FEATS).map((weapon) => weapon.name)
}

describe('masteryCountFor', () => {
	/*
	 * These three grant Weapon Mastery at level 1 and never gain more — no class
	 * or subclass feature changes the NUMBER of mastery weapons for them
	 * (scripts/investigate-d70-prose-counts.js). So there is no level at which
	 * the count changes to test; what matters is that it is right from level 1
	 * and stays right at 20 rather than growing the way the table classes do.
	 */
	it.each([
		['Paladin', 2],
		['Ranger', 2],
		['Rogue', 2],
	])('%s is offered %i masteries, from level 1 through 20 (D70 hand table — no table column)', (className, expected) => {
		expect(masteryCountFor(CLASSES, className, 'XPHB', 1)).toBe(expected)
		expect(masteryCountFor(CLASSES, className, 'XPHB', 5)).toBe(expected)
		expect(masteryCountFor(CLASSES, className, 'XPHB', 20)).toBe(expected)
	})

	it('Barbarian and Fighter are unchanged — their own table column still wins, including where it steps up', () => {
		expect(masteryCountFor(CLASSES, 'Barbarian', 'XPHB', 1)).toBe(2)
		expect(masteryCountFor(CLASSES, 'Barbarian', 'XPHB', 4)).toBe(3)
		expect(masteryCountFor(CLASSES, 'Barbarian', 'XPHB', 10)).toBe(4)

		expect(masteryCountFor(CLASSES, 'Fighter', 'XPHB', 1)).toBe(3)
		expect(masteryCountFor(CLASSES, 'Fighter', 'XPHB', 4)).toBe(4)
		expect(masteryCountFor(CLASSES, 'Fighter', 'XPHB', 10)).toBe(5)
		expect(masteryCountFor(CLASSES, 'Fighter', 'XPHB', 16)).toBe(6)
	})

	it('a class with no Weapon Mastery feature is still offered nothing — the table covers three classes, not every column-less one', () => {
		expect(masteryCountFor(CLASSES, 'Wizard', 'XPHB', 20)).toBeNull()
	})

	it('a class absent from the supplied data, or from another source, gets null rather than the hand table', () => {
		expect(masteryCountFor(CLASSES, 'Paladin', 'PHB', 5)).toBeNull()
		expect(masteryCountFor(CLASSES, 'Blood Hunter', 'XPHB', 5)).toBeNull()
	})
})

describe('masteryWeaponsFor', () => {
	it('a Rogue is offered Dagger and Shortsword, never a Greataxe', () => {
		const offered = offeredNames('Rogue')
		expect(offered).toContain('Dagger')
		expect(offered).toContain('Shortsword')
		expect(offered).not.toContain('Greataxe')
	})

	it('a magic item that carries a mastery is never offered, though an ordinary weapon of the same profile is (Part 2)', () => {
		// Sun Blade is a Finesse/Light martial weapon — a Rogue and a Fighter are
		// both "proficient" with that profile — but it is rarity "rare", a magic item.
		expect(offeredNames('Rogue')).not.toContain('Sun Blade')
		expect(offeredNames('Fighter')).not.toContain('Sun Blade')
		// the ordinary Finesse/Light martial weapon with the same mastery still is
		expect(offeredNames('Rogue')).toContain('Shortsword')
		expect(offeredNames('Fighter')).toEqual(['Dagger', 'Shortsword', 'Rapier', 'Greataxe'])
	})

	/* Monk is the second prose class; it grants no mastery, so the picker renders nothing for it (masteryCountFor is null) — the pool is still filtered by its own sentence, which is narrower than the Rogue's. */
	it('a Monk pool holds the Light Martial weapons only — Rapier is Finesse without Light', () => {
		expect(offeredNames('Monk')).toEqual(['Dagger', 'Shortsword'])
	})

	it('a Fighter is unchanged: every mastery weapon, since Simple and Martial cover them all', () => {
		expect(offeredNames('Fighter')).toEqual(['Dagger', 'Shortsword', 'Rapier', 'Greataxe'])
	})

	it('the structured path still narrows: a Wizard is proficient with Simple weapons only', () => {
		expect(offeredNames('Wizard')).toEqual(['Dagger'])
	})

	it('a Rogue who took Martial Weapon Training is offered a martial weapon a plain Rogue is not (Part 3)', () => {
		// Greataxe: martial, Heavy/Two-Handed — outside the Rogue's Finesse-or-Light class grant.
		expect(offeredNames('Rogue')).not.toContain('Greataxe')
		expect(offeredNames('Rogue', MARTIAL_WEAPON_TRAINING)).toContain('Greataxe')
		// still no magic item, even with the wider proficiency (Sun Blade is martial + Finesse/Light)
		expect(offeredNames('Rogue', MARTIAL_WEAPON_TRAINING)).not.toContain('Sun Blade')
	})

	it('one entry per mastery property a weapon carries, and non-weapons are never offered', () => {
		expect(masteryWeaponsFor(ITEMS, CLASSES, 'Rogue', 'XPHB')).toEqual([
			{ name: 'Dagger', source: 'XPHB', masteryFull: 'Nick' },
			{ name: 'Shortsword', source: 'XPHB', masteryFull: 'Vex' },
			{ name: 'Rapier', source: 'XPHB', masteryFull: 'Vex' },
		])
	})
})
