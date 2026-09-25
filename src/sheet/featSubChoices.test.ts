import { describe, expect, it } from 'vitest'
import type { FeatEffectEntry } from '../calculation/featEffects'
import type { FeatInstance } from '../featAsi/featInstances'
import { missingFeatSubChoices } from './featSubChoices'

const prodigy: FeatEffectEntry = {
	name: 'Prodigy',
	source: 'XPHB',
	skillProficiencies: [{ choose: { from: ['acrobatics', 'animal handling', 'arcana', 'athletics'] } }],
	toolProficiencies: [{ any: 1 }],
	languageProficiencies: [{ any: 1 }],
	expertise: [{ anyProficientSkill: 1 }],
}

const keenMind: FeatEffectEntry = {
	name: 'Keen Mind',
	source: 'XPHB',
	skillProficiencies: [{ choose: { from: ['arcana', 'history', 'investigation', 'nature', 'religion'] } }],
}

function instance(overrides: Partial<FeatInstance> = {}): FeatInstance {
	return { key: 'asi:4', origin: 'asi', level: 4, name: 'Prodigy', source: 'XPHB', ...overrides }
}

describe('missingFeatSubChoices — proficiency kinds (task A2)', () => {
	it('Prodigy without any stored pick lists all 4 proficiency kinds', () => {
		expect(missingFeatSubChoices(instance(), [prodigy])).toEqual(['skills', 'tools', 'languages', 'expertise'])
	})

	it('Prodigy with every kind stored lists none of them', () => {
		const withPicks = instance({
			proficiencies: { skills: ['arcana'], tools: ['Thieves’ Tools'], languages: [{ name: 'Elvish', source: 'XPHB' }], expertise: ['arcana'] },
		})
		expect(missingFeatSubChoices(withPicks, [prodigy])).toEqual([])
	})

	it('Keen Mind only ever asks for skills', () => {
		expect(missingFeatSubChoices(instance({ name: 'Keen Mind' }), [keenMind])).toEqual(['skills'])
		expect(missingFeatSubChoices(instance({ name: 'Keen Mind', proficiencies: { skills: ['history'] } }), [keenMind])).toEqual([])
	})

	it('Skilled counts skills and tools together, and a partial pick is still missing (task A3)', () => {
		const skilled: FeatEffectEntry = { name: 'Skilled', source: 'XPHB', skillToolLanguageProficiencies: [{ choose: [{ from: ['anySkill', 'anyTool'], count: 3 }] }] }
		const of = (proficiencies: FeatInstance['proficiencies']) => missingFeatSubChoices(instance({ name: 'Skilled', proficiencies }), [skilled])
		expect(of(undefined)).toEqual(['skills or tools'])
		expect(of({ skills: ['arcana'] })).toEqual(['skills or tools'])
		expect(of({ skills: ['arcana', 'history'], tools: ["Smith's Tools"] })).toEqual([])
		expect(of({ skills: ['arcana', 'history', 'nature'] })).toEqual([])
	})

	it('a feat missing from the loaded list asks for nothing (no data to check against)', () => {
		expect(missingFeatSubChoices(instance({ name: 'Nonexistent' }), [prodigy, keenMind])).toEqual([])
	})
})
