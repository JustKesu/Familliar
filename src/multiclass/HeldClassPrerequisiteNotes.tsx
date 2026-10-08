import { useEffect, useState, type ReactNode } from 'react'
import { loadDataFile } from '../dataLoader/dataLoader'
import { loadFeats, type FeatEntry } from '../featAsi/featAsiData'
import type { Character } from '../storage/character'
import { heldClassPrerequisiteNote, multiclassPrerequisiteScores } from './multiclassPrerequisites'

/** D333: step Abilities of a multiclass Edit — a muted note per held class whose prerequisite the draft's scores fall below. Saving stays allowed. */
export function HeldClassPrerequisiteNotes({ draft }: { draft: Character }): ReactNode {
	const [data, setData] = useState<{ parsedClasses: unknown; feats: FeatEntry[] } | null>(null)
	useEffect(() => {
		let cancelled = false
		Promise.all([loadDataFile('data/classes.json'), loadFeats()])
			.then(([parsedClasses, feats]) => {
				if (!cancelled) setData({ parsedClasses, feats })
			})
			.catch(() => {
				/* Only a hint: without the data no note is shown. */
			})
		return () => {
			cancelled = true
		}
	}, [])
	if (data === null || draft.abilityScores === undefined) return null
	const scores = multiclassPrerequisiteScores(draft, data.feats)
	const notes = draft.classes.flatMap((held) => {
		const note = heldClassPrerequisiteNote(held, data.parsedClasses, scores)
		return note === null ? [] : [{ key: `${held.className}|${held.classSource}`, note }]
	})
	return notes.map(({ key, note }) => (
		<p key={key} className="ability-prerequisite-note">
			{note}
		</p>
	))
}
