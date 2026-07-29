import { asArray, asString, isRecord, type RefKind, type RefOccurrence } from './refTypes'

/*
 * Finds every ref* node in a raw `entries` tree, at any depth — inside a
 * `list`'s items, an `options` block, a plain `entries`/`section` block, or
 * a table row. 131 of the 420 ref* occurrences in class/subclass features
 * sit below the top level (scripts/investigate-ref-ancestors.js), so a
 * scan that only looked at the top of the array would miss almost a third
 * of them.
 */

const REF_FIELD: Record<string, RefKind> = {
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

function nodeBody(node: Record<string, unknown>): unknown[] {
	const entries = asArray(node['entries'])
	if (entries) return entries
	if (node['entry'] !== undefined) return [node['entry']]
	return []
}

function walk(node: unknown, out: RefOccurrence[]): void {
	if (Array.isArray(node)) {
		for (const item of node) walk(item, out)
		return
	}
	if (!isRecord(node)) return

	const type = asString(node['type'])
	const kind = type ? REF_FIELD[type] : undefined
	if (kind) {
		const uid = asString(node[REF_UID_FIELD[kind]])
		if (uid) out.push({ kind, uid })
		return
	}

	walk(nodeBody(node), out)
	walk(node['items'], out)
	walk(node['rows'], out)
	if (isRecord(node['row'])) walk(node['row']['row'], out)
}

/** Every ref* occurrence in `entries`, in document order, duplicates included. */
export function scanRefs(entries: unknown): RefOccurrence[] {
	const out: RefOccurrence[] = []
	walk(entries, out)
	return out
}

/** `scanRefs`, deduplicated by kind+uid — for deciding what to show once. */
export function distinctRefs(entries: unknown): RefOccurrence[] {
	const seen = new Set<string>()
	const out: RefOccurrence[] = []
	for (const occurrence of scanRefs(entries)) {
		const key = `${occurrence.kind}:${occurrence.uid}`
		if (seen.has(key)) continue
		seen.add(key)
		out.push(occurrence)
	}
	return out
}
