/*
 * Typed loaders for the two data/ files the sheet's top block needs beyond
 * what's already stored on the Character (D39 — one shared cache, fetched
 * only on request):
 *
 * - classes.json's `proficiency` field (saving throw proficiencies), shaped
 *   into savingThrows.ts's ClassSavingThrowProficiencies — same shape
 *   confirmed by scripts/investigate-saving-throws.js that STATUS.md
 *   already documents for the calculation layer itself.
 * - feats.json, shaped into featEffects.ts's FeatEffectEntry — the fields
 *   read here (ability, savingThrowProficiencies, skillProficiencies,
 *   expertise) are already top-level feats.json keys with the exact shape
 *   FeatEffectEntry expects (confirmed by
 *   scripts/investigate-feat-calc-fields.js), so no reshaping is needed
 *   beyond picking them out.
 */

import type { AbilityAbbreviation } from '../calculation/abilityAbbreviations'
import type { FeatEffectEntry } from '../calculation/featEffects'
import type { ClassSavingThrowProficiencies } from '../calculation/savingThrows'
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
