import type { CharacterClass } from '../storage/character'

/** D316: editing rewrites a character as one class, so more than one class is blocked until multiclass M9. */
export function isMulticlass(classes: readonly unknown[] | undefined): boolean {
	return (classes?.length ?? 0) > 1
}

export function totalCharacterLevel(classes: readonly Pick<CharacterClass, 'level'>[] | undefined): number {
	return (classes ?? []).reduce((sum, entry) => sum + entry.level, 0)
}
