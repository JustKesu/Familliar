import { describe, expect, it } from 'vitest'
import type { Character } from '../storage/character'
import type { FeatEffectEntry } from './featEffects'
import { type ClassSavingThrowProficiencies, computeSavingThrow, computeSavingThrows } from './savingThrows'

const fighterProficiencies: ClassSavingThrowProficiencies = { className: 'Fighter', classSource: 'XPHB', abilities: ['str', 'con'] }
const barbarianProficiencies: ClassSavingThrowProficiencies = { className: 'Barbarian', classSource: 'XPHB', abilities: ['str', 'con'] }
const classData = [fighterProficiencies, barbarianProficiencies]

const fighter5: Character = {
	id: '1',
	name: 'Fighter5',
	classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 5 }],
	abilityScores: {
		method: 'standardArray',
		scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 },
	},
	abilityBonus: { strength: 2, constitution: 1 },
}

const barbarian1: Character = {
	id: '2',
	name: 'Barbarian1',
	classes: [{ className: 'Barbarian', classSource: 'XPHB', subclass: null, level: 1 }],
	abilityScores: {
		method: 'standardArray',
		scores: { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 10, charisma: 8 },
	},
}

describe('computeSavingThrow', () => {
	it('adds proficiency bonus for a class-proficient save (Fighter 5, STR)', () => {
		expect(computeSavingThrow('strength', fighter5, classData)).toEqual({
			status: 'known',
			value: { status: 'proficient', modifier: 6 },
			breakdown: [
				{ source: 'strength modifier', amount: 3 },
				{ source: 'proficiency (Fighter)', amount: 3 },
			],
		})
	})

	it('is just the ability modifier for a non-proficient save (Fighter 5, DEX)', () => {
		expect(computeSavingThrow('dexterity', fighter5, classData)).toEqual({
			status: 'known',
			value: { status: 'none', modifier: 2 },
			breakdown: [{ source: 'dexterity modifier', amount: 2 }],
		})
	})

	it('uses the +2 proficiency bonus at Barbarian 1 (boundary level)', () => {
		expect(computeSavingThrow('strength', barbarian1, classData)).toEqual({
			status: 'known',
			value: { status: 'proficient', modifier: 5 },
			breakdown: [
				{ source: 'strength modifier', amount: 3 },
				{ source: 'proficiency (Barbarian)', amount: 2 },
			],
		})
	})

	it('returns unknown when the class is not in the supplied data (D43)', () => {
		const unknownClass: Character = {
			id: '3',
			name: 'Mystery',
			classes: [{ className: 'Made Up Class', classSource: 'XPHB', subclass: null, level: 1 }],
			abilityScores: fighter5.abilityScores,
		}
		const result = computeSavingThrow('strength', unknownClass, classData)
		expect(result.status).toBe('unknown')
	})

	it('returns unknown when ability scores are missing', () => {
		const noScores: Character = { id: '4', name: 'Blank', classes: fighter5.classes }
		expect(computeSavingThrow('strength', noScores, classData).status).toBe('unknown')
	})

	it('Resilient adds save proficiency in the chosen ability, resolved from chosenAbility (D57)', () => {
		const resilient: FeatEffectEntry = {
			name: 'Resilient',
			source: 'XPHB',
			savingThrowProficiencies: [{ choose: { from: ['str', 'dex', 'con', 'int', 'wis', 'cha'] } }],
		}
		const withResilient: Character = {
			...fighter5,
			featAsiChoices: [{ level: 4, kind: 'feat', name: 'Resilient', source: 'XPHB', chosenAbility: 'wisdom' }],
		}
		expect(computeSavingThrow('wisdom', withResilient, classData, [resilient])).toEqual({
			status: 'known',
			value: { status: 'proficient', modifier: 3 },
			breakdown: [
				{ source: 'wisdom modifier', amount: 0 },
				{ source: 'proficiency (feat (Resilient))', amount: 3 },
			],
		})
	})

	it('D44: a save granted by both a class and Resilient is counted once, both sources named', () => {
		const resilient: FeatEffectEntry = {
			name: 'Resilient',
			source: 'XPHB',
			savingThrowProficiencies: [{ choose: { from: ['str', 'dex', 'con', 'int', 'wis', 'cha'] } }],
		}
		const withResilient: Character = {
			...fighter5,
			featAsiChoices: [{ level: 4, kind: 'feat', name: 'Resilient', source: 'XPHB', chosenAbility: 'strength' }],
		}
		expect(computeSavingThrow('strength', withResilient, classData, [resilient])).toEqual({
			status: 'known',
			value: { status: 'proficient', modifier: 6 },
			breakdown: [
				{ source: 'strength modifier', amount: 3 },
				{ source: 'proficiency (Fighter, feat (Resilient))', amount: 3 },
			],
		})
	})

	it('D60: a note-only contribution in the breakdown does not flip the status to proficient (regression fixture — no real feat produces this on a save yet, see docs/REPORT.md)', () => {
		const result = computeSavingThrow('dexterity', fighter5, classData)
		expect(result.status).toBe('known')
		if (result.status !== 'known') return

		const withNote = {
			...result,
			breakdown: [...result.breakdown, { source: 'feat (Test Note Feat)', amount: 0, note: 'effect not computed (D55/D58 style)' }],
		}
		expect(withNote.breakdown.length).toBeGreaterThan(1)
		expect(withNote.value.status).toBe('none')
	})
})

describe('computeSavingThrows', () => {
	it('computes all six saves for a Fighter 5', () => {
		const result = computeSavingThrows(fighter5, classData)
		expect(Object.keys(result)).toHaveLength(6)
		expect(result.strength.status).toBe('known')
		expect(result.strength.status === 'known' && result.strength.value).toEqual({ status: 'proficient', modifier: 6 })
		expect(result.wisdom.status).toBe('known')
		expect(result.wisdom.status === 'known' && result.wisdom.value).toEqual({ status: 'none', modifier: 0 })
	})
})
