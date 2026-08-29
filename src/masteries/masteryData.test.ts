import { describe, expect, it } from 'vitest'
import { masteryCountFor } from './masteryData'

/*
 * The D70 hand table for Paladin/Ranger/Rogue, and the guarantee that it did
 * not disturb the two classes whose count comes from their own table column.
 * Tests the pure function rather than the picker: MasteryPicker.tsx renders
 * exactly what this returns (null renders nothing), and its own test file
 * stubs the loader, so this is the seam where the count is actually decided.
 */

/** classes.json's real shape for the column: one row per level, values as strings. */
function classEntry(name: string, masteryColumn?: number[]): unknown {
	return {
		entryType: 'class',
		name,
		source: 'XPHB',
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
	classEntry('Rogue'),
	classEntry('Wizard'),
]

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
