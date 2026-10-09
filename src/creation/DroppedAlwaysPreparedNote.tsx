import type { ReactNode } from 'react'
import type { DroppedAlwaysPrepared } from './wizardState'

function listNames(names: readonly string[]): string {
	if (names.length <= 1) return names.join('')
	return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** D339/D340: says which picks the wizard dropped because the current subclass or the class itself grants them as always prepared. */
export function DroppedAlwaysPreparedNote({ dropped }: { dropped: readonly DroppedAlwaysPrepared[] }): ReactNode {
	if (dropped.length === 0) return null
	return (
		<>
			{dropped.map((entry) => (
				<p key={`${entry.subclassName ?? entry.className}|${entry.spellNames.join('|')}`} className="manage-spells__empty dropped-always-prepared-note">
					{listNames(entry.spellNames)} {entry.spellNames.length === 1 ? 'is' : 'are'} always prepared by {entry.subclassName ?? entry.className} and{' '}
					{entry.spellNames.length === 1 ? 'was' : 'were'} removed from your picks.
				</p>
			))}
		</>
	)
}
