/*
 * Typed loader for the subclass slice: which subclasses a class may choose
 * from, and at what level that choice is granted.
 *
 * Per D28, a subclass entry (classes.json, entryType "subclass") is offered
 * only when its classSource is in ALLOWED_CLASS_SOURCES (the class EDITION)
 * AND its source is in ALLOWED_SOURCES (the book it was printed in). Per
 * D27, XGE/TCE subclasses are taken as their XPHB-converted entry, not the
 * PHB original — confirmed via scripts/investigate-subclass-shape.js, the
 * conversions already carry classSource "XPHB"/"EFA" with feature levels
 * remapped.
 *
 * A second dedup applies, same mechanism as species (D31): some
 * XGE/TCE-sourced subclass entries are themselves superseded by a distinct
 * XPHB-sourced reprint of the same subclass (e.g. Psi Warrior appears both
 * as a TCE entry with classSource "XPHB" and as its own XPHB-source entry).
 * The superseded one carries `reprintedAs`; it is excluded, matching D31's
 * rule that a `reprintedAs` entry always names its own successor.
 *
 * The level a class gains a subclass is derived from the data, not
 * hardcoded: the base class entry names its subclass-granting feature via
 * `subclassTitle` (e.g. "Fighter Subclass"), and that name is looked up in
 * class-features.json for its `level`. Confirmed the same investigation:
 * every one of the 13 classes grants its subclass at level 3, but nothing
 * here assumes that number — it is read off the data each time.
 */

const ALLOWED_CLASS_SOURCES = ['XPHB', 'EFA']
const ALLOWED_SOURCES = ['XPHB', 'XGE', 'TCE', 'EFA', 'XDMG', 'MPMM']

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

interface RawBaseClass {
	entryType: string
	name: string
	source: string
	subclassTitle?: string
}

function isRawBaseClass(value: unknown): value is RawBaseClass {
	if (!isRecord(value)) return false
	return (
		value['entryType'] === 'class' &&
		typeof value['name'] === 'string' &&
		typeof value['source'] === 'string'
	)
}

interface RawSubclass {
	entryType: string
	name: string
	shortName: string
	source: string
	className: string
	classSource: string
	reprintedAs?: unknown
}

function isRawSubclass(value: unknown): value is RawSubclass {
	if (!isRecord(value)) return false
	return (
		value['entryType'] === 'subclass' &&
		typeof value['name'] === 'string' &&
		typeof value['shortName'] === 'string' &&
		typeof value['source'] === 'string' &&
		typeof value['className'] === 'string' &&
		typeof value['classSource'] === 'string'
	)
}

interface RawClassFeatureEntry {
	name: string
	className: string
	classSource: string
	level: number
}

function isRawClassFeatureEntry(value: unknown): value is RawClassFeatureEntry {
	if (!isRecord(value)) return false
	return (
		typeof value['name'] === 'string' &&
		typeof value['className'] === 'string' &&
		typeof value['classSource'] === 'string' &&
		typeof value['level'] === 'number'
	)
}

interface RawSubclassFeatureEntry {
	className: string
	classSource: string
	subclassShortName: string
	subclassSource: string
	level: number
	entries: unknown[]
}

function isRawSubclassFeatureEntry(value: unknown): value is RawSubclassFeatureEntry {
	if (!isRecord(value)) return false
	return (
		typeof value['className'] === 'string' &&
		typeof value['classSource'] === 'string' &&
		typeof value['subclassShortName'] === 'string' &&
		typeof value['subclassSource'] === 'string' &&
		typeof value['level'] === 'number' &&
		Array.isArray(value['entries'])
	)
}

function findBaseClass(parsedClasses: unknown, className: string, classSource: string): RawBaseClass | undefined {
	if (!Array.isArray(parsedClasses)) {
		throw new Error('classes.json: expected a top-level array.')
	}
	return parsedClasses.find(
		(candidate) => isRawBaseClass(candidate) && candidate.name === className && candidate.source === classSource,
	) as RawBaseClass | undefined
}

