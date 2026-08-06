import { describe, expect, it } from 'vitest'
import type { Character } from '../storage/character'
import { type ClassSpellSlotsData, computeSpellSlots } from './spellSlots'

// Rows confirmed against data/classes.json by scripts/investigate-spell-slots.js.
const wizardSlots: ClassSpellSlotsData = {
	className: 'Wizard',
	classSource: 'XPHB',
	casterProgression: 'full',
	spellSlotsByLevel: [
		[2, 0, 0, 0, 0, 0, 0, 0, 0],
		[3, 0, 0, 0, 0, 0, 0, 0, 0],
		[4, 2, 0, 0, 0, 0, 0, 0, 0],
		[4, 3, 0, 0, 0, 0, 0, 0, 0],
		[4, 3, 2, 0, 0, 0, 0, 0, 0],
	],
	pactSlotsByLevel: null,
}

const paladinSlots: ClassSpellSlotsData = {
	className: 'Paladin',
	classSource: 'XPHB',
	casterProgression: 'artificer',
	// Paladin's own table stops at spell level 5 — only 5 columns, never padded to 9 in the source data.
	spellSlotsByLevel: [
		[2, 0, 0, 0, 0],
		[2, 0, 0, 0, 0],
		[3, 0, 0, 0, 0],
		[3, 0, 0, 0, 0],
		[4, 2, 0, 0, 0],
	],
	pactSlotsByLevel: null,
}

const warlockSlots: ClassSpellSlotsData = {
	className: 'Warlock',
	classSource: 'XPHB',
	casterProgression: 'pact',
	spellSlotsByLevel: null,
	pactSlotsByLevel: [
		{ count: 1, slotLevel: 1 },
		{ count: 2, slotLevel: 1 },
		{ count: 2, slotLevel: 2 },
		{ count: 2, slotLevel: 2 },
		{ count: 2, slotLevel: 3 },
	],
}

// D46: Eldritch Knight/Arcane Trickster keep their table on the subclass entry (subclassTableGroups),
// not the base class — rows confirmed against data/classes.json by scripts/investigate-third-caster-slots.js.
const fighterSlots: ClassSpellSlotsData = {
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
				[3, 0, 0, 0],
				[3, 0, 0, 0],
				[3, 0, 0, 0],
				[4, 2, 0, 0],
			],
		},
		// Champion carries no spell-slot table at all — confirms a non-spellcasting subclass yields no slots, not an error.
	],
}

const rogueSlots: ClassSpellSlotsData = {
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
				[3, 0, 0, 0],
				[3, 0, 0, 0],
				[3, 0, 0, 0],
				[4, 2, 0, 0],
			],
		},
	],
}

const classData = [wizardSlots, paladinSlots, warlockSlots, fighterSlots, rogueSlots]

function characterWithClass(className: string, level: number, subclass: string | null = null): Character {
	return {
		id: '1',
		name: 'Test',
		classes: [{ className, classSource: 'XPHB', subclass, level }],
	}
}

describe('computeSpellSlots', () => {
	it('a full caster (Wizard 5): exact 1-9 slot counts from the table, no pact slots', () => {
		const result = computeSpellSlots(characterWithClass('Wizard', 5), classData)
		expect(result.status).toBe('known')
		if (result.status !== 'known') return
		expect(result.value).toHaveLength(1)
		expect(result.value[0].ordinarySlots).toEqual([4, 3, 2, 0, 0, 0, 0, 0, 0])
		expect(result.value[0].pactSlots).toBeUndefined()
	})

	it('a half caster (Paladin 5): correct reduced slots, zero-padded past the table width, no pact slots', () => {
		const result = computeSpellSlots(characterWithClass('Paladin', 5), classData)
		expect(result.status).toBe('known')
		if (result.status !== 'known') return
		expect(result.value[0].ordinarySlots).toEqual([4, 2, 0, 0, 0, 0, 0, 0, 0])
		expect(result.value[0].pactSlots).toBeUndefined()
	})

	it('a Warlock: pact slots (count + slot level) present, ordinary 1-9 matrix absent', () => {
		const result = computeSpellSlots(characterWithClass('Warlock', 5), classData)
		expect(result.status).toBe('known')
		if (result.status !== 'known') return
		expect(result.value[0].pactSlots).toEqual({ count: 2, slotLevel: 3 })
		expect(result.value[0].ordinarySlots).toBeUndefined()
	})

	it('a non-caster (Fighter): no slots at all, cleanly — empty list, not zeroes, not an error', () => {
		const result = computeSpellSlots(characterWithClass('Fighter', 5), classData)
		expect(result.status).toBe('known')
		if (result.status !== 'known') return
		expect(result.value).toEqual([])
	})

	it('D46: Eldritch Knight (Fighter 7) reads its slot table off the SUBCLASS entry, padded to 1-9, no pact slots', () => {
		const result = computeSpellSlots(characterWithClass('Fighter', 7, 'Eldritch Knight'), classData)
		expect(result.status).toBe('known')
		if (result.status !== 'known') return
		expect(result.value).toHaveLength(1)
		expect(result.value[0].ordinarySlots).toEqual([4, 2, 0, 0, 0, 0, 0, 0, 0])
		expect(result.value[0].pactSlots).toBeUndefined()
	})

	it('D46: Arcane Trickster (Rogue 3) reads its slot table off the SUBCLASS entry, padded to 1-9', () => {
		const result = computeSpellSlots(characterWithClass('Rogue', 3, 'Arcane Trickster'), classData)
		expect(result.status).toBe('known')
		if (result.status !== 'known') return
		expect(result.value[0].ordinarySlots).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 0])
		expect(result.value[0].pactSlots).toBeUndefined()
	})

	it('D46: a Fighter with a non-spellcasting subclass (Champion) still yields no slots, cleanly — not an error', () => {
		const result = computeSpellSlots(characterWithClass('Fighter', 7, 'Champion'), classData)
		expect(result.status).toBe('known')
		if (result.status !== 'known') return
		expect(result.value).toEqual([])
	})

	it('returns unknown when a class is not in the supplied data (D43)', () => {
		const result = computeSpellSlots(characterWithClass('Made Up Class', 1), classData)
		expect(result.status).toBe('unknown')
	})

	it('returns unknown when the character has no classes', () => {
		const result = computeSpellSlots({ id: '2', name: 'Blank', classes: [] }, classData)
		expect(result.status).toBe('unknown')
	})
})
