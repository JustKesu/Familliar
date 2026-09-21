/*
 * The character's FULL set of granted class and subclass features — the list the
 * "Schopnosti a rysy" tab shows, distinct from the three narrow slices it
 * rendered before (feats, the D21 class-feature choices, class optional
 * features). Pure (D38): every file is passed in, none is fetched here.
 *
 * The rule (D87, from scripts/investigate-full-feature-resolution.js):
 *
 *   1. SEED. For each class (and its subclass, once one is stored) take the
 *      class-features.json / subclass-features.json entries whose `id` is in
 *      that class's `classFeatureIds` / that subclass's `subclassFeatureIds`
 *      AND whose `level` is <= the character's level in that class. The
 *      class/subclass/level match reuses buildFeatureReachTest (featureReach.ts),
 *      shared with featureNamesFor.
 *
 *   2. TRANSITIVE CLOSURE. Extend the seed by following ref* nodes
 *      (refClassFeature / refSubclassFeature / refOptionalfeature / refFeat)
 *      found in each collected feature's PLAIN entries text, repeating until the
 *      set stops growing. Targets are matched by id/uid, never by name — Cleric's
 *      and Druid's separate "Potent Spellcasting" must resolve independently.
 *      A ref* node that sits inside a counted `options` node is NOT followed:
 *      that marks an alternative of a choice, not something granted.
 *
 *   3. Exclude CHOICE CONTAINERS. A feature whose own counted `options` node is
 *      all refClassFeature (the 3 D21 parents) or contains refOptionalfeature
 *      (the 6 ClassOptionalFeaturePicker / fighting-style parents) is left out
 *      entirely — its resolved pick is already shown by classFeatureChoices /
 *      classOptionalFeatures. Structural check, never a name list.
 *
 *   4. Exclude `gainSubclassFeature: true` PLACEHOLDER refs (the "Cleric
 *      Subclass"-style slot markers in classes.json). Structural flag; the
 *      actual subclass is shown in the sheet header.
 *
 *   5. Wrapper features are NOT specially hidden. "Life Domain" (Cleric), whose
 *      text mainly introduces further features by ref, appears as an ordinary
 *      entry alongside the features it introduces — no structural way to tell a
 *      "wrapper" from a normal feature was found, and a name list is what D21
 *      forbids. Revisit cosmetically once a real sheet is reviewed.
 */

import { loadDataFile } from '../dataLoader/dataLoader'
import {
	featureIdForRef,
	loadResolverData,
	resolveRef,
	type RefKind,
	type RefOccurrence,
	type ResolverData,
} from '../featureResolver'
import type { Character } from '../storage/character'
import { buildFeatureReachTest } from './featureReach'

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asArray(value: unknown): unknown[] | undefined {
	return Array.isArray(value) ? value : undefined
}

/** One resolved feature, in the shape the sheet renders (name, the level it is granted at, its own entries text). */
export interface GrantedFeature {
	id: string
	name: string
	/** The feature's own `level` field — shown as "level N". */
	level: number
	entries: unknown[]
	kind: 'class' | 'subclass'
	/** The record's own class, and for a subclass feature its subclass short name — what the sheet labels a feature's origin with. */
	className: string
	subclassShortName?: string
	/*
	 * Carried through unread by this module, for D86's actions-table test: 72 of
	 * the 215 qualifying class/subclass features (Stunning Strike, Deflect
	 * Attacks…) carry `consumes` and NO rest tag, so a shape keeping only
	 * `entries` loses them (scripts/investigate-choice-option-usability.js).
	 */
	consumes?: unknown
}

interface FeatureRecord {
	id: string
	name: string
	level: number
	entries: unknown[]
	className: string
	classSource: string
	subclassShortName?: string
	subclassSource?: string
	consumes?: unknown
}

/** class-features.json / subclass-features.json filtered to the entries this resolver can key on (a string `id`, and the fields buildFeatureReachTest needs). */
function featureRecords(parsed: unknown): FeatureRecord[] {
	const list = asArray(parsed)
	if (!list) return []
	const out: FeatureRecord[] = []
	for (const entry of list) {
		if (!isRecord(entry)) continue
		if (typeof entry['id'] !== 'string' || typeof entry['name'] !== 'string') continue
		if (typeof entry['className'] !== 'string' || typeof entry['classSource'] !== 'string') continue
		if (typeof entry['level'] !== 'number') continue
		out.push({
			id: entry['id'],
			name: entry['name'],
			level: entry['level'],
			entries: asArray(entry['entries']) ?? [],
			className: entry['className'],
			classSource: entry['classSource'],
			...(typeof entry['subclassShortName'] === 'string' ? { subclassShortName: entry['subclassShortName'] } : {}),
			...(typeof entry['subclassSource'] === 'string' ? { subclassSource: entry['subclassSource'] } : {}),
			...(entry['consumes'] !== undefined ? { consumes: entry['consumes'] } : {}),
		})
	}
	return out
}

