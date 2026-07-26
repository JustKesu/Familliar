/*
 * Placeholder character shape (PHASE1.md build order step 2).
 *
 * id, name, classes and (as of the ability scores slice) abilityScores
 * exist at this point. The real model (species, background, HP, ...)
 * arrives with the rest of character creation. Do not add fields here for
 * later steps.
 */

import type { CharacterAbilityScores } from '../abilities/abilityScores'

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
}

/**
 * Schema version for the persisted/exported character wire format
 * (see wireFormat.ts). Bump this — and add a migration — whenever the
 * stored shape changes.
 */
export const CURRENT_SCHEMA_VERSION = 1
