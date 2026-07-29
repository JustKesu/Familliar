import { describe, expect, it } from 'vitest'
import type { Character } from '../storage/character'
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
			value: 6,
			breakdown: [
				{ source: 'strength modifier', amount: 3 },
				{ source: 'proficiency (Fighter)', amount: 3 },
			],
		})
	})

	it('is just the ability modifier for a non-proficient save (Fighter 5, DEX)', () => {
		expect(computeSavingThrow('dexterity', fighter5, classData)).toEqual({
			status: 'known',
			value: 2,
			breakdown: [{ source: 'dexterity modifier', amount: 2 }],
		})
	})

	it('uses the +2 proficiency bonus at Barbarian 1 (boundary level)', () => {
		expect(computeSavingThrow('strength', barbarian1, classData)).toEqual({
			status: 'known',
			value: 5,
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
})

describe('computeSavingThrows', () => {
	it('computes all six saves for a Fighter 5', () => {
		const result = computeSavingThrows(fighter5, classData)
		expect(Object.keys(result)).toHaveLength(6)
		expect(result.strength.status).toBe('known')
		expect(result.strength.status === 'known' && result.strength.value).toBe(6)
		expect(result.wisdom.status).toBe('known')
		expect(result.wisdom.status === 'known' && result.wisdom.value).toBe(0)
	})
})
