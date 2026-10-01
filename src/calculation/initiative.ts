/*
 * Initiative (build order step 4/4a): DEX modifier, plus the Proficiency Bonus
 * when the character has Alert (F-5, from any origin), plus item bonuses.
 */

import type { Character } from '../storage/character'
import { computeAbilityScore } from './abilityScores'
import type { FeatEffectEntry } from './featEffects'
import { characterFeats } from './featEffects'
import type { ItemAbilityGrant } from './itemAbilityScores'
import { computeProficiencyBonus } from './proficiencyBonus'
import { type Calculated, type Contribution, known, unknown } from './types'

/** XPHB Alert: "When you roll Initiative, you can add your Proficiency Bonus to the roll." feats.json has no other Alert (DATA.md). */
function alertInitiative(character: Character, feats: readonly FeatEffectEntry[]): Contribution[] {
	if (!characterFeats(character, feats).some((feat) => feat.name === 'Alert' && feat.source === 'XPHB')) return []
	const bonus = computeProficiencyBonus(character.classes)
	return [bonus.status === 'known' ? { source: 'feat (Alert)', amount: bonus.value } : { source: 'feat (Alert)', amount: 0, note: `Proficiency Bonus not known: ${bonus.reason}` }]
}

/** `itemBonuses`: a custom item's initiative bonus (R14a1), each its own line. */
export function computeInitiative(
	character: Character,
	feats: FeatEffectEntry[] = [],
	itemBonuses: Contribution[] = [],
	itemAbilityGrants: readonly ItemAbilityGrant[] = [],
): Calculated<number> {
	const dexterity = computeAbilityScore('dexterity', character, feats, itemAbilityGrants)
	if (dexterity.status === 'unknown') return unknown(dexterity.reason)

	const breakdown: Contribution[] = [{ source: 'dexterity modifier', amount: dexterity.value.modifier }, ...alertInitiative(character, feats), ...itemBonuses]
	const total = breakdown.reduce((sum, contribution) => sum + contribution.amount, 0)
	return known(total, breakdown)
}
