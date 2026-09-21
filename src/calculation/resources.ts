/*
 * Limited-use resources (build order step 9, slice 9b1): which named pools a
 * character can spend, and how many of each. Calculation and storage only —
 * spending, resting and the sheet column are later slices.
 *
 * WHAT COUNTS AS A RESOURCE. D86's isActionTableFeature is deliberately not
 * reused: it asks whether a feature is worth a row in the actions table, which
 * every rest-tagged feature is, limited or not (Weapon Mastery's "you can change
 * your choices when you finish a Long Rest" passes it). The narrower test here is
 * structural first and textual second:
 *
 *   1. A POOL — a name some feature's `consumes.name` spends. The 8 in the data
 *      are Arcane Shot, Channel Divinity, Focus Point, Ki, Psionic Energy Die,
 *      Sorcery Point, Superiority Die and Wild Shape
 *      (scripts, step 9b1 investigation).
 *   2. A SELF-LIMITED FEATURE — one whose text carries a rest tag AND says its
 *      uses are expended and regained. The phrase test is what separates Rage,
 *      Second Wind, Favored Enemy and Action Surge (in) from Weapon Mastery
 *      (out); a rest tag alone cannot. Text, not a name list (D21): a feature
 *      phrasing its limit some other way reads as false, an accepted false
 *      negative in the same spirit as D86's.
 *
 * WHERE THE MAXIMUM COMES FROM. Only the per-level tables (DATA.md, "Pool maxima
 * live in table groups"): the class's `classTableGroups`, then the chosen
 * subclass's `subclassTableGroups`, matched by column label against the resource
 * name. Nothing is parsed out of prose, so a maximum stated only in a sentence
 * ("equal to your Charisma modifier") is reported as not in the data (D43) rather
 * than guessed. Data-wide that is 8 resources with a table and ~90 without.
 * The one exception: a feature whose text states only a recharge, with no count
 * and no stat, has one use (24 of the ~90 data-wide; isImplicitSingleUse).
 */

import { hasRestTag } from '../actions/actionTableFeatureData'
import type { Character, CharacterClass } from '../storage/character'
import { type Calculated, type Contribution, known, unknown } from './types'

/**
 * The shape this module reads a feature in. GrantedFeature (the D87 class and
 * subclass features), FeatTextEntry and OptionalFeatureOption all satisfy it
 * already, so a caller passes its own lists through unchanged.
 */
export interface ResourceFeature {
	name: string
	entries?: unknown
	consumes?: unknown
}

export interface CharacterResource {
	/** The resolved name, and the key `Character.play.resourceUses` uses. */
	name: string
	/** The names in the data that resolved to it — two only for the Monk pool. */
	dataNames: string[]
	/** Uses per rest, or why the data does not say (D43). Never a guess. */
	max: Calculated<number>
	/** What a Short Rest gives back (slice 9b5), from the feature text; null is "nothing until a Long Rest". */
	shortRest: RestRecovery | null
}

/** How much of a pool one rest returns — the two amounts the 2024 feature text uses, never a fraction. */
export type RestRecovery = 'all' | 'one'

/*
 * The data calls the Monk pool "Ki" on the TCE subclasses this app still offers
 * and "Focus Point" on the 2024 Monk, and a character can hold features using
 * both. One resource, one spent count, one name — the 2024 one.
 */
const RESOURCE_NAME_ALIASES: Record<string, string> = { ki: 'Focus Point' }

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Lowercased, letters only, singular — `consumes.name` is singular where the matching column label is plural (DATA.md). */
function normalizeResourceName(name: string): string {
	return name.toLowerCase().replace(/[^a-z]/g, '').replace(/s$/, '')
}

/** The name a data name is tracked under. */
export function resolveResourceName(name: string): string {
	return RESOURCE_NAME_ALIASES[normalizeResourceName(name)] ?? name
}

/** `consumes` is either a `{ name, amount? }` record or a bare string across the four feature files. */
function consumedPoolName(feature: ResourceFeature): string | null {
	const consumes = feature.consumes
	if (typeof consumes === 'string') return consumes
	if (isRecord(consumes) && typeof consumes['name'] === 'string') return consumes['name']
	return null
}

/** Every string in an entries tree, with 5etools markup stripped down to its display text (DATA.md — a phrase search that skips this finds a fraction of the hits). */
function plainText(node: unknown, out: string[] = []): string[] {
	if (typeof node === 'string') out.push(node.replace(/\{@\w+\s+([^|}]*)[^}]*\}/g, '$1'))
	else if (Array.isArray(node)) for (const child of node) plainText(child, out)
	else if (isRecord(node)) for (const key of Object.keys(node)) plainText(node[key], out)
	return out
}

