/*
 * Skills and passive values (build order step 4, D48 — passive values live
 * in the same file as skills since both are 10 + a skill's bonus).
 *
 * D45 — a skill's result carries a STATUS (none/half/proficient/expertise),
 * not just a number; half is Jack of All Trades (Bard) and only applies
 * where the character has no other proficiency source, never alongside
 * expertise. D44 — when more than one source (class/background/species)
 * grants the same skill, proficiency is counted once but every source is
 * named in the breakdown, mirroring how savingThrows.ts already joins
 * multiple granting classes into one contribution.
 */

import type { Ability } from '../abilities/abilityScores'
import { ALL_SKILLS } from '../classSkills/classSkillData'
import type { Character } from '../storage/character'
import { computeAbilityScore } from './abilityScores'
import { computeProficiencyBonus } from './proficiencyBonus'
import { type Calculated, type Contribution, known, unknown } from './types'

/** Re-exported from classSkillData.ts (D45 needs the same 18 names the class-skill picker already uses) rather than duplicated. */
export const SKILLS = ALL_SKILLS

export type Skill = (typeof SKILLS)[number]

export const SKILL_ABILITIES: Record<Skill, Ability> = {
	acrobatics: 'dexterity',
	'animal handling': 'wisdom',
	arcana: 'intelligence',
	athletics: 'strength',
	deception: 'charisma',
	history: 'intelligence',
	insight: 'wisdom',
	intimidation: 'charisma',
	investigation: 'intelligence',
	medicine: 'wisdom',
	nature: 'intelligence',
	perception: 'wisdom',
	performance: 'charisma',
	persuasion: 'charisma',
	religion: 'intelligence',
	'sleight of hand': 'dexterity',
	stealth: 'dexterity',
	survival: 'wisdom',
}

/** D45 — must tolerate a further status being added later; not a boolean. */
export type SkillProficiencyStatus = 'none' | 'half' | 'proficient' | 'expertise'

export interface SkillValue {
	status: SkillProficiencyStatus
	modifier: number
}

/**
 * Jack of All Trades (scripts/investigate-calc-slice2.js: exactly one
 * class-features.json entry by this name, Bard/XPHB, granted at level 2).
 * Hardcoded rather than read from class-features.json, matching how
 * src/expertise/expertiseData.ts already hardcodes per-feature skill counts
 * pulled from prose — the granting level is the only fact needed here.
 */
const JACK_OF_ALL_TRADES = { className: 'Bard', classSource: 'XPHB', level: 2 } as const

function hasJackOfAllTrades(character: Character): boolean {
	return character.classes.some(
		(c) => c.className === JACK_OF_ALL_TRADES.className && c.classSource === JACK_OF_ALL_TRADES.classSource && c.level >= JACK_OF_ALL_TRADES.level,
	)
}

/** The proficiency sources (D44) that grant a given skill, in a fixed display order. */
function proficiencySources(skill: Skill, character: Character): string[] {
	const sources: string[] = []
	if (character.classSkills?.includes(skill)) sources.push('class')
	if (character.background?.skillProficiencies.includes(skill)) sources.push('background')
	if (character.speciesSkills?.includes(skill)) sources.push('species')
	return sources
}

export function computeSkill(skill: Skill, character: Character): Calculated<SkillValue> {
	const ability = SKILL_ABILITIES[skill]
	const abilityResult = computeAbilityScore(ability, character)
	if (abilityResult.status === 'unknown') return unknown(abilityResult.reason)

	const sources = proficiencySources(skill, character)
	const status: SkillProficiencyStatus =
		sources.length > 0 ? (character.expertiseSkills?.includes(skill) ? 'expertise' : 'proficient') : hasJackOfAllTrades(character) ? 'half' : 'none'

	const breakdown: Contribution[] = [{ source: `${ability} modifier`, amount: abilityResult.value.modifier }]

	if (status !== 'none') {
		const bonusResult = computeProficiencyBonus(character.classes)
		if (bonusResult.status === 'unknown') return unknown(bonusResult.reason)

		if (status === 'half') {
			breakdown.push({ source: 'half proficiency (Jack of All Trades)', amount: Math.floor(bonusResult.value / 2) })
		} else if (status === 'expertise') {
			breakdown.push({ source: `expertise (${sources.join(', ')})`, amount: bonusResult.value * 2 })
		} else {
			breakdown.push({ source: `proficiency (${sources.join(', ')})`, amount: bonusResult.value })
		}
	}

	const modifier = breakdown.reduce((sum, contribution) => sum + contribution.amount, 0)
	return known({ status, modifier }, breakdown)
}

export function computeSkills(character: Character): Record<Skill, Calculated<SkillValue>> {
	return Object.fromEntries(SKILLS.map((skill) => [skill, computeSkill(skill, character)])) as Record<Skill, Calculated<SkillValue>>
}

/** D48 — 10 + the named skill's bonus. Not a real skill check, so it has no proficiency status of its own. */
function computePassiveValue(skill: Skill, character: Character): Calculated<number> {
	const skillResult = computeSkill(skill, character)
	if (skillResult.status === 'unknown') return unknown(skillResult.reason)

	const breakdown: Contribution[] = [{ source: 'base', amount: 10 }, ...skillResult.breakdown]
	const total = breakdown.reduce((sum, contribution) => sum + contribution.amount, 0)
	return known(total, breakdown)
}

export function computePassivePerception(character: Character): Calculated<number> {
	return computePassiveValue('perception', character)
}

export function computePassiveInvestigation(character: Character): Calculated<number> {
	return computePassiveValue('investigation', character)
}

export function computePassiveInsight(character: Character): Calculated<number> {
	return computePassiveValue('insight', character)
}
