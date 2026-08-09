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
import { extractRefs as extractSpellRefs, parseSpellRef } from './subclassPreparedSpells'

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

interface RawFeatEntry {
	name: string
	source: string
	additionalSpells?: unknown
}

function isRawFeatEntry(value: unknown): value is RawFeatEntry {
	return isRecord(value) && typeof value['name'] === 'string' && typeof value['source'] === 'string'
}

/**
 * D46 (the 12 Eberron "Mark of ..." feats): a mark's `additionalSpells.expanded`
 * is NOT a fixed grant like its `prepared`/`known` portion (featSpells.ts's
 * d5b-3) — Mark of Detection's rules text ("Spells of the Mark") reads "If you
 * have the Spellcasting or Pact Magic class feature, the spells on the [...]
 * table are added to that feature's spell list." That is the same
 * pool-widening role as EK/AT's and Divine Soul's `expanded`
 * (spellListClassFor/expandedSpellListClassFor above) — just keyed by spell
 * level ("s1".."s5", confirmed against the same table's own "Spell Level"
 * column via scripts/investigate-mark-expanded-shape.js) instead of a
 * class-list query string, and applying on top of WHATEVER class the
 * character plays, not one fixed class. A character with no Spellcasting or
 * Pact Magic feature has no picker for this to widen — nothing is granted,
 * because the wizard's 'spells' step itself never renders when
 * spellRequirement is null (wizardState.ts), so there's nothing to guard
 * against here.
 *
 * scripts/investigate-feat-expanded-scope.js confirmed feats.json's
 * `additionalSpells.expanded` key belongs to exactly these 12 marks and no
 * other feat, so this reads any taken feat by name/source without a
 * mark-name guard — a feat with no `expanded` key simply yields nothing.
 */
export function extractFeatExpandedSpellList(parsedFeats: unknown, parsedSpells: unknown, featName: string, featSource: string): ClassSpellListSpell[] {
	if (!Array.isArray(parsedFeats)) {
		throw new Error('feats.json: expected a top-level array.')
	}
	if (!Array.isArray(parsedSpells)) {
		throw new Error('spells.json: expected a top-level array.')
	}

	const feat = parsedFeats.find((candidate): candidate is RawFeatEntry => isRawFeatEntry(candidate) && candidate.name === featName && candidate.source === featSource)
	if (!feat || !Array.isArray(feat.additionalSpells)) return []

	const spells = parsedSpells.filter(isRawSpell)
	const result: ClassSpellListSpell[] = []
	for (const entry of feat.additionalSpells) {
		if (!isRecord(entry)) continue
		const expanded = entry['expanded']
		if (expanded === undefined) continue

		for (const ref of extractSpellRefs(expanded)) {
			const parsed = parseSpellRef(ref)
			const spell = spells.find((s) => s.name.toLowerCase() === parsed.name && (parsed.source === null || s.source.toUpperCase() === parsed.source))
			if (!spell) continue // reference doesn't resolve against this app's filtered spells.json — skip cleanly (D43).

			result.push({
				name: spell.name,
				source: spell.source,
				level: spell.level,
				school: spell.school,
				ritual: spell.meta?.ritual === true,
				concentration: hasConcentration(spell.duration),
				viaVariant: false,
			})
		}
	}
	return result
}

/** Fetches feats.json and spells.json and returns one feat's `expanded` pool-widening spells (empty for any feat without one). */
export async function loadFeatExpandedSpellList(featName: string, featSource: string): Promise<ClassSpellListSpell[]> {
	const [parsedFeats, parsedSpells] = await Promise.all([loadDataFile('data/feats.json'), loadDataFile('data/spells.json')])
	return extractFeatExpandedSpellList(parsedFeats, parsedSpells, featName, featSource)
}
