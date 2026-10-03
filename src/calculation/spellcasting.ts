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
import type { ItemAbilityGrant } from './itemAbilityScores'
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

/*
 * Slice h: `bonusSpellAttack` and `bonusSpellSaveDc` from a worn magic item.
 * They apply to EVERY entry alike. Many of the 30 carriers word the bonus for
 * one class's spells ("your artificer spells"), but that restriction lives in
 * the item's prose and nowhere in a field, so reading it would mean parsing
 * prose (D21). The bonus is shown as its own named line, so a player whose item
 * is class-specific can see exactly what to ignore.
 */
export function computeSpellcasting(
	character: Character,
	classData: ClassSpellcastingAbility[],
	feats: FeatEffectEntry[] = [],
	spellAttackItemBonuses: Contribution[] = [],
	spellSaveDcItemBonuses: Contribution[] = [],
	itemAbilityGrants: readonly ItemAbilityGrant[] = [],
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

		const numbers = computeAbilitySpellcasting(character, ABILITY_BY_ABBREVIATION[abilityAbbreviation], feats, spellAttackItemBonuses, spellSaveDcItemBonuses, itemAbilityGrants)
		if (numbers.status === 'unknown') return numbers

		value.push({ className: characterClass.className, classSource: characterClass.classSource, ...numbers.value })
		breakdown.push({ source: characterClass.className, amount: numbers.value.spellAttackBonus })
	}

	return known(value, breakdown)
}

