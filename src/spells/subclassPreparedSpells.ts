/*
 * Subclass always-prepared spells (build order step 6, slices d2b and d6a):
 * the domain/oath/circle spells a subclass grants outright at a given class
 * level. Not preparation, not a picker choice — these are DERIVED from
 * subclass + level and are not stored (confirmed with the user); a caller
 * recomputes them from whatever is already on the Character.
 *
 * D62 (d2b) handled only the `prepared` shape. D6a extends the same
 * derived-lookup treatment to the `known` and `innate` shapes (and a
 * subclass that mixes any of the three) — same fixed-grant kind of data,
 * just filed under a different label. `expanded` is deliberately never
 * read here (see below); a subclass whose additionalSpells uses only
 * `expanded` still returns nothing, cleanly.
 *
 * These spells are ADDITIONAL to the class spell picker's own
 * cantrip/prepared/known counts (slice d2) — they never add to or subtract
 * from those counts, and must be kept out of Character.spellChoices, a
 * separate, player-chosen list.
 *
 * Shape confirmed via scripts/investigate-prepared-shape.js (D46, d2b) and
 * scripts/investigate-d6a-shapes.js + investigate-d6a-other-shapes.js (d6a),
 * against all subclass additionalSpells entries:
 *
 * - `prepared`/`known`/`innate` are each an object keyed by class level
 *   ("3", "5", ...), each value normally an array of spell references.
 *   Never an array itself.
 * - A spell reference is almost always a bare lowercase name ("identify") or
 *   "name|source" ("healing word|xphb"), occasionally with a trailing
 *   "#..." tag ("mind sliver|xphb#c") that is not part of the source code
 *   and is stripped before matching.
 * - ONE exception found in `prepared` (d2b): Bard College of Lore, level 6,
 *   carries a nested choice object instead of a spell name —
 *   `{"choose":"level=0;1;2;3|class=Cleric;Druid;Wizard"}`. That is a
 *   player choice from other classes' lists, not a fixed always-prepared
 *   spell, and is outside what this module covers (deferred to d6b) — a
 *   non-string item in a level's array is skipped cleanly here, same as any
 *   other unhandled shape.
 * - d6a: 5 subclasses (Artificer Alchemist [EFA], Barbarian Path of the
 *   Wild Heart, Fighter Psi Warrior, Warlock The Fathomless, Monk Way of
 *   the Sun Soul/Warrior of Shadow) wrap a level's spell list one nesting
 *   deeper, under a `resource`/`daily`/`ritual` key whose own sub-key (an
 *   ability code, a count, ...) this app has nowhere to track a per-day/
 *   ritual usage limit anyway — unwrapped one level and treated as a plain
 *   grant, same as a flat array.
 * - d6a: Warlock Archfey Patron keys its one innate grant `"_"` instead of
 *   a class level — `Number("_")` is not finite, so the existing level-gate
 *   check dropped it (recorded here as intentional, then found to be a bug —
 *   see the follow-up entry below).
 * - Follow-up (this task): `"_"` is featSpells.ts's OWN convention for "always
 *   granted", read on the identical `additionalSpells` field (Drow High
 *   Magic, Fey Teleportation). A subclass has no "always" — it only exists
 *   from the level the character took it — so `"_"` here means "granted from
 *   the level the subclass itself is granted", read via subclassData.ts's
 *   `subclassLevelFor` (the same class-features.json lookup the subclass
 *   picker already uses, not a hardcoded 3 — Warlock happens to land on 3
 *   too, like all 13 classes, but nothing here assumes that). Scope checked
 *   (scripts/investigate-underscore-key-subclasses.js): of 302 numeric-keyed
 *   grants across every subclass's `prepared`/`known`/`innate`, exactly ONE
 *   `"_"` key exists in the whole data set — Archfey Patron's — and zero
 *   other unparseable keys, so the fix affects only Archfey today; it is
 *   still written generically (any subclass using `"_"` gets the same
 *   treatment), not name-guarded. A key that is neither numeric nor `"_"`
 *   still skips cleanly (D43) — this is not "anything unparseable means
 *   always granted".
 * - d6a: `expanded` is NOT read for the generic prepared/known/innate loop,
 *   on purpose — it hides several different things: (1) EK/Arcane
 *   Trickster/Divine Soul/the 12 Eberron marks use it to WIDEN a class
 *   spell picker's offered pool, not to grant fixed spells — a d2-picker
 *   change, not this module's kind of work (also confirmed the marks
 *   reuse the SAME "s1".."s5" key shape as (2) below for that unrelated
 *   pool-widening purpose — the rules text decided that, not the shape,
 *   see docs/STATUS.md); (2) three Warlock patrons (Celestial, Hexblade,
 *   Fathomless) grant fixed patron-boon spells under it, keyed by pact
 *   slot RANK ("s1".."s5") rather than class level; (3) Warlock The Genie
 *   has 4 separate additionalSpells entries, one per genie kind (Dao/
 *   Djinni/Efreeti/Marid), and nothing in this app stores which kind the
 *   player picked.
 * - Follow-up (this task): (2) is now handled by
 *   `extractRankGrantAlwaysPreparedSpells` below, given the Warlock's own
 *   `pactSlotsByLevel` table (spellSlots.ts) as the rank->level source of
 *   truth (a rank is granted once the character's pact slot level first
 *   reaches it — reads the same table spellSlots.ts already computes from,
 *   never a second hardcoded copy). Scope checked against the real data
 *   (scripts/investigate-patron-rank-spells.js,
 *   investigate-celestial-all-entries.js,
 *   investigate-hexblade-fathomless-all-entries.js,
 *   investigate-celestial-reprint.js, investigate-genie-expanded.js):
 *   Celestial's rank-keyed entry is "The Celestial" (XGE) — superseded by
 *   `reprintedAs` in favour of "Celestial Patron" (XPHB), whose OWN
 *   additionalSpells uses the already-handled `prepared` shape (class-level
 *   keyed), so the XGE entry is never reached by subclassData.ts's D31
 *   dedup and Celestial needed no change here. Hexblade and Fathomless have
 *   only the one, XPHB-classSource'd subclass entry each, and it genuinely
 *   only carries the rank-keyed `expanded` grant — so both are handled by
 *   this follow-up. The Genie's 4-entries-per-subclass ambiguity (3) is
 *   guarded structurally (a subclass with more than one additionalSpells
 *   entry is skipped for rank grants), not by name, and stays deferred.
 * - Two of 406 string references don't resolve against this app's filtered
 *   spells.json (e.g. "branding smite", not present in any allowed source)
 *   — skipped cleanly (D43), not an error.
 *
 * Bug fix (this task): a spell reachable via TWO grant paths was emitted
 * twice. Confirmed real for College of Glamour (Bard, XPHB) — "Command" sits
 * under BOTH `prepared["6"]` and `innate["6"]` in the SAME additionalSpells
 * entry (scripts/investigate-glamour-duplicate-2.js) — the FIXED_GRANT_KEYS
 * loop above visits both keys and pushes it twice. The reported Divine Soul/
 * Bless case did NOT reproduce on investigation (extractSubclassAlwaysPreparedSpells
 * returns Bless exactly once for Divine Soul, verified directly against the
 * real data via three independent checks — see docs/REPORT.md), but the
 * mechanism is the same class of bug, so the fix is general: `dedupeAlwaysPreparedSpells`
 * collapses the result by spell identity (name+source) before it's returned,
 * keeping the LOWEST `grantedAtLevel` seen (the spell is available as soon as
 * ANY path grants it) rather than picking a path arbitrarily.
 */

