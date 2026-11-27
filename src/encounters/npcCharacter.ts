import { known } from '../calculation/types'
import { EXHAUSTION } from '../conditions/conditions'
import { damageHitPoints, healHitPoints, type HitPointProps } from '../sheet/HitPoints'
import type { Character } from '../storage/character'
import type { CharacterStore } from '../storage/characterStore'

/** D438: an NPC whose current HP was never set starts the fight at its maximum. */
export const npcCurrentHp = (character: Character, max: number): number => character.currentHp ?? max

/** The sheet's own HP writer, pointed at the stored character, so damage and healing follow D110/D111/D169 exactly as on the sheet. */
function hitPointProps(store: CharacterStore, character: Character, max: number): HitPointProps {
	return {
		currentHp: npcCurrentHp(character, max),
		maxHitPoints: known(max, []),
		maxHpOverride: character.maxHpOverride,
		temporaryHitPoints: character.play?.temporaryHitPoints,
		deathSaves: character.play?.deathSaves,
		onEditHitPoints: (fields) => store.setHitPoints(character.id, fields),
	}
}

export function damageNpc(store: CharacterStore, character: Character, max: number, amount: number): void {
	if (amount > 0) damageHitPoints(hitPointProps(store, character, max), amount)
}

export function healNpc(store: CharacterStore, character: Character, max: number, amount: number): void {
	healHitPoints(hitPointProps(store, character, max), amount, max)
}

/** The sheet's conditions, Exhaustion as a plain chip at the end (D434 has no level in the encounter). */
export function npcConditions(character: Character): string[] {
	const conditions = character.play?.conditions ?? []
	return (character.play?.exhaustion ?? 0) > 0 ? [...conditions, EXHAUSTION] : conditions
}

/** Exhaustion added from the encounter is level 1 unless the sheet already has a level; removing it clears the level. */
export function addNpcCondition(store: CharacterStore, character: Character, condition: string): void {
	if (condition === EXHAUSTION) {
		if ((character.play?.exhaustion ?? 0) === 0) store.setExhaustion(character.id, 1)
		return
	}
	const conditions = character.play?.conditions ?? []
	if (!conditions.includes(condition)) store.setConditions(character.id, [...conditions, condition])
}

export function removeNpcCondition(store: CharacterStore, character: Character, condition: string): void {
	if (condition === EXHAUSTION) store.setExhaustion(character.id, 0)
	else store.setConditions(character.id, (character.play?.conditions ?? []).filter((name) => name !== condition))
}
