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
 *
 * D46 — Eldritch Knight and Arcane Trickster ("1/3" casters) keep their
 * slot table on the SUBCLASS entry (classes.json's `subclassTableGroups`),
 * not the base class (Fighter/Rogue have no table of their own). Row shape
 * there is identical to a base class's `rowsSpellProgression` — same
 * reading/padding logic, just a second location to check when the base
 * class itself has none. A "1/3" caster's slots are ordinary slots (never
 * pact), just from a narrower table (max spell level 4).
 */

import type { Character, CharacterClass, SpentSpellSlots } from '../storage/character'
import { type Calculated, type Contribution, known, unknown } from './types'

export type CasterProgression = 'full' | 'artificer' | 'pact' | '1/3'

/** One subclass's own spell-slot table (D46) — present only for a subclass that keeps its table on the subclass entry, e.g. Eldritch Knight/Arcane Trickster. */
export interface SubclassSpellSlotsData {
	subclassName: string
	casterProgression: CasterProgression
	spellSlotsByLevel: number[][]
}

/**
 * The subset of a classes.json entry this calculation needs. For a
 * `rowsSpellProgression` caster, `spellSlotsByLevel[level - 1]` is that
 * level's row — variable width (Paladin's table stops at 5 columns), never
 * assumed to be 9; short rows just mean the higher spell levels don't exist
 * for that class. For a Pact Magic caster, `pactSlotsByLevel[level - 1]` is
 * that level's `{ count, slotLevel }`. A non-caster class has neither array.
 * `subclasses` (D46) carries a slot table per subclass that keeps its own —
 * only checked when the base class itself has no `spellSlotsByLevel`.
 */
