import { describe, expect, it } from 'vitest'
import { parseDiceExpression, rollDice } from './roll'

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
