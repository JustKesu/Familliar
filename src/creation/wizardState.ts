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
	FeatAsiChoice,
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

export const WIZARD_STEPS = ['class', 'species', 'background', 'expertise', 'languages', 'abilities', 'featAsi', 'review'] as const
export type WizardStep = (typeof WIZARD_STEPS)[number]

/**
 * The steps actually shown to the player. `expertise` only appears when the
 * class grants it by the chosen level (task instructions, point 2) — a
 * `null` count means no entitlement at all, so the step is skipped
 * entirely rather than shown empty, and the numbering of every step after
 * it shifts down to stay contiguous.
 *
 * `featAsi` follows the same rule: it only appears when the character has
 * at least one level-4/8/12/16/19(+class bonus levels) grant by the chosen
 * level (D16/D19/D20, feat/ASI slice). It comes AFTER `abilities`, not next
 * to `expertise` — feat prerequisites are checked against FINAL ability
 * scores (base + background bonus, D16/D17), which aren't known until the
 * abilities step has run.
 */
export function visibleSteps(expertiseRequiredCount: number | null, featAsiEligibleLevelCount = 0): readonly WizardStep[] {
	return WIZARD_STEPS.filter((step) => {
		if (step === 'expertise') return expertiseRequiredCount !== null
		if (step === 'featAsi') return featAsiEligibleLevelCount > 0
		return true
	})
}

/** The picker steps only — every one of these must be complete before the review step may save. */
function pickerSteps(expertiseRequiredCount: number | null, featAsiEligibleLevelCount = 0): readonly WizardStep[] {
	return visibleSteps(expertiseRequiredCount, featAsiEligibleLevelCount).filter((step) => step !== 'review')
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
	/** One entry per level with an ASI-or-feat grant (task instructions, point 7) — clears whenever class or level changes (point 6), since eligibility is keyed to the class's own grant levels. */
	featAsiChoices: FeatAsiChoice[]
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
		featAsiChoices: [],
	}
}

export interface WizardControllerState {
	step: WizardStep
	data: WizardData
}

export function initialControllerState(): WizardControllerState {
	return { step: WIZARD_STEPS[0], data: emptyWizardData() }
}

export function stepIndex(step: WizardStep, expertiseRequiredCount: number | null = null, featAsiEligibleLevelCount = 0): number {
	return visibleSteps(expertiseRequiredCount, featAsiEligibleLevelCount).indexOf(step)
}

function nextStep(step: WizardStep, expertiseRequiredCount: number | null, featAsiEligibleLevelCount: number): WizardStep | null {
	const steps = visibleSteps(expertiseRequiredCount, featAsiEligibleLevelCount)
	const idx = steps.indexOf(step)
	return idx < steps.length - 1 ? steps[idx + 1] : null
}

function previousStep(step: WizardStep, expertiseRequiredCount: number | null, featAsiEligibleLevelCount: number): WizardStep | null {
	const steps = visibleSteps(expertiseRequiredCount, featAsiEligibleLevelCount)
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
 *
 * `featAsiEligibleLevelCount` is the number of levels that grant an
 * ASI-or-feat choice (feat/ASI slice, task instructions point 2) — the
 * 'featAsi' step needs exactly one recorded choice per eligible level. Each
 * choice's own validity (ASI shape/cap or feat prerequisites) is enforced
 * by the picker before it ever reaches `onChange`, so a length check here
 * is enough, mirroring the 'expertise' step above — except a feat choice
 * also needs `chosenAbility` once the feat itself calls for one; that can't
 * be enforced by shape alone (it depends on feats.json), so
 * `featsRequiringAbilityChoice` (a `${name}|${source}` key set, empty by
 * default) is checked here too (half-feat ability-choice slice).
 */
export function isStepComplete(
	step: WizardStep,
	data: WizardData,
	expertiseRequiredCount: number | null = null,
	featAsiEligibleLevelCount = 0,
	featsRequiringAbilityChoice: ReadonlySet<string> = EMPTY_FEAT_SET,
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
		case 'featAsi':
			return (
				data.featAsiChoices.length === featAsiEligibleLevelCount &&
				data.featAsiChoices.every((choice) => isCompleteFeatAsiChoice(choice, featsRequiringAbilityChoice))
			)
		case 'review':
			return true
	}
}

