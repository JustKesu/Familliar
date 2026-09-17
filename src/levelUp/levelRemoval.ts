import { computeCharacterResources, resourceUsesWithinMaxima, type ResourceFeature } from '../calculation/resources'
import { computeSpellSlots, spellSlotMaxima, spentSpellSlotsWithinMaxima } from '../calculation/spellSlots'
import { extractSpellSlotsClassData } from '../spells/spellSlotsClassData'
import { loadDataFile } from '../dataLoader/dataLoader'
import { loadResolverData, type ResolverData } from '../featureResolver'
import { grantsFightingStyleAt } from '../fightingStyle/fightingStyleData'
import { chosenOptionalFeatureOptions } from '../optionalFeatures/optionalFeatureData'
import { grantedClassFeaturesFrom } from '../sheet/grantedClassFeatures'
import { extractFeatTextEntries } from '../sheet/sheetData'
import type { Character, LeveledChoice } from '../storage/character'
import type { CharacterCreateInput } from '../storage/characterStore'
import { subclassLevelFor } from '../subclass/subclassData'
import { totalCharacterLevel } from './levelUpSteps'

/**
 * The level a Remove level would take off, or why there is none. Only what can
 * be told without the data; a subclass whose grant level cannot be read is
 * levelRemovalPlan's reason.
 */
export function levelRemovalTarget(character: Character): { level: number } | { reason: string } {
	if (character.classes.length === 0) return { reason: 'This character has no class yet.' }
	if (character.classes.length > 1) {
		return { reason: `Multiclass characters are build order step 10: nothing records which of the ${character.classes.length} classes the last level belongs to.` }
	}
	const level = totalCharacterLevel(character)
	if (level <= 1) return { reason: 'Level 1 is the lowest character level.' }
	if (character.createdAtLevel === undefined) {
		return { reason: 'The level this character was created at is not known (it was saved before that was recorded), so its creation choices cannot be told apart from later ones.' }
	}
	if (level <= character.createdAtLevel) {
		return { reason: `This character was created at level ${character.createdAtLevel}; there is no level above that to remove.` }
	}
	return { level }
}

/**
 * The three feature sources a resource can come from (slice 9b1) — the same set
 * featureActionRowData.ts feeds the actions table, assembled from the files this
 * module already holds. A Battle Master's Superiority Die is named only by the
 * maneuvers they chose, so the optional-feature picks are not optional here.
 */
function resourceFeaturesFor(character: Character, parsedClasses: unknown, resolverData: ResolverData): ResourceFeature[] {
	const featTexts = extractFeatTextEntries(resolverData.feats)
	const feats = (character.featAsiChoices ?? [])
		.filter((choice) => choice.kind === 'feat')
		.flatMap((choice) => featTexts.filter((text) => text.name === choice.name && text.source === choice.source))
	return [
		...grantedClassFeaturesFrom(character, parsedClasses, resolverData),
		...feats,
		...chosenOptionalFeatureOptions(resolverData.optionalFeatures, resolverData.feats, character.optionalFeatureChoices ?? [], character.fightingStyle ?? null),
	]
}

export interface LevelRemovalPlan {
	level: number
	/** One line per thing the removal deletes, for the confirmation to show. */
	dropped: string[]
	result: Character
}

function withoutLevel<T extends LeveledChoice>(choices: readonly T[] | undefined, level: number): { kept: T[]; dropped: T[] } {
	const all = choices ?? []
	return { kept: all.filter((choice) => choice.level !== level), dropped: all.filter((choice) => choice.level === level) }
}

/**
 * The character with its top level removed (slice 8e). Drops exactly what
 * carries that level; a choice with no level is a creation pick and is never
 * touched. Known and prepared spells stay: they carry no level by design.
 *
 * `parsedClasses` is classes.json; `resolverData` supplies class-features.json.
 */
