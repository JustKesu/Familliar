import { useEffect, useState } from 'react'
import { loadClassSpellList, loadFeatExpandedSpellList, type ClassSpellListSpell } from './classSpellListData'

/** Which lists make up one class's spell pool: the list class (EK/AT → Wizard, spellListClassFor), D46's extra list (Divine Soul, expandedSpellListClassFor) and every feat the character has (a mark's `expanded` spells). */
export interface ClassSpellPoolInput {
	className: string
	classSource: string
	expandedClassName?: string
	expandedClassSource?: string
	featChoices?: readonly { name: string; source: string }[]
}

/** The one pool the wizard's SpellPicker and the sheet's Manage Spells panel both offer (D208) — unfiltered by level; filterSpellsByLevel applies on top. */
export async function loadClassSpellPool(input: ClassSpellPoolInput): Promise<ClassSpellListSpell[]> {
	const [spells, expandedSpells, featExpandedSpells] = await Promise.all([
		loadClassSpellList(input.className, input.classSource),
		input.expandedClassName && input.expandedClassSource ? loadClassSpellList(input.expandedClassName, input.expandedClassSource) : Promise.resolve([]),
		Promise.all((input.featChoices ?? []).map((feat) => loadFeatExpandedSpellList(feat.name, feat.source))),
	])
	const merged = new Map<string, ClassSpellListSpell>()
	for (const spell of [...spells, ...expandedSpells, ...featExpandedSpells.flat()]) merged.set(`${spell.name}|${spell.source}`, spell)
	return [...merged.values()]
}

export type ClassSpellPoolState = { status: 'loading' } | { status: 'ready'; spells: ClassSpellListSpell[] } | { status: 'error'; message: string }

export function useClassSpellPool(input: ClassSpellPoolInput): ClassSpellPoolState {
	const [state, setState] = useState<ClassSpellPoolState>({ status: 'loading' })
	const key = JSON.stringify([input.className, input.classSource, input.expandedClassName, input.expandedClassSource, input.featChoices ?? []])

	useEffect(() => {
		let cancelled = false
		setState({ status: 'loading' })
		loadClassSpellPool(input)
			.then((spells) => {
				if (!cancelled) setState({ status: 'ready', spells })
			})
			.catch((error: unknown) => {
				if (!cancelled) setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
			})
		return () => {
			cancelled = true
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- `input` is a fresh object each render; `key` is its content.
	}, [key])

	return state
}
