import { loadSubclassSource } from '../sheet/sheetData'
import type { CharacterClass } from '../storage/character'
import { loadClassAlwaysPreparedSpells, loadSubclassAlwaysPreparedSpells, spellIdentityKey, type AlwaysPreparedSpell } from './subclassPreparedSpells'

export interface ClassPreparedSpells {
	className: string
	spells: readonly { name: string; source: string }[]
}

/** D331: spell identity key to the name of the other class that already has it always prepared (the first one when several do). */
export function preparedByOtherClass(groups: readonly ClassPreparedSpells[], selfClassName: string): Map<string, string> {
	const result = new Map<string, string>()
	for (const group of groups) {
		if (group.className === selfClassName) continue
		for (const spell of group.spells) {
			const key = spellIdentityKey(spell.name, spell.source)
			if (!result.has(key)) result.set(key, group.className)
		}
	}
	return result
}

/** A held class's class-record and subclass always-prepared spells; a failed load gives an empty list, the notice is only a hint. */
export async function loadHeldClassPrepared(classes: readonly CharacterClass[]): Promise<ClassPreparedSpells[]> {
	return Promise.all(
		classes.map(async (held) => {
			const spells: AlwaysPreparedSpell[] = []
			try {
				spells.push(...(await loadClassAlwaysPreparedSpells(held.className, held.classSource, held.level)))
				const source = held.subclass ? await loadSubclassSource(held.className, held.classSource, held.subclass) : null
				if (held.subclass && source) spells.push(...(await loadSubclassAlwaysPreparedSpells(held.subclass, source, held.className, held.classSource, held.level)))
			} catch {
				/* Best-effort: the row simply shows no notice. */
			}
			return { className: held.className, spells }
		}),
	)
}
