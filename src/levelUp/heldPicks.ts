import type { WizardData } from '../creation/wizardState'
import { choiceNames, type Character } from '../storage/character'

/**
 * D108: the class-step and expertise picks a character already carries when a
 * level up starts. A level up may add to these, never remove or change them.
 * Wild Shape forms and spells are absent on purpose — D104/D106 let the player
 * swap those at any time.
 */
export interface HeldPicks {
	subclass: string | null
	fightingStyle: string | null
	classSkills: readonly string[]
	masteries: readonly string[]
	expertiseSkills: readonly string[]
	/** The subclass's own optionalfeatureProgression picks (Battle Master maneuvers). */
	subclassOptionalFeatures: readonly string[]
	/** Feature names of the D21 "pick one version" choices already made. */
	classFeatureChoices: readonly string[]
}

/** `subclassFeatureType` tells the subclass's optional-feature entry apart from the class's own — storage carries no other marker. */
export function heldPicksFrom(character: Character, subclassFeatureType: string | null): HeldPicks {
	return {
		subclass: character.classes[0]?.subclass ?? null,
		fightingStyle: character.fightingStyle ?? null,
		classSkills: character.classSkills ?? [],
		masteries: choiceNames(character.masteries),
		expertiseSkills: choiceNames(character.expertiseSkills),
		subclassOptionalFeatures:
			subclassFeatureType === null
				? []
				: choiceNames(character.optionalFeatureChoices?.find((entry) => entry.featureType === subclassFeatureType)?.choices),
		classFeatureChoices: (character.classFeatureChoices ?? []).map((choice) => choice.featureName),
	}
}

/** Every held pick `data` would drop or change, worded for an error message. Empty when the walk only adds. */
export function overwrittenHeldPicks(character: Character, data: WizardData): string[] {
	const held = heldPicksFrom(character, data.subclass?.featureType ?? null)
	const problems: string[] = []

	if (held.subclass !== null && held.subclass.toLowerCase() !== (data.subclass?.name ?? '').toLowerCase()) {
		problems.push(`subclass ${held.subclass}`)
	}
	if (held.fightingStyle !== null && held.fightingStyle !== data.fightingStyle) {
		problems.push(`fighting style ${held.fightingStyle}`)
	}
	const missing = (label: string, before: readonly string[], after: readonly string[]): void => {
		for (const name of before) if (!after.includes(name)) problems.push(`${label} ${name}`)
	}
	missing('class skill', held.classSkills, data.classSkills)
	missing('weapon mastery', held.masteries, data.masteries)
	missing('expertise', held.expertiseSkills, data.expertiseSkills)
	missing('option', held.subclassOptionalFeatures, data.optionalFeatureChoices)
	for (const stored of character.classFeatureChoices ?? []) {
		const now = data.classFeatureChoices.find((choice) => choice.featureName === stored.featureName)
		if (now?.optionName !== stored.optionName) problems.push(`${stored.featureName} ${stored.optionName}`)
	}
	return problems
}
