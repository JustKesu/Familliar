/*
 * Feat/ASI slice (build order step 4a, D16/D19/D20). Confirmed via
 * scripts/investigate-feat-structured-fields.js and
 * scripts/investigate-feat-asi-eligibility.js:
 *
 * - Which levels grant a choice is NOT the flat 4/8/12/16/19 list the task
 *   brief assumed — it is per-class (Fighter also gets 6/14, Rogue also
 *   gets 10) and level 19 is a distinct class feature named "Epic Boon", not
 *   "Ability Score Improvement". Both feature names grant the SAME kind of
 *   choice (ASI or any feat the character qualifies for) — confirmed with
 *   the user against PHB 2024 text. The "EB" category on Epic Boon feats in
 *   the data reads like a restriction but ISN'T ONE (D19 still applies
 *   unfiltered) — it only names the feature's suggested pool. Anyone
 *   reading `featCategory`/category off this data in the future should not
 *   assume EB-tagged levels are feat-category-restricted.
 * - feats.json's `prerequisite` field is an array of ALTERNATIVES (OR
 *   across entries); within one entry every present key is AND'd; only
 *   `race` ever holds more than one alternative within a single entry (OR).
 * - `race` prerequisite values ("elf", "half-elf", "small race", ...) don't
 *   line up 1:1 with species.json names. Two indirections resolve it: (1)
 *   species.json's own `creatureTypeTags` field links a variant that renames
 *   itself (Deep Gnome -> "gnome", Sea Elf -> "elf") back to its family; (2)
 *   the `_versions`-style "Elf; Drow Lineage" naming carries both the family
 *   (before "; ") and the subrace key (first word after "; "). "half-elf"
 *   and "half-orc" never resolve — species.json has no such entries in the
 *   2024/allowed-source pool, so those prerequisite alternatives are always
 *   unmet (still shown, with a reason, per D19 — never silently dropped).
 * - Ability score values fed into prerequisite checks come from the
 *   calculation layer's computeAbilityScore (final = base + background),
 *   never a second sum computed here (D16/D17, task instructions point 4).
 *   This does NOT include ASI increases picked earlier in this same wizard
 *   session — the calculation layer doesn't carry those yet (deferred to
 *   the slice that applies feat/ASI effects), so a feat prerequisite that
 *   only becomes true because of an earlier pick in this same flow will not
 *   yet show as met. Documented as a known limitation, not fixed here.
 */

import type { Ability } from '../abilities/abilityScores'
import { ABILITY_ABBREVIATIONS, type AbilityAbbreviation } from '../calculation/abilityAbbreviations'
import { loadDataFile } from '../dataLoader/dataLoader'
import { grantsFightingStyleAt } from '../fightingStyle/fightingStyleData'

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// ---------------------------------------------------------------------------
// 1. Which levels grant an ASI-or-feat choice, per class (class-features.json)
// ---------------------------------------------------------------------------

export type FeatAsiGrantKind = 'asi' | 'epicBoon'

export interface FeatAsiGrant {
	level: number
	kind: FeatAsiGrantKind
}

interface RawClassFeatureEntry {
	name: string
	className: string
	classSource: string
	level: number
}

function isRawClassFeatureEntry(value: unknown): value is RawClassFeatureEntry {
	if (!isRecord(value)) return false
	return (
		typeof value['name'] === 'string' &&
		typeof value['className'] === 'string' &&
		typeof value['classSource'] === 'string' &&
		typeof value['level'] === 'number'
	)
}

const GRANT_KIND_BY_FEATURE_NAME: Record<string, FeatAsiGrantKind> = {
	'Ability Score Improvement': 'asi',
	'Epic Boon': 'epicBoon',
}

/** Every ASI-or-feat grant the class has by `level` (inclusive), sorted ascending. Empty if none. */
export function featAsiGrantsFor(
	parsedClassFeatures: unknown,
	className: string,
	classSource: string,
	level: number,
): FeatAsiGrant[] {
	if (!Array.isArray(parsedClassFeatures)) {
		throw new Error('class-features.json: expected a top-level array.')
	}
	return parsedClassFeatures
		.filter(
			(candidate): candidate is RawClassFeatureEntry =>
				isRawClassFeatureEntry(candidate) &&
				candidate.className === className &&
				candidate.classSource === classSource &&
				candidate.level <= level &&
				Object.prototype.hasOwnProperty.call(GRANT_KIND_BY_FEATURE_NAME, candidate.name),
		)
		.map((f) => ({ level: f.level, kind: GRANT_KIND_BY_FEATURE_NAME[f.name] }))
		.sort((a, b) => a.level - b.level)
}

