import { describe, expect, it } from 'vitest'
import type { Character } from '../storage/character'
import { computeInitiative } from './initiative'

const fighter5: Character = {
	id: '1',
	name: 'Fighter5',
	classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 5 }],
	abilityScores: {
		method: 'standardArray',
		scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 },
	},
	abilityBonus: { strength: 2, constitution: 1 },
}

describe('computeInitiative', () => {
	it('is the DEX modifier', () => {
		expect(computeInitiative(fighter5)).toEqual({
			status: 'known',
			value: 2,
			breakdown: [{ source: 'dexterity modifier', amount: 2 }],
		})
	})

	it('returns unknown when ability scores are missing', () => {
		const noScores: Character = { id: '2', name: 'Blank', classes: [] }
		expect(computeInitiative(noScores).status).toBe('unknown')
	})
})
