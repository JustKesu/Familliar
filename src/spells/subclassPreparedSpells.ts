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
 *   check already used for `prepared` skips it cleanly with no special case.
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

import type { PactSlots } from '../calculation/spellSlots'
import { loadDataFile } from '../dataLoader/dataLoader'

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
				const grantedAtLevel = Number(levelKey)
				// Not finite also covers Warlock Archfey Patron's "_" level key — deferred cleanly, no special case needed.
				if (!Number.isFinite(grantedAtLevel) || grantedAtLevel > classLevel) continue

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
						})
					}
				}
			}
		}
	}

	return dedupeAlwaysPreparedSpells(result)
}

/** Fetches classes.json and spells.json and returns the subclass's always-prepared spells at or below `classLevel`. `pactSlotsByLevel` (optional) is the Warlock's own Pact Magic slot table, needed only to resolve a rank-keyed `expanded` grant. */
export async function loadSubclassAlwaysPreparedSpells(
	subclassName: string,
	subclassSource: string,
	className: string,
	classSource: string,
	classLevel: number,
	pactSlotsByLevel?: PactSlots[],
): Promise<AlwaysPreparedSpell[]> {
	const [parsedClasses, parsedSpells] = await Promise.all([loadDataFile('data/classes.json'), loadDataFile('data/spells.json')])
	return extractSubclassAlwaysPreparedSpells(parsedClasses, parsedSpells, subclassName, subclassSource, className, classSource, classLevel, pactSlotsByLevel)
}
