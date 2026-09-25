import { describe, expect, it } from 'vitest'
import type { Character } from '../storage/character'
import {
	backgroundOriginFeatAmong,
	characterFeats,
	featAbilityScoreContributions,
	featFixedSkillProficiencyNames,
	featProficiencyChoiceShape,
	featSavingThrowProficiencyNames,
	featSkillChoiceAwaitingNotes,
	featStoredExpertiseSkillNames,
	featStoredSkillProficiencyNames,
	proseFeatEffectNotes,
	type FeatEffectEntry,
} from './featEffects'

/*
 * Pure-logic tests for the feat/ASI-into-calculation slice (build order
 * step 4a, closing the gap left by the wizard-only feat/ASI slice). Data
 * shapes confirmed via scripts/investigate-feat-calc-fields.js and
 * scripts/investigate-feat-ability-choice-shape.js before writing this.
 */

const athlete: FeatEffectEntry = { name: 'Athlete', source: 'XPHB', ability: [{ choose: { from: ['str', 'dex'] } }] }
const actor: FeatEffectEntry = { name: 'Actor', source: 'XPHB', ability: [{ cha: 1 }] }
const resilient: FeatEffectEntry = {
	name: 'Resilient',
	source: 'XPHB',
	ability: [{ choose: { from: ['str', 'dex', 'con', 'int', 'wis', 'cha'] } }],
	savingThrowProficiencies: [{ choose: { from: ['str', 'dex', 'con', 'int', 'wis', 'cha'] } }],
}
const boonOfSkill: FeatEffectEntry = {
	name: 'Boon of Skill',
	source: 'XPHB',
	skillProficiencies: [
		Object.fromEntries(['athletics', 'stealth', 'perception'].map((s) => [s, true])) as Record<string, boolean>,
	],
	expertise: [{ anyProficientSkill: 1 }],
}
const keenMind: FeatEffectEntry = { name: 'Keen Mind', source: 'XPHB', skillProficiencies: [{ choose: { from: ['arcana', 'history', 'investigation', 'nature', 'religion'] } }] }
const skillExpert: FeatEffectEntry = { name: 'Skill Expert', source: 'XPHB', skillProficiencies: [{ any: 1 }], expertise: [{ anyProficientSkill: 1 }] }

function withChoices(character: Omit<Character, 'featAsiChoices'>, choices: Character['featAsiChoices']): Character {
	return { ...character, featAsiChoices: choices }
}

const base: Character = { id: '1', name: 'Test', classes: [] }

describe('featAbilityScoreContributions', () => {
	it('adds +1 for a choice-shaped feat when it targets this ability', () => {
		const character = withChoices(base, [{ level: 4, kind: 'feat', name: 'Athlete', source: 'XPHB', chosenAbility: 'strength' }])
		expect(featAbilityScoreContributions('strength', character, [athlete])).toEqual([{ source: 'feat (Athlete)', amount: 1 }])
	})

	it('contributes nothing for a choice-shaped feat targeting a different ability', () => {
		const character = withChoices(base, [{ level: 4, kind: 'feat', name: 'Athlete', source: 'XPHB', chosenAbility: 'strength' }])
		expect(featAbilityScoreContributions('dexterity', character, [athlete])).toEqual([])
	})

	it('adds the fixed amount for a fixed-bonus feat', () => {
		const character = withChoices(base, [{ level: 4, kind: 'feat', name: 'Actor', source: 'XPHB' }])
		expect(featAbilityScoreContributions('charisma', character, [actor])).toEqual([{ source: 'feat (Actor)', amount: 1 }])
	})

	it('adds an ASI increase as its own contribution, labeled by level', () => {
		const character = withChoices(base, [{ level: 4, kind: 'asi', increases: { strength: 2 } }])
		expect(featAbilityScoreContributions('strength', character, [])).toEqual([{ source: 'ASI (level 4)', amount: 2 }])
	})

	it('stacks multiple ASI/feat contributions to the same ability as separate list entries (D42)', () => {
		const character = withChoices(base, [
			{ level: 4, kind: 'asi', increases: { strength: 2 } },
			{ level: 8, kind: 'feat', name: 'Actor', source: 'XPHB' },
		])
		expect(featAbilityScoreContributions('strength', character, [actor])).toEqual([{ source: 'ASI (level 4)', amount: 2 }])
		// Actor targets charisma, not strength — sanity check the two picks don't bleed into each other.
		expect(featAbilityScoreContributions('charisma', character, [actor])).toEqual([{ source: 'feat (Actor)', amount: 1 }])
	})
})

