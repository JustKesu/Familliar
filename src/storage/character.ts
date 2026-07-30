/*
 * Placeholder character shape (PHASE1.md build order step 2).
 *
 * id, name, classes and (as of the ability scores slice) abilityScores
 * exist at this point. The real model (species, background, HP, ...)
 * arrives with the rest of character creation. Do not add fields here for
 * later steps.
 */

import type { Ability, CharacterAbilityScores } from '../abilities/abilityScores'

export interface CharacterClass {
	className: string
	classSource: string
	subclass: string | null
	level: number
}

/** Identifies a species.json entry unambiguously — enough to look it back up later. */
export interface CharacterSpecies {
	name: string
	source: string
}

/** Identifies a backgrounds.json entry unambiguously — enough to look it back up later. */
export interface CharacterBackground {
	name: string
	source: string
	/**
	 * The background's two fixed skill proficiencies (BackgroundEntry.skillProficiencies),
	 * stored here rather than re-derived from backgrounds.json — the class step already
	 * needs them to disable the same two skills (D18), and the sheet/calculation layer
	 * will need them too.
	 */
	skillProficiencies: [string, string]
	/**
	 * The background's tool proficiency (BackgroundEntry.toolProficiency) —
	 * the named tool it grants outright, or the specific tool the player
	 * chose from its category. Always exactly one tool: every background's
	 * toolProficiencies entry offers exactly 1 (confirmed against all 33 in
	 * scripts/investigate-tool-proficiencies.js).
	 */
	toolProficiency: string
}

/**
 * Where a known language came from — mirrors section B's "source of each
 * proficiency" idea for skills (class / background / species / feat),
 * applied to languages so overlaps and automatic grants are visible
 * instead of a bare list of names.
 *
 * Only 'automatic' (the PHB 2024 Common rule) and 'creation' (the player's
 * two picks) exist yet. Class-feature grants (Rogue's Thieves' Cant plus
 * one, Druid's Druidic, Ranger's Deft Explorer) and feat grants are NOT
 * built — the wizard doesn't select class features at this slice. When
 * they arrive, add new members here (e.g. 'class-feature', 'feat') rather
 * than reworking this type.
 */
export type LanguageGrantSource = 'automatic' | 'creation'

/** Identifies a languages.json entry unambiguously, plus how the character came to know it. */
export interface CharacterLanguage {
	name: string
	source: string
	grantedBy: LanguageGrantSource
}

/**
 * The player's chosen distribution of a background's ability bonus
 * (PHASE1.md A.3): either +2 to one ability and +1 to another, or +1 to
 * each of the three the background offers. Stored as a plain mapping
 * rather than as a discriminated choice — this is the derived amount to
 * apply per ability, not which UI path produced it.
 */
export type AbilityBonusMap = Partial<Record<Ability, number>>

export interface Character {
	id: string
	name: string
	classes: CharacterClass[]
	/**
	 * Optional so characters saved before this field existed still load
	 * (PHASE1.md section D — additive fields must not break old saves).
	 */
	abilityScores?: CharacterAbilityScores
	/**
	 * Optional for the same reason as abilityScores above.
	 */
	species?: CharacterSpecies
	/**
	 * Optional for the same reason as abilityScores above.
	 */
	background?: CharacterBackground
	/**
	 * Optional for the same reason as abilityScores above. Present whenever
	 * `background` is, but kept as its own field rather than nested inside
	 * `background` since it's a player choice, not part of the background's
	 * identity.
	 */
	abilityBonus?: AbilityBonusMap
	/**
	 * Optional for the same reason as abilityScores above. Every language the
	 * character knows, INCLUDING Common — unlike the earlier shape, Common is
	 * stored explicitly (with `grantedBy: 'automatic'`) rather than assumed,
	 * since a stored language without a recorded source is exactly what this
	 * field's `grantedBy` fixes. Feature-granted languages (Thieves' Cant,
	 * Druidic, ...) are not represented yet — see LanguageGrantSource.
	 */
	languages?: CharacterLanguage[]
	/**
	 * Optional for the same reason as abilityScores above. The class step's
	 * own skill picks — distinct from background.skillProficiencies, the
	 * background's fixed pair.
	 */
	classSkills?: string[]
	/**
	 * Optional for the same reason as abilityScores above. The species' own
	 * skill proficiencies — both the fixed skill(s) some species grant
	 * outright and the ones the player chose from that species' list.
	 * Distinct from classSkills and background.skillProficiencies so the
	 * sheet can show "species" as the source (SPEC section B).
	 */
	speciesSkills?: string[]
	/**
	 * Optional for the same reason as abilityScores above. The skills named
	 * as Expertise (doubled proficiency bonus) — a subset of classSkills,
	 * speciesSkills or background.skillProficiencies, never a skill the
	 * character isn't otherwise proficient in.
	 */
	expertiseSkills?: string[]
	/**
	 * Optional for the same reason as abilityScores above.
	 */
	masteries?: string[]
	/**
	 * Optional for the same reason as abilityScores above.
	 */
	fightingStyle?: string | null
	/**
	 * Optional for the same reason as abilityScores above. A subclass's own
	 * optionalfeatureProgression picks (D21) — Battle Master maneuvers, Rune
	 * Knight runes, Arcane Archer shots, College of Swords fighting styles.
	 * An array, not a bare list of names, since a character could in
	 * principle have picks from more than one progression at once; each
	 * entry's featureType says which progression its choices belong to.
	 */
	optionalFeatureChoices?: CharacterOptionalFeatureChoice[]
	/**
	 * Optional for the same reason as abilityScores above. One entry per
	 * character level that grants an ASI-or-feat choice (D16/D19/D20) —
	 * effects are NOT applied to any calculation yet (deferred to the next
	 * slice); this is selection and storage only.
	 */
	featAsiChoices?: FeatAsiChoice[]
}

/** One subclass optionalfeatureProgression's picks, tagged with which progression (featureType code) they belong to. */
export interface CharacterOptionalFeatureChoice {
	featureType: string
	choices: string[]
}

/**
 * The +2-to-one-ability or +1-to-two-abilities distribution for an Ability
 * Score Improvement pick (D20). Never more than 2 keys, values always 1 or 2.
 */
export type AbilityIncreaseMap = Partial<Record<Ability, number>>

/**
 * One level-4/8/12/16/19(+class bonus levels)-and-up choice between an
 * Ability Score Improvement and a feat (build order step 4a, D16/D19/D20).
 * `level` is the character level the choice was taken at — this doubles as
 * the D22 provenance the sheet will need, so no separate field for it.
 */
export type FeatAsiChoice =
	| { level: number; kind: 'asi'; increases: AbilityIncreaseMap }
	| { level: number; kind: 'feat'; name: string; source: string }

/**
 * Schema version for the persisted/exported character wire format
 * (see wireFormat.ts). Bumped to 8 to add featAsiChoices — the feat/ASI
 * wizard step. Per PHASE1.md section D, and per docs/QUESTIONS.md "Migrace
 * uložených postav", a version bump this app does not understand is
 * rejected outright (UnknownSchemaVersionError) rather than guessed at —
 * no migration from version 7 is written, so a character saved before this
 * change will no longer load and must be recreated.
 */
export const CURRENT_SCHEMA_VERSION = 8
