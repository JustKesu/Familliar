import { describe, expect, it } from 'vitest'
import type { Character } from '../storage/character'
import { computePassiveInsight, computePassiveInvestigation, computePassivePerception, computeSkill, computeSkills } from './skills'

const bard5: Character = {
	id: '1',
	name: 'Bard5',
	classes: [{ className: 'Bard', classSource: 'XPHB', subclass: null, level: 5 }],
	abilityScores: {
		method: 'standardArray',
		scores: { strength: 10, dexterity: 14, constitution: 12, intelligence: 10, wisdom: 10, charisma: 16 },
	},
	classSkills: ['performance'],
}

const rogue5: Character = {
	id: '2',
	name: 'Rogue5',
	classes: [{ className: 'Rogue', classSource: 'XPHB', subclass: null, level: 5 }],
	abilityScores: {
		method: 'standardArray',
		scores: { strength: 10, dexterity: 18, constitution: 12, intelligence: 12, wisdom: 10, charisma: 10 },
	},
	classSkills: ['stealth'],
	expertiseSkills: ['stealth'],
}

const fighter5: Character = {
	id: '3',
	name: 'Fighter5',
	classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 5 }],
	abilityScores: {
		method: 'standardArray',
		scores: { strength: 16, dexterity: 10, constitution: 14, intelligence: 10, wisdom: 14, charisma: 10 },
	},
	classSkills: ['athletics', 'perception'],
	background: {
		name: 'Soldier',
		source: 'XPHB',
		skillProficiencies: ['perception', 'history'],
		toolProficiency: 'Vehicles (land)',
	},
}

describe('computeSkill', () => {
	it('Bard 5: class-proficient skill is ability modifier + full proficiency bonus', () => {
		expect(computeSkill('performance', bard5)).toEqual({
			status: 'known',
			value: { status: 'proficient', modifier: 6 },
			breakdown: [
				{ source: 'charisma modifier', amount: 3 },
				{ source: 'proficiency (class)', amount: 3 },
			],
		})
	})

	it('Bard 5: non-proficient skill gets half proficiency bonus (Jack of All Trades)', () => {
		expect(computeSkill('persuasion', bard5)).toEqual({
			status: 'known',
			value: { status: 'half', modifier: 4 },
			breakdown: [
				{ source: 'charisma modifier', amount: 3 },
				{ source: 'half proficiency (Jack of All Trades)', amount: 1 },
			],
		})
	})

	it('Bard 5: half proficiency rounds down (D45)', () => {
		expect(computeSkill('acrobatics', bard5)).toEqual({
			status: 'known',
			value: { status: 'half', modifier: 3 },
			breakdown: [
				{ source: 'dexterity modifier', amount: 2 },
				{ source: 'half proficiency (Jack of All Trades)', amount: 1 },
			],
		})
	})

	it('a Bard below level 2 does not get Jack of All Trades yet', () => {
		const bard1: Character = { ...bard5, classes: [{ className: 'Bard', classSource: 'XPHB', subclass: null, level: 1 }] }
		const result = computeSkill('persuasion', bard1)
		expect(result.status === 'known' && result.value.status).toBe('none')
	})

	it('Rogue 5: expertise doubles the proficiency bonus and never applies Jack of All Trades', () => {
		expect(computeSkill('stealth', rogue5)).toEqual({
			status: 'known',
			value: { status: 'expertise', modifier: 10 },
			breakdown: [
				{ source: 'dexterity modifier', amount: 4 },
				{ source: 'expertise (class)', amount: 6 },
			],
		})
	})

	it('Rogue 5: a skill with no proficiency source is just the ability modifier', () => {
		expect(computeSkill('religion', rogue5)).toEqual({
			status: 'known',
			value: { status: 'none', modifier: 1 },
			breakdown: [{ source: 'intelligence modifier', amount: 1 }],
		})
	})

	it('Fighter 5: class-proficient skill, no expertise, no Jack of All Trades', () => {
		expect(computeSkill('athletics', fighter5)).toEqual({
			status: 'known',
			value: { status: 'proficient', modifier: 6 },
			breakdown: [
				{ source: 'strength modifier', amount: 3 },
				{ source: 'proficiency (class)', amount: 3 },
			],
		})
	})

	it('D44: a skill granted by both class and background is counted once, both sources named', () => {
		expect(computeSkill('perception', fighter5)).toEqual({
			status: 'known',
			value: { status: 'proficient', modifier: 5 },
			breakdown: [
				{ source: 'wisdom modifier', amount: 2 },
				{ source: 'proficiency (class, background)', amount: 3 },
			],
		})
	})

	it('returns unknown when ability scores are missing (D43)', () => {
		const blank: Character = { id: '4', name: 'Blank', classes: fighter5.classes }
		expect(computeSkill('athletics', blank).status).toBe('unknown')
	})
})

describe('computeSkills', () => {
	it('computes all 18 skills', () => {
		const result = computeSkills(fighter5)
		expect(Object.keys(result)).toHaveLength(18)
	})
})

describe('passive values (D48)', () => {
	it('Passive Perception is 10 + the Perception bonus', () => {
		expect(computePassivePerception(fighter5)).toEqual({
			status: 'known',
			value: 15,
			breakdown: [
				{ source: 'base', amount: 10 },
				{ source: 'wisdom modifier', amount: 2 },
				{ source: 'proficiency (class, background)', amount: 3 },
			],
		})
	})

	it('Passive Investigation and Passive Insight use their own skills', () => {
		const investigation = computePassiveInvestigation(rogue5)
		expect(investigation.status === 'known' && investigation.value).toBe(11)

		const insight = computePassiveInsight(bard5)
		expect(insight.status === 'known' && insight.value).toBe(11)
	})
})
