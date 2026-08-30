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
 * The chooser's in-progress UI state, lifted out of the picker so a
 * partly-made distribution survives the background step unmounting on
 * navigation (D8). In `twoOne`, `plusTwo`/`plusOne` stay null until the
 * player picks each select. `null` (on BackgroundChoice) means the player
 * has not touched the chooser at all.
 */
export type AbilityBonusDistribution =
	| { mode: 'twoOne'; plusTwo: Ability | null; plusOne: Ability | null }
	| { mode: 'oneEach' }

/** True once `distribution` names a complete, legal distribution of `offered` — the gate for the background step completing. */
export function isAbilityBonusDistributionComplete(
	distribution: AbilityBonusDistribution | null,
	offered: readonly Ability[],
): boolean {
	if (distribution === null) return false
	if (distribution.mode === 'oneEach') return true
	if (distribution.plusTwo === null || distribution.plusOne === null) return false
	return isValidAbilityBonusChoice(
		{ kind: 'twoOne', plusTwo: distribution.plusTwo, plusOne: distribution.plusOne },
		offered,
	)
}

/** The persisted wire map for a COMPLETE distribution; `{}` while it is still incomplete. */
export function abilityBonusDistributionToMap(
	distribution: AbilityBonusDistribution | null,
	offered: readonly Ability[],
): Partial<Record<Ability, number>> {
	if (!isAbilityBonusDistributionComplete(distribution, offered)) return {}
	if (distribution!.mode === 'oneEach') return abilityBonusChoiceToMap({ kind: 'oneEach' }, offered)
	return abilityBonusChoiceToMap(
		{ kind: 'twoOne', plusTwo: distribution!.plusTwo!, plusOne: distribution!.plusOne! },
		offered,
	)
}

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
