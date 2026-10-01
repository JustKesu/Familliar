import { describe, expect, it } from 'vitest'
import { expertisePoolOf, featSkillSources } from './expertisePool'

const feat = (origin: 'asi' | 'item' | 'manual', name: string, proficiencies?: { skills?: string[]; expertise?: string[] }) => ({ origin, name, source: 'XPHB', proficiencies }) as never

describe('featSkillSources', () => {
	it('takes the fixed and chosen skills of a feat, but nothing from a feat an item grants (D303)', () => {
		const instances = [feat('asi', 'Skilled', { skills: ['arcana'] }), feat('item', 'Skill Expert', { skills: ['history'] }), feat('manual', 'Boon of Skill')]
		expect(featSkillSources(instances, { 'Boon of Skill|XPHB': ['nature'], 'Skill Expert|XPHB': ['stealth'] })).toEqual([
			{ skill: 'arcana', source: 'Skilled' },
			{ skill: 'nature', source: 'Boon of Skill' },
		])
	})
})

describe('expertisePoolOf', () => {
	const sourceSkills = ['arcana', 'history', 'perception'].map((skill) => ({ skill, source: 'x' }))
	const base = { sourceSkills, fixedExpertise: [], feats: [], restrictedTo: undefined, picked: [] }

	it('leaves out a skill that already has Expertise from a feat\'s own choice (F-6 finding 3)', () => {
		const { pool, taken } = expertisePoolOf({ ...base, feats: [feat('asi', 'Skill Expert', { expertise: ['history'] })] })
		expect(taken).toEqual(['history'])
		expect(pool.map((entry) => entry.skill)).toEqual(['arcana', 'perception'])
	})

	it("still narrows the bigger pool by the class's restriction, Scholar (D292)", () => {
		const { pool } = expertisePoolOf({ ...base, restrictedTo: ['arcana', 'history', 'nature'], fixedExpertise: ['history'] })
		expect(pool.map((entry) => entry.skill)).toEqual(['arcana'])
	})

	it('measures a pick against the source skills: a lost proficiency, an exclusion and a restriction each get their own reason (D307)', () => {
		const { stale } = expertisePoolOf({ ...base, fixedExpertise: ['history'], restrictedTo: ['arcana', 'history'], picked: ['nature', 'history', 'perception', 'arcana'] })
		expect(stale).toEqual([
			{ skill: 'nature', reason: 'proficiency' },
			{ skill: 'history', reason: 'taken' },
			{ skill: 'perception', reason: 'restricted' },
		])
	})
})