export interface FeatSpellcastingEntry {
	featName: string
	/** A2-1: the feat instance (featInstances.ts key), or the feat name for a spell that carries none. Two Magic Initiates are two entries. */
	featKey: string
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
 * never re-derived. D204: a feat whose ability is unresolved (no chosenAbility
 * recorded yet) is skipped, like computeSpeciesSpellcasting's unresolved
 * species; its spells carry the reason (featSpells.ts), the other feats keep
 * their numbers.
 */
export function computeFeatSpellcasting(
	character: Character,
	featGrantedSpells: FeatGrantedSpell[],
	feats: FeatEffectEntry[] = [],
	spellAttackItemBonuses: Contribution[] = [],
	spellSaveDcItemBonuses: Contribution[] = [],
	itemAbilityGrants: readonly ItemAbilityGrant[] = [],
): Calculated<FeatSpellcastingEntry[]> {
	if (featGrantedSpells.length === 0) {
		return known([], [])
	}

	const bonusResult = computeProficiencyBonus(character.classes)
	if (bonusResult.status === 'unknown') return unknown(bonusResult.reason)

	const featKeys = [...new Set(featGrantedSpells.map(featKeyOf))]
	const value: FeatSpellcastingEntry[] = []
	const breakdown: Contribution[] = []

	for (const featKey of featKeys) {
		const first = featGrantedSpells.find((spell) => spell.ability && featKeyOf(spell) === featKey)
		if (!first?.ability) continue

		const numbers = computeAbilitySpellcasting(character, ABILITY_BY_ABBREVIATION[first.ability], feats, spellAttackItemBonuses, spellSaveDcItemBonuses, itemAbilityGrants)
		if (numbers.status === 'unknown') return numbers

		value.push({ featName: first.featName, featKey, ...numbers.value })
		breakdown.push({ source: first.featName, amount: numbers.value.spellAttackBonus })
	}

	return known(value, breakdown)
}

/** A2-1: which feat instance a granted spell belongs to — the spell's own instance key, else its feat name. */
export function featKeyOf(spell: { featName: string; featInstance?: string }): string {
	return spell.featInstance ?? spell.featName
}

/** A9: the one attack bonus / save DC computation every spellcasting source (class, feat, species, item) goes through. */
export function computeAbilitySpellcasting(
	character: Character,
	ability: Ability,
	feats: FeatEffectEntry[] = [],
	spellAttackItemBonuses: Contribution[] = [],
	spellSaveDcItemBonuses: Contribution[] = [],
	itemAbilityGrants: readonly ItemAbilityGrant[] = [],
): Calculated<Omit<FeatSpellcastingEntry, 'featName' | 'featKey'>> {
	const bonusResult = computeProficiencyBonus(character.classes)
	if (bonusResult.status === 'unknown') return unknown(bonusResult.reason)
	const abilityResult = computeAbilityScore(ability, character, feats, itemAbilityGrants)
	if (abilityResult.status === 'unknown') return unknown(abilityResult.reason)
	const spellAttackBreakdown: Contribution[] = [
		{ source: `${ability} modifier`, amount: abilityResult.value.modifier },
		{ source: 'proficiency bonus', amount: bonusResult.value },
		...spellAttackItemBonuses,
	]
	const spellSaveDCBreakdown: Contribution[] = [
		{ source: 'base', amount: 8 },
		{ source: `${ability} modifier`, amount: abilityResult.value.modifier },
		{ source: 'proficiency bonus', amount: bonusResult.value },
		...spellSaveDcItemBonuses,
	]
	const sum = (breakdown: Contribution[]) => breakdown.reduce((total, contribution) => total + contribution.amount, 0)
	const value = { ability, spellAttackBonus: sum(spellAttackBreakdown), spellAttackBreakdown, spellSaveDC: sum(spellSaveDCBreakdown), spellSaveDCBreakdown }
	return known(value, [{ source: ability, amount: value.spellAttackBonus }])
}

export interface SpeciesSpellcastingEntry {
	speciesName: string
	ability: Ability
	spellAttackBonus: number
	spellAttackBreakdown: Contribution[]
	spellSaveDC: number
	spellSaveDCBreakdown: Contribution[]
}

/**
 * The same attack bonus/DC computation again, per SPECIES (raceSpells.ts) —
 * D11's "one entry per source" pattern applied to a third kind of source, for
 * the same reason the feat one exists: a species grant is cast with the
 * species' own ability, which need not be any casting class's.
 *
 * One deliberate difference from computeFeatSpellcasting: a species whose
 * `ability` is still the unresolved `{choose:[…]}` shape (33 of the 34 entries
 * — see raceSpells.ts) is SKIPPED rather than turning the whole result
 * 'unknown'. The spell itself still reaches the sheet carrying
 * `unresolvedAbilityReason`, so the gap is stated where the player sees the
 * spell (D58) instead of blanking the Spellcasting section for everyone. This
 * only matters for a choose-ability species with no recorded pick yet (an old
 * save, or the wizard's gate somehow bypassed) — raceSpells.ts now resolves
 * `ability` from `Character.speciesSpellcastingAbility` (D89 follow-up) the
 * same way it always resolved Aasimar's fixed "cha".
 */
export function computeSpeciesSpellcasting(
	character: Character,
	raceGrantedSpells: { speciesName: string; ability?: AbilityAbbreviation }[],
	feats: FeatEffectEntry[] = [],
	spellAttackItemBonuses: Contribution[] = [],
	spellSaveDcItemBonuses: Contribution[] = [],
	itemAbilityGrants: readonly ItemAbilityGrant[] = [],
): Calculated<SpeciesSpellcastingEntry[]> {
	const resolved = raceGrantedSpells.filter((spell) => spell.ability !== undefined)
	if (resolved.length === 0) {
		return known([], [])
	}

	const speciesNames = [...new Set(resolved.map((spell) => spell.speciesName))]
	const value: SpeciesSpellcastingEntry[] = []
	const breakdown: Contribution[] = []

	for (const speciesName of speciesNames) {
		const abilityAbbreviation = resolved.find((spell) => spell.speciesName === speciesName)!.ability!
		const numbers = computeAbilitySpellcasting(character, ABILITY_BY_ABBREVIATION[abilityAbbreviation], feats, spellAttackItemBonuses, spellSaveDcItemBonuses, itemAbilityGrants)
		if (numbers.status === 'unknown') return numbers

		value.push({ speciesName, ...numbers.value })
		breakdown.push({ source: speciesName, amount: numbers.value.spellAttackBonus })
	}

	return known(value, breakdown)
}
