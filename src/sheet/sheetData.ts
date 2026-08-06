/*
 * Typed loaders for the data/ files the sheet needs beyond what's already
 * stored on the Character (D39 — one shared cache, fetched only on
 * request):
 *
 * - classes.json's `proficiency` field (saving throw proficiencies), shaped
 *   into savingThrows.ts's ClassSavingThrowProficiencies — same shape
 *   confirmed by scripts/investigate-saving-throws.js that STATUS.md
 *   already documents for the calculation layer itself.
 * - classes.json's `hd.faces` field, shaped into hitDice.ts's ClassHitDie —
 *   same classes.json fetch, a second field picked off the same entries.
 * - species.json, shaped into speciesTraits.ts's SpeciesTraitsData — the
 *   fields read here (speed, size, darkvision, raceName, raceSource) are
 *   already top-level species.json keys in the shape speciesTraits.ts
 *   expects (confirmed for the calculation layer itself,
 *   scripts/investigate-calc-slice2.js).
 * - feats.json, shaped into featEffects.ts's FeatEffectEntry — the fields
 *   read here (ability, savingThrowProficiencies, skillProficiencies,
 *   expertise) are already top-level feats.json keys with the exact shape
 *   FeatEffectEntry expects (confirmed by
 *   scripts/investigate-feat-calc-fields.js), so no reshaping is needed
 *   beyond picking them out.
 * - feats.json's `entries` field, for the sheet's feat-text list — a
 *   second, smaller shape off the same fetch (D39 caches per path, so this
 *   costs no extra request).
 * - classes.json's `spellcastingAbility` field, shaped into
 *   spellcasting.ts's ClassSpellcastingAbility — a class entry with no such
 *   field (Barbarian, Fighter, Monk, Rogue) gets `ability: null`, matching
 *   what computeSpellcasting already expects for a non-caster class. D46:
 *   Eldritch Knight/Arcane Trickster's own spellcastingAbility is carried
 *   under `subclasses`, gated on the subclass also having its own spell-slot
 *   table (excludes Path of the Ancestral Guardian, which has the ability
 *   field but no slots — scripts/investigate-subclass-spellcasting-ability.js).
 * - a subclass's SOURCE, resolved from its stored NAME only (build order
 *   step 6 slice d4). Character.classes[].subclass stores just the
 *   subclass's name (wizardState.ts's saveCharacter drops the source it had
 *   at selection time — an existing gap, out of scope here per the task
 *   brief's "no wizard changes"). 11 of 103 (class, subclass name) pairs in
 *   classes.json are genuinely ambiguous by name alone (e.g. Artificer
 *   "Alchemist" exists under both TCE and EFA with different
 *   additionalSpells content) — confirmed by
 *   scripts/investigate-sheet-subclass-source.js. Per the user's decision
 *   (this task's session): match the subclass entry whose OWN classSource
 *   equals the character's class's classSource; if more than one entry
 *   still matches, resolve to `null` (unresolved) rather than silently
 *   guess — the caller shows nothing for that subclass's always-prepared
 *   spells rather than risk the wrong sourcebook's list (D43-style).
 */

import type { AbilityAbbreviation } from '../calculation/abilityAbbreviations'
import type { FeatEffectEntry } from '../calculation/featEffects'
import type { ClassHitDie } from '../calculation/hitDice'
import type { ClassSavingThrowProficiencies } from '../calculation/savingThrows'
import type { ClassSpellcastingAbility } from '../calculation/spellcasting'
import type { SpeciesTraitsData } from '../calculation/speciesTraits'
import { loadDataFile } from '../dataLoader/dataLoader'

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isClassEntry(value: unknown): value is { entryType: string; name: string; source: string; proficiency?: unknown } {
	return isRecord(value) && value.entryType === 'class' && typeof value.name === 'string' && typeof value.source === 'string'
}

