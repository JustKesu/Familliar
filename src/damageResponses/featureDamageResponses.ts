/*
 * D70 hand table: the damage responses a class or subclass feature grants.
 *
 * class-features.json and subclass-features.json carry NO structured field for
 * this — not `resist`, not `immune`, not anything (this slice's survey,
 * scripts/investigate-damage-responses.js, found zero matching keys across all
 * 302 class features and all 786 subclass features). Every one of them states
 * it in a sentence, and D21 does not parse prose, so the ones below are
 * transcribed by hand with the feature's own words quoted beside them.
 *
 * SCOPE, settled with Daniel this session: Rage plus the grants that apply
 * UNCONDITIONALLY. The survey found 35 prose entries; these 13 are the ones
 * that are unambiguous. Four groups are deliberately left out, because
 * transcribing them would state something the app cannot stand behind:
 *
 *  - The damage type depends on a choice nothing stores — Storm Herald's
 *    Desert/Sea/Tundra (aura environment), The Genie's Elemental Gift (patron
 *    kind), Four Elements' Elemental Epitome, Circle of the Land's Nature's
 *    Ward (a land-type table). Listing all of a feature's branches would claim
 *    resistances the character does not have.
 *  - The text describes an OBJECT's immunity, not the character's — Eldritch
 *    Cannon, Genie's Vessel, and the 11 items whose prose is a summoned
 *    object's statblock.
 *  - Conditional ones other than Rage — Superior Defense, Umbral Form, Full of
 *    Stars, Aura of Warding, Rage of the Wilds, Rage of the Gods, Boon of the
 *    Night Spirit. Step 9 owns conditions; Rage is here because SPEC names it.
 *  - Rules that IGNORE resistance rather than grant it — Poisoner, Envenom
 *    Weapons, Magic Arrow, Boon of Irresistible Offense.
 *
 * Matched by feature NAME against the names the character has actually reached
 * (src/sheet/weaponAttackData.ts's featureNamesFor), the same way
 * src/attacks/extraAttackData.ts matches Extra Attack.
 */

import type { DamageResponseKind } from '../calculation/damageResponses'

export interface FeatureDamageResponse {
	/** Exactly as class-features.json / subclass-features.json spell it. */
	feature: string
	/** Shown beside the feature name so the sheet says where it came from. */
	origin: string
	kind: DamageResponseKind
	damageTypes: string[]
	/** Set only for a response the app cannot see the state of; shown, never counted (D76). */
	condition?: string
	/** The feature's own sentence, PHB 2024 — the authority for the row above it. */
	quote: string
}

export const FEATURE_DAMAGE_RESPONSES: readonly FeatureDamageResponse[] = [
	{
		feature: 'Rage',
		origin: 'Barbarian',
		kind: 'resistance',
		damageTypes: ['bludgeoning', 'piercing', 'slashing'],
		condition: 'while your Rage is active',
		quote: 'Damage Resistance. You have Resistance to Bludgeoning, Piercing, and Slashing damage.',
	},
	{
		feature: 'Chemical Mastery',
		origin: 'Artificer (Alchemist)',
		kind: 'resistance',
		damageTypes: ['acid', 'poison'],
		quote: 'Chemical Resistance. You gain Resistance to Acid damage and Poison damage.',
	},
	{
		feature: 'Soul of the Forge',
		origin: 'Cleric (Forge Domain)',
		kind: 'resistance',
		damageTypes: ['fire'],
		quote: 'You gain resistance to fire damage.',
	},
	{
		feature: 'Saint of Forge and Fire',
		origin: 'Cleric (Forge Domain)',
		kind: 'immunity',
		damageTypes: ['fire'],
		quote: 'You gain immunity to fire damage.',
	},
	{
		feature: 'Avatar of Battle',
		origin: 'Cleric (War Domain)',
		kind: 'resistance',
		damageTypes: ['bludgeoning', 'piercing', 'slashing'],
		quote: 'You gain Resistance to Bludgeoning, Piercing, and Slashing damage.',
	},
	{
		feature: 'Stormborn',
		origin: 'Druid (Circle of the Sea)',
		kind: 'resistance',
		damageTypes: ['cold', 'lightning', 'thunder'],
		quote: 'Resistance. You have Resistance to Cold, Lightning, and Thunder damage.',
	},
	{
		feature: 'Guarded Mind',
		origin: 'Fighter (Psi Warrior)',
		kind: 'resistance',
		damageTypes: ['psychic'],
		quote: 'You have Resistance to Psychic damage.',
	},
	{
		feature: 'Psychic Defenses',
		origin: 'Sorcerer (Aberrant Mind)',
		kind: 'resistance',
		damageTypes: ['psychic'],
		quote: 'You have Resistance to Psychic damage, and you have Advantage on saving throws to avoid or end the Charmed or Frightened condition.',
	},
	{
		feature: 'Heart of the Storm',
		origin: 'Sorcerer (Storm Sorcery)',
		kind: 'resistance',
		damageTypes: ['lightning', 'thunder'],
		quote: 'You gain resistance to lightning and thunder damage.',
	},
	{
		feature: 'Wind Soul',
		origin: 'Sorcerer (Storm Sorcery)',
		kind: 'immunity',
		damageTypes: ['lightning', 'thunder'],
		quote: 'You gain immunity to lightning and thunder damage.',
	},
	{
		feature: 'Oceanic Soul',
		origin: 'Warlock (The Fathomless)',
		kind: 'resistance',
		damageTypes: ['cold'],
		quote: 'You gain resistance to cold damage.',
	},
	{
		feature: 'Radiant Soul',
		origin: 'Warlock (The Celestial)',
		kind: 'resistance',
		damageTypes: ['radiant'],
		quote: 'You have Resistance to Radiant damage.',
	},
	{
		feature: 'Thought Shield',
		origin: 'Warlock (Great Old One)',
		kind: 'resistance',
		damageTypes: ['psychic'],
		quote: 'You also have Resistance to Psychic damage.',
	},
]

/** The table's entries for the feature names a character has reached. A name the table does not record grants nothing — never a guess. */
export function featureDamageResponsesAmong(featureNames: readonly string[]): FeatureDamageResponse[] {
	const reached = new Set(featureNames)
	return FEATURE_DAMAGE_RESPONSES.filter((entry) => reached.has(entry.feature))
}
