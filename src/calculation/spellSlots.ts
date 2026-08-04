/*
 * Spell slots (build order step 6 slice b): how many slots of each level a
 * character HAS. Not spell lists, not preparation, not slot spending (step 9).
 *
 * D11 — a Warlock's Pact Magic slots are tracked SEPARATELY from ordinary
 * spell slots (SPEC), so this returns one entry per casting class in
 * character.classes carrying whichever shape that class uses — never forced
 * into the other's shape. A future multiclass Warlock+other class would get
 * both an ordinarySlots entry and a pactSlots entry; today's phase-1 single
 * class just returns whichever one applies. A non-caster class contributes
 * no entry (not zeroes, not an error), matching spellcasting.ts's pattern
 * for a class with no spellcasting ability.
 *
 * casterProgression only says WHICH table shape to expect (DATA.md,
 * "Traps") — the slot counts themselves always come from the class's own
 * table in the supplied data, never computed from the progression name.
 */

import type { Character, CharacterClass } from '../storage/character'
import { type Calculated, type Contribution, known, unknown } from './types'

export type CasterProgression = 'full' | 'artificer' | 'pact'

/**
 * The subset of a classes.json entry this calculation needs. For a
 * `rowsSpellProgression` caster, `spellSlotsByLevel[level - 1]` is that
 * level's row — variable width (Paladin's table stops at 5 columns), never
 * assumed to be 9; short rows just mean the higher spell levels don't exist
 * for that class. For a Pact Magic caster, `pactSlotsByLevel[level - 1]` is
 * that level's `{ count, slotLevel }`. A non-caster class has neither array.
 */
export interface ClassSpellSlotsData {
	className: string
	classSource: string
	casterProgression: CasterProgression | null
	spellSlotsByLevel: number[][] | null
	pactSlotsByLevel: { count: number; slotLevel: number }[] | null
}

export interface PactSlots {
	count: number
	slotLevel: number
}

export interface SpellSlotsEntry {
	className: string
	classSource: string
	/** Slot counts for spell levels 1-9 (index 0 = level 1), zero-filled past the class's own table width. Absent for a Pact Magic caster. */
	ordinarySlots?: number[]
	ordinarySlotsBreakdown?: Contribution[]
	/** Absent for an ordinary caster. */
	pactSlots?: PactSlots
	pactSlotsBreakdown?: Contribution[]
}

function findClassSpellSlotsData(characterClass: CharacterClass, classData: ClassSpellSlotsData[]): ClassSpellSlotsData | undefined {
	return classData.find((c) => c.className === characterClass.className && c.classSource === characterClass.classSource)
}

const SPELL_LEVELS = 9

export function computeSpellSlots(character: Character, classData: ClassSpellSlotsData[]): Calculated<SpellSlotsEntry[]> {
	if (character.classes.length === 0) {
		return unknown('Character has no classes yet.')
	}

	const value: SpellSlotsEntry[] = []
	const breakdown: Contribution[] = []

	// D11: multiclass caster combining (the shared multiclass slot table) is step 10 — each class's slots are returned un-combined.
	for (const characterClass of character.classes) {
		const classEntry = findClassSpellSlotsData(characterClass, classData)
		if (!classEntry) {
			return unknown(`No spell slot data for class "${characterClass.className}" (${characterClass.classSource}).`)
		}
		if (classEntry.casterProgression === null) continue

		const levelIndex = characterClass.level - 1

		if (classEntry.casterProgression === 'pact') {
			const row = classEntry.pactSlotsByLevel?.[levelIndex]
			if (!row) {
				return unknown(`No Pact Magic slot row for class "${characterClass.className}" at level ${characterClass.level}.`)
			}
			const pactSlotsBreakdown: Contribution[] = [
				{ source: `${characterClass.className} level ${characterClass.level}: slot count`, amount: row.count },
				{ source: `${characterClass.className} level ${characterClass.level}: slot level`, amount: row.slotLevel },
			]
			value.push({
				className: characterClass.className,
				classSource: characterClass.classSource,
				pactSlots: { count: row.count, slotLevel: row.slotLevel },
				pactSlotsBreakdown,
			})
			breakdown.push({ source: characterClass.className, amount: row.count })
			continue
		}

		const row = classEntry.spellSlotsByLevel?.[levelIndex]
		if (!row) {
			return unknown(`No spell slot row for class "${characterClass.className}" at level ${characterClass.level}.`)
		}
		const ordinarySlots: number[] = Array.from({ length: SPELL_LEVELS }, (_, i) => row[i] ?? 0)
		const ordinarySlotsBreakdown: Contribution[] = ordinarySlots
			.map((count, i) => ({ source: `${characterClass.className} level ${characterClass.level}: spell level ${i + 1}`, amount: count }))
			.filter((contribution) => contribution.amount > 0)

		value.push({
			className: characterClass.className,
			classSource: characterClass.classSource,
			ordinarySlots,
			ordinarySlotsBreakdown,
		})
		breakdown.push({ source: characterClass.className, amount: ordinarySlots.reduce((sum, count) => sum + count, 0) })
	}

	return known(value, breakdown)
}
