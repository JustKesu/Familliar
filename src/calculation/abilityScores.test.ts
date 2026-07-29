import { describe, expect, it } from 'vitest'
import type { Character } from '../storage/character'
import { abilityModifier, computeAbilityScore, computeAbilityScores } from './abilityScores'

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

describe('abilityModifier', () => {
	it('follows the standard D&D modifier table', () => {
		expect(abilityModifier(8)).toBe(-1)
		expect(abilityModifier(10)).toBe(0)
		expect(abilityModifier(11)).toBe(0)
		expect(abilityModifier(17)).toBe(3)
		expect(abilityModifier(20)).toBe(5)
	})
})

describe('computeAbilityScore', () => {
	it('sums base score and background bonus (D17), with a breakdown (D42)', () => {
		const result = computeAbilityScore('strength', fighter5)
		expect(result).toEqual({
			status: 'known',
			value: { score: 17, modifier: 3 },
			breakdown: [
				{ source: 'base', amount: 15 },
				{ source: 'background', amount: 2 },
			],
		})
	})

	it('omits the background bonus from the breakdown when there is none', () => {
		const result = computeAbilityScore('dexterity', fighter5)
		expect(result).toEqual({
			status: 'known',
			value: { score: 14, modifier: 2 },
			breakdown: [{ source: 'base', amount: 14 }],
		})
	})

	it('returns unknown when the character has no ability scores yet', () => {
		const noScores: Character = { id: '2', name: 'Blank', classes: [] }
		const result = computeAbilityScore('strength', noScores)
		expect(result.status).toBe('unknown')
	})
})

describe('computeAbilityScores', () => {
	it('computes all six abilities', () => {
		const result = computeAbilityScores(fighter5)
		expect(Object.keys(result)).toHaveLength(6)
		expect(result.strength).toEqual({
			status: 'known',
			value: { score: 17, modifier: 3 },
			breakdown: [
				{ source: 'base', amount: 15 },
				{ source: 'background', amount: 2 },
			],
		})
		expect(result.charisma).toEqual({
			status: 'known',
			value: { score: 8, modifier: -1 },
			breakdown: [{ source: 'base', amount: 8 }],
		})
	})
})
