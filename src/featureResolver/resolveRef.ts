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
 * optionalfeature/feat uids only carry name|source (2 parts) and neither
 * optional-features.json nor feats.json has an `id` field, so those match
 * by name+source instead. A refOptionalfeature uid resolves against
 * optional-features.json first; if that comes up empty it falls back to
 * feats.json filtered to category "FS" (D12) — Fighting Style refs are the
 * one case where the "optionalfeature" ref kind actually points at a feat.
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

function findById(list: unknown[], id: string): ResolvedFeature | null {
	const match = list.find((entry) => isRecord(entry) && asString(entry['id'])?.toLowerCase() === id)
	if (!isRecord(match)) return null
	const entryName = asString(match['name'])
	if (!entryName) return null
	return { name: entryName, entries: asArray(match['entries']) ?? [] }
}

function resolveClassFeature(uid: string, classFeatures: unknown): ResolvedFeature | null {
	const list = asArray(classFeatures)
	if (!list) return null
	const id = `cf|${uid.toLowerCase()}`
	return findById(list, id)
}

function resolveSubclassFeature(uid: string, subclassFeatures: unknown): ResolvedFeature | null {
	const list = asArray(subclassFeatures)
	if (!list) return null
	const id = `scf|${uid.toLowerCase()}`
	return findById(list, id)
}

function resolveOptionalFeature(uid: string, optionalFeatures: unknown, feats: unknown): ResolvedFeature | null {
	const [name, source] = uid.split('|')
	if (!name || !source) return null

	const optionalList = asArray(optionalFeatures)
	const viaOptionalFeatures = optionalList ? findByName(optionalList, name, source) : null
	if (viaOptionalFeatures) return viaOptionalFeatures

	// D12: Fighting Styles moved to feats.json (category "FS") and no longer
	// exist in optional-features.json, but subclasses still point at them
	// via a refOptionalfeature node.
	const featList = asArray(feats)
	if (!featList) return null
	const fightingStyles = featList.filter((entry) => isRecord(entry) && entry['category'] === 'FS')
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
