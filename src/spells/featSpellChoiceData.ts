/*
 * Generic filter-choice spell picker data layer (build order step 6, slice
 * d5b-1 — the LAST feat-spell picker). Covers the 8 REACHABLE filter-choice
 * spell-granting feats confirmed by
 * scripts/investigate-filter-choice-picker-shape.js: Artificer Initiate,
 * Blessed Warrior, Druidic Warrior, Wood Elf Magic, Aberrant Dragonmark
 * (class-list filter), Fey-Touched, Shadow-Touched (school filter), and
 * Ritual Caster (ritual-tag filter).
 *
 * investigate-feat-spell-choice-shapes.js groups 11 feats this way, but 3 of
 * those ("Magic Initiate; Cleric/Druid/Wizard") are permanently hidden from
 * the feat picker (featAsiData.ts HIDDEN_FEAT_KEYS — base Magic Initiate/
 * d5b-2 replaces them with its own class-list choice) and so can never be
 * selected by a character; they need no picker. Boon of Siberys is a
 * distinct shape (13 named alternatives) and stays separately deferred.
 *
 * All 8 feats' `choose` nodes share one string mini-language,
 * "level=N|<filter>", nested under `known` (always a cantrip, N=0) or
 * `innate`/`prepared` (always a level-1 spell, N=1) — confirmed by the
 * investigate script. `<filter>` is one of three clauses: `class=<Name>`
 * (case varies in the data — Blessed Warrior/Druidic Warrior use lowercase,
 * resolved via CLASS_NAME_LOOKUP, scoped to only the 4 classes these feats
 * reference), `school=<Code>;<Code>` (spells.json's own single-letter school
 * code — E/D/I/N etc. — matched directly, no name mapping needed), or the
 * literal `components & miscellaneous=ritual` (Ritual Caster).
 *
 * Ritual Caster's `count` field is deliberately NOT read from the data —
 * the investigate script confirmed the level-keyed cumulative counts (2 at
 * level 1, +1 at 5/9/13/17) exactly track proficiencyBonusForLevel at those
 * same thresholds, so this module exposes ritualCasterSpellCount() instead
 * of re-deriving the level-gated structure from feats.json.
 */

import { proficiencyBonusForLevel } from '../calculation/proficiencyBonus'
import { loadDataFile } from '../dataLoader/dataLoader'
import { extractClassSpellList } from './classSpellListData'

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export type SpellChoiceFilter = { kind: 'class'; className: string; classSource: string } | { kind: 'school'; schools: string[] } | { kind: 'ritual' }

export interface SpellChoiceSlot {
	/** 0 = cantrip, 1 = level-1 spell — both this module's slots are always one or the other (confirmed by the investigate script). */
	level: number
	filter: SpellChoiceFilter
	/** Fixed pick count for a class/school slot; always `null` for Ritual Caster's ritual slot — see module comment, its count comes from proficiency bonus instead. */
	count: number | null
}

export interface FilterChoiceFeatShape {
	/** From `known`, always level 0. Null for the 2 feats (Fey-Touched, Shadow-Touched) that grant no cantrip. */
	cantripSlot: SpellChoiceSlot | null
	/** From `innate`/`prepared`, always level 1. Null for the cantrip-only feats (Blessed Warrior, Druidic Warrior). */
	spellSlot: SpellChoiceSlot | null
}

/** Maps a `class=` clause's class name (case varies in the data) to the identity classSpellListData.ts needs — scoped to only the 4 classes the 8 in-scope feats reference (D46), not a general class-name resolver. */
const CLASS_NAME_LOOKUP: Record<string, { className: string; classSource: string }> = {
	cleric: { className: 'Cleric', classSource: 'XPHB' },
	druid: { className: 'Druid', classSource: 'XPHB' },
	artificer: { className: 'Artificer', classSource: 'EFA' },
	sorcerer: { className: 'Sorcerer', classSource: 'XPHB' },
}

interface RawChooseNode {
	choose: string
	count?: number
}

function isChooseNode(value: unknown): value is RawChooseNode {
	return isRecord(value) && typeof value['choose'] === 'string'
}

