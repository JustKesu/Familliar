import { describe, expect, it } from 'vitest'
import { coinsToCopper, copperToCoins } from './currency'

describe('currency conversion', () => {
	it('splits a copper total into gp/sp/cp the way a player writes it', () => {
		expect(copperToCoins(0)).toEqual({ gp: 0, sp: 0, cp: 0 })
		expect(copperToCoins(7)).toEqual({ gp: 0, sp: 0, cp: 7 })
		expect(copperToCoins(1234)).toEqual({ gp: 12, sp: 3, cp: 4 })
	})

	it('round-trips any copper total through the split and back', () => {
		for (const total of [0, 1, 9, 10, 99, 100, 555, 1234, 100000]) {
			expect(coinsToCopper(copperToCoins(total))).toBe(total)
		}
	})

	it('recombines uneven coin piles (25 sp is 2 gp 5 sp of copper)', () => {
		expect(coinsToCopper({ gp: 0, sp: 25, cp: 0 })).toBe(250)
		expect(coinsToCopper({ gp: 3, sp: 0, cp: 40 })).toBe(340)
	})

	it('clamps a half-typed or negative field to a non-negative whole number', () => {
		expect(coinsToCopper({ gp: -5, sp: 0, cp: 0 })).toBe(0)
		expect(coinsToCopper({ gp: 1.9, sp: 0, cp: 0 })).toBe(100)
		expect(copperToCoins(-40)).toEqual({ gp: 0, sp: 0, cp: 0 })
	})
})
