/*
 * Pairing a weapon's `ammoType` with the ammunition in the inventory (step 9,
 * slice 9d3). Pure: the sheet reads `ammoEntriesFor`, shows one control per
 * entry, and hands the result of `spendAmmo` to the same onEditInventory the
 * Inventář tab uses — no ammo counter is stored anywhere.
 *
 * The link is structural, no name matching (DATA.md, "Ammunition"): `ammoType`
 * is the "name|source" key of one item, and an ammunition PACK lists that same
 * key in `packContents`.
 */

import { magicItemLabel } from '../calculation/magicBonus'
import type { CharacterInventoryItem } from '../storage/character'
import { buildInventoryResolver, inventoryRowKey, withQuantity, type ItemRef } from './inventoryData'

/** items.json type codes of ammunition: "A" arrows, bolts, bullets, needles; "AF" energy cells. */
const AMMUNITION_TYPE_CODES: readonly string[] = ['A', 'AF']

/**
 * One inventory row that can feed a weapon, shown on its own line — a plain
 * arrow row and a pack are never summed.
 *
 * `loose`  the ammunition item itself; spending lowers its quantity.
 * `pack`   a pack ("Arrows (20)"); spending opens it and the rest of its
 *          pieces become loose ammunition.
 * `none`   nothing in the inventory feeds the weapon — shown as 0, disabled.
 */
export interface AmmoEntry {
	kind: 'loose' | 'pack' | 'none'
	/** Row position in the inventory; null for `none`. */
	index: number | null
	name: string
	/** Rows of this item for `loose`, packs for `pack`. */
	quantity: number
	/** `pack` only: pieces one pack holds. */
	pieces?: number
	/** `pack` only: the loose item those pieces become; null when the item data has no such item, so the pack cannot be opened. */
	looseItem?: { name: string; source: string } | null
}

const keyOf = (ref: { name: string; source: string }): string => `${ref.name}|${ref.source}`.toLowerCase()

export function ammoEntriesFor(ammoType: string, inventory: readonly CharacterInventoryItem[], itemRefs: readonly ItemRef[]): AmmoEntry[] {
	const wanted = ammoType.toLowerCase()
	const resolve = buildInventoryResolver(itemRefs)
	const looseItem = itemRefs.find((ref) => keyOf(ref) === wanted)
	const entries: AmmoEntry[] = []

	inventory.forEach((row, index) => {
		const { ref } = resolve(row)
		if (!ref) return
		if (keyOf(ref) === wanted) {
			// The label carries a player-set bonus ("Arrow +1"), the same name the Inventář prints, so plain and +1 rows read apart.
			entries.push({ kind: 'loose', index, name: magicItemLabel(ref.name, row.magicBonus ?? 0), quantity: row.quantity })
			return
		}
		const held = ref.typeCode !== undefined && AMMUNITION_TYPE_CODES.includes(ref.typeCode) ? ref.packContents?.find((part) => part.item.toLowerCase() === wanted) : undefined
		if (held) {
			entries.push({
				kind: 'pack',
				index,
				name: ref.name,
				quantity: row.quantity,
				pieces: held.quantity,
				looseItem: looseItem ? { name: looseItem.name, source: looseItem.source } : null,
			})
		}
	})

	// D43: no match is still a line — the weapon needs ammunition the character does not have.
	if (entries.length === 0) entries.push({ kind: 'none', index: null, name: looseItem?.name ?? ammoType, quantity: 0 })
	return entries
}

export function canSpendAmmo(entry: AmmoEntry): boolean {
	if (entry.kind === 'none' || entry.quantity <= 0) return false
	return entry.kind === 'loose' || entry.looseItem !== null
}

/**
 * The inventory after one piece of `entry` is used. A loose row goes down by one
 * and stops at 0 — the row stays, so restocking is the Inventář field. A pack
 * loses one pack (its row goes when the last one is opened) and its remaining
 * pieces join the plain row of the loose item, or a new one where the pack was.
 */
export function spendAmmo(inventory: readonly CharacterInventoryItem[], entry: AmmoEntry): CharacterInventoryItem[] {
	if (!canSpendAmmo(entry) || entry.index === null) return [...inventory]
	if (entry.kind === 'loose') return withQuantity(inventory, entry.index, Math.max(0, entry.quantity - 1))

	const { name, source } = entry.looseItem!
	const leftover = (entry.pieces ?? 0) - 1
	const remainingPacks = entry.quantity - 1
	const plainKey = inventoryRowKey({ name, source, quantity: 1 })
	const target = leftover > 0 ? inventory.findIndex((row) => inventoryRowKey(row) === plainKey) : -1

	const next: CharacterInventoryItem[] = []
	inventory.forEach((row, index) => {
		if (index === entry.index) {
			if (remainingPacks > 0) next.push({ ...row, quantity: remainingPacks })
			if (leftover > 0 && target === -1) next.push({ name, source, quantity: leftover })
		} else if (index === target) {
			next.push({ ...row, quantity: row.quantity + leftover })
		} else {
			next.push(row)
		}
	})
	return next
}
