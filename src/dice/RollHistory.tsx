import type { ReactNode } from 'react'

/** One roll as the button that made it reports it: its own label and its own formatted result. */
export interface RollReport {
	label: string
	text: string
}

export interface RollHistoryEntry extends RollReport {
	id: number
}

export const ROLL_HISTORY_LIMIT = 50

export function addRollHistoryEntry(history: RollHistoryEntry[], entry: RollHistoryEntry): RollHistoryEntry[] {
	return [entry, ...history].slice(0, ROLL_HISTORY_LIMIT)
}

function capitalized(label: string): string {
	return label.charAt(0).toUpperCase() + label.slice(1)
}

/** D41's convention: collapsed by default, the browser owns open/closed. */
export function RollHistory({ entries }: { entries: RollHistoryEntry[] }): ReactNode {
	return (
		<details className="sheet__roll-history">
			<summary>Roll history</summary>
			{entries.length === 0 ? (
				<p>No rolls yet.</p>
			) : (
				<ol>
					{entries.map((entry) => (
						<li key={entry.id}>
							{capitalized(entry.label)}: {entry.text}
						</li>
					))}
				</ol>
			)}
		</details>
	)
}