describe('featSavingThrowProficiencyNames', () => {
	it("resolves Resilient's saving throw proficiency from the SAME chosenAbility as its ability bonus", () => {
		const character = withChoices(base, [{ level: 4, kind: 'feat', name: 'Resilient', source: 'XPHB', chosenAbility: 'wisdom' }])
		expect(featSavingThrowProficiencyNames('wisdom', character, [resilient])).toEqual(['Resilient'])
		expect(featSavingThrowProficiencyNames('strength', character, [resilient])).toEqual([])
	})
})

describe('featFixedSkillProficiencyNames', () => {
	it("finds Boon of Skill's fixed grant for a skill it names", () => {
		const character = withChoices(base, [{ level: 19, kind: 'feat', name: 'Boon of Skill', source: 'XPHB' }])
		expect(featFixedSkillProficiencyNames('athletics', character, [boonOfSkill])).toEqual(['Boon of Skill'])
	})

	it('does not fire for a choice-shaped skillProficiencies entry (Keen Mind)', () => {
		const character = withChoices(base, [{ level: 4, kind: 'feat', name: 'Keen Mind', source: 'XPHB' }])
		expect(featFixedSkillProficiencyNames('arcana', character, [keenMind])).toEqual([])
	})
})

describe('featSkillChoiceAwaitingNotes', () => {
	it('notes a named-choice feat only for skills in its own list', () => {
		const character = withChoices(base, [{ level: 4, kind: 'feat', name: 'Keen Mind', source: 'XPHB' }])
		expect(featSkillChoiceAwaitingNotes('arcana', character, [keenMind], false)).toHaveLength(1)
		expect(featSkillChoiceAwaitingNotes('athletics', character, [keenMind], false)).toEqual([])
	})

	it('notes an "any" skill entry (Skill Expert) for every skill', () => {
		const character = withChoices(base, [{ level: 19, kind: 'feat', name: 'Skill Expert', source: 'XPHB' }])
		expect(featSkillChoiceAwaitingNotes('survival', character, [skillExpert], false)).toHaveLength(1)
	})

	it('notes an expertise (anyProficientSkill) entry only when the skill is already proficient', () => {
		const character = withChoices(base, [{ level: 19, kind: 'feat', name: 'Boon of Skill', source: 'XPHB' }])
		expect(featSkillChoiceAwaitingNotes('athletics', character, [boonOfSkill], true)).toContainEqual(
			expect.objectContaining({ source: 'feat (Boon of Skill)' }),
		)
		expect(featSkillChoiceAwaitingNotes('religion', character, [boonOfSkill], false)).toEqual([])
	})

	it('the note carries amount 0 so it never changes the total', () => {
		const character = withChoices(base, [{ level: 4, kind: 'feat', name: 'Keen Mind', source: 'XPHB' }])
		const [note] = featSkillChoiceAwaitingNotes('arcana', character, [keenMind], false)
		expect(note.amount).toBe(0)
		expect(note.note).toBeTruthy()
	})
})

