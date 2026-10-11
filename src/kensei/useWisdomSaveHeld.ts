import { useEffect, useState } from 'react'
import type { FeatEffectEntry } from '../calculation/featEffects'
import { saveProficiencySources, type ClassSavingThrowProficiencies } from '../calculation/savingThrows'
import { loadFeatEffectEntries, loadSavingThrowClassData } from '../sheet/sheetData'
import type { Character } from '../storage/character'

/** D344: whether the draft already has Wisdom save proficiency from anything but Elegant Courtier; null while loading. */
export function useWisdomSaveHeld(draft: Character, enabled: boolean): boolean | null {
	const [data, setData] = useState<{ classes: ClassSavingThrowProficiencies[]; feats: FeatEffectEntry[] } | 'failed' | null>(null)

	useEffect(() => {
		if (!enabled || data !== null) return
		let cancelled = false
		Promise.all([loadSavingThrowClassData(), loadFeatEffectEntries()])
			.then(([classes, feats]) => {
				if (!cancelled) setData({ classes, feats })
			})
			.catch(() => {
				if (!cancelled) setData('failed')
			})
		return () => {
			cancelled = true
		}
	}, [enabled, data])

	if (!enabled || data === null) return null
	// A failed load offers the choice rather than hiding it: a pick the sheet then ignores costs nothing.
	if (data === 'failed') return true
	const wisdom = saveProficiencySources('wisdom', draft, data.classes, data.feats)
	return 'reason' in wisdom ? true : wisdom.granting.length > 0
}
