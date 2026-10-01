import { useEffect, useState } from 'react'
import { ABILITIES, type Ability } from '../abilities/abilityScores'
import { computeAbilityScores } from '../calculation/abilityScores'
import type { FeatEffectEntry } from '../calculation/featEffects'
import type { Character, FeatAsiChoice } from '../storage/character'
import {
	chosenFeatRefs,
	evaluateFeatPrerequisites,
	featOffers,
	featsRequiringAbilityChoice,
	loadClassPrereqInfo,
	loadFeatAsiGrants,
	loadFeats,
	loadHasFightingStyleFeature,
	loadSpeciesPrereqInfo,
	sameFeatName,
	unmetPrerequisiteText,
	type FeatAsiGrant,
	type FeatEntry,
	type FeatOffer,
	type PrerequisiteContext,
} from './featAsiData'
import type { FeatRef } from './featInstances'

/** Everything the ASI / Feat step reads from the data, loaded once for the picker and for the wizard's Next gate. */
export interface FeatAsiStepData {
	grants: FeatAsiGrant[]
	feats: FeatEntry[]
	featsRequiringAbilityChoice: Set<string>
	ctx: Omit<PrerequisiteContext, 'chosenFeats' | 'abilityScores' | 'characterLevel'>
}

export type FeatAsiStepLoad = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: FeatAsiStepData }

export async function loadFeatAsiStepData(
	className: string,
	classSource: string,
	level: number,
	speciesName: string | null,
	speciesSource: string | null,
	chosenSpeciesSize: string | null,
): Promise<FeatAsiStepData> {
	const [grants, feats, classInfo, hasFightingStyleFeature, speciesInfo] = await Promise.all([
		loadFeatAsiGrants(className, classSource, level),
		loadFeats(),
		loadClassPrereqInfo(className, classSource),
		loadHasFightingStyleFeature(className, classSource, level),
		speciesName && speciesSource ? loadSpeciesPrereqInfo(speciesName, speciesSource) : Promise.resolve(null),
	])
	return {
		grants,
		feats,
		featsRequiringAbilityChoice: featsRequiringAbilityChoice(feats),
		ctx: {
			hasFightingStyleFeature,
			hasSpellcasting: classInfo?.hasSpellcasting ?? false,
			armorProficiencies: classInfo?.armorProficiencies ?? [],
			weaponProficiencies: classInfo?.weaponProficiencies ?? [],
			speciesName,
			speciesRaceTags: speciesInfo?.raceTags ?? [],
			// D175: species.json alone leaves a multi-size species' "small race" prerequisite unresolved.
			speciesSize: speciesInfo?.size ?? chosenSpeciesSize,
		},
	}
}

/** `className` null loads nothing (no class chosen yet). */
export function useFeatAsiStepData(
	className: string | null,
	classSource: string | null,
	level: number,
	speciesName: string | null,
	speciesSource: string | null,
	chosenSpeciesSize: string | null,
): FeatAsiStepLoad {
	const [state, setState] = useState<FeatAsiStepLoad>({ status: 'loading' })
	useEffect(() => {
		let cancelled = false
		setState({ status: 'loading' })
		if (className === null || classSource === null) return
		loadFeatAsiStepData(className, classSource, level, speciesName, speciesSource, chosenSpeciesSize)
			.then((data) => {
				if (!cancelled) setState({ status: 'ready', data })
			})
			.catch((error: unknown) => {
				if (!cancelled) setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
			})
		return () => {
			cancelled = true
		}
	}, [className, classSource, level, speciesName, speciesSource, chosenSpeciesSize])
	return state
}

/** A feat the character has from outside the ASI levels, with the origin the "already taken" sentence names. */
export interface GrantedFeat extends FeatRef {
	origin: string
}

/** The background feat, manual feats and item feats, labelled as featOriginLabel labels them. */
export function grantedFeatsOf(
	backgroundOriginFeat: FeatRef | null,
	manualFeats: readonly FeatRef[],
	itemFeats: readonly (FeatRef & { itemName?: string })[],
): GrantedFeat[] {
	return [
		...(backgroundOriginFeat ? [{ name: backgroundOriginFeat.name, source: backgroundOriginFeat.source, origin: 'Background' }] : []),
		...manualFeats.map((feat) => ({ name: feat.name, source: feat.source, origin: 'Added manually' })),
		...itemFeats.map((feat) => ({ name: feat.name, source: feat.source, origin: feat.itemName ? `From item (${feat.itemName})` : 'From item' })),
	]
}

/**
 * D253: the ability scores as they stand below `level` — base, background, every lower-level ASI/feat, the
 * background origin feat and manual feats, through the calculation layer. Items never count: the inventory
 * (attuned and custom items, item feats) is left out.
 */
