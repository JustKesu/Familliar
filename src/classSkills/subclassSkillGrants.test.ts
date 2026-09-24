import { describe, expect, it, vi } from 'vitest'
import { computeProficiencies } from '../calculation/proficiencies'
import { computeSkill } from '../calculation/skills'
import { emptyWizardData, isStepComplete, saveCharacter, wizardDataFromCharacter, wizardReducer, type WizardData, type WizardStep } from '../creation/wizardState'
import type { Character } from '../storage/character'
import type { CharacterStore } from '../storage/characterStore'
import { speciesToolGrantsFor } from '../toolProficiencies/speciesToolChoices'
import { subclassExpertiseSkills } from './subclassSkillGrants'

/* B6c (D177): subclass skill proficiencies and species tool picks. */

const scores = { method: 'standardArray' as const, scores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 } }

function character(className: string, subclass: string | null, level: number, extra: Partial<Character> = {}): Character {
	return { id: '1', name: 'Aria', classes: [{ className, classSource: 'XPHB', subclass, level }], abilityScores: scores, ...extra }
}

const awaiting = expect.objectContaining({ amount: 0, note: expect.stringContaining('waiting on a player pick') })

function breakdownOf(skill: Parameters<typeof computeSkill>[0], of: Character) {
	const result = computeSkill(skill, of)
	return result.status === 'known' ? result.breakdown : []
}

/** Walks the review step only, so saveCharacter checks nothing but what the test is about. */
const saveOnly = { levelUpSteps: new Set<WizardStep>(['review']) }

const twoLanguages = [
	{ name: 'Elvish', source: 'XPHB' },
	{ name: 'Dwarvish', source: 'XPHB' },
]

describe('fixed subclass skills', () => {
	it('Scout 3: Nature and Survival have expertise, and no expertise picker offers them', () => {
		const scout = character('Rogue', 'Scout', 3)
		expect(computeSkill('nature', scout)).toMatchObject({ value: { status: 'expertise', modifier: 4 }, breakdown: expect.arrayContaining([{ source: 'expertise (subclass (Scout))', amount: 4 }]) })
		expect(computeSkill('survival', scout)).toMatchObject({ value: { status: 'expertise' } })
		expect(subclassExpertiseSkills(scout.classes)).toEqual(['nature', 'survival'])
		expect(subclassExpertiseSkills(character('Rogue', 'Scout', 2).classes)).toEqual([])
	})

	it('Drunken Master: Performance proficient, the subclass named beside the class', () => {
		const monk = character('Monk', 'Way of the Drunken Master', 3, { classSkills: ['performance'] })
		expect(computeSkill('performance', monk)).toMatchObject({
			value: { status: 'proficient' },
			breakdown: expect.arrayContaining([{ source: 'proficiency (class, subclass (Way of the Drunken Master))', amount: 2 }]),
		})
	})

	it('Warrior of Mercy: Insight and Medicine proficient, and the Herbalism Kit is on the tools', () => {
		const monk = character('Monk', 'Warrior of Mercy', 3)
		expect(computeSkill('insight', monk)).toMatchObject({ value: { status: 'proficient' } })
		expect(computeSkill('medicine', monk)).toMatchObject({ value: { status: 'proficient' } })
		expect(computeProficiencies(monk, [], [], []).tools.map((item) => item.label)).toContain('Herbalism Kit')
	})

	it('not before level 3', () => {
		expect(computeSkill('insight', character('Monk', 'Warrior of Mercy', 2))).toMatchObject({ value: { status: 'none' } })
	})
})

