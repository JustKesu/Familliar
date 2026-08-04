/*
 * D41 — the breakdown of a computed value is shown only on request, one
 * `<details>` per value, default collapsed. The browser owns the
 * collapse/expand state and the click handling; nothing here tracks either.
 *
 * Written once, shared by every value that has a breakdown (D40) — this
 * task's ability scores/saves/initiative/proficiency bonus, and 5b's skills
 * — rather than reimplemented per value.
 *
 * D60 — a contribution can carry a note instead of an amount (amount stays
 * 0 so the sum is unaffected); that note is shown as text, never folded
 * into "+0".
 */

import type { ReactNode } from 'react'
import type { Contribution } from '../calculation/types'

export function ValueBreakdown({ breakdown }: { breakdown: Contribution[] }): ReactNode {
	return (
		<details>
			<summary>Breakdown</summary>
			<ul>
				{breakdown.map((contribution, index) => (
					<li key={index}>
						{contribution.source}: {contribution.note ?? (contribution.amount >= 0 ? `+${contribution.amount}` : contribution.amount)}
					</li>
				))}
			</ul>
		</details>
	)
}

/** D43 — a value the calculation layer could not determine. Shown plainly as unresolved, never as a number or as blank. */
export function UnresolvedValue({ reason }: { reason: string }): ReactNode {
	return <span data-status="unknown">unresolved — {reason}</span>
}
