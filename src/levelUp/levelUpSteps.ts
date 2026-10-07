import { WIZARD_STEPS, type WizardStep, type WizardStepConditions } from '../creation/wizardState'
import { totalCharacterLevel } from '../calculation/characterLevel'
import { isConsistentLevelOrder, type Character, type CharacterClass } from '../storage/character'
import type { LevelGains, LevelUpClass } from './levelGains'

export const MAX_CHARACTER_LEVEL = 20

export const NO_LEVEL_HISTORY_REASON = 'Cannot tell which class each level came from (no level history).'

/** The classes a Level up may raise, or why none. More than one class needs a consistent levelOrder (D329). */
export function levelUpClassOptions(character: Character): { options: CharacterClass[] } | { reason: string } {
	if (character.classes.length === 0) return { reason: 'This character has no class yet.' }
	if (totalCharacterLevel(character.classes) >= MAX_CHARACTER_LEVEL) return { reason: `Level ${MAX_CHARACTER_LEVEL} is the highest character level.` }
	if (character.classes.length > 1 && !(character.levelOrder && isConsistentLevelOrder(character.levelOrder, character.classes))) {
		return { reason: NO_LEVEL_HISTORY_REASON }
	}
	const options = character.classes.filter((entry) => entry.level < MAX_CHARACTER_LEVEL)
	return options.length > 0 ? { options } : { reason: `Level ${MAX_CHARACTER_LEVEL} is the highest class level.` }
}

/**
 * The level a Level up would take this character to, or why there is none.
 * Only what can be told without the data: whether a level-up is answerable at
 * all (a class missing from classes.json) is levelGainsFor's `unresolved`.
 * D329: a multiclass character names the class (`chosen`); a single class may omit it.
 */
export function levelUpTarget(character: Character, chosen?: LevelUpClass): { level: number; className: string; classSource: string } | { reason: string } {
	const allowed = levelUpClassOptions(character)
	if ('reason' in allowed) return allowed
	const level = totalCharacterLevel(character.classes) + 1
	if (chosen === undefined) {
		if (character.classes.length > 1) return { reason: 'Choose which class gains the level.' }
		const { className, classSource } = character.classes[0]
		return { level, className, classSource }
	}
	const held = allowed.options.find((entry) => entry.className === chosen.className && entry.classSource === chosen.classSource)
	if (!held) return { reason: `This character has no ${chosen.className} (${chosen.classSource}) class below level ${MAX_CHARACTER_LEVEL}.` }
	return { level, className: held.className, classSource: held.classSource }
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
