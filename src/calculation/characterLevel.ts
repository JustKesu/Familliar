import type { CharacterClass } from '../storage/character'

export function totalCharacterLevel(classes: readonly Pick<CharacterClass, 'level'>[] | undefined): number {
	return (classes ?? []).reduce((sum, entry) => sum + entry.level, 0)
}
