/*
 * Typed loader for classes.json (PHASE1.md build order step 3, first slice:
 * choosing a class and a level).
 *
 * classes.json holds BOTH the 13 base classes and their 114 subclasses in
 * one array, distinguished by `entryType`. This slice only needs base
 * classes, so only the fields it uses are typed here — everything else
 * (spellcasting progression, features, starting equipment, ...) is left
 * untyped and is added when a later slice needs it (PHASE1.md: types are
 * written as the features that consume them are built).
 */

export interface HitDie {
	number: number
	faces: number
}

/** A base class — e.g. "Fighter" — as opposed to one of its subclasses. */
export interface BaseClass {
	name: string
	source: string
	hd: HitDie
}

/** The shape common to both base classes and subclasses in classes.json. */
interface ClassOrSubclassEntry {
	entryType: 'class' | 'subclass'
	name: string
	source: string
	hd?: HitDie
}

function isClassOrSubclassEntry(value: unknown): value is ClassOrSubclassEntry {
	if (typeof value !== 'object' || value === null) return false
	const entry = value as Record<string, unknown>
	return (
		(entry.entryType === 'class' || entry.entryType === 'subclass') &&
		typeof entry.name === 'string' &&
		typeof entry.source === 'string'
	)
}

/**
 * Picks the base classes out of a parsed classes.json array, discarding
 * subclasses. Exported separately from `loadClasses` so the filtering logic
 * can be unit-tested without a fetch.
 */
export function extractBaseClasses(parsed: unknown): BaseClass[] {
	if (!Array.isArray(parsed)) {
		throw new Error('classes.json: expected a top-level array.')
	}

	const baseClasses: BaseClass[] = []
	for (const entry of parsed) {
		if (!isClassOrSubclassEntry(entry)) continue
		if (entry.entryType !== 'class') continue
		if (!entry.hd) continue
		baseClasses.push({ name: entry.name, source: entry.source, hd: entry.hd })
	}
	return baseClasses
}

/** Fetches classes.json and returns the base classes only, sorted by name. */
export async function loadBaseClasses(): Promise<BaseClass[]> {
	const response = await fetch(`${import.meta.env.BASE_URL}data/classes.json`)
	if (!response.ok) {
		throw new Error(`classes.json — HTTP ${response.status}`)
	}
	const parsed: unknown = await response.json()
	return extractBaseClasses(parsed).sort((a, b) => a.name.localeCompare(b.name))
}