export function extractSavingThrowClassData(parsed: unknown): ClassSavingThrowProficiencies[] {
	if (!Array.isArray(parsed)) {
		throw new Error('classes.json: expected a top-level array.')
	}

	const result: ClassSavingThrowProficiencies[] = []
	for (const entry of parsed) {
		if (!isClassEntry(entry)) continue
		if (!Array.isArray(entry.proficiency)) continue
		result.push({
			className: entry.name,
			classSource: entry.source,
			abilities: entry.proficiency as AbilityAbbreviation[],
		})
	}
	return result
}

export async function loadSavingThrowClassData(): Promise<ClassSavingThrowProficiencies[]> {
	const parsed = await loadDataFile('data/classes.json')
	return extractSavingThrowClassData(parsed)
}

function isHdEntry(value: unknown): value is { hd: { faces: number } } {
	return isRecord(value) && isRecord((value as { hd?: unknown }).hd) && typeof (value as { hd: { faces: unknown } }).hd.faces === 'number'
}

export function extractHitDiceClassData(parsed: unknown): ClassHitDie[] {
	if (!Array.isArray(parsed)) {
		throw new Error('classes.json: expected a top-level array.')
	}

	const result: ClassHitDie[] = []
	for (const entry of parsed) {
		if (!isClassEntry(entry) || !isHdEntry(entry)) continue
		result.push({ className: entry.name, classSource: entry.source, faces: entry.hd.faces })
	}
	return result
}

export async function loadHitDiceClassData(): Promise<ClassHitDie[]> {
	const parsed = await loadDataFile('data/classes.json')
	return extractHitDiceClassData(parsed)
}

function isSpeciesTraitsEntry(value: unknown): value is SpeciesTraitsData {
	return isRecord(value) && typeof value.name === 'string' && typeof value.source === 'string'
}

export function extractSpeciesTraitsData(parsed: unknown): SpeciesTraitsData[] {
	if (!Array.isArray(parsed)) {
		throw new Error('species.json: expected a top-level array.')
	}
	return parsed.filter(isSpeciesTraitsEntry) as SpeciesTraitsData[]
}

export async function loadSpeciesTraitsData(): Promise<SpeciesTraitsData[]> {
	const parsed = await loadDataFile('data/species.json')
	return extractSpeciesTraitsData(parsed)
}

function isFeatEntry(value: unknown): value is FeatEffectEntry {
	return isRecord(value) && typeof value.name === 'string' && typeof value.source === 'string'
}

export function extractFeatEffectEntries(parsed: unknown): FeatEffectEntry[] {
	if (!Array.isArray(parsed)) {
		throw new Error('feats.json: expected a top-level array.')
	}
	return parsed.filter(isFeatEntry)
}

export async function loadFeatEffectEntries(): Promise<FeatEffectEntry[]> {
	const parsed = await loadDataFile('data/feats.json')
	return extractFeatEffectEntries(parsed)
}

export interface FeatTextEntry {
	name: string
	source: string
	entries: unknown[]
}

function isFeatTextEntry(value: unknown): value is FeatTextEntry {
	return isRecord(value) && typeof value.name === 'string' && typeof value.source === 'string' && Array.isArray((value as { entries?: unknown }).entries)
}

export function extractFeatTextEntries(parsed: unknown): FeatTextEntry[] {
	if (!Array.isArray(parsed)) {
		throw new Error('feats.json: expected a top-level array.')
	}
	return parsed.filter(isFeatTextEntry)
}

export async function loadFeatTextEntries(): Promise<FeatTextEntry[]> {
	const parsed = await loadDataFile('data/feats.json')
	return extractFeatTextEntries(parsed)
}

function isSpellcastingAbilityEntry(value: unknown): value is { entryType: string; name: string; source: string; spellcastingAbility?: unknown } {
	return isRecord(value) && value.entryType === 'class' && typeof value.name === 'string' && typeof value.source === 'string'
}

interface RawSubclassSpellcastingEntry {
	entryType: string
	name: string
	className: string
	classSource: string
	spellcastingAbility?: unknown
	casterProgression?: unknown
	subclassTableGroups?: unknown
}

