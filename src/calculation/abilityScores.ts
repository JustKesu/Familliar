/*
 * Final ability scores and modifiers (build order step 4, D17): the sum
 * that D17 says belongs here first — raw ability score plus the
 * background bonus — computed once so saving throws, initiative and
 * everything later calls this instead of re-deriving it.
 */

import { ABILITIES, type Ability } from '../abilities/abilityScores'
import type { Character } from '../storage/character'
import { featAbilityScoreContributions, type FeatEffectEntry } from './featEffects'
import { type Calculated, type Contribution, known, unknown } from './types'

export interface AbilityScoreValue {
	score: number
	modifier: number
}

export function abilityModifier(score: number): number {
	return Math.floor((score - 10) / 2)
}

/**
 * D42 — the final value is a list of contributions (base, background bonus,
 * ASI picks, feats), not a sum of two numbers. A zero/absent background
 * bonus is left out of the list entirely — its absence is the signal that
 * no bonus applies; the same holds for every ASI/feat contribution
 * (featAbilityScoreContributions only ever returns entries that apply).
 *
 * `feats` is optional (defaults to none) — CharacterWizard.tsx's own draft
 * ability scores (used for THIS SAME wizard step's own feat prerequisite
 * checks) deliberately omit it, per the documented limitation in
 * src/featAsi/featAsiData.ts: a feat/ASI pick made earlier in the same
 * wizard session must not feed back into that session's own prerequisite
 * checks.
 */
export function computeAbilityScore(ability: Ability, character: Character, feats: FeatEffectEntry[] = []): Calculated<AbilityScoreValue> {
	if (!character.abilityScores) {
		return unknown('Ability scores have not been set for this character yet.')
	}

	const base = character.abilityScores.scores[ability]
	const breakdown: Contribution[] = [{ source: 'base', amount: base }]

	const backgroundBonus = character.abilityBonus?.[ability]
	if (backgroundBonus) {
		breakdown.push({ source: 'background', amount: backgroundBonus })
	}

	breakdown.push(...featAbilityScoreContributions(ability, character, feats))

	const score = breakdown.reduce((sum, contribution) => sum + contribution.amount, 0)
	return known({ score, modifier: abilityModifier(score) }, breakdown)
}

export function computeAbilityScores(character: Character, feats: FeatEffectEntry[] = []): Record<Ability, Calculated<AbilityScoreValue>> {
	return Object.fromEntries(ABILITIES.map((ability) => [ability, computeAbilityScore(ability, character, feats)])) as Record<
		Ability,
		Calculated<AbilityScoreValue>
	>
}
