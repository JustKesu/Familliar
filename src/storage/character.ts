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
	 * Optional for the same reason as abilityScores above.
	 */
	masteries?: string[]
	/**
	 * Optional for the same reason as abilityScores above.
	 */
	fightingStyle?: string | null
}

/**
 * Schema version for the persisted/exported character wire format
 * (see wireFormat.ts). Bumped to 3 to persist the class step's own
 * choices — classSkills, masteries, fightingStyle, and (via
 * CharacterClass.subclass, already present but previously always saved
 * as null) subclass — plus the background's two fixed skill
 * proficiencies. Per PHASE1.md section D, a version bump this app does
 * not understand is rejected outright (UnknownSchemaVersionError) rather
 * than guessed at — no migration from version 2 is written, so a
 * character saved before this change will no longer load and must be
 * recreated.
 */
export const CURRENT_SCHEMA_VERSION = 3
