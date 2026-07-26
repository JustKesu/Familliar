/*
 * Placeholder character shape (PHASE1.md build order step 2).
 *
 * Only id, name and the multiclass `classes` array exist at this point.
 * The real model (species, background, abilities, HP, ...) arrives with
 * character creation (step 3). Do not add fields here for later steps.
 */

export interface CharacterClass {
	className: string
	classSource: string
	subclass: string | null
	level: number
}

export interface Character {
	id: string
	name: string
	classes: CharacterClass[]
}

/**
 * Schema version for the persisted/exported character wire format
 * (see wireFormat.ts). Bump this — and add a migration — whenever the
 * stored shape changes.
 */
export const CURRENT_SCHEMA_VERSION = 1