function findChooseNodes(value: unknown): RawChooseNode[] {
	if (isChooseNode(value)) return [value]
	if (Array.isArray(value)) return value.flatMap(findChooseNodes)
	if (isRecord(value)) return Object.values(value).flatMap(findChooseNodes)
	return []
}

function parseFilterClause(clause: string): SpellChoiceFilter | null {
	if (clause.startsWith('class=')) {
		const identity = CLASS_NAME_LOOKUP[clause.slice('class='.length).toLowerCase()]
		return identity ? { kind: 'class', ...identity } : null
	}
	if (clause.startsWith('school=')) {
		return { kind: 'school', schools: clause.slice('school='.length).split(';') }
	}
	if (clause === 'components & miscellaneous=ritual') return { kind: 'ritual' }
	return null
}

/** Parses one `{choose: "level=N|filter"}` node into a slot, or null if the mini-language doesn't parse (unexpected shape — skip cleanly, D43). */
function parseChooseNode(node: RawChooseNode): SpellChoiceSlot | null {
	const match = /^level=(\d+)\|(.+)$/.exec(node.choose)
	if (!match) return null
	const filter = parseFilterClause(match[2])
	if (!filter) return null
	return { level: Number(match[1]), filter, count: filter.kind === 'ritual' ? null : (node.count ?? 1) }
}

interface RawFeatEntry {
	name: string
	source: string
	additionalSpells?: unknown
}

function isRawFeatEntry(value: unknown): value is RawFeatEntry {
	return isRecord(value) && typeof value['name'] === 'string' && typeof value['source'] === 'string'
}

/** The 8 feats this picker covers — see module comment for why the group is smaller than investigate-feat-spell-choice-shapes.js's raw count of "11". */
export const FILTER_CHOICE_FEAT_KEYS = new Set([
	'Artificer Initiate|TCE',
	'Blessed Warrior|XPHB',
	'Druidic Warrior|XPHB',
	'Wood Elf Magic|XGE',
	'Aberrant Dragonmark|EFA',
	'Fey-Touched|XPHB',
	'Shadow-Touched|XPHB',
	'Ritual Caster|XPHB',
])

export function isFilterChoiceFeat(feat: { name: string; source: string }): boolean {
	return FILTER_CHOICE_FEAT_KEYS.has(`${feat.name}|${feat.source}`)
}

function findFeat(parsedFeats: unknown, featName: string, featSource: string): RawFeatEntry | undefined {
	if (!Array.isArray(parsedFeats)) {
		throw new Error('feats.json: expected a top-level array.')
	}
	return parsedFeats.find((c): c is RawFeatEntry => isRawFeatEntry(c) && c.name === featName && c.source === featSource)
}

/**
 * Pure filter (D38). One named feat's cantrip/spell choice slots, read from
 * feats.json's `additionalSpells` — both null if the feat isn't found, isn't
 * in FILTER_CHOICE_FEAT_KEYS, or its `choose` nodes don't parse. `known`'s
 * node is always the cantrip slot; the first `choose` node found anywhere
 * under `innate`/`prepared` is the spell slot (Ritual Caster's 5 level-keyed
 * copies of the same clause collapse to one — see module comment on why the
 * data's own per-level counts aren't read).
 */
export function filterChoiceFeatShape(parsedFeats: unknown, featName: string, featSource: string): FilterChoiceFeatShape {
	const empty: FilterChoiceFeatShape = { cantripSlot: null, spellSlot: null }
	if (!isFilterChoiceFeat({ name: featName, source: featSource })) return empty

	const feat = findFeat(parsedFeats, featName, featSource)
	const entry = feat && Array.isArray(feat.additionalSpells) ? feat.additionalSpells[0] : undefined
	if (!isRecord(entry)) return empty

	const knownNode = findChooseNodes(entry['known'])[0]
	const spellNode = findChooseNodes(entry['innate'])[0] ?? findChooseNodes(entry['prepared'])[0]

	return {
		cantripSlot: knownNode ? parseChooseNode(knownNode) : null,
		spellSlot: spellNode ? parseChooseNode(spellNode) : null,
	}
}

export async function loadFilterChoiceFeatShape(featName: string, featSource: string): Promise<FilterChoiceFeatShape> {
	const parsed = await loadDataFile('data/feats.json')
	return filterChoiceFeatShape(parsed, featName, featSource)
}

