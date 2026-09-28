import { makeRoomForHands, type HeldThing } from '../calculation/hands'
import type { CharacterInventoryItem } from '../storage/character'
import { buildInventoryResolver, equipSlotOf, handsRequiredOf, returnToStack, splitOneOff, type ItemRef } from './inventoryData'

type Resolve = ReturnType<typeof buildInventoryResolver>

/** The result of an equip-type edit: the new rows, and what (if anything) was put down on the way (`notice`). */
export interface EquipResult {
	inventory: CharacterInventoryItem[]
	notice: string | null
}

/**
 * A row put down. Only the equipped flag goes: everything else the row carries
 * — attunement, the Finesse ability pick, the magic bonus, a custom item's own
 * definition — is a fact about the item, not about whether it is in hand, and a
 * sheathed sword that stopped being a +1 (or stopped being a custom item at
 * all) would be data loss.
 */
export function putDown(row: CharacterInventoryItem): CharacterInventoryItem {
	const rest = { ...row }
	delete rest.equipped
	return rest
}

/**
 * Taking a row into the hands, in the shape `next` describes. Everything
 * already held that no longer fits alongside it is put down, oldest first,
 * and named (src/calculation/hands.ts).
 *
 * A held row the item data does not know still counts as one hand: the
 * alternative is a character quietly holding three things because one of them
 * could not be resolved (D43).
 */
export function takeInHand(rows: CharacterInventoryItem[], index: number, ref: ItemRef, next: CharacterInventoryItem, resolve: Resolve): EquipResult {
	const held: HeldThing[] = []
	rows.forEach((row, i) => {
		if (i === index || row.equipped !== 'held') return
		const otherRef = resolve(row).ref
		held.push({ index: i, name: row.name, hands: (otherRef ? handsRequiredOf(otherRef, row.grip) : null) ?? 1 })
	})

	const { displaced, message } = makeRoomForHands(held, { index, name: next.name, hands: handsRequiredOf(ref, next.grip) ?? 1 })
	const putting = new Set(displaced.map((thing) => thing.index))
	return { inventory: returnToStack(rows.map((row, i) => (i === index ? next : putting.has(i) ? putDown(row) : row)), putting), notice: message }
}

/**
 * Equipping is the one inventory edit that can change another row: a body
 * wears one suit of armour and has two hands, so taking something up puts
 * down whatever it has to. That is reported in `notice` rather than done
 * quietly. Null when the row cannot be equipped at all.
 */
export function toggleEquip(inventory: CharacterInventoryItem[], index: number, resolve: Resolve): EquipResult | null {
	const item = inventory[index]
	const ref = resolve(item).ref
	const slot = ref ? equipSlotOf(ref) : null
	if (!slot || !ref) return null

	if (item.equipped) {
		return { inventory: returnToStack(inventory.map((row, i) => (i === index ? putDown(row) : row)), [index]), notice: null }
	}

	if (slot === 'worn') {
		// 'worn' is armour and nothing else, so the previous suit is simply the other worn row (storage allows at most one).
		const displacedIndex = inventory.findIndex((row, i) => i !== index && row.equipped === 'worn')
		return {
			inventory: inventory.map((row, i) => (i === index ? { ...row, equipped: 'worn' } : i === displacedIndex ? putDown(row) : row)),
			notice: displacedIndex === -1 ? null : `Unequipped ${inventory[displacedIndex].name} — only one suit of armour can be worn at a time.`,
		}
	}

	// D188: a hand holds one item, so a stack gives up one and the rest stays equippable.
	const split = splitOneOff(inventory, index)
	return takeInHand(split.inventory, split.index, ref, { ...split.inventory[split.index], equipped: 'held' }, resolve)
}