describe('subclass skill picks', () => {
	it('Battle Master (XPHB): the stored Student of War skill counts', () => {
		const fighter = character('Fighter', 'Battle Master', 3, { subclassSkills: [{ grantedBy: 'battleMaster', name: 'history' }] })
		expect(computeSkill('history', fighter)).toMatchObject({ value: { status: 'proficient' }, breakdown: expect.arrayContaining([{ source: 'proficiency (subclass (Battle Master))', amount: 2 }]) })
	})

	it.each([
		['Cleric', 'Order Domain', 'orderDomain', 'persuasion', 'intimidation'],
		['Cleric', 'Peace Domain', 'peaceDomain', 'performance', 'insight'],
		['Fighter', 'Arcane Archer', 'arcaneArcher', 'arcana', 'nature'],
	] as const)('%s %s: a stored pick counts; an unmade one notes its candidates and blocks Edit Character', (className, subclass, grantedBy, picked, other) => {
		const stored = character(className, subclass, 3, { subclassSkills: [{ grantedBy, name: picked }] })
		expect(computeSkill(picked, stored)).toMatchObject({ value: { status: 'proficient' } })
		expect(breakdownOf(other, stored)).not.toContainEqual(awaiting)

		const unmade = character(className, subclass, 3)
		expect(computeSkill(picked, unmade)).toMatchObject({ value: { status: 'none' }, breakdown: expect.arrayContaining([awaiting]) })
		expect(breakdownOf('stealth', unmade)).not.toContainEqual(awaiting)

		// Edit Character runs the wizard with no level-up target: the step stays blocked until the pick is made.
		const edit = wizardDataFromCharacter(unmade, { subclasses: [], spellLevels: [] })
		expect(isStepComplete('languages', { ...edit, languageChoice: twoLanguages })).toBe(false)
		const seeded = wizardDataFromCharacter(stored, { subclasses: [], spellLevels: [] })
		expect(seeded.subclassSkills).toEqual([{ grantedBy, name: picked }])
		expect(isStepComplete('languages', { ...seeded, languageChoice: twoLanguages })).toBe(true)
	})

	it('Cavalier: a stored language fills the pick and names the subclass as its source', () => {
		const elvish = { name: 'Elvish', source: 'XPHB', grantedBy: 'cavalier' as const }
		const cavalier = character('Fighter', 'Cavalier', 3, { languages: [elvish] })
		expect(breakdownOf('history', cavalier)).not.toContainEqual(awaiting)
		expect(computeProficiencies(cavalier, [], [], []).languages).toContainEqual(expect.objectContaining({ label: 'Elvish', sources: [{ kind: 'subclass', name: 'Cavalier' }] }))
	})
})

