import { describe, expect, it } from 'vitest'
import type { Character } from '../storage/character'
import {
	featAbilityScoreContributions,
	featFixedSkillProficiencyNames,
	featSavingThrowProficiencyNames,
	featSkillChoiceAwaitingNotes,
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

describe('proseFeatEffectNotes', () => {
	it('flags Alert on initiative', () => {
		const character = withChoices(base, [{ level: 4, kind: 'feat', name: 'Alert', source: 'XPHB' }])
		const notes = proseFeatEffectNotes('initiative', character)
		expect(notes).toHaveLength(1)
		expect(notes[0]).toEqual({ source: 'feat (Alert)', amount: 0, note: expect.stringContaining('D55') })
	})

	it('is empty for a character without Alert', () => {
		const character = withChoices(base, [{ level: 4, kind: 'feat', name: 'Actor', source: 'XPHB' }])
		expect(proseFeatEffectNotes('initiative', character)).toEqual([])
	})
})