import type { AbilityAbbreviation } from '../calculation/abilityAbbreviations'
import type { PactSlots } from '../calculation/spellSlots'
import { loadDataFile } from '../dataLoader/dataLoader'
import { subclassLevelFor } from '../subclass/subclassData'

/**
 * How a granted spell is actually cast, read from the `will`/`daily`/`ritual`/
 * `resource` wrapper keys additionalSpells nests around some grants (this
 * task, D46 — scripts/investigate-spell-usage-wrappers.js). Formatting is the
 * sheet's job (spellFormatting.ts); this is the structured fact only.
 *
 * - `atWill`: the `will` key. Only real occurrence: Drow High Magic's detect
 *   magic (feat).
 * - `daily`/`dailyEach`: the `daily` key's sub-key is a plain count ("2" — N
 *   times per day total) or a count+"e" ("2e" — N times per day EACH spell in
 *   the list separately, confirmed against Drow High Magic's "once each per
 *   day" phrasing).
 * - `dailyByAbility`: the `daily` key's sub-key names an ability code
 *   ("cha", "int") instead of a count — N/day where N is that ability's
 *   modifier (Archfey Patron's Misty Step, Artificer Alchemist's Lesser
 *   Restoration). The modifier itself is not computed here (no ability
 *   score is threaded through this module) — the sheet shows which ability,
 *   not a number.
 * - `ritual`: the `ritual` key — cast as a ritual instead of spending a slot
 *   (Pact of the Chain, Path of the Wild Heart).
 * - `resource`: the `resource` key — costs `cost` points of the
 *   additionalSpells entry's own `resourceName` field (Monk's "Ki"/"Focus
 *   Point"), not a per-day count.
 * - `onceFreePerLongRest`: NOT read from a wrapper either. The term for a
 *   LEVELED spell the player picked for Magic Initiate / Artificer Initiate /
 *   Fey-Touched / Shadow-Touched (chosenSpellUsage.ts, D21/D70) — "cast it
 *   once without a spell slot, regain when you finish a Long Rest, may also
 *   cast it with a slot". Distinct from `noSlot` (which carries no frequency)
 *   and from `daily` (per day, not per long rest); `noSlot`/`atWill` here
 *   would overstate what the player may do.
 * - `noSlot`: NOT read from a wrapper at all. Warlock Eldritch Invocations
 *   (optionalFeatureSpells.ts's only caller) grant every one of their spells
 *   without a slot, but 12 of 17 encode this only in prose, as a BARE grant
 *   with no wrapper at all — confirmed individually against each one's own
 *   text (docs/REPORT.md lists the phrase for each) rather than inferred from
 *   the JSON shape, since a bare grant from a SUBCLASS is not reliably
 *   slot-free the same way (College of Glamour's bare `innate` Command is an
 *   ordinary, slot-cast duplicate of its own `prepared` grant). The frequency
 *   ("once per long rest", etc.) is deliberately NOT parsed out of the prose —
 *   only the yes/no "no slot" fact was verified, since a wrong frequency
 *   printed on the sheet is worse than none (Daniel's decision, this task).
 *   `extractRefsWithUsage`'s bare-array branch never produces this on its
 *   own — a caller opts in via its `bareUsage` argument.
 */