/**
 * The level `className`/`classSource` grants a subclass choice, read from
 * the class's `subclassTitle` and the matching class-features.json entry.
 * Returns null if the class or its subclass-granting feature can't be found.
 */
export function subclassLevelFor(parsedClasses: unknown, parsedClassFeatures: unknown, className: string, classSource: string): number | null {
	const cls = findBaseClass(parsedClasses, className, classSource)
	if (!cls || !cls.subclassTitle) return null

	if (!Array.isArray(parsedClassFeatures)) {
		throw new Error('class-features.json: expected a top-level array.')
	}
	const match = parsedClassFeatures.find(
		(candidate) =>
			isRawClassFeatureEntry(candidate) &&
			candidate.name === cls.subclassTitle &&
			candidate.className === className &&
			candidate.classSource === classSource,
	) as RawClassFeatureEntry | undefined
	return match ? match.level : null
}

export interface SubclassOption {
	name: string
	source: string
	entries: unknown[]
}

/**
 * The legal subclasses for `className`/`classSource` (D27, D28, and the
 * reprintedAs dedup above), each carrying the feature text granted at the
 * level the subclass is first taken.
 */
export function subclassesFor(
	parsedClasses: unknown,
	parsedSubclassFeatures: unknown,
	parsedClassFeatures: unknown,
	className: string,
	classSource: string,
): SubclassOption[] {
	if (!Array.isArray(parsedClasses)) {
		throw new Error('classes.json: expected a top-level array.')
	}
	if (!Array.isArray(parsedSubclassFeatures)) {
		throw new Error('subclass-features.json: expected a top-level array.')
	}

	const grantLevel = subclassLevelFor(parsedClasses, parsedClassFeatures, className, classSource)

	const subclasses = parsedClasses.filter(
		(candidate): candidate is RawSubclass =>
			isRawSubclass(candidate) &&
			candidate.className === className &&
			candidate.classSource === classSource &&
			ALLOWED_CLASS_SOURCES.includes(candidate.classSource) &&
			ALLOWED_SOURCES.includes(candidate.source) &&
			!candidate.reprintedAs,
	)

	const subclassFeatures = parsedSubclassFeatures.filter(isRawSubclassFeatureEntry)

	return subclasses.map((sc) => {
		const matches = subclassFeatures.filter(
			(f) =>
				f.className === sc.className && f.classSource === sc.classSource && f.subclassShortName === sc.shortName && f.subclassSource === sc.source,
		)
		const feature =
			(grantLevel !== null && matches.find((f) => f.level === grantLevel)) ||
			matches.reduce<RawSubclassFeatureEntry | undefined>(
				(lowest, f) => (!lowest || f.level < lowest.level ? f : lowest),
				undefined,
			)
		return { name: sc.name, source: sc.source, entries: feature?.entries ?? [] }
	})
}

async function fetchJson(path: string): Promise<unknown> {
	const response = await fetch(`${import.meta.env.BASE_URL}${path}`)
	if (!response.ok) {
		throw new Error(`${path} — HTTP ${response.status}`)
	}
	return response.json()
}

/** Fetches classes.json and class-features.json and returns subclassLevelFor's result. */
export async function loadSubclassLevelFor(className: string, classSource: string): Promise<number | null> {
	const [classes, classFeatures] = await Promise.all([fetchJson('data/classes.json'), fetchJson('data/class-features.json')])
	return subclassLevelFor(classes, classFeatures, className, classSource)
}

/** Fetches classes.json, subclass-features.json and class-features.json and returns the class's legal subclasses. */
export async function loadSubclassesFor(className: string, classSource: string): Promise<SubclassOption[]> {
	const [classes, subclassFeatures, classFeatures] = await Promise.all([
		fetchJson('data/classes.json'),
		fetchJson('data/subclass-features.json'),
		fetchJson('data/class-features.json'),
	])
	return subclassesFor(classes, subclassFeatures, classFeatures, className, classSource)
}
