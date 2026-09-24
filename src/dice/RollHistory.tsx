import type { ReactNode } from 'react'

/** The dice behind a report, for the toast: `keptIndex` is the d20 that counts, null when every die counts. */
export interface RollDetail {
	dice: number[]
	keptIndex: number | null
	modifier: number
	total: number
}

/** One roll as the button that made it reports it: its own label and its own formatted result. */
export interface RollReport {
	label: string
	text: string
	detail?: RollDetail
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

/** The body of the "Roll history" drawer (D165). */
export function RollHistory({ entries }: { entries: RollHistoryEntry[] }): ReactNode {
	return entries.length === 0 ? (
		<p>No rolls yet.</p>
	) : (
		<ol className="sheet__roll-history">
			{entries.map((entry) => (
				<li key={entry.id}>
					{capitalized(entry.label)}: {entry.text}
				</li>
			))}
		</ol>
	)
}
