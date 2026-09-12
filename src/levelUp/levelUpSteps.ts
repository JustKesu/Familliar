import { WIZARD_STEPS, type WizardStep, type WizardStepConditions } from '../creation/wizardState'
import type { Character } from '../storage/character'
import type { LevelGains } from './levelGains'

export const MAX_CHARACTER_LEVEL = 20

export function totalCharacterLevel(character: Character): number {
	return character.classes.reduce((total, entry) => total + entry.level, 0)
}

/**
 * The level a Level up would take this character to, or why there is none.
 * Only what can be told without the data: whether a level-up is answerable at
 * all (multiclass, a class missing from classes.json) is levelGainsFor's
 * `unresolved`.
 */
export function levelUpTarget(character: Character): { level: number } | { reason: string } {
	if (character.classes.length === 0) return { reason: 'This character has no class yet.' }
	const level = totalCharacterLevel(character)
	if (level >= MAX_CHARACTER_LEVEL) return { reason: `Level ${MAX_CHARACTER_LEVEL} is the highest character level.` }
	return { level: level + 1 }
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
export function levelUpStepConditions(gains: LevelGains): Pick<WizardStepConditions, 'levelUpSteps' | 'levelUpTargetLevel'> {
	const walked = WIZARD_STEPS.filter(
		(step) => ALWAYS_WALKED.includes(step) || gains.steps[step].status === 'adds' || gains.steps[step].status === 'unknown',
	)
	return { levelUpSteps: new Set(walked), levelUpTargetLevel: gains.level }
}

/** Why each walked `unknown` step could not be answered — shown on that step so the player checks it by hand. */
export function unknownLevelUpSteps(gains: LevelGains): Partial<Record<WizardStep, string>> {
	return Object.fromEntries(
		WIZARD_STEPS.filter((step) => !ALWAYS_WALKED.includes(step) && gains.steps[step].status === 'unknown').map((step) => [
			step,
			gains.steps[step].reason ?? '',
		]),
	)
}
