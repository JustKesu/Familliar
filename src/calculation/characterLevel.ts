import type { Character, CharacterClass } from '../storage/character'

/** D316: editing rewrites a character as one class, so more than one class is blocked until multiclass M9. */
export function isMulticlass(classes: readonly unknown[] | undefined): boolean {
	return (classes?.length ?? 0) > 1
}

export function totalCharacterLevel(classes: readonly Pick<CharacterClass, 'level'>[] | undefined): number {
	return (classes ?? []).reduce((sum, entry) => sum + entry.level, 0)
}

/** D321: the class that took character level 1 — levelOrder[0] (D317), else classes[0]. */
export function firstClass(character: Pick<Character, 'classes' | 'levelOrder'>): CharacterClass | undefined {
	const start = character.levelOrder?.[0]
	const ordered = start && character.classes.find((entry) => entry.className === start.className && entry.classSource === start.classSource)
	return ordered || character.classes[0]
}
