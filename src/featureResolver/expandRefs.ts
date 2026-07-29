import { resolveRef } from './resolveRef'
import { distinctRefs } from './scanRefs'
import { uidName } from '../markup/entryTypes'
import type { RefKind, ResolverData } from './refTypes'

/*
 * One expansion per distinct ref* found in an entries tree, resolved and
 * (recursively) expanded again for whatever ref*s the resolved text itself
 * contains — a subclass feature can point at another class feature, which
 * can point at a feat, and so on.
 *
 * `seen` guards the recursion: a feature already open on the current
 * expansion path is not re-expanded (its `children` come back empty rather
 * than looping). It is threaded per-branch, not shared globally, so the
 * same feature referenced from two different siblings still expands fully
 * in both places — only an actual cycle is cut short.
 */

export interface Expansion {
	kind: RefKind
	uid: string
	name: string
	found: boolean
	entries: unknown[]
	children: Expansion[]
}

export function buildExpansions(entries: unknown, data: ResolverData, seen: ReadonlySet<string> = new Set()): Expansion[] {
	return distinctRefs(entries)
		.filter((occurrence) => !seen.has(`${occurrence.kind}:${occurrence.uid}`))
		.map((occurrence) => {
			const key = `${occurrence.kind}:${occurrence.uid}`
			const resolved = resolveRef(occurrence, data)

			if (!resolved) {
				return {
					kind: occurrence.kind,
					uid: occurrence.uid,
					name: uidName(occurrence.uid),
					found: false,
					entries: [],
					children: [],
				}
			}

			const children = buildExpansions(resolved.entries, data, new Set(seen).add(key))

			return {
				kind: occurrence.kind,
				uid: occurrence.uid,
				name: resolved.name,
				found: true,
				entries: resolved.entries,
				children,
			}
		})
}
