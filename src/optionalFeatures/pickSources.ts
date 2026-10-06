import { loadDataFile } from '../dataLoader/dataLoader'
import { findPicked } from '../storage/choiceMatch'

/** D318: the source of the row a sourceless pick resolves to today (first same-named row) — what a new save records. `'FS'` names the class fighting-style list. */
export type PickSourceLookup = (featureType: string, name: string) => string | undefined

type Row = { name: string; source: string }

/** The rows the pickers offer: optionalFeatureData drops one without `entries` too. */
function isRow(value: unknown): value is Row & Record<string, unknown> {
	if (typeof value !== 'object' || value === null) return false
	const record = value as Record<string, unknown>
	return typeof record['name'] === 'string' && typeof record['source'] === 'string' && Array.isArray(record['entries'])
}

/** Indexed up front, so a bad file fails while loading rather than at save. Every `FS*` code resolves against feats.json category FS (D12). */
export function pickSourceLookup(parsedOptionalFeatures: unknown, parsedFeats: unknown): PickSourceLookup {
	if (!Array.isArray(parsedOptionalFeatures) || !Array.isArray(parsedFeats)) throw new Error('optional-features.json / feats.json: expected top-level arrays.')
	const styles = parsedFeats.filter(isRow).filter((feat) => feat['category'] === 'FS')
	const byType = new Map<string, Row[]>()
	for (const option of parsedOptionalFeatures.filter(isRow)) {
		const types = option['featureType']
		for (const code of Array.isArray(types) ? types : []) {
			if (typeof code === 'string') byType.set(code, [...(byType.get(code) ?? []), option])
		}
	}
	return (featureType, name) => findPicked(featureType === 'FS' || featureType.startsWith('FS:') ? styles : (byType.get(featureType) ?? []), { name })?.source
}

export async function loadPickSourceLookup(): Promise<PickSourceLookup> {
	const [optionalFeatures, feats] = await Promise.all([loadDataFile('data/optional-features.json'), loadDataFile('data/feats.json')])
	return pickSourceLookup(optionalFeatures, feats)
}
