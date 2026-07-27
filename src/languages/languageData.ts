/*
 * Typed loader for languages.json (PHASE1.md build order step 3, languages
 * slice: choosing languages during origin). Only the fields this slice
 * needs are typed here — `script` and `dialects` are not, since nothing
 * reads them yet.
 *
 * Settles PHASE1.md section F, "Where does the list of selectable
 * LANGUAGES come from": the list IS data/languages.json, filtered to
 * `type === 'standard'` — only standard languages are selectable at
 * character creation in the 2024 rules, rare languages come from a DM's
 * permission or a feature (not built yet). Common is a standard-type entry
 * in the data but is excluded from the choice list below, since it is
 * granted automatically rather than picked (see CHOSEN_LANGUAGE_COUNT).
 */

/**
 * PHB 2024 rule (book prose, not present anywhere in data/): a character
 * knows Common automatically, plus this many of the player's choice from
 * the standard languages. Hardcoded here so it is one findable place to
 * update once class features start granting additional languages
 * (Rogue's Thieves' Cant plus one, Druid's Druidic, Ranger's Deft
 * Explorer) — out of scope for this slice.
 */
export const CHOSEN_LANGUAGE_COUNT = 2

const COMMON_NAME = 'Common'

/** A selectable language entry, after the standard/rare filter and the Common exclusion. */
export interface LanguageEntry {
	name: string
	source: string
}

interface RawLanguageEntry {
	name: string
	source: string
	type: string
}

function isRawLanguageEntry(value: unknown): value is RawLanguageEntry {
	if (typeof value !== 'object' || value === null) return false
	const entry = value as Record<string, unknown>
	return typeof entry.name === 'string' && typeof entry.source === 'string' && typeof entry.type === 'string'
}

/**
 * Picks the languages a player may choose from out of a parsed
 * languages.json array: standard type only, and never Common, which is
 * granted automatically rather than chosen (see CHOSEN_LANGUAGE_COUNT).
 */
export function extractSelectableLanguages(parsed: unknown): LanguageEntry[] {
	if (!Array.isArray(parsed)) {
		throw new Error('languages.json: expected a top-level array.')
	}

	const languages: LanguageEntry[] = []
	for (const entry of parsed) {
		if (!isRawLanguageEntry(entry)) continue
		if (entry.type !== 'standard') continue
		if (entry.name === COMMON_NAME) continue
		languages.push({ name: entry.name, source: entry.source })
	}
	return languages
}

/** Fetches languages.json and returns the selectable languages, sorted by name. */
export async function loadLanguages(): Promise<LanguageEntry[]> {
	const response = await fetch(`${import.meta.env.BASE_URL}data/languages.json`)
	if (!response.ok) {
		throw new Error(`languages.json — HTTP ${response.status}`)
	}
	const parsed: unknown = await response.json()
	return extractSelectableLanguages(parsed).sort((a, b) => a.name.localeCompare(b.name))
}
