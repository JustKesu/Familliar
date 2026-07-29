/*
 * Saving throws (build order step 4): ability modifier plus proficiency
 * bonus for the abilities a character's class(es) grant proficiency in.
 * D11 — iterate the classes array; feats/ASI (Resilient etc.) don't touch
 * saves yet, that's build order step 4a.
 */

import { ABILITIES, type Ability } from '../abilities/abilityScores'
import type { Character, CharacterClass } from '../storage/character'
import { ABILITY_ABBREVIATIONS, type AbilityAbbreviation } from './abilityAbbreviations'
import { computeAbilityScore } from './abilityScores'
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

export function computeSavingThrow(ability: Ability, character: Character, classData: ClassSavingThrowProficiencies[]): Calculated<number> {
	const abilityResult = computeAbilityScore(ability, character)
	if (abilityResult.status === 'unknown') return unknown(abilityResult.reason)

	if (character.classes.length === 0) {
		return unknown('Character has no classes yet.')
	}

	const abbreviation = ABILITY_ABBREVIATIONS[ability]
	const grantingClasses: string[] = []
	for (const characterClass of character.classes) {
		const proficiencies = findClassProficiencies(characterClass, classData)
		if (!proficiencies) {
			return unknown(`No saving throw data for class "${characterClass.className}" (${characterClass.classSource}).`)
		}
		if (proficiencies.abilities.includes(abbreviation)) {
			grantingClasses.push(characterClass.className)
		}
	}

	const breakdown: Contribution[] = [{ source: `${ability} modifier`, amount: abilityResult.value.modifier }]

	if (grantingClasses.length > 0) {
		const bonusResult = computeProficiencyBonus(character.classes)
		if (bonusResult.status === 'unknown') return unknown(bonusResult.reason)
		breakdown.push({ source: `proficiency (${grantingClasses.join(', ')})`, amount: bonusResult.value })
	}

	const total = breakdown.reduce((sum, contribution) => sum + contribution.amount, 0)
	return known(total, breakdown)
}

export function computeSavingThrows(character: Character, classData: ClassSavingThrowProficiencies[]): Record<Ability, Calculated<number>> {
	return Object.fromEntries(ABILITIES.map((ability) => [ability, computeSavingThrow(ability, character, classData)])) as Record<
		Ability,
		Calculated<number>
	>
}
