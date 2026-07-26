/*
 * Ability score rules (PHASE1.md build order step 3, ability scores slice).
 *
 * Pure rules only — no React, no persistence. Deliberately does NOT apply
 * the background ability bonus (+2/+1 or +1/+1/+1): that depends on a
 * background, which does not exist yet as a build order step. These are
 * the raw scores only. Ability MODIFIERS are also out of scope — deriving
 * values from scores is build order step 4.
 */

export const ABILITIES = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const

export type Ability = (typeof ABILITIES)[number]

export type AbilityScores = Record<Ability, number>

export type AbilityScoreMethod = 'standardArray' | 'pointBuy' | 'roll'

/** The standard array, PHB 2024: fixed values assigned to the six abilities. */
export const STANDARD_ARRAY: readonly number[] = [15, 14, 13, 12, 10, 8]

/** True if `scores` uses every standard array value exactly once (in any assignment to abilities). */
export function usesStandardArrayExactly(scores: AbilityScores): boolean {
	const assigned = ABILITIES.map((ability) => scores[ability]).sort((a, b) => a - b)
	const expected = [...STANDARD_ARRAY].sort((a, b) => a - b)
	return assigned.length === expected.length && assigned.every((value, i) => value === expected[i])
}

export const POINT_BUY_BUDGET = 27
export const POINT_BUY_MIN = 8
export const POINT_BUY_MAX = 15

/**
 * Cumulative point-buy cost of raising a score from 8 to the given value.
 * 8-13 cost 1 point per step; 14 and 15 cost 2 points each (PHASE1.md A.3).
 */
const POINT_BUY_COST_TABLE: Record<number, number> = {
	8: 0,
	9: 1,
	10: 2,
	11: 3,
	12: 4,
	13: 5,
	14: 7,
	15: 9,
}

/** The point-buy cost of a single score, 8-15. Throws for anything outside that range. */
export function pointBuyCost(score: number): number {
	const cost = POINT_BUY_COST_TABLE[score]
	if (cost === undefined) {
		throw new RangeError(`Point buy scores must be between ${POINT_BUY_MIN} and ${POINT_BUY_MAX}, got ${score}.`)
	}
	return cost
}

/** Total points spent across all six ability scores. */
export function pointBuyTotal(scores: AbilityScores): number {
	return ABILITIES.reduce((sum, ability) => sum + pointBuyCost(scores[ability]), 0)
}

export interface RolledSet {
	/** The four dice as rolled, in roll order. */
	dice: [number, number, number, number]
	/** Sum of the highest three of the four dice. */
	total: number
}

/** A single 4d6-drop-lowest roll. `rollDie` is injectable so results are deterministic in tests. */
export function rollAbilityScore(rollDie: () => number): RolledSet {
	const dice: [number, number, number, number] = [rollDie(), rollDie(), rollDie(), rollDie()]
	const sorted = [...dice].sort((a, b) => a - b)
	const total = sorted[1] + sorted[2] + sorted[3]
	return { dice, total }
}

/** Six 4d6-drop-lowest rolls, one per ability score. */
export function rollSixAbilityScores(rollDie: () => number): RolledSet[] {
	return Array.from({ length: 6 }, () => rollAbilityScore(rollDie))
}

/** Default die: a uniformly random integer 1-6. */
export function randomDie(): number {
	return Math.floor(Math.random() * 6) + 1
}

/**
 * The ability scores as stored on a character: which method produced them,
 * and — for the roll method, when the app did the rolling rather than the
 * player typing in physical-dice results — the individual rolled sets, so a
 * rolled value never silently changes on reload (same reasoning as HP,
 * PHASE1.md A.5).
 */
export interface CharacterAbilityScores {
	method: AbilityScoreMethod
	scores: AbilityScores
	rolledSets?: RolledSet[]
}
