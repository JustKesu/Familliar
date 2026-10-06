import { computeSpellCounts, type ClassSpellCountData, type SpellCountEntry } from '../calculation/spellCounts'
import { computeSpellSlots, type ClassSpellSlotsData } from '../calculation/spellSlots'
import { findSpellDetail, type SpellDetail } from '../spells/spellDetailData'
import { highestSlotLevel } from '../spells/spellLevelFilter'
import type { Character } from '../storage/character'
import type { SheetSpellEntry } from './SpellList'

export interface ClassSpellLimit {
	className: string
	classSource: string
	/** Why this class's limits are unknown (D43); the other classes still get theirs. */
	reason: string | null
	/** D106: the highest spell level this class's OWN table casts (D325); null when `reason` is set. */
	highestLevel: number | null
	counts: SpellCountEntry | undefined
	cantripsStored: number
	leveledSpellsStored: number
	hasChosenSpells: boolean
}

/** Single class keeps D106's reading: every pick is that class's, whatever its stored className. */
function choseFor(entry: SheetSpellEntry, character: Character, className: string, classSource: string): boolean {
	if (!entry.chosen) return false
	if (character.classes.length === 1) return true
	return entry.chosenBy?.className === className && entry.chosenBy.classSource === classSource
}

/**
 * D325 (XPHB Multiclassing > Spellcasting): known/prepared spells are counted
 * and capped per class as if single-classed in it, so each class is computed
 * on its own — its own slot table and counts against only the spells it chose.
 */
export function classSpellLimits(
	character: Character,
	slotData: ClassSpellSlotsData[],
	countData: ClassSpellCountData[],
	entries: readonly SheetSpellEntry[],
	details: SpellDetail[],
): ClassSpellLimit[] {
	return character.classes.map((characterClass) => {
		const { className, classSource } = characterClass
		const alone = { ...character, classes: [characterClass] }
		const slots = computeSpellSlots(alone, slotData)
		const counts = computeSpellCounts(alone, countData)
		const reason = slots.status === 'unknown' ? slots.reason : counts.status === 'unknown' ? counts.reason : null
		const chosen = entries.filter((entry) => choseFor(entry, character, className, classSource))
		const levels = chosen.map((entry) => findSpellDetail(details, entry.name, entry.source)?.level).filter((level): level is number => level !== undefined)
		return {
			className,
			classSource,
			reason,
			highestLevel: reason === null && slots.status === 'known' ? highestSlotLevel(slots.value[0]) : null,
			counts: reason === null && counts.status === 'known' ? counts.value[0] : undefined,
			cantripsStored: levels.filter((level) => level === 0).length,
			leveledSpellsStored: levels.filter((level) => level > 0).length,
			hasChosenSpells: chosen.length > 0,
		}
	})
}

/** The cap the Spells tab marks a pick unavailable above, from the class that chose it. */
export function chosenSpellCap(limits: readonly ClassSpellLimit[], character: Character): (entry: SheetSpellEntry) => number | undefined {
	return (entry) => {
		const limit = limits.find((candidate) => choseFor(entry, character, candidate.className, candidate.classSource))
		return limit?.highestLevel ?? undefined
	}
}