export type SpellUsage =
	| { kind: 'atWill' }
	| { kind: 'daily'; count: number }
	| { kind: 'dailyEach'; count: number }
	| { kind: 'dailyByAbility'; ability: AbilityAbbreviation }
	| { kind: 'ritual' }
	| { kind: 'resource'; cost: number; resourceName: string }
	| { kind: 'noSlot' }
	| { kind: 'onceFreePerLongRest' }

export interface AlwaysPreparedSpell {
	name: string
	source: string
	/** The spell's own level (0 = cantrip). */
	level: number
	/** The class level at which the subclass grants this spell. */
	grantedAtLevel: number
	ritual: boolean
	concentration: boolean
	/** Provenance (per the sheet's planned "always prepared (subclass)" label, slice d4): always the subclass, never a player pick. */
	origin: 'subclass'
	/** How this spell is cast (this task) — undefined/null for an ordinary grant, cast with a slot like any other prepared/known spell (no wrapper found). */
	usage?: SpellUsage | null
}

/** Exported for reuse by featSpells.ts (d5a) — feat-granted spells use the same additionalSpells shape as subclasses. */
export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

interface RawSubclassEntry {
	entryType: string
	name: string
	source: string
	className: string
	classSource: string
	additionalSpells?: unknown
}

function isRawSubclassEntry(value: unknown): value is RawSubclassEntry {
	if (!isRecord(value)) return false
	return (
		value['entryType'] === 'subclass' &&
		typeof value['name'] === 'string' &&
		typeof value['source'] === 'string' &&
		typeof value['className'] === 'string' &&
		typeof value['classSource'] === 'string'
	)
}