describe('the wizard', () => {
	const cavalierData = (): WizardData => ({
		...emptyWizardData(),
		classChoice: { className: 'Fighter', classSource: 'XPHB', level: 3 },
		subclass: { name: 'Cavalier', source: 'XGE', featureType: null },
	})

	it('Cavalier: the languages step waits for a skill or a language, and a subclass change clears both', () => {
		const data = cavalierData()
		const levelUp = { levelUpTargetLevel: 3 }
		expect(isStepComplete('languages', data, levelUp)).toBe(false)
		expect(isStepComplete('languages', { ...data, subclassSkills: [{ grantedBy: 'cavalier', name: 'history' }] }, levelUp)).toBe(true)
		const withLanguage = { ...data, featureLanguages: [{ name: 'Elvish', source: 'XPHB', grantedBy: 'cavalier' as const }] }
		expect(isStepComplete('languages', withLanguage, levelUp)).toBe(true)
		const changed = wizardReducer({ step: 'class', data: { ...withLanguage, subclassSkills: [{ grantedBy: 'cavalier', name: 'history' }] } }, { type: 'setSubclass', subclass: { name: 'Samurai', source: 'XGE', featureType: null } })
		expect(changed.data.subclassSkills).toEqual([])
		expect(changed.data.featureLanguages).toEqual([])
	})

	it('saves the Cavalier skill and language of a held grant only', () => {
		const store = { create: vi.fn(() => ({ id: 'x', name: 'Aria', classes: [] })) } as unknown as CharacterStore
		const data = { ...cavalierData(), subclassSkills: [{ grantedBy: 'cavalier' as const, name: 'history' }, { grantedBy: 'orderDomain' as const, name: 'persuasion' }] }
		saveCharacter(store, data, undefined, saveOnly)
		expect(vi.mocked(store.create).mock.calls[0][0].subclassSkills).toEqual([{ grantedBy: 'cavalier', name: 'history' }])
	})

	it('Warforged and Satyr: one tool slot each, owed at creation, not on a level up', () => {
		const warforged = { ...emptyWizardData(), speciesChoice: { name: 'Warforged', source: 'EFA' } }
		expect(isStepComplete('languages', { ...warforged, languageChoice: twoLanguages })).toBe(false)
		expect(isStepComplete('languages', { ...warforged, languageChoice: twoLanguages, toolChoices: [{ grantedBy: 'warforged', name: 'Dice Set' }] })).toBe(true)
		expect(isStepComplete('languages', warforged, { levelUpTargetLevel: 2 })).toBe(true)
		expect(speciesToolGrantsFor({ name: 'Satyr', source: 'MPMM' })).toMatchObject([{ grantedBy: 'satyr', categories: ['anyMusicalInstrument'] }])
	})

	it('Warforged: the pick survives a class change, is saved and shows as a species tool', () => {
		const pick = { grantedBy: 'warforged' as const, name: "Thieves' Tools" }
		const state = { step: 'class' as const, data: { ...emptyWizardData(), speciesChoice: { name: 'Warforged', source: 'EFA' }, toolChoices: [pick, { grantedBy: 'bard' as const, name: 'Lute' }] } }
		expect(wizardReducer(state, { type: 'setClassChoice', choice: { className: 'Fighter', classSource: 'XPHB', level: 1 } }).data.toolChoices).toEqual([pick])
		expect(wizardReducer(state, { type: 'setSpeciesChoice', choice: { name: 'Elf', source: 'XPHB' } }).data.toolChoices).toEqual([{ grantedBy: 'bard', name: 'Lute' }])

		const store = { create: vi.fn(() => ({ id: 'x', name: 'Aria', classes: [] })) } as unknown as CharacterStore
		saveCharacter(store, { ...state.data, toolChoices: [pick] }, undefined, saveOnly)
		const saved = { id: 'x', ...vi.mocked(store.create).mock.calls[0][0] } as Character
		expect(saved.toolChoices).toEqual([pick])
		const tools = computeProficiencies(saved, [], [], []).tools
		expect(tools).toContainEqual(expect.objectContaining({ label: "Thieves' Tools", sources: [{ kind: 'species', name: 'Warforged' }] }))
		expect(computeProficiencies({ ...saved, toolChoices: [] }, [], [], []).tools).toContainEqual(expect.objectContaining({ label: '1 tool (Warforged) — not chosen', pending: true }))
	})

	it('Khoravar: a skill or a tool, never both; the skill is saved as a species skill and reopens in its slot', () => {
		const khoravar = { ...emptyWizardData(), speciesChoice: { name: 'Khoravar', source: 'EFA' }, languageChoice: twoLanguages }
		expect(isStepComplete('languages', khoravar)).toBe(false)
		const withTool = wizardReducer({ step: 'languages', data: khoravar }, { type: 'setSpeciesSkillOrTool', skill: null, tool: 'Dice Set' }).data
		expect(withTool.toolChoices).toEqual([{ grantedBy: 'khoravar', name: 'Dice Set' }])
		expect(isStepComplete('languages', withTool)).toBe(true)
		const withSkill = wizardReducer({ step: 'languages', data: withTool }, { type: 'setSpeciesSkillOrTool', skill: 'arcana', tool: null }).data
		expect(withSkill.toolChoices).toEqual([])
		expect(withSkill.speciesExtraSkill).toBe('arcana')

		const store = { create: vi.fn(() => ({ id: 'x', name: 'Aria', classes: [] })) } as unknown as CharacterStore
		saveCharacter(store, withSkill, undefined, saveOnly)
		const saved = { id: 'x', ...vi.mocked(store.create).mock.calls[0][0] } as Character
		expect(saved.speciesSkills).toEqual(['arcana'])
		expect(computeSkill('arcana', { ...saved, abilityScores: scores, classes: character('Fighter', null, 1).classes })).toMatchObject({ value: { status: 'proficient' }, breakdown: expect.arrayContaining([{ source: 'proficiency (species)', amount: 2 }]) })
		const reopened = wizardDataFromCharacter(saved, { subclasses: [], spellLevels: [] })
		expect(reopened.speciesSkills).toEqual([])
		expect(reopened.speciesExtraSkill).toBe('arcana')
	})

	it('no slot for a temporary species grant (Githyanki tool, Kalashtar skill, Trance)', () => {
		for (const species of [
			{ name: 'Githyanki', source: 'MPMM' },
			{ name: 'Kalashtar', source: 'EFA' },
			{ name: 'Eladrin', source: 'MPMM' },
			{ name: 'Sea Elf', source: 'MPMM' },
			{ name: 'Shadar-Kai', source: 'MPMM' },
		]) {
			expect(speciesToolGrantsFor(species)).toEqual([])
			const data = { ...emptyWizardData(), speciesChoice: species, languageChoice: twoLanguages }
			expect(isStepComplete('languages', data)).toBe(true)
			expect(computeProficiencies({ id: '1', name: 'A', classes: [], species }, [], [], []).tools).toEqual([])
		}
	})
})
