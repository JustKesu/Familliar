import { singleClassLevelOrder, type Character, type CharacterClass, type CharacterFightingStyle, type CharacterOptionalFeatureChoice } from '../storage/character'
import { poolUsesAfterSplit } from '../calculation/classPools'
import { computeCharacterResources, poolGrantingClassNames } from '../calculation/resources'

/** D336: the play.resourceUses a level up to `afterClasses` writes — a pool it splits keeps the plain count with the class that held it. */
export function resourceUsesAfterLevelUp(before: Character, afterClasses: readonly CharacterClass[], parsedClasses: unknown): Record<string, number> | undefined {
	const uses = before.play?.resourceUses
	if (uses === undefined || !Array.isArray(parsedClasses)) return uses
	// Table-granted pools need no feature list; only their split is decided here.
	const after = computeCharacterResources({ ...before, classes: [...afterClasses] }, parsedClasses, [])
	return poolUsesAfterSplit(uses, after, (pool) => poolGrantingClassNames(pool, before, parsedClasses))
}

interface ClassRef {
	className: string
	classSource: string
}

export const isClass = (entry: ClassRef, target: ClassRef): boolean => entry.className === target.className && entry.classSource === target.classSource

/** D330: the raised class replaced in place, or a class entered appended last. */
export function classesAfterLevelUp(before: readonly CharacterClass[], raised: CharacterClass): CharacterClass[] {
	return before.some((entry) => isClass(entry, raised)) ? before.map((entry) => (isClass(entry, raised) ? raised : entry)) : [...before, raised]
}

/**
 * D329: a level up raises exactly one existing class by one, keeps every other class and their order, and ends at `levelUpTo`.
 * D330: or it keeps every class and appends one new class at level 1.
 */
export function checkOneClassRaised(before: readonly CharacterClass[], after: readonly CharacterClass[], levelUpTo: number): void {
	const fail = (): never => {
		throw new Error(`A level up raises one existing class by exactly one level, to level ${levelUpTo}.`)
	}
	const total = after.reduce((sum, entry) => sum + entry.level, 0)
	if (after.length === before.length + 1) {
		const added = after[after.length - 1]
		if (added.level !== 1 || before.some((entry) => isClass(entry, added)) || total !== levelUpTo) fail()
		before.forEach((old, index) => {
			const entry = after[index]
			if (!isClass(entry, old) || entry.level !== old.level || entry.subclass !== old.subclass) fail()
		})
		return
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

/** M9: an Edit keeps every class, their order and their levels; only a subclass may change. */
export function checkNoClassRaised(before: readonly CharacterClass[], after: readonly CharacterClass[]): void {
	if (after.length !== before.length || after.some((entry, index) => !isClass(entry, before[index]) || entry.level !== before[index].level)) {
		throw new Error('Editing a character cannot change its classes, their order or their levels.')
	}
}

/**
 * D330: the history a level up appends to. Entering a second class needs one; a single class without it (older save)
 * can always be told, so it is rebuilt. Otherwise the stored one, "not known" included (D317).
 */
export function levelOrderBeforeLevelUp(existing: Pick<Character, 'classes' | 'levelOrder'>, after: readonly CharacterClass[]): Pick<Character, 'classes' | 'levelOrder'> {
	if (existing.levelOrder || existing.classes.length !== 1 || after.length <= existing.classes.length) return existing
	return { classes: existing.classes, levelOrder: singleClassLevelOrder(existing.classes) }
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
