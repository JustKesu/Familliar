/*
 * Subclass always-prepared spells (build order step 6, slice d2b): the
 * domain/oath/circle spells a subclass grants outright at a given class
 * level. Not preparation, not a picker choice — these are DERIVED from
 * subclass + level and are not stored (confirmed with the user); a caller
 * recomputes them from whatever is already on the Character.
 *
 * D62 — first pass supports only the `prepared` shape of a subclass's
 * additionalSpells field. A subclass whose additionalSpells uses only one
 * of the other 13 shapes (`known`, `innate`, `expanded`, ...) returns
 * nothing here, cleanly — not an error, the deferral working as intended.
 *
 * These spells are ADDITIONAL to the class spell picker's own
 * cantrip/prepared/known counts (slice d2) — they never add to or subtract
 * from those counts, and must be kept out of Character.spellChoices, a
 * separate, player-chosen list.
 *
 * Shape confirmed via scripts/investigate-prepared-shape.js (D46), against
 * all 48 subclass additionalSpells entries carrying a `prepared` key:
 *
 * - `prepared` is always an object keyed by class level ("3", "5", ...),
 *   each value an array of spell references. Never an array itself.
 * - A spell reference is almost always a bare lowercase name ("identify") or
 *   "name|source" ("healing word|xphb"), occasionally with a trailing
 *   "#..." tag ("mind sliver|xphb#c") that is not part of the source code
 *   and is stripped before matching.
 * - ONE exception found: Bard College of Lore, level 6, carries a nested
 *   choice object instead of a spell name —
 *   `{"choose":"level=0;1;2;3|class=Cleric;Druid;Wizard"}`. That is a
 *   player choice from other classes' lists, not a fixed always-prepared
 *   spell, and is outside what D62's `prepared` shape was scoped to cover.
 *   Per the task brief, this is reported (docs/REPORT.md) rather than
 *   handled — a non-string item in a `prepared` level's array is skipped
 *   cleanly here, same as any other unhandled shape.
 * - Two of 406 string references don't resolve against this app's filtered
 *   spells.json (e.g. "branding smite", not present in any allowed source)
 *   — skipped cleanly (D43), not an error.
 */

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

function isRecord(value: unknown): value is Record<string, unknown> {
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

interface RawSpell {
	name: string
	source: string
	level: number
	duration?: unknown
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

/** Parses a `prepared` list item ("healing word", "healing word|xphb", "mind sliver|xphb#c") into a lowercase name and optional uppercase source. */
function parseSpellRef(ref: string): { name: string; source: string | null } {
	const [namePart, sourcePart] = ref.split('|')
	const source = sourcePart ? sourcePart.split('#')[0].toUpperCase() : null
	return { name: namePart.toLowerCase(), source }
}

function findSpell(spells: RawSpell[], ref: { name: string; source: string | null }): RawSpell | undefined {
	return spells.find((s) => s.name.toLowerCase() === ref.name && (ref.source === null || s.source.toUpperCase() === ref.source))
}

/**
 * Pure filter (D38). Takes ONE subclass identity plus the character's level
 * in that class (D11 — a multiclass caller unions per class, not built
 * here) and the parsed classes.json / spells.json arrays. Returns the
 * subclass's always-prepared spells granted at or below that level, from
 * only the `prepared` shape (D62) — every other shape yields nothing.
 */
export function extractSubclassAlwaysPreparedSpells(
	parsedClasses: unknown,
	parsedSpells: unknown,
	subclassName: string,
	subclassSource: string,
	className: string,
	classSource: string,
	classLevel: number,
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
		const prepared = entry['prepared']
		if (prepared === undefined) continue // D62: only the `prepared` shape is handled this pass.
		if (!isRecord(prepared)) continue // unexpected variant of `prepared` itself — skip cleanly, don't invent handling.

		for (const [levelKey, refs] of Object.entries(prepared)) {
			const grantedAtLevel = Number(levelKey)
			if (!Number.isFinite(grantedAtLevel) || grantedAtLevel > classLevel) continue
			if (!Array.isArray(refs)) continue

			for (const ref of refs) {
				if (typeof ref !== 'string') continue // e.g. Bard College of Lore's nested `{choose: ...}` — see module comment.
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

	return result
}

/** Fetches classes.json and spells.json and returns the subclass's always-prepared spells at or below `classLevel`. */
export async function loadSubclassAlwaysPreparedSpells(
	subclassName: string,
	subclassSource: string,
	className: string,
	classSource: string,
	classLevel: number,
): Promise<AlwaysPreparedSpell[]> {
	const [parsedClasses, parsedSpells] = await Promise.all([loadDataFile('data/classes.json'), loadDataFile('data/spells.json')])
	return extractSubclassAlwaysPreparedSpells(parsedClasses, parsedSpells, subclassName, subclassSource, className, classSource, classLevel)
}
