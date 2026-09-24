import { describe, expect, it, vi } from 'vitest'
import { known } from '../calculation/types'
import { damageHitPoints } from '../sheet/HitPoints'
import {
	applyDeathSaveRoll,
	classifyDeathSaveRoll,
	deathSavesAfterDamageAtZero,
	deathSavesAfterHitPointChange,
	deathSaveState,
	describeDeathSaveRoll,
	recordFailures,
	recordSuccesses,
} from './deathSaves'

describe('classifying a death save roll (D111)', () => {
	it('reads a natural 20 as a hit point back, not as a success', () => {
		expect(classifyDeathSaveRoll(20)).toBe('regainsHitPoint')
	})

	it('reads a natural 1 as two failures', () => {
		expect(classifyDeathSaveRoll(1)).toBe('twoFailures')
	})

	it('reads 10 to 19 as a success and 2 to 9 as a failure', () => {
		expect(classifyDeathSaveRoll(10)).toBe('success')
		expect(classifyDeathSaveRoll(19)).toBe('success')
		expect(classifyDeathSaveRoll(9)).toBe('failure')
		expect(classifyDeathSaveRoll(2)).toBe('failure')
	})
})

describe('applying a death save roll (D111)', () => {
	it('clears the progress and hands back a hit point on a natural 20', () => {
		const result = applyDeathSaveRoll({ successes: 1, failures: 2 }, 20)
		expect(result.regainsHitPoint).toBe(true)
		expect(result.progress).toEqual({ successes: 0, failures: 0 })
	})

	it('adds two failures at once on a natural 1', () => {
		expect(applyDeathSaveRoll({ successes: 0, failures: 0 }, 1).progress).toEqual({ successes: 0, failures: 2 })
	})

	it('never pushes failures past three, even from a natural 1 on the second failure', () => {
		const result = applyDeathSaveRoll({ successes: 1, failures: 2 }, 1)
		expect(result.progress).toEqual({ successes: 1, failures: 3 })
		expect(deathSaveState(result.progress)).toBe('dead')
	})

	it('adds one success on a normal pass and one failure on a normal fail', () => {
		expect(applyDeathSaveRoll({ successes: 1, failures: 1 }, 14).progress).toEqual({ successes: 2, failures: 1 })
		expect(applyDeathSaveRoll({ successes: 1, failures: 1 }, 6).progress).toEqual({ successes: 1, failures: 2 })
	})

	/* The app rolled, so it has to say what it rolled — the player never saw the die. */
	it('names the rolled number in every outcome', () => {
		expect(describeDeathSaveRoll(applyDeathSaveRoll({ successes: 0, failures: 0 }, 20))).toContain('Rolled 20')
		expect(describeDeathSaveRoll(applyDeathSaveRoll({ successes: 0, failures: 0 }, 1))).toContain('two failures')
		expect(describeDeathSaveRoll(applyDeathSaveRoll({ successes: 0, failures: 0 }, 12))).toBe('Rolled 12 — a success.')
		expect(describeDeathSaveRoll(applyDeathSaveRoll({ successes: 0, failures: 0 }, 3))).toBe('Rolled 3 — a failure.')
	})
})

describe('counting the boxes by hand (D111)', () => {
	it('caps successes and failures at three', () => {
		expect(recordSuccesses({ successes: 3, failures: 0 })).toEqual({ successes: 3, failures: 0 })
		expect(recordFailures({ successes: 0, failures: 3 })).toEqual({ successes: 0, failures: 3 })
	})

	it('adds one at a time', () => {
		expect(recordSuccesses({ successes: 1, failures: 2 })).toEqual({ successes: 2, failures: 2 })
		expect(recordFailures({ successes: 1, failures: 1 })).toEqual({ successes: 1, failures: 2 })
	})
})

describe('death save state (D111)', () => {
	it('is stabilized at three successes and dead at three failures', () => {
		expect(deathSaveState({ successes: 3, failures: 2 })).toBe('stabilized')
		expect(deathSaveState({ successes: 2, failures: 3 })).toBe('dead')
	})

	it('is still rolling while both rows have a box open', () => {
		expect(deathSaveState({ successes: 0, failures: 0 })).toBe('rolling')
		expect(deathSaveState({ successes: 2, failures: 2 })).toBe('rolling')
	})
})

describe('death saves against the hit points (D111)', () => {
	it('keeps progress only at exactly 0 current hit points', () => {
		const progress = { successes: 1, failures: 2 }
		expect(deathSavesAfterHitPointChange(0, progress)).toEqual(progress)
		expect(deathSavesAfterHitPointChange(1, progress)).toBeUndefined()
		expect(deathSavesAfterHitPointChange(44, progress)).toBeUndefined()
		// "Not set" is not 0 (D43) — there is nothing to be dying from.
		expect(deathSavesAfterHitPointChange(undefined, progress)).toBeUndefined()
	})

	it('treats all-zero counts as no death save in progress', () => {
		expect(deathSavesAfterHitPointChange(0, { successes: 0, failures: 0 })).toBeUndefined()
		expect(deathSavesAfterHitPointChange(0, undefined)).toBeUndefined()
	})
})

/* D117: the die moved to the shared roller (rollKeepOne), so it is covered by the dice tests and by SheetHeader's. */

describe('damage at 0 hit points (D169)', () => {
	function hit(currentHp: number, amount: number, temporaryHitPoints: number, deathSaves?: { successes: number; failures: number }) {
		const onEditHitPoints = vi.fn()
		damageHitPoints(
			{ currentHp, maxHitPoints: known(10, []), maxHpOverride: undefined, temporaryHitPoints, deathSaves, onEditHitPoints },
			amount,
		)
		return onEditHitPoints.mock.calls[0][0]
	}

	it('adds exactly one failure', () => {
		expect(hit(0, 3, 0, { successes: 1, failures: 0 }).deathSaves).toEqual({ successes: 1, failures: 1 })
	})
	it('adds none when temporary hit points absorb it all', () => {
		expect(hit(0, 3, 5, { successes: 0, failures: 1 }).deathSaves).toEqual({ successes: 0, failures: 1 })
	})
	it('adds one when the damage outlasts the temporary pile', () => {
		expect(hit(0, 6, 5).deathSaves).toEqual({ successes: 0, failures: 1 })
	})
	it('un-stabilizes and counts one failure', () => {
		expect(hit(0, 1, 0, { successes: 3, failures: 0 }).deathSaves).toEqual({ successes: 0, failures: 1 })
	})
	it('kills on the third failure', () => {
		expect(deathSaveState(hit(0, 1, 0, { successes: 0, failures: 2 }).deathSaves)).toBe('dead')
	})
	it('adds none when dropping from positive to 0', () => {
		expect(hit(4, 9, 0).deathSaves).toBeUndefined()
	})
	it('adds nothing to a dead character', () => {
		expect(hit(0, 1, 0, { successes: 0, failures: 3 }).deathSaves).toEqual({ successes: 0, failures: 3 })
	})
	it('deathSavesAfterDamageAtZero leaves a dead character alone', () => {
		expect(deathSavesAfterDamageAtZero({ successes: 0, failures: 3 })).toEqual({ successes: 0, failures: 3 })
	})
})
