/*
 * Spell counts (build order step 6 slice d2): how many cantrips, and how
 * many leveled spells, a character may have — not which ones are legal by
 * level (slice d1, spellLevelFilter.ts), not the picker UI.
 *
 * Investigated ahead of writing this (scripts/investigate-spell-counts.js,
 * scripts/investigate-spell-counts-2.js): classes.json's cantripProgression
 * and preparedSpellsProgression are already flat per-CHARACTER-LEVEL arrays
 * (index 0 = level 1) with no ability-modifier assumption baked in or
 * needed — the 2024 rules replaced the 2014 "ability modifier + level"
 * formula with an explicit number per level in the class table itself.
 * Confirmed by reading Cleric's full preparedSpellsProgression array: it
 * does not reduce to `level + a constant WIS modifier`, it already accounts
 * for the standard levels a character would improve that modifier. So
 * NEITHER count needs computeAbilityScore's final ability score — the task
 * brief's assumption ("Cleric = WIS modifier + level") does not hold against
 * the actual XPHB data; the count is read structurally, per the task
 * instructions' own fallback rule.
 *
 * `preparedSpellsChange` doubles as the known-vs-prepared LABEL (task:
 * "difference is a LABEL only") — 'restLong' classes (Cleric, Druid,
 * Paladin, Ranger, Artificer, Wizard) can change their pick every long rest
 * ("prepared"); 'level' classes (Bard, Sorcerer, Warlock, and Eldritch
 * Knight/Arcane Trickster) only change on level-up ("known"). Both values
 * map onto the same one picker (no separate mechanics, per the task).
 *
 * D46: Eldritch Knight/Arcane Trickster carry their own cantripProgression/
 * preparedSpellsProgression/preparedSpellsChange directly on the SUBCLASS
 * entry (mirrors spellSlots.ts's D46 fallback exactly — same shape, just a
 * second location to check when the base class itself has none).
 */

import type { Character, CharacterClass } from '../storage/character'
import { type Calculated, type Contribution, known, unknown } from './types'

export type SpellCountLabel = 'known' | 'prepared'

/** One subclass's own cantrip/leveled-spell counts (D46) — present only for a subclass that keeps its own, e.g. Eldritch Knight/Arcane Trickster. */
export interface SubclassSpellCountData {
	subclassName: string
	cantripProgression: number[] | null
	leveledSpellProgression: number[] | null
	label: SpellCountLabel | null
}

/** The subset of a classes.json entry this needs. A non-caster base class has `label: null` and no arrays. `subclasses` (D46) is only consulted when the base class itself has `label: null`. */
export interface ClassSpellCountData {
	className: string
	classSource: string
	/** Cantrips known/prepared by character level (index 0 = level 1); null for a class that never gets cantrips (Paladin, Ranger). */
	cantripProgression: number[] | null
	/** Leveled spells known/prepared by character level (index 0 = level 1); null alongside `label: null` for a non-caster. */
	leveledSpellProgression: number[] | null
	label: SpellCountLabel | null
	subclasses?: SubclassSpellCountData[]
}

export interface SpellCountEntry {
	className: string
	classSource: string
	label: SpellCountLabel
	cantripCount: number
	leveledSpellCount: number
}

function findClassSpellCountData(characterClass: CharacterClass, classData: ClassSpellCountData[]): ClassSpellCountData | undefined {
	return classData.find((c) => c.className === characterClass.className && c.classSource === characterClass.classSource)
}

/** D46: only consulted when the base class itself has `label: null` — Eldritch Knight/Arcane Trickster's counts live here instead. */
function findSubclassSpellCountData(characterClass: CharacterClass, classEntry: ClassSpellCountData): SubclassSpellCountData | undefined {
	if (!characterClass.subclass) return undefined
	return classEntry.subclasses?.find((s) => s.subclassName === characterClass.subclass)
}

export function computeSpellCounts(character: Character, classData: ClassSpellCountData[]): Calculated<SpellCountEntry[]> {
	if (character.classes.length === 0) {
		return unknown('Character has no classes yet.')
	}

	const value: SpellCountEntry[] = []
	const breakdown: Contribution[] = []

	// D11: multiclass combining is step 10 — each class's counts are returned un-combined, same as spellSlots.ts.
	for (const characterClass of character.classes) {
		const classEntry = findClassSpellCountData(characterClass, classData)
		if (!classEntry) {
			return unknown(`No spell count data for class "${characterClass.className}" (${characterClass.classSource}).`)
		}

		let label = classEntry.label
		let cantripProgression = classEntry.cantripProgression
		let leveledSpellProgression = classEntry.leveledSpellProgression
		// D46: the base class (Fighter/Rogue) carries no counts of its own for a "1/3" caster — check the chosen subclass before giving up.
		if (label === null) {
			const subclassEntry = findSubclassSpellCountData(characterClass, classEntry)
			if (subclassEntry) {
				label = subclassEntry.label
				cantripProgression = subclassEntry.cantripProgression
				leveledSpellProgression = subclassEntry.leveledSpellProgression
			}
		}
		if (label === null) continue

		const levelIndex = characterClass.level - 1
		const cantripCount = cantripProgression?.[levelIndex] ?? 0
		const leveledSpellCount = leveledSpellProgression?.[levelIndex] ?? 0

		value.push({
			className: characterClass.className,
			classSource: characterClass.classSource,
			label,
			cantripCount,
			leveledSpellCount,
		})
		breakdown.push({ source: characterClass.className, amount: cantripCount + leveledSpellCount })
	}

	return known(value, breakdown)
}
