/*
 * Typed loader for beasts.json (build order step 6b, D67: XMM Beasts up to
 * CR 6, plus the eight creatures Pact of the Chain names — seven of which are
 * not Beasts). Every pool that means "a Beast" therefore has to say so; see
 * isBeastCreature.
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

/**
 * An innate-casting block. Only `name` and `headerEntries` are read: every
 * block in this data sets `displayAs: "action"` and hides its own `will` list,
 * so the header sentence IS the printed stat-block line. No Beast has one —
 * these arrive with the Pact of the Chain forms.
 */
export interface BeastSpellcastingBlock {
	name?: string
	headerEntries?: unknown[]
}

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
	/** Plain language names ("Common", "Infernal"). Absent on every Beast. */
	languages?: string[]
	/** Item references as the data writes them ("shortsword|xphb"). Absent on every Beast. */
	gear?: string[]
	spellcasting?: BeastSpellcastingBlock[]
	/**
	 * Set by the extractor on the eight creatures Pact of the Chain names in
	 * its own text. Seven of them are not Beasts and are in beasts.json only
	 * because the invocation names them — this flag is what keeps them out of
	 * every other pool.
	 */
	pactOfTheChain?: boolean
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
export function isSwarmBeast(beast: Beast): boolean {
	return typeof beast.type === 'object' && beast.type !== null && typeof beast.type.swarmSize === 'string'
}

/**
 * True when the beast can fly. A speed value is a number or an object, and
 * either can be zero, so presence of the key alone is not the test.
 */
export function hasFlySpeed(beast: Beast): boolean {
	const fly = beast.speed.fly
	if (fly === undefined) return false
	return typeof fly === 'number' ? fly > 0 : (fly.amount ?? 0) > 0
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
	return beasts.filter((beast) => isBeastCreature(beast) && beast.crNumber === 0 && !isSwarmBeast(beast))
}

/** True when the character's combined spell list contains Find Familiar, whatever granted it. */
export function hasFindFamiliar(spells: { name: string }[]): boolean {
	return spells.some((spell) => spell.name.toLowerCase() === FIND_FAMILIAR_NAME)
}

const PACT_OF_THE_CHAIN_NAME = 'pact of the chain'

/**
 * True when the creature is of type Beast. Every entry in beasts.json used to
 * be one; since the Pact of the Chain forms joined the file, a pool that means
 * "Beasts" (Wild Shape, Find Familiar) has to say so.
 */
export function isBeastCreature(beast: Beast): boolean {
	return typeof beast.type === 'string' ? beast.type === 'beast' : beast.type.type === 'beast'
}

/**
 * The special familiar forms Pact of the Chain names. Read off the extractor's
 * flag rather than a second copy of the eight names — validate-data.js asserts
 * the flag marks exactly those the invocation's text names.
 */
export function pactOfTheChainForms(beasts: Beast[]): Beast[] {
	return beasts.filter((beast) => beast.pactOfTheChain === true)
}

/**
 * True when the character took the Pact of the Chain invocation. Eldritch
 * Invocations are stored as an optionalFeatureChoices entry naming the option
 * (optionalFeatureData.ts), so no data file has to be read to answer this.
 */
export function hasPactOfTheChain(optionalFeatureChoices: { choices: string[] }[]): boolean {
	return optionalFeatureChoices.some((entry) =>
		entry.choices.some((name) => name.trim().toLowerCase() === PACT_OF_THE_CHAIN_NAME),
	)
}

/** Where a familiar form comes from — the spell's own list, or the invocation that adds to it. */
export type FamiliarFormOrigin = 'spell' | 'pact-of-the-chain'

export interface FamiliarFormOption {
	beast: Beast
	origin: FamiliarFormOrigin
}

/**
 * Every form this character's familiar may take, in one list: the spell's own
 * pool always, plus the invocation's eight only for a character that has it.
 * A creature in both (Venomous Snake is a Beast the invocation also names) is
 * offered once.
 */
export function familiarFormOptions(beasts: Beast[], withPactOfTheChain: boolean): FamiliarFormOption[] {
	const options: FamiliarFormOption[] = findFamiliarBeasts(beasts).map((beast) => ({ beast, origin: 'spell' }))
	if (!withPactOfTheChain) return options
	const already = new Set(options.map((option) => formKey(option.beast)))
	for (const beast of pactOfTheChainForms(beasts)) {
		if (already.has(formKey(beast))) continue
		options.push({ beast, origin: 'pact-of-the-chain' })
	}
	return options
}

/** The identity of a stored or offered form — name plus source, the pair storage keeps. */
export function formKey(form: { name: string; source: string }): string {
	return `${form.name}|${form.source}`
}

/** Fetches beasts.json through the shared cache (D39). */
export async function loadBeasts(): Promise<Beast[]> {
	const parsed = await loadDataFile('data/beasts.json')
	return extractBeasts(parsed)
}
