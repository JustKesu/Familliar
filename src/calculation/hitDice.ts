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

/** The key Character.play.spentHitDice uses (slice 9b4) — the composite this app already identifies a class by everywhere else. */
export function hitDiceKey(className: string, classSource: string): string {
	return `${className}|${classSource}`
}

/**
 * The stored spent hit dice, with each count brought down to the maximum the
 * character has now (slice 9b4) — the same invariant spentSpellSlotsWithinMaxima
 * applies one pool over, for the same reason.
 *
 * Needs no data file: a class's hit dice maximum is its level (see this module's
 * header — `hd.number` is 1 per level), so `classes` alone decides it. A key for
 * a class the character no longer has has a maximum of 0 and is dropped.
 *
 * Counts of 0 and an emptied record become absence, the convention every play
 * field uses.
 */
export function spentHitDiceWithinMaxima(
	spent: Record<string, number> | undefined,
	classes: readonly CharacterClass[],
): Record<string, number> | undefined {
	if (spent === undefined) return undefined

	const maxima = new Map(classes.map((c) => [hitDiceKey(c.className, c.classSource), c.level]))
	const clamped: Record<string, number> = {}
	for (const [key, count] of Object.entries(spent)) {
		const value = Math.min(count, maxima.get(key) ?? 0)
		if (value > 0) clamped[key] = value
	}
	return Object.keys(clamped).length > 0 ? clamped : undefined
}