interface GrantSets {
	/** class-features ids a class grants directly (exact casing, as classes.json writes them). */
	grantedClassIds: Set<string>
	grantedSubclassIds: Set<string>
	/** class-features ids reached only through a `gainSubclassFeature: true` ref — rule 4 (lowercased, to compare against featureIdForRef output). */
	gainSubclassIds: Set<string>
}

function grantSetsFrom(parsedClasses: unknown[]): GrantSets {
	const grantedClassIds = new Set<string>()
	const grantedSubclassIds = new Set<string>()
	const gainSubclassIds = new Set<string>()
	for (const entry of parsedClasses) {
		if (!isRecord(entry)) continue
		if (entry['entryType'] === 'class') {
			for (const id of asArray(entry['classFeatureIds']) ?? []) if (typeof id === 'string') grantedClassIds.add(id)
			for (const ref of asArray(entry['classFeatures']) ?? []) {
				if (isRecord(ref) && ref['gainSubclassFeature'] === true && typeof ref['classFeature'] === 'string') {
					const id = featureIdForRef({ kind: 'classFeature', uid: ref['classFeature'] })
					if (id) gainSubclassIds.add(id)
				}
			}
		} else if (entry['entryType'] === 'subclass') {
			for (const id of asArray(entry['subclassFeatureIds']) ?? []) if (typeof id === 'string') grantedSubclassIds.add(id)
		}
	}
	return { grantedClassIds, grantedSubclassIds, gainSubclassIds }
}

const REF_KIND: Record<string, RefKind> = {
	refClassFeature: 'classFeature',
	refSubclassFeature: 'subclassFeature',
	refOptionalfeature: 'optionalfeature',
	refFeat: 'feat',
}

const REF_UID_FIELD: Record<RefKind, string> = {
	classFeature: 'classFeature',
	subclassFeature: 'subclassFeature',
	optionalfeature: 'optionalfeature',
	feat: 'feat',
}

/** Every ref* occurrence in `entries` that is NOT inside a counted `options` node — rule 2's "plain text" refs, at any depth. */
function plainTextRefs(entries: unknown): RefOccurrence[] {
	const out: RefOccurrence[] = []
	walkRefs(entries, false, out)
	return out
}

function walkRefs(node: unknown, insideCountedOptions: boolean, out: RefOccurrence[]): void {
	if (Array.isArray(node)) {
		for (const child of node) walkRefs(child, insideCountedOptions, out)
		return
	}
	if (!isRecord(node)) return

	const type = typeof node['type'] === 'string' ? node['type'] : undefined
	const kind = type ? REF_KIND[type] : undefined
	if (kind) {
		if (!insideCountedOptions) {
			const uid = node[REF_UID_FIELD[kind]]
			if (typeof uid === 'string' && uid !== '') out.push({ kind, uid })
		}
		return
	}

	const nowInside = insideCountedOptions || (type === 'options' && typeof node['count'] === 'number')
	for (const key of Object.keys(node)) walkRefs(node[key], nowInside, out)
}

/** Rule 3: a counted `options` node that is all refClassFeature, or that holds any refOptionalfeature. The investigation confirmed no counted node mixes the two. */
function isChoiceContainer(entries: unknown): boolean {
	for (const node of countedOptionsNodes(entries, [])) {
		const kinds = new Set((asArray(node['entries']) ?? []).map((entry) => (isRecord(entry) ? entry['type'] : typeof entry)))
		if (kinds.size === 1 && kinds.has('refClassFeature')) return true
		if (kinds.has('refOptionalfeature')) return true
	}
	return false
}

function countedOptionsNodes(node: unknown, out: Record<string, unknown>[]): Record<string, unknown>[] {
	if (Array.isArray(node)) {
		for (const child of node) countedOptionsNodes(child, out)
		return out
	}
	if (!isRecord(node)) return out
	if (node['type'] === 'options' && typeof node['count'] === 'number') out.push(node)
	for (const key of Object.keys(node)) countedOptionsNodes(node[key], out)
	return out
}