/** Ritual Caster's slot count (module comment) — proficiency bonus, computed once here so callers don't reimplement the calculation-layer formula. */
export function ritualCasterSpellCount(totalCharacterLevel: number): number {
	return proficiencyBonusForLevel(totalCharacterLevel)
}

/**
 * Each of the 8 feats' required pick counts, by `${name}|${source}` — a
 * small closed table (not re-derived from feats.json) so the wizard's
 * step-completeness check (wizardState.ts) can stay synchronous, the same
 * way MAGIC_INITIATE_CLASS_OPTIONS in featAsiData.ts is a hardcoded table
 * rather than an async re-parse. Matches filterChoiceFeatShape's own counts
 * (confirmed by scripts/investigate-filter-choice-picker-shape.js) — a feat
 * only ever fills one of cantrips/spells except the 3 class-list feats that
 * grant both a cantrip and a level-1 spell.
 */
const FILTER_CHOICE_REQUIRED_COUNTS: Record<string, { cantrips: number; spells: number | 'proficiencyBonus' }> = {
	'Artificer Initiate|TCE': { cantrips: 1, spells: 1 },
	'Blessed Warrior|XPHB': { cantrips: 2, spells: 0 },
	'Druidic Warrior|XPHB': { cantrips: 2, spells: 0 },
	'Wood Elf Magic|XGE': { cantrips: 1, spells: 0 },
	'Aberrant Dragonmark|EFA': { cantrips: 1, spells: 1 },
	'Fey-Touched|XPHB': { cantrips: 0, spells: 1 },
	'Shadow-Touched|XPHB': { cantrips: 0, spells: 1 },
	'Ritual Caster|XPHB': { cantrips: 0, spells: 'proficiencyBonus' },
}

/** The exact cantrip/spell counts a completed pick for this feat must have, or null if the feat isn't one of the 8. */
export function filterChoiceRequiredCounts(featName: string, featSource: string, totalCharacterLevel: number): { cantrips: number; spells: number } | null {
	const entry = FILTER_CHOICE_REQUIRED_COUNTS[`${featName}|${featSource}`]
	if (!entry) return null
	return { cantrips: entry.cantrips, spells: entry.spells === 'proficiencyBonus' ? ritualCasterSpellCount(totalCharacterLevel) : entry.spells }
}

interface RawSpellForFilter {
	name: string
	source: string
	level: number
	school?: string
	meta?: { ritual?: boolean }
}

function isRawSpellForFilter(value: unknown): value is RawSpellForFilter {
	return isRecord(value) && typeof value['name'] === 'string' && typeof value['source'] === 'string' && typeof value['level'] === 'number'
}

export interface FilterChoiceCandidateSpell {
	name: string
	source: string
}

/** Pure filter (D38): every spell offered for one slot — a class-list slot reuses classSpellListData.ts (slice c); school/ritual slots read spells.json directly since they aren't scoped to a class. Guided (task decision): only spells matching the slot's filter AND level are ever offered. */
export function offeredSpellsForSlot(parsedSpells: unknown, slot: SpellChoiceSlot): FilterChoiceCandidateSpell[] {
	if (slot.filter.kind === 'class') {
		return extractClassSpellList(parsedSpells, slot.filter.className, slot.filter.classSource)
			.filter((s) => s.level === slot.level)
			.map((s) => ({ name: s.name, source: s.source }))
	}

	if (!Array.isArray(parsedSpells)) {
		throw new Error('spells.json: expected a top-level array.')
	}
	const atLevel = parsedSpells.filter(isRawSpellForFilter).filter((s) => s.level === slot.level)

	if (slot.filter.kind === 'school') {
		const schools = slot.filter.schools
		return atLevel.filter((s) => s.school !== undefined && schools.includes(s.school)).map((s) => ({ name: s.name, source: s.source }))
	}

	return atLevel.filter((s) => s.meta?.ritual === true).map((s) => ({ name: s.name, source: s.source }))
}

export async function loadSlotCandidates(slot: SpellChoiceSlot): Promise<FilterChoiceCandidateSpell[]> {
	const parsed = await loadDataFile('data/spells.json')
	return offeredSpellsForSlot(parsed, slot)
}
