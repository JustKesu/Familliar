/*
 * Typed loader for backgrounds.json (PHASE1.md build order step 3,
 * background slice: choosing a background). Only the fields this slice
 * needs are typed here — the full irregular shape is documented in
 * NOTES.md "Background field shapes (XPHB)".
 *
 * Confirmed against all 33 entries before writing this (33 = 17 EFA + 16
 * XPHB, matching NOTES.md's "Output files" count):
 *
 * - `ability` is a 2-element array; each element is
 *   `{ choose: { weighted: { from: [threeAbilities], weights } } }`.
 *   Element [0] always carries weights [2,1] (the +2/+1 spread), element
 *   [1] always carries weights [1,1,1] (the +1 to all three), and both
 *   elements offer the same three abilities. True for all 33 entries.
 * - `feats` is `[{ "name|source": true }]`. The key is lowercase for 32 of
 *   33 backgrounds; Noble alone capitalizes it ("Skilled|xphb") — a known
 *   trap (NOTES.md "Feat reference casing"). Lowercasing both sides before
 *   matching, as NOTES.md prescribes, resolves it: every extracted feat
 *   name+source matches an entry in feats.json once title-cased.
 * - `skillProficiencies` is `[{ skillA: true, skillB: true }]` — exactly
 *   one object with exactly two keys, for every entry.
 * - `toolProficiencies` is `[{ "tool name": true }]` for a named tool, or
 *   `[{ anyArtisansTool: 1 }]` (also anyMusicalInstrument, anyGamingSet)
 *   for a category choice.
 * - `startingEquipment` is `[{ <A-key>: [...], <B-key>: [...] }]`. The key
 *   casing is NOT fixed to "A"/"B": all 17 EFA entries use lowercase
 *   "a"/"b", all 16 XPHB entries use uppercase "A"/"B". Read case-
 *   insensitively rather than branching on source (confirmed with the
 *   user rather than assumed).
 *   Equipment array elements come in four shapes: a bare item code string
 *   ("dagger|xphb"), an `{ item, displayName?, quantity? }` object, a
 *   `{ value: <copper> }` coin amount, or an `{ equipmentType }` category
 *   placeholder (toolArtisan, instrumentMusical, setGaming — the only
 *   three that occur). Three bare item-code strings ("holy symbol|xphb",
 *   "gaming set|xphb", "musical instrument|xphb") don't resolve against
 *   items.json at all — they are 5etools item-GROUP references, which
 *   extraction deliberately excludes from items.json (NOTES.md "Item code
 *   legends" / "itemGroup ... excluded from output"). Confirmed by user:
 *   resolve item names via items.json; anything that fails to resolve
 *   falls back to a humanized version of the code rather than failing,
 *   matching this project's established "degrade gracefully" convention
 *   for unresolvable references (see src/markup/tags.ts).
 */

import type { Ability } from '../abilities/abilityScores'

const SHORT_ABILITY: Record<string, Ability> = {
	str: 'strength',
	dex: 'dexterity',
	con: 'constitution',
	int: 'intelligence',
	wis: 'wisdom',
	cha: 'charisma',
}

export interface BackgroundOriginFeat {
	name: string
	source: string
}

export type BackgroundToolProficiency =
	| { kind: 'named'; name: string }
	| { kind: 'category'; category: string; label: string }

export type BackgroundEquipmentEntry =
	| { kind: 'item'; label: string; quantity?: number }
	| { kind: 'coins'; copper: number }
	| { kind: 'category'; label: string }

export interface BackgroundEntry {
	name: string
	source: string
	/** The three abilities this background lets the player choose the bonus among. */
	abilityChoices: [Ability, Ability, Ability]
	skillProficiencies: [string, string]
	toolProficiency: BackgroundToolProficiency
	originFeat: BackgroundOriginFeat
	equipmentOptionA: BackgroundEquipmentEntry[]
	equipmentOptionB: BackgroundEquipmentEntry[]
}

const TOOL_CATEGORY_LABELS: Record<string, string> = {
	anyArtisansTool: "Artisan's tools (your choice)",
	anyMusicalInstrument: 'Musical instrument (your choice)',
	anyGamingSet: 'Gaming set (your choice)',
}

