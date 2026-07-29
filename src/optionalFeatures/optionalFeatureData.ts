/*
 * Typed loader for subclass optionalfeatureProgression choices — the shape
 * shared by all four in-scope subclasses that grow a list of picks with
 * level: Battle Master (Maneuvers), Rune Knight (Runes), Arcane Archer
 * (Arcane Shot), College of Swords (Fighting Style). Confirmed by
 * scripts/investigate-subclass-choices.js and
 * scripts/investigate-optional-feature-progression.js — one
 * optionalfeatureProgression entry per subclass, one featureType code each.
 *
 * Per D12, an `FS:*` featureType code resolves against feats.json filtered
 * by category "FS" — the `:B` suffix on College of Swords' FS:B does not
 * narrow that set; see docs/QUESTIONS.md, "College of Swords — FS:B nabízí
 * všech 10 stylů". Every other code (MV:B, AS, RN, ...) resolves against
 * optional-features.json filtered by an exact featureType match.
 */

import { loadDataFile } from '../dataLoader/dataLoader'

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

interface RawProgression {
	name?: unknown
	featureType?: unknown
	progression?: unknown
}

interface RawSubclass {
	entryType: string
	name: string
	source: string
	className: string
	classSource: string
	optionalfeatureProgression?: RawProgression[]
}

function isRawSubclass(value: unknown): value is RawSubclass {
	if (!isRecord(value)) return false
	return (
		value['entryType'] === 'subclass' &&
		typeof value['name'] === 'string' &&
		typeof value['source'] === 'string' &&
		typeof value['className'] === 'string' &&
		typeof value['classSource'] === 'string'
	)
}

function findSubclass(
	parsedClasses: unknown,
	className: string,
	classSource: string,
	subclassName: string,
	subclassSource: string,
): RawSubclass | undefined {
	if (!Array.isArray(parsedClasses)) {
		throw new Error('classes.json: expected a top-level array.')
	}
	return parsedClasses.find(
		(candidate) =>
			isRawSubclass(candidate) &&
			candidate.className === className &&
			candidate.classSource === classSource &&
			candidate.name === subclassName &&
			candidate.source === subclassSource,
	) as RawSubclass | undefined
}

/**
 * The number of picks a subclass's optionalfeatureProgression grants at
 * `level` — the highest progression level at or below `level`, or 0 before
 * the first one. Returns null when the subclass has no
 * optionalfeatureProgression at all.
 */
function countAtLevel(progression: Record<string, unknown>, level: number): number {
	const levels = Object.keys(progression)
		.map(Number)
		.filter((lvl) => lvl <= level)
		.sort((a, b) => a - b)
	if (levels.length === 0) return 0
	const highest = levels[levels.length - 1]
	const raw = progression[String(highest)]
	return typeof raw === 'number' ? raw : 0
}

export interface OptionalFeatureOption {
	name: string
	source: string
	entries: unknown[]
}

export interface OptionalFeatureChoice {
	featureType: string
	count: number
	options: OptionalFeatureOption[]
}

interface RawOptionalFeature {
	name?: unknown
	source?: unknown
	featureType?: unknown
	entries?: unknown
}

function isRawOptionalFeature(value: unknown): value is RawOptionalFeature & { name: string; source: string; entries: unknown[] } {
	if (!isRecord(value)) return false
	return typeof value['name'] === 'string' && typeof value['source'] === 'string' && Array.isArray(value['entries'])
}

/** Every optional-features.json entry whose featureType array includes `code` exactly. */
function optionalFeaturesByType(parsedOptionalFeatures: unknown, code: string): OptionalFeatureOption[] {
	if (!Array.isArray(parsedOptionalFeatures)) {
		throw new Error('optional-features.json: expected a top-level array.')
	}
	return parsedOptionalFeatures
		.filter(isRawOptionalFeature)
		.filter((entry) => Array.isArray(entry.featureType) && entry.featureType.includes(code))
		.map((entry) => ({ name: entry.name, source: entry.source, entries: entry.entries }))
}

interface RawFeat {
	name?: unknown
	source?: unknown
	category?: unknown
	entries?: unknown
}

function isRawFeat(value: unknown): value is RawFeat & { name: string; source: string; entries: unknown[] } {
	if (!isRecord(value)) return false
	return typeof value['name'] === 'string' && typeof value['source'] === 'string' && Array.isArray(value['entries'])
}

/** Every feats.json entry with category "FS" — per D12, this is what every `FS:*` code resolves to, suffix ignored. */
function fightingStyleFeats(parsedFeats: unknown): OptionalFeatureOption[] {
	if (!Array.isArray(parsedFeats)) {
		throw new Error('feats.json: expected a top-level array.')
	}
	return parsedFeats
		.filter(isRawFeat)
		.filter((entry) => entry.category === 'FS')
		.map((entry) => ({ name: entry.name, source: entry.source, entries: entry.entries }))
}

/**
 * The subclass's optionalfeatureProgression choice at `level`: how many
 * picks the character has and what they can pick from. Returns null when
 * the subclass has no optionalfeatureProgression, or when `level` is below
 * its first progression entry (count would be 0).
 */
export function optionalFeatureChoicesFor(
	parsedClasses: unknown,
	parsedOptionalFeatures: unknown,
	parsedFeats: unknown,
	className: string,
	classSource: string,
	subclassName: string,
	subclassSource: string,
	level: number,
): OptionalFeatureChoice | null {
	const subclass = findSubclass(parsedClasses, className, classSource, subclassName, subclassSource)
	const progression = subclass?.optionalfeatureProgression?.[0]
	if (!progression) return null

	const featureTypes = Array.isArray(progression.featureType) ? progression.featureType : []
	const code = featureTypes.find((ft): ft is string => typeof ft === 'string')
	if (!code) return null

	const rawProgression = isRecord(progression.progression) ? progression.progression : {}
	const count = countAtLevel(rawProgression, level)
	if (count === 0) return null

	const options = code.startsWith('FS:') ? fightingStyleFeats(parsedFeats) : optionalFeaturesByType(parsedOptionalFeatures, code)

	return { featureType: code, count, options }
}

/** Fetches classes.json, optional-features.json and feats.json and returns optionalFeatureChoicesFor's result. */
export async function loadOptionalFeatureChoicesFor(
	className: string,
	classSource: string,
	subclassName: string,
	subclassSource: string,
	level: number,
): Promise<OptionalFeatureChoice | null> {
	const [classes, optionalFeatures, feats] = await Promise.all([
		loadDataFile('data/classes.json'),
		loadDataFile('data/optional-features.json'),
		loadDataFile('data/feats.json'),
	])
	return optionalFeatureChoicesFor(classes, optionalFeatures, feats, className, classSource, subclassName, subclassSource, level)
}
