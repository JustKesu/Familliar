/*
 * The names of the character's species traits (build order step 8, slice 8a).
 *
 * The max-HP bonus table (src/calculation/maxHitPoints.ts) decides whether a
 * character has one of its three features STRUCTURALLY, by feature name. Two of
 * the three already have a name list on the sheet — the D87 granted class and
 * subclass features, and the taken feats — but the third, Dwarven Toughness, is
 * a species trait, and nothing was reading those names. This is that list.
 *
 * A species trait is a named element of the species entry's own top-level
 * `entries` (316 of 317 such elements carry a string name;
 * scripts/investigate-hp-bonus-names.js). Deliberately no Genasi-style parent
 * fallback, unlike speciesTraits.ts's speed/size/darkvision: a subrace entry
 * carries its own trait list, and inheriting the parent's names would claim
 * traits nothing has confirmed the subrace grants.
 */

import { loadDataFile } from '../dataLoader/dataLoader'
import type { Character } from '../storage/character'

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export interface SpeciesTrait {
	name: string
	/** The trait's own text — what the Features tab's Species Traits group shows (D184). */
	entries: unknown[]
}

/** Pure (D38). An unknown species, or one with no named traits, yields an empty list — never a throw, since a missing trait only means a bonus is not applied (D43). */
export function speciesTraitsFrom(character: Character, parsedSpecies: unknown): SpeciesTrait[] {
	if (!character.species) return []
	if (!Array.isArray(parsedSpecies)) throw new Error('species.json: expected a top-level array.')

	const entry = parsedSpecies.find((candidate) => isRecord(candidate) && candidate['name'] === character.species?.name && candidate['source'] === character.species?.source)
	if (!isRecord(entry)) return []

	const entries = entry['entries']
	if (!Array.isArray(entries)) return []
	return entries
		.filter((child): child is Record<string, unknown> => isRecord(child) && typeof child['name'] === 'string')
		.map((child) => ({ name: child['name'] as string, entries: Array.isArray(child['entries']) ? child['entries'] : [] }))
}

export function speciesTraitNamesFrom(character: Character, parsedSpecies: unknown): string[] {
	return speciesTraitsFrom(character, parsedSpecies).map((trait) => trait.name)
}

/** species.json goes through the shared cache (D39), so this costs nothing beyond the fetch the sheet already makes for damage responses. */
export async function loadSpeciesTraitNames(character: Character): Promise<string[]> {
	return speciesTraitNamesFrom(character, await loadDataFile('data/species.json'))
}

export async function loadSpeciesTraits(character: Character): Promise<SpeciesTrait[]> {
	return speciesTraitsFrom(character, await loadDataFile('data/species.json'))
}
