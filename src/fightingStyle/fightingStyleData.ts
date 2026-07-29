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

/** Extracts every feats.json entry with category "FS" — the full set of fighting styles. */
export function fightingStyleOptionsFrom(parsedFeats: unknown): FightingStyleOption[] {
	if (!Array.isArray(parsedFeats)) {
		throw new Error('feats.json: expected a top-level array.')
	}
	return parsedFeats
		.filter((candidate): candidate is RawFeatEntry => isRawFeatEntry(candidate) && candidate.category === 'FS')
		.map((entry) => {
			if (!Array.isArray(entry.entries)) {
				throw new Error(`feats.json: "${entry.name}" (${entry.source}) has no "entries" array`)
			}
			return { name: entry.name, source: entry.source, entries: entry.entries }
		})
}

/** Fetches feats.json and returns every category "FS" entry. */
export async function fightingStyleOptions(): Promise<FightingStyleOption[]> {
	const parsed = await loadDataFile('data/feats.json')
	return fightingStyleOptionsFrom(parsed)
}
