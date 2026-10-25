import { describe, expect, it } from 'vitest'
import type { CharacterInventoryItem } from '../storage/character'
import { pactWeaponInvocations, togglePactWeapon } from './pactWeapon'

describe('togglePactWeapon (D401)', () => {
	const rows: CharacterInventoryItem[] = [
		{ name: 'Longsword', source: 'XPHB', quantity: 1, pactWeapon: true },
		{ name: 'Dagger', source: 'XPHB', quantity: 1 },
	]

	it('marking another row clears the first, so at most one row holds the flag', () => {
		const next = togglePactWeapon(rows, 1)
		expect(next.map((row) => row.pactWeapon)).toEqual([undefined, true])
		expect('pactWeapon' in next[0]).toBe(false)
	})

	it('toggling the marked row unmarks it', () => {
		expect(togglePactWeapon(rows, 0).some((row) => row.pactWeapon)).toBe(false)
	})
})

describe('pactWeaponInvocations', () => {
	it('matches Improved Pact Weapon by its XGE source and the others by XPHB', () => {
		const held = pactWeaponInvocations({
			optionalFeatureChoices: [{ featureType: 'EI', choices: [{ name: 'Pact of the Blade' }, { name: 'Improved Pact Weapon', source: 'XGE' }, { name: 'Lifedrinker', source: 'XPHB' }] }],
		})
		expect(held).toEqual({ pactOfTheBlade: true, improvedPactWeapon: true, lifedrinker: true })
		expect(pactWeaponInvocations({ optionalFeatureChoices: [{ featureType: 'EI', choices: [{ name: 'Improved Pact Weapon' }] }] }).improvedPactWeapon).toBe(false)
	})
})