export interface RawSpell {
	name: string
	source: string
	level: number
	duration?: unknown
	meta?: { ritual?: boolean }
}

export function isRawSpell(value: unknown): value is RawSpell {
	if (!isRecord(value)) return false
	return typeof value['name'] === 'string' && typeof value['source'] === 'string' && typeof value['level'] === 'number'
}

export function hasConcentration(duration: unknown): boolean {
	if (!Array.isArray(duration)) return false
	return duration.some((entry) => isRecord(entry) && entry['concentration'] === true)
}

/** Parses a `prepared` list item ("healing word", "healing word|xphb", "mind sliver|xphb#c") into a lowercase name and optional uppercase source. */
export function parseSpellRef(ref: string): { name: string; source: string | null } {
	const [namePart, sourcePart] = ref.split('|')
	const source = sourcePart ? sourcePart.split('#')[0].toUpperCase() : null
	return { name: namePart.toLowerCase(), source }
}

export function findSpell(spells: RawSpell[], ref: { name: string; source: string | null }): RawSpell | undefined {
	return spells.find((s) => s.name.toLowerCase() === ref.name && (ref.source === null || s.source.toUpperCase() === ref.source))
}

/** The fixed-grant keys this module derives spells from. `expanded` is deliberately excluded — see module comment. */
const FIXED_GRANT_KEYS = ['prepared', 'known', 'innate'] as const

/** Case/format-normalized spell identity key, shared with featSpells.ts so both modules dedupe the same way. */
export function spellIdentityKey(name: string, source: string): string {
	return `${name.toLowerCase()}|${source.toUpperCase()}`
}

/**
 * Collapses a spell reachable via more than one grant path (module comment
 * above — confirmed real for College of Glamour's Command) down to one entry
 * per spell identity, keeping the LOWEST `grantedAtLevel` seen rather than an
 * arbitrary path's value. Order-preserving (first occurrence's position is
 * kept) so callers that care about display order aren't disturbed.
 */
export function dedupeAlwaysPreparedSpells(spells: AlwaysPreparedSpell[]): AlwaysPreparedSpell[] {
	const byKey = new Map<string, AlwaysPreparedSpell>()
	for (const spell of spells) {
		const key = spellIdentityKey(spell.name, spell.source)
		const existing = byKey.get(key)
		if (!existing || spell.grantedAtLevel < existing.grantedAtLevel) byKey.set(key, spell)
	}
	return [...byKey.values()]
}

/** Parses an `expanded` level key as a pact slot RANK ("s1".."s5" -> 1..5); any other key (a class-level key, or Genie's stray "9") is not this shape. */
function parsePactSlotRankKey(levelKey: string): number | null {
	const match = /^s([1-5])$/.exec(levelKey)
	return match ? Number(match[1]) : null
}

