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

const fighterSlots: ClassSpellSlotsData = {
	className: 'Fighter',
	classSource: 'XPHB',
	casterProgression: null,
	spellSlotsByLevel: null,
	pactSlotsByLevel: null,
}

const classData = [wizardSlots, paladinSlots, warlockSlots, fighterSlots]

function characterWithClass(className: string, level: number): Character {
	return {
		id: '1',
		name: 'Test',
		classes: [{ className, classSource: 'XPHB', subclass: null, level }],
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

	it('returns unknown when a class is not in the supplied data (D43)', () => {
		const result = computeSpellSlots(characterWithClass('Made Up Class', 1), classData)
		expect(result.status).toBe('unknown')
	})

	it('returns unknown when the character has no classes', () => {
		const result = computeSpellSlots({ id: '2', name: 'Blank', classes: [] }, classData)
		expect(result.status).toBe('unknown')
	})
})
