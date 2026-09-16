import { describe, expect, it } from 'vitest'
import { applyDamage, applyHealing, grantTemporaryHitPoints } from './damageHealing'

describe('damage (D110)', () => {
	it('comes off temporary hit points first and only the remainder off current', () => {
		expect(applyDamage({ currentHp: 30, temporaryHitPoints: 8 }, 5)).toEqual({ currentHp: 30, temporaryHitPoints: 3 })
		expect(applyDamage({ currentHp: 30, temporaryHitPoints: 8 }, 12)).toEqual({ currentHp: 26, temporaryHitPoints: 0 })
	})

	it('spends exactly the temporary pile when the hit matches it', () => {
		expect(applyDamage({ currentHp: 30, temporaryHitPoints: 8 }, 8)).toEqual({ currentHp: 30, temporaryHitPoints: 0 })
	})

	it('stops current hit points at 0, never below', () => {
		expect(applyDamage({ currentHp: 4, temporaryHitPoints: 0 }, 99)).toEqual({ currentHp: 0, temporaryHitPoints: 0 })
		expect(applyDamage({ currentHp: 4, temporaryHitPoints: 3 }, 99)).toEqual({ currentHp: 0, temporaryHitPoints: 0 })
	})
})

describe('healing (D110)', () => {
	it('never exceeds the maximum', () => {
		expect(applyHealing({ currentHp: 40, temporaryHitPoints: 0 }, 20, 44)).toEqual({ currentHp: 44, temporaryHitPoints: 0 })
	})

	it('does not restore temporary hit points', () => {
		expect(applyHealing({ currentHp: 10, temporaryHitPoints: 0 }, 5, 44)).toEqual({ currentHp: 15, temporaryHitPoints: 0 })
		expect(applyHealing({ currentHp: 10, temporaryHitPoints: 2 }, 5, 44)).toEqual({ currentHp: 15, temporaryHitPoints: 2 })
	})

	it('leaves a current that already sits above a lowered maximum alone rather than pulling it down', () => {
		expect(applyHealing({ currentHp: 50, temporaryHitPoints: 0 }, 5, 44)).toEqual({ currentHp: 50, temporaryHitPoints: 0 })
	})
})

describe('temporary hit points (D110)', () => {
	it('do not stack — the higher value wins', () => {
		expect(grantTemporaryHitPoints({ currentHp: 30, temporaryHitPoints: 5 }, 8)).toEqual({ currentHp: 30, temporaryHitPoints: 8 })
		expect(grantTemporaryHitPoints({ currentHp: 30, temporaryHitPoints: 8 }, 5)).toEqual({ currentHp: 30, temporaryHitPoints: 8 })
	})

	it('never change current hit points', () => {
		expect(grantTemporaryHitPoints({ currentHp: 3, temporaryHitPoints: 0 }, 10).currentHp).toBe(3)
	})
})
