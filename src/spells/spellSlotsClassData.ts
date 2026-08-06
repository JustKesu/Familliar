/*
 * Typed loader for calculation/spellSlots.ts's ClassSpellSlotsData — the
 * raw-JSON-to-typed-slice conversion computeSpellSlots itself never does
 * (D38: calculation functions take data in, they don't fetch or shape it).
 * No caller needed this from classes.json until the spell picker (slice d2);
 * spellSlots.ts's own tests build fixtures by hand instead.
 *
 * Shapes confirmed by scripts/investigate-spell-slots.js and
 * scripts/investigate-third-caster-slots.js:
 * - A full/half/artificer caster's slot table is `classTableGroups[].rowsSpellProgression`
 *   (one row per character level, one column per spell level, already the
 *   width spellSlots.ts expects — narrower than 9 for a half caster, never padded here).
 * - Warlock's Pact Magic table is a DIFFERENT classTableGroups entry, a flat
 *   `rows` array whose columns are identified by name via `colLabels`
 *   ("Spell Slots", "Slot Level") rather than a fixed index — labels are not
 *   in the same order for every class table, so position isn't safe to assume.
 * - D46: Eldritch Knight/Arcane Trickster keep their own rowsSpellProgression
 *   table under `subclassTableGroups` on the SUBCLASS entry, not the base class.
 */

import { loadDataFile } from '../dataLoader/dataLoader'
import type { CasterProgression, ClassSpellSlotsData, PactSlots, SubclassSpellSlotsData } from '../calculation/spellSlots'

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

interface RawTableGroup {
	colLabels?: unknown[]
	rowsSpellProgression?: number[][]
	rows?: unknown[][]
}

interface RawClassEntry {
	entryType: string
	name: string
	source: string
	className?: string
	classSource?: string
	hd?: unknown
	casterProgression?: string
	classTableGroups?: RawTableGroup[]
	subclassTableGroups?: RawTableGroup[]
}

function isRawTableGroup(value: unknown): value is RawTableGroup {
	return isRecord(value)
}

function isRawClassEntry(value: unknown): value is RawClassEntry {
	return isRecord(value) && typeof value['entryType'] === 'string' && typeof value['name'] === 'string' && typeof value['source'] === 'string'
}

function findOrdinarySlotsGroup(groups: unknown): RawTableGroup | undefined {
	if (!Array.isArray(groups)) return undefined
	return groups.find((g): g is RawTableGroup => isRawTableGroup(g) && Array.isArray(g.rowsSpellProgression))
}

/** Identified by column NAME, not position — a class table's column order isn't guaranteed the same across classes (Warlock's own colLabels order confirmed by investigate-spell-slots.js). */
function findPactSlotsGroup(groups: unknown): RawTableGroup | undefined {
	if (!Array.isArray(groups)) return undefined
	return groups.find(
		(g): g is RawTableGroup =>
			isRawTableGroup(g) && Array.isArray(g.rows) && Array.isArray(g.colLabels) && g.colLabels.includes('Spell Slots') && g.colLabels.includes('Slot Level'),
	)
}

function extractPactSlotsByLevel(group: RawTableGroup): PactSlots[] {
	const colLabels = group.colLabels as unknown[]
	const slotCountIndex = colLabels.indexOf('Spell Slots')
	const slotLevelIndex = colLabels.indexOf('Slot Level')
	return (group.rows as number[][]).map((row) => ({ count: row[slotCountIndex], slotLevel: row[slotLevelIndex] }))
}

function extractSubclassSlots(sc: RawClassEntry): SubclassSpellSlotsData | undefined {
	if (!sc.casterProgression) return undefined
	const group = findOrdinarySlotsGroup(sc.subclassTableGroups)
	if (!group) return undefined
	return {
		subclassName: sc.name,
		casterProgression: sc.casterProgression as CasterProgression,
		spellSlotsByLevel: group.rowsSpellProgression as number[][],
	}
}

/** Pure (D38): parses the whole classes.json array into one ClassSpellSlotsData entry per base class, each carrying any of its subclasses that keep their own table (D46). */
export function extractSpellSlotsClassData(parsed: unknown): ClassSpellSlotsData[] {
	if (!Array.isArray(parsed)) {
		throw new Error('classes.json: expected a top-level array.')
	}

	const baseClasses = parsed.filter((c): c is RawClassEntry => isRawClassEntry(c) && c.entryType === 'class' && !!c.hd)
	const subclasses = parsed.filter((c): c is RawClassEntry => isRawClassEntry(c) && c.entryType === 'subclass')

	return baseClasses.map((base) => {
		const ordinaryGroup = findOrdinarySlotsGroup(base.classTableGroups)
		const pactGroup = findPactSlotsGroup(base.classTableGroups)
		const classSubclasses = subclasses
			.filter((sc) => sc.className === base.name && sc.classSource === base.source)
			.map(extractSubclassSlots)
			.filter((sc): sc is SubclassSpellSlotsData => sc !== undefined)

		return {
			className: base.name,
			classSource: base.source,
			casterProgression: (base.casterProgression as CasterProgression | undefined) ?? null,
			spellSlotsByLevel: ordinaryGroup ? (ordinaryGroup.rowsSpellProgression as number[][]) : null,
			pactSlotsByLevel: pactGroup ? extractPactSlotsByLevel(pactGroup) : null,
			...(classSubclasses.length > 0 ? { subclasses: classSubclasses } : {}),
		}
	})
}

/** Fetches classes.json and returns every base class's spell-slot data. */
export async function loadSpellSlotsClassData(): Promise<ClassSpellSlotsData[]> {
	const parsed = await loadDataFile('data/classes.json')
	return extractSpellSlotsClassData(parsed)
}
