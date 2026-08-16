/*
 * Spell attack bonus and spell save DC (build order step 6a, closing D47's
 * deferral of spell DC out of step 4). D11 — a character can have more than
 * one casting class with different spellcasting abilities (e.g. Wizard INT
 * + Cleric WIS), so this returns one entry per casting class in
 * character.classes, never a single blended value. A class with no
 * `spellcastingAbility` in the supplied data (Barbarian, Fighter, Monk,
 * Rogue) contributes no entry — not an error, not a zero (scripts/investigate-spells.js
 * confirms which of the 13 base classes carry the field).
 *
 * D46 — Eldritch Knight and Arcane Trickster ("1/3" casters) keep their
 * spellcastingAbility on the SUBCLASS entry (classes.json), not the base
 * class (Fighter/Rogue have none of their own) — same fallback pattern
 * spellSlots.ts already uses for these two subclasses' slot tables. Path of
 * the Ancestral Guardian (Barbarian) also carries its own spellcastingAbility
 * but has no spell-slot table, so it is excluded from this fallback (nothing
 * to cast means no attack bonus/DC) — scripts/investigate-subclass-spellcasting-ability.js.
 */

import type { Ability } from '../abilities/abilityScores'
import type { FeatGrantedSpell } from '../spells/featSpells'
import type { Character, CharacterClass } from '../storage/character'
import { ABILITY_ABBREVIATIONS, type AbilityAbbreviation } from './abilityAbbreviations'
import { computeAbilityScore } from './abilityScores'
import type { FeatEffectEntry } from './featEffects'
import { computeProficiencyBonus } from './proficiencyBonus'
import { type Calculated, type Contribution, known, unknown } from './types'

const ABILITY_BY_ABBREVIATION: Record<AbilityAbbreviation, Ability> = Object.fromEntries(
	(Object.entries(ABILITY_ABBREVIATIONS) as [Ability, AbilityAbbreviation][]).map(([ability, abbreviation]) => [abbreviation, ability]),
) as Record<AbilityAbbreviation, Ability>

/** D46: a subclass that keeps its own spellcastingAbility (Eldritch Knight, Arcane Trickster) — mirrors spellSlots.ts's SubclassSpellSlotsData, same subclass set (a caster subclass, i.e. one that also has its own slot table). */
export interface SubclassSpellcastingAbility {
	subclassName: string
	ability: AbilityAbbreviation
}

/** The subset of a classes.json entry this calculation needs: its spellcasting ability, or null for a non-caster class. */
export interface ClassSpellcastingAbility {
	className: string
	classSource: string
	ability: AbilityAbbreviation | null
	/** D46: only present for a subclass that keeps its own spellcastingAbility AND its own spell slots (Eldritch Knight/Arcane Trickster) — checked only when the base class itself has no ability. */
	subclasses?: SubclassSpellcastingAbility[]
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

/** D46: only consulted when the base class itself has no ability — Eldritch Knight/Arcane Trickster's ability lives here instead. */
function findSubclassSpellcastingAbility(
	characterClass: CharacterClass,
	classEntry: ClassSpellcastingAbility,
): SubclassSpellcastingAbility | undefined {
	if (!characterClass.subclass) return undefined
	return classEntry.subclasses?.find((s) => s.subclassName === characterClass.subclass)
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

		// D46: the base class (Fighter/Rogue) carries no ability of its own for a "1/3" caster — check the chosen subclass before giving up.
		let abilityAbbreviation = classEntry.ability
		if (abilityAbbreviation === null) {
			const subclassEntry = findSubclassSpellcastingAbility(characterClass, classEntry)
			if (subclassEntry) abilityAbbreviation = subclassEntry.ability
		}
		if (abilityAbbreviation === null) continue

		const ability = ABILITY_BY_ABBREVIATION[abilityAbbreviation]
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

export interface FeatSpellcastingEntry {
	featName: string
	ability: Ability
	spellAttackBonus: number
	spellAttackBreakdown: Contribution[]
	spellSaveDC: number
	spellSaveDCBreakdown: Contribution[]
}

/**
 * Step 6 follow-up: the same attack bonus/DC computation as computeSpellcasting,
 * per FEAT rather than per class (D11's "one entry per source" pattern applied
 * to a feat source) — a Fighter with Magic Initiate has no casting class at
 * all, so its attack/DC can't live on a class entry. `featGrantedSpells`
 * already carries each spell's resolved ability (featSpells.ts) — read here,
 * never re-derived. If any feat's ability is unresolved (a chosen-ability feat
 * with no chosenAbility recorded yet), the whole result is 'unknown' (D43),
 * matching computeSpellcasting's own abort-on-missing-data behaviour.
 */
export function computeFeatSpellcasting(
	character: Character,
	featGrantedSpells: FeatGrantedSpell[],
	feats: FeatEffectEntry[] = [],
): Calculated<FeatSpellcastingEntry[]> {
	if (featGrantedSpells.length === 0) {
		return known([], [])
	}

	const bonusResult = computeProficiencyBonus(character.classes)
	if (bonusResult.status === 'unknown') return unknown(bonusResult.reason)

	const featNames = [...new Set(featGrantedSpells.map((spell) => spell.featName))]
	const value: FeatSpellcastingEntry[] = []
	const breakdown: Contribution[] = []

	for (const featName of featNames) {
		const abilityAbbreviation = featGrantedSpells.find((spell) => spell.featName === featName)?.ability
		if (!abilityAbbreviation) {
			return unknown(`Feat "${featName}" grants a spell but its spellcasting ability has not been chosen yet.`)
		}

		const ability = ABILITY_BY_ABBREVIATION[abilityAbbreviation]
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

		value.push({ featName, ability, spellAttackBonus, spellAttackBreakdown, spellSaveDC, spellSaveDCBreakdown })
		breakdown.push({ source: featName, amount: spellAttackBonus })
	}

	return known(value, breakdown)
}
