import { useEffect, useState } from 'react'
import { loadDataFile } from '../dataLoader/dataLoader'
import type { CharacterGrantedFeat } from '../storage/character'
import { loadFeats, sameFeatName, type FeatEntry } from './featAsiData'
import type { FeatRef } from './featInstances'

/** Human|XPHB's `feats`, the only shape species.json carries (DATA.md). */
function grantsOneOriginFeat(feats: unknown): boolean {
	if (!Array.isArray(feats) || feats.length !== 1) return false
	const any = (feats[0] as { anyFromCategory?: { category?: unknown; count?: unknown } } | null)?.anyFromCategory
	return !!any && Array.isArray(any.category) && any.category.length === 1 && any.category[0] === 'O' && any.count === 1
}

/** D271: whether this species.json entry lets the player choose one Origin feat (Human's Versatile). */
export function speciesGrantsOriginFeat(parsedSpecies: unknown, species: FeatRef | null | undefined): boolean {
	if (!species || !Array.isArray(parsedSpecies)) return false
	const entry = parsedSpecies.find((s) => s?.name === species.name && s?.source === species.source)
	return grantsOneOriginFeat(entry?.feats)
}

export async function loadSpeciesGrantsOriginFeat(species: FeatRef | null | undefined): Promise<boolean> {
	if (!species) return false
	return speciesGrantsOriginFeat(await loadDataFile('data/species.json'), species)
}

/** D273: a non-repeatable feat the background already grants cannot be the species feat; null when `feat` is fine. */
export function speciesOriginFeatProblem(feat: FeatEntry, backgroundFeat: FeatRef | null): string | null {
	if (feat.repeatable || !backgroundFeat || !sameFeatName(feat, backgroundFeat)) return null
	return `${feat.name} is already taken (Background) — choose another feat.`
}

export type SpeciesOriginFeatLoad =
	| { status: 'loading' }
	| { status: 'error'; message: string }
	| { status: 'ready'; key: string; grants: boolean; originFeats: FeatEntry[] }

/** The chosen species' grant and the Origin feats it picks from (D272: category "O" only, so no Dark Gift). */
export function useSpeciesOriginFeat(species: FeatRef | null): SpeciesOriginFeatLoad {
	const key = species ? `${species.name}|${species.source}` : ''
	const [state, setState] = useState<SpeciesOriginFeatLoad>({ status: 'loading' })
	useEffect(() => {
		let cancelled = false
		Promise.all([loadSpeciesGrantsOriginFeat(species), loadFeats()])
			.then(([grants, feats]) => {
				if (!cancelled) setState({ status: 'ready', key, grants, originFeats: feats.filter((feat) => feat.category === 'O').sort((a, b) => a.name.localeCompare(b.name)) })
			})
			.catch((error: unknown) => {
				if (!cancelled) setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
			})
		return () => {
			cancelled = true
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the species' identity.
	}, [key])
	return state.status === 'ready' && state.key !== key ? { status: 'loading' } : state
}

/** D274: the Background step's Next gate for the species feat. Loading keeps it shut, a failed load opens it (the card shows the error); sub-choices never block (D179). */
export function speciesOriginFeatComplete(load: SpeciesOriginFeatLoad, chosen: CharacterGrantedFeat | undefined, backgroundFeat: FeatRef | null): boolean {
	if (load.status !== 'ready') return load.status === 'error'
	if (!load.grants) return true
	const feat = chosen && load.originFeats.find((entry) => entry.name === chosen.name && entry.source === chosen.source)
	return !!feat && speciesOriginFeatProblem(feat, backgroundFeat) === null
}