/**
 * The character level at which a Warlock's pact slot level first reaches
 * `rank`, read off the class's own `pactSlotsByLevel` table (spellSlots.ts's
 * `PactSlots` — the source of truth, never a second hardcoded table).
 * `slotLevel` rises monotonically (1st/1, 3rd/2, 5th/3, 7th/4, 9th/5 for a
 * single-class Warlock), so the first row reaching `rank` is the level it
 * unlocks at. Returns null if the table doesn't reach that rank (D43: skip
 * cleanly).
 */
export function levelForPactSlotRank(rank: number, pactSlotsByLevel: PactSlots[]): number | null {
	const index = pactSlotsByLevel.findIndex((row) => row.slotLevel >= rank)
	return index === -1 ? null : index + 1
}

/**
 * A level's value is normally a flat array of spell references. d6a found 5
 * subclasses wrap it two levels deeper instead, under a `resource`/`daily`/
 * `ritual` key whose own value is keyed again by an ability code or a count
 * (e.g. `{"daily":{"1":["telekinesis"]}}`, `{"resource":{"2":["burning
 * hands"]}}`) — that per-day/ritual usage limit is tracked nowhere else in
 * this app, so both wrapper keys are discarded and every string found at
 * any depth is treated as a plain grant, same as a flat array.
 *
 * Exported for reuse by featSpells.ts (d5a) — Drow High Magic and Fey
 * Teleportation wrap their `innate` grant the same way (an ability-code/
 * count key, not a class level), and don't need the level-gate this
 * module's own callers apply.
 */
export function extractRefs(value: unknown): string[] {
	if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string')
	if (!isRecord(value)) return []
	return Object.values(value).flatMap(extractRefs)
}

