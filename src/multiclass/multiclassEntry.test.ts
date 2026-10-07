import { describe, expect, it, vi } from 'vitest'
import { loadDataFile } from '../dataLoader/dataLoader'
import { computeSkill } from '../calculation/skills'
import { classProficiencyGrants } from '../calculation/classProficiencies'
import { expertisePoolOf } from '../creation/expertisePool'
import { isStepComplete, saveCharacter, wizardDataFromCharacter, type WizardData, type WizardStep } from '../creation/wizardState'
import type { FeatEntry } from '../featAsi/featAsiData'
import { levelGainsFor } from '../levelUp/levelGains'
import { loadResolverData } from '../featureResolver'
import { checkOneClassRaised } from '../levelUp/multiclassLevelUp'
import type { Character, CharacterClass, CharacterMulticlassPick } from '../storage/character'
import type { CharacterStore } from '../storage/characterStore'
import { describeMulticlassPicksError, describeStoredCharacterError, withoutMalformedDroppableFields } from '../storage/validate'
import { multiclassPickShape, multiclassSkillSources } from './multiclassPicks'
import { multiclassPrerequisiteScores, primaryAbilityOf, unmetMulticlassPrerequisite } from './multiclassPrerequisites'

/* M7b (D330): entering a new class on level up. */

vi.mock('../dataLoader/dataLoader', () => ({
	loadDataFile: vi.fn(async (path: string) => {
		const fs = await import('fs')
		const nodePath = await import('path')
		return JSON.parse(fs.readFileSync(nodePath.join(__dirname, '..', '..', path), 'utf8'))
	}),
}))

const XPHB = 'XPHB'
const cls = (className: string, level: number, subclass: string | null = null): CharacterClass => ({ className, classSource: XPHB, subclass, level })
const ref = (className: string) => ({ className, classSource: XPHB })
const fighterOrder = (count: number) => Array.from({ length: count }, () => ref('Fighter'))

function character(scores: Partial<Record<'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma', number>>, extra: Partial<Character> = {}): Character {
	return {
		id: 'm',
		name: 'Aria',
		classes: [cls('Fighter', 4, 'Champion')],
		abilityScores: { method: 'standardArray', scores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, ...scores } },
		...extra,
	} as Character
}

const FEATS = [{ name: 'Athlete', source: XPHB, category: 'G', ability: [{ choose: { from: ['str', 'dex'] } }] }] as unknown as FeatEntry[]

describe('primaryAbility (DATA.md: array = OR, keys of one object = AND)', () => {
	it('reads Fighter as STR or DEX and Monk as DEX and WIS', async () => {
		const classes = await loadDataFile('data/classes.json')
		expect(primaryAbilityOf(classes, ref('Fighter'))).toEqual([['strength'], ['dexterity']])
		expect(primaryAbilityOf(classes, ref('Monk'))).toEqual([['dexterity', 'wisdom']])
		expect(primaryAbilityOf(classes, ref('Nobody'))).toBeNull()
	})
})

describe('unmetMulticlassPrerequisite', () => {
	const check = async (who: Character, target: string) => unmetMulticlassPrerequisite(who, ref(target), await loadDataFile('data/classes.json'), multiclassPrerequisiteScores(who, FEATS))

	it('meets a new class and the held one at 13', async () => {
		expect(await check(character({ strength: 13, intelligence: 13 }), 'Wizard')).toBeNull()
	})

	it('names the missing score of the new class', async () => {
		expect(await check(character({ strength: 15, charisma: 12 }), 'Sorcerer')).toBe('Needs Charisma 13 (Sorcerer). You have 12.')
	})

	it('Fighter is STR or DEX: either one is enough', async () => {
		expect(await check(character({ strength: 8, dexterity: 13, intelligence: 13 }), 'Wizard')).toBeNull()
		expect(await check(character({ strength: 13, dexterity: 8, intelligence: 13 }), 'Wizard')).toBeNull()
	})

	it('Monk is DEX and WIS: one alone is not enough', async () => {
		expect(await check(character({ strength: 13, dexterity: 14, wisdom: 12 }), 'Monk')).toBe('Needs Dexterity 13 and Wisdom 13 (Monk). You have Dexterity 14, Wisdom 12.')
		expect(await check(character({ strength: 13, dexterity: 13, wisdom: 13 }), 'Monk')).toBeNull()
	})

	it('an unmet class already held blocks every new class', async () => {
		const weak = character({ strength: 11, dexterity: 11, intelligence: 18, charisma: 18, wisdom: 18 })
		const reason = 'Needs Strength 13 or Dexterity 13 (Fighter, a class you already have). You have Strength 11, Dexterity 11.'
		for (const target of ['Wizard', 'Sorcerer', 'Cleric']) expect(await check(weak, target)).toBe(reason)
	})

	it('counts an ASI and ignores an item', async () => {
		const asi = character({ strength: 13, charisma: 11 }, { featAsiChoices: [{ level: 4, kind: 'asi', increases: { charisma: 2 } }] })
		expect(await check(asi, 'Sorcerer')).toBeNull()
		const ring = character(
			{ strength: 12, dexterity: 13 },
			{
				classes: [cls('Rogue', 4)],
				inventory: [{ name: 'Ring of Might', source: 'custom', quantity: 1, custom: { name: 'Ring of Might', kind: 'worn', feats: [{ name: 'Athlete', source: XPHB, chosenAbility: 'strength' }] } }] as unknown as Character['inventory'],
			},
		)
		expect(await check(ring, 'Barbarian')).toBe('Needs Strength 13 (Barbarian). You have 12.')
	})
})