export function levelRemovalPlan(character: Character, parsedClasses: unknown, resolverData: ResolverData): LevelRemovalPlan | { reason: string } {
	const target = levelRemovalTarget(character)
	if ('reason' in target) return target
	const { level } = target
	const characterClass = character.classes[0]
	const { className, classSource } = characterClass
	const dropped: string[] = []

	// Derived, not stored (D101): the subclass and the fighting style belong to the level the class grants them at.
	let subclass = characterClass.subclass
	if (subclass !== null) {
		const subclassLevel = subclassLevelFor(parsedClasses, resolverData.classFeatures, className, classSource)
		if (subclassLevel === null) {
			return { reason: `Cannot tell at which level "${className}" (${classSource}) chooses a subclass, so whether "${subclass}" goes with level ${level} is unknown.` }
		}
		if (subclassLevel === level) {
			dropped.push(`Subclass: ${subclass}`)
			subclass = null
		}
	}

	let fightingStyle = character.fightingStyle
	if (fightingStyle && grantsFightingStyleAt(resolverData.classFeatures, className, classSource) === level) {
		dropped.push(`Fighting style: ${fightingStyle}`)
		fightingStyle = null
	}

	const masteries = withoutLevel(character.masteries, level)
	dropped.push(...masteries.dropped.map((choice) => `Weapon mastery: ${choice.name}`))

	const expertiseSkills = withoutLevel(character.expertiseSkills, level)
	dropped.push(...expertiseSkills.dropped.map((choice) => `Expertise: ${choice.name}`))

	const optionalFeatureChoices = (character.optionalFeatureChoices ?? []).flatMap((entry) => {
		const choices = withoutLevel(entry.choices, level)
		dropped.push(...choices.dropped.map((choice) => `${entry.featureType} option: ${choice.name}`))
		// Nested spell picks are spells, which removal leaves alone; the entry stays while it still holds any.
		if (choices.kept.length === 0 && (entry.spellChoices ?? []).length === 0) return []
		return [{ ...entry, choices: choices.kept }]
	})

	const featAsiChoices = (character.featAsiChoices ?? []).filter((choice) => {
		if (choice.level !== level) return true
		dropped.push(choice.kind === 'feat' ? `Feat: ${choice.name}` : 'Ability Score Improvement')
		return false
	})

	const classFeatureChoices = (character.classFeatureChoices ?? []).filter((choice) => {
		if (choice.grantedAtLevel !== level) return true
		dropped.push(`${choice.featureName}: ${choice.optionName}`)
		return false
	})

	const subclassSpellChoices = (character.subclassSpellChoices ?? []).flatMap((entry) => {
		const picks = entry.picks.filter((pick) => {
			if (pick.grantedAtLevel !== level) return true
			dropped.push(`${entry.subclassName} spell choice: ${pick.name}`)
			return false
		})
		return picks.length > 0 ? [{ ...entry, picks }] : []
	})

	const hitPointLevels = (character.hitPointLevels ?? []).filter((entry) => {
		if (entry.level !== level) return true
		dropped.push(`Hit points for level ${level}`)
		return false
	})

	const { play: _play, ...withoutPlay } = character
	const result: Character = {
		...withoutPlay,
		...(character.play ? { play: character.play } : {}),
		classes: [{ ...characterClass, subclass, level: characterClass.level - 1 }],
		fightingStyle,
		masteries: masteries.kept,
		expertiseSkills: expertiseSkills.kept,
		optionalFeatureChoices,
		featAsiChoices,
		classFeatureChoices,
		subclassSpellChoices,
		hitPointLevels,
	}

	/*
	 * Slice 9b1: a lower level means smaller pools, so a spent count recorded
	 * against the old maximum can now exceed the new one. Computed against the
	 * REDUCED character — the point is the maximum it has after this removal.
	 */
	const storedUses = character.play?.resourceUses
	if (storedUses !== undefined) {
		const resources = computeCharacterResources(result, parsedClasses, resourceFeaturesFor(result, parsedClasses, resolverData))
		const clamped = resourceUsesWithinMaxima(storedUses, resources)
		for (const [name, spent] of Object.entries(storedUses)) {
			const now = clamped?.[name] ?? 0
			if (now < spent) dropped.push(`${name}: ${spent} spent, now ${now}`)
		}
		const { resourceUses: _uses, ...restOfPlay } = character.play ?? {}
		const play = { ...restOfPlay, ...(clamped ? { resourceUses: clamped } : {}) }
		delete result.play
		if (Object.keys(play).length > 0) result.play = play
	}

	/*
	 * Slice 9b3: the same invariant one pool over — a level's worth of spell slots
	 * can disappear, and a spent count recorded against the old table would outlive
	 * it. Computed against the REDUCED character, like the resource maxima above.
	 * computeSpellSlots returning `unknown` is not "no slots", so nothing is
	 * clamped then and the stored counts stand.
	 */
	const storedSlots = result.play?.spentSpellSlots
	if (storedSlots !== undefined) {
		const slots = computeSpellSlots(result, extractSpellSlotsClassData(parsedClasses))
		if (slots.status === 'known') {
			const clamped = spentSpellSlotsWithinMaxima(storedSlots, spellSlotMaxima(slots.value))
			for (const [slotLevel, spent] of Object.entries(storedSlots.ordinary ?? {})) {
				const now = clamped?.ordinary?.[Number(slotLevel)] ?? 0
				if (now < spent) dropped.push(`Level ${slotLevel} spell slots: ${spent} spent, now ${now}`)
			}
			const pactNow = clamped?.pact ?? 0
			if (storedSlots.pact !== undefined && pactNow < storedSlots.pact) {
				dropped.push(`Pact Magic slots: ${storedSlots.pact} spent, now ${pactNow}`)
			}
			const { spentSpellSlots: _slots, ...restOfPlay } = result.play ?? {}
			const play = { ...restOfPlay, ...(clamped ? { spentSpellSlots: clamped } : {}) }
			delete result.play
			if (Object.keys(play).length > 0) result.play = play
		}
	}

	return { level, dropped, result }
}

/** The store's update input for a whole character — everything but the id, which `update` keeps. */
export function characterUpdateInput({ id: _id, ...input }: Character): CharacterCreateInput {
	return input
}

/** Fetches classes.json and the resolver files and returns levelRemovalPlan's result. */
export async function loadLevelRemovalPlan(character: Character): Promise<LevelRemovalPlan | { reason: string }> {
	const [classes, resolverData] = await Promise.all([loadDataFile('data/classes.json'), loadResolverData()])
	return levelRemovalPlan(character, classes, resolverData)
}
