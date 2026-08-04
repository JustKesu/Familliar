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
 */

import type { AbilityAbbreviation } from '../calculation/abilityAbbreviations'
import type { FeatEffectEntry } from '../calculation/featEffects'
import type { ClassHitDie } from '../calculation/hitDice'
import type { ClassSavingThrowProficiencies } from '../calculation/savingThrows'
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