/** Rule 2's phrasings: a pool of uses that is expended and regained, a count of times per rest, or the once-per-rest sentence Action Surge uses. */
const EXPENDED_USES =
	/\bexpended uses?\b|\bregain\b[^.]{0,60}\buses?\b|number of times equal to|can't (?:do so|use it|use this feature) again until you finish/i

function isSelfLimitedFeature(feature: ResourceFeature): boolean {
	if (!hasRestTag(feature.entries)) return false
	return EXPENDED_USES.test(plainText(feature.entries).join(' '))
}

/*
 * A feature that only says it "can't be used again until you finish a rest"
 * has one use. Any stat, proficiency or count word anywhere in its text keeps
 * it unknown, even where that word is a save DC (Intimidating Presence) — a
 * missed 1 renders blank, a wrong 1 misstates the rules. "Proficiency" alone
 * because {@variantrule Proficiency|XPHB|Proficiency Bonus} strips to its first segment.
 */
const SINGLE_USE_RECHARGE = /can't (?:do so|use it|use this feature) again until you finish an? (?:Short|Long) Rest/i
const NAMES_A_STAT = /\b(?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma|modifier|proficiency)\b/i
const STATES_A_COUNT = /\b(?:twice|thrice|uses|number of times|(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+) (?:more |additional )?times)\b/i

function isImplicitSingleUse(text: string): boolean {
	return SINGLE_USE_RECHARGE.test(text) && !NAMES_A_STAT.test(text) && !STATES_A_COUNT.test(text)
}

// --- the per-level tables ------------------------------------------------

/** A `{@tip Die Size|Psionic Energy Die Size}` column renders its FIRST segment and is keyed by its SECOND (DATA.md); every other tag is keyed by its first. */
function columnLabel(raw: unknown): string | null {
	if (typeof raw !== 'string') return null
	const tip = raw.match(/\{@tip\s+([^|}]+)\|([^|}]+)/)
	if (tip) return tip[2].trim()
	const tagged = raw.match(/\{@\w+\s+([^|}]+)/)
	return (tagged ? tagged[1] : raw).trim()
}

/** A cell is a plain number, a numeric string, or something that is not a count at all — a die, a bonus, or the literal em dash (DATA.md). */
function cellCount(cell: unknown): number | null {
	if (typeof cell === 'number') return Number.isInteger(cell) ? cell : null
	if (typeof cell === 'string' && /^\d+$/.test(cell.trim())) return Number(cell.trim())
	return null
}

interface TableLookup {
	/** The table's own column label, for the breakdown — "Rages", not "Rage". */
	label: string
	cell: unknown
}

/**
 * The cell for `name` at `level` in one entry's table groups. Matches the column
 * label, or that label minus a " Number" suffix: Psi Warrior's pool is consumed
 * as "Psionic Energy Die" and tabled as "Psionic Energy Die Number" beside a
 * "… Size" column that is a die, not a count (DATA.md).
 */
function lookupInTableGroups(entry: Record<string, unknown>, groupsKey: string, name: string, level: number): TableLookup | null {
	const wanted = normalizeResourceName(name)
	const groups = entry[groupsKey]
	if (!Array.isArray(groups)) return null
	for (const group of groups) {
		if (!isRecord(group)) continue
		const labels = Array.isArray(group['colLabels']) ? group['colLabels'] : []
		const rows = Array.isArray(group['rows']) ? group['rows'] : []
		const row = rows[level - 1]
		if (!Array.isArray(row)) continue
		for (let i = 0; i < labels.length; i++) {
			const label = columnLabel(labels[i])
			if (label === null) continue
			const key = normalizeResourceName(label)
			if (key !== wanted && key !== normalizeResourceName(`${name} Number`)) continue
			return { label, cell: row[i] }
		}
	}
	return null
}

function isClassEntry(entry: unknown, characterClass: CharacterClass): entry is Record<string, unknown> {
	return isRecord(entry) && entry['entryType'] === 'class' && entry['name'] === characterClass.className && entry['source'] === characterClass.classSource
}

function isSubclassEntry(entry: unknown, characterClass: CharacterClass): entry is Record<string, unknown> {
	if (!isRecord(entry) || entry['entryType'] !== 'subclass') return false
	if (entry['className'] !== characterClass.className || entry['classSource'] !== characterClass.classSource) return false
	return entry['name'] === characterClass.subclass || entry['shortName'] === characterClass.subclass
}

