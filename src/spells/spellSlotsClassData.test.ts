import { describe, expect, it } from 'vitest'
import { extractSpellSlotsClassData } from './spellSlotsClassData'

// Shapes confirmed against data/classes.json by scripts/investigate-spell-slots.js
// and scripts/investigate-third-caster-slots.js.
const wizard = {
	entryType: 'class',
	name: 'Wizard',
	source: 'XPHB',
	hd: { number: 1, faces: 6 },
	casterProgression: 'full',
	classTableGroups: [
		{
			colLabels: ['1st', '2nd', '3rd'],
			rowsSpellProgression: [
				[2, 0, 0],
				[3, 0, 0],
				[4, 2, 0],
			],
		},
	],
}

const warlock = {
	entryType: 'class',
	name: 'Warlock',
	source: 'XPHB',
	hd: { number: 1, faces: 8 },
	casterProgression: 'pact',
	classTableGroups: [
		{
			colLabels: ['Invocations', 'Cantrips', 'Prepared Spells', 'Spell Slots', 'Slot Level'],
			rows: [
				[1, 2, 2, 1, 1],
				[3, 2, 3, 2, 1],
			],
		},
	],
}

const fighter = {
	entryType: 'class',
	name: 'Fighter',
	source: 'XPHB',
	hd: { number: 1, faces: 10 },
}

const eldritchKnight = {
	entryType: 'subclass',
	name: 'Eldritch Knight',
	source: 'XPHB',
	className: 'Fighter',
	classSource: 'XPHB',
	casterProgression: '1/3',
	subclassTableGroups: [
		{
			colLabels: ['1st', '2nd'],
			rowsSpellProgression: [
				[0, 0],
				[0, 0],
				[2, 0],
			],
		},
	],
}

const champion = {
	entryType: 'subclass',
	name: 'Champion',
	source: 'XPHB',
	className: 'Fighter',
	classSource: 'XPHB',
}

const classes = [wizard, warlock, fighter, eldritchKnight, champion]

describe('extractSpellSlotsClassData', () => {
	it('a full caster (Wizard): reads its rowsSpellProgression table', () => {
		const result = extractSpellSlotsClassData(classes)
		const entry = result.find((c) => c.className === 'Wizard')
		expect(entry?.casterProgression).toBe('full')
		expect(entry?.spellSlotsByLevel).toEqual([
			[2, 0, 0],
			[3, 0, 0],
			[4, 2, 0],
		])
		expect(entry?.pactSlotsByLevel).toBeNull()
	})

	it('Warlock: finds the pact table by column NAME, not position, and reads slot count/level correctly', () => {
		const result = extractSpellSlotsClassData(classes)
		const entry = result.find((c) => c.className === 'Warlock')
		expect(entry?.spellSlotsByLevel).toBeNull()
		expect(entry?.pactSlotsByLevel).toEqual([
			{ count: 1, slotLevel: 1 },
			{ count: 2, slotLevel: 1 },
		])
	})

	it('a non-caster base class with no table (Fighter): casterProgression null, both slot fields null', () => {
		const result = extractSpellSlotsClassData(classes)
		const entry = result.find((c) => c.className === 'Fighter')
		expect(entry?.casterProgression).toBeNull()
		expect(entry?.spellSlotsByLevel).toBeNull()
		expect(entry?.pactSlotsByLevel).toBeNull()
	})

	it('Eldritch Knight (D46): its own slot table is attached under Fighter\'s subclasses', () => {
		const result = extractSpellSlotsClassData(classes)
		const fighterEntry = result.find((c) => c.className === 'Fighter')
		expect(fighterEntry?.subclasses).toHaveLength(1)
		expect(fighterEntry?.subclasses?.[0]).toMatchObject({
			subclassName: 'Eldritch Knight',
			casterProgression: '1/3',
			spellSlotsByLevel: [
				[0, 0],
				[0, 0],
				[2, 0],
			],
		})
	})

	it('a subclass with no table at all (Champion) is not attached', () => {
		const result = extractSpellSlotsClassData(classes)
		const fighterEntry = result.find((c) => c.className === 'Fighter')
		expect(fighterEntry?.subclasses?.some((s) => s.subclassName === 'Champion')).toBe(false)
	})
})
