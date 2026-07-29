/*
 * Typed loader for the tool options offered by a background's category
 * choice (e.g. `{"anyArtisansTool": 1}`).
 *
 * Confirmed via scripts/investigate-tool-proficiencies.js against all 33
 * backgrounds and all of items.json:
 *
 * - Three category keys occur: anyArtisansTool, anyMusicalInstrument,
 *   anyGamingSet. Every occurrence's count is 1 (BackgroundEntry.
 *   toolProficiency, backgroundData.ts, already discards the count since
 *   it's always 1).
 * - anyArtisansTool -> items.json type "AT|<source>", 17 items, all
 *   rarity "none". Clean structural filter.
 * - anyGamingSet -> items.json type "GS|<source>", 4 items, all rarity
 *   "none". Clean structural filter.
 * - anyMusicalInstrument -> items.json type "INS" or "INS|<source>", but
 *   this code is shared with 15 MAGIC instruments (Horn of Valhalla,
 *   Instrument of the Bards, Lyre of Building, Rhythm-Maker's Drum, ...).
 *   Filtering by rarity "none" as well as the type code narrows this to
 *   exactly the 10 mundane instruments a background actually offers.
 */

import { loadDataFile } from '../dataLoader/dataLoader'

export type ToolCategory = 'anyArtisansTool' | 'anyMusicalInstrument' | 'anyGamingSet'

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function typeCode(item: Record<string, unknown>): string | null {
	return typeof item['type'] === 'string' ? item['type'].split('|')[0] : null
}

const CATEGORY_FILTERS: Record<ToolCategory, (item: Record<string, unknown>) => boolean> = {
	anyArtisansTool: (item) => typeCode(item) === 'AT',
	anyGamingSet: (item) => typeCode(item) === 'GS',
	anyMusicalInstrument: (item) => typeCode(item) === 'INS' && item['rarity'] === 'none',
}

function isToolCategory(value: string): value is ToolCategory {
	return value in CATEGORY_FILTERS
}

/**
 * Filters a parsed items.json array down to the tool names a background's
 * category choice offers, sorted alphabetically. Throws for a category key
 * not among the three confirmed above, rather than silently returning an
 * empty list.
 */
export function extractToolCategoryOptions(parsedItems: unknown, category: string): string[] {
	if (!Array.isArray(parsedItems)) {
		throw new Error('items.json: expected a top-level array.')
	}
	if (!isToolCategory(category)) {
		throw new Error(`toolProficiencies: unrecognised category "${category}"`)
	}
	const filter = CATEGORY_FILTERS[category]
	const names = parsedItems
		.filter((entry): entry is Record<string, unknown> => isRecord(entry) && typeof entry['name'] === 'string')
		.filter(filter)
		.map((entry) => entry['name'] as string)
	return [...new Set(names)].sort((a, b) => a.localeCompare(b))
}

/** Fetches items.json and returns the tool names offered by the given category key. */
export async function loadToolCategoryOptions(category: string): Promise<string[]> {
	const parsed = await loadDataFile('data/items.json')
	return extractToolCategoryOptions(parsed, category)
}
