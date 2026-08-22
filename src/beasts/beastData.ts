/*
 * Typed loader for beasts.json (build order step 6b, D67: XMM Beasts up to
 * CR 6). Slice 2 needs only the Find Familiar pool; Wild Shape will read the
 * same file through the same loader with its own filter.
 *
 * Only the fields a stat block displays are typed. `familiar`, `alignment`
 * and `initiative` are present in the data but deliberately untyped here —
 * see findFamiliarBeasts below for why the flag is not what the pool is
 * derived from.
 */

import { loadDataFile } from '../dataLoader/dataLoader'

/** One named block of stat-block prose: a trait, action, bonus action or reaction. */
export interface BeastEntryBlock {
	name?: string
	/** 5etools entry structures — always plain markup strings in this data, never a ref* node. */
	entries?: unknown[]
}

/** A speed value is a plain number, or an object when the speed carries a note ("30 ft. (hover)"). */
export type BeastSpeed = number | { amount?: number; from?: string[]; note?: string }

export interface Beast {
	name: string
	source: string
	/** 5etools size CODES ("T", "M"), always a one-element array in this data. */
	size: string[]
	/** Either a bare "beast" or an object carrying `tags`/`swarmSize` (docs/DATA.md). */
	type: string | { type: string; tags?: string[]; swarmSize?: string }
	/** Display form ("1/4"). Never used for comparison — that is what crNumber is for. */
	cr: string
	crNumber: number
	ac: number[]
	hp: { average?: number; formula?: string }
	speed: Record<string, BeastSpeed>
	str: number
	dex: number
	con: number
	int: number
	wis: number
	cha: number
	/** Ability abbreviation -> bonus as written ("+4"). */
	save?: Record<string, string>
	/** Lowercase skill name -> bonus as written ("+4"). */
	skill?: Record<string, string>
	/** Already human-readable in the data ("Darkvision 30 ft."). */
	senses?: string[]
	passive?: number
	resist?: string[]
	immune?: string[]
	vulnerable?: string[]
	conditionImmune?: string[]
	trait?: BeastEntryBlock[]
	action?: BeastEntryBlock[]
	bonus?: BeastEntryBlock[]
	reaction?: BeastEntryBlock[]
}

function isNumber(value: unknown): value is number {
	return typeof value === 'number' && !Number.isNaN(value)
}

/**
 * Accepts an entry only when it carries the fields validate-data.js
 * guarantees on every beast. Everything else is optional and simply absent
 * when the creature has none.
 */
function isBeast(value: unknown): value is Beast {
	if (typeof value !== 'object' || value === null) return false
	const entry = value as Record<string, unknown>
	return (
		typeof entry.name === 'string' &&
		typeof entry.source === 'string' &&
		Array.isArray(entry.size) &&
		(typeof entry.type === 'string' || (typeof entry.type === 'object' && entry.type !== null)) &&
		typeof entry.cr === 'string' &&
		isNumber(entry.crNumber) &&
		Array.isArray(entry.ac) &&
		typeof entry.hp === 'object' &&
		entry.hp !== null &&
		typeof entry.speed === 'object' &&
		entry.speed !== null &&
		isNumber(entry.str) &&
		isNumber(entry.dex) &&
		isNumber(entry.con) &&
		isNumber(entry.int) &&
		isNumber(entry.wis) &&
		isNumber(entry.cha) &&
		Array.isArray(entry.action)
	)
}

/** Picks the well-formed beasts out of a parsed beasts.json array. */
export function extractBeasts(parsed: unknown): Beast[] {
	if (!Array.isArray(parsed)) {
		throw new Error('beasts.json: expected a top-level array.')
	}
	return parsed.filter(isBeast)
}

const FIND_FAMILIAR_NAME = 'find familiar'

/** True when a beast is a swarm — the `type` object's `swarmSize` is the only marker. */
function isSwarm(beast: Beast): boolean {
	return typeof beast.type === 'object' && beast.type !== null && typeof beast.type.swarmSize === 'string'
}

/**
 * The forms a familiar may take, per the Find Familiar spell's OWN text:
 * eleven named beasts "or another Beast that has a Challenge Rating of 0",
 * excluding swarms.
 *
 * Derived from CR, not from 5etools' `familiar: true` flag. The two disagree
 * on exactly one creature — Venomous Snake is flagged but is CR 1/8, which
 * the 2024 spell text does not admit (it reads as 2014 lineage, where that
 * creature was named in the spell). Decided with the user; the flag is left
 * unread. All eleven named beasts are themselves CR 0, so naming them
 * separately would add nothing.
 */
export function findFamiliarBeasts(beasts: Beast[]): Beast[] {
	return beasts.filter((beast) => beast.crNumber === 0 && !isSwarm(beast))
}

/** True when the character's combined spell list contains Find Familiar, whatever granted it. */
export function hasFindFamiliar(spells: { name: string }[]): boolean {
	return spells.some((spell) => spell.name.toLowerCase() === FIND_FAMILIAR_NAME)
}

/** Fetches beasts.json through the shared cache (D39). */
export async function loadBeasts(): Promise<Beast[]> {
	const parsed = await loadDataFile('data/beasts.json')
	return extractBeasts(parsed)
}
