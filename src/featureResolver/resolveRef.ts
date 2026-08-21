import { asArray, asString, isRecord, type RefOccurrence, type ResolvedFeature, type ResolverData } from './refTypes'

/*
 * Resolves one ref* occurrence against the data it points into. Pure
 * function — data is passed in, never loaded here (D38).
 *
 * classFeature/subclassFeature uids are built the same way D33's `id`
 * fields are (name|className|classSource[|subclassShortName|subclassSource]
 * |level|source, lowercased) — confirmed by
 * scripts/investigate-ref-uid-shape.js: a refClassFeature uid's parts are
 * already in `cf|...` order, a refSubclassFeature uid's are already in
 * `scf|...` order.
 *
 * A uid may however OMIT its trailing source segment when that source
 * equals the segment the feature already defaults to (classSource for a
 * class feature, subclassSource for a subclass feature) — Druid's Primal
 * Order points at "Magician|Druid|XPHB|1", whose target's real id is
 * `cf|magician|druid|xphb|1|xphb`. Appending uid verbatim therefore misses
 * the target; the short form is expanded before lookup (see
 * scripts/investigate-class-feature-options.js, which found it).
 *
 * optionalfeature/feat uids only carry name|source (2 parts) and neither
 * optional-features.json nor feats.json has an `id` field, so those match
 * by name+source instead. A refOptionalfeature uid resolves against
 * optional-features.json first; if that comes up empty it falls back to
 * feats.json filtered to category "FS" (D12) — Fighting Style refs are the
 * one case where the "optionalfeature" ref kind actually points at a feat.
 *
 * 2 of the 74 refOptionalfeature uids in this data carry no source segment
 * at all (Bard/College of Swords' Fighting Style: "Dueling", "Two-Weapon
 * Fighting" — confirmed the only two by
 * scripts/investigate-sourceless-optionalfeature-refs.js). Both match
 * exactly one feats.json "FS" entry by name, so a name-only uid resolves
 * against the FS list when it matches EXACTLY ONE candidate; two or more
 * matches fails to resolve rather than guessing (D43 — a visible "text not
 * found" beats a silently wrong feature).
 */

function findByName(list: unknown[], name: string, source: string): ResolvedFeature | null {
	const match = list.find(
		(entry) =>
			isRecord(entry) &&
			asString(entry['name'])?.toLowerCase() === name.toLowerCase() &&
			asString(entry['source'])?.toLowerCase() === source.toLowerCase(),
	)
	if (!isRecord(match)) return null
	const entryName = asString(match['name'])
	if (!entryName) return null
	return { name: entryName, entries: asArray(match['entries']) ?? [] }
}

/** Resolves by name alone, but only when exactly one entry in `list` carries that name — an ambiguous name fails to resolve rather than picking one (D43). */
function findByNameUnique(list: unknown[], name: string): ResolvedFeature | null {
	const matches = list.filter(
		(entry): entry is Record<string, unknown> => isRecord(entry) && asString(entry['name'])?.toLowerCase() === name.toLowerCase(),
	)
	if (matches.length !== 1) return null
	const entryName = asString(matches[0]['name'])
	if (!entryName) return null
	return { name: entryName, entries: asArray(matches[0]['entries']) ?? [] }
}

function findById(list: unknown[], id: string): ResolvedFeature | null {
	const match = list.find((entry) => isRecord(entry) && asString(entry['id'])?.toLowerCase() === id)
	if (!isRecord(match)) return null
	const entryName = asString(match['name'])
	if (!entryName) return null
	return { name: entryName, entries: asArray(match['entries']) ?? [] }
}

/**
 * Restores the trailing source segment a uid is allowed to omit. `full` is
 * the segment count of the complete form; `defaultIndex` points at the
 * segment the omitted source repeats. A uid of any other length is returned
 * untouched so a genuinely malformed one still fails the lookup rather than
 * being silently reshaped into a wrong match.
 */
function withImpliedSource(uid: string, full: number, defaultIndex: number): string {
	const parts = uid.split('|')
	if (parts.length !== full - 1) return uid
	return [...parts, parts[defaultIndex]].join('|')
}

function resolveClassFeature(uid: string, classFeatures: unknown): ResolvedFeature | null {
	const list = asArray(classFeatures)
	if (!list) return null
	const id = `cf|${withImpliedSource(uid, 5, 2).toLowerCase()}`
	return findById(list, id)
}

function resolveSubclassFeature(uid: string, subclassFeatures: unknown): ResolvedFeature | null {
	const list = asArray(subclassFeatures)
	if (!list) return null
	const id = `scf|${withImpliedSource(uid, 7, 4).toLowerCase()}`
	return findById(list, id)
}

function resolveOptionalFeature(uid: string, optionalFeatures: unknown, feats: unknown): ResolvedFeature | null {
	const [name, source] = uid.split('|')
	if (!name) return null

	const featList = asArray(feats)
	const fightingStyles = featList ? featList.filter((entry) => isRecord(entry) && entry['category'] === 'FS') : []

	// A source-less uid ("Dueling", "Two-Weapon Fighting" — see module comment)
	// resolves only against the FS list, and only when the name is unambiguous.
	if (!source) return findByNameUnique(fightingStyles, name)

	const optionalList = asArray(optionalFeatures)
	const viaOptionalFeatures = optionalList ? findByName(optionalList, name, source) : null
	if (viaOptionalFeatures) return viaOptionalFeatures

	// D12: Fighting Styles moved to feats.json (category "FS") and no longer
	// exist in optional-features.json, but subclasses still point at them
	// via a refOptionalfeature node.
	return findByName(fightingStyles, name, source)
}

function resolveFeat(uid: string, feats: unknown): ResolvedFeature | null {
	const [name, source] = uid.split('|')
	if (!name || !source) return null
	const list = asArray(feats)
	if (!list) return null
	return findByName(list, name, source)
}

export function resolveRef(occurrence: RefOccurrence, data: ResolverData): ResolvedFeature | null {
	switch (occurrence.kind) {
		case 'classFeature':
			return resolveClassFeature(occurrence.uid, data.classFeatures)
		case 'subclassFeature':
			return resolveSubclassFeature(occurrence.uid, data.subclassFeatures)
		case 'optionalfeature':
			return resolveOptionalFeature(occurrence.uid, data.optionalFeatures, data.feats)
		case 'feat':
			return resolveFeat(occurrence.uid, data.feats)
	}
}