/** The maximum for one resource, from the first of the character's class/subclass tables that names it. */
function computeResourceMax(name: string, character: Character, parsedClasses: unknown[], impliedSingleUse: boolean): Calculated<number> {
	const looked: string[] = []
	for (const characterClass of character.classes) {
		looked.push(characterClass.className)
		const candidates: { owner: string; hit: TableLookup | null }[] = []
		for (const entry of parsedClasses) {
			if (isClassEntry(entry, characterClass)) {
				candidates.push({ owner: characterClass.className, hit: lookupInTableGroups(entry, 'classTableGroups', name, characterClass.level) })
			} else if (isSubclassEntry(entry, characterClass)) {
				candidates.push({ owner: String(entry['name']), hit: lookupInTableGroups(entry, 'subclassTableGroups', name, characterClass.level) })
			}
		}
		for (const { owner, hit } of candidates) {
			if (!hit) continue
			const count = cellCount(hit.cell)
			if (count === null) {
				return unknown(`${owner}'s "${hit.label}" column holds no number at level ${characterClass.level}.`)
			}
			const breakdown: Contribution[] = [{ source: `${owner} level ${characterClass.level}: ${hit.label}`, amount: count }]
			return known(count, breakdown)
		}
	}
	if (impliedSingleUse) return known(1, [{ source: `${name}: can't be used again until a rest, no count stated`, amount: 1 }])
	const where = looked.length > 0 ? `${looked.join(', ')}'s per-level table${looked.length > 1 ? 's' : ''}` : 'any class table'
	return unknown(`"${name}" has no column in ${where}, so its number of uses is not in the data.`)
}

// --- what a rest gives back ----------------------------------------------

/*
 * The rest tag alone says a feature CARES about rests, not what a rest returns:
 * every short-rest-recoverable pool in the data carries both tags, because the
 * same sentence names the Long Rest that returns the rest of it. The amount is
 * only in the prose, in two orderings (scripts/investigate-rest-recovery*.js):
 *
 *   "You regain one expended use when you finish a Short Rest, and you regain
 *    all expended uses when you finish a Long Rest."            (Rage)
 *   "…unavailable until you finish a Short Rest or Long Rest, at the end of
 *    which you regain all your expended points."                (Monk's Focus)
 *
 * The second ordering is matched by its exact connecting phrase rather than by
 * a window: a loose one swallows the "and you regain all … Long Rest" half of
 * the first ordering and reports every one-use pool as fully restored.
 */
const REGAIN_THEN_REST = /\bregain\s+(all|one)\b[^.]{0,120}?\bfinish\s+an?\s+((?:Short|Long) Rest(?:\s+or\s+(?:Short|Long) Rest)?)/gi
const REST_THEN_REGAIN = /\bfinish\s+an?\s+((?:Short|Long) Rest(?:\s+or\s+(?:Short|Long) Rest)?),?\s+at the end of which you regain\s+(all|one)\b/gi

/** Letters only, with the data's Dice/Die plural folded together — Psi Warrior's pool is consumed as "Psionic Energy Die" and recovered as "Psionic Energy Dice" (DATA.md). */
function comparableText(text: string): string {
	return text.toLowerCase().replace(/[^a-z]/g, '').replace(/dice/g, 'die')
}

/**
 * What one feature's text says a Short Rest returns of `name`, or null if it
 * says nothing about it. A clause counts for a resource when the feature is the
 * resource's OWN feature (Rage's sentence never repeats the word "Rage") or when
 * the sentence names it (Monk's Focus and Psionic Power define pools they are
 * not named after).
 */
function shortRestRecoveryFrom(feature: ResourceFeature, names: readonly string[]): RestRecovery | null {
	const ownFeature = names.some((name) => normalizeResourceName(resolveResourceName(feature.name)) === normalizeResourceName(name))
	const wanted = names.map(comparableText)
	let found: RestRecovery | null = null
	for (const sentence of plainText(feature.entries).join(' ').split(/(?<=\.)\s+/)) {
		if (!ownFeature && !wanted.some((name) => comparableText(sentence).includes(name))) continue
		for (const [amount, rests] of [
			...[...sentence.matchAll(REGAIN_THEN_REST)].map((match) => [match[1], match[2]] as const),
			...[...sentence.matchAll(REST_THEN_REGAIN)].map((match) => [match[2], match[1]] as const),
		]) {
			if (!/Short Rest/i.test(rests)) continue
			// The smaller amount wins where a resource has two claims: giving back a use the rules withhold is the worse error.
			if (amount.toLowerCase() === 'one') return 'one'
			found = 'all'
		}
	}
	return found
}