function isRawSubclassSpellcastingEntry(value: unknown): value is RawSubclassSpellcastingEntry {
	return (
		isRecord(value) &&
		value['entryType'] === 'subclass' &&
		typeof value['name'] === 'string' &&
		typeof value['className'] === 'string' &&
		typeof value['classSource'] === 'string'
	)
}

/** D46: a subclass's own spellcastingAbility only counts here if it also has its own slot table — Path of the Ancestral Guardian carries the field but no slots, so it stays excluded (nothing to cast, per the user's decision this session). */
function hasOwnSpellSlotTable(entry: RawSubclassSpellcastingEntry): boolean {
	if (!entry.casterProgression) return false
	return Array.isArray(entry.subclassTableGroups) && entry.subclassTableGroups.some((g) => isRecord(g) && Array.isArray(g['rowsSpellProgression']))
}

export function extractSpellcastingAbilityClassData(parsed: unknown): ClassSpellcastingAbility[] {
	if (!Array.isArray(parsed)) {
		throw new Error('classes.json: expected a top-level array.')
	}

	const subclasses = parsed.filter(isRawSubclassSpellcastingEntry)

	const result: ClassSpellcastingAbility[] = []
	for (const entry of parsed) {
		if (!isSpellcastingAbilityEntry(entry)) continue
		const classSubclasses = subclasses
			.filter((sc) => sc.className === entry.name && sc.classSource === entry.source)
			.filter((sc) => typeof sc.spellcastingAbility === 'string' && hasOwnSpellSlotTable(sc))
			.map((sc) => ({ subclassName: sc.name, ability: sc.spellcastingAbility as AbilityAbbreviation }))

		result.push({
			className: entry.name,
			classSource: entry.source,
			ability: typeof entry.spellcastingAbility === 'string' ? (entry.spellcastingAbility as AbilityAbbreviation) : null,
			...(classSubclasses.length > 0 ? { subclasses: classSubclasses } : {}),
		})
	}
	return result
}

export async function loadSpellcastingAbilityClassData(): Promise<ClassSpellcastingAbility[]> {
	const parsed = await loadDataFile('data/classes.json')
	return extractSpellcastingAbilityClassData(parsed)
}

interface RawSubclassSourceEntry {
	entryType: string
	name: string
	source: string
	className: string
	classSource: string
}

function isRawSubclassSourceEntry(value: unknown): value is RawSubclassSourceEntry {
	return (
		isRecord(value) &&
		value['entryType'] === 'subclass' &&
		typeof value['name'] === 'string' &&
		typeof value['source'] === 'string' &&
		typeof value['className'] === 'string' &&
		typeof value['classSource'] === 'string'
	)
}

/**
 * Pure (D38). Resolves a subclass's source from its name alone, since
 * Character.classes[].subclass stores only the name. Matches by
 * className+classSource+name, preferring an entry whose own classSource
 * equals the class's — but that filter is a no-op for the 11 genuinely
 * ambiguous pairs (both candidates already share the class's classSource,
 * confirmed by scripts/investigate-sheet-subclass-source.js), so those
 * still resolve to `null` (unresolved) rather than guess between two
 * different sourcebooks' content.
 */
export function resolveSubclassSource(parsed: unknown, className: string, classSource: string, subclassName: string): string | null {
	if (!Array.isArray(parsed)) {
		throw new Error('classes.json: expected a top-level array.')
	}

	const candidates = parsed.filter(
		(entry): entry is RawSubclassSourceEntry =>
			isRawSubclassSourceEntry(entry) && entry.className === className && entry.classSource === classSource && entry.name === subclassName,
	)
	return candidates.length === 1 ? candidates[0].source : null
}

export async function loadSubclassSource(className: string, classSource: string, subclassName: string): Promise<string | null> {
	const parsed = await loadDataFile('data/classes.json')
	return resolveSubclassSource(parsed, className, classSource, subclassName)
}
