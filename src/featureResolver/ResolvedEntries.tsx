import type { ReactNode } from 'react'
import { Entries } from '../markup'
import { buildExpansions, type Expansion } from './expandRefs'
import type { ResolverData } from './refTypes'

/*
 * Renders an entries tree the same way <Entries> always has (D7 unchanged —
 * ref* nodes still show only their name, with data-ref-uid on the element),
 * then appends one collapsed <details> per ref* found anywhere in that
 * tree, holding the referenced feature's own text. A ref that doesn't
 * resolve gets a visible note instead of a collapsible block, since there
 * is nothing to expand (D43 — missing data is shown, never a blank space
 * or a crash).
 *
 * <details> is plain HTML: the browser owns the open/closed state, so
 * there is no click handler or state to write here. Collapsed by default.
 */

export function ResolvedEntries({ entries, data }: { entries: unknown; data: ResolverData }): ReactNode {
	const expansions = buildExpansions(entries, data)
	return (
		<>
			<Entries entries={entries} />
			<ExpansionList expansions={expansions} />
		</>
	)
}

function ExpansionList({ expansions }: { expansions: Expansion[] }): ReactNode {
	if (expansions.length === 0) return null
	return expansions.map((expansion) => {
		const key = `${expansion.kind}:${expansion.uid}`
		if (!expansion.found) {
			return (
				<p key={key} className="feature-resolver__not-found">
					Text pro „{expansion.name}“ se nepodařilo dohledat.
				</p>
			)
		}
		return (
			<details key={key}>
				<summary>{expansion.name}</summary>
				<Entries entries={expansion.entries} />
				<ExpansionList expansions={expansion.children} />
			</details>
		)
	})
}
