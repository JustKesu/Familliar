import { heldInvocations } from '../featAsi/featInstances'
import type { Character, CharacterInventoryItem } from '../storage/character'

/* PW-1 (D401): the pact weapon is the inventory row the player marked; the invocations below act on that row only. */

const PACT_OF_THE_BLADE = { name: 'Pact of the Blade', source: 'XPHB' }
const IMPROVED_PACT_WEAPON = { name: 'Improved Pact Weapon', source: 'XGE' }
const LIFEDRINKER = { name: 'Lifedrinker', source: 'XPHB' }

export interface PactWeaponInvocations {
	pactOfTheBlade: boolean
	improvedPactWeapon: boolean
	lifedrinker: boolean
}

export function pactWeaponInvocations(character: Pick<Character, 'optionalFeatureChoices' | 'inventory'>): PactWeaponInvocations {
	const held = heldInvocations(character)
	const holds = (ref: { name: string; source: string }): boolean => held.some((invocation) => invocation.name === ref.name && (invocation.source ?? 'XPHB') === ref.source)
	return { pactOfTheBlade: holds(PACT_OF_THE_BLADE), improvedPactWeapon: holds(IMPROVED_PACT_WEAPON), lifedrinker: holds(LIFEDRINKER) }
}

/** D408: the inventory with no row marked — written when the character no longer holds Pact of the Blade. */
export function withoutPactWeapon(inventory: readonly CharacterInventoryItem[]): CharacterInventoryItem[] {
	return inventory.map((row) => {
		if (!row.pactWeapon) return row
		const { pactWeapon: _dropped, ...rest } = row
		return rest
	})
}

/** Marks row `index` (or unmarks it when it is the marked one); marking clears every other row, so at most one row holds the flag. */
export function togglePactWeapon(inventory: readonly CharacterInventoryItem[], index: number): CharacterInventoryItem[] {
	const marking = inventory[index]?.pactWeapon !== true
	return inventory.map((row, i) => {
		if (i === index && marking) return { ...row, pactWeapon: true }
		if (!row.pactWeapon) return row
		const { pactWeapon: _dropped, ...rest } = row
		return rest
	})
}