/**
 * What a Short Rest returns of the resource `names` identify (slice 9b5), across
 * everything the character holds. Exported for the Warlock's Pact Magic slots,
 * which are not a CharacterResource — their feature says "regain all expended
 * Pact Magic spell slots when you finish a Short Rest or Long Rest", so D11's two
 * slot pools are asked the same question in the same way rather than one of them
 * being hardcoded as short-rest recoverable.
 */
export function shortRestRecovery(names: readonly string[], features: readonly ResourceFeature[]): RestRecovery | null {
	let found: RestRecovery | null = null
	for (const feature of features) {
		const recovery = shortRestRecoveryFrom(feature, names)
		if (recovery === 'one') return 'one'
		if (recovery === 'all') found = 'all'
	}
	return found
}

// --- the resource list ---------------------------------------------------

/**
 * Every limited-use resource the character has access to, by resolved name, with
 * its computed maximum or the reason there is none (D43).
 *
 * `features` is everything the character holds that could carry or spend a pool:
 * the D87 granted class and subclass features, the feats they took, and the
 * options they chose from an optionalfeatureProgression — the same three sources
 * featureActionRowData.ts feeds the actions table, and for the same reason. A
 * Battle Master's Superiority Die is named only by the maneuvers they picked, so
 * leaving the third source out loses the pool entirely.
 *
 * `parsedClasses` is classes.json. Pure (D38): nothing is fetched here.
 */
export function computeCharacterResources(character: Character, parsedClasses: unknown, features: readonly ResourceFeature[]): CharacterResource[] {
	if (!Array.isArray(parsedClasses)) throw new Error('classes.json: expected a top-level array.')

	// Resolved name -> the data names that produced it, in first-seen order.
	const found = new Map<string, string[]>()
	function add(dataName: string): void {
		const resolved = resolveResourceName(dataName)
		const names = found.get(resolved) ?? []
		if (!names.includes(dataName)) names.push(dataName)
		found.set(resolved, names)
	}

	// A pool's count is set by whatever grants it, not by one spender's text, so only a resource nothing consumes can default to one use.
	const pools = new Set<string>()
	const ownText = new Map<string, string[]>()
	for (const feature of features) {
		const pool = consumedPoolName(feature)
		if (pool !== null) {
			add(pool)
			pools.add(resolveResourceName(pool))
		}
		if (isSelfLimitedFeature(feature)) {
			add(feature.name)
			const resolved = resolveResourceName(feature.name)
			ownText.set(resolved, [...(ownText.get(resolved) ?? []), ...plainText(feature.entries)])
		}
	}

	return [...found.entries()]
		.map(([name, dataNames]) => ({
			name,
			dataNames,
			max: computeResourceMax(name, character, parsedClasses, !pools.has(name) && isImplicitSingleUse((ownText.get(name) ?? []).join(' '))),
			shortRest: shortRestRecovery([name, ...dataNames], features),
		}))
		.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * The stored spent counts, with every one that has a known maximum brought down
 * to it (slice 9b1). The invariant is the same idea as
 * deathSavesAfterHitPointChange's — state that a change to the character has made
 * impossible is corrected at the point of that change, not left for a reader to
 * distrust — applied to a level change rather than a hit-point one.
 *
 * A resource whose maximum is not in the data is left alone: there is nothing to
 * clamp against, and dropping the count would lose a number the player entered.
 * So is a key no resource in the list claims — a character who re-gains the level
 * gets its spent count back rather than a silently refilled pool. Counts of 0 and
 * an emptied record become absence, the convention every play field uses.
 */
export function resourceUsesWithinMaxima(
	uses: Record<string, number> | undefined,
	resources: readonly CharacterResource[],
): Record<string, number> | undefined {
	if (uses === undefined) return undefined
	const maxima = new Map(resources.filter((resource) => resource.max.status === 'known').map((resource) => [resource.name, resource.max.status === 'known' ? resource.max.value : 0]))

	const clamped: Record<string, number> = {}
	for (const [name, spent] of Object.entries(uses)) {
		const max = maxima.get(name)
		const value = max === undefined ? spent : Math.min(spent, max)
		if (value > 0) clamped[name] = value
	}
	return Object.keys(clamped).length > 0 ? clamped : undefined
}
