import { ABILITIES } from '../abilities/abilityScores'
import { isAttuned } from '../calculation/attunement'
import type { ItemAbilityGrant } from '../calculation/itemAbilityScores'
import { magicItemLabel } from '../calculation/magicBonus'
import { buildInventoryResolver, type ItemRef } from '../inventory/inventoryData'
import type { CharacterInventoryItem } from '../storage/character'

/**
 * D221: only an item that requires attunement changes a score, and only while
 * attuned — that alone keeps out the Potions of Giant Strength, the Manual/Tome
 * books and the Deck of Many Things, none of which requires attunement.
 */
export function buildItemAbilityGrants(inventory: readonly CharacterInventoryItem[], itemRefs: readonly ItemRef[]): ItemAbilityGrant[] {
	const resolve = buildInventoryResolver(itemRefs)
	const grants: ItemAbilityGrant[] = []
	for (const item of inventory) {
		const { ref } = resolve(item)
		if (!ref || ref.requiresAttunement !== true) continue
		const sourceName = magicItemLabel(ref.name, item.magicBonus ?? 0)
		const attuned = isAttuned(item)
		for (const { ability, effect } of ref.abilityEffects ?? []) {
			grants.push({ sourceName, ability, effect, ...(attuned ? {} : { withheldReason: 'not attuned' }) })
		}
		if (ref.abilityChoice && attuned) {
			for (const ability of ABILITIES) grants.push({ sourceName, ability, withheldReason: 'ability choice not supported' })
		}
	}
	return grants
}
