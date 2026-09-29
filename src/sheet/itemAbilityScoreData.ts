import { ABILITIES } from '../abilities/abilityScores'
import { isAttuned } from '../calculation/attunement'
import type { ItemAbilityEffect, ItemAbilityGrant } from '../calculation/itemAbilityScores'
import { magicItemLabel } from '../calculation/magicBonus'
import { buildInventoryResolver, describeCustomItemProblem, type ItemRef } from '../inventory/inventoryData'
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
		if (item.custom) {
			/* D222: D216's gate, not the real-item rule — no attunement requirement means it applies always. A malformed definition grants nothing (D43). */
			if (describeCustomItemProblem(item.custom) !== null) continue
			const sourceName = magicItemLabel(item.custom.name, item.magicBonus ?? 0)
			const withheld = item.custom.requiresAttunement === true && !isAttuned(item) ? { withheldReason: 'not attuned' } : {}
			for (const score of item.custom.abilityScores ?? []) {
				const effect: ItemAbilityEffect = score.kind === 'set' ? { kind: 'set', score: score.value } : { kind: 'add', amount: score.amount, max: score.max }
				grants.push({ sourceName, ability: score.ability, effect, ...withheld })
			}
			continue
		}
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