export async function loadFeatAsiGrants(className: string, classSource: string, level: number): Promise<FeatAsiGrant[]> {
	const parsed = await loadDataFile('data/class-features.json')
	return featAsiGrantsFor(parsed, className, classSource, level)
}

// ---------------------------------------------------------------------------
// 2. ASI increases and the level-20 cap (D20)
// ---------------------------------------------------------------------------

export const ABILITY_SCORE_CAP = 20

export type AbilityIncreaseMap = Partial<Record<Ability, number>>

/** Structurally valid shapes only: +2 to exactly one ability, or +1 to exactly two different abilities. */
export function isValidAbilityIncrease(increases: AbilityIncreaseMap): boolean {
	const entries = Object.entries(increases)
	if (entries.length === 1) return entries[0][1] === 2
	if (entries.length === 2) return entries.every(([, amount]) => amount === 1)
	return false
}

/** True if applying `increases` on top of `currentScores` would push any ability above the cap. */
export function exceedsAbilityScoreCap(currentScores: Partial<Record<Ability, number>>, increases: AbilityIncreaseMap): boolean {
	return Object.entries(increases).some(([ability, amount]) => {
		const current = currentScores[ability as Ability] ?? 0
		return current + (amount ?? 0) > ABILITY_SCORE_CAP
	})
}

// ---------------------------------------------------------------------------
// 3. The feat list, excluding "Ability Score Improvement" itself (point 5 —
//    that choice is the step before, not a feat.json entry to offer again)
// ---------------------------------------------------------------------------

export interface RawFeatPrerequisiteEntry {
	level?: number
	ability?: Partial<Record<AbilityAbbreviation, number>>[]
	feature?: string[]
	race?: { name: string; subrace?: string; displayEntry?: string }[]
	spellcasting2020?: boolean
	proficiency?: { weapon?: string; armor?: string }[]
	feat?: string[]
	featCategory?: string[]
	campaign?: string[]
	otherSummary?: { entry: string }
}

export interface FeatEntry {
	name: string
	source: string
	category: string
	prerequisite?: RawFeatPrerequisiteEntry[]
}

function isRawFeatEntry(value: unknown): value is FeatEntry {
	if (!isRecord(value)) return false
	return typeof value['name'] === 'string' && typeof value['source'] === 'string' && typeof value['category'] === 'string'
}

/** Every feats.json entry except "Ability Score Improvement" — that choice is offered as its own ASI-vs-feat step, not a list entry. */
export function extractSelectableFeats(parsed: unknown): FeatEntry[] {
	if (!Array.isArray(parsed)) {
		throw new Error('feats.json: expected a top-level array.')
	}
	return parsed.filter(isRawFeatEntry).filter((f) => f.name !== 'Ability Score Improvement')
}

export async function loadFeats(): Promise<FeatEntry[]> {
	const parsed = await loadDataFile('data/feats.json')
	return extractSelectableFeats(parsed)
}

// ---------------------------------------------------------------------------
// 4. Species lookup for the `race` prerequisite shape
// ---------------------------------------------------------------------------

export interface SpeciesPrereqInfo {
	/** A single confirmed size letter, or null when the species offers an unresolved size choice (23 species, see speciesTraits.ts) or wasn't found. */
	size: string | null
	/** species.json's own creatureTypeTags, lowercased — links a renamed variant back to its family (Deep Gnome -> "gnome", Sea Elf -> "elf"). */
	raceTags: string[]
}

interface RawSpeciesPrereqEntry {
	name: string
	source: string
	size?: unknown[]
	creatureTypeTags?: unknown[]
}

function isRawSpeciesPrereqEntry(value: unknown): value is RawSpeciesPrereqEntry {
	if (!isRecord(value)) return false
	return typeof value['name'] === 'string' && typeof value['source'] === 'string'
}

export function speciesPrereqInfoFor(parsedSpecies: unknown, name: string, source: string): SpeciesPrereqInfo | null {
	if (!Array.isArray(parsedSpecies)) {
		throw new Error('species.json: expected a top-level array.')
	}
	const entry = parsedSpecies.find(
		(candidate): candidate is RawSpeciesPrereqEntry =>
			isRawSpeciesPrereqEntry(candidate) && candidate.name === name && candidate.source === source,
	)
	if (!entry) return null
	const size = Array.isArray(entry.size) && entry.size.length === 1 && typeof entry.size[0] === 'string' ? entry.size[0] : null
	const raceTags = Array.isArray(entry.creatureTypeTags) ? entry.creatureTypeTags.filter((t): t is string => typeof t === 'string').map((t) => t.toLowerCase()) : []
	return { size, raceTags }
}

