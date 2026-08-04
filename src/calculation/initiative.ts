/*
 * Initiative (build order step 4/4a): DEX modifier, plus a D55 note when
 * the character has Alert — a prose feat (no structured field) that gives
 * initiative proficiency, which this app doesn't compute (see
 * featEffects.ts's PROSE_FEAT_EFFECT_TARGETS).
 */

import type { Character } from '../storage/character'
import { computeAbilityScore } from './abilityScores'
import type { FeatEffectEntry } from './featEffects'
import { proseFeatEffectNotes } from './featEffects'
import { type Calculated, type Contribution, known, unknown } from './types'

export function computeInitiative(character: Character, feats: FeatEffectEntry[] = []): Calculated<number> {
	const dexterity = computeAbilityScore('dexterity', character, feats)
	if (dexterity.status === 'unknown') return unknown(dexterity.reason)

	const breakdown: Contribution[] = [
		{ source: 'dexterity modifier', amount: dexterity.value.modifier },
		...proseFeatEffectNotes('initiative', character),
	]
	const total = breakdown.reduce((sum, contribution) => sum + contribution.amount, 0)
	return known(total, breakdown)
}
