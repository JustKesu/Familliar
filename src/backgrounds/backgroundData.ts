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
 * - `startingEquipment` is parsed by src/inventory/startingEquipmentData.ts,
 *   which is also what the equipment step consumes. This file only chooses how
 *   to render it; the shape lives in one place.
 */

import type { Ability } from '../abilities/abilityScores'
import { loadDataFile } from '../dataLoader/dataLoader'
import {
	buildItemIndex,
	parseBackgroundStartingEquipment,
	type ItemIndex,
	type StartingEquipmentOffer,
} from '../inventory/startingEquipmentData'

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

export interface BackgroundEntry {
	name: string
	source: string
	/** The three abilities this background lets the player choose the bonus among. */
	abilityChoices: [Ability, Ability, Ability]
	skillProficiencies: [string, string]
	toolProficiency: BackgroundToolProficiency
	originFeat: BackgroundOriginFeat
	/** The same offer the equipment step takes the background's half from; this step only previews it. */
	startingEquipment: StartingEquipmentOffer
}

const TOOL_CATEGORY_LABELS: Record<string, string> = {
	anyArtisansTool: "Artisan's tools (your choice)",
	anyMusicalInstrument: 'Musical instrument (your choice)',
	anyGamingSet: 'Gaming set (your choice)',
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

interface RawBackgroundEntry {
	name: string
	source: string
}

function isRawBackgroundEntry(value: unknown): value is RawBackgroundEntry {
	if (!isRecord(value)) return false
	return typeof value['name'] === 'string' && typeof value['source'] === 'string'
}

/**
 * Parses a parsed backgrounds.json array into the fields this slice needs.
 * `index` resolves startingEquipment item codes — pass `buildItemIndex` on a
 * parsed items.json.
 */
export function extractBackgrounds(parsed: unknown, index: ItemIndex): BackgroundEntry[] {
	if (!Array.isArray(parsed)) {
		throw new Error('backgrounds.json: expected a top-level array.')
	}

	const backgrounds: BackgroundEntry[] = []
	for (const entry of parsed) {
		if (!isRawBackgroundEntry(entry)) continue
		const raw = entry as unknown as Record<string, unknown>
		backgrounds.push({
			name: entry.name,
			source: entry.source,
			abilityChoices: parseAbilityChoices(raw['ability']),
			skillProficiencies: parseSkillProficiencies(raw['skillProficiencies']),
			toolProficiency: parseToolProficiency(raw['toolProficiencies']),
			originFeat: parseOriginFeat(raw['feats']),
			startingEquipment: parseBackgroundStartingEquipment(raw['startingEquipment'], entry.name, index),
		})
	}
	return backgrounds
}

/** Fetches backgrounds.json and items.json and returns the selectable backgrounds, sorted by name. */
export async function loadBackgrounds(): Promise<BackgroundEntry[]> {
	const [parsedBackgrounds, parsedItems] = await Promise.all([loadDataFile('data/backgrounds.json'), loadDataFile('data/items.json')])
	return extractBackgrounds(parsedBackgrounds, buildItemIndex(parsedItems)).sort((a, b) => a.name.localeCompare(b.name))
}
