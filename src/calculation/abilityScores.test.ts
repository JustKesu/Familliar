import { describe, expect, it } from 'vitest'
import type { Character } from '../storage/character'
import { abilityModifier, computeAbilityScore, computeAbilityScores } from './abilityScores'
import type { FeatEffectEntry } from './featEffects'

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

	it('adds a half-feat\'s +1 to the chosen ability as its own contribution (D42/D57)', () => {
		const athlete: FeatEffectEntry = { name: 'Athlete', source: 'XPHB', ability: [{ choose: { from: ['str', 'dex'] } }] }
		const withAthlete: Character = {
			...fighter5,
			featAsiChoices: [{ level: 4, kind: 'feat', name: 'Athlete', source: 'XPHB', chosenAbility: 'dexterity' }],
		}
		expect(computeAbilityScore('dexterity', withAthlete, [athlete])).toEqual({
			status: 'known',
			value: { score: 15, modifier: 2 },
			breakdown: [
				{ source: 'base', amount: 14 },
				{ source: 'feat (Athlete)', amount: 1 },
			],
		})
	})

	it('adds a fixed-bonus feat\'s amount from the feat data, not the choice (D57)', () => {
		const actor: FeatEffectEntry = { name: 'Actor', source: 'XPHB', ability: [{ cha: 1 }] }
		const withActor: Character = { ...fighter5, featAsiChoices: [{ level: 4, kind: 'feat', name: 'Actor', source: 'XPHB' }] }
		expect(computeAbilityScore('charisma', withActor, [actor])).toEqual({
			status: 'known',
			value: { score: 9, modifier: -1 },
			breakdown: [
				{ source: 'base', amount: 8 },
				{ source: 'feat (Actor)', amount: 1 },
			],
		})
	})

	it('adds an ASI increase as a further list entry, alongside background (D42)', () => {
		const withAsi: Character = { ...fighter5, featAsiChoices: [{ level: 4, kind: 'asi', increases: { strength: 1, dexterity: 1 } }] }
		expect(computeAbilityScore('strength', withAsi, [])).toEqual({
			status: 'known',
			value: { score: 18, modifier: 4 },
			breakdown: [
				{ source: 'base', amount: 15 },
				{ source: 'background', amount: 2 },
				{ source: 'ASI (level 4)', amount: 1 },
			],
		})
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
