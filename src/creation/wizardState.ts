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

export const WIZARD_STEPS = ['class', 'species', 'background', 'expertise', 'languages', 'abilities', 'review'] as const
export type WizardStep = (typeof WIZARD_STEPS)[number]

/**
 * The steps actually shown to the player. `expertise` only appears when the
 * class grants it by the chosen level (task instructions, point 2) — a
 * `null` count means no entitlement at all, so the step is skipped
 * entirely rather than shown empty, and the numbering of every step after
 * it shifts down to stay contiguous.
 */
export function visibleSteps(expertiseRequiredCount: number | null): readonly WizardStep[] {
	return expertiseRequiredCount === null ? WIZARD_STEPS.filter((step) => step !== 'expertise') : WIZARD_STEPS
}

/** The picker steps only — every one of these must be complete before the review step may save. */
function pickerSteps(expertiseRequiredCount: number | null): readonly WizardStep[] {
	return visibleSteps(expertiseRequiredCount).filter((step) => step !== 'review')
}

/** The in-progress character. Nothing here is written to storage until saveCharacter runs. */
export interface WizardData {
	name: string
	classChoice: ClassLevelChoice | null
	speciesChoice: SpeciesChoice | null
	backgroundChoice: BackgroundChoice | null
	/** The background's tool proficiency — the named tool (auto-filled) or the player's category pick. Clears whenever backgroundChoice does (D8), since a category choice is keyed to a specific background. */
	backgroundToolProficiency: string | null
	languageChoice: LanguageChoice
	abilityScores: CharacterAbilityScores | null
	/** Class skill proficiencies, weapon masteries, fighting style and subclass are the class's own choices (D13), so they clear whenever classChoice does. */
	classSkills: string[]
	/** The species' skill proficiencies (fixed and/or chosen) — clears whenever speciesChoice does, since the options are keyed to a specific species. */
	speciesSkills: string[]
	/** Which already-proficient skills the player named as Expertise (D8) — clears whenever class, level, class skills, species, species skills or background change, since all of those affect the offer or the count (task instructions, point 4). */
	expertiseSkills: string[]
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
		backgroundToolProficiency: null,
		languageChoice: [],
		abilityScores: null,
		classSkills: [],
		speciesSkills: [],
		expertiseSkills: [],
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

export function stepIndex(step: WizardStep, expertiseRequiredCount: number | null = null): number {
	return visibleSteps(expertiseRequiredCount).indexOf(step)
}

function nextStep(step: WizardStep, expertiseRequiredCount: number | null): WizardStep | null {
	const steps = visibleSteps(expertiseRequiredCount)
	const idx = steps.indexOf(step)
	return idx < steps.length - 1 ? steps[idx + 1] : null
}

function previousStep(step: WizardStep, expertiseRequiredCount: number | null): WizardStep | null {
	const steps = visibleSteps(expertiseRequiredCount)
	const idx = steps.indexOf(step)
	return idx > 0 ? steps[idx - 1] : null
}

/**
 * Whether `step` itself has a valid selection — what counts as valid is
 * exactly what that step's own picker already validates (a non-null
 * choice), plus the character name on the class step, since nothing else
 * collects it. No second layer of rules beyond that.
 *
 * `expertiseRequiredCount` is the number of Expertise skills the 'expertise'
 * step must collect — already adjusted down if the character has fewer
 * proficient skills than the class grants (task instructions, point 3), so
 * an exact-match check here never becomes impossible to satisfy. `null`
 * only reaches this case defensively; the step isn't offered at all then.
 */
export function isStepComplete(
	step: WizardStep,
	data: WizardData,
	expertiseRequiredCount: number | null = null,
): boolean {
	switch (step) {
		case 'class':
			return data.name.trim() !== '' && data.classChoice !== null
		case 'species':
			return data.speciesChoice !== null
		case 'background':
			return data.backgroundChoice !== null && data.backgroundToolProficiency !== null
		case 'expertise':
			return expertiseRequiredCount === null || data.expertiseSkills.length === expertiseRequiredCount
		case 'languages':
			return data.languageChoice.length === CHOSEN_LANGUAGE_COUNT
		case 'abilities':
			return data.abilityScores !== null
		case 'review':
			return true
	}
}

/** Whether every picker step is complete — the gate for the review step's save button. */
export function isReadyToSave(data: WizardData, expertiseRequiredCount: number | null = null): boolean {
	return pickerSteps(expertiseRequiredCount).every((step) => isStepComplete(step, data, expertiseRequiredCount))
}

export type WizardAction =
	| { type: 'next'; expertiseRequiredCount?: number | null }
	| { type: 'back'; expertiseRequiredCount?: number | null }
	| { type: 'setName'; name: string }
	| { type: 'setClassChoice'; choice: ClassLevelChoice | null }
	| { type: 'setSpeciesChoice'; choice: SpeciesChoice | null }
	| { type: 'setSpeciesSkills'; skills: string[] }
	| { type: 'setExpertiseSkills'; skills: string[] }
	| { type: 'setBackgroundChoice'; choice: BackgroundChoice | null }
	| { type: 'setBackgroundToolProficiency'; tool: string | null }
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
			const eligibility = action.expertiseRequiredCount ?? null
			if (!isStepComplete(state.step, state.data, eligibility)) return state
			const next = nextStep(state.step, eligibility)
			return next ? { ...state, step: next } : state
		}
		case 'back': {
			const prev = previousStep(state.step, action.expertiseRequiredCount ?? null)
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
					expertiseSkills: [],
					masteries: [],
					fightingStyle: null,
					subclass: null,
					optionalFeatureChoices: [],
				},
			}
		case 'setSpeciesChoice':
			return {
				...state,
				data: { ...state.data, speciesChoice: action.choice, speciesSkills: [], expertiseSkills: [] },
			}
		case 'setSpeciesSkills':
			return { ...state, data: { ...state.data, speciesSkills: action.skills, expertiseSkills: [] } }
		case 'setExpertiseSkills':
			return { ...state, data: { ...state.data, expertiseSkills: action.skills } }
		case 'setBackgroundChoice':
			return {
				...state,
				data: {
					...state.data,
					backgroundChoice: action.choice,
					backgroundToolProficiency: null,
					expertiseSkills: [],
				},
			}
		case 'setBackgroundToolProficiency':
			return { ...state, data: { ...state.data, backgroundToolProficiency: action.tool } }
		case 'setLanguageChoice':
			return { ...state, data: { ...state.data, languageChoice: action.choice } }
		case 'setAbilityScores':
			return { ...state, data: { ...state.data, abilityScores: action.scores } }
		case 'setClassSkills':
			return { ...state, data: { ...state.data, classSkills: action.skills, expertiseSkills: [] } }
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
 *
 * `expertiseRequiredCount` is the same value CharacterWizard.tsx already
 * computes for the 'expertise' step's own completion check — passed again
 * here so this final readiness check agrees with it exactly.
 */
export function saveCharacter(
	store: CharacterStore,
	data: WizardData,
	backgroundSkillProficiencies?: [string, string],
	expertiseRequiredCount: number | null = null,
): Character {
	if (!isReadyToSave(data, expertiseRequiredCount)) {
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
		data.backgroundChoice && backgroundSkillProficiencies && data.backgroundToolProficiency
			? {
					name: data.backgroundChoice.name,
					source: data.backgroundChoice.source,
					skillProficiencies: backgroundSkillProficiencies,
					toolProficiency: data.backgroundToolProficiency,
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
		data.speciesSkills,
		data.expertiseSkills,
	)
}
