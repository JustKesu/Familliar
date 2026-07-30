/*
 * Hit dice pool (build order step 4, D11): one die type per class, iterated
 * over character.classes rather than assuming a single class. classes.json
 * stores the die as `hd: { number: 1, faces: N }` (scripts/investigate-calc-slice2.js) —
 * `number` is always 1 per level here, so only `faces` is needed; the pool's
 * count per class comes from the character's own level in that class.
 */

import type { CharacterClass } from '../storage/character'
import { type Calculated, type Contribution, known, unknown } from './types'

export interface ClassHitDie {
	className: string
	classSource: string
	faces: number
}

export interface HitDiceEntry {
	className: string
	faces: number
	count: number
}

function findClassHitDie(characterClass: CharacterClass, classData: ClassHitDie[]): ClassHitDie | undefined {
	return classData.find((c) => c.className === characterClass.className && c.classSource === characterClass.classSource)
}

export function computeHitDicePool(classes: CharacterClass[], classData: ClassHitDie[]): Calculated<HitDiceEntry[]> {
	if (classes.length === 0) {
		return unknown('Character has no classes yet.')
	}

	const value: HitDiceEntry[] = []
	const breakdown: Contribution[] = []
	for (const characterClass of classes) {
		const hitDie = findClassHitDie(characterClass, classData)
		if (!hitDie) {
			return unknown(`No hit die data for class "${characterClass.className}" (${characterClass.classSource}).`)
		}
		value.push({ className: characterClass.className, faces: hitDie.faces, count: characterClass.level })
		breakdown.push({ source: characterClass.className, amount: characterClass.level })
	}

	return known(value, breakdown)
}
