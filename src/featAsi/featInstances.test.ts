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
