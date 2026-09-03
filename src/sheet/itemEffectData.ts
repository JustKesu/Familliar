/*
 * The two item effects that are neither a flat bonus nor a damage response
 * (build order step 7, slice e2b): a walking speed adjustment and a darkvision
 * grant. Both land in the module that already owns the value — computeSpeed's
 * `adjustments` parameter and computeDarkvision's granted-senses parameter —
 * so nothing here computes anything; it only resolves rows.
 *
 * No fetch of its own: itemRefs is already loaded for the inventory section,
 * exactly as itemFlatBonusData.ts and damageResponseData.ts work.
 *
 * THE GATE IS ATTUNEMENT, and nothing else, which is slice h's rule unchanged:
 * an item that requires attunement contributes only while attuned, and shows as
 * a considered candidate with the reason when it does not (D76). There is no
 * "worn" concept for a cloak or a pair of boots in this app.
 *
 * A row that does not resolve is deliberately NOT announced here. Slice h
 * already names an attuned unreadable row on all six of its values, and
 * repeating it on speed and darkvision would say the same thing about the same
 * row twice (docs/REPORT.md).
 */

import { isAttuned } from '../calculation/attunement'
import { magicItemLabel } from '../calculation/magicBonus'
import type { GrantedDarkvision } from '../calculation/speciesTraits'
import type { Contribution } from '../calculation/types'
import { buildInventoryResolver, type ItemRef } from '../inventory/inventoryData'
import type { CharacterInventoryItem } from '../storage/character'

const NOT_ATTUNED = 'requires attunement and you are not attuned to it'

function signed(amount: number): string {
	return amount >= 0 ? `+${amount}` : `-${Math.abs(amount)}`
}

/** One resolved row, with the name the rest of the sheet calls it by and whether attunement is holding its effect back. */
function* effectRows(
	inventory: readonly CharacterInventoryItem[],
	itemRefs: readonly ItemRef[],
): Generator<{ ref: ItemRef; label: string; withheld: boolean }> {
	const resolve = buildInventoryResolver(itemRefs)
	for (const item of inventory) {
		const { ref } = resolve(item)
		if (!ref) continue
		yield { ref, label: magicItemLabel(ref.name, item.magicBonus ?? 0), withheld: ref.requiresAttunement === true && !isAttuned(item) }
	}
}

/**
 * The speed contributions the carried items make, in the shape computeSpeed's
 * `adjustments` parameter already takes — the same parameter the heavy-armour
 * Strength penalty arrives through (slice b). Quantity is ignored: a second
 * pair of boots in the pack is not a second ten feet.
 */
export function buildItemSpeedAdjustments(inventory: readonly CharacterInventoryItem[], itemRefs: readonly ItemRef[]): Contribution[] {
	const contributions: Contribution[] = []
	for (const { ref, label, withheld } of effectRows(inventory, itemRefs)) {
		if (ref.speedBonus === undefined || ref.speedBonus === 0) continue
		contributions.push(
			withheld
				? { source: label, amount: 0, note: `considered (${signed(ref.speedBonus)} ft.) — not applied: ${NOT_ATTUNED}` }
				: { source: label, amount: ref.speedBonus },
		)
	}
	return contributions
}

/**
 * The darkvision the carried items grant, as the senses path's own grant shape.
 * Darkvision does not stack — computeDarkvision takes the largest and lists
 * every other candidate — so an item's range is offered, not added.
 */
export function buildItemDarkvisionGrants(inventory: readonly CharacterInventoryItem[], itemRefs: readonly ItemRef[]): GrantedDarkvision[] {
	const grants: GrantedDarkvision[] = []
	for (const { ref, label, withheld } of effectRows(inventory, itemRefs)) {
		if (ref.darkvision === undefined || ref.darkvision <= 0) continue
		grants.push({ range: ref.darkvision, origin: 'item', name: label, ...(withheld ? { withheldReason: NOT_ATTUNED } : {}) })
	}
	return grants
}