/** A daily sub-key's usage, or null for a shape not recognised (D43-style — the ref is still extracted by the caller, just with no usage label). */
function parseDailySubkey(subkey: string): SpellUsage | null {
	const eachMatch = /^(\d+)e$/.exec(subkey)
	if (eachMatch) return { kind: 'dailyEach', count: Number(eachMatch[1]) }
	if (/^\d+$/.test(subkey)) return { kind: 'daily', count: Number(subkey) }
	if ((['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).includes(subkey as AbilityAbbreviation)) {
		return { kind: 'dailyByAbility', ability: subkey as AbilityAbbreviation }
	}
	return null
}

export interface RefWithUsage {
	ref: string
	usage: SpellUsage | null
}

/**
 * Same traversal as `extractRefs`, but also captures the usage wrapper
 * immediately around each literal ref (module comment on `SpellUsage` above).
 * `resourceName` is the additionalSpells entry's own field, needed only to
 * label a `resource` grant — undefined elsewhere. `bareUsage` is the usage
 * attached to a ref with NO wrapper at all: null for subclasses/feats
 * (today's silent "ordinary, cast with a slot" meaning), or `{kind:'noSlot'}`
 * for optionalFeatureSpells.ts's chosen-optional-feature grants (see
 * `SpellUsage`'s `noSlot` doc). A wrapper key this function doesn't
 * recognise (e.g. `rest`, which in the real data only ever wraps a
 * player-choice node with no literal ref inside it) still yields any literal
 * refs found beneath it, with no usage attached, rather than dropping the
 * spell (D43).
 */
export function extractRefsWithUsage(value: unknown, resourceName: string | undefined, bareUsage: SpellUsage | null): RefWithUsage[] {
	if (Array.isArray(value)) {
		return value.filter((item): item is string => typeof item === 'string').map((ref) => ({ ref, usage: bareUsage }))
	}
	if (!isRecord(value)) return []

	const result: RefWithUsage[] = []
	for (const [wrapperKey, wrapperValue] of Object.entries(value)) {
		if (wrapperKey === 'will') {
			for (const ref of extractRefs(wrapperValue)) result.push({ ref, usage: { kind: 'atWill' } })
		} else if (wrapperKey === 'daily' && isRecord(wrapperValue)) {
			for (const [subkey, subvalue] of Object.entries(wrapperValue)) {
				const usage = parseDailySubkey(subkey)
				for (const ref of extractRefs(subvalue)) result.push({ ref, usage })
			}
		} else if (wrapperKey === 'ritual') {
			for (const ref of extractRefs(wrapperValue)) result.push({ ref, usage: { kind: 'ritual' } })
		} else if (wrapperKey === 'resource' && isRecord(wrapperValue)) {
			for (const [subkey, subvalue] of Object.entries(wrapperValue)) {
				const cost = Number(subkey)
				const usage: SpellUsage | null = Number.isFinite(cost) && resourceName ? { kind: 'resource', cost, resourceName } : null
				for (const ref of extractRefs(subvalue)) result.push({ ref, usage })
			}
		} else {
			for (const ref of extractRefs(wrapperValue)) result.push({ ref, usage: null })
		}
	}
	return result
}

/**
 * Pure filter (D38). Takes ONE subclass identity plus the character's level
 * in that class (D11 — a multiclass caller unions per class, not built
 * here) and the parsed classes.json / spells.json arrays. Returns the
 * subclass's always-prepared spells granted at or below that level, from
 * the `prepared`/`known`/`innate` shapes (D62, d6a) plus (this task) a
 * pact-slot-RANK-keyed `expanded` grant (Hexblade/Fathomless) — every other
 * use of `expanded` (pool-widening, Genie's per-kind ambiguity) still
 * yields nothing (see module comment). `pactSlotsByLevel` (optional —
 * absent for a non-Warlock class) is the Warlock's own Pact Magic slot
 * table (spellSlots.ts), needed only to translate a rank grant's level.
 * `subclassGrantLevel` (optional) is the level `className`/`classSource`
 * grants a subclass choice (subclassData.ts's `subclassLevelFor`), needed
 * only to resolve a `"_"`-keyed grant (module comment) — absent or null
 * means a `"_"` key is skipped cleanly rather than guessed (D43).
 */
export function extractSubclassAlwaysPreparedSpells(
	parsedClasses: unknown,
	parsedSpells: unknown,
	subclassName: string,
	subclassSource: string,
	className: string,
	classSource: string,
	classLevel: number,
	pactSlotsByLevel?: PactSlots[],
	subclassGrantLevel?: number | null,
): AlwaysPreparedSpell[] {
	if (!Array.isArray(parsedClasses)) {
		throw new Error('classes.json: expected a top-level array.')
	}
	if (!Array.isArray(parsedSpells)) {
		throw new Error('spells.json: expected a top-level array.')
	}

	const subclass = parsedClasses.find(
		(candidate): candidate is RawSubclassEntry =>
			isRawSubclassEntry(candidate) &&
			candidate.name === subclassName &&
			candidate.source === subclassSource &&
			candidate.className === className &&
			candidate.classSource === classSource,
	)
	if (!subclass || !Array.isArray(subclass.additionalSpells)) return []

	const spells = parsedSpells.filter(isRawSpell)
	const result: AlwaysPreparedSpell[] = []

	for (const entry of subclass.additionalSpells) {
		if (!isRecord(entry)) continue

		for (const key of FIXED_GRANT_KEYS) {
			const levelMap = entry[key]
			if (levelMap === undefined) continue
			if (!isRecord(levelMap)) continue // unexpected variant of the key itself — skip cleanly, don't invent handling.

			for (const [levelKey, value] of Object.entries(levelMap)) {
				let grantedAtLevel: number
				if (levelKey === '_') {
					// "_" means always granted (featSpells.ts reads the same key the same way) — for a subclass that's "from the level the subclass itself was granted", not every level.
					if (subclassGrantLevel === undefined || subclassGrantLevel === null) continue // can't resolve the grant level — skip cleanly (D43), don't guess.
					grantedAtLevel = subclassGrantLevel
				} else {
					const parsed = Number(levelKey)
					if (!Number.isFinite(parsed)) continue // neither a class-level key nor "_" (e.g. a pact-slot-rank key belongs to `expanded`, not this shape) — skip cleanly, not "unparseable means always".
					grantedAtLevel = parsed
				}
				if (grantedAtLevel > classLevel) continue

				const resourceName = typeof entry['resourceName'] === 'string' ? entry['resourceName'] : undefined
				for (const { ref, usage } of extractRefsWithUsage(value, resourceName, null)) {
					const spell = findSpell(spells, parseSpellRef(ref))
					if (!spell) continue // reference doesn't resolve against this app's filtered spells.json — skip cleanly (D43).

					result.push({
						name: spell.name,
						source: spell.source,
						level: spell.level,
						grantedAtLevel,
						ritual: spell.meta?.ritual === true,
						concentration: hasConcentration(spell.duration),
						origin: 'subclass',
						usage,
					})
				}
			}
		}

		// Pact-slot-rank-keyed `expanded` grant (Hexblade/Fathomless). Guarded to a subclass with exactly ONE additionalSpells
		// entry — Warlock The Genie's 4 per-genie-kind entries share this same "s1".."s5" shape but nothing stores which kind
		// the player picked, so a subclass with more than one entry is skipped here structurally (not by name).
		if (pactSlotsByLevel && subclass.additionalSpells.length === 1) {
			const expanded = entry['expanded']
			if (isRecord(expanded)) {
				for (const [levelKey, value] of Object.entries(expanded)) {
					const rank = parsePactSlotRankKey(levelKey)
					if (rank === null) continue // not a rank key (e.g. a class-level key some other subclass's `expanded` uses) — not this shape.

					const grantedAtLevel = levelForPactSlotRank(rank, pactSlotsByLevel)
					if (grantedAtLevel === null || grantedAtLevel > classLevel) continue

					// Confirmed (scripts/investigate-expanded-wrapper-shape.js, this task): Hexblade/Fathomless's rank-keyed
					// expanded grant is always a bare array — no will/daily/ritual/resource wrapper ever wraps it.
					for (const ref of extractRefs(value)) {
						const spell = findSpell(spells, parseSpellRef(ref))
						if (!spell) continue // reference doesn't resolve against this app's filtered spells.json — skip cleanly (D43).

						result.push({
							name: spell.name,
							source: spell.source,
							level: spell.level,
							grantedAtLevel,
							ritual: spell.meta?.ritual === true,
							concentration: hasConcentration(spell.duration),
							origin: 'subclass',
							usage: null,
						})
					}
				}
			}
		}
	}

	return dedupeAlwaysPreparedSpells(result)
}

/**
 * Fetches classes.json, spells.json and class-features.json and returns the
 * subclass's always-prepared spells at or below `classLevel`. `pactSlotsByLevel`
 * (optional) is the Warlock's own Pact Magic slot table, needed only to
 * resolve a rank-keyed `expanded` grant. class-features.json is fetched here
 * (through the shared cache, D39 — free if the subclass picker already loaded
 * it this session) only to resolve a `"_"`-keyed grant via subclassLevelFor;
 * every other shape ignores it.
 */
export async function loadSubclassAlwaysPreparedSpells(
	subclassName: string,
	subclassSource: string,
	className: string,
	classSource: string,
	classLevel: number,
	pactSlotsByLevel?: PactSlots[],
): Promise<AlwaysPreparedSpell[]> {
	const [parsedClasses, parsedSpells, parsedClassFeatures] = await Promise.all([
		loadDataFile('data/classes.json'),
		loadDataFile('data/spells.json'),
		loadDataFile('data/class-features.json'),
	])
	const subclassGrantLevel = subclassLevelFor(parsedClasses, parsedClassFeatures, className, classSource)
	return extractSubclassAlwaysPreparedSpells(
		parsedClasses,
		parsedSpells,
		subclassName,
		subclassSource,
		className,
		classSource,
		classLevel,
		pactSlotsByLevel,
		subclassGrantLevel,
	)
}
