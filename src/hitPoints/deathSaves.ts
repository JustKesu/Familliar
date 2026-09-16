/*
 * D111: the death saving throw rules as pure functions. Death saves run only
 * while a character sits at exactly 0 current hit points, so every function here
 * is arithmetic over the two counts — the caller owns the hit points and asks
 * this module what a roll or a click does to the boxes.
 *
 * The d20 is deliberately local to this feature: a death save takes no bonuses
 * at all, so there is nothing to share with the general dice roller a later step
 * builds.
 */

export interface DeathSaveProgress {
	readonly successes: number
	readonly failures: number
}

/** Three boxes each, per the 2024 rules. */
export const DEATH_SAVE_BOXES = 3

export const NO_DEATH_SAVES: DeathSaveProgress = { successes: 0, failures: 0 }

/**
 * What a rolled d20 means. A natural 20 is not a success — it puts the character
 * back on 1 hit point, which ends the death saves entirely; a natural 1 is two
 * failures at once.
 */
export type DeathSaveRollOutcome = 'regainsHitPoint' | 'success' | 'failure' | 'twoFailures'

export function classifyDeathSaveRoll(roll: number): DeathSaveRollOutcome {
	if (roll === 20) return 'regainsHitPoint'
	if (roll === 1) return 'twoFailures'
	return roll >= 10 ? 'success' : 'failure'
}

function capped(count: number): number {
	return Math.min(DEATH_SAVE_BOXES, Math.max(0, count))
}

/** Adds successes, never past the third box. */
export function recordSuccesses(progress: DeathSaveProgress, count = 1): DeathSaveProgress {
	return { ...progress, successes: capped(progress.successes + count) }
}

/** Adds failures, never past the third box — a natural 1 on the second failure lands on three, not four. */
export function recordFailures(progress: DeathSaveProgress, count = 1): DeathSaveProgress {
	return { ...progress, failures: capped(progress.failures + count) }
}

/** `rolling` while boxes are still open; the other two end the rolling for good. */
export type DeathSaveState = 'rolling' | 'stabilized' | 'dead'

export function deathSaveState(progress: DeathSaveProgress): DeathSaveState {
	if (progress.failures >= DEATH_SAVE_BOXES) return 'dead'
	if (progress.successes >= DEATH_SAVE_BOXES) return 'stabilized'
	return 'rolling'
}

export interface DeathSaveRollResult {
	readonly roll: number
	readonly outcome: DeathSaveRollOutcome
	/** The boxes after the roll. Cleared on a natural 20 — the character is no longer dying. */
	readonly progress: DeathSaveProgress
	/** The natural 20: 1 current hit point back, and with it the end of the death saves. */
	readonly regainsHitPoint: boolean
}

export function applyDeathSaveRoll(progress: DeathSaveProgress, roll: number): DeathSaveRollResult {
	const outcome = classifyDeathSaveRoll(roll)
	if (outcome === 'regainsHitPoint') return { roll, outcome, progress: NO_DEATH_SAVES, regainsHitPoint: true }
	const next =
		outcome === 'success' ? recordSuccesses(progress) : recordFailures(progress, outcome === 'twoFailures' ? 2 : 1)
	return { roll, outcome, progress: next, regainsHitPoint: false }
}

/** The number the player must see, and what it did — the app rolled, so it has to say what it rolled. */
export function describeDeathSaveRoll(result: DeathSaveRollResult): string {
	switch (result.outcome) {
		case 'regainsHitPoint':
			return `Rolled ${result.roll} — back up on 1 hit point.`
		case 'twoFailures':
			return `Rolled ${result.roll} — two failures.`
		case 'success':
			return `Rolled ${result.roll} — a success.`
		case 'failure':
			return `Rolled ${result.roll} — a failure.`
	}
}

/** A plain, unmodified d20. `random` is injected the same way `randomDie` is, so tests get a fixed die. */
export function rollDeathSaveDie(random: () => number = Math.random): number {
	return Math.floor(random() * 20) + 1
}

/**
 * The single rule that death-save progress exists ONLY while the character is at
 * exactly 0 current hit points (D111). Any write that leaves the current above 0
 * — a heal through the damage panel, direct entry, a level up — drops the
 * progress, and there is no leftover state to come back to. Used by the store,
 * so no caller can store an impossible pair, and by the header, so the value it
 * hands over already reads true. All-zero counts are "none", written as absence.
 */
export function deathSavesAfterHitPointChange(
	currentHp: number | undefined,
	deathSaves: DeathSaveProgress | undefined,
): DeathSaveProgress | undefined {
	if (currentHp !== 0 || deathSaves === undefined) return undefined
	if (deathSaves.successes <= 0 && deathSaves.failures <= 0) return undefined
	return { successes: capped(deathSaves.successes), failures: capped(deathSaves.failures) }
}
