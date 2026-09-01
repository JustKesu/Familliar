/*
 * Attunement (build order step 7, slice d). A NEW file in this folder per D47.
 *
 * Pure (D38): the inventory rows are handed in; whether an item REQUIRES
 * attunement is an items.json question the caller answers
 * (src/inventory/inventoryData.ts, `requiresAttunement`).
 *
 * Two halves, treated differently on purpose:
 *
 *  - The REQUIREMENT is displayed, never enforced (D21). 98 of the 272 items
 *    that require attunement state a condition as a sentence — "by a
 *    spellcaster", "by a creature of good alignment" (counted over
 *    data/items.json for this slice, docs/REPORT.md) — and several are
 *    unknowable to the app. Nothing here reads that text; the player does.
 *  - The LIMIT is enforced. It is a flat number, not an estimate, so a fourth
 *    attunement is refused with a message rather than allowed with a warning.
 *
 * Slices e (magic bonuses) and f (item resistances) gate on `isAttuned`
 * instead of reimplementing the rule.
 */

import type { Character, CharacterInventoryItem } from '../storage/character'
import { type Calculated, type Contribution, known } from './types'

/** PHB 2024, "Attunement": "you can be attuned to no more than three magic items at a time." */
export const BASE_ATTUNEMENT_LIMIT = 3

/**
 * D70 hand table: the Artificer's raised limit. No feature carries a numeric
 * field for it — the count is in the feature's own sentence and nowhere else
 * (the slice's survey of data/class-features.json found the entries hold
 * nothing but name/source/page/className/classSource/level/id):
 *
 *   Magic Item Adept (10):  "You can now attune to up to four magic items at once."
 *   Advanced Artifice (14): "Magic Item Savant. You can now attune to up to five magic items at once."
 *   Magic Item Master (18): "You can now attune to up to six magic items at once."
 *
 * The features REPLACE each other rather than stacking, so the highest reached
 * wins and the others become zero-amount notes (D60), the same shape
 * computeAttacksPerAction uses for Extra Attack.
 */
const ARTIFICER_ATTUNEMENT_LIMITS: readonly { level: number; limit: number; feature: string }[] = [
	{ level: 10, limit: 4, feature: 'Magic Item Adept' },
	{ level: 14, limit: 5, feature: 'Magic Item Savant' },
	{ level: 18, limit: 6, feature: 'Magic Item Master' },
]

const ARTIFICER_CLASS_NAME = 'artificer'

/** Whether the character is attuned to this inventory row right now — the one place slices e and f ask. */
export function isAttuned(item: CharacterInventoryItem): boolean {
	return item.attuned === true
}

/** The rows the character is attuned to, in inventory order. */
export function attunedItems(inventory: readonly CharacterInventoryItem[]): CharacterInventoryItem[] {
	return inventory.filter(isAttuned)
}

/**
 * How many attunement slots are in use. A row counts ONCE however large its
 * quantity: the flag lives on the row, so three identical rings on one row are
 * one attunement — attuning a second copy means a second row.
 */
export function countAttuned(inventory: readonly CharacterInventoryItem[]): number {
	return attunedItems(inventory).length
}

/** Artificer levels only — a Fighter 6 / Artificer 10 is an Artificer 10 for this rule. */
function artificerLevel(character: Character): number {
	return character.classes
		.filter((entry) => entry.className.toLowerCase() === ARTIFICER_CLASS_NAME)
		.reduce((total, entry) => total + entry.level, 0)
}

/**
 * How many items this character may be attuned to at once, with the breakdown
 * saying where the number came from (D40/D41). Never 'unknown': the base is a
 * rule and the only modifier is read off the character's own levels, so there
 * is no data file that can be missing.
 */
export function computeAttunementLimit(character: Character): Calculated<number> {
	const level = artificerLevel(character)
	const reached = ARTIFICER_ATTUNEMENT_LIMITS.filter((entry) => level >= entry.level)
	const winner = reached.length > 0 ? reached[reached.length - 1] : null
	const limit = winner ? winner.limit : BASE_ATTUNEMENT_LIMIT

	const breakdown: Contribution[] = [{ source: 'the attunement rule (three magic items)', amount: BASE_ATTUNEMENT_LIMIT }]
	if (winner) breakdown.push({ source: `${winner.feature} (Artificer ${winner.level})`, amount: winner.limit - BASE_ATTUNEMENT_LIMIT })
	for (const entry of reached) {
		if (entry === winner) continue
		breakdown.push({
			source: `${entry.feature} (Artificer ${entry.level})`,
			amount: 0,
			note: `considered (${entry.limit} items) — not applied: ${winner?.feature} gives ${limit}`,
		})
	}
	return known(limit, breakdown)
}

/**
 * Why one more item may NOT be attuned, or null when there is room. The limit
 * is a flat rule, so the caller refuses the attunement outright and shows this
 * — it is never a warning next to an applied change.
 */
export function describeAttunementRefusal(inventory: readonly CharacterInventoryItem[], limit: number): string | null {
	const attuned = countAttuned(inventory)
	if (attuned < limit) return null
	return `you can be attuned to at most ${limit} magic item${limit === 1 ? '' : 's'} at once, and ${attuned} already ${attuned === 1 ? 'is' : 'are'}`
}
