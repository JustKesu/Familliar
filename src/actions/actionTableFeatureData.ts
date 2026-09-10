/*
 * D86: a feature belongs in the actions table if it carries `consumes`
 * (spends a named pool — Ki, Channel Divinity, Sorcery Point…), OR its
 * `entries` mention the {@variantrule Long Rest|…} / {@variantrule Short
 * Rest|…} tag anywhere, at any depth. `consumes` alone misses every
 * POOL-GRANTING feature (Second Wind, Rage, Font of Magic…) — only the
 * spenders carry it (docs/REPORT.md, "sheet rebuild slice 1"). The rest tag
 * closes that gap: verified against class-features/subclass-features/
 * feats/optional-features.json, it reaches all 13 previously hand-checked
 * "certainly usable" features and 157 more that `consumes` never saw.
 *
 * Deliberately NOT exhaustive (D86's accepted false negatives): a feature
 * limited some other way than rest ("once per turn"), or an older/reprinted
 * record using plain "long rest" prose instead of the tag, reads as false
 * here. Not hand-listed as an exception — D21 rejects a growing name table.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const REST_TAG = /\{@variantrule\s+(Long Rest|Short Rest)\b/i

// Same tree shape scanRefs.ts already walks for ref* nodes (entries/entry,
// items, rows, row.row) — the two searches differ in what they look for at
// each string leaf, not in how they get there.
function nodeBody(node: Record<string, unknown>): unknown[] {
	const entries = node['entries']
	if (Array.isArray(entries)) return entries
	if (node['entry'] !== undefined) return [node['entry']]
	return []
}

function hasRestTag(node: unknown): boolean {
	if (typeof node === 'string') return REST_TAG.test(node)
	if (Array.isArray(node)) return node.some(hasRestTag)
	if (!isRecord(node)) return false
	if (hasRestTag(nodeBody(node))) return true
	if (hasRestTag(node['items'])) return true
	if (hasRestTag(node['rows'])) return true
	if (isRecord(node['row']) && hasRestTag(node['row']['row'])) return true
	return false
}

/**
 * Whether a class feature, subclass feature, feat or optional feature
 * belongs in the actions table (D86). Pure (D38) and shape-agnostic: any
 * record carrying `consumes` and/or `entries` in the way the four source
 * files write them qualifies — no per-file branching needed, since both
 * fields mean the same thing regardless of which file they came from.
 */
export function isActionTableFeature(feature: unknown): boolean {
	if (!isRecord(feature)) return false
	if (feature['consumes'] !== undefined) return true
	return hasRestTag(feature['entries'])
}
