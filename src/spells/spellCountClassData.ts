/*
 * Typed loader for calculation/spellCounts.ts's ClassSpellCountData —
 * mirrors spellSlotsClassData.ts's raw-JSON-to-typed-slice split (D38).
 *
 * Unlike the slot tables, cantripProgression/preparedSpellsProgression/
 * preparedSpellsChange are already plain top-level fields on a classes.json
 * class or subclass entry — no classTableGroups column-hunting needed
 * (confirmed by scripts/investigate-spell-counts.js and -2.js).
 */

import { loadDataFile } from '../dataLoader/dataLoader'
import type { ClassSpellCountData, SpellCountLabel, SubclassSpellCountData } from '../calculation/spellCounts'

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

interface RawClassEntry {
	entryType: string
	name: string
	source: string
	className?: string
	classSource?: string
	hd?: unknown
	cantripProgression?: number[]
	preparedSpellsProgression?: number[]
	preparedSpellsChange?: string
}

function isRawClassEntry(value: unknown): value is RawClassEntry {
	return isRecord(value) && typeof value['entryType'] === 'string' && typeof value['name'] === 'string' && typeof value['source'] === 'string'
}

/** `preparedSpellsChange` doubles as the known-vs-prepared label (task: "difference is a LABEL only") — 'level' classes never re-pick without leveling up ("known"), 'restLong' classes re-pick every long rest ("prepared"). Neither value, nor absence of the field, means anything else. */
function labelFor(preparedSpellsChange: string | undefined): SpellCountLabel | null {
	if (preparedSpellsChange === 'level') return 'known'
	if (preparedSpellsChange === 'restLong') return 'prepared'
	return null
}

function extractSubclassCounts(sc: RawClassEntry): SubclassSpellCountData | undefined {
	const label = labelFor(sc.preparedSpellsChange)
	if (label === null) return undefined
	return {
		subclassName: sc.name,
		cantripProgression: sc.cantripProgression ?? null,
		leveledSpellProgression: sc.preparedSpellsProgression ?? null,
		label,
	}
}

/** Pure (D38): parses the whole classes.json array into one ClassSpellCountData entry per base class, each carrying any of its subclasses that keep their own counts (D46). */
export function extractSpellCountClassData(parsed: unknown): ClassSpellCountData[] {
	if (!Array.isArray(parsed)) {
		throw new Error('classes.json: expected a top-level array.')
	}

	const baseClasses = parsed.filter((c): c is RawClassEntry => isRawClassEntry(c) && c.entryType === 'class' && !!c.hd)
	const subclasses = parsed.filter((c): c is RawClassEntry => isRawClassEntry(c) && c.entryType === 'subclass')

	return baseClasses.map((base) => {
		const classSubclasses = subclasses
			.filter((sc) => sc.className === base.name && sc.classSource === base.source)
			.map(extractSubclassCounts)
			.filter((sc): sc is SubclassSpellCountData => sc !== undefined)

		return {
			className: base.name,
			classSource: base.source,
			cantripProgression: base.cantripProgression ?? null,
			leveledSpellProgression: base.preparedSpellsProgression ?? null,
			label: labelFor(base.preparedSpellsChange),
			...(classSubclasses.length > 0 ? { subclasses: classSubclasses } : {}),
		}
	})
}

/** Fetches classes.json and returns every base class's spell-count data. */
export async function loadSpellCountClassData(): Promise<ClassSpellCountData[]> {
	const parsed = await loadDataFile('data/classes.json')
	return extractSpellCountClassData(parsed)
}
