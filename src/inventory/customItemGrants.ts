import { isAttuned } from '../calculation/attunement'
import { magicItemLabel } from '../calculation/magicBonus'
import type { CharacterInventoryItem, CustomItemFeat, CustomItemSpell } from '../storage/character'
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

/** One spell a custom item grants right now (R14c2, D219); `row` is the inventory index at the time of reading, never stored. */
export interface ItemSpellGrant {
	row: number
	itemName: string
	spell: CustomItemSpell
	/** Spent uses from the row's spellUses. */
	spent: number
}

/** The key of a spell in its row's spellUses; name|source is unique within one item. */
export const itemSpellKey = (spell: { name: string; source: string }): string => `${spell.name}|${spell.source}`

export function itemSpellGrants(inventory: readonly CharacterInventoryItem[] | undefined): ItemSpellGrant[] {
	return grantingCustomRows(inventory).flatMap(({ row, custom, itemName }) =>
		(custom.spells ?? []).map((spell) => ({ row, itemName, spell, spent: inventory![row]!.spellUses?.[itemSpellKey(spell)] ?? 0 })),
	)
}

/** The row with every spent count rewritten by `next` (given the item's spell of that key, if it still has one); 0 drops the key, an emptied record is dropped. */
export function mapItemSpellUses(item: CharacterInventoryItem, next: (spent: number, spell: CustomItemSpell | undefined) => number): CharacterInventoryItem {
	if (!item.spellUses) return item
	const { spellUses, ...rest } = item
	const kept = Object.fromEntries(
		Object.entries(spellUses)
			.map(([key, spent]) => [key, next(spent, item.custom?.spells?.find((spell) => itemSpellKey(spell) === key))] as const)
			.filter(([, spent]) => spent > 0),
	)
	return Object.keys(kept).length > 0 ? { ...rest, spellUses: kept } : rest
}

export function withItemSpellSpent(inventory: readonly CharacterInventoryItem[], row: number, spell: CustomItemSpell, spent: number): CharacterInventoryItem[] {
	return inventory.map((item, i) => (i === row ? mapItemSpellUses({ ...item, spellUses: { ...item.spellUses, [itemSpellKey(spell)]: spent } }, (count) => count) : item))
}