export interface ClassSpellSlotsData {
	className: string
	classSource: string
	casterProgression: CasterProgression | null
	spellSlotsByLevel: number[][] | null
	pactSlotsByLevel: { count: number; slotLevel: number }[] | null
	subclasses?: SubclassSpellSlotsData[]
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

/** D46: only consulted when the base class itself has no `spellSlotsByLevel` — Eldritch Knight/Arcane Trickster's table lives here instead. */
function findSubclassSpellSlotsData(characterClass: CharacterClass, classEntry: ClassSpellSlotsData): SubclassSpellSlotsData | undefined {
	if (!characterClass.subclass) return undefined
	return classEntry.subclasses?.find((s) => s.subclassName === characterClass.subclass)
}

const SPELL_LEVELS = 9

export function computeSpellSlots(character: Character, classData: ClassSpellSlotsData[]): Calculated<SpellSlotsEntry[]> {
	if (character.classes.length === 0) {
		return unknown('Character has no classes yet.')
	}

	const value: SpellSlotsEntry[] = []
	const breakdown: Contribution[] = []

	// Each class's own table, un-combined; the multiclass table is characterSpellSlotMaxima's (D322).
	for (const characterClass of character.classes) {
		const classEntry = findClassSpellSlotsData(characterClass, classData)
		if (!classEntry) {
			return unknown(`No spell slot data for class "${characterClass.className}" (${characterClass.classSource}).`)
		}

		// D46: the base class (Fighter/Rogue) carries no table of its own for a "1/3" caster — check the chosen subclass before giving up.
		let casterProgression = classEntry.casterProgression
		let spellSlotsByLevel = classEntry.spellSlotsByLevel
		if (classEntry.spellSlotsByLevel === null && classEntry.casterProgression !== 'pact') {
			const subclassEntry = findSubclassSpellSlotsData(characterClass, classEntry)
			if (subclassEntry) {
				casterProgression = subclassEntry.casterProgression
				spellSlotsByLevel = subclassEntry.spellSlotsByLevel
			}
		}
		if (casterProgression === null) continue

		const levelIndex = characterClass.level - 1

		if (casterProgression === 'pact') {
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

		const row = spellSlotsByLevel?.[levelIndex]
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

/**
 * The most slots a character has at each spell level, and in their Pact Magic
 * pool (slice 9b3) — the bound a spent count is measured against, in the two
 * pools D11 keeps apart.
 *
 * Nothing here adds two classes' tables together: with more than one ordinary
 * caster entry this takes the largest of them per level. Readers use
 * characterSpellSlotMaxima, which applies the multiclass table (D322).
 */
export function spellSlotMaxima(entries: readonly SpellSlotsEntry[]): { ordinary: number[]; pact: number } {
	const ordinary = Array.from({ length: SPELL_LEVELS }, () => 0)
	let pact = 0
	for (const entry of entries) {
		entry.ordinarySlots?.forEach((count, i) => {
			ordinary[i] = Math.max(ordinary[i], count)
		})
		if (entry.pactSlots) pact = Math.max(pact, entry.pactSlots.count)
	}
	return { ordinary, pact }
}

export interface CharacterSpellSlotMaxima {
	ordinary: number[]
	pact: number
	/** Slot level of the Pact Magic pool; 0 when there is none. */
	pactSlotLevel: number
	/** Set only when the D322 multiclass table applies (2+ Spellcasting classes). */
	casterLevel: number | null
	/** Per-class caster-level contributions when combined, otherwise each class's own non-zero slot lines. */
	ordinaryBreakdown: Contribution[]
}

/** D322: a class's contribution to the multiclass caster level. */
function casterLevelContribution(casterProgression: CasterProgression, level: number): number {
	if (casterProgression === 'full') return level
	if (casterProgression === 'artificer') return Math.ceil(level / 2)
	if (casterProgression === '1/3') return Math.floor(level / 3)
	return Math.floor(level / 2)
}

/**
 * The slot maxima for the whole character (M3, D322) — what every reader of
 * ordinary slot counts uses. With Spellcasting from two or more classes the
 * ordinary pool is the multiclass table row for the combined caster level
 * (identical to Wizard XPHB's table, DATA.md); otherwise it is the single
 * class's own table, exactly as spellSlotMaxima gives it. Pact Magic never
 * counts as Spellcasting and its pool is unchanged.
 */
export function characterSpellSlotMaxima(character: Character, classData: ClassSpellSlotsData[]): Calculated<CharacterSpellSlotMaxima> {
	const slots = computeSpellSlots(character, classData)
	if (slots.status === 'unknown') return slots
	const own = spellSlotMaxima(slots.value)
	const pactSlotLevel = slots.value.reduce((level, entry) => Math.max(level, entry.pactSlots?.slotLevel ?? 0), 0)

	// An EK/AT row is all zeros before its subclass grants Spellcasting, so a non-zero row is what marks a Spellcasting class.
	const casters: { characterClass: CharacterClass; casterProgression: CasterProgression }[] = []
	for (const characterClass of character.classes) {
		const entry = slots.value.find((e) => e.className === characterClass.className && e.classSource === characterClass.classSource)
		if (!entry?.ordinarySlots?.some((count) => count > 0)) continue
		const classEntry = findClassSpellSlotsData(characterClass, classData)
		const casterProgression =
			classEntry?.spellSlotsByLevel === null ? findSubclassSpellSlotsData(characterClass, classEntry)?.casterProgression : classEntry?.casterProgression
		if (casterProgression) casters.push({ characterClass, casterProgression })
	}

	if (casters.length < 2) {
		const ordinaryBreakdown = slots.value.flatMap((entry) => entry.ordinarySlotsBreakdown ?? [])
		return known({ ordinary: own.ordinary, pact: own.pact, pactSlotLevel, casterLevel: null, ordinaryBreakdown }, [])
	}

	const ordinaryBreakdown: Contribution[] = casters.map(({ characterClass, casterProgression }) => ({
		source: `${characterClass.className} level ${characterClass.level} (${casterProgression} caster)`,
		amount: casterLevelContribution(casterProgression, characterClass.level),
	}))
	const casterLevel = ordinaryBreakdown.reduce((sum, contribution) => sum + contribution.amount, 0)
	const multiclassTable = classData.find((c) => c.className === 'Wizard' && c.classSource === 'XPHB')?.spellSlotsByLevel
	const row = multiclassTable?.[casterLevel - 1]
	if (!row) {
		return unknown(`No multiclass spell slot row for caster level ${casterLevel} (Wizard XPHB table).`)
	}
	const ordinary = Array.from({ length: SPELL_LEVELS }, (_, i) => row[i] ?? 0)
	return known({ ordinary, pact: own.pact, pactSlotLevel, casterLevel, ordinaryBreakdown }, ordinaryBreakdown)
}

/**
 * The stored spent slots, with each count brought down to the maximum the
 * character has now (slice 9b3) — the same invariant resourceUsesWithinMaxima
 * (calculation/resources.ts) applies to limited-use pools, for the same reason: a
 * level change shrinks the pool, and a count recorded against the old maximum
 * would otherwise outlive it.
 *
 * Unlike a resource, a slot's maximum is never "not in the data": a level with no
 * slots has zero of them, so a count there is dropped rather than left alone. The
 * caller passes maxima it actually computed — computeSpellSlots returning
 * `unknown` is not zeroes, and nothing is clamped against it.
 *
 * Counts of 0 and an emptied record become absence, the convention every play
 * field uses.
 */
export function spentSpellSlotsWithinMaxima(
	spent: SpentSpellSlots | undefined,
	maxima: { ordinary: number[]; pact: number },
): SpentSpellSlots | undefined {
	if (spent === undefined) return undefined

	const ordinary: Record<number, number> = {}
	for (const [level, count] of Object.entries(spent.ordinary ?? {})) {
		const value = Math.min(count, maxima.ordinary[Number(level) - 1] ?? 0)
		if (value > 0) ordinary[Number(level)] = value
	}
	const pact = Math.min(spent.pact ?? 0, maxima.pact)

	const clamped: SpentSpellSlots = {
		...(Object.keys(ordinary).length > 0 ? { ordinary } : {}),
		...(pact > 0 ? { pact } : {}),
	}
	return Object.keys(clamped).length > 0 ? clamped : undefined
}