describe('multiclassPickShape (DATA.md)', () => {
	it('reads the skill choice and the Bard instrument, and nothing for Wizard', async () => {
		const classes = await loadDataFile('data/classes.json')
		expect(multiclassPickShape(classes, 'Rogue', XPHB).skills?.count).toBe(1)
		expect(multiclassPickShape(classes, 'Rogue', XPHB).tools).toBeNull()
		expect(multiclassPickShape(classes, 'Bard', XPHB).tools).toEqual({ count: 1, category: 'anyMusicalInstrument' })
		expect(multiclassPickShape(classes, 'Wizard', XPHB)).toEqual({ skills: null, tools: null })
	})

	it('puts the pick on the Languages step of a level up into the class, never for a held class', async () => {
		const [classes, resolver] = await Promise.all([loadDataFile('data/classes.json'), loadResolverData()])
		const fighter = character({ strength: 15, dexterity: 13 }, { levelOrder: fighterOrder(4) })
		expect(levelGainsFor(fighter, ref('Rogue'), classes, resolver).steps.languages.parts).toContainEqual({ name: 'Rogue multiclass skill', count: 1 })
		const bard = levelGainsFor(fighter, ref('Bard'), classes, resolver).steps.languages.parts
		expect(bard).toContainEqual({ name: 'Bard multiclass instrument', count: 1 })
		// D328: never the Bard's three starting instruments.
		expect(bard.some((part) => part.name === 'Bard tool')).toBe(false)
		expect(levelGainsFor(fighter, ref('Fighter'), classes, resolver).steps.languages.status).not.toBe('adds')
	})
})

function store(): CharacterStore {
	return { create: vi.fn(), update: vi.fn((id: string) => ({ id, name: 'Aria', classes: [] })) } as unknown as CharacterStore
}

const walked = (steps: WizardStep[], extra = {}) => ({ levelUpSteps: new Set<WizardStep>(steps), levelUpTargetLevel: 5, characterLevel: 5, hitDieFaces: 6, ...extra })

function fighter4(extra: Partial<Character> = {}): Character {
	return character(
		{ strength: 15, intelligence: 13 },
		{
			classSkills: ['athletics', 'perception'],
			masteries: [{ name: 'Longsword' }, { name: 'Greataxe' }, { name: 'Shortbow' }],
			fightingStyles: [{ className: 'Fighter', classSource: XPHB, name: 'Defense', source: XPHB }],
			featAsiChoices: [{ level: 4, kind: 'asi', increases: { strength: 2 } }],
			hitPointLevels: [{ level: 2, kind: 'average', dieResult: 6 }],
			...extra,
		},
	)
}

function entering(existing: Character, className: string, faces: number, picks: CharacterMulticlassPick[] = []): WizardData {
	const seed = wizardDataFromCharacter(existing, { subclasses: [], spellLevels: [], activeClass: { className, classSource: XPHB, featureTypes: [] } })
	return {
		...seed,
		classChoice: { className, classSource: XPHB, level: 1 },
		hitPointLevels: [...seed.hitPointLevels, { level: 5, kind: 'average', dieResult: faces / 2 + 1 }],
		multiclassPicks: [...(seed.multiclassPicks ?? []), ...picks],
	}
}

