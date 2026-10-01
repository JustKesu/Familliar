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

	it('F-5: Alert adds the Proficiency Bonus as its own line', () => {
		const withAlert: Character = { ...fighter5, featAsiChoices: [{ level: 4, kind: 'feat', name: 'Alert', source: 'XPHB' }] }
		expect(computeInitiative(withAlert)).toEqual({
			status: 'known',
			value: 5,
			breakdown: [
				{ source: 'dexterity modifier', amount: 2 },
				{ source: 'feat (Alert)', amount: 3 },
			],
		})
	})

	it('F-5: Alert from the species, a manual entry or an item counts once, whatever the origin', () => {
		const species: Character = { ...fighter5, grantedFeats: [{ origin: 'species', name: 'Alert', source: 'XPHB' }] }
		expect(computeInitiative(species)).toMatchObject({ value: 5 })
		const twice: Character = { ...species, grantedFeats: [...species.grantedFeats!, { origin: 'manual', name: 'Alert', source: 'XPHB' }] }
		expect(computeInitiative(twice)).toMatchObject({ value: 5 })
		const otherBook: Character = { ...fighter5, grantedFeats: [{ origin: 'manual', name: 'Alert', source: 'PHB' }] }
		expect(computeInitiative(otherBook)).toMatchObject({ value: 2 })
	})

	it("Alert from the background counts with nothing stored (D156)", () => {
		const criminal: Character = {
			...fighter5,
			background: { name: 'Criminal', source: 'XPHB', skillProficiencies: ['sleightOfHand', 'stealth'], toolProficiency: "Thieves' Tools" },
		}
		const feats = [{ name: 'Alert', source: 'XPHB', grantedByBackgrounds: [{ name: 'Criminal', source: 'XPHB' }] }]
		expect(computeInitiative(criminal, feats)).toEqual({
			status: 'known',
			value: 5,
			breakdown: [
				{ source: 'dexterity modifier', amount: 2 },
				{ source: 'feat (Alert)', amount: 3 },
			],
		})
	})

	it('a feat with no effect on initiative adds no line', () => {
		const withActor: Character = { ...fighter5, featAsiChoices: [{ level: 4, kind: 'feat', name: 'Actor', source: 'XPHB' }] }
		expect(computeInitiative(withActor)).toEqual({
			status: 'known',
			value: 2,
			breakdown: [{ source: 'dexterity modifier', amount: 2 }],
		})
	})
})
