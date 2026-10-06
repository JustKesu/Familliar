import { WIZARD_STEPS, type WizardStep, type WizardStepConditions } from '../creation/wizardState'
import { totalCharacterLevel } from '../calculation/characterLevel'
import type { Character } from '../storage/character'
import type { LevelGains } from './levelGains'

export const MAX_CHARACTER_LEVEL = 20

/**
 * The level a Level up would take this character to, or why there is none.
 * Only what can be told without the data: whether a level-up is answerable at
 * all (a class missing from classes.json) is levelGainsFor's `unresolved`.
 */
export function levelUpTarget(character: Character): { level: number; className: string; classSource: string } | { reason: string } {
	if (character.classes.length === 0) return { reason: 'This character has no class yet.' }
	const level = totalCharacterLevel(character.classes)
	if (level >= MAX_CHARACTER_LEVEL) return { reason: `Level ${MAX_CHARACTER_LEVEL} is the highest character level.` }
	// D316/D328: levelGainsFor answers any class, but choosing which one is M7, so more than one class stays blocked here.
	if (character.classes.length > 1) {
		return { reason: `Multiclass characters are build order step 10: this character has ${character.classes.length} classes and nothing records which one the new level belongs to.` }
	}
	const { className, classSource } = character.classes[0]
	return { level: level + 1, className, classSource }
}

/**
 * D92: every level from 2 up adds a hit die, and the review step is where the
 * save happens — both are walked whatever the step statuses say.
 */
const ALWAYS_WALKED: readonly WizardStep[] = ['hitPoints', 'review']

/**
 * The wizard steps one level up walks: every step the level adds to, every step
 * the app cannot answer for (hiding one would silently skip a choice the
 * character may be owed), plus hit points and review.
 */
export function levelUpStepConditions(gains: LevelGains, chosenSubclass: string | null = null): Pick<WizardStepConditions, 'levelUpSteps' | 'levelUpTargetLevel'> {
	const walked = WIZARD_STEPS.filter(
		(step) =>
			ALWAYS_WALKED.includes(step) ||
			gains.steps[step].status === 'adds' ||
			(gains.steps[step].status === 'unknown' && !answeredByChosenSubclass(gains, step, chosenSubclass)),
	)
	return { levelUpSteps: new Set(walked), levelUpTargetLevel: gains.level }
}

/** D177: once the class step has chosen the subclass, the languages step is walked only if that subclass owes a pick. */
function answeredByChosenSubclass(gains: LevelGains, step: WizardStep, chosenSubclass: string | null): boolean {
	const owing = gains.steps[step].owingSubclasses
	return step === 'languages' && chosenSubclass !== null && gains.unresolved === null && owing !== undefined && !owing.includes(chosenSubclass)
}

/**
 * Why each walked `unknown` step could not be answered — shown on that step so the player checks it by hand.
 * D176: the languages step is unknown only while the subclass chosen at this level is not; once the class
 * step has chosen it (`chosenSubclass`), that step's slots are exact and no reason is left.
 */
export function unknownLevelUpSteps(gains: LevelGains, chosenSubclass: string | null = null): Partial<Record<WizardStep, string>> {
	const answered = (step: WizardStep) => step === 'languages' && chosenSubclass !== null && gains.unresolved === null
	return Object.fromEntries(
		WIZARD_STEPS.filter((step) => !ALWAYS_WALKED.includes(step) && gains.steps[step].status === 'unknown' && !answered(step)).map((step) => [
			step,
			gains.steps[step].reason ?? '',
		]),
	)
}
