import { describe, expect, it } from 'vitest'
import type { Character, CharacterClassFeatureChoice } from '../storage/character'
import { type ClassSpellCountData, computeSpellCounts } from './spellCounts'

// Rows confirmed against data/classes.json by scripts/investigate-spell-counts.js
// and scripts/investigate-spell-counts-2.js — no ability modifier involved,
// see spellCounts.ts's own header comment.
const wizardCounts: ClassSpellCountData = {
	className: 'Wizard',
	classSource: 'XPHB',
	cantripProgression: [3, 3, 3, 4, 4],
	leveledSpellProgression: [4, 5, 6, 7, 9],
	label: 'prepared',
}

const clericCounts: ClassSpellCountData = {
	className: 'Cleric',
	classSource: 'XPHB',
	cantripProgression: [3, 3, 3, 4, 4],
	leveledSpellProgression: [4, 5, 6, 7, 9],
	label: 'prepared',
}

const paladinCounts: ClassSpellCountData = {
	className: 'Paladin',
	classSource: 'XPHB',
	cantripProgression: null,
	leveledSpellProgression: [2, 3, 4, 5, 6],
	label: 'prepared',
}

const bardCounts: ClassSpellCountData = {
	className: 'Bard',
	classSource: 'XPHB',
	cantripProgression: [2, 2, 2, 3, 3],
	leveledSpellProgression: [4, 5, 6, 7, 9],
	label: 'known',
}

const fighterCounts: ClassSpellCountData = {
	className: 'Fighter',
	classSource: 'XPHB',
	cantripProgression: null,
	leveledSpellProgression: null,
	label: null,
	subclasses: [
		{
			subclassName: 'Eldritch Knight',
			cantripProgression: [0, 0, 2, 2, 2, 2, 2],
			leveledSpellProgression: [0, 0, 3, 4, 4, 4, 5],
			label: 'known',
		},
		// Champion carries no counts at all — a non-spellcasting subclass yields no entry, not an error.
	],
}

const druidCounts: ClassSpellCountData = {
	className: 'Druid',
	classSource: 'XPHB',
	cantripProgression: [2, 2, 2, 3, 3],
	leveledSpellProgression: [4, 5, 6, 7, 9],
	label: 'prepared',
}

const classData = [wizardCounts, clericCounts, paladinCounts, bardCounts, fighterCounts, druidCounts]

function characterWithClass(className: string, level: number, subclass: string | null = null, classFeatureChoices?: CharacterClassFeatureChoice[]): Character {
	return {
		id: '1',
		name: 'Test',
		classes: [{ className, classSource: 'XPHB', subclass, level }],
		classFeatureChoices,
	}
}

