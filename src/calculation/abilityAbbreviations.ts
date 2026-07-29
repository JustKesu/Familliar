/*
 * classes.json's "proficiency" field (saving throws a class grants) uses
 * lowercase 3-letter ability codes (scripts/investigate-saving-throws.js
 * confirms this shape across all 13 base classes), not the full ability
 * names used elsewhere in this app (src/abilities/abilityScores.ts).
 */

import type { Ability } from '../abilities/abilityScores'

export type AbilityAbbreviation = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'

export const ABILITY_ABBREVIATIONS: Record<Ability, AbilityAbbreviation> = {
	strength: 'str',
	dexterity: 'dex',
	constitution: 'con',
	intelligence: 'int',
	wisdom: 'wis',
	charisma: 'cha',
}
