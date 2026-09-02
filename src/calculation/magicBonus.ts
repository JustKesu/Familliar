/*
 * Magic bonuses on items (build order step 7, slice e). A NEW file in this
 * folder per D47.
 *
 * Pure (D38): the caller resolves the row against items.json and hands in the
 * four facts this needs.
 *
 * Two bonuses can be in play at once and they NEVER add up: the bonus the
 * player set on the row REPLACES the item's own, or a +1 Longsword set to +1
 * would read +2. The loser is a zero-amount note saying what it would have
 * given (D60's mechanism, the same one armourClass.ts uses to reconcile its
 * formulas).
 *
 * Attunement gates the result: an item that requires attunement and is not
 * attuned contributes nothing, and says so as a considered candidate (D76 —
 * the app can see the item is owned, not that it is in effect). Slice d's
 * plain `isAttuned` is what the caller reads; nothing here re-derives the rule.
 *
 * Which items.json key the caller reads is settled by this slice's survey
 * (scripts/investigate-magic-bonuses.js): `bonusWeapon` is ONE key covering
 * both the attack and the damage roll — the data carries no weapon whose two
 * differ — and `bonusAc` is the armour/shield one. Both are "+N" STRINGS.
 */

import type { Contribution } from './types'

/** Where the bonus that actually counts came from. */
export type MagicBonusOrigin = 'player' | 'item'

export interface MagicBonusContext {
	/** The item's name as items.json spells it — the label and the breakdown lines are built from it. */
	name: string
	/** The item's own numeric bonus in the role it is being applied (weapon attack/damage, or AC), or null. */
	itemBonus: number | null
	/** The bonus the player set on this inventory row, or null. */
	playerBonus: number | null
	requiresAttunement: boolean
	attuned: boolean
}

export interface MagicBonus {
	/** What the row CARRIES, whether or not it is in effect — this is what the name shows. 0 when there is none. */
	carried: number
	/** Which of the two produced `carried`; null when there is no bonus at all. */
	origin: MagicBonusOrigin | null
	/** What actually reaches the number. 0 when there is no bonus, or when attunement withholds it. */
	applied: number
	/** Named lines for the D40/D41 breakdown — never folded into another row. Empty when the row carries no bonus. */
	contributions: Contribution[]
	/** The item's name with the bonus it carries: "Longsword +1". */
	label: string
}

function signed(amount: number): string {
	return amount >= 0 ? `+${amount}` : `-${Math.abs(amount)}`
}

const PLAYER_SOURCE = 'magic bonus (set on this item)'

function itemSource(name: string): string {
	return `magic bonus (${name}'s own)`
}

/**
 * The one place an item's displayed name is built, so the same sword is never
 * called two different things on one screen.
 *
 * Three items in the data already spell their bonus in their own name ("+1
 * Moon Sickle", and none of the three disagrees with its field — this slice's
 * survey), so appending would print it twice.
 */
export function magicItemLabel(name: string, bonus: number): string {
	if (bonus === 0) return name
	return name.startsWith(`${signed(bonus)} `) ? name : `${name} ${signed(bonus)}`
}

/** No bonus at all — the shape every row that carries none gets, so callers need no null checks. */
export function noMagicBonus(name: string): MagicBonus {
	return { carried: 0, origin: null, applied: 0, contributions: [], label: name }
}

export function resolveMagicBonus(context: MagicBonusContext): MagicBonus {
	const { name, itemBonus, playerBonus, requiresAttunement, attuned } = context
	const carried = playerBonus ?? itemBonus ?? 0
	if (carried === 0) return noMagicBonus(name)

	const origin: MagicBonusOrigin = playerBonus !== null ? 'player' : 'item'
	const source = origin === 'player' ? PLAYER_SOURCE : itemSource(name)
	const withheld = requiresAttunement && !attuned

	const contributions: Contribution[] = [
		withheld
			? {
					source,
					amount: 0,
					note: `considered (${signed(carried)}) — not applied: ${name} requires attunement and you are not attuned to it`,
				}
			: { source, amount: carried },
	]
	// The two never sum (D60): a player-set bonus replaces the item's own, and the replaced one is still named.
	if (origin === 'player' && itemBonus !== null) {
		contributions.push({
			source: itemSource(name),
			amount: 0,
			note: `considered (${signed(itemBonus)}) — not applied: replaced by the ${signed(carried)} set on this item`,
		})
	}

	return { carried, origin, applied: withheld ? 0 : carried, contributions, label: magicItemLabel(name, carried) }
}
