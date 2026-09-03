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
 *
 * D81/D82: the 35 variant records are NOT separate species. Eight of them are
 * families whose variant is a choice the 2024 rules put inside the species
 * (Elven Lineage, Draconic Ancestry, Fiendish Legacy, ...), so
 * `extractSpeciesOptions` collapses each family to its parent and hangs the
 * variants off it as that species' own choice. Confirmed against species.json
 * (scripts/investigate-species-families.js): 8 families, 35 variants, linked
 * three ways — "Elf; Drow Lineage" and "Dragonborn (Black)" by name prefix,
 * "Air" by raceName/raceSource.
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
	entries?: unknown
}

/** One variant inside a species family — stored under its own `name`, shown under the book's name for the option ("Drow", "Cloud Giant", "Air"). */
export interface SpeciesVariant {
	name: string
	source: string
	optionName: string
}

/** One entry in the species list: a species, plus the choice the book puts inside it (D81). `variants` is empty for a species that has none. */
export interface SpeciesOption {
	name: string
	source: string
	displayName: string
	/** The book's own name for the choice ("Elven Lineage") — non-null exactly when `variants` is non-empty. */
	choiceLabel: string | null
	variants: SpeciesVariant[]
}

/** Used when the parent record carries no heading naming every variant — true only of Genasi, whose MPMM entry has just Size and Darkvision. */
const FALLBACK_CHOICE_LABEL = 'Lineage'

function isRawSpeciesEntry(value: unknown): value is RawSpeciesEntry {
	if (typeof value !== 'object' || value === null) return false
	const entry = value as Record<string, unknown>
	if (typeof entry.name !== 'string' || typeof entry.source !== 'string') return false
	if (entry.raceName !== undefined && typeof entry.raceName !== 'string') return false
	if (entry.raceSource !== undefined && typeof entry.raceSource !== 'string') return false
	return true
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

/**
 * The name a variant record hangs under, or null if it is not a variant of
 * `parent`. Three linkages occur (see module doc): the raceName/raceSource
 * field, and two name prefixes — "Elf; Drow Lineage" and "Dragonborn (Black)".
 */
function variantSuffixOf(entry: RawSpeciesEntry, parent: RawSpeciesEntry): string | null {
	if (entry.raceName !== undefined || entry.raceSource !== undefined) {
		return entry.raceName === parent.name && entry.raceSource === parent.source ? entry.name : null
	}
	if (entry.source !== parent.source) return null
	if (entry.name.startsWith(`${parent.name}; `)) return entry.name.slice(parent.name.length + 2)
	if (entry.name.startsWith(`${parent.name} (`) && entry.name.endsWith(')')) {
		return entry.name.slice(parent.name.length + 2, -1)
	}
	return null
}

/**
 * Drops one trailing word shared by every variant in the family, so the
 * options read as the book names them: "Drow Lineage" -> "Drow", "Cloud Giant
 * Ancestry" -> "Cloud Giant". Families whose variants share no trailing word
 * (Kobold's Craftiness/Defiance, Dragonborn's colours) are left alone.
 */
function optionNamesFrom(suffixes: string[]): string[] {
	if (suffixes.length < 2) return suffixes
	const tails = new Set(suffixes.map((suffix) => suffix.split(' ').at(-1)))
	if (tails.size !== 1) return suffixes
	const stripped = suffixes.map((suffix) => suffix.split(' ').slice(0, -1).join(' '))
	return stripped.every((name) => name.length > 0) ? stripped : suffixes
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * The book's own name for a family's choice, read off the parent's traits:
 * the one named entry whose text names every option ("Elven Lineage" lists
 * Drow/High Elf/Wood Elf). Verified to resolve uniquely for 7 of the 8
 * families (scripts/investigate-species-families.js); anything ambiguous or
 * absent falls back rather than guessing.
 */
function choiceLabelFor(parent: RawSpeciesEntry, optionNames: string[]): string {
	const named = (Array.isArray(parent.entries) ? parent.entries : [])
		.filter(isRecord)
		.filter((entry) => typeof entry['name'] === 'string')
	const matching = named.filter((entry) => {
		const text = JSON.stringify(entry)
		return optionNames.every((option) => text.includes(option))
	})
	return matching.length === 1 ? (matching[0]['name'] as string) : FALLBACK_CHOICE_LABEL
}

/**
 * The species list the player picks from (D81): one entry per species, with
 * each family's variants carried as that species' own choice rather than
 * standing beside it as 35 extra species. A variant whose parent is not itself
 * selectable stays a top-level entry under its own full name.
 */
export function extractSpeciesOptions(parsed: unknown): SpeciesOption[] {
	if (!Array.isArray(parsed)) {
		throw new Error('species.json: expected a top-level array.')
	}
	const selectable = parsed.filter((entry): entry is RawSpeciesEntry => isRawSpeciesEntry(entry) && entry.reprintedAs === undefined)

	const variantsOf = new Map<RawSpeciesEntry, { entry: RawSpeciesEntry; suffix: string }[]>()
	const claimed = new Set<RawSpeciesEntry>()
	for (const entry of selectable) {
		for (const parent of selectable) {
			if (parent === entry) continue
			const suffix = variantSuffixOf(entry, parent)
			if (suffix === null) continue
			if (!variantsOf.has(parent)) variantsOf.set(parent, [])
			variantsOf.get(parent)!.push({ entry, suffix })
			claimed.add(entry)
			break
		}
	}

	const options: SpeciesOption[] = []
	for (const entry of selectable) {
		if (claimed.has(entry)) continue
		const found = variantsOf.get(entry) ?? []
		const optionNames = optionNamesFrom(found.map((variant) => variant.suffix))
		options.push({
			name: entry.name,
			source: entry.source,
			displayName: speciesDisplayName(entry),
			choiceLabel: found.length > 0 ? choiceLabelFor(entry, optionNames) : null,
			variants: found.map((variant, index) => ({
				name: variant.entry.name,
				source: variant.entry.source,
				optionName: optionNames[index],
			})),
		})
	}
	return options.sort((a, b) => a.displayName.localeCompare(b.displayName))
}

/** Where a stored `{ name, source }` sits in the list — the species, and the variant if one was chosen. Null when the stored species is not in the data at all. */
export function findSpeciesSelection(
	options: SpeciesOption[],
	choice: { name: string; source: string } | null,
): { option: SpeciesOption; variant: SpeciesVariant | null } | null {
	if (choice === null) return null
	for (const option of options) {
		if (option.name === choice.name && option.source === choice.source) return { option, variant: null }
		const variant = option.variants.find((candidate) => candidate.name === choice.name && candidate.source === choice.source)
		if (variant) return { option, variant }
	}
	return null
}

/** Fetches species.json and returns the species list, sorted by display name. */
export async function loadSpeciesOptions(): Promise<SpeciesOption[]> {
	return extractSpeciesOptions(await loadDataFile('data/species.json'))
}
