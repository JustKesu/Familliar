/*
 * Typed loader for the `additionalSpells.ability` slice of species.json (D89
 * follow-up). Mirrors speciesSkillData.ts: same one-species direct lookup,
 * same "null means nothing to choose" convention — fed to the species step's
 * own ability picker (CharacterWizard.tsx), the way speciesSkillData.ts feeds
 * SpeciesSkillPicker.
 *
 * raceSpells.ts's module comment already confirmed the shape: 33 of the 34
 * `additionalSpells`-carrying species entries carry `{"choose":["int","wis","cha"]}`,
 * only Aasimar (XPHB) is fixed ("cha"). This module returns the choose list
 * when present, null for a fixed ability, no additionalSpells at all, or the
 * unresolved family-base multi-option shape (a `name`-tagged entry) — D81/D82/
 * D84 guarantee a character's stored species is never that shape, so a
 * transient lookup against one (mid-wizard, before a lineage is picked) reads
 * as "nothing to choose yet" rather than throwing.
 */

import type { AbilityAbbreviation } from '../calculation/abilityAbbreviations'
import { loadDataFile } from '../dataLoader/dataLoader'

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const FIXED_ABILITIES: readonly AbilityAbbreviation[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

function isAbilityAbbreviation(value: unknown): value is AbilityAbbreviation {
	return typeof value === 'string' && (FIXED_ABILITIES as readonly string[]).includes(value)
}

interface RawSpeciesEntry {
	name: string
	source: string
	additionalSpells?: unknown
}

function isRawSpeciesEntry(value: unknown): value is RawSpeciesEntry {
	return isRecord(value) && typeof value['name'] === 'string' && typeof value['source'] === 'string'
}

/**
 * Pure filter (D38). The ability choices (e.g. `['int','wis','cha']`) one
 * species entry's `additionalSpells` offers, or null when there is nothing to
 * choose — no `additionalSpells` at all, a fixed ability, or the unresolved
 * family-base shape (module comment). Throws if the species itself isn't in
 * the data, matching extractSpeciesSkillProficiencies's convention.
 */
export function extractSpeciesSpellcastingAbilityChoice(parsed: unknown, speciesName: string, speciesSource: string): AbilityAbbreviation[] | null {
	if (!Array.isArray(parsed)) {
		throw new Error('species.json: expected a top-level array.')
	}
	const entry = parsed.find((candidate): candidate is RawSpeciesEntry => isRawSpeciesEntry(candidate) && candidate.name === speciesName && candidate.source === speciesSource)
	if (!entry) {
		throw new Error(`species.json: no species entry for "${speciesName}" (${speciesSource})`)
	}
	if (!Array.isArray(entry.additionalSpells)) return null

	for (const node of entry.additionalSpells) {
		if (!isRecord(node)) continue
		if (typeof node['name'] === 'string') continue // the unresolved family-base shape — never the stored species (D81), skip rather than guess.
		const abilityField = node['ability']
		if (isRecord(abilityField) && Array.isArray(abilityField['choose'])) {
			const choices = abilityField['choose'].filter(isAbilityAbbreviation)
			if (choices.length > 0) return choices
		}
	}
	return null
}

/** Fetches species.json and returns the named species' spellcasting-ability choices, if any. */
export async function loadSpeciesSpellcastingAbilityChoice(speciesName: string, speciesSource: string): Promise<AbilityAbbreviation[] | null> {
	const parsed = await loadDataFile('data/species.json')
	return extractSpeciesSpellcastingAbilityChoice(parsed, speciesName, speciesSource)
}
