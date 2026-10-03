import type { Character } from '../storage/character'
import { characterFeats, type FeatEffectEntry } from './featEffects'

/** A2: the class feature's pick (Character.fightingStyle) or a Fighting Style feat taken as a feat. */
export function hasFightingStyle(character: Character, feats: readonly FeatEffectEntry[], name: string): boolean {
	const wanted = name.toLowerCase()
	return character.fightingStyle?.toLowerCase() === wanted || characterFeats(character, feats).some((feat) => feat.name.toLowerCase() === wanted)
}
