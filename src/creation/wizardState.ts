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

import type {
	AbilityBonusMap,
	Character,
	CharacterBackground,
	CharacterClass,
	CharacterLanguage,
	CharacterOptionalFeatureChoice,
} from '../storage/character'
import type { CharacterStore } from '../storage/characterStore'
import type { ClassLevelChoice } from '../classes/ClassPicker'
import type { SpeciesChoice } from '../species/SpeciesPicker'
import type { BackgroundChoice } from '../backgrounds/BackgroundPicker'
import type { LanguageChoice } from '../languages/LanguagePicker'
import { AUTOMATIC_LANGUAGE, CHOSEN_LANGUAGE_COUNT } from '../languages/languageData'
import type { CharacterAbilityScores } from '../abilities/abilityScores'

/**
 * The chosen subclass, name and source together — carrying `featureType`
 * (see SubclassOption in subclassData.ts) alongside so the class step's
 * optional-feature picks can be tagged with the progression they came from
 * (D21) without loading the subclass list a second time.
 */
export interface SubclassChoice {
	name: string
	source: string
	featureType: string | null
}

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
	/** Class skill proficiencies, weapon masteries, fighting style and subclass are the class's own choices (D13), so they clear whenever classChoice does. */
	classSkills: string[]
	masteries: string[]
	fightingStyle: string | null
	subclass: SubclassChoice | null
	/** The subclass's own optionalfeatureProgression picks (D21) — clear whenever class, level or subclass changes, since the options are keyed to a specific subclass. */
	optionalFeatureChoices: string[]
}

export function emptyWizardData(): WizardData {
	return {
		name: '',
		classChoice: null,
		speciesChoice: null,
		backgroundChoice: null,
		languageChoice: [],
		abilityScores: null,
		classSkills: [],
		masteries: [],
		fightingStyle: null,
		subclass: null,
		optionalFeatureChoices: [],
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
	| { type: 'setClassSkills'; skills: string[] }
	| { type: 'setMasteries'; weapons: string[] }
	| { type: 'setFightingStyle'; style: string | null }
	| { type: 'setSubclass'; subclass: SubclassChoice | null }
	| { type: 'setOptionalFeatureChoices'; choices: string[] }

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
			return {
				...state,
				data: {
					...state.data,
					classChoice: action.choice,
					classSkills: [],
					masteries: [],
					fightingStyle: null,
					subclass: null,
					optionalFeatureChoices: [],
				},
			}
		case 'setSpeciesChoice':
			return { ...state, data: { ...state.data, speciesChoice: action.choice } }
		case 'setBackgroundChoice':
			return { ...state, data: { ...state.data, backgroundChoice: action.choice } }
		case 'setLanguageChoice':
			return { ...state, data: { ...state.data, languageChoice: action.choice } }
		case 'setAbilityScores':
			return { ...state, data: { ...state.data, abilityScores: action.scores } }
		case 'setClassSkills':
			return { ...state, data: { ...state.data, classSkills: action.skills } }
		case 'setMasteries':
			return { ...state, data: { ...state.data, masteries: action.weapons } }
		case 'setFightingStyle':
			return { ...state, data: { ...state.data, fightingStyle: action.style } }
		case 'setSubclass':
			return { ...state, data: { ...state.data, subclass: action.subclass, optionalFeatureChoices: [] } }
		case 'setOptionalFeatureChoices':
			return { ...state, data: { ...state.data, optionalFeatureChoices: action.choices } }
	}
}

/**
 * The single write to storage in the whole wizard (task instructions,
 * CLAUDE.md-adjacent rule from PHASE1.md section D: nothing is written
 * until the flow completes). Throws if called before every picker step is
 * complete rather than silently saving a partial character.
 *
 * `backgroundSkillProficiencies` is the selected background's two fixed
 * skills (BackgroundEntry.skillProficiencies) — the wizard's own
 * BackgroundChoice doesn't carry them (see BackgroundPicker.tsx), so the
 * caller (CharacterWizard.tsx, which already resolves the full
 * BackgroundEntry for D18's disabled-skills wiring) passes them in here.
 */
export function saveCharacter(
	store: CharacterStore,
	data: WizardData,
	backgroundSkillProficiencies?: [string, string],
): Character {
	if (!isReadyToSave(data)) {
		throw new Error('Cannot save a character before every step is complete.')
	}

	const classes: CharacterClass[] = data.classChoice
		? [
				{
					className: data.classChoice.className,
					classSource: data.classChoice.classSource,
					subclass: data.subclass?.name ?? null,
					level: data.classChoice.level,
				},
			]
		: []

	const background: CharacterBackground | undefined =
		data.backgroundChoice && backgroundSkillProficiencies
			? {
					name: data.backgroundChoice.name,
					source: data.backgroundChoice.source,
					skillProficiencies: backgroundSkillProficiencies,
				}
			: undefined

	const abilityBonus: AbilityBonusMap | undefined = data.backgroundChoice?.abilityBonus

	/**
	 * Common is added here, not in the picker's own value — the picker only
	 * ever reports the player's picks. Every known language carries
	 * `grantedBy` so its source survives into storage (see
	 * CharacterLanguage in storage/character.ts).
	 */
	const languages: CharacterLanguage[] | undefined =
		data.languageChoice.length > 0
			? [
					{ ...AUTOMATIC_LANGUAGE, grantedBy: 'automatic' },
					...data.languageChoice.map((entry) => ({ ...entry, grantedBy: 'creation' as const })),
				]
			: undefined

	/** Tagged with the subclass's own featureType (D21) so more than one progression's picks could coexist later without ambiguity — see CharacterOptionalFeatureChoice. */
	const optionalFeatureChoices: CharacterOptionalFeatureChoice[] | undefined =
		data.optionalFeatureChoices.length > 0 && data.subclass?.featureType
			? [{ featureType: data.subclass.featureType, choices: data.optionalFeatureChoices }]
			: undefined

	return store.create(
		data.name,
		classes,
		data.abilityScores ?? undefined,
		data.speciesChoice ?? undefined,
		background,
		abilityBonus,
		languages,
		data.classSkills,
		data.masteries,
		data.fightingStyle,
		optionalFeatureChoices,
	)
}
