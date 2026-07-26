import { describe, expect, it } from 'vitest'
import {
	ABILITIES,
	POINT_BUY_BUDGET,
	STANDARD_ARRAY,
	pointBuyCost,
	pointBuyTotal,
	rollAbilityScore,
	rollSixAbilityScores,
	usesStandardArrayExactly,
	type AbilityScores,
} from './abilityScores'

describe('pointBuyCost', () => {
	it('costs 1 point per step from 8 to 13', () => {
		expect(pointBuyCost(8)).toBe(0)
		expect(pointBuyCost(9)).toBe(1)
		expect(pointBuyCost(10)).toBe(2)
		expect(pointBuyCost(11)).toBe(3)
		expect(pointBuyCost(12)).toBe(4)
		expect(pointBuyCost(13)).toBe(5)
	})

	it('costs 2 points for 14 and 2 points for 15', () => {
		expect(pointBuyCost(14)).toBe(7)
		expect(pointBuyCost(15)).toBe(9)
	})

	it('throws for scores outside 8-15', () => {
		expect(() => pointBuyCost(7)).toThrow(RangeError)
		expect(() => pointBuyCost(16)).toThrow(RangeError)
	})
})

describe('pointBuyTotal', () => {
	it('sums the cost of all six abilities', () => {
		const scores: AbilityScores = {
			strength: 15,
			dexterity: 14,
			constitution: 13,
			intelligence: 12,
			wisdom: 10,
			charisma: 8,
		}
		// 9 + 7 + 5 + 4 + 2 + 0 = 27
		expect(pointBuyTotal(scores)).toBe(27)
	})

	it('a fully-bought-up array costs exactly the 27 point budget', () => {
		const scores: AbilityScores = {
			strength: 15,
			dexterity: 15,
			constitution: 15,
			intelligence: 8,
			wisdom: 8,
			charisma: 8,
		}
		// 9 * 3 = 27
		expect(pointBuyTotal(scores)).toBe(POINT_BUY_BUDGET)
	})

	it('the all-8 baseline costs 0', () => {
		const scores: AbilityScores = {
			strength: 8,
			dexterity: 8,
			constitution: 8,
			intelligence: 8,
			wisdom: 8,
			charisma: 8,
		}
		expect(pointBuyTotal(scores)).toBe(0)
	})
})

describe('rollAbilityScore', () => {
	it('drops the lowest of the four dice', () => {
		const dice = [1, 5, 3, 6]
		let i = 0
		const rollDie = () => dice[i++]
		const result = rollAbilityScore(rollDie)
		expect(result.dice).toEqual([1, 5, 3, 6])
		expect(result.total).toBe(5 + 3 + 6) // drops the 1
	})

	it('drops only one lowest when there are ties', () => {
		const dice = [2, 2, 4, 6]
		let i = 0
		const rollDie = () => dice[i++]
		const result = rollAbilityScore(rollDie)
		expect(result.total).toBe(2 + 4 + 6)
	})

	it('always lands within 3-18', () => {
		for (let trial = 0; trial < 50; trial++) {
			const result = rollAbilityScore(() => Math.floor(Math.random() * 6) + 1)
			expect(result.total).toBeGreaterThanOrEqual(3)
			expect(result.total).toBeLessThanOrEqual(18)
		}
	})
})

describe('rollSixAbilityScores', () => {
	it('produces six rolled sets, each with four dice', () => {
		const rollDie = () => 4
		const results = rollSixAbilityScores(rollDie)
		expect(results).toHaveLength(6)
		for (const result of results) {
			expect(result.dice).toHaveLength(4)
			expect(result.total).toBe(12)
		}
	})
})

describe('ABILITIES / STANDARD_ARRAY', () => {
	it('lists the six abilities in PHB order', () => {
		expect(ABILITIES).toEqual(['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'])
	})

	it('has the standard array values', () => {
		expect(STANDARD_ARRAY).toEqual([15, 14, 13, 12, 10, 8])
	})
})

describe('usesStandardArrayExactly', () => {
	it('accepts any assignment that uses each standard array value exactly once', () => {
		const scores: AbilityScores = {
			strength: 8,
			dexterity: 15,
			constitution: 10,
			intelligence: 14,
			wisdom: 12,
			charisma: 13,
		}
		expect(usesStandardArrayExactly(scores)).toBe(true)
	})

	it('rejects a set that repeats a value', () => {
		const scores: AbilityScores = {
			strength: 15,
			dexterity: 15,
			constitution: 13,
			intelligence: 12,
			wisdom: 10,
			charisma: 8,
		}
		expect(usesStandardArrayExactly(scores)).toBe(false)
	})

	it('rejects a set with a value outside the standard array', () => {
		const scores: AbilityScores = {
			strength: 16,
			dexterity: 14,
			constitution: 13,
			intelligence: 12,
			wisdom: 10,
			charisma: 8,
		}
		expect(usesStandardArrayExactly(scores)).toBe(false)
	})
})
