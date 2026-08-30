import { describe, expect, it } from 'vitest'
import {
	abilityBonusChoiceToMap,
	abilityBonusDistributionToMap,
	isAbilityBonusDistributionComplete,
	isValidAbilityBonusChoice,
} from './abilityBonus'
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

describe('isAbilityBonusDistributionComplete', () => {
	it('is false for an untouched chooser and for a half-made +2/+1', () => {
		expect(isAbilityBonusDistributionComplete(null, OFFERED)).toBe(false)
		expect(isAbilityBonusDistributionComplete({ mode: 'twoOne', plusTwo: 'wisdom', plusOne: null }, OFFERED)).toBe(false)
		expect(isAbilityBonusDistributionComplete({ mode: 'twoOne', plusTwo: null, plusOne: null }, OFFERED)).toBe(false)
	})

	it('is false for a +2/+1 that is filled in but illegal', () => {
		expect(isAbilityBonusDistributionComplete({ mode: 'twoOne', plusTwo: 'wisdom', plusOne: 'wisdom' }, OFFERED)).toBe(false)
		expect(isAbilityBonusDistributionComplete({ mode: 'twoOne', plusTwo: 'strength', plusOne: 'wisdom' }, OFFERED)).toBe(false)
	})

	it('is true for a complete legal +2/+1 and for +1/+1/+1', () => {
		expect(isAbilityBonusDistributionComplete({ mode: 'twoOne', plusTwo: 'wisdom', plusOne: 'charisma' }, OFFERED)).toBe(true)
		expect(isAbilityBonusDistributionComplete({ mode: 'oneEach' }, OFFERED)).toBe(true)
	})
})

describe('abilityBonusDistributionToMap', () => {
	it('is empty until the distribution is complete and legal', () => {
		expect(abilityBonusDistributionToMap(null, OFFERED)).toEqual({})
		expect(abilityBonusDistributionToMap({ mode: 'twoOne', plusTwo: 'wisdom', plusOne: null }, OFFERED)).toEqual({})
		expect(abilityBonusDistributionToMap({ mode: 'twoOne', plusTwo: 'wisdom', plusOne: 'wisdom' }, OFFERED)).toEqual({})
	})

	it('matches abilityBonusChoiceToMap once complete', () => {
		expect(abilityBonusDistributionToMap({ mode: 'twoOne', plusTwo: 'wisdom', plusOne: 'charisma' }, OFFERED)).toEqual({
			wisdom: 2,
			charisma: 1,
		})
		expect(abilityBonusDistributionToMap({ mode: 'oneEach' }, OFFERED)).toEqual({
			intelligence: 1,
			wisdom: 1,
			charisma: 1,
		})
	})
})
