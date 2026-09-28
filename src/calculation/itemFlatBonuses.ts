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

import { ABILITIES, type Ability } from '../abilities/abilityScores'
import type { CustomBonusPassive } from '../storage/character'
import { SKILLS, type Skill } from './skills'
import type { Contribution } from './types'

/**
 * The values a flat bonus lands on as a whole: slice h's six items.json fields,
 * plus the four a custom item can also target (R14a1). `savingThrow` and
 * `abilityCheck` are ALL saves / ALL checks.
 */
export type BroadFlatBonusTarget =
	| 'armourClass'
	| 'savingThrow'
	| 'spellAttack'
	| 'spellSaveDc'
	| 'abilityCheck'
	| 'proficiencyBonus'
	| 'initiative'
	| 'maxHitPoints'
	| 'weaponAttack'
	| 'weaponDamage'

export const BROAD_FLAT_BONUS_TARGETS: readonly BroadFlatBonusTarget[] = [
	'armourClass',
	'savingThrow',
	'spellAttack',
	'spellSaveDc',
	'abilityCheck',
	'proficiencyBonus',
	'initiative',
	'maxHitPoints',
	'weaponAttack',
	'weaponDamage',
]

/** R14a1: a custom item can also aim at one save, one skill or one passive value. */
export type FlatBonusTarget = BroadFlatBonusTarget | `savingThrow:${Ability}` | `skill:${Skill}` | `passive:${CustomBonusPassive}`

const PASSIVES: readonly CustomBonusPassive[] = ['perception', 'investigation', 'insight']

export interface ItemFlatBonusGrant {
	/** The item as the sheet displays it — magicItemLabel has already been applied. */
	sourceName: string
	target: FlatBonusTarget
	amount: number
	/** maxHitPoints only: `amount` is per character level (R14a1). */
	perLevel?: true
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

/**
 * The breakdown lines one value gets from the worn items — applied bonuses as real amounts, withheld ones as zero-amount notes (D60's mechanism).
 * `characterLevel` multiplies a per-level grant, the way maxHitPoints.ts names Tough's.
 */
export function flatBonusContributions(target: FlatBonusTarget, grants: readonly ItemFlatBonusGrant[], characterLevel = 0): Contribution[] {
	const contributions: Contribution[] = []
	for (const grant of grants) {
		if (grant.target !== target) continue

		if (grant.unresolvedReason !== undefined) {
			contributions.push({ source: grant.sourceName, amount: 0, note: grant.unresolvedReason })
			continue
		}
		const amount = grant.perLevel ? grant.amount * characterLevel : grant.amount
		const source = grant.perLevel ? `${grant.sourceName} (${signed(grant.amount)} per level × ${characterLevel})` : grant.sourceName
		if (grant.withheldReason !== undefined) {
			contributions.push({ source, amount: 0, note: `considered (${signed(amount)}) — not applied: ${grant.withheldReason}` })
			continue
		}
		if (target === 'proficiencyBonus') {
			contributions.push({ source, amount: 0, note: `considered (${signed(amount)}) — not applied: ${PROFICIENCY_BONUS_UNHANDLED}` })
			continue
		}
		contributions.push({ source, amount })
	}
	return contributions
}

export type FlatBonusContributions = Record<BroadFlatBonusTarget, Contribution[]> & {
	/** One save's own lines, on top of `savingThrow`'s. */
	savingThrowFor: Record<Ability, Contribution[]>
	/** One skill's own lines, on top of `abilityCheck`'s. */
	skillFor: Record<Skill, Contribution[]>
	/** One passive value's own lines, never the skill roll's. */
	passiveFor: Record<CustomBonusPassive, Contribution[]>
}

function linesFor<K extends string>(keys: readonly K[], target: (key: K) => FlatBonusTarget, grants: readonly ItemFlatBonusGrant[]): Record<K, Contribution[]> {
	return Object.fromEntries(keys.map((key) => [key, flatBonusContributions(target(key), grants)])) as Record<K, Contribution[]>
}

/** Every target's lines at once — the shape the sheet hands out to the calculations. */
export function flatBonusesByTarget(grants: readonly ItemFlatBonusGrant[], characterLevel = 0): FlatBonusContributions {
	return {
		...(Object.fromEntries(BROAD_FLAT_BONUS_TARGETS.map((target) => [target, flatBonusContributions(target, grants, characterLevel)])) as Record<BroadFlatBonusTarget, Contribution[]>),
		savingThrowFor: linesFor(ABILITIES, (ability) => `savingThrow:${ability}`, grants),
		skillFor: linesFor(SKILLS, (skill) => `skill:${skill}`, grants),
		passiveFor: linesFor(PASSIVES, (passive) => `passive:${passive}`, grants),
	}
}

/** No worn item contributes anything — the shape a caller with no inventory data yet can pass. */
export function noFlatBonuses(): FlatBonusContributions {
	return flatBonusesByTarget([])
}
