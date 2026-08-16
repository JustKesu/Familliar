/*
 * Spell detail lookup (build order step 6, slice d4 — sheet display). Not
 * calculation, not a picker — a data query the sheet's spell list sits on
 * top of, same reasoning as classSpellListData.ts (slice c). The sheet only
 * ever stores a spell's name+source (Character.spellChoices,
 * AlwaysPreparedSpell) — everything else the detail view needs (casting
 * time, range, components, duration, attack/save, description entries) is
 * re-looked-up from spells.json here, per the task brief.
 *
 * Shape confirmed via scripts/investigate-spell-detail-shape.js (D46), one
 * trimmed example only:
 * - `time`: array of {number, unit, condition?} — unit is "action" | "bonus"
 *   | "reaction" | "minute" | "hour".
 * - `range`: {type, distance?: {type, amount?}} — type is "point" (plain
 *   distance) or an area shape ("cone"/"line"/"radius"/"sphere"/"cube"/
 *   "emanation"); distance.type is "feet" | "miles" | "self" | "touch" |
 *   "sight" | "unlimited" (the last four never carry an amount).
 * - `components`: {v?, s?, m?} — m is `true`, a plain string, or
 *   `{text, cost?}`.
 * - `duration`: array of entries; `type` is "instant" | "permanent" |
 *   "special" | "timed" (only "timed" carries a nested `duration.duration`
 *   {type, amount} and an optional `concentration: true`).
 * - `savingThrow`: array of lowercase ability names (208/489 spells).
 * - `spellAttack`: array of "M" | "R" (34/489 spells) — mutually exclusive
 *   with `savingThrow` in the data seen, but both are read independently
 *   rather than assumed exclusive.
 * - `entriesHigherLevel`: array of entry objects (187/489 spells), same
 *   shape as `entries` — usually one `{type: "entries", name: "Using a
 *   Higher-Level Spell Slot", entries: [...]}`. Rendered through the same
 *   markup renderer as `entries`, per step 6 (D46).
 * - `scalingLevelDice`: cantrip character-level scaling (26/489, all level 0
 *   — confirmed no leveled spell carries it, scripts/investigate-scaling-
 *   level-dice-shape.js). A single `{label, scaling}` object (23/26) OR an
 *   array of them (3/26, e.g. Booming Blade's two separate damage dice) —
 *   normalized to always an array here. `scaling` is a map of character
 *   level (stringified number key, thresholds vary per entry — Booming
 *   Blade's second entry starts at "5", not "1") to a dice string
 *   ("2d10"). Structured data, not entry text — formatted directly
 *   (spellFormatting.ts), not through the markup renderer.
 */

import { loadDataFile } from '../dataLoader/dataLoader'

export interface SpellTime {
	number: number
	unit: string
	condition?: string
}

export interface SpellRange {
	type: string
	distance?: { type: string; amount?: number }
}

export interface SpellComponents {
	v?: boolean
	s?: boolean
	m?: boolean | string | { text?: string; cost?: number }
}

export interface SpellDuration {
	type: string
	duration?: { type: string; amount: number }
	concentration?: boolean
}

export interface SpellScalingLevelDiceEntry {
	label: string
	scaling: Record<string, string>
}

export interface SpellDetail {
	name: string
	source: string
	level: number
	ritual: boolean
	concentration: boolean
	time: SpellTime[]
	range: SpellRange | undefined
	components: SpellComponents | undefined
	duration: SpellDuration[]
	spellAttack?: string[]
	savingThrow?: string[]
	entries: unknown[]
	entriesHigherLevel: unknown[]
	scalingLevelDice: SpellScalingLevelDiceEntry[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

interface RawSpell {
	name: string
	source: string
	level: number
	time?: unknown
	range?: unknown
	components?: unknown
	duration?: unknown
	spellAttack?: unknown
	savingThrow?: unknown
	entries?: unknown
	entriesHigherLevel?: unknown
	scalingLevelDice?: unknown
	meta?: { ritual?: boolean }
}

function isRawSpell(value: unknown): value is RawSpell {
	if (!isRecord(value)) return false
	return typeof value['name'] === 'string' && typeof value['source'] === 'string' && typeof value['level'] === 'number'
}

function hasConcentration(duration: unknown): boolean {
	if (!Array.isArray(duration)) return false
	return duration.some((entry) => isRecord(entry) && entry['concentration'] === true)
}

function isScalingLevelDiceEntry(value: unknown): value is SpellScalingLevelDiceEntry {
	return isRecord(value) && typeof value['label'] === 'string' && isRecord(value['scaling'])
}

/** `scalingLevelDice` is a single object OR an array of them (Booming Blade's two dice) — always normalized to an array here. */
function extractScalingLevelDice(raw: unknown): SpellScalingLevelDiceEntry[] {
	const asArray = Array.isArray(raw) ? raw : [raw]
	return asArray.filter(isScalingLevelDiceEntry)
}

/** Pure (D38): the whole spells.json array, shaped into one SpellDetail per spell. */
export function extractSpellDetails(parsed: unknown): SpellDetail[] {
	if (!Array.isArray(parsed)) {
		throw new Error('spells.json: expected a top-level array.')
	}

	return parsed.filter(isRawSpell).map((spell) => ({
		name: spell.name,
		source: spell.source,
		level: spell.level,
		ritual: spell.meta?.ritual === true,
		concentration: hasConcentration(spell.duration),
		time: (Array.isArray(spell.time) ? spell.time : []) as SpellTime[],
		range: spell.range as SpellRange | undefined,
		components: spell.components as SpellComponents | undefined,
		duration: (Array.isArray(spell.duration) ? spell.duration : []) as SpellDuration[],
		spellAttack: Array.isArray(spell.spellAttack) ? (spell.spellAttack as string[]) : undefined,
		savingThrow: Array.isArray(spell.savingThrow) ? (spell.savingThrow as string[]) : undefined,
		entries: Array.isArray(spell.entries) ? spell.entries : [],
		entriesHigherLevel: Array.isArray(spell.entriesHigherLevel) ? spell.entriesHigherLevel : [],
		scalingLevelDice: spell.scalingLevelDice ? extractScalingLevelDice(spell.scalingLevelDice) : [],
	}))
}

/** Fetches spells.json and returns every spell's detail. */
export async function loadSpellDetails(): Promise<SpellDetail[]> {
	const parsed = await loadDataFile('data/spells.json')
	return extractSpellDetails(parsed)
}

/** Case-insensitive name match, source compared uppercase — mirrors subclassPreparedSpells.ts's findSpell. */
export function findSpellDetail(details: SpellDetail[], name: string, source: string): SpellDetail | undefined {
	return details.find((d) => d.name.toLowerCase() === name.toLowerCase() && d.source.toUpperCase() === source.toUpperCase())
}
