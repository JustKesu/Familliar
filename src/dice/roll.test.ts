import { describe, expect, it } from 'vitest'
import { rollDie } from './roll'

describe('rollDie', () => {
	it('returns the die and the total from a fixed random source', () => {
		expect(rollDie(20, 7, () => 0.65)).toEqual({ die: 14, modifier: 7, total: 21 })
	})

	it('reaches 1 and the die size at the ends of the random range', () => {
		expect(rollDie(20, 0, () => 0).die).toBe(1)
		expect(rollDie(20, 0, () => 0.999999).die).toBe(20)
	})

	it('adds a negative modifier', () => {
		expect(rollDie(20, -1, () => 0).total).toBe(0)
	})

	it('takes any die size', () => {
		expect(rollDie(8, 2, () => 0.999999)).toEqual({ die: 8, modifier: 2, total: 10 })
	})
})
