/*
 * Class spell list access (build order step 6, slice c): which spells are on
 * a given class's list, and at what level. Not preparation, not slots, not
 * the UI — just the read/filter layer those sit on top of.
 *
 * DATA.md, "Spell availability: classes vs classVariants" — a spell is on a
 * class's list if the class appears in EITHER `availableTo.classes` OR
 * `availableTo.classVariants`. Reading only `classes` silently drops 91
 * XGE/TCE spells that were never on the core list and are granted as
 * variant/optional content instead. Both are read here; which one matched is
 * kept on the returned item (D62's UI "flag them differently" note) rather
 * than flattened away.
 *
 * D61 — cantrips (level 0) and leveled spells (1-9) come back in ONE list,
 * each item carrying its own level, not split into two lists.
 */

import { loadDataFile } from '../dataLoader/dataLoader'

export interface ClassSpellListSpell {
	name: string
	source: string
	level: number
	school?: string
	ritual: boolean
	concentration: boolean
	/** True when this spell reached the class only via `availableTo.classVariants` (optional/variant content), not the core `availableTo.classes` list. */
	viaVariant: boolean
}

interface RawAvailableToEntry {
	name: string
	classSource: string
}

interface RawSpell {
	name: string
	source: string
	level: number
	school?: string
	duration?: unknown
	meta?: { ritual?: boolean }
	availableTo?: {
		classes?: RawAvailableToEntry[]
		classVariants?: RawAvailableToEntry[]
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isRawAvailableToEntry(value: unknown): value is RawAvailableToEntry {
	return isRecord(value) && typeof value['name'] === 'string' && typeof value['classSource'] === 'string'
}

function isRawSpell(value: unknown): value is RawSpell {
	if (!isRecord(value)) return false
	return typeof value['name'] === 'string' && typeof value['source'] === 'string' && typeof value['level'] === 'number'
}

function matchesClass(entries: unknown, className: string, classSource: string): boolean {
	if (!Array.isArray(entries)) return false
	return entries.some((entry) => isRawAvailableToEntry(entry) && entry.name === className && entry.classSource === classSource)
}

function hasConcentration(duration: unknown): boolean {
	if (!Array.isArray(duration)) return false
	return duration.some((entry) => isRecord(entry) && entry['concentration'] === true)
}

/**
 * Pure filter (D38): takes the parsed spells.json array plus a class
 * identity, returns every spell on that class's list. Takes ONE class per
 * call (D11) — a caller combining a multiclass character's access calls
 * this once per class and unions the results itself.
 */
export function extractClassSpellList(parsed: unknown, className: string, classSource: string): ClassSpellListSpell[] {
	if (!Array.isArray(parsed)) {
		throw new Error('spells.json: expected a top-level array.')
	}

	const result: ClassSpellListSpell[] = []
	for (const candidate of parsed) {
		if (!isRawSpell(candidate)) continue
		const availableTo = candidate.availableTo
		const onCoreList = matchesClass(availableTo?.classes, className, classSource)
		const onVariantList = !onCoreList && matchesClass(availableTo?.classVariants, className, classSource)
		if (!onCoreList && !onVariantList) continue

		result.push({
			name: candidate.name,
			source: candidate.source,
			level: candidate.level,
			school: candidate.school,
			ritual: candidate.meta?.ritual === true,
			concentration: hasConcentration(candidate.duration),
			viaVariant: onVariantList,
		})
	}
	return result
}

/** Fetches spells.json and returns the named class's spell list. */
export async function loadClassSpellList(className: string, classSource: string): Promise<ClassSpellListSpell[]> {
	const parsed = await loadDataFile('data/spells.json')
	return extractClassSpellList(parsed, className, classSource)
}

/**
 * D46: Eldritch Knight and Arcane Trickster carry no spell list of their
 * own — their subclass entry's `additionalSpells.expanded` widens the
 * class picker's pool to Wizard's list entirely (confirmed via
 * scripts/investigate-ek-at-expanded.js: both key `{"all": "level=N|
 * class=Wizard"}` under `expanded`), rather than granting fixed spells
 * (subclassPreparedSpells.ts's d6a comment). The other `expanded` cases —
 * Divine Soul's pool-widen, the 3 pact-slot-rank Warlock patrons, The
 * Genie, the 12 marks — are NOT covered here and stay deferred
 * (docs/REPORT.md).
 */
const THIRD_CASTER_SPELL_LIST: Record<string, { className: string; classSource: string }> = {
	'Eldritch Knight': { className: 'Wizard', classSource: 'XPHB' },
	'Arcane Trickster': { className: 'Wizard', classSource: 'XPHB' },
}

/** Which class's spell list the picker should offer for a character in `className`/`subclassName` — the class itself, except EK/AT (see THIRD_CASTER_SPELL_LIST above). */
export function spellListClassFor(
	className: string,
	classSource: string,
	subclassName: string | null | undefined,
): { className: string; classSource: string } {
	if (subclassName && subclassName in THIRD_CASTER_SPELL_LIST) return THIRD_CASTER_SPELL_LIST[subclassName]!
	return { className, classSource }
}

/**
 * D46 (Divine Soul): unlike EK/AT, Sorcerer already has its own full spell
 * list — Divine Soul's `additionalSpells.expanded` WIDENS that pool with
 * Cleric's list rather than replacing it (confirmed via
 * scripts/investigate-divine-soul-expanded.js: every one of Divine Soul's 5
 * alignment options keys the identical `{"all": "level=N|class=Cleric"}`
 * shape under `expanded`, gated by character-level thresholds that already
 * match the existing max-slot-level filter (slice d1) a full caster gets
 * for free — so no separate threshold table is needed here). The other
 * `expanded` pool-widening cases — Warlock patrons, The Genie, the marks —
 * are NOT covered here and stay deferred (docs/REPORT.md).
 */
const EXPANDED_POOL_ADDITIONS: Record<string, { className: string; classSource: string }> = {
	'Divine Soul': { className: 'Cleric', classSource: 'XPHB' },
}

/** An extra class list to UNION into the picker's pool on top of `spellListClassFor`'s result — currently only Divine Soul (adds Cleric list). Returns null for every other subclass. */
export function expandedSpellListClassFor(subclassName: string | null | undefined): { className: string; classSource: string } | null {
	if (subclassName && subclassName in EXPANDED_POOL_ADDITIONS) return EXPANDED_POOL_ADDITIONS[subclassName]!
	return null
}
