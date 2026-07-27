/*
 * Character creation wizard — pure state and logic (PHASE1.md build order
 * step 3, "Character creation is a multi-step wizard, organised by
 * category", section D). No React and no storage access here, so the
 * navigation rules and the save assembly can be tested without a DOM.
 *
 * Steps 5 (spells) and 6 (equipment) are not built yet. Adding them later
 * means adding an entry to WIZARD_STEPS, a case in isStepComplete, and a
 * panel in CharacterWizard.tsx — not reworking any of this.
 */

import type { AbilityBonusMap, Character, CharacterClass } from '../storage/character'
import type { CharacterStore } from '../storage/characterStore'
import type { ClassLevelChoice } from '../classes/ClassPicker'
import type { SpeciesChoice } from '../species/SpeciesPicker'
import type { BackgroundChoice } from '../backgrounds/BackgroundPicker'
import type { LanguageChoice } from '../languages/LanguagePicker'
import { CHOSEN_LANGUAGE_COUNT } from '../languages/languageData'
import type { CharacterAbilityScores } from '../abilities/abilityScores'

export const WIZARD_STEPS = ['class', 'species', 'background', 'languages', 'abilities', 'review'] as const
export type WizardStep = (typeof WIZARD_STEPS)[number]

/** The picker steps only — every one of these must be complete before the review step may save. */
const PICKER_STEPS: readonly WizardStep[] = ['class', 'species', 'background', 'languages', 'abilities']

/** The in-progress character. Nothing here is written to storage until saveCharacter runs. */
export interface WizardData {
	name: string
	classChoice: ClassLevelChoice | null
	speciesChoice: SpeciesChoice | null
	backgroundChoice: BackgroundChoice | null
	languageChoice: LanguageChoice
	abilityScores: CharacterAbilityScores | null
}

export function emptyWizardData(): WizardData {
	return {
		name: '',
		classChoice: null,
		speciesChoice: null,
		backgroundChoice: null,
		languageChoice: [],
		abilityScores: null,
	}
}

export interface WizardControllerState {
	step: WizardStep
	data: WizardData
}

export function initialControllerState(): WizardControllerState {
	return { step: WIZARD_STEPS[0], data: emptyWizardData() }
}

export function stepIndex(step: WizardStep): number {
	return WIZARD_STEPS.indexOf(step)
}

function nextStep(step: WizardStep): WizardStep | null {
	const idx = stepIndex(step)
	return idx < WIZARD_STEPS.length - 1 ? WIZARD_STEPS[idx + 1] : null
}

function previousStep(step: WizardStep): WizardStep | null {
	const idx = stepIndex(step)
	return idx > 0 ? WIZARD_STEPS[idx - 1] : null
}

/**
 * Whether `step` itself has a valid selection — what counts as valid is
 * exactly what that step's own picker already validates (a non-null
 * choice), plus the character name on the class step, since nothing else
 * collects it. No second layer of rules beyond that.
 */
export function isStepComplete(step: WizardStep, data: WizardData): boolean {
	switch (step) {
		case 'class':
			return data.name.trim() !== '' && data.classChoice !== null
		case 'species':
			return data.speciesChoice !== null
		case 'background':
			return data.backgroundChoice !== null
		case 'languages':
			return data.languageChoice.length === CHOSEN_LANGUAGE_COUNT
		case 'abilities':
			return data.abilityScores !== null
		case 'review':
			return true
	}
}

/** Whether every picker step is complete — the gate for the review step's save button. */
export function isReadyToSave(data: WizardData): boolean {
	return PICKER_STEPS.every((step) => isStepComplete(step, data))
}

export type WizardAction =
	| { type: 'next' }
	| { type: 'back' }
	| { type: 'setName'; name: string }
	| { type: 'setClassChoice'; choice: ClassLevelChoice | null }
	| { type: 'setSpeciesChoice'; choice: SpeciesChoice | null }
	| { type: 'setBackgroundChoice'; choice: BackgroundChoice | null }
	| { type: 'setLanguageChoice'; choice: LanguageChoice }
	| { type: 'setAbilityScores'; scores: CharacterAbilityScores | null }

/**
 * Pure navigation + edit reducer. `next` is a no-op unless the current step
 * is complete; `back` always succeeds and never touches `data`, so whatever
 * was already chosen on earlier steps survives the round trip.
 */
export function wizardReducer(state: WizardControllerState, action: WizardAction): WizardControllerState {
	switch (action.type) {
		case 'next': {
			if (!isStepComplete(state.step, state.data)) return state
			const next = nextStep(state.step)
			return next ? { ...state, step: next } : state
		}
		case 'back': {
			const prev = previousStep(state.step)
			return prev ? { ...state, step: prev } : state
		}
		case 'setName':
			return { ...state, data: { ...state.data, name: action.name } }
		case 'setClassChoice':
			return { ...state, data: { ...state.data, classChoice: action.choice } }
		case 'setSpeciesChoice':
			return { ...state, data: { ...state.data, speciesChoice: action.choice } }
		case 'setBackgroundChoice':
			return { ...state, data: { ...state.data, backgroundChoice: action.choice } }
		case 'setLanguageChoice':
			return { ...state, data: { ...state.data, languageChoice: action.choice } }
		case 'setAbilityScores':
			return { ...state, data: { ...state.data, abilityScores: action.scores } }
	}
}

/**
 * The single write to storage in the whole wizard (task instructions,
 * CLAUDE.md-adjacent rule from PHASE1.md section D: nothing is written
 * until the flow completes). Throws if called before every picker step is
 * complete rather than silently saving a partial character.
 */
export function saveCharacter(store: CharacterStore, data: WizardData): Character {
	if (!isReadyToSave(data)) {
		throw new Error('Cannot save a character before every step is complete.')
	}

	const classes: CharacterClass[] = data.classChoice
		? [
				{
					className: data.classChoice.className,
					classSource: data.classChoice.classSource,
					subclass: null,
					level: data.classChoice.level,
				},
			]
		: []

	const abilityBonus: AbilityBonusMap | undefined = data.backgroundChoice?.abilityBonus

	return store.create(
		data.name,
		classes,
		data.abilityScores ?? undefined,
		data.speciesChoice ?? undefined,
		data.backgroundChoice ? { name: data.backgroundChoice.name, source: data.backgroundChoice.source } : undefined,
		abilityBonus,
		data.languageChoice.length > 0 ? data.languageChoice : undefined,
	)
}
