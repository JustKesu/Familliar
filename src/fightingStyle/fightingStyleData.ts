/*
 * Typed loader for the fighting-style slice: which classes grant a choice
 * and what the choice offers.
 *
 * Per D12, Fighting Styles live in feats.json under category "FS" — not
 * optional-features.json. Confirmed via scripts/investigate-fighting-style.js:
 * 10 feats.json entries carry category "FS", and exactly 3 class-features.json
 * entries are named "Fighting Style" (Fighter L1, Paladin L2, Ranger L2), each
 * with an `entries` array (not a plain string).
 */

import { loadDataFile } from '../dataLoader/dataLoader'

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
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

/**
 * Finds a class feature named exactly "Fighting Style" for the given class
 * and returns the level it's granted at, or null if that class grants none.
 * Derived from data — no hardcoded list of class names.
 */
export function grantsFightingStyleAt(
	parsedClassFeatures: unknown,
	className: string,
	classSource: string,
): number | null {
	if (!Array.isArray(parsedClassFeatures)) {
		throw new Error('class-features.json: expected a top-level array.')
	}
	const match = parsedClassFeatures.find(
		(candidate) =>
			isRawClassFeatureEntry(candidate) &&
			candidate.name === 'Fighting Style' &&
			candidate.className === className &&
			candidate.classSource === classSource,
	) as RawClassFeatureEntry | undefined
	return match ? match.level : null
}

/** Fetches class-features.json and returns the level the named class grants a Fighting Style, or null. */
export async function loadFightingStyleGrantLevel(className: string, classSource: string): Promise<number | null> {
	const parsed = await loadDataFile('data/class-features.json')
	return grantsFightingStyleAt(parsed, className, classSource)
}

export interface FightingStyleOption {
	name: string
	source: string
	entries: unknown[]
}

interface RawFeatEntry {
	name: string
	source: string
	category?: string
	entries?: unknown
}

function isRawFeatEntry(value: unknown): value is RawFeatEntry {
	if (!isRecord(value)) return false
	return typeof value['name'] === 'string' && typeof value['source'] === 'string'
}

/**
 * D419: the feat categories a class's Fighting Style feature offers, from its classes.json `featProgression`
 * ("FS" plus "FS:P" for Paladin XPHB, "FS:R" for Ranger XPHB). A class without that row offers "FS" only (D12).
 */
export function fightingStyleCategoriesFrom(parsedClasses: unknown, className: string, classSource: string): string[] {
	if (!Array.isArray(parsedClasses)) {
		throw new Error('classes.json: expected a top-level array.')
	}
	const cls: unknown = parsedClasses.find((candidate) => isRecord(candidate) && candidate['name'] === className && candidate['source'] === classSource)
	const progression = isRecord(cls) && Array.isArray(cls['featProgression']) ? cls['featProgression'] : []
	const row: unknown = progression.find((candidate) => isRecord(candidate) && candidate['name'] === 'Fighting Style')
	const categories = isRecord(row) && Array.isArray(row['category']) ? row['category'].filter((code): code is string => typeof code === 'string') : []
	return categories.includes('FS') ? categories : ['FS', ...categories]
}

/** Extracts every feats.json entry in `categories` — by default "FS", the fighting styles open to every class. */
export function fightingStyleOptionsFrom(parsedFeats: unknown, categories: readonly string[] = ['FS']): FightingStyleOption[] {
	if (!Array.isArray(parsedFeats)) {
		throw new Error('feats.json: expected a top-level array.')
	}
	return parsedFeats
		.filter((candidate): candidate is RawFeatEntry => isRawFeatEntry(candidate) && candidate.category !== undefined && categories.includes(candidate.category))
		.map((entry) => {
			if (!Array.isArray(entry.entries)) {
				throw new Error(`feats.json: "${entry.name}" (${entry.source}) has no "entries" array`)
			}
			return { name: entry.name, source: entry.source, entries: entry.entries }
		})
}

/** Fetches feats.json and returns the styles the named class's Fighting Style feature offers (D419). */
export async function fightingStyleOptions(className: string, classSource: string): Promise<FightingStyleOption[]> {
	const [parsedFeats, parsedClasses] = await Promise.all([loadDataFile('data/feats.json'), loadDataFile('data/classes.json')])
	return fightingStyleOptionsFrom(parsedFeats, fightingStyleCategoriesFrom(parsedClasses, className, classSource))
}

/** D419: every feat a class Fighting Style can hold — "FS" plus the class-only "FS:*" categories. Matching stored picks only, never a picker pool. */
export function isClassFightingStyleCategory(category: unknown): boolean {
	return category === 'FS' || (typeof category === 'string' && category.startsWith('FS:'))
}