export async function loadSpeciesPrereqInfo(name: string, source: string): Promise<SpeciesPrereqInfo | null> {
	const parsed = await loadDataFile('data/species.json')
	return speciesPrereqInfoFor(parsed, name, source)
}

// ---------------------------------------------------------------------------
// 5. Class lookup for the `proficiency` and `spellcasting2020` shapes
// ---------------------------------------------------------------------------

export interface ClassPrereqInfo {
	armorProficiencies: string[]
	weaponProficiencies: string[]
	hasSpellcasting: boolean
}

interface RawClassPrereqEntry {
	name: string
	source: string
	classFeatures?: unknown
	spellcastingAbility?: unknown
	startingProficiencies?: { armor?: unknown; weapons?: unknown }
}

function isRawClassPrereqEntry(value: unknown): value is RawClassPrereqEntry {
	if (!isRecord(value)) return false
	return typeof value['name'] === 'string' && typeof value['source'] === 'string'
}

function toStringArray(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

/** `classFeatures` distinguishes a base class entry from a subclass entry sharing the same name (see classes.json). */
export function classPrereqInfoFor(parsedClasses: unknown, className: string, classSource: string): ClassPrereqInfo | null {
	if (!Array.isArray(parsedClasses)) {
		throw new Error('classes.json: expected a top-level array.')
	}
	const entry = parsedClasses.find(
		(candidate): candidate is RawClassPrereqEntry =>
			isRawClassPrereqEntry(candidate) && candidate.name === className && candidate.source === classSource && candidate.classFeatures !== undefined,
	)
	if (!entry) return null
	return {
		armorProficiencies: toStringArray(entry.startingProficiencies?.armor),
		weaponProficiencies: toStringArray(entry.startingProficiencies?.weapons),
		hasSpellcasting: entry.spellcastingAbility !== undefined,
	}
}

export async function loadClassPrereqInfo(className: string, classSource: string): Promise<ClassPrereqInfo | null> {
	const parsed = await loadDataFile('data/classes.json')
	return classPrereqInfoFor(parsed, className, classSource)
}

/** Whether the class grants the "Fighting Style" class feature by `level` — reuses D12's existing lookup rather than a second one. */
export async function loadHasFightingStyleFeature(className: string, classSource: string, level: number): Promise<boolean> {
	const parsed = await loadDataFile('data/class-features.json')
	const grantLevel = grantsFightingStyleAt(parsed, className, classSource)
	return grantLevel !== null && grantLevel <= level
}

// ---------------------------------------------------------------------------
// 6. Prerequisite evaluation
// ---------------------------------------------------------------------------

export interface ChosenFeatRef {
	name: string
	source: string
	category: string
}

/** Everything a prerequisite entry might need to check, already resolved by the caller (D38-style: pure function, data passed in). */
export interface PrerequisiteContext {
	characterLevel: number
	/** FINAL ability scores (base + background, from the calculation layer) — see module doc for what this deliberately excludes. */
	abilityScores: Partial<Record<Ability, number>>
	hasFightingStyleFeature: boolean
	hasSpellcasting: boolean
	armorProficiencies: string[]
	weaponProficiencies: string[]
	speciesName: string | null
	speciesRaceTags: string[]
	speciesSize: string | null
	/** Feats already chosen at earlier levels in this same wizard session, in level order. */
	chosenFeats: ChosenFeatRef[]
}

export interface PrerequisiteResult {
	eligible: boolean
	/** One line per unmet alternative — empty when eligible. Always shown, never a silent hide (D19). */
	reasons: string[]
}

const ABBREV_TO_ABILITY: Record<AbilityAbbreviation, Ability> = Object.fromEntries(
	(Object.entries(ABILITY_ABBREVIATIONS) as [Ability, AbilityAbbreviation][]).map(([full, abbr]) => [abbr, full]),
) as Record<AbilityAbbreviation, Ability>

const ABILITY_FULL_NAME: Record<AbilityAbbreviation, string> = {
	str: 'Strength',
	dex: 'Dexterity',
	con: 'Constitution',
	int: 'Intelligence',
	wis: 'Wisdom',
	cha: 'Charisma',
}

/** "Elf; Drow Lineage" -> "Elf"; "Dragonborn (Red)" -> "Dragonborn"; anything else -> itself. */
function speciesBaseName(speciesName: string): string {
	const semi = speciesName.indexOf(';')
	if (semi !== -1) return speciesName.slice(0, semi).trim()
	const paren = speciesName.indexOf('(')
	if (paren !== -1) return speciesName.slice(0, paren).trim()
	return speciesName
}

/** "Elf; Drow Lineage" -> "drow"; "Elf" -> null (no subrace named). */
function speciesSubraceKey(speciesName: string): string | null {
	const semi = speciesName.indexOf(';')
	if (semi === -1) return null
	const variant = speciesName.slice(semi + 1).trim()
	const firstWord = variant.split(' ')[0]
	return firstWord ? firstWord.toLowerCase() : null
}

function matchesRace(race: { name: string; subrace?: string }, ctx: PrerequisiteContext): boolean {
	if (!ctx.speciesName) return false
	if (race.name === 'small race') return ctx.speciesSize === 'S'
	const base = speciesBaseName(ctx.speciesName).toLowerCase()
	const matchesFamily = base === race.name || ctx.speciesRaceTags.includes(race.name)
	if (!matchesFamily) return false
	if (!race.subrace) return true
	return speciesSubraceKey(ctx.speciesName) === race.subrace.toLowerCase()
}

function describeRaceAlternatives(race: { name: string; subrace?: string; displayEntry?: string }[]): string {
	return race.map((r) => r.displayEntry ?? (r.subrace ? `${r.subrace} ${r.name}` : r.name)).join(' or ')
}

/** Evaluates one prerequisite entry (every present key AND'd). Returns the unmet reason, or null if the entry is fully satisfied. */
function evaluateEntry(entry: RawFeatPrerequisiteEntry, ctx: PrerequisiteContext): string | null {
	// otherSummary never combines with another key in the data (2 feats, both Fighting-Style-timing prose)
	// — shown verbatim rather than folded into the "Requires ..." list below.
	if (entry.otherSummary) return entry.otherSummary.entry

	const failures: string[] = []

	if (entry.level !== undefined && ctx.characterLevel < entry.level) {
		failures.push(`character level ${entry.level}`)
	}
	if (entry.ability) {
		for (const abilityReq of entry.ability) {
			for (const [abbr, min] of Object.entries(abilityReq) as [AbilityAbbreviation, number][]) {
				const score = ctx.abilityScores[ABBREV_TO_ABILITY[abbr]]
				if (score === undefined || score < min) failures.push(`${ABILITY_FULL_NAME[abbr]} ${min}+`)
			}
		}
	}
	// Only "Fighting Style" occurs as a `feature` prerequisite value (confirmed, scripts/investigate-feat-structured-fields.js).
	if (entry.feature?.includes('Fighting Style') && !ctx.hasFightingStyleFeature) {
		failures.push('the Fighting Style feature')
	}
	if (entry.race && !entry.race.some((r) => matchesRace(r, ctx))) {
		failures.push(`species: ${describeRaceAlternatives(entry.race)}`)
	}
	if (entry.spellcasting2020 && !ctx.hasSpellcasting) {
		failures.push('a spellcasting class')
	}
	if (entry.proficiency) {
		for (const p of entry.proficiency) {
			if (p.weapon && !ctx.weaponProficiencies.includes(p.weapon)) failures.push(`proficiency with ${p.weapon} weapons`)
			if (p.armor && !ctx.armorProficiencies.includes(p.armor)) failures.push(`proficiency with ${p.armor} armor`)
		}
	}
	if (entry.feat) {
		for (const featRef of entry.feat) {
			const [name, source] = featRef.split('|')
			const has = ctx.chosenFeats.some(
				(f) => f.name.toLowerCase() === name.toLowerCase() && (!source || f.source.toLowerCase() === source.toLowerCase()),
			)
			if (!has) failures.push(`the feat "${name}"`)
		}
	}
	if (entry.featCategory) {
		for (const cat of entry.featCategory) {
			if (!ctx.chosenFeats.some((f) => f.category === cat)) failures.push(`a feat from category ${cat}`)
		}
	}
	if (entry.campaign) {
		failures.push(`the ${entry.campaign.join('/')} campaign setting (not tracked by this app)`)
	}

	return failures.length > 0 ? `Requires ${failures.join(', ')}.` : null
}

/**
 * D19: the feat list is never filtered by category — every feat is offered,
 * ineligible ones say why. `feat.prerequisite` (when present) is an array of
 * alternatives; the feat is eligible if ANY one alternative is fully met.
 */
export function evaluateFeatPrerequisites(feat: FeatEntry, ctx: PrerequisiteContext): PrerequisiteResult {
	if (!feat.prerequisite || feat.prerequisite.length === 0) return { eligible: true, reasons: [] }

	const reasons = feat.prerequisite.map((entry) => evaluateEntry(entry, ctx)).filter((r): r is string => r !== null)
	const eligible = reasons.length < feat.prerequisite.length
	return { eligible, reasons: eligible ? [] : reasons }
}
