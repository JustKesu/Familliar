/*
 * The item file, reduced to what the inventory picker and the sheet's
 * item-resolution need: a name + source per entry (build order step 7, slice
 * a1). The whole file is offered — magic items included (Daniel's decision) —
 * so nothing is filtered here beyond dropping malformed rows.
 *
 * Referenced items are identified by name + source, the same convention every
 * other stored pick in this project uses (CharacterSpellChoice,
 * CharacterWildShapeForms). A stored item whose (name, source) is absent from
 * this list is not dropped — the sheet shows it with a note (D43).
 */

import { loadDataFile } from '../dataLoader/dataLoader'

export interface ItemRef {
	name: string
	source: string
}

function isItemEntry(value: unknown): value is { name: string; source: string } {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as { name?: unknown }).name === 'string' &&
		typeof (value as { source?: unknown }).source === 'string'
	)
}

/** Stable key for an item reference — also the SearchableOptionList option key. */
export function itemKey(ref: ItemRef): string {
	return `${ref.name}|${ref.source}`
}

export function extractItemRefs(parsed: unknown): ItemRef[] {
	if (!Array.isArray(parsed)) {
		throw new Error('items.json: expected a top-level array.')
	}
	return parsed
		.filter(isItemEntry)
		.map((entry) => ({ name: entry.name, source: entry.source }))
		.sort((a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source))
}

export async function loadItemRefs(): Promise<ItemRef[]> {
	return extractItemRefs(await loadDataFile('data/items.json'))
}
