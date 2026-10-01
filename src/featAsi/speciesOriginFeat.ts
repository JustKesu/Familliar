import { useEffect, useState } from 'react'
import { loadDataFile } from '../dataLoader/dataLoader'
import type { CharacterGrantedFeat } from '../storage/character'
import { loadFeats, sameFeatName, type FeatEntry } from './featAsiData'
import type { GrantedFeat } from './featAsiLevels'
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

/** D273: who already holds a non-repeatable feat of this name — background, ASI level, manual or item (`held` as grantedFeatsOf + pickedFeats build it). A blocking holder wins over an item. */
export function speciesOriginFeatTaker(feat: FeatEntry, held: readonly GrantedFeat[]): GrantedFeat | undefined {
	if (feat.repeatable) return undefined
	const takers = held.filter((other) => sameFeatName(other, feat))
	return takers.find((other) => !other.item) ?? takers[0]
}

/** Null when `feat` is fine; an item's feat only warns, as on the ASI card (F-3). */
export function speciesOriginFeatProblem(feat: FeatEntry, held: readonly GrantedFeat[]): { text: string; blocking: boolean } | null {
	const taker = speciesOriginFeatTaker(feat, held)
	if (!taker) return null
	if (taker.item) return { text: `${feat.name} is also granted by ${taker.item.name ?? 'an item'} — you may keep it or choose another feat.`, blocking: false }
	return { text: `${feat.name} is already taken (${taker.origin}) — choose another feat.`, blocking: true }
}

export type SpeciesOriginFeatLoad =
	| { status: 'loading' }
	| { status: 'error'; message: string }
	| { status: 'ready'; grants: boolean; originFeats: FeatEntry[] }

/** The chosen species' grant and the Origin feats it picks from (D272: category "O" only, so no Dark Gift). feats.json is read only for a species with the grant. */
export function useSpeciesOriginFeat(species: FeatRef | null): SpeciesOriginFeatLoad {
	const key = species ? `${species.name}|${species.source}` : ''
	const [state, setState] = useState<{ key: string; load: SpeciesOriginFeatLoad } | null>(null)
	useEffect(() => {
		let cancelled = false
		const settle = (load: SpeciesOriginFeatLoad) => {
			if (!cancelled) setState({ key, load })
		}
		loadSpeciesGrantsOriginFeat(species)
			.then(async (grants) => {
				const feats = grants ? await loadFeats() : []
				settle({ status: 'ready', grants, originFeats: feats.filter((feat) => feat.category === 'O').sort((a, b) => a.name.localeCompare(b.name)) })
			})
			.catch((error: unknown) => settle({ status: 'error', message: error instanceof Error ? error.message : String(error) }))
		return () => {
			cancelled = true
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the species' identity.
	}, [key])
	// Another species' result or error never stands in for this one's.
	return state?.key === key ? state.load : { status: 'loading' }
}

/**
 * D274: the Background step's Next gate for the species feat. Loading keeps it shut, a failed load opens it (the card shows the error);
 * sub-choices never block (D179). `heldKnown` false (background feat links still loading or failed) keeps it shut for a granting species.
 */
export function speciesOriginFeatComplete(load: SpeciesOriginFeatLoad, chosen: CharacterGrantedFeat | undefined, held: readonly GrantedFeat[], heldKnown = true): boolean {
	if (load.status !== 'ready') return load.status === 'error'
	if (!load.grants) return true
	if (!heldKnown) return false
	const feat = chosen && load.originFeats.find((entry) => entry.name === chosen.name && entry.source === chosen.source)
	return !!feat && speciesOriginFeatProblem(feat, held)?.blocking !== true
}
