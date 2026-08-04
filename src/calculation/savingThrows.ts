/*
 * Saving throws (build order step 4/4a): ability modifier plus proficiency
 * bonus for the abilities a character's class(es), or a feat (Resilient),
 * grant proficiency in. D11 — iterate the classes array. D44 — a class and
 * a feat granting the SAME save's proficiency still counts once, with both
 * sources named in the breakdown.
 */

import { ABILITIES, type Ability } from '../abilities/abilityScores'
import type { Character, CharacterClass } from '../storage/character'
import { ABILITY_ABBREVIATIONS, type AbilityAbbreviation } from './abilityAbbreviations'
import { computeAbilityScore } from './abilityScores'
import { featSavingThrowProficiencyNames, type FeatEffectEntry } from './featEffects'
import { computeProficiencyBonus } from './proficiencyBonus'
import { type Calculated, type Contribution, known, unknown } from './types'

/** The subset of a classes.json entry a saving throw calculation needs: which abilities it grants save proficiency in. */
export interface ClassSavingThrowProficiencies {
	className: string
	classSource: string
	abilities: AbilityAbbreviation[]
}

function findClassProficiencies(
	characterClass: CharacterClass,
	classData: ClassSavingThrowProficiencies[],
): ClassSavingThrowProficiencies | undefined {
	return classData.find((c) => c.className === characterClass.className && c.classSource === characterClass.classSource)
}

export function computeSavingThrow(
	ability: Ability,
	character: Character,
	classData: ClassSavingThrowProficiencies[],
	feats: FeatEffectEntry[] = [],
): Calculated<number> {
	const abilityResult = computeAbilityScore(ability, character, feats)
	if (abilityResult.status === 'unknown') return unknown(abilityResult.reason)

	if (character.classes.length === 0) {
		return unknown('Character has no classes yet.')
	}

	const abbreviation = ABILITY_ABBREVIATIONS[ability]
	const grantingSources: string[] = []
	for (const characterClass of character.classes) {
		const proficiencies = findClassProficiencies(characterClass, classData)
		if (!proficiencies) {
			return unknown(`No saving throw data for class "${characterClass.className}" (${characterClass.classSource}).`)
		}
		if (proficiencies.abilities.includes(abbreviation)) {
			grantingSources.push(characterClass.className)
		}
	}
	grantingSources.push(...featSavingThrowProficiencyNames(ability, character, feats).map((name) => `feat (${name})`))

	const breakdown: Contribution[] = [{ source: `${ability} modifier`, amount: abilityResult.value.modifier }]

	if (grantingSources.length > 0) {
		const bonusResult = computeProficiencyBonus(character.classes)
		if (bonusResult.status === 'unknown') return unknown(bonusResult.reason)
		breakdown.push({ source: `proficiency (${grantingSources.join(', ')})`, amount: bonusResult.value })
	}

	const total = breakdown.reduce((sum, contribution) => sum + contribution.amount, 0)
	return known(total, breakdown)
}

export function computeSavingThrows(
	character: Character,
	classData: ClassSavingThrowProficiencies[],
	feats: FeatEffectEntry[] = [],
): Record<Ability, Calculated<number>> {
	return Object.fromEntries(ABILITIES.map((ability) => [ability, computeSavingThrow(ability, character, classData, feats)])) as Record<
		Ability,
		Calculated<number>
	>
}
