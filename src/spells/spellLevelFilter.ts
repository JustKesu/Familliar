/*
 * Legal-by-level spell filter (build order step 6, slice d1): given a
 * class's full spell list (slice c, classSpellListData.ts) and that same
 * class's spell slots (slice b, calculation/spellSlots.ts), returns the
 * sublist of spells the character is legally allowed to take BY SPELL
 * LEVEL. Counts (max cantrips known, max spells prepared/known) are the
 * picker's job (slice d2), not this filter's.
 *
 * Confirmed with the user: cantrips (level 0) have no slot-level
 * restriction and always pass through, regardless of the character's
 * highest slot level.
 *
 * Investigated ahead of writing this (scripts/investigate-spell-cap-by-slots.js):
 * "highest slot level == highest castable spell level" holds for full
 * casters, half casters (Paladin/Ranger/Artificer — their table just stops
 * at a lower column count), and Warlock Pact Magic (the single pact slot
 * level IS the cap). Third casters (Eldritch Knight, Arcane Trickster)
 * keep their slot table on the SUBCLASS entry's `subclassTableGroups`, a
 * shape slice b's spellSlots.ts does not read — an EK/AT character gets no
 * SpellSlotsEntry from slice b today, so this filter cannot cap them
 * correctly yet. See docs/REPORT.md.
 */

import type { SpellSlotsEntry } from '../calculation/spellSlots'
import type { ClassSpellListSpell } from './classSpellListData'

function highestSlotLevel(spellSlots: SpellSlotsEntry | undefined): number {
	if (!spellSlots) return 0
	if (spellSlots.pactSlots) return spellSlots.pactSlots.slotLevel
	if (spellSlots.ordinarySlots) {
		for (let level = spellSlots.ordinarySlots.length; level >= 1; level--) {
			if (spellSlots.ordinarySlots[level - 1] > 0) return level
		}
	}
	return 0
}

/**
 * Pure filter (D38). Takes ONE class's spell list and that same class's
 * spell slots entry — no fetching. D11: phase-1 single-class; a caller
 * combining a multiclass character's access unions the per-class results
 * itself, this function never assumes there is only one class involved.
 * A spell's level, ritual, concentration, and viaVariant fields pass
 * through unchanged.
 */
export function filterSpellsByLevel(classSpellList: ClassSpellListSpell[], spellSlots: SpellSlotsEntry | undefined): ClassSpellListSpell[] {
	const maxLevel = highestSlotLevel(spellSlots)
	return classSpellList.filter((spell) => spell.level === 0 || spell.level <= maxLevel)
}
