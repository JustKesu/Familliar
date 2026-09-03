/*
 * The inventory rows resolved into the grants
 * src/calculation/itemFlatBonuses.ts consumes (build order step 7, slice h).
 * The arithmetic and the breakdown wording stay there and stay pure (D38);
 * this file only reads item data.
 *
 * No fetch of its own: itemRefs is already loaded for the inventory section,
 * exactly as buildItemGrants (damageResponseData.ts) works.
 */

import { isAttuned } from '../calculation/attunement'
import { FLAT_BONUS_TARGETS, type FlatBonusTarget, type ItemFlatBonusGrant } from '../calculation/itemFlatBonuses'
import { magicItemLabel } from '../calculation/magicBonus'
import { buildInventoryResolver, wornAcBonusOf, type ItemRef } from '../inventory/inventoryData'
import type { CharacterInventoryItem } from '../storage/character'

/** Which items.json field feeds which value. `bonusAc` is read through wornAcBonusOf so an armour's or shield's own bonus is not counted twice (slice e already applies it). */
const FIELD_TARGETS: readonly { read: (ref: ItemRef) => number | null; target: FlatBonusTarget }[] = [
	{ read: wornAcBonusOf, target: 'armourClass' },
	{ read: (ref) => ref.bonusSavingThrow ?? null, target: 'savingThrow' },
	{ read: (ref) => ref.bonusSpellAttack ?? null, target: 'spellAttack' },
	{ read: (ref) => ref.bonusSpellSaveDc ?? null, target: 'spellSaveDc' },
	{ read: (ref) => ref.bonusAbilityCheck ?? null, target: 'abilityCheck' },
	{ read: (ref) => ref.bonusProficiencyBonus ?? null, target: 'proficiencyBonus' },
]

const NOT_ATTUNED = 'requires attunement and you are not attuned to it'

/**
 * Every worn item's flat bonuses. Quantity is ignored on purpose — a second
 * Cloak of Protection in the pack is not a second +1.
 *
 * D43: a row that does not resolve — absent from items.json, or a custom
 * definition too broken to read (slice e2a) — is announced only when it is ATTUNED. An
 * unattuned row would contribute nothing even if it did resolve, so naming it
 * on all six values would be noise rather than a warning; an attuned one is a
 * deliberate act by the player whose effect the app genuinely cannot see, and
 * since the missing entry could have carried any of the six fields it is named
 * on all of them.
 */
export function buildItemFlatBonusGrants(inventory: readonly CharacterInventoryItem[], itemRefs: readonly ItemRef[]): ItemFlatBonusGrant[] {
	const resolve = buildInventoryResolver(itemRefs)
	const grants: ItemFlatBonusGrant[] = []

	for (const item of inventory) {
		const { ref, problem } = resolve(item)
		if (!ref) {
			if (!isAttuned(item)) continue
			const name = magicItemLabel(item.name, item.magicBonus ?? 0)
			const reason =
				problem?.kind === 'malformed-custom'
					? 'attuned but its custom definition cannot be read'
					: `attuned but not found in the item data (${item.source})`
			for (const target of FLAT_BONUS_TARGETS) {
				grants.push({
					sourceName: name,
					target,
					amount: 0,
					unresolvedReason: `${reason} — any flat bonus it grants is not counted`,
				})
			}
			continue
		}

		const label = magicItemLabel(ref.name, item.magicBonus ?? 0)
		const withheld = ref.requiresAttunement === true && !isAttuned(item)
		for (const { read, target } of FIELD_TARGETS) {
			const amount = read(ref)
			if (amount === null || amount === 0) continue
			grants.push({ sourceName: label, target, amount, ...(withheld ? { withheldReason: NOT_ATTUNED } : {}) })
		}
	}
	return grants
}