describe('wizardDataFromCharacter entering a class', () => {
	it('seeds the new class at class level 0 with nothing chosen, and keeps the character-wide picks', () => {
		const seed = wizardDataFromCharacter(fighter4(), { subclasses: [], spellLevels: [], activeClass: { className: 'Wizard', classSource: XPHB, featureTypes: [] } })
		expect(seed.classChoice).toEqual({ className: 'Wizard', classSource: XPHB, level: 0 })
		expect(seed.subclass).toBeNull()
		expect(seed.fightingStyle).toBeNull()
		expect(seed.spellChoices).toEqual([])
		expect(seed.masteries).toEqual(['Longsword', 'Greataxe', 'Shortbow'])
	})
})

describe('saveCharacter entering a class', () => {
	it('appends Wizard 1 last, rebuilds levelOrder for an old single-class save, and passes every Fighter record through', () => {
		const existing = fighter4()
		const characterStore = store()
		saveCharacter(characterStore, entering(existing, 'Wizard', 6), undefined, walked(['hitPoints', 'review']), undefined, existing, 5)
		const input = vi.mocked(characterStore.update).mock.calls[0][1]
		expect(input.classes).toEqual([cls('Fighter', 4, 'Champion'), cls('Wizard', 1)])
		expect(input.levelOrder).toEqual([...fighterOrder(4), ref('Wizard')])
		for (const key of ['classSkills', 'masteries', 'fightingStyles', 'featAsiChoices'] as const) expect(JSON.stringify(input[key])).toBe(JSON.stringify(existing[key]))
		expect(input.hitPointLevels).toEqual([...existing.hitPointLevels!, { level: 5, kind: 'average', dieResult: 4 }])
		expect(input.multiclassPicks).toBeUndefined()
	})

	it('appends to a stored levelOrder and stores the Rogue skill pick with its class', () => {
		const existing = fighter4({ levelOrder: fighterOrder(4) })
		const characterStore = store()
		const pick: CharacterMulticlassPick = { className: 'Rogue', classSource: XPHB, kind: 'skill', name: 'stealth' }
		saveCharacter(characterStore, entering(existing, 'Rogue', 8, [pick]), undefined, walked(['hitPoints', 'review'], { hitDieFaces: 8 }), undefined, existing, 5)
		const input = vi.mocked(characterStore.update).mock.calls[0][1]
		expect(input.levelOrder).toEqual([...fighterOrder(4), ref('Rogue')])
		expect(input.multiclassPicks).toEqual([pick])
	})

	it('refuses a class entered above class level 1, or a multiclass pick for a class not entered now', () => {
		const existing = fighter4({ levelOrder: fighterOrder(4) })
		const twice = { ...entering(existing, 'Wizard', 6), classChoice: { className: 'Wizard', classSource: XPHB, level: 2 } }
		expect(() => saveCharacter(store(), twice, undefined, walked(['hitPoints', 'review']), undefined, existing, 5)).toThrow(/exactly one level/)
		const raised = wizardDataFromCharacter(existing, { subclasses: [], spellLevels: [] })
		const sneaky: WizardData = {
			...raised,
			classChoice: { className: 'Fighter', classSource: XPHB, level: 5 },
			hitPointLevels: [...raised.hitPointLevels, { level: 5, kind: 'average', dieResult: 6 }],
			multiclassPicks: [{ className: 'Fighter', classSource: XPHB, kind: 'skill', name: 'stealth' }],
		}
		expect(() => saveCharacter(store(), sneaky, undefined, walked(['hitPoints', 'review'], { hitDieFaces: 10 }), undefined, existing, 5)).toThrow(/Only a class entered/)
	})

	it('Languages step: the entered Bard owes its skill and instrument, not the three starting instruments', () => {
		const existing = fighter4({ levelOrder: fighterOrder(4) })
		const conditions = walked(['languages', 'hitPoints', 'review'], { multiclassPickCount: 2 })
		const skill: CharacterMulticlassPick = { className: 'Bard', classSource: XPHB, kind: 'skill', name: 'insight' }
		const lute: CharacterMulticlassPick = { className: 'Bard', classSource: XPHB, kind: 'tool', name: 'Lute' }
		expect(isStepComplete('languages', entering(existing, 'Bard', 8, [skill]), conditions)).toBe(false)
		expect(isStepComplete('languages', entering(existing, 'Bard', 8, [skill, lute]), conditions)).toBe(true)
		expect(isStepComplete('languages', entering(existing, 'Bard', 8, [skill, lute]), { ...conditions, multiclassPickCount: null })).toBe(false)
	})
})

