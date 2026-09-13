import type { WizardData } from '../creation/wizardState'
import { choiceNames, type Character, type CharacterOptionalFeatureChoice, type FeatAsiChoice } from '../storage/character'

/**
 * D108/D110: the class-step, expertise, feat/ASI and class-optional-feature
 * picks a character already carries when a level up starts. A level up may
 * add to these, never remove or change them. Wild Shape forms and spells are
 * absent on purpose — D104/D106 let the player swap those at any time.
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
	/** D16/D19/D20 ASI-or-feat choices already made, one per grant level. */
	featAsiChoices: readonly FeatAsiChoice[]
	/** The CLASS's own optionalfeatureProgression picks (D64 — Sorcerer Metamagic, Warlock Eldritch Invocations), one entry per featureType. The subclass's own progression is excluded — that one lives in `subclassOptionalFeatures`. */
	classOptionalFeatureChoices: readonly CharacterOptionalFeatureChoice[]
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
		featAsiChoices: character.featAsiChoices ?? [],
		classOptionalFeatureChoices: (character.optionalFeatureChoices ?? []).filter((entry) => entry.featureType !== subclassFeatureType),
	}
}

/** Whether two FeatAsiChoice entries name the same pick — chosenAbility and any nested spell sub-picks are not compared, the same way subclassOptionalFeatures' nested spellChoices aren't. */
function sameFeatAsiChoice(a: FeatAsiChoice, b: FeatAsiChoice): boolean {
	if (a.kind !== b.kind) return false
	if (a.kind === 'feat' && b.kind === 'feat') return a.name === b.name && a.source === b.source
	if (a.kind === 'asi' && b.kind === 'asi') {
		const abilities = new Set([...Object.keys(a.increases), ...Object.keys(b.increases)])
		return [...abilities].every((ability) => a.increases[ability as keyof typeof a.increases] === b.increases[ability as keyof typeof b.increases])
	}
	return false
}

function describeFeatAsi(choice: FeatAsiChoice): string {
	return choice.kind === 'feat' ? choice.name : 'ASI'
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
	for (const heldEntry of held.classOptionalFeatureChoices) {
		const nowNames = choiceNames(data.classOptionalFeatureChoices.find((entry) => entry.featureType === heldEntry.featureType)?.choices)
		missing('class option', choiceNames(heldEntry.choices), nowNames)
	}
	for (const heldChoice of held.featAsiChoices) {
		const nowChoice = data.featAsiChoices.find((choice) => choice.level === heldChoice.level)
		if (!nowChoice || !sameFeatAsiChoice(heldChoice, nowChoice)) {
			problems.push(`feat/ASI level ${heldChoice.level} ${describeFeatAsi(heldChoice)}`)
		}
	}
	return problems
}