const EQUIPMENT_CATEGORY_LABELS: Record<string, string> = {
	toolArtisan: "an artisan's tool of your choice",
	instrumentMusical: 'a musical instrument of your choice',
	setGaming: 'a gaming set of your choice',
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * "magic initiate; cleric" -> "Magic Initiate; Cleric" — matches feats.json's
 * own name casing. Capitalizes only the first letter of each space-separated
 * word, so a possessive like "calligrapher's" keeps its lowercase "s".
 */
function titleCase(text: string): string {
	return text
		.split(' ')
		.map((word) => (word.length === 0 ? word : word[0].toUpperCase() + word.slice(1)))
		.join(' ')
}

function humanizeItemCode(code: string): string {
	const withoutSource = code.split('|')[0]
	return titleCase(withoutSource)
}

function parseAbilityChoices(raw: unknown): [Ability, Ability, Ability] {
	if (!Array.isArray(raw) || raw.length !== 2) {
		throw new Error(`background: expected a 2-element "ability" array, got ${JSON.stringify(raw)}`)
	}
	const [spread, flat] = raw as [unknown, unknown]
	const from = isRecord(spread) &&
		isRecord(spread['choose']) &&
		isRecord(spread['choose']['weighted']) &&
		Array.isArray(spread['choose']['weighted']['from'])
		? (spread['choose']['weighted']['from'] as unknown[])
		: null
	const flatFrom = isRecord(flat) &&
		isRecord(flat['choose']) &&
		isRecord(flat['choose']['weighted']) &&
		Array.isArray(flat['choose']['weighted']['from'])
		? (flat['choose']['weighted']['from'] as unknown[])
		: null

	if (!from || from.length !== 3 || !flatFrom || flatFrom.length !== 3) {
		throw new Error(`background: "ability" did not match the expected choose/weighted shape: ${JSON.stringify(raw)}`)
	}

	const abilities = from.map((code) => {
		if (typeof code !== 'string' || !(code in SHORT_ABILITY)) {
			throw new Error(`background: unrecognised ability code ${JSON.stringify(code)}`)
		}
		return SHORT_ABILITY[code]
	})
	return [abilities[0], abilities[1], abilities[2]]
}

function parseSkillProficiencies(raw: unknown): [string, string] {
	if (!Array.isArray(raw) || raw.length !== 1 || !isRecord(raw[0])) {
		throw new Error(`background: expected a 1-element "skillProficiencies" array, got ${JSON.stringify(raw)}`)
	}
	const keys = Object.keys(raw[0])
	if (keys.length !== 2) {
		throw new Error(`background: expected exactly 2 skillProficiencies, got ${JSON.stringify(keys)}`)
	}
	return [keys[0], keys[1]]
}

function parseToolProficiency(raw: unknown): BackgroundToolProficiency {
	if (!Array.isArray(raw) || raw.length !== 1 || !isRecord(raw[0])) {
		throw new Error(`background: expected a 1-element "toolProficiencies" array, got ${JSON.stringify(raw)}`)
	}
	const keys = Object.keys(raw[0])
	if (keys.length !== 1) {
		throw new Error(`background: expected exactly 1 toolProficiencies key, got ${JSON.stringify(keys)}`)
	}
	const key = keys[0]
	if (key in TOOL_CATEGORY_LABELS) {
		return { kind: 'category', category: key, label: TOOL_CATEGORY_LABELS[key] }
	}
	return { kind: 'named', name: titleCase(key) }
}

function parseOriginFeat(raw: unknown): BackgroundOriginFeat {
	if (!Array.isArray(raw) || raw.length !== 1 || !isRecord(raw[0])) {
		throw new Error(`background: expected a 1-element "feats" array, got ${JSON.stringify(raw)}`)
	}
	const keys = Object.keys(raw[0])
	if (keys.length !== 1) {
		throw new Error(`background: expected exactly 1 feats key, got ${JSON.stringify(keys)}`)
	}
	const [namePart, sourcePart] = keys[0].toLowerCase().split('|')
	if (!namePart || !sourcePart) {
		throw new Error(`background: feats key is not "name|source": ${JSON.stringify(keys[0])}`)
	}
	return { name: titleCase(namePart), source: sourcePart.toUpperCase() }
}

/** Reads the A/B equipment option key case-insensitively — EFA uses lowercase, XPHB uppercase. */
function findEquipmentOptionKey(entry: Record<string, unknown>, letter: 'a' | 'b'): string | undefined {
	return Object.keys(entry).find((key) => key.toLowerCase() === letter)
}

function resolveEquipmentEntry(raw: unknown, itemNames: ReadonlyMap<string, string>): BackgroundEquipmentEntry {
	if (typeof raw === 'string') {
		const resolved = itemNames.get(raw.toLowerCase())
		return { kind: 'item', label: resolved ?? humanizeItemCode(raw) }
	}
	if (!isRecord(raw)) {
		throw new Error(`background: unrecognised startingEquipment entry: ${JSON.stringify(raw)}`)
	}
	if (typeof raw['value'] === 'number') {
		return { kind: 'coins', copper: raw['value'] }
	}
	if (typeof raw['equipmentType'] === 'string') {
		const category = raw['equipmentType']
		return { kind: 'category', label: EQUIPMENT_CATEGORY_LABELS[category] ?? humanizeItemCode(category) }
	}
	if (typeof raw['item'] === 'string') {
		const displayName = typeof raw['displayName'] === 'string' ? raw['displayName'] : undefined
		const resolved = itemNames.get(raw['item'].toLowerCase())
		const label = displayName ?? resolved ?? humanizeItemCode(raw['item'])
		const quantity = typeof raw['quantity'] === 'number' ? raw['quantity'] : undefined
		return { kind: 'item', label, ...(quantity !== undefined ? { quantity } : {}) }
	}
	throw new Error(`background: unrecognised startingEquipment entry: ${JSON.stringify(raw)}`)
}

function parseStartingEquipment(
	raw: unknown,
	itemNames: ReadonlyMap<string, string>,
): { optionA: BackgroundEquipmentEntry[]; optionB: BackgroundEquipmentEntry[] } {
	if (!Array.isArray(raw) || raw.length !== 1 || !isRecord(raw[0])) {
		throw new Error(`background: expected a 1-element "startingEquipment" array, got ${JSON.stringify(raw)}`)
	}
	const entry = raw[0]
	const keyA = findEquipmentOptionKey(entry, 'a')
	const keyB = findEquipmentOptionKey(entry, 'b')
	if (!keyA || !keyB || !Array.isArray(entry[keyA]) || !Array.isArray(entry[keyB])) {
		throw new Error(`background: startingEquipment must have array-valued A/B keys, got ${JSON.stringify(Object.keys(entry))}`)
	}
	return {
		optionA: (entry[keyA] as unknown[]).map((item) => resolveEquipmentEntry(item, itemNames)),
		optionB: (entry[keyB] as unknown[]).map((item) => resolveEquipmentEntry(item, itemNames)),
	}
}

interface RawBackgroundEntry {
	name: string
	source: string
}

function isRawBackgroundEntry(value: unknown): value is RawBackgroundEntry {
	if (!isRecord(value)) return false
	return typeof value['name'] === 'string' && typeof value['source'] === 'string'
}

/** Builds the `"name|source"` (lowercase) -> proper-cased item name lookup used to resolve equipment codes. */
export function buildItemNameLookup(parsedItems: unknown): Map<string, string> {
	if (!Array.isArray(parsedItems)) {
		throw new Error('items.json: expected a top-level array.')
	}
	const lookup = new Map<string, string>()
	for (const entry of parsedItems) {
		if (!isRecord(entry) || typeof entry['name'] !== 'string' || typeof entry['source'] !== 'string') continue
		lookup.set(`${entry['name'].toLowerCase()}|${entry['source'].toLowerCase()}`, entry['name'])
	}
	return lookup
}

/**
 * Parses a parsed backgrounds.json array into the fields this slice needs.
 * `itemNames` resolves startingEquipment item codes to display names — pass
 * the result of `buildItemNameLookup` on a parsed items.json.
 */
export function extractBackgrounds(parsed: unknown, itemNames: ReadonlyMap<string, string>): BackgroundEntry[] {
	if (!Array.isArray(parsed)) {
		throw new Error('backgrounds.json: expected a top-level array.')
	}

	const backgrounds: BackgroundEntry[] = []
	for (const entry of parsed) {
		if (!isRawBackgroundEntry(entry)) continue
		const raw = entry as unknown as Record<string, unknown>
		const { optionA, optionB } = parseStartingEquipment(raw['startingEquipment'], itemNames)
		backgrounds.push({
			name: entry.name,
			source: entry.source,
			abilityChoices: parseAbilityChoices(raw['ability']),
			skillProficiencies: parseSkillProficiencies(raw['skillProficiencies']),
			toolProficiency: parseToolProficiency(raw['toolProficiencies']),
			originFeat: parseOriginFeat(raw['feats']),
			equipmentOptionA: optionA,
			equipmentOptionB: optionB,
		})
	}
	return backgrounds
}

/** Fetches backgrounds.json and items.json and returns the selectable backgrounds, sorted by name. */
export async function loadBackgrounds(): Promise<BackgroundEntry[]> {
	const [backgroundsResponse, itemsResponse] = await Promise.all([
		fetch(`${import.meta.env.BASE_URL}data/backgrounds.json`),
		fetch(`${import.meta.env.BASE_URL}data/items.json`),
	])
	if (!backgroundsResponse.ok) {
		throw new Error(`backgrounds.json — HTTP ${backgroundsResponse.status}`)
	}
	if (!itemsResponse.ok) {
		throw new Error(`items.json — HTTP ${itemsResponse.status}`)
	}
	const parsedBackgrounds: unknown = await backgroundsResponse.json()
	const parsedItems: unknown = await itemsResponse.json()
	const itemNames = buildItemNameLookup(parsedItems)
	return extractBackgrounds(parsedBackgrounds, itemNames).sort((a, b) => a.name.localeCompare(b.name))
}