describe('computeSpellCounts', () => {
	it('a full caster (Wizard 3): exact cantrip and leveled counts from the table, label "prepared"', () => {
		const result = computeSpellCounts(characterWithClass('Wizard', 3), classData)
		expect(result.status).toBe('known')
		if (result.status !== 'known') return
		expect(result.value).toHaveLength(1)
		expect(result.value[0]).toMatchObject({ cantripCount: 3, leveledSpellCount: 6, label: 'prepared' })
	})

	it('a class whose count could look ability-modifier-dependent (Cleric) still reads the count straight off the structured per-level array — no ability score needed or consulted', () => {
		const result = computeSpellCounts(characterWithClass('Cleric', 1), classData)
		expect(result.status).toBe('known')
		if (result.status !== 'known') return
		expect(result.value[0]).toMatchObject({ cantripCount: 3, leveledSpellCount: 4, label: 'prepared' })
	})

	it('a class with no cantrips at all (Paladin): cantripCount is 0, leveled count still reads correctly', () => {
		const result = computeSpellCounts(characterWithClass('Paladin', 5), classData)
		expect(result.status).toBe('known')
		if (result.status !== 'known') return
		expect(result.value[0]).toMatchObject({ cantripCount: 0, leveledSpellCount: 6, label: 'prepared' })
	})

	it('a known caster (Bard): label is "known", not "prepared"', () => {
		const result = computeSpellCounts(characterWithClass('Bard', 1), classData)
		expect(result.status).toBe('known')
		if (result.status !== 'known') return
		expect(result.value[0].label).toBe('known')
	})

	it('a non-caster (Fighter, no subclass): no entry at all, cleanly — empty list, not zeroes, not an error', () => {
		const result = computeSpellCounts(characterWithClass('Fighter', 1), classData)
		expect(result.status).toBe('known')
		if (result.status !== 'known') return
		expect(result.value).toEqual([])
	})

	it('Eldritch Knight (Fighter 3): reads its counts off the SUBCLASS entry, label "known"', () => {
		const result = computeSpellCounts(characterWithClass('Fighter', 3, 'Eldritch Knight'), classData)
		expect(result.status).toBe('known')
		if (result.status !== 'known') return
		expect(result.value[0]).toMatchObject({ cantripCount: 2, leveledSpellCount: 3, label: 'known' })
	})

	it('a Fighter below level 3 with no subclass chosen yet still yields no entry', () => {
		const result = computeSpellCounts(characterWithClass('Fighter', 2), classData)
		expect(result.status).toBe('known')
		if (result.status !== 'known') return
		expect(result.value).toEqual([])
	})

	it('a Fighter with a non-spellcasting subclass (Champion) still yields no entry, cleanly', () => {
		const result = computeSpellCounts(characterWithClass('Fighter', 3, 'Champion'), classData)
		expect(result.status).toBe('known')
		if (result.status !== 'known') return
		expect(result.value).toEqual([])
	})

	it('returns unknown when a class is not in the supplied data (D43)', () => {
		const result = computeSpellCounts(characterWithClass('Made Up Class', 1), classData)
		expect(result.status).toBe('unknown')
	})

	it('returns unknown when the character has no classes', () => {
		const result = computeSpellCounts({ id: '2', name: 'Blank', classes: [] }, classData)
		expect(result.status).toBe('unknown')
	})

	it('a Thaumaturge Cleric has exactly one more cantrip than a Protector Cleric of the same level (PHB 2024 prose, D21)', () => {
		const protector = computeSpellCounts(
			characterWithClass('Cleric', 3, null, [{ className: 'Cleric', classSource: 'XPHB', featureName: 'Divine Order', grantedAtLevel: 1, optionName: 'Protector' }]),
			classData,
		)
		const thaumaturge = computeSpellCounts(
			characterWithClass('Cleric', 3, null, [{ className: 'Cleric', classSource: 'XPHB', featureName: 'Divine Order', grantedAtLevel: 1, optionName: 'Thaumaturge' }]),
			classData,
		)
		expect(protector.status).toBe('known')
		expect(thaumaturge.status).toBe('known')
		if (protector.status !== 'known' || thaumaturge.status !== 'known') return
		expect(thaumaturge.value[0].cantripCount).toBe(protector.value[0].cantripCount + 1)
		expect(thaumaturge.value[0].leveledSpellCount).toBe(protector.value[0].leveledSpellCount)
	})

	it('a Magician Druid has exactly one more cantrip than a Warden Druid of the same level (PHB 2024 prose, D21)', () => {
		const warden = computeSpellCounts(
			characterWithClass('Druid', 3, null, [{ className: 'Druid', classSource: 'XPHB', featureName: 'Primal Order', grantedAtLevel: 1, optionName: 'Warden' }]),
			classData,
		)
		const magician = computeSpellCounts(
			characterWithClass('Druid', 3, null, [{ className: 'Druid', classSource: 'XPHB', featureName: 'Primal Order', grantedAtLevel: 1, optionName: 'Magician' }]),
			classData,
		)
		expect(warden.status).toBe('known')
		expect(magician.status).toBe('known')
		if (warden.status !== 'known' || magician.status !== 'known') return
		expect(magician.value[0].cantripCount).toBe(warden.value[0].cantripCount + 1)
		expect(magician.value[0].leveledSpellCount).toBe(warden.value[0].leveledSpellCount)
	})
})
