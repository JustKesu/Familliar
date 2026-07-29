/*
 * Typed loader for species.json (PHASE1.md build order step 3, species slice:
 * choosing a species). Only the fields this slice needs are typed here —
 * everything else (traits, speed, darkvision, ...) is added when a later
 * slice (step 4, deriving values) needs it.
 *
 * Two data decisions are settled here, not re-litigated (PHASE1.md section F,
 * NOTES.md "Species scope" / "Species variants come in TWO shapes" / "Nine
 * species names occur twice"):
 *
 * 1. Entries carrying a `reprintedAs` field are the OLDER printing of a
 *    species that was reprinted in a newer allowed book — that field is the
 *    older entry declaring it has been superseded. Only the newer printing
 *    (no `reprintedAs`) is selectable.
 * 2. The four Genasi subraces ("Air", "Earth", "Fire", "Water") name only
 *    themselves — the parent species lives in `raceName`/`raceSource`, not in
 *    `name`. Their DISPLAY name is prefixed with the parent's name, matching
 *    how `_versions` variants already name themselves ("Elf; Drow Lineage").
 *    The stored `name` is never rewritten — this is a display concern only.
 */

import { loadDataFile } from '../dataLoader/dataLoader'

/** A selectable species entry, after the reprintedAs filter. */
export interface SpeciesEntry {
	name: string
	source: string
	/** Present only for the "subrace linkage" shape (Genasi) — see module doc. */
	raceName?: string
	raceSource?: string
}

interface RawSpeciesEntry {
	name: string
	source: string
	raceName?: string
	raceSource?: string
	reprintedAs?: unknown
}

function isRawSpeciesEntry(value: unknown): value is RawSpeciesEntry {
	if (typeof value !== 'object' || value === null) return false
	const entry = value as Record<string, unknown>
	if (typeof entry.name !== 'string' || typeof entry.source !== 'string') return false
	if (entry.raceName !== undefined && typeof entry.raceName !== 'string') return false
	if (entry.raceSource !== undefined && typeof entry.raceSource !== 'string') return false
	return true
}

/**
 * Picks the selectable species out of a parsed species.json array, dropping
 * any entry superseded by a newer printing (decision 1 above). Kept as one
 * obvious filter step so it can be relaxed later if the table ever wants
 * older printings too.
 */
export function extractSelectableSpecies(parsed: unknown): SpeciesEntry[] {
	if (!Array.isArray(parsed)) {
		throw new Error('species.json: expected a top-level array.')
	}

	const species: SpeciesEntry[] = []
	for (const entry of parsed) {
		if (!isRawSpeciesEntry(entry)) continue
		if (entry.reprintedAs !== undefined) continue
		species.push({
			name: entry.name,
			source: entry.source,
			...(entry.raceName !== undefined ? { raceName: entry.raceName } : {}),
			...(entry.raceSource !== undefined ? { raceSource: entry.raceSource } : {}),
		})
	}
	return species
}

/**
 * The name to show the player for a species entry (decision 2 above). Entries
 * with a `raceName` (currently only the four Genasi subraces) are prefixed
 * with their parent's name; every other entry displays its stored `name`
 * unchanged, since `_versions` variants already name themselves fully.
 */
export function speciesDisplayName(entry: SpeciesEntry): string {
	return entry.raceName ? `${entry.raceName}; ${entry.name}` : entry.name
}

/** Fetches species.json and returns the selectable species, sorted by display name. */
export async function loadSpecies(): Promise<SpeciesEntry[]> {
	const parsed = await loadDataFile('data/species.json')
	return extractSelectableSpecies(parsed).sort((a, b) => speciesDisplayName(a).localeCompare(speciesDisplayName(b)))
}
