import { describe, expect, it } from 'vitest'
import type { Character } from '../storage/character'
import { featInstances } from './featInstances'

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
