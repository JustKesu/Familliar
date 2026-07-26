import { describe, expect, it } from 'vitest'
import { abilityBonusChoiceToMap, isValidAbilityBonusChoice } from './abilityBonus'
import type { Ability } from '../abilities/abilityScores'

const OFFERED: readonly Ability[] = ['intelligence', 'wisdom', 'charisma']

describe('isValidAbilityBonusChoice', () => {
	it('accepts +2/+1 on two different offered abilities', () => {
		expect(isValidAbilityBonusChoice({ kind: 'twoOne', plusTwo: 'wisdom', plusOne: 'charisma' }, OFFERED)).toBe(true)
	})

	it('rejects +2/+1 on the same ability twice', () => {
		expect(isValidAbilityBonusChoice({ kind: 'twoOne', plusTwo: 'wisdom', plusOne: 'wisdom' }, OFFERED)).toBe(false)
	})

	it('rejects +2/+1 when either ability is outside the offered trio', () => {
		expect(isValidAbilityBonusChoice({ kind: 'twoOne', plusTwo: 'strength', plusOne: 'wisdom' }, OFFERED)).toBe(false)
		expect(isValidAbilityBonusChoice({ kind: 'twoOne', plusTwo: 'wisdom', plusOne: 'dexterity' }, OFFERED)).toBe(false)
	})

	it('accepts +1/+1/+1 unconditionally — it always covers exactly the offered trio', () => {
		expect(isValidAbilityBonusChoice({ kind: 'oneEach' }, OFFERED)).toBe(true)
	})
})

describe('abilityBonusChoiceToMap', () => {
	it('converts a +2/+1 choice to a two-key mapping', () => {
		expect(abilityBonusChoiceToMap({ kind: 'twoOne', plusTwo: 'wisdom', plusOne: 'charisma' }, OFFERED)).toEqual({
			wisdom: 2,
			charisma: 1,
		})
	})

	it('converts +1/+1/+1 to a mapping covering all three offered abilities', () => {
		expect(abilityBonusChoiceToMap({ kind: 'oneEach' }, OFFERED)).toEqual({
			intelligence: 1,
			wisdom: 1,
			charisma: 1,
		})
	})
})
