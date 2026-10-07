import { useEffect, useState } from 'react'
import { ABILITIES, type Ability } from '../abilities/abilityScores'
import { ABILITY_ABBREVIATIONS } from '../calculation/abilityAbbreviations'
import { computeAbilityScores } from '../calculation/abilityScores'
import { featAbilityScoreContributions, type FeatEffectEntry } from '../calculation/featEffects'
import type { Character, FeatAsiChoice } from '../storage/character'
import {
	ABILITY_LABEL,
	ABILITY_SCORE_CAP,
	chosenFeatRefs,
	evaluateFeatPrerequisites,
	exceedsAbilityScoreCap,
	featAbilityCap,
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
import { featAsiCharacterLevels } from './featAsiCharacterLevels'
import { prerequisiteClassProficiencies } from '../calculation/classProficiencies'
import { loadDataFile } from '../dataLoader/dataLoader'

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
	/** D329: a multiclass level up's draft (every class, the raised one included, and levelOrder with the new level). */
	multiclass?: Pick<Character, 'classes' | 'levelOrder'>,
): Promise<FeatAsiStepData> {
	if (multiclass && multiclass.classes.length > 1) return loadMulticlassFeatAsiStepData(multiclass, speciesName, speciesSource, chosenSpeciesSize)
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

/**
 * D329 / review M2-M4 finding 2: card levels are character levels through levelOrder (featAsiCharacterLevels), and the
 * prerequisite context reads every class as Manage Feats does (classProficiencyGrants).
 */
async function loadMulticlassFeatAsiStepData(
	character: Pick<Character, 'classes' | 'levelOrder'>,
	speciesName: string | null,
	speciesSource: string | null,
	chosenSpeciesSize: string | null,
): Promise<FeatAsiStepData> {
	const [classFeatures, rawClasses, feats, classInfo, speciesInfo] = await Promise.all([
		loadDataFile('data/class-features.json'),
		loadDataFile('data/classes.json'),
		loadFeats(),
		Promise.all(
			character.classes.map(async (entry) => ({
				info: await loadClassPrereqInfo(entry.className, entry.classSource),
				fightingStyle: await loadHasFightingStyleFeature(entry.className, entry.classSource, entry.level),
			})),
		),
		speciesName && speciesSource ? loadSpeciesPrereqInfo(speciesName, speciesSource) : Promise.resolve(null),
	])
	const placed = featAsiCharacterLevels(character, classFeatures)
	if (placed.status !== 'known') throw new Error(placed.reason)
	return {
		grants: placed.value.map((grant) => ({ level: grant.characterLevel, kind: grant.kind })),
		feats,
		featsRequiringAbilityChoice: featsRequiringAbilityChoice(feats),
		ctx: {
			hasFightingStyleFeature: classInfo.some((entry) => entry.fightingStyle),
			hasSpellcasting: classInfo.some((entry) => entry.info?.hasSpellcasting),
			...prerequisiteClassProficiencies(character, rawClasses),
			speciesName,
			speciesRaceTags: speciesInfo?.raceTags ?? [],
			speciesSize: speciesInfo?.size ?? chosenSpeciesSize,
		},
	}
}

/** `className` null loads nothing (no class chosen yet). `multiclass` is keyed by its JSON, so pass a fresh object freely. */
export function useFeatAsiStepData(
	className: string | null,
	classSource: string | null,
	level: number,
	speciesName: string | null,
	speciesSource: string | null,
	chosenSpeciesSize: string | null,
	multiclass?: Pick<Character, 'classes' | 'levelOrder'>,
): FeatAsiStepLoad {
	const [state, setState] = useState<FeatAsiStepLoad>({ status: 'loading' })
	const multiclassKey = multiclass ? JSON.stringify([multiclass.classes, multiclass.levelOrder]) : null
	useEffect(() => {
		let cancelled = false
		setState({ status: 'loading' })
		if (className === null || classSource === null) return
		loadFeatAsiStepData(className, classSource, level, speciesName, speciesSource, chosenSpeciesSize, multiclass)
			.then((data) => {
				if (!cancelled) setState({ status: 'ready', data })
			})
			.catch((error: unknown) => {
				if (!cancelled) setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
			})
		return () => {
			cancelled = true
		}
		// `multiclass` is read through multiclassKey; the draft object is rebuilt on every render.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [className, classSource, level, speciesName, speciesSource, chosenSpeciesSize, multiclassKey])
	return state
}

/** A feat the character has from outside the ASI levels, with the origin the "already taken" sentence names. */
export interface GrantedFeat extends FeatRef {
	origin: string
	/** F-3: set for an item feat — the item may be dropped any time, so a clash with it warns and does not lock Next. */
	item?: { name?: string }
}

/** The background feat, the species feat, manual feats and item feats, labelled as featOriginLabel labels them. */
export function grantedFeatsOf(
	backgroundOriginFeat: FeatRef | null,
	manualFeats: readonly FeatRef[],
	itemFeats: readonly (FeatRef & { itemName?: string })[],
	speciesFeat: FeatRef | null = null,
): GrantedFeat[] {
	return [
		...(backgroundOriginFeat ? [{ name: backgroundOriginFeat.name, source: backgroundOriginFeat.source, origin: 'Background' }] : []),
		...(speciesFeat ? [{ name: speciesFeat.name, source: speciesFeat.source, origin: 'Species' }] : []),
		...manualFeats.map((feat) => ({ name: feat.name, source: feat.source, origin: 'Added manually' })),
		...itemFeats.map((feat) => ({ name: feat.name, source: feat.source, origin: feat.itemName ? `From item (${feat.itemName})` : 'From item', item: { name: feat.itemName } })),
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
	/** The draft every score on the step is read from, with the background origin feat override and `choices` — the ability table on top uses it too. */
	draft: Character
	scoresBelow: (level: number) => Partial<Record<Ability, number>>
}

export function featAsiLevels(data: FeatAsiStepData, choices: readonly FeatAsiChoice[], granted: readonly GrantedFeat[], draft: Character): FeatAsiLevels {
	const cache = new Map<number, Partial<Record<Ability, number>>>()
	// loadFeats' entries carry no grantedByBackgrounds (sheetData adds it), so the calculation layer is told the background feat directly.
	const backgroundFeat = granted.find((feat) => feat.origin === 'Background')
	const background = draft.background && backgroundFeat ? { ...draft.background, originFeatOverride: { name: backgroundFeat.name, source: backgroundFeat.source } } : draft.background
	const withChoices: Character = { ...draft, ...(background ? { background } : {}), featAsiChoices: [...choices] }
	return {
		data,
		choices,
		granted,
		draft: withChoices,
		scoresBelow(level) {
			if (!cache.has(level)) cache.set(level, abilityScoresBelowLevel(withChoices, data.feats, level))
			return cache.get(level)!
		},
	}
}

export const pickedFeats = (choices: readonly FeatAsiChoice[], include: (level: number) => boolean): GrantedFeat[] =>
	choices.flatMap((choice) => (choice.kind === 'feat' && choice.name !== '' && include(choice.level) ? [{ name: choice.name, source: choice.source, origin: `level ${choice.level}` }] : []))

function contextAt(levels: FeatAsiLevels, level: number): Omit<PrerequisiteContext, 'chosenFeats'> {
	// D257: a level prerequisite is read against the card's level, not the character's total level.
	return { ...levels.data.ctx, characterLevel: level, abilityScores: levels.scoresBelow(level) }
}

/** W18: what the card at `level` offers — a non-repeatable feat held anywhere else is taken; prerequisites read only what lies below `level`. */
export function featAsiLevelOffers(levels: FeatAsiLevels, level: number): FeatOffer[] {
	const lower = [...levels.granted, ...pickedFeats(levels.choices, (other) => other < level)]
	return featOffers(levels.data.feats, [...levels.granted, ...pickedFeats(levels.choices, (other) => other !== level)], contextAt(levels, level), lower)
}

/** F-3: a choice's own ability increase on top of the scores below its level — the score may not pass 20 (30 for an Epic Boon's own `max`). */
function abilityCapProblem(levels: FeatAsiLevels, choice: FeatAsiChoice, feat: FeatEntry | undefined): string | null {
	const cap = feat ? featAbilityCap(feat) : ABILITY_SCORE_CAP
	// Only this choice in the draft, so the contribution is exactly what the card adds.
	const alone = { id: '', name: '', classes: [], featAsiChoices: [choice] }
	const below = levels.scoresBelow(choice.level)
	for (const ability of ABILITIES) {
		const amount = featAbilityScoreContributions(ability, alone, levels.data.feats as unknown as FeatEffectEntry[]).reduce((sum, contribution) => sum + contribution.amount, 0)
		if (amount > 0 && exceedsAbilityScoreCap(below, { [ability]: amount }, cap)) {
			return `+${amount} ${ABILITY_ABBREVIATIONS[ability].toUpperCase()} would take ${ABILITY_LABEL[ability]} above ${cap} — choose another ability.`
		}
	}
	return null
}

/**
 * D254: why a chosen feat is no longer valid, or null. Checked only against the granted feats and LOWER
 * levels, so of two cards holding the same feat only the higher one is flagged. F-3: an ASI or feat whose
 * ability increase would pass the cap on top of the lower levels is flagged the same way.
 */
export function featAsiChoiceProblem(levels: FeatAsiLevels, choice: FeatAsiChoice | undefined): string | null {
	return choiceProblem(levels, choice)?.text ?? null
}

/** `blocking: false` is a warning only: the feat clashes with an item's feat, and the item can be dropped. */
function choiceProblem(levels: FeatAsiLevels, choice: FeatAsiChoice | undefined): { text: string; blocking: boolean } | null {
	if (!choice) return null
	const cap = (feat: FeatEntry | undefined) => {
		const text = abilityCapProblem(levels, choice, feat)
		return text === null ? null : { text, blocking: true }
	}
	if (choice.kind === 'asi') return cap(undefined)
	if (choice.name === '') return null
	const feat = levels.data.feats.find((entry) => entry.name === choice.name && entry.source === choice.source)
	if (!feat) return null
	const lower = [...levels.granted, ...pickedFeats(levels.choices, (other) => other < choice.level)]
	const takers = feat.repeatable ? [] : lower.filter((other) => sameFeatName(other, feat))
	// A blocking holder wins over an item, so an item never hides a clash the player must fix.
	const blocker = takers.find((other) => !other.item)
	if (blocker) return { text: `${feat.name} is already taken (${blocker.origin}) — choose another feat.`, blocking: true }
	const result = evaluateFeatPrerequisites(feat, { ...contextAt(levels, choice.level), chosenFeats: chosenFeatRefs(levels.data.feats, lower) })
	if (!result.eligible) return { text: `${feat.name} no longer meets its prerequisite (${unmetPrerequisiteText(result)}) — choose another feat.`, blocking: true }
	const capProblem = cap(feat)
	if (capProblem) return capProblem
	const item = takers[0]
	return item ? { text: `${feat.name} is also granted by ${item.item?.name ?? 'an item'} — you may keep it or choose another feat.`, blocking: false } : null
}

/** The levels whose choice is invalid, leaving out `lockedLevels` (D254: a level up cannot change those) and warning-only clashes with an item's feat. */
export function invalidFeatAsiLevels(levels: FeatAsiLevels, lockedLevels: readonly number[] = []): number[] {
	return levels.choices.filter((choice) => !lockedLevels.includes(choice.level) && choiceProblem(levels, choice)?.blocking === true).map((choice) => choice.level)
}

/** The ASI / Feat step's Next gate: still loading keeps it shut, a failed load opens it (the picker shows the error). */
export function featAsiStepValid(load: FeatAsiStepLoad, choices: readonly FeatAsiChoice[], granted: readonly GrantedFeat[], draft: Character, lockedLevels: readonly number[] | undefined): boolean {
	if (load.status !== 'ready') return load.status === 'error'
	return invalidFeatAsiLevels(featAsiLevels(load.data, choices, granted, draft), lockedLevels).length === 0
}
