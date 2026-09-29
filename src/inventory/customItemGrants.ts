import { isAttuned } from '../calculation/attunement'
import { magicItemLabel } from '../calculation/magicBonus'
import type { CharacterInventoryItem, CustomItemFeat } from '../storage/character'
import { describeCustomItemProblem } from './inventoryData'

/** One feat a custom item grants right now (R14c1, D218); `row` and `n` locate its stored entry. */
export interface ItemFeatGrant {
	row: number
	n: number
	itemName: string
	feat: CustomItemFeat
}

export interface ItemInvocationGrant {
	name: string
	source: string
	itemName: string
}

/** The custom rows that grant right now: D216's attunement gate, and D43 — a malformed definition grants nothing. */
function grantingCustomRows(inventory: readonly CharacterInventoryItem[] | undefined) {
	return (inventory ?? []).flatMap((item, row) => {
		const custom = item.custom
		if (!custom || describeCustomItemProblem(custom) !== null) return []
		if (custom.requiresAttunement === true && !isAttuned(item)) return []
		return [{ row, custom, itemName: magicItemLabel(custom.name, item.magicBonus ?? 0) }]
	})
}

export function itemFeatGrants(inventory: readonly CharacterInventoryItem[] | undefined): ItemFeatGrant[] {
	return grantingCustomRows(inventory).flatMap(({ row, custom, itemName }) => (custom.feats ?? []).map((feat, n) => ({ row, n, itemName, feat })))
}

export function itemInvocationGrants(inventory: readonly CharacterInventoryItem[] | undefined): ItemInvocationGrant[] {
	return grantingCustomRows(inventory).flatMap(({ custom, itemName }) => (custom.invocations ?? []).map(({ name, source }) => ({ name, source, itemName })))
}
