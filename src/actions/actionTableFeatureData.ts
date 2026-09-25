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

/** Exported for src/calculation/resources.ts, whose own narrower test (slice 9b1) starts from the same tag and adds to it. */
export function hasRestTag(node: unknown): boolean {
	if (typeof node === 'string') return REST_TAG.test(node)
	if (Array.isArray(node)) return node.some(hasRestTag)
	if (!isRecord(node)) return false
	if (hasRestTag(nodeBody(node))) return true
	if (hasRestTag(node['items'])) return true
	if (hasRestTag(node['rows'])) return true
	if (isRecord(node['row']) && hasRestTag(node['row']['row'])) return true
	return false
}

export type ActionType = 'action' | 'bonus' | 'reaction' | 'other'

/** Every string leaf, in document order, over the same tree shape hasRestTag walks. */
function stringLeaves(node: unknown, out: string[] = []): string[] {
	if (typeof node === 'string') out.push(node)
	else if (Array.isArray(node)) for (const child of node) stringLeaves(child, out)
	else if (isRecord(node)) {
		stringLeaves(nodeBody(node), out)
		stringLeaves(node['items'], out)
		stringLeaves(node['rows'], out)
		if (isRecord(node['row'])) stringLeaves(node['row']['row'], out)
	}
	return out
}

/*
 * D182 "R-phrase" (scripts/investigate-r5b-action-types.js): closed word lists
 * around the activation tag, accepted under D21 in the spirit of D86. "its" is
 * not a determiner — "its Reaction" is another creature's (Commander's Strike).
 */
const LEAD_IN = String.raw`\b(?:as|use|take|takes|taking|using|spend)\s+(?:a|an|your|one)\s+`
const ACTION_FRAMES: readonly { type: ActionType; re: RegExp }[] = [
	{ type: 'bonus', re: new RegExp(LEAD_IN + String.raw`\{@variantrule Bonus Action\b`, 'gi') },
	{ type: 'reaction', re: new RegExp(LEAD_IN + String.raw`\{@variantrule Reaction\b`, 'gi') },
	// "take the Dash action as a Bonus Action" is a Bonus Action (Step of the Wind), so the A frames stop short of it.
	{ type: 'action', re: /\b(?:as|take|takes|taking|use)\s+(?:the|a|an|one)\s+\{@action [^}]+\}\s+actions?(?!\s+(?:as|using)\s+(?:a|an|your)\s+\{@variantrule (?:Bonus Action|Reaction)\b)/gi },
	{ type: 'action', re: /\b(?:take|takes|taking)\s+(?:both\s+)?the\s+\{@action [^}]+\}\s+and\s+(?:the\s+)?\{@action [^}]+\}\s+actions(?!\s+as\s+(?:a|an|your)\s+\{@variantrule (?:Bonus Action|Reaction)\b)/gi },
	{ type: 'other', re: /\(?no action required\)?/gi },
]
// "when you take a Reaction…" names a trigger, not how this feature is activated.
const TRIGGER_BEFORE = /\b(?:when|whenever|if|after|once|until|before)\s+(?:you|it|they|the target|a creature)\s+(?:can\s+)?$/i

/**
 * Which action a feature's activation costs (D182): the first R-phrase frame in
 * document order wins; a feature with none is 'other' (D86's accepted-limit spirit —
 * the 26 untagged TCE/XGE records land there).
 */
export function classifyActionType(feature: unknown): ActionType {
	if (!isRecord(feature)) return 'other'
	for (const text of stringLeaves(feature['entries'])) {
		let first: { type: ActionType; at: number } | null = null
		for (const frame of ACTION_FRAMES) {
			for (const match of text.matchAll(frame.re)) {
				if (TRIGGER_BEFORE.test(text.slice(Math.max(0, match.index - 40), match.index))) continue
				if (!first || match.index < first.at) first = { type: frame.type, at: match.index }
				break
			}
		}
		if (first) return first.type
	}
	return 'other'
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
