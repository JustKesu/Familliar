import type { Character } from '../storage/character'
import { findPicked } from '../storage/choiceMatch'
import { characterFeats, type FeatEffectEntry } from './featEffects'

/** A2: a class feature's pick (Character.fightingStyles, D318) or a Fighting Style feat taken as a feat. */
export function hasFightingStyle(character: Character, feats: readonly FeatEffectEntry[], name: string): boolean {
	const wanted = name.toLowerCase()
	const classStyle = (character.fightingStyles ?? []).some((style) => {
		const row = findPicked(feats, style)
		if (row) return row.name.toLowerCase() === wanted
		// A style with no row of its name at all still counts by its stored name, as before D318; a same-named row of another source (D318) does not.
		const styleName = style.name.toLowerCase()
		return styleName === wanted && !feats.some((feat) => feat.name.toLowerCase() === styleName)
	})
	return classStyle || characterFeats(character, feats).some((feat) => feat.name.toLowerCase() === wanted)
}
