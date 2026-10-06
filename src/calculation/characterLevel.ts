import type { Character, CharacterClass, CharacterLevelOrderEntry } from '../storage/character'

/** D316: editing rewrites a character as one class, so more than one class is blocked until multiclass M9. */
export function isMulticlass(classes: readonly unknown[] | undefined): boolean {
	return (classes?.length ?? 0) > 1
}

export function totalCharacterLevel(classes: readonly Pick<CharacterClass, 'level'>[] | undefined): number {
	return (classes ?? []).reduce((sum, entry) => sum + entry.level, 0)
}

/** D328: the class whose level rose from `before` to `after` (a class new in `after` counts) — what a level up appends to levelOrder. */
export function raisedClass(before: readonly CharacterClass[], after: readonly CharacterClass[]): CharacterClass | undefined {
	return after.find((entry) => entry.level > (before.find((old) => old.className === entry.className && old.classSource === entry.classSource)?.level ?? 0))
}

/** D317/D328: a level up appends the raised class; an unknown history stays unknown. */
export function levelOrderAfterLevelUp(existing: Pick<Character, 'classes' | 'levelOrder'>, classes: readonly CharacterClass[]): CharacterLevelOrderEntry[] | undefined {
	const raised = raisedClass(existing.classes, classes)
	return existing.levelOrder && raised ? [...existing.levelOrder, { className: raised.className, classSource: raised.classSource }] : undefined
}

/** D321: the class that took character level 1 — levelOrder[0] (D317), else classes[0]. */
export function firstClass(character: Pick<Character, 'classes' | 'levelOrder'>): CharacterClass | undefined {
	const start = character.levelOrder?.[0]
	const ordered = start && character.classes.find((entry) => entry.className === start.className && entry.classSource === start.classSource)
	return ordered || character.classes[0]
}
