/*
 * The inventory rows resolved into the list-shaped grants a custom item can
 * carry (R14b, D217): proficiencies, and immunity / save advantage against
 * conditions. The arithmetic stays in src/calculation/itemProficiencies.ts.
 *
 * Gated as buildItemGrants (damageResponseData.ts) is: an item that requires
 * attunement contributes only while attuned, and an unattuned one still yields
 * its grants, marked withheld, so a caller can show the D76 line or skip them.
 * A row that does not resolve yields nothing; buildItemGrants already names it.
 */

import { isAttuned } from '../calculation/attunement'
import type { ItemProficiencyGrant } from '../calculation/itemProficiencies'
import { magicItemLabel } from '../calculation/magicBonus'
import { buildInventoryResolver, CUSTOM_CONDITION_NAMES, type ItemRef } from '../inventory/inventoryData'
import type { CharacterInventoryItem } from '../storage/character'

const NOT_ATTUNED = 'requires attunement and you are not attuned to it'

function resolvedWithLabel(inventory: readonly CharacterInventoryItem[], itemRefs: readonly ItemRef[]): { ref: ItemRef; label: string; withheldReason?: string }[] {
	const resolve = buildInventoryResolver(itemRefs)
	return inventory.flatMap((item) => {
		const { ref } = resolve(item)
		if (!ref) return []
		const withheld = ref.requiresAttunement === true && !isAttuned(item)
		return [{ ref, label: magicItemLabel(ref.name, item.magicBonus ?? 0), ...(withheld ? { withheldReason: NOT_ATTUNED } : {}) }]
	})
}

export function buildItemProficiencyGrants(inventory: readonly CharacterInventoryItem[], itemRefs: readonly ItemRef[]): ItemProficiencyGrant[] {
	return resolvedWithLabel(inventory, itemRefs).flatMap(({ ref, label, withheldReason }) =>
		(ref.customProficiencies ?? []).map((proficiency) => ({ sourceName: label, proficiency, ...(withheldReason !== undefined ? { withheldReason } : {}) })),
	)
}

/** One condition an item gives immunity or save advantage for. */
export interface ItemConditionGrant {
	sourceName: string
	kind: 'immune' | 'advantage'
	condition: string
	withheldReason?: string
}

export function buildItemConditionGrants(inventory: readonly CharacterInventoryItem[], itemRefs: readonly ItemRef[]): ItemConditionGrant[] {
	return resolvedWithLabel(inventory, itemRefs).flatMap(({ ref, label, withheldReason }) => {
		const extra = withheldReason !== undefined ? { withheldReason } : {}
		return [
			...(ref.conditionImmune ?? []).map((condition) => ({ sourceName: label, kind: 'immune' as const, condition, ...extra })),
			...(ref.conditionAdvantage ?? []).map((condition) => ({ sourceName: label, kind: 'advantage' as const, condition, ...extra })),
		]
	})
}

/** "Advantage on saving throws against Charmed, Frightened (Ring of X)" — one line per item, applied grants only. Text only, no roll changes. */
export function conditionAdvantageLines(grants: readonly ItemConditionGrant[]): string[] {
	const bySource = new Map<string, Set<string>>()
	for (const grant of grants) {
		if (grant.kind !== 'advantage' || grant.withheldReason !== undefined) continue
		bySource.set(grant.sourceName, (bySource.get(grant.sourceName) ?? new Set()).add(grant.condition))
	}
	return [...bySource].map(([source, conditions]) => `Advantage on saving throws against ${CUSTOM_CONDITION_NAMES.filter((name) => conditions.has(name)).join(', ')} (${source})`)
}

/** The applied grants of one kind collapsed to one entry per condition, alphabetical, naming every item that grants it. */
export function conditionsGranted(grants: readonly ItemConditionGrant[], kind: ItemConditionGrant['kind']): { condition: string; sources: string[] }[] {
	const byCondition = new Map<string, string[]>()
	for (const grant of grants) {
		if (grant.kind !== kind || grant.withheldReason !== undefined) continue
		const sources = byCondition.get(grant.condition) ?? []
		if (!sources.includes(grant.sourceName)) sources.push(grant.sourceName)
		byCondition.set(grant.condition, sources)
	}
	return CUSTOM_CONDITION_NAMES.flatMap((condition) => (byCondition.has(condition) ? [{ condition, sources: byCondition.get(condition) ?? [] }] : []))
}
