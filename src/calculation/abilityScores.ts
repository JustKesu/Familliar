/*
 * Final ability scores and modifiers (build order step 4, D17): the sum
 * that D17 says belongs here first — raw ability score plus the
 * background bonus — computed once so saving throws, initiative and
 * everything later calls this instead of re-deriving it.
 */

import { ABILITIES, type Ability } from '../abilities/abilityScores'
import type { Character } from '../storage/character'
import { type Calculated, type Contribution, known, unknown } from './types'

export interface AbilityScoreValue {
	score: number
	modifier: number
}

export function abilityModifier(score: number): number {
	return Math.floor((score - 10) / 2)
}

/**
 * D42 — the final value is a list of contributions (base, background bonus
 * today; ASI and feats later), not a sum of two numbers. A zero/absent
 * background bonus is left out of the list entirely — its absence is the
 * signal that no bonus applies.
 */
export function computeAbilityScore(ability: Ability, character: Character): Calculated<AbilityScoreValue> {
	if (!character.abilityScores) {
		return unknown('Ability scores have not been set for this character yet.')
	}

	const base = character.abilityScores.scores[ability]
	const breakdown: Contribution[] = [{ source: 'base', amount: base }]

	const backgroundBonus = character.abilityBonus?.[ability]
	if (backgroundBonus) {
		breakdown.push({ source: 'background', amount: backgroundBonus })
	}

	const score = breakdown.reduce((sum, contribution) => sum + contribution.amount, 0)
	return known({ score, modifier: abilityModifier(score) }, breakdown)
}

export function computeAbilityScores(character: Character): Record<Ability, Calculated<AbilityScoreValue>> {
	return Object.fromEntries(ABILITIES.map((ability) => [ability, computeAbilityScore(ability, character)])) as Record<
		Ability,
		Calculated<AbilityScoreValue>
	>
}