describe('stored feat proficiency picks (task A2)', () => {
	const prodigy: FeatEffectEntry = {
		name: 'Prodigy',
		source: 'XPHB',
		skillProficiencies: [{ choose: { from: ['acrobatics', 'animal handling', 'arcana', 'athletics'] } }],
		toolProficiencies: [{ any: 1 }],
		languageProficiencies: [{ any: 1 }],
		expertise: [{ anyProficientSkill: 1 }],
	}
	const skilled: FeatEffectEntry = {
		name: 'Skilled',
		source: 'XPHB',
		skillToolLanguageProficiencies: [{ choose: [{ from: ['anySkill', 'anyTool'], count: 3 }] }],
	}

	it('featStoredSkillProficiencyNames finds a stored skill pick, and only for the skill it names', () => {
		const character = withChoices(base, [{ level: 4, kind: 'feat', name: 'Keen Mind', source: 'XPHB', proficiencies: { skills: ['history'] } }])
		expect(featStoredSkillProficiencyNames('history', character, [keenMind])).toEqual(['Keen Mind'])
		expect(featStoredSkillProficiencyNames('arcana', character, [keenMind])).toEqual([])
	})

	it('featStoredExpertiseSkillNames finds a stored expertise pick, including one targeting a skill the same feat granted (D159)', () => {
		const character = withChoices(base, [
			{ level: 19, kind: 'feat', name: 'Skill Expert', source: 'XPHB', proficiencies: { skills: ['religion'], expertise: ['religion'] } },
		])
		expect(featStoredExpertiseSkillNames('religion', character, [skillExpert])).toEqual(['Skill Expert'])
		expect(featStoredExpertiseSkillNames('arcana', character, [skillExpert])).toEqual([])
	})

	it('featSkillChoiceAwaitingNotes stops once the instance has a stored pick for the field concerned (D58/D161)', () => {
		const withPick = withChoices(base, [{ level: 4, kind: 'feat', name: 'Keen Mind', source: 'XPHB', proficiencies: { skills: ['history'] } }])
		expect(featSkillChoiceAwaitingNotes('history', withPick, [keenMind], false)).toEqual([])

		const withoutPick = withChoices(base, [{ level: 4, kind: 'feat', name: 'Keen Mind', source: 'XPHB' }])
		expect(featSkillChoiceAwaitingNotes('history', withoutPick, [keenMind], false)).toHaveLength(1)

		const expertisePicked = withChoices(base, [
			{ level: 19, kind: 'feat', name: 'Boon of Skill', source: 'XPHB', proficiencies: { expertise: ['athletics'] } },
		])
		expect(featSkillChoiceAwaitingNotes('athletics', expertisePicked, [boonOfSkill], true)).toEqual([])
	})

	const shapeOf = featProficiencyChoiceShape

	it('featProficiencyChoiceShape: Prodigy asks for 1 skill, 1 tool of any kind, 1 language and 1 expertise', () => {
		expect(shapeOf(prodigy)).toEqual({
			skills: { count: 1, from: ['acrobatics', 'animal handling', 'arcana', 'athletics'] },
			tools: { count: 1, categories: ['anyArtisansTool', 'anyGamingSet', 'anyMusicalInstrument', 'anyOtherTool'], only: null },
			skillsOrTools: 0,
			languages: 1,
			expertise: 1,
			fixedSkills: [],
		})
	})

	it('featProficiencyChoiceShape: Keen Mind asks for one skill from its list, Skill Expert for any skill', () => {
		expect(shapeOf(keenMind)).toMatchObject({ skills: { count: 1, from: ['arcana', 'history', 'investigation', 'nature', 'religion'] }, tools: null, languages: 0, expertise: 0 })
		expect(shapeOf(skillExpert).skills?.from).toHaveLength(18)
	})

	it('featProficiencyChoiceShape: Skilled is 3 picks of skills or tools, never languages', () => {
		expect(shapeOf(skilled)).toMatchObject({ skills: null, tools: null, skillsOrTools: 3, languages: 0 })
	})

	it("featProficiencyChoiceShape: Boon of Skill's FIXED skills are no choice, but join its expertise pool", () => {
		expect(shapeOf(boonOfSkill)).toMatchObject({ skills: null, expertise: 1, fixedSkills: ['athletics', 'stealth', 'perception'] })
	})

	it("featProficiencyChoiceShape: Crafter's 3 tools come only from its own 8 artisan's tools; a fixed tool (Chef) asks for nothing", () => {
		const crafterFrom = ["carpenter's tools", "leatherworker's tools", "mason's tools", "potter's tools", "smith's tools", "tinker's tools", "weaver's tools", "woodcarver's tools"]
		const crafter: FeatEffectEntry = { name: 'Crafter', source: 'XPHB', toolProficiencies: [{ choose: { from: crafterFrom, count: 3 } }] }
		expect(shapeOf(crafter).tools).toEqual({ count: 3, categories: ['anyArtisansTool'], only: crafterFrom })
		const chef = { name: 'Chef', source: 'XPHB', toolProficiencies: [{ "cook's utensils": true }] } as unknown as FeatEffectEntry
		expect(shapeOf(chef).tools).toBeNull()
	})
})