/**
 * The character's full granted class + subclass feature list, sorted by the
 * level a feature is granted at, then by name.
 *
 * `resolverData` supplies class-features.json and subclass-features.json (and
 * the two files an optionalfeature/feat ref resolves against); `parsedClasses`
 * is classes.json.
 */
export function grantedClassFeaturesFrom(character: Character, parsedClasses: unknown, resolverData: ResolverData): GrantedFeature[] {
	if (!Array.isArray(parsedClasses)) throw new Error('classes.json: expected a top-level array.')

	const classFeatures = featureRecords(resolverData.classFeatures)
	const subclassFeatures = featureRecords(resolverData.subclassFeatures)
	const { grantedClassIds, grantedSubclassIds, gainSubclassIds } = grantSetsFrom(parsedClasses)
	const reached = buildFeatureReachTest(character, parsedClasses)

	// Lowercased-id index: featureIdForRef defaults empty uid segments and lowercases,
	// so a closure lookup by ref uid has to compare against lowercased record ids (D87 rule 2 — id/uid, never name).
	const byId = new Map<string, { record: FeatureRecord; kind: 'class' | 'subclass' }>()
	for (const record of classFeatures) byId.set(record.id.toLowerCase(), { record, kind: 'class' })
	for (const record of subclassFeatures) byId.set(record.id.toLowerCase(), { record, kind: 'subclass' })

	const result = new Map<string, GrantedFeature>()
	const visited = new Set<string>() // feature ids added OR deliberately excluded — never revisit
	const visitedExternal = new Set<string>() // optionalfeature/feat uids already resolved once
	const frontier: unknown[] = [] // entries trees still to scan for plain-text refs

	function consider(record: FeatureRecord, kind: 'class' | 'subclass'): void {
		if (visited.has(record.id)) return
		visited.add(record.id)
		if (gainSubclassIds.has(record.id.toLowerCase())) return // rule 4
		if (isChoiceContainer(record.entries)) return // rule 3
		result.set(record.id, {
			id: record.id,
			name: record.name,
			level: record.level,
			entries: record.entries,
			kind,
			className: record.className,
			...(record.subclassShortName !== undefined ? { subclassShortName: record.subclassShortName } : {}),
			...(record.consumes !== undefined ? { consumes: record.consumes } : {}),
		})
		frontier.push(record.entries)
	}

	// Rule 1 — seed.
	for (const record of classFeatures) if (grantedClassIds.has(record.id) && reached(record)) consider(record, 'class')
	for (const record of subclassFeatures) if (grantedSubclassIds.has(record.id) && reached(record)) consider(record, 'subclass')

	// Rule 2 — transitive closure over plain-text refs.
	while (frontier.length > 0) {
		const entries = frontier.shift()
		for (const ref of plainTextRefs(entries)) {
			if (ref.kind === 'classFeature' || ref.kind === 'subclassFeature') {
				const id = featureIdForRef(ref)
				const hit = id ? byId.get(id) : undefined
				if (hit) consider(hit.record, hit.kind)
				continue
			}
			/*
			 * refOptionalfeature / refFeat in plain text: the target lives in
			 * optional-features.json / feats.json, so rule 6 keeps it out of THIS
			 * list. It is still resolved once and its own text scanned, so anything
			 * IT grants by a further ref is not missed. In practice the data carries
			 * no such plain-text ref (they only appear inside counted options, where
			 * rule 2 already skips them), so this branch is a safety net.
			 */
			const key = `${ref.kind}:${ref.uid}`
			if (visitedExternal.has(key)) continue
			visitedExternal.add(key)
			const resolved = resolveRef(ref, resolverData)
			if (resolved) frontier.push(resolved.entries)
		}
	}

	return [...result.values()].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name) || a.kind.localeCompare(b.kind))
}

/** classes.json is a second fetch here (it is not part of ResolverData); the shared loader caches it, so the rest of the sheet's classes.json reads are free (D39). */
export async function loadGrantedClassFeatures(character: Character): Promise<GrantedFeature[]> {
	const [classes, resolverData] = await Promise.all([loadDataFile('data/classes.json'), loadResolverData()])
	return grantedClassFeaturesFrom(character, classes, resolverData)
}
