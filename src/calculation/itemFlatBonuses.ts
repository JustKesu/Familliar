/*
 * Flat bonuses from worn magic items (build order step 7, slice h). A NEW file
 * in this folder per D47.
 *
 * Slice e applied an item's numeric bonus where it belongs to a WEAPON or a
 * suit of armour. The rest of items.json's bonus fields belong to the
 * character: a Cloak of Protection gives +1 to Armour Class and +1 to every
 * saving throw, a +1 Rod of the Pact Keeper raises the spell attack bonus and
 * the spell save DC, a Stone of Good Luck touches ability checks. This module
 * turns those into breakdown lines; each one is its OWN named line in the
 * value it lands on (D40/D41), never folded into another number.
 *
 * Pure (D38): the caller resolves the rows against items.json and hands in
 * grants (src/sheet/itemFlatBonusData.ts).
 *
 * THE GATE IS ATTUNEMENT, and there is deliberately no separate "worn" toggle.
 * This slice's survey (scripts/investigate-worn-bonuses.js) is what makes that
 * safe: of the 61 items carrying one of the six bonus fields, every single one
 * requires attunement except a suit of armour and a shield carrying `bonusAc`,
 * and those two reach Armour Class through the armour role instead. A carried
 * but unattuned item shows as a considered candidate with the reason (D76).
 */

import type { Contribution } from './types'

/** The values a worn item's flat bonus can land on — one per items.json bonus field this slice reads. */
export type FlatBonusTarget = 'armourClass' | 'savingThrow' | 'spellAttack' | 'spellSaveDc' | 'abilityCheck' | 'proficiencyBonus'

export const FLAT_BONUS_TARGETS: readonly FlatBonusTarget[] = [
	'armourClass',
	'savingThrow',
	'spellAttack',
	'spellSaveDc',
	'abilityCheck',
	'proficiencyBonus',
]

export interface ItemFlatBonusGrant {
	/** The item as the sheet displays it — magicItemLabel has already been applied. */
	sourceName: string
	target: FlatBonusTarget
	amount: number
	/** Set when the app can see the item is owned but not that it is in effect: not attuned (D76). */
	withheldReason?: string
	/** Set when the row's (name, source) is not in items.json at all, so what it grants is unknowable (D43). */
	unresolvedReason?: string
}

/**
 * The one bonus this slice leaves unapplied. `computeProficiencyBonus` takes a
 * class list and nothing else, and its result is read by saving throws, skills,
 * weapon attacks, spell attack and spell save DC — routing an item's change
 * through it means changing the signature of every one of those and each of
 * their callers. One item in the whole file carries the field (Ioun Stone of
 * Mastery), which is not worth that, so the bonus is shown where the player
 * looks for it and left out of the number. Daniel's call whether to close it.
 */
const PROFICIENCY_BONUS_UNHANDLED =
	'this app does not apply an item bonus to the proficiency bonus, because every attack, save and skill that reads it would have to be re-routed'

function signed(amount: number): string {
	return amount >= 0 ? `+${amount}` : `-${Math.abs(amount)}`
}

/** The breakdown lines one value gets from the worn items — applied bonuses as real amounts, withheld ones as zero-amount notes (D60's mechanism). */
export function flatBonusContributions(target: FlatBonusTarget, grants: readonly ItemFlatBonusGrant[]): Contribution[] {
	const contributions: Contribution[] = []
	for (const grant of grants) {
		if (grant.target !== target) continue

		if (grant.unresolvedReason !== undefined) {
			contributions.push({ source: grant.sourceName, amount: 0, note: grant.unresolvedReason })
			continue
		}
		if (grant.withheldReason !== undefined) {
			contributions.push({ source: grant.sourceName, amount: 0, note: `considered (${signed(grant.amount)}) — not applied: ${grant.withheldReason}` })
			continue
		}
		if (target === 'proficiencyBonus') {
			contributions.push({ source: grant.sourceName, amount: 0, note: `considered (${signed(grant.amount)}) — not applied: ${PROFICIENCY_BONUS_UNHANDLED}` })
			continue
		}
		contributions.push({ source: grant.sourceName, amount: grant.amount })
	}
	return contributions
}

export type FlatBonusContributions = Record<FlatBonusTarget, Contribution[]>

/** Every target's lines at once — the shape the sheet hands out to the six calculations. */
export function flatBonusesByTarget(grants: readonly ItemFlatBonusGrant[]): FlatBonusContributions {
	return Object.fromEntries(FLAT_BONUS_TARGETS.map((target) => [target, flatBonusContributions(target, grants)])) as FlatBonusContributions
}

/** No worn item contributes anything — the shape a caller with no inventory data yet can pass. */
export function noFlatBonuses(): FlatBonusContributions {
	return flatBonusesByTarget([])
}
