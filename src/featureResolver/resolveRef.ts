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
 * A uid may however leave segments EMPTY or omit them from the end, and the
 * id is built from the defaulted form, exactly as
 * scripts/extract-data.js's makeClassFeatureIdFromRef /
 * makeSubclassFeatureIdFromRef build the `id` these lookups match against.
 * An empty classSource or subclassSource means PHB (5etools' default for a
 * 2014 reference); an empty trailing source repeats the source the feature
 * already carries. Both short forms occur: Druid's Primal Order points at
 * "Magician|Druid|XPHB|1" (omitted source), and 134 of the 420 ref* nodes
 * in data/ look like "Wails from the Grave|Rogue||Phantom|TCE|3" (empty
 * classSource AND omitted source) — the second form resolved against
 * nothing until the defaulting below was added.
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

/** One uid segment, defaulted to "" when empty or absent, in the id's own casing. */
function segment(parts: string[], index: number): string {
	return (parts[index] ?? '').trim().toLowerCase()
}

function classFeatureId(uid: string): string {
	const parts = uid.split('|')
	const classSource = segment(parts, 2) || 'phb'
	const source = segment(parts, 4) || classSource
	return ['cf', segment(parts, 0), segment(parts, 1), classSource, segment(parts, 3), source].join('|')
}

function subclassFeatureId(uid: string): string {
	const parts = uid.split('|')
	const classSource = segment(parts, 2) || 'phb'
	const subclassSource = segment(parts, 4) || 'phb'
	const source = segment(parts, 6) || subclassSource
	return [
		'scf',
		segment(parts, 0),
		segment(parts, 1),
		classSource,
		segment(parts, 3),
		subclassSource,
		segment(parts, 5),
		source,
	].join('|')
}

function resolveClassFeature(uid: string, classFeatures: unknown): ResolvedFeature | null {
	const list = asArray(classFeatures)
	if (!list) return null
	return findById(list, classFeatureId(uid))
}

function resolveSubclassFeature(uid: string, subclassFeatures: unknown): ResolvedFeature | null {
	const list = asArray(subclassFeatures)
	if (!list) return null
	return findById(list, subclassFeatureId(uid))
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
