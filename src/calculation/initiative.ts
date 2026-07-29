/*
 * Initiative (build order step 4): DEX modifier only. Feat Alert doesn't
 * touch it yet — that's build order step 4a, same as saving throws.
 */

import type { Character } from '../storage/character'
import { computeAbilityScore } from './abilityScores'
import { type Calculated, known, unknown } from './types'

export function computeInitiative(character: Character): Calculated<number> {
	const dexterity = computeAbilityScore('dexterity', character)
	if (dexterity.status === 'unknown') return unknown(dexterity.reason)

	return known(dexterity.value.modifier, [{ source: 'dexterity modifier', amount: dexterity.value.modifier }])
}
