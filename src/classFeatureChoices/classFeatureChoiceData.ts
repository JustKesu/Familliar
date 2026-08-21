/*
 * The class features whose own text carries a "pick one version of this
 * feature" choice (D21): Cleric's Divine Order (1), Druid's Primal Order (1)
 * and Elemental Fury (7).
 *
 * Two structural tests select them, so no feature is named in code here.
 * A class feature qualifies when its `options` node
 *   1. carries a `count` — without one the node is a plain container for
 *      sub-parts the character receives ALL of, not a choice
 *      (scripts/investigate-options-count.js: 9 of the 20 options nodes in
 *      the data carry a count, 11 do not); and
 *   2. holds nothing but `refClassFeature` pointers — a counted node of
 *      `refOptionalfeature` pointers is an optionalfeatureProgression list
 *      (Sorcerer Metamagic, Warlock Eldritch Invocations) that
 *      ClassOptionalFeaturePicker already owns, and building a second picker
 *      over it would duplicate that step.
 * scripts/investigate-class-feature-choice-kind.js confirms the two tests
 * select exactly these three, with no mixed-kind node to break them.
 */

import { loadResolverData, resolveRef, type ResolverData } from '../featureResolver'
// Type-only: this module still fetches nothing on anyone's behalf (D38).
import type { CharacterClassFeatureChoice } from '../storage/character'

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** One alternative the player may pick, with the text of the feature it points at (D51 resolves it; D43 keeps an unresolved one visible). */
export interface ClassFeatureChoiceOption {
	uid: string
	name: string
	entries: unknown[]
	found: boolean
}

export interface ClassFeatureChoice {
	featureName: string
	className: string
	classSource: string
	/** D22 — the level the FEATURE is granted at, stored with the pick so a level 8 character can tell its level 1 choice from its level 7 one. */
	grantedAtLevel: number
	count: number
	options: ClassFeatureChoiceOption[]
}

function findOptionsNode(node: unknown): Record<string, unknown> | null {
	if (Array.isArray(node)) {
		for (const child of node) {
			const found = findOptionsNode(child)
			if (found) return found
		}
		return null
	}
	if (!isRecord(node)) return null
	if (node['type'] === 'options') return node
	for (const key of Object.keys(node)) {
		const found = findOptionsNode(node[key])
		if (found) return found
	}
	return null
}

/** A ref node's uid lives in a field named after the kind — `refClassFeature` carries it in `classFeature` (scanRefs.ts's REF_FIELD encodes the same mapping). */
function classFeatureRefUid(entry: unknown): string | null {
	if (!isRecord(entry) || entry['type'] !== 'refClassFeature') return null
	const uid = entry['classFeature']
	return typeof uid === 'string' && uid !== '' ? uid : null
}

/**
 * Pure (D38): every file this reads is passed in. `classFeatures` is
 * class-features.json, `resolverData` the four files a ref* may point into.
 */
export function classFeatureChoicesFrom(
	classFeatures: unknown,
	resolverData: ResolverData,
	className: string,
	classSource: string,
	level: number,
): ClassFeatureChoice[] {
	if (!Array.isArray(classFeatures)) return []

	const choices: ClassFeatureChoice[] = []
	for (const feature of classFeatures) {
		if (!isRecord(feature)) continue
		if (feature['className'] !== className || feature['classSource'] !== classSource) continue

		const grantedAtLevel = feature['level']
		if (typeof grantedAtLevel !== 'number' || grantedAtLevel > level) continue

		const node = findOptionsNode(feature['entries'])
		if (!node) continue
		const count = node['count']
		if (typeof count !== 'number') continue

		const entries = node['entries']
		if (!Array.isArray(entries) || entries.length === 0) continue
		const uids = entries.map(classFeatureRefUid)
		if (uids.some((uid) => uid === null)) continue

		const featureName = feature['name']
		if (typeof featureName !== 'string') continue

		choices.push({
			featureName,
			className,
			classSource,
			grantedAtLevel,
			count,
			options: (uids as string[]).map((uid) => {
				const resolved = resolveRef({ kind: 'classFeature', uid }, resolverData)
				// D43: an unresolved target still shows under its uid's own name rather than vanishing from the list.
				return resolved
					? { uid, name: resolved.name, entries: resolved.entries, found: true }
					: { uid, name: uid.split('|')[0], entries: [], found: false }
			}),
		})
	}

	return choices.sort((a, b) => a.grantedAtLevel - b.grantedAtLevel || a.featureName.localeCompare(b.featureName))
}

/** class-features.json is read straight off ResolverData — loadResolverData already fetches it, so there is no second request to make (D39). */
export async function loadClassFeatureChoices(className: string, classSource: string, level: number): Promise<ClassFeatureChoice[]> {
	const resolverData = await loadResolverData()
	return classFeatureChoicesFrom(resolverData.classFeatures, resolverData, className, classSource, level)
}

/**
 * Whether every granted choice has as many picks as its own `count` — the
 * class step's completion gate. Lives here rather than in the picker so the
 * gate and the UI evaluate the same function, the same way
 * areClassOptionalFeaturesComplete sits in optionalFeatureData.ts.
 */
export function areClassFeatureChoicesComplete(choices: ClassFeatureChoice[], value: CharacterClassFeatureChoice[]): boolean {
	return choices.every((choice) => value.filter((entry) => entry.featureName === choice.featureName).length === choice.count)
}

/** A stored pick joined to the text of the option it names — what the sheet displays. */
export interface ChosenClassFeatureChoice {
	featureName: string
	grantedAtLevel: number
	optionName: string
	entries: unknown[]
	found: boolean
}

/**
 * Joins the character's stored picks to the offered options, so the option's
 * TEXT is re-derived rather than duplicated into storage — the pick records
 * only which option was chosen (see CharacterClassFeatureChoice).
 *
 * A pick naming an option the class no longer offers (level lowered, data
 * changed) is kept with `found: false` rather than dropped: D43 — the sheet
 * says the text is missing instead of quietly showing one fewer feature.
 */
export function chosenClassFeatureChoicesFrom(character: ChoiceBearingCharacter, resolverData: ResolverData): ChosenClassFeatureChoice[] {
	const stored = character.classFeatureChoices ?? []
	if (stored.length === 0) return []

	return stored.map((pick) => {
		const characterClass = character.classes.find((entry) => entry.className === pick.className && entry.classSource === pick.classSource)
		const offered = characterClass
			? classFeatureChoicesFrom(resolverData.classFeatures, resolverData, pick.className, pick.classSource, characterClass.level).find(
					(choice) => choice.featureName === pick.featureName,
				)
			: undefined
		const option = offered?.options.find((candidate) => candidate.name === pick.optionName)
		return {
			featureName: pick.featureName,
			grantedAtLevel: pick.grantedAtLevel,
			optionName: pick.optionName,
			entries: option?.entries ?? [],
			found: option?.found ?? false,
		}
	})
}

/** The subset of Character this join needs — the sheet's own Character satisfies it structurally. */
interface ChoiceBearingCharacter {
	classes: { className: string; classSource: string; level: number }[]
	classFeatureChoices?: CharacterClassFeatureChoice[]
}

export async function loadChosenClassFeatureChoices(character: ChoiceBearingCharacter): Promise<ChosenClassFeatureChoice[]> {
	const resolverData = await loadResolverData()
	return chosenClassFeatureChoicesFrom(character, resolverData)
}
