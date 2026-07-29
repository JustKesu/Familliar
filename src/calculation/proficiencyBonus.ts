/*
 * Proficiency bonus (build order step 4): derived from TOTAL character
 * level (D11 — iterate the classes array, never assume a single class;
 * also the multiclass rule D11 lists — proficiency bonus comes from total
 * level, not per class).
 */

import type { CharacterClass } from '../storage/character'
import { type Calculated, type Contribution, known, unknown } from './types'

/** 2 at level 1-4, rising by 1 every 4 levels, capping at 6 for level 17-20. */
export function proficiencyBonusForLevel(totalLevel: number): number {
	return 2 + Math.floor((totalLevel - 1) / 4)
}

export function computeProficiencyBonus(classes: CharacterClass[]): Calculated<number> {
	if (classes.length === 0) {
		return unknown('Character has no classes yet.')
	}

	const breakdown: Contribution[] = classes.map((c) => ({ source: c.className, amount: c.level }))
	const totalLevel = breakdown.reduce((sum, contribution) => sum + contribution.amount, 0)
	return known(proficiencyBonusForLevel(totalLevel), breakdown)
}
