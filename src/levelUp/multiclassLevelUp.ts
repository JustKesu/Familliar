import type { CharacterClass, CharacterFightingStyle, CharacterOptionalFeatureChoice } from '../storage/character'

interface ClassRef {
	className: string
	classSource: string
}

export const isClass = (entry: ClassRef, target: ClassRef): boolean => entry.className === target.className && entry.classSource === target.classSource

/** D329: a level up raises exactly one existing class by one, keeps every other class and their order, and ends at `levelUpTo`. */
export function checkOneClassRaised(before: readonly CharacterClass[], after: readonly CharacterClass[], levelUpTo: number): void {
	const fail = (): never => {
		throw new Error(`A level up raises one existing class by exactly one level, to level ${levelUpTo}.`)
	}
	if (after.length !== before.length) fail()
	let raised = 0
	after.forEach((entry, index) => {
		const old = before[index]
		if (!isClass(entry, old)) fail()
		if (entry.level === old.level + 1) raised++
		else if (entry.level !== old.level || entry.subclass !== old.subclass) fail()
	})
	if (raised !== 1 || after.reduce((sum, entry) => sum + entry.level, 0) !== levelUpTo) fail()
}

/** The records of every class but `active`, unchanged. */
export function otherClassRecords<T extends ClassRef>(records: readonly T[] | undefined, active: ClassRef): T[] {
	return (records ?? []).filter((record) => !isClass(record, active))
}

/** D318/D329: the styles of the other classes; the unassigned one too unless the raised class held it. */
export function otherFightingStyles(styles: readonly CharacterFightingStyle[] | undefined, active: ClassRef, heldByActive: CharacterFightingStyle | undefined): CharacterFightingStyle[] {
	return (styles ?? []).filter((style) => style !== heldByActive && !(style.className !== undefined && style.classSource !== undefined && isClass(style as ClassRef, active)))
}

/** Optional-feature entries no featureType of the raised class or its subclass claims: the other classes' and their subclasses' picks. */
export function otherOptionalFeatureChoices(stored: readonly CharacterOptionalFeatureChoice[] | undefined, activeTypes: readonly string[]): CharacterOptionalFeatureChoice[] {
	return (stored ?? []).filter((entry) => !activeTypes.includes(entry.featureType))
}
