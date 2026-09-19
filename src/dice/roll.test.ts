import { describe, expect, it, vi } from 'vitest'
import { parseDiceExpression, rollDice, rollKeepOne } from './roll'

function sequence(values: number[]): () => number {
	let i = 0
	return () => values[i++]!
}

describe('rollDice', () => {
	it('rolls one die and totals it with the modifier', () => {
		expect(rollDice(1, 20, 7, () => 0.65)).toEqual({ dice: [14], modifier: 7, total: 21 })
	})

	it('reaches 1 and the die size at the ends of the random range', () => {
		expect(rollDice(1, 20, 0, () => 0).dice).toEqual([1])
		expect(rollDice(1, 20, 0, () => 0.999999).dice).toEqual([20])
	})

	it('adds a negative modifier', () => {
		expect(rollDice(1, 20, -1, () => 0).total).toBe(0)
	})

	it('takes any die size', () => {
		expect(rollDice(1, 8, 2, () => 0.999999)).toEqual({ dice: [8], modifier: 2, total: 10 })
	})

	it('keeps each die of a multi-die roll, in order, and totals them with the modifier', () => {
		// 0.6 → 4 and 0.2 → 2 on a d6.
		expect(rollDice(2, 6, 3, sequence([0.6, 0.2]))).toEqual({ dice: [4, 2], modifier: 3, total: 9 })
	})

	it('draws one random value per die', () => {
		expect(rollDice(4, 6, 0, sequence([0, 0.2, 0.5, 0.999999])).dice).toEqual([1, 2, 4, 6])
	})
})

describe('rollKeepOne', () => {
	// 0.65 → 14 and 0.4 → 9 on a d20.
	it('rolls a single die in normal mode, as rollDice does', () => {
		expect(rollKeepOne(20, 5, 'normal', () => 0.65)).toEqual({ mode: 'normal', dice: [14], kept: 14, modifier: 5, total: 19 })
	})

	it('draws one random value in normal mode', () => {
		const random = vi.fn(() => 0.65)
		rollKeepOne(20, 0, 'normal', random)
		expect(random).toHaveBeenCalledTimes(1)
	})

	it('keeps the higher of two dice with advantage, and returns both', () => {
		expect(rollKeepOne(20, 5, 'advantage', sequence([0.4, 0.65]))).toEqual({ mode: 'advantage', dice: [9, 14], kept: 14, modifier: 5, total: 19 })
		expect(rollKeepOne(20, 5, 'advantage', sequence([0.65, 0.4]))).toEqual({ mode: 'advantage', dice: [14, 9], kept: 14, modifier: 5, total: 19 })
	})

	it('keeps the lower of two dice with disadvantage, and returns both', () => {
		expect(rollKeepOne(20, 5, 'disadvantage', sequence([0.65, 0.4]))).toEqual({ mode: 'disadvantage', dice: [14, 9], kept: 9, modifier: 5, total: 14 })
		expect(rollKeepOne(20, 5, 'disadvantage', sequence([0.4, 0.65]))).toEqual({ mode: 'disadvantage', dice: [9, 14], kept: 9, modifier: 5, total: 14 })
	})

	it('keeps the shared value on a tie', () => {
		expect(rollKeepOne(20, 0, 'advantage', sequence([0.5, 0.5])).kept).toBe(11)
		expect(rollKeepOne(20, 0, 'disadvantage', sequence([0.5, 0.5])).kept).toBe(11)
	})

	it('adds a negative modifier to the kept die only', () => {
		expect(rollKeepOne(20, -2, 'advantage', sequence([0.4, 0.65])).total).toBe(12)
	})

	it('leaves rollDice summing every die, whatever the keep-one modes do', () => {
		expect(rollDice(2, 20, 5, sequence([0.4, 0.65]))).toEqual({ dice: [9, 14], modifier: 5, total: 28 })
	})
})

describe('parseDiceExpression', () => {
	it('reads NdS', () => {
		expect(parseDiceExpression('2d6')).toEqual({ count: 2, sides: 6 })
		expect(parseDiceExpression('1d8')).toEqual({ count: 1, sides: 8 })
		expect(parseDiceExpression('1d12')).toEqual({ count: 1, sides: 12 })
	})

	it('refuses anything that is not a single dice group', () => {
		expect(parseDiceExpression('1')).toBeNull()
		expect(parseDiceExpression('d6')).toBeNull()
		expect(parseDiceExpression('2d6+1')).toBeNull()
		expect(parseDiceExpression('0d6')).toBeNull()
		expect(parseDiceExpression('')).toBeNull()
	})
})
