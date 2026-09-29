/*
 * Saving throws (build order step 4/4a): ability modifier plus proficiency
 * bonus for the abilities a character's class(es), or a feat (Resilient),
 * grant proficiency in. D11 — iterate the classes array. D44 — a class and
 * a feat granting the SAME save's proficiency still counts once, with both
 * sources named in the breakdown.
 *
 * The result carries a STATUS (D45's pattern, applied here too — see
 * skills.ts) rather than leaving the sheet to infer proficiency from the
 * breakdown's shape: a breakdown can grow a zero-amount note (D55/D58 style)
 * for reasons unrelated to proficiency, and a length check would misread
 * that as a proficiency mark.
 */

import { ABILITIES, type Ability } from '../abilities/abilityScores'
import type { Character, CharacterClass } from '../storage/character'
import { ABILITY_ABBREVIATIONS, type AbilityAbbreviation } from './abilityAbbreviations'
import { computeAbilityScore } from './abilityScores'
import { featSavingThrowProficiencyNames, type FeatEffectEntry } from './featEffects'
import type { ItemAbilityGrant } from './itemAbilityScores'
import { itemSaveProficiency, type ItemProficiencyGrant } from './itemProficiencies'
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

// D203: prose only (DATA.md). XPHB class keyed by subclass name, as in subclassSkillGrants.ts.
const SUBCLASS_SAVE_GRANTS: readonly { className: string; subclass: string; level: number; featureName: string; ability: Ability }[] = [
	{ className: 'Cleric', subclass: 'Knowledge Domain', level: 6, featureName: 'Unfettered Mind', ability: 'intelligence' },
]

/** Must tolerate a further status being added later (mirrors skills.ts's SkillProficiencyStatus, D45); not a boolean. */
export type SavingThrowProficiencyStatus = 'none' | 'proficient'

export interface SavingThrowValue {
	status: SavingThrowProficiencyStatus
	modifier: number
}

export function computeSavingThrow(
	ability: Ability,
	character: Character,
	classData: ClassSavingThrowProficiencies[],
	feats: FeatEffectEntry[] = [],
	/** Slice h: `bonusSavingThrow` from a worn magic item (Cloak of Protection). Applies to every save alike — no item in the data limits it to some of them. */
	itemBonuses: Contribution[] = [],
	/** R14b: proficiencies a custom item grants (D217). */
	itemProficiencies: readonly ItemProficiencyGrant[] = [],
	itemAbilityGrants: readonly ItemAbilityGrant[] = [],
): Calculated<SavingThrowValue> {
	const abilityResult = computeAbilityScore(ability, character, feats, itemAbilityGrants)
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
	const fromItems = itemSaveProficiency(itemProficiencies, ability)
	grantingSources.push(...fromItems.sources)

	const subclassGrants = SUBCLASS_SAVE_GRANTS.filter(
		(grant) =>
			grant.ability === ability &&
			character.classes.some((cls) => cls.className === grant.className && cls.classSource === 'XPHB' && cls.subclass === grant.subclass && cls.level >= grant.level),
	)
	// D203: the feature's "choose another save" when this one is already held is not modelled, only stated.
	const redundantNotes: Contribution[] =
		grantingSources.length > 0
			? subclassGrants.map((grant) => ({ source: grant.featureName, amount: 0, note: `already proficient in ${ability[0].toUpperCase()}${ability.slice(1)} saves — choose another save (not tracked)` }))
			: []
	if (grantingSources.length === 0) grantingSources.push(...subclassGrants.map((grant) => `subclass (${grant.subclass})`))

	const status: SavingThrowProficiencyStatus = grantingSources.length > 0 ? 'proficient' : 'none'
	const breakdown: Contribution[] = [{ source: `${ability} modifier`, amount: abilityResult.value.modifier }]

	if (status === 'proficient') {
		const bonusResult = computeProficiencyBonus(character.classes)
		if (bonusResult.status === 'unknown') return unknown(bonusResult.reason)
		breakdown.push({ source: `proficiency (${grantingSources.join(', ')})`, amount: bonusResult.value })
	}
	breakdown.push(...redundantNotes)
	breakdown.push(...fromItems.withheld)
	breakdown.push(...itemBonuses)

	const modifier = breakdown.reduce((sum, contribution) => sum + contribution.amount, 0)
	return known({ status, modifier }, breakdown)
}

export function computeSavingThrows(
	character: Character,
	classData: ClassSavingThrowProficiencies[],
	feats: FeatEffectEntry[] = [],
	itemBonuses: Contribution[] = [],
	/** R14a1: a custom item's bonus to ONE save, stacking with `itemBonuses`. */
	itemBonusesByAbility: Partial<Record<Ability, Contribution[]>> = {},
	itemProficiencies: readonly ItemProficiencyGrant[] = [],
	itemAbilityGrants: readonly ItemAbilityGrant[] = [],
): Record<Ability, Calculated<SavingThrowValue>> {
	return Object.fromEntries(
		ABILITIES.map((ability) => [
			ability,
			computeSavingThrow(ability, character, classData, feats, [...itemBonuses, ...(itemBonusesByAbility[ability] ?? [])], itemProficiencies, itemAbilityGrants),
		]),
	) as Record<
		Ability,
		Calculated<SavingThrowValue>
	>
}