describe('proseFeatEffectNotes', () => {
	it('flags Alert on initiative', () => {
		const character = withChoices(base, [{ level: 4, kind: 'feat', name: 'Alert', source: 'XPHB' }])
		const notes = proseFeatEffectNotes('initiative', character, [])
		expect(notes).toHaveLength(1)
		expect(notes[0]).toEqual({ source: 'feat (Alert)', amount: 0, note: expect.stringContaining('D55') })
	})

	it('is empty for a character without Alert', () => {
		const character = withChoices(base, [{ level: 4, kind: 'feat', name: 'Actor', source: 'XPHB' }])
		expect(proseFeatEffectNotes('initiative', character, [])).toEqual([])
	})
})

describe('the background origin feat (D156)', () => {
	const criminal = { name: 'Criminal', source: 'XPHB' }
	const alert: FeatEffectEntry = { name: 'Alert', source: 'XPHB', grantedByBackgrounds: [criminal] }
	const withBackground: Character = {
		...base,
		background: { name: 'Criminal', source: 'XPHB', skillProficiencies: ['sleightOfHand', 'stealth'], toolProficiency: "Thieves' Tools" },
	}

	it('is derived from the background alone, with nothing stored', () => {
		expect(backgroundOriginFeatAmong([alert], withBackground)).toEqual({ name: 'Alert', source: 'XPHB' })
		expect(characterFeats(withBackground, [alert])).toEqual([{ key: 'background', origin: 'background', name: 'Alert', source: 'XPHB' }])
		expect(proseFeatEffectNotes('initiative', withBackground, [alert])).toEqual([{ source: 'feat (Alert)', amount: 0, note: expect.stringContaining('D55') }])
	})

	it("applies the stored entry's sub-choices when it names the background's feat", () => {
		const athleteBackground: FeatEffectEntry = { ...athlete, grantedByBackgrounds: [criminal] }
		const character: Character = { ...withBackground, grantedFeats: [{ origin: 'background', name: 'Athlete', source: 'XPHB', chosenAbility: 'dexterity' }] }
		expect(featAbilityScoreContributions('dexterity', character, [athleteBackground])).toEqual([{ source: 'feat (Athlete)', amount: 1 }])
	})

	it('ignores a stored background entry naming a different feat', () => {
		const athleteBackground: FeatEffectEntry = { ...athlete, grantedByBackgrounds: [criminal] }
		const character: Character = { ...withBackground, grantedFeats: [{ origin: 'background', name: 'Resilient', source: 'XPHB', chosenAbility: 'dexterity' }] }
		expect(characterFeats(character, [athleteBackground, resilient])).toEqual([{ key: 'background', origin: 'background', name: 'Athlete', source: 'XPHB' }])
		expect(featAbilityScoreContributions('dexterity', character, [athleteBackground, resilient])).toEqual([])
		expect(featSavingThrowProficiencyNames('dexterity', character, [athleteBackground, resilient])).toEqual([])
	})

	it('puts the background feat before the ASI levels', () => {
		const character = withChoices(withBackground, [{ level: 4, kind: 'feat', name: 'Actor', source: 'XPHB' }])
		expect(characterFeats(character, [alert, actor]).map((instance) => instance.key)).toEqual(['background', 'asi:4'])
	})
})