describe('checkOneClassRaised with a new class (D330)', () => {
	const before = [cls('Fighter', 4)]
	it('accepts one new class appended last at level 1', () => {
		expect(() => checkOneClassRaised(before, [cls('Fighter', 4), cls('Wizard', 1)], 5)).not.toThrow()
	})
	it('refuses a new class at level 2, first in the list, or beside a raised class', () => {
		expect(() => checkOneClassRaised(before, [cls('Fighter', 4), cls('Wizard', 2)], 6)).toThrow()
		expect(() => checkOneClassRaised(before, [cls('Wizard', 1), cls('Fighter', 4)], 5)).toThrow()
		expect(() => checkOneClassRaised(before, [cls('Fighter', 5), cls('Wizard', 1)], 6)).toThrow()
		expect(() => checkOneClassRaised(before, [cls('Fighter', 4), cls('Fighter', 1)], 5)).toThrow()
	})
})

describe('readers of multiclassPicks', () => {
	const rogueFighter = (picks: CharacterMulticlassPick[]): Character =>
		character({ strength: 15, dexterity: 14 }, { classes: [cls('Fighter', 4), cls('Rogue', 1)], levelOrder: [...fighterOrder(4), ref('Rogue')], multiclassPicks: picks })

	it('a multiclass skill is proficient on the sheet with its class named', () => {
		const result = computeSkill('stealth', rogueFighter([{ className: 'Rogue', classSource: XPHB, kind: 'skill', name: 'stealth' }]))
		if (result.status !== 'known') throw new Error(result.reason)
		expect(result.value.status).toBe('proficient')
		expect(result.breakdown.map((part) => part.source)).toContain('proficiency (Rogue (multiclass))')
	})

	it('the Expertise pool sees the multiclass skill as held', () => {
		const { pool } = expertisePoolOf({ sourceSkills: multiclassSkillSources([{ className: 'Rogue', classSource: XPHB, kind: 'skill', name: 'stealth' }]), fixedExpertise: [], feats: [], restrictedTo: null, picked: [] })
		expect(pool).toEqual([{ skill: 'stealth', source: 'Rogue (multiclass)' }])
	})

	it('Thieves’ Tools come once from the Rogue multiclass, a Bard instrument pick under its class, no Wizard armor', async () => {
		const classes = await loadDataFile('data/classes.json')
		const rogue = classProficiencyGrants(rogueFighter([]), classes)
		expect(rogue.tools).toEqual([{ name: "Thieves' Tools", source: { kind: 'class', name: 'Rogue (multiclass)' } }])
		const bard = classProficiencyGrants(
			{ classes: [cls('Fighter', 4), cls('Bard', 1)], levelOrder: [...fighterOrder(4), ref('Bard')], multiclassPicks: [{ className: 'Bard', classSource: XPHB, kind: 'tool', name: 'Lute' }] },
			classes,
		)
		expect(bard.tools).toContainEqual({ name: 'Lute', source: { kind: 'class', name: 'Bard (multiclass)' } })
		const wizard = classProficiencyGrants({ classes: [cls('Fighter', 4), cls('Wizard', 1)], levelOrder: [...fighterOrder(4), ref('Wizard')] }, classes)
		expect(wizard.armor.every((entry) => entry.source.name === 'Fighter')).toBe(true)
	})
})

describe('validate multiclassPicks (schema 60)', () => {
	const classes = [cls('Fighter', 4), cls('Rogue', 1)]
	it('accepts picks of a held class and refuses bad shapes', () => {
		expect(describeMulticlassPicksError(undefined, classes)).toBeNull()
		expect(describeMulticlassPicksError([{ className: 'Rogue', classSource: XPHB, kind: 'skill', name: 'stealth' }], classes)).toBeNull()
		expect(describeMulticlassPicksError('x', classes)).toMatch(/not an array/)
		expect(describeMulticlassPicksError([{ className: 'Rogue', classSource: XPHB, kind: 'spell', name: 'x' }], classes)).toMatch(/kind/)
		expect(describeMulticlassPicksError([{ className: 'Rogue', classSource: XPHB, kind: 'skill', name: '' }], classes)).toMatch(/name/)
		expect(describeMulticlassPicksError([{ className: 'Bard', classSource: XPHB, kind: 'skill', name: 'insight' }], classes)).toMatch(/does not have/)
	})

	it('reading drops a malformed list instead of failing the whole list; the full validator reports it', () => {
		const record = { schemaVersion: 60, id: '1', name: 'Aria', classes, multiclassPicks: [{ className: 'Bard', classSource: XPHB, kind: 'skill', name: 'insight' }] }
		expect(describeStoredCharacterError(record, 0)).toMatch(/multiclassPicks/)
		const read = withoutMalformedDroppableFields(record) as Record<string, unknown>
		expect('multiclassPicks' in read).toBe(false)
		expect(describeStoredCharacterError(read, 0)).toBeNull()
	})
})
