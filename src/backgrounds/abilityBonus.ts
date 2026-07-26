/*
 * Background ability bonus rules (PHASE1.md section A.3 / build order
 * step 3, background slice). Pure rules only — no React, no persistence.
 *
 * After picking a background, the player distributes its ability bonus
 * among the three abilities that background offers: either +2 to one and
 * +1 to a different one, or +1 to all three. This module only validates
 * that choice against the offered trio; it does NOT apply the bonus to
 * raw ability scores — combining them is a derived value (build order
 * step 4).
 */

import type { Ability } from '../abilities/abilityScores'

export type AbilityBonusChoice =
	| { kind: 'twoOne'; plusTwo: Ability; plusOne: Ability }
	| { kind: 'oneEach' }

/**
 * True if `choice` is a legal distribution of a background's ability
 * bonus given the three abilities it offers: +2/+1 must land on two
 * DIFFERENT abilities from `offered`, and +1/+1/+1 always covers exactly
 * the offered trio. Nothing outside `offered` is ever valid.
 */
export function isValidAbilityBonusChoice(choice: AbilityBonusChoice, offered: readonly Ability[]): boolean {
	if (choice.kind === 'oneEach') return true
	if (choice.plusTwo === choice.plusOne) return false
	return offered.includes(choice.plusTwo) && offered.includes(choice.plusOne)
}

/** Converts a validated choice into the wire-format mapping (ability -> bonus amount) that gets persisted. */
export function abilityBonusChoiceToMap(choice: AbilityBonusChoice, offered: readonly Ability[]): Partial<Record<Ability, number>> {
	if (choice.kind === 'oneEach') {
		return Object.fromEntries(offered.map((ability) => [ability, 1]))
	}
	return { [choice.plusTwo]: 2, [choice.plusOne]: 1 }
}
