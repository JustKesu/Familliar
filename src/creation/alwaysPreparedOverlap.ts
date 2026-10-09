import { spellIdentityKey } from '../spells/subclassPreparedSpells'

interface SpellRef {
	name: string
	source: string
}

/** D339: splits one class's picks into those its subclass does not grant as always prepared and those it does (matched by name and source). */
export function splitAlwaysPreparedPicks<T extends SpellRef>(picks: readonly T[], alwaysPrepared: readonly SpellRef[]): { kept: T[]; removed: T[] } {
	const granted = new Set(alwaysPrepared.map((spell) => spellIdentityKey(spell.name, spell.source)))
	const kept: T[] = []
	const removed: T[] = []
	for (const pick of picks) (granted.has(spellIdentityKey(pick.name, pick.source)) ? removed : kept).push(pick)
	return { kept, removed }
}