const EMPTY_FEAT_SET: ReadonlySet<string> = new Set()

/**
 * A recorded choice must be a fully-formed ASI (valid shape, D20) or a
 * fully-named feat — not a placeholder left over from picking "ASI" or
 * "Feat" but nothing further. A feat whose key is in
 * `featsRequiringAbilityChoice` (a half-feat, task instructions point 4)
 * additionally needs `chosenAbility` set — the step cannot complete with a
 * feat picked but its ability bonus target unknown.
 */
function isCompleteFeatAsiChoice(choice: FeatAsiChoice, featsRequiringAbilityChoice: ReadonlySet<string>): boolean {
	if (choice.kind === 'feat') {
		if (choice.name.trim() === '' || choice.source.trim() === '') return false
		if (featsRequiringAbilityChoice.has(`${choice.name}|${choice.source}`)) return choice.chosenAbility !== undefined
		return true
	}
	const amounts = Object.values(choice.increases)
	if (amounts.length === 1) return amounts[0] === 2
	if (amounts.length === 2) return amounts.every((amount) => amount === 1)
	return false
}

/** Whether every picker step is complete — the gate for the review step's save button. */
export function isReadyToSave(
	data: WizardData,
	expertiseRequiredCount: number | null = null,
	featAsiEligibleLevelCount = 0,
	featsRequiringAbilityChoice: ReadonlySet<string> = EMPTY_FEAT_SET,
): boolean {
	return pickerSteps(expertiseRequiredCount, featAsiEligibleLevelCount).every((step) =>
		isStepComplete(step, data, expertiseRequiredCount, featAsiEligibleLevelCount, featsRequiringAbilityChoice),
	)
}

export type WizardAction =
	| {
			type: 'next'
			expertiseRequiredCount?: number | null
			featAsiEligibleLevelCount?: number
			featsRequiringAbilityChoice?: ReadonlySet<string>
	  }
	| { type: 'back'; expertiseRequiredCount?: number | null; featAsiEligibleLevelCount?: number }
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
	| { type: 'setFeatAsiChoices'; choices: FeatAsiChoice[] }

/**
 * Pure navigation + edit reducer. `next` is a no-op unless the current step
 * is complete; `back` always succeeds and never touches `data`, so whatever
 * was already chosen on earlier steps survives the round trip.
 */
export function wizardReducer(state: WizardControllerState, action: WizardAction): WizardControllerState {
	switch (action.type) {
		case 'next': {
			const eligibility = action.expertiseRequiredCount ?? null
			const featAsiCount = action.featAsiEligibleLevelCount ?? 0
			const featsRequiringAbilityChoice = action.featsRequiringAbilityChoice ?? EMPTY_FEAT_SET
			if (!isStepComplete(state.step, state.data, eligibility, featAsiCount, featsRequiringAbilityChoice)) return state
			const next = nextStep(state.step, eligibility, featAsiCount)
			return next ? { ...state, step: next } : state
		}
		case 'back': {
			const prev = previousStep(state.step, action.expertiseRequiredCount ?? null, action.featAsiEligibleLevelCount ?? 0)
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
					featAsiChoices: [],
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
		case 'setFeatAsiChoices':
			return { ...state, data: { ...state.data, featAsiChoices: action.choices } }
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
 * `expertiseRequiredCount` and `featAsiEligibleLevelCount` are the same
 * values CharacterWizard.tsx already computes for the 'expertise' and
 * 'featAsi' steps' own completion checks — passed again here so this final
 * readiness check agrees with them exactly. `featsRequiringAbilityChoice`
 * likewise mirrors the 'featAsi' step's own check (half-feat ability-choice
 * slice).
 */
export function saveCharacter(
	store: CharacterStore,
	data: WizardData,
	backgroundSkillProficiencies?: [string, string],
	expertiseRequiredCount: number | null = null,
	featAsiEligibleLevelCount = 0,
	featsRequiringAbilityChoice: ReadonlySet<string> = EMPTY_FEAT_SET,
): Character {
	if (!isReadyToSave(data, expertiseRequiredCount, featAsiEligibleLevelCount, featsRequiringAbilityChoice)) {
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
		data.featAsiChoices,
	)
}
