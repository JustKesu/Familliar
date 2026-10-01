import { describe, expect, it } from 'vitest'
import type { Character } from '../storage/character'
import { featInstances, featOriginLabel } from './featInstances'

describe('featInstances — manual feats (D215)', () => {
	it('lists manual entries after the level feats, keyed by their order among manual entries only', () => {
		const character: Character = {
			id: '1',
			name: 'A',
			classes: [],
			featAsiChoices: [{ level: 4, kind: 'feat', name: 'Alert', source: 'XPHB' }],
			grantedFeats: [
				{ origin: 'manual', name: 'Elemental Adept', source: 'XPHB', chosenAbility: 'intelligence' },
				{ origin: 'background', name: 'Tough', source: 'XPHB' },
				{ origin: 'manual', name: 'Elemental Adept', source: 'XPHB' },
			],
		}
		expect(featInstances(character, { name: 'Tough', source: 'XPHB' }).map((feat) => [feat.key, feat.origin, feat.name, feat.chosenAbility])).toEqual([
			['background', 'background', 'Tough', undefined],
			['asi:4', 'asi', 'Alert', undefined],
			['manual:0', 'manual', 'Elemental Adept', 'intelligence'],
			['manual:1', 'manual', 'Elemental Adept', undefined],
		])
	})

	it('labels a manual feat "Added manually"', () => {
		expect(featOriginLabel({ origin: 'manual' })).toBe('Added manually')
	})
})

describe('featInstances — species feat (D271)', () => {
	it('reads the stored species entry with its sub-choices, right after the background feat', () => {
		const character: Character = {
			id: '1',
			name: 'A',
			classes: [],
			featAsiChoices: [{ level: 4, kind: 'feat', name: 'Alert', source: 'XPHB' }],
			grantedFeats: [{ origin: 'species', name: 'Skilled', source: 'XPHB', proficiencies: { skills: ['arcana'] } }],
		}
		expect(featInstances(character, { name: 'Tough', source: 'XPHB' }).map((feat) => [feat.key, feat.origin, feat.name, feat.proficiencies])).toEqual([
			['background', 'background', 'Tough', undefined],
			['species', 'species', 'Skilled', { skills: ['arcana'] }],
			['asi:4', 'asi', 'Alert', undefined],
		])
		expect(featOriginLabel({ origin: 'species' })).toBe('Species')
	})

	it('has no species instance without a stored entry', () => {
		expect(featInstances({ id: '1', name: 'A', classes: [] }, null)).toEqual([])
	})
})

describe('featInstances — item feats (R14c1)', () => {
	const skilled = { name: 'Skilled', source: 'XPHB', proficiencies: { skills: ['arcana'] } }
	const withInventory = (inventory: Character['inventory']): Character => ({ id: '1', name: 'A', classes: [], inventory })

	it('keys each feat by inventory row and position, with the item name and the stored sub-choices', () => {
		const character = withInventory([
			{ name: 'Rope', source: 'XPHB', quantity: 1 },
			{ name: 'Ring', source: 'custom', quantity: 1, custom: { name: 'Ring', kind: 'worn', feats: [{ name: 'Tough', source: 'XPHB' }, skilled] } },
		])
		expect(featInstances(character, null)).toEqual([
			{ key: 'item:1:0', origin: 'item', itemName: 'Ring', name: 'Tough', source: 'XPHB' },
			{ key: 'item:1:1', origin: 'item', itemName: 'Ring', name: 'Skilled', source: 'XPHB', proficiencies: { skills: ['arcana'] } },
		])
		expect(featOriginLabel({ origin: 'item', itemName: 'Ring' })).toBe('From item (Ring)')
	})

	it('grants nothing from an unattuned attunement item, and grants once attuned', () => {
		const custom = { name: 'Amulet', kind: 'worn' as const, requiresAttunement: true as const, feats: [{ name: 'Tough', source: 'XPHB' }] }
		expect(featInstances(withInventory([{ name: 'Amulet', source: 'custom', quantity: 1, custom }]), null)).toEqual([])
		expect(featInstances(withInventory([{ name: 'Amulet', source: 'custom', quantity: 1, attuned: true, custom }]), null).map((feat) => feat.key)).toEqual(['item:0:0'])
	})

	it('grants nothing from a malformed definition (D43)', () => {
		const custom = { name: 'Ring', kind: 'worn' as const, feats: [{ name: 'Tough', source: 'XPHB' }, { name: 'Tough', source: 'XPHB' }] }
		expect(featInstances(withInventory([{ name: 'Ring', source: 'custom', quantity: 1, custom }]), null)).toEqual([])
	})
})

describe('featInstances — origin-feat override (D205)', () => {
	const soldier = { name: 'Soldier', source: 'XPHB', skillProficiencies: ['athletics', 'intimidation'] as [string, string], toolProficiency: 'Dice Set' }
	const savageAttacker = { name: 'Savage Attacker', source: 'XPHB' }

	it('uses the derived feat when there is no override', () => {
		const character: Character = { id: '1', name: 'A', classes: [], background: soldier }
		expect(featInstances(character, savageAttacker).map((feat) => [feat.origin, feat.name])).toEqual([['background', 'Savage Attacker']])
	})

	it('replaces the derived feat with the override and keeps only the override’s sub-choices', () => {
		const character: Character = {
			id: '1',
			name: 'A',
			classes: [],
			background: { ...soldier, originFeatOverride: { name: 'Echoing Soul', source: 'RHW' } },
			grantedFeats: [{ origin: 'background', name: 'Echoing Soul', source: 'RHW', proficiencies: { skills: ['arcana', 'history'] } }],
		}
		expect(featInstances(character, savageAttacker)).toEqual([
			{ key: 'background', origin: 'background', name: 'Echoing Soul', source: 'RHW', proficiencies: { skills: ['arcana', 'history'] } },
		])
	})

	it('gives a background with no fixed feat its override', () => {
		const character: Character = {
			id: '1',
			name: 'A',
			classes: [],
			background: { name: 'Spirit Medium', source: 'RHW', skillProficiencies: ['arcana', 'religion'], toolProficiency: 'x', originFeatOverride: { name: 'Gathered Whispers', source: 'RHW' } },
		}
		expect(featInstances(character, null).map((feat) => feat.name)).toEqual(['Gathered Whispers'])
	})
})
