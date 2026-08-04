/*
 * Spell attack bonus and spell save DC (build order step 6a, closing D47's
 * deferral of spell DC out of step 4). D11 — a character can have more than
 * one casting class with different spellcasting abilities (e.g. Wizard INT
 * + Cleric WIS), so this returns one entry per casting class in
 * character.classes, never a single blended value. A class with no
 * `spellcastingAbility` in the supplied data (Barbarian, Fighter, Monk,
 * Rogue) contributes no entry — not an error, not a zero (scripts/investigate-spells.js
 * confirms which of the 13 base classes carry the field).
 */

import type { Ability } from '../abilities/abilityScores'
import type { Character, CharacterClass } from '../storage/character'
import { ABILITY_ABBREVIATIONS, type AbilityAbbreviation } from './abilityAbbreviations'
import { computeAbilityScore } from './abilityScores'
import type { FeatEffectEntry } from './featEffects'
import { computeProficiencyBonus } from './proficiencyBonus'
import { type Calculated, type Contribution, known, unknown } from './types'

const ABILITY_BY_ABBREVIATION: Record<AbilityAbbreviation, Ability> = Object.fromEntries(
	(Object.entries(ABILITY_ABBREVIATIONS) as [Ability, AbilityAbbreviation][]).map(([ability, abbreviation]) => [abbreviation, ability]),
) as Record<AbilityAbbreviation, Ability>

/** The subset of a classes.json entry this calculation needs: its spellcasting ability, or null for a non-caster class. */
export interface ClassSpellcastingAbility {
	className: string
	classSource: string
	ability: AbilityAbbreviation | null
}

export interface SpellcastingEntry {
	className: string
	classSource: string
	ability: Ability
	spellAttackBonus: number
	spellAttackBreakdown: Contribution[]
	spellSaveDC: number
	spellSaveDCBreakdown: Contribution[]
}

function findClassSpellcastingAbility(
	characterClass: CharacterClass,
	classData: ClassSpellcastingAbility[],
): ClassSpellcastingAbility | undefined {
	return classData.find((c) => c.className === characterClass.className && c.classSource === characterClass.classSource)
}

export function computeSpellcasting(
	character: Character,
	classData: ClassSpellcastingAbility[],
	feats: FeatEffectEntry[] = [],
): Calculated<SpellcastingEntry[]> {
	if (character.classes.length === 0) {
		return unknown('Character has no classes yet.')
	}

	const bonusResult = computeProficiencyBonus(character.classes)
	if (bonusResult.status === 'unknown') return unknown(bonusResult.reason)

	const value: SpellcastingEntry[] = []
	const breakdown: Contribution[] = []

	for (const characterClass of character.classes) {
		const classEntry = findClassSpellcastingAbility(characterClass, classData)
		if (!classEntry) {
			return unknown(`No spellcasting data for class "${characterClass.className}" (${characterClass.classSource}).`)
		}
		if (classEntry.ability === null) continue

		const ability = ABILITY_BY_ABBREVIATION[classEntry.ability]
		const abilityResult = computeAbilityScore(ability, character, feats)
		if (abilityResult.status === 'unknown') return unknown(abilityResult.reason)

		const spellAttackBreakdown: Contribution[] = [
			{ source: `${ability} modifier`, amount: abilityResult.value.modifier },
			{ source: 'proficiency bonus', amount: bonusResult.value },
		]
		const spellAttackBonus = spellAttackBreakdown.reduce((sum, contribution) => sum + contribution.amount, 0)

		const spellSaveDCBreakdown: Contribution[] = [
			{ source: 'base', amount: 8 },
			{ source: `${ability} modifier`, amount: abilityResult.value.modifier },
			{ source: 'proficiency bonus', amount: bonusResult.value },
		]
		const spellSaveDC = spellSaveDCBreakdown.reduce((sum, contribution) => sum + contribution.amount, 0)

		value.push({
			className: characterClass.className,
			classSource: characterClass.classSource,
			ability,
			spellAttackBonus,
			spellAttackBreakdown,
			spellSaveDC,
			spellSaveDCBreakdown,
		})
		breakdown.push({ source: characterClass.className, amount: spellAttackBonus })
	}

	return known(value, breakdown)
}
