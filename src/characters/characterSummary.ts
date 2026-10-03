import type { Character } from '../storage/character'

/** The card's sub line; the species is the same name the sheet header shows. */
export function characterSummary(character: Pick<Character, 'species' | 'classes'>): string {
	const classes = character.classes.length === 0 ? 'No class yet' : character.classes.map((c) => `${c.className} ${c.level}`).join(' / ')
	return character.species ? `${character.species.name} · ${classes}` : classes
}