export function abilityScoresBelowLevel(draft: Character, feats: readonly FeatEntry[], level: number): Partial<Record<Ability, number>> {
	const { inventory: _inventory, ...withoutItems } = draft
	// loadFeats keeps each feats.json object whole, so it carries the ability fields the calculation layer reads.
	const scores = computeAbilityScores({ ...withoutItems, featAsiChoices: (draft.featAsiChoices ?? []).filter((choice) => choice.level < level) }, feats as unknown as FeatEffectEntry[])
	return Object.fromEntries(ABILITIES.flatMap((ability) => (scores[ability].status === 'known' ? [[ability, scores[ability].value.score]] : []))) as Partial<Record<Ability, number>>
}

/** One evaluation of the step's choices; `scoresBelow` caches per level (D116). */
export interface FeatAsiLevels {
	data: FeatAsiStepData
	choices: readonly FeatAsiChoice[]
	granted: readonly GrantedFeat[]
	characterLevel: number
	scoresBelow: (level: number) => Partial<Record<Ability, number>>
}

export function featAsiLevels(data: FeatAsiStepData, choices: readonly FeatAsiChoice[], granted: readonly GrantedFeat[], characterLevel: number, draft: Character): FeatAsiLevels {
	const cache = new Map<number, Partial<Record<Ability, number>>>()
	// loadFeats' entries carry no grantedByBackgrounds (sheetData adds it), so the calculation layer is told the background feat directly.
	const backgroundFeat = granted.find((feat) => feat.origin === 'Background')
	const background = draft.background && backgroundFeat ? { ...draft.background, originFeatOverride: { name: backgroundFeat.name, source: backgroundFeat.source } } : draft.background
	const withChoices: Character = { ...draft, ...(background ? { background } : {}), featAsiChoices: [...choices] }
	return {
		data,
		choices,
		granted,
		characterLevel,
		scoresBelow(level) {
			if (!cache.has(level)) cache.set(level, abilityScoresBelowLevel(withChoices, data.feats, level))
			return cache.get(level)!
		},
	}
}

const pickedFeats = (choices: readonly FeatAsiChoice[], include: (level: number) => boolean): GrantedFeat[] =>
	choices.flatMap((choice) => (choice.kind === 'feat' && choice.name !== '' && include(choice.level) ? [{ name: choice.name, source: choice.source, origin: `level ${choice.level}` }] : []))

function contextAt(levels: FeatAsiLevels, level: number): Omit<PrerequisiteContext, 'chosenFeats'> {
	return { ...levels.data.ctx, characterLevel: levels.characterLevel, abilityScores: levels.scoresBelow(level) }
}

/** W18: what the card at `level` offers — a non-repeatable feat held anywhere else is taken; prerequisites read only what lies below `level`. */
export function featAsiLevelOffers(levels: FeatAsiLevels, level: number): FeatOffer[] {
	const lower = [...levels.granted, ...pickedFeats(levels.choices, (other) => other < level)]
	return featOffers(levels.data.feats, [...levels.granted, ...pickedFeats(levels.choices, (other) => other !== level)], contextAt(levels, level), lower)
}

/**
 * D254: why a chosen feat is no longer valid, or null. Checked only against the granted feats and LOWER
 * levels, so of two cards holding the same feat only the higher one is flagged.
 */
export function featAsiChoiceProblem(levels: FeatAsiLevels, choice: FeatAsiChoice | undefined): string | null {
	if (choice?.kind !== 'feat' || choice.name === '') return null
	const feat = levels.data.feats.find((entry) => entry.name === choice.name && entry.source === choice.source)
	if (!feat) return null
	const lower = [...levels.granted, ...pickedFeats(levels.choices, (other) => other < choice.level)]
	const taker = feat.repeatable ? undefined : lower.find((other) => sameFeatName(other, feat))
	if (taker) return `${feat.name} is already taken (${taker.origin}) — choose another feat.`
	const result = evaluateFeatPrerequisites(feat, { ...contextAt(levels, choice.level), chosenFeats: chosenFeatRefs(levels.data.feats, lower) })
	return result.eligible ? null : `${feat.name} no longer meets its prerequisite (${unmetPrerequisiteText(result)}) — choose another feat.`
}

/** The levels whose choice is invalid, leaving out `lockedLevels` (D254: a level up cannot change those). */
export function invalidFeatAsiLevels(levels: FeatAsiLevels, lockedLevels: readonly number[] = []): number[] {
	return levels.choices.filter((choice) => !lockedLevels.includes(choice.level) && featAsiChoiceProblem(levels, choice) !== null).map((choice) => choice.level)
}
