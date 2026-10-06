import type { Character } from '../storage/character'
import { findPicked } from '../storage/choiceMatch'
import { characterFeats, type FeatEffectEntry } from './featEffects'

/** A2: a class feature's pick (Character.fightingStyles, D318) or a Fighting Style feat taken as a feat. */
export function hasFightingStyle(character: Character, feats: readonly FeatEffectEntry[], name: string): boolean {
	const wanted = name.toLowerCase()
	// A style whose row is missing from `feats` still counts by its stored name, as before D318.
	const classStyle = (character.fightingStyles ?? []).some((style) => (findPicked(feats, style)?.name ?? style.name).toLowerCase() === wanted)
	return classStyle || characterFeats(character, feats).some((feat) => feat.name.toLowerCase() === wanted)
}
