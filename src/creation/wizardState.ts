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
	CharacterClassFeatureChoice,
	CharacterHitPointLevel,
	CharacterInventoryItem,
	CharacterWildShapeForms,
	CharacterLanguage,
	CharacterToolChoice,
	CharacterSubclassSkill,
	CharacterExpertiseSkill,
	CharacterFightingStyle,
	CharacterGrantedFeat,
	CharacterMastery,
	CharacterMulticlassPick,
	CharacterOptionalFeatureChoice,
	CharacterSpellChoice,
	CharacterSubclassSpellChoice,
	CharacterSubclassSpellChoicePick,
	FeatAsiChoice,
	LeveledChoice,
} from '../storage/character'
import { choiceNames, fightingStyleFor, isConsistentLevelOrder, singleClassLevelOrder } from '../storage/character'
import type { PickSourceLookup } from '../optionalFeatures/pickSources'
import { isValidHitPointEntry } from '../hitPoints/hitPointEntry'
import type { AbilityBonusDistribution } from '../backgrounds/abilityBonus'
import type { CharacterStore } from '../storage/characterStore'
import type { ClassLevelChoice } from '../classes/ClassPicker'
import type { SpeciesChoice } from '../species/SpeciesPicker'
import type { BackgroundChoice } from '../backgrounds/BackgroundPicker'
import type { LanguageChoice } from '../languages/LanguagePicker'
import { AUTOMATIC_LANGUAGE, CHOSEN_LANGUAGE_COUNT } from '../languages/languageData'
import { classFeatureLanguageGrantsFor, keepHeldFeatureLanguages } from '../languages/classFeatureLanguages'
import { classToolGrantsFor, keepHeldToolChoices, toolGrantsForHeldClasses, type ClassToolChoiceGrant, type ToolSlotGrant } from '../toolProficiencies/classToolChoices'
import { isKhoravar, isSpeciesToolChoice, keepHeldSpeciesToolChoices, speciesToolGrantsFor } from '../toolProficiencies/speciesToolChoices'
import {
	SUBCLASS_LANGUAGE_SOURCES,
	isSubclassSkillChoiceMade,
	keepHeldSubclassLanguages,
	keepHeldSubclassSkills,
	subclassSkillGrantsFor,
	type SubclassSkillGrant,
} from '../classSkills/subclassSkillGrants'
import type { Ability, CharacterAbilityScores } from '../abilities/abilityScores'
import type { SpellCountLabel } from '../calculation/spellCounts'
import { firstClass, isMulticlass, levelOrderAfterLevelUp, totalCharacterLevel } from '../calculation/characterLevel'
import { isMagicInitiateFeat } from '../featAsi/featAsiData'
import { emptyStartingEquipmentChoice, type StartingEquipmentChoice } from '../inventory/startingEquipmentData'
import { filterChoiceRequiredCounts, isFilterChoiceFeat, isNamedBlockFeat } from '../spells/featSpellChoiceData'
import { overwrittenHeldPicks } from '../levelUp/heldPicks'
import { heldPickOwners, ownedPicks, withOwnedPicks, type HeldPickGrantData, type HeldPickOwners } from './heldClassPicks'
import { checkNoClassRaised, checkOneClassRaised, classesAfterLevelUp, isClass, levelOrderBeforeLevelUp, otherClassRecords, otherFightingStyles, otherOptionalFeatureChoices } from '../levelUp/multiclassLevelUp'
import { wildShapeLimits } from '../beasts/wildShapeData'

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

export const WIZARD_STEPS = [
	'class',
	'species',
	'background',
	'expertise',
	'languages',
	'abilities',
	'spells',
	'classOptionalFeatures',
	'featAsi',
	'hitPoints',
	'equipment',
	'review',
] as const
export type WizardStep = (typeof WIZARD_STEPS)[number]

/** The cantrip/leveled-spell counts the 'spells' step must satisfy (build order step 6 slice d2) — null means the class has no spellcasting by the chosen level, so the step is skipped. */
export interface SpellRequirement {
	cantripCount: number
	leveledSpellCount: number
	label: SpellCountLabel
}

const EMPTY_FEAT_SET: ReadonlySet<string> = new Set()

/**
 * Everything the navigation and completion rules need beyond WizardData
 * itself: which conditional steps are entitled at all, and how much each one
 * must collect. One named object rather than a tail of positional booleans
 * and counts, which had grown to nine and could be transposed without the
 * type checker noticing. Every field is optional and its omitted value is the
 * one the positional defaults used to supply, so a caller that passes nothing
 * gets the old no-conditional-steps behaviour.
 */
export interface WizardStepConditions {
	/** Expertise skills the 'expertise' step must collect — `null` means no entitlement, so the step is skipped. */
	expertiseRequiredCount?: number | null
	/** F-5: false while a stored Expertise skill is outside the step's pool (no longer proficient); the picker lists it for unchecking. */
	expertiseSkillsAvailable?: boolean
	/** Levels granting an ASI-or-feat choice; 0 skips the 'featAsi' step. */
	featAsiEligibleLevelCount?: number
	/** `${name}|${source}` keys of feats that additionally need `chosenAbility` (half-feats). */
	featsRequiringAbilityChoice?: ReadonlySet<string>
	/** D254: false while a feat chosen at a changeable level is already taken or no longer meets its prerequisite (featAsiLevels.ts). */
	featAsiChoicesValid?: boolean
	/** Cantrip/leveled counts the 'spells' step must satisfy — `null` means no spellcasting, so the step is skipped. */
	spellRequirement?: SpellRequirement | null
	/** Subclass filter-choice spell slots the 'spells' step must also fill. */
	subclassSpellChoiceSlotCount?: number
	/** Whether every CLASS optional-feature pick is made and none is in the warning state. */
	classOptionalFeaturesComplete?: boolean
	/** Granted CLASS optional-feature groups; 0 skips the 'classOptionalFeatures' step. */
	classOptionalFeatureGroupCount?: number
	/** Whether every granted D21 class-feature choice (Divine Order, Primal Order, Elemental Fury) is made. */
	classFeatureChoicesComplete?: boolean
	/** D81/D82: whether the choice the book puts inside the chosen species (Elven Lineage, Draconic Ancestry, ...) has been made. True for a species that has none. */
	speciesVariantChoiceComplete?: boolean
	/** Whether the species' own skill proficiencies are settled — the count comes from species.json, not from WizardData. */
	speciesSkillsComplete?: boolean
	/** D175: whether the size a multi-size species offers has been chosen. True for a species with one size. */
	speciesSizeComplete?: boolean
	/** D89 follow-up: whether the species' own spellcasting-ability choice (`additionalSpells.ability: {choose:[...]}`) is settled. True for a species with a fixed ability or none at all — the count/list comes from species.json, not from WizardData. */
	speciesSpellcastingAbilityComplete?: boolean
	/** S2: false while the species carries a `choose` cantrip grant (High Elf, Khoravar, Kobold; Draconic Sorcery) and no valid pick is stored. */
	speciesCantripComplete?: boolean
	/** Wild Shape forms the class step must collect (wildShapeData.ts's Beast Shapes table); 0 for a character without Wild Shape. */
	wildShapeFormCount?: number
	/** D-class-gate: what the class step's pickers ask for at this class, level and subclass; `null` while that is still loading, which keeps the step incomplete. Omitted means the picks are not checked at all (no class chosen yet, or a caller that has no loaded data). */
	classPickRequirements?: ClassPickRequirements | null
	/** Whether every category element inside the two chosen starting-equipment options has an item picked. Which elements those are is only known from the loaded offers, so the caller computes it (missingCategoryPicks). */
	startingEquipmentCategoryPicksComplete?: boolean
	/** D205: false while the chosen background has no fixed feat and no Dark Gift is picked yet (only known from backgrounds.json). */
	backgroundOriginFeatComplete?: boolean
	/** D274: false while the species grants an origin feat (Human Versatile) and none valid is chosen (speciesOriginFeat.ts). */
	speciesOriginFeatComplete?: boolean
	/**
	 * Total character level (single class, D11) — decides only whether the
	 * 'hitPoints' step has anything to show. Level 1 is always the die maximum
	 * (never rolled, never averaged), so a level-1 character has nothing to
	 * choose and the step is skipped entirely, like 'expertise' or 'featAsi'
	 * above. `null` (no class chosen yet) behaves the same as level 1.
	 */
	characterLevel?: number | null
	/**
	 * Slice 8d1: the wizard is running over an EXISTING character rather than
	 * creating one. Hides the 'equipment' step — starting equipment is a
	 * one-time grant taken at creation, nothing records which option was taken,
	 * and the inventory itself is live play state the sheet edits. Re-deriving it
	 * from the offers on every edit would overwrite that; asking for the option
	 * again would block the save on a choice already spent.
	 */
	editingExistingCharacter?: boolean
	/**
	 * Slice 8d3: the wizard is walking one level up, and these are the only steps
	 * that level offers (levelUpStepConditions in src/levelUp/levelUpSteps.ts).
	 * When set it decides visibility on its own — every step it leaves out has
	 * nothing new at this level, so its per-step rule above has nothing to add.
	 * `null` is an ordinary creation or edit run.
	 */
	levelUpSteps?: ReadonlySet<WizardStep> | null
	/**
	 * Slice 8d5: set alongside `levelUpSteps` to the level being gained. The
	 * 'hitPoints' step's completion then asks for only that one level's entry,
	 * rather than every level from 2 up to the character's own — the levels
	 * below it are left on whatever they already had (D92 defaults included)
	 * instead of being demanded here. `null` is an ordinary creation or edit run.
	 */
	levelUpTargetLevel?: number | null
	/** W20: the class's hit die size, so 'hitPoints' can check each value against it. `null` while loading. */
	hitDieFaces?: number | null
	/** D330: how many multiclass skill/tool picks the class entered in this level up owes on 'languages'; `null` while its data loads. */
	multiclassPickCount?: number | null
	/** M9 (question 1): false while unfinishedHeldClasses reports a class of a multiclass Edit; blocks the save, not a step. */
	heldClassesComplete?: boolean
	/** D333: a multiclass Edit's classes in stored order; the languages step's class grants read all of them. Absent = the wizard's one class. */
	heldClasses?: readonly CharacterClass[] | null
	/** D333: a multiclass Edit's hit die per character level (index 0 = level 1); `null` while loading. Absent = `hitDieFaces` for every level of the one class. */
	hitDieFacesByLevel?: readonly number[] | null
	/** D333: false while a multiclass Edit's multiclass skill/tool slots are not all filled (or still loading). */
	multiclassPicksComplete?: boolean
}

/**
 * The single choices and exact counts the class step's pickers (subclass, fighting style, masteries, subclass options) require.
 * `null` in any field means its loader failed (F-1): that one pick is neither demanded nor forbidden.
 */
export interface ClassPickRequirements {
	subclass: boolean | null
	fightingStyle: boolean | null
	masteryCount: number | null
	optionalFeatureCount: number | null
	/** ClassSkillPicker's count; `null` also when a level up already holds the class skills (D108 hides the picker). */
	skillCount: number | null
	/** The D21 class-feature choices (Divine Order, Elemental Fury…) this level grants. */
	classFeatureNames: readonly string[] | null
}

/** Held (level-up) picks are already in `data`, so they count as chosen. Counts are exact, like the pickers' own caps; a pick the level does not grant blocks the step (D251). */
export function classPicksComplete(data: WizardData, required: ClassPickRequirements): boolean {
	const featureNames = required.classFeatureNames
	return (
		(required.skillCount === null || data.classSkills.length === required.skillCount) &&
		(required.subclass === null || (data.subclass !== null) === required.subclass) &&
		(required.fightingStyle === null || (data.fightingStyle !== null) === required.fightingStyle) &&
		(required.masteryCount === null || activeClassPicks(data, 'masteries').length === required.masteryCount) &&
		(required.optionalFeatureCount === null || data.optionalFeatureChoices.length === required.optionalFeatureCount) &&
		(featureNames === null || data.classFeatureChoices.every((choice) => featureNames.includes(choice.featureName)))
	)
}

/**
 * D251: drops the class-step picks the chosen level no longer grants, whose pickers are gone so the
 * player could not remove them. Picks whose picker stays (a smaller mastery or maneuver count) are left
 * to the player. Unknown (`null`) requirements prune nothing.
 */
function pruneClassPicks(state: WizardControllerState, required: ClassPickRequirements): WizardControllerState {
	const unsubclassed = required.subclass === false && state.data.subclass !== null ? wizardReducer(state, { type: 'setSubclass', subclass: null }) : state
	const data = unsubclassed.data
	const featureNames = required.classFeatureNames
	const fightingStyle = required.fightingStyle === false ? null : data.fightingStyle
	const optionalFeatureChoices = required.optionalFeatureCount === 0 ? [] : data.optionalFeatureChoices
	const classFeatureChoices = featureNames === null ? data.classFeatureChoices : data.classFeatureChoices.filter((choice) => featureNames.includes(choice.featureName))
	const wildShapeForms = data.classChoice && wildShapeLimits(data.classChoice.className, data.classChoice.level, data.subclass?.name ?? null) ? data.wildShapeForms : []
	// D256: outside the Class step too — ASI levels and Proficiencies-step picks above the chosen level.
	const featAsiChoices = data.featAsiChoices.filter((choice) => choice.level <= (data.classChoice?.level ?? 0))
	// D260: hit point rows above the chosen level go too, or a later level up finds an old roll and skips its own choice.
	const hitPointLevels = data.hitPointLevels.filter((entry) => entry.level <= (data.classChoice?.level ?? 0))
	const above = grantedAboveLevel(data)
	const featureLanguages = data.featureLanguages.filter((language) => !above.languages.has(language.grantedBy))
	const toolChoices = data.toolChoices.filter((choice) => !above.tools.has(choice.grantedBy))
	const subclassSkills = data.subclassSkills.filter((pick) => !above.skills.has(pick.grantedBy))
	if (
		fightingStyle === data.fightingStyle &&
		optionalFeatureChoices.length === data.optionalFeatureChoices.length &&
		classFeatureChoices.length === data.classFeatureChoices.length &&
		wildShapeForms.length === data.wildShapeForms.length &&
		featAsiChoices.length === data.featAsiChoices.length &&
		hitPointLevels.length === data.hitPointLevels.length &&
		featureLanguages.length === data.featureLanguages.length &&
		toolChoices.length === data.toolChoices.length &&
		subclassSkills.length === data.subclassSkills.length
	) {
		return unsubclassed
	}
	return {
		...unsubclassed,
		data: { ...data, fightingStyle, optionalFeatureChoices, classFeatureChoices, wildShapeForms, featAsiChoices, hitPointLevels, featureLanguages, toolChoices, subclassSkills },
	}
}

/** The `grantedBy` of every language, tool and skill pick the class and subclass grant only above the chosen level. */
function grantedAboveLevel(data: WizardData): { languages: Set<string>; tools: Set<string>; skills: Set<string> } {
	const now = wizardClass(data)
	if (!now) return { languages: new Set(), tools: new Set(), skills: new Set() }
	const atMax = { ...now, level: 20 }
	const languages = (cls: typeof now): string[] => [
		...classFeatureLanguageGrantsFor([cls]).flatMap((grant) => (grant.choice ? [grant.choice.grantedBy] : [])),
		...subclassSkillGrantsFor([cls]).flatMap((grant) => (grant.choice?.orLanguage ? [grant.choice.orLanguage] : [])),
	]
	const tools = (cls: typeof now): string[] => classToolGrantsFor([cls]).map((grant) => grant.grantedBy)
	const skills = (cls: typeof now): string[] => subclassSkillGrantsFor([cls]).flatMap((grant) => (grant.choice ? [grant.choice.grantedBy] : []))
	const minus = (all: string[], held: string[]): Set<string> => new Set(all.filter((source) => !held.includes(source)))
	return { languages: minus(languages(atMax), languages(now)), tools: minus(tools(atMax), tools(now)), skills: minus(skills(atMax), skills(now)) }
}

/** D256: a new character's Class options picks of a progression the chosen level no longer grants (count 0 or none). */
function pruneClassOptionalFeatures(state: WizardControllerState, featureTypes: readonly string[]): WizardControllerState {
	const kept = state.data.classOptionalFeatureChoices.filter((entry) => featureTypes.includes(entry.featureType))
	return kept.length === state.data.classOptionalFeatureChoices.length ? state : { ...state, data: { ...state.data, classOptionalFeatureChoices: kept } }
}

/** The omitted-field values, in one place, so every entry point agrees on them. */
function resolveConditions(
	conditions: WizardStepConditions,
): Required<Omit<WizardStepConditions, 'classPickRequirements' | 'hitDieFacesByLevel'>> & Pick<WizardStepConditions, 'classPickRequirements' | 'hitDieFacesByLevel'> {
	return {
		expertiseRequiredCount: conditions.expertiseRequiredCount ?? null,
		expertiseSkillsAvailable: conditions.expertiseSkillsAvailable ?? true,
		featAsiEligibleLevelCount: conditions.featAsiEligibleLevelCount ?? 0,
		featsRequiringAbilityChoice: conditions.featsRequiringAbilityChoice ?? EMPTY_FEAT_SET,
		featAsiChoicesValid: conditions.featAsiChoicesValid ?? true,
		spellRequirement: conditions.spellRequirement ?? null,
		subclassSpellChoiceSlotCount: conditions.subclassSpellChoiceSlotCount ?? 0,
		classOptionalFeaturesComplete: conditions.classOptionalFeaturesComplete ?? true,
		classOptionalFeatureGroupCount: conditions.classOptionalFeatureGroupCount ?? 0,
		classFeatureChoicesComplete: conditions.classFeatureChoicesComplete ?? true,
		speciesVariantChoiceComplete: conditions.speciesVariantChoiceComplete ?? true,
		speciesSkillsComplete: conditions.speciesSkillsComplete ?? true,
		speciesSizeComplete: conditions.speciesSizeComplete ?? true,
		speciesSpellcastingAbilityComplete: conditions.speciesSpellcastingAbilityComplete ?? true,
		speciesCantripComplete: conditions.speciesCantripComplete ?? true,
		wildShapeFormCount: conditions.wildShapeFormCount ?? 0,
		classPickRequirements: conditions.classPickRequirements,
		startingEquipmentCategoryPicksComplete: conditions.startingEquipmentCategoryPicksComplete ?? true,
		backgroundOriginFeatComplete: conditions.backgroundOriginFeatComplete ?? true,
		speciesOriginFeatComplete: conditions.speciesOriginFeatComplete ?? true,
		characterLevel: conditions.characterLevel ?? 1,
		editingExistingCharacter: conditions.editingExistingCharacter ?? false,
		levelUpSteps: conditions.levelUpSteps ?? null,
		levelUpTargetLevel: conditions.levelUpTargetLevel ?? null,
		hitDieFaces: conditions.hitDieFaces ?? null,
		multiclassPickCount: conditions.multiclassPickCount === undefined ? 0 : conditions.multiclassPickCount,
		heldClassesComplete: conditions.heldClassesComplete ?? true,
		heldClasses: conditions.heldClasses ?? null,
		hitDieFacesByLevel: conditions.hitDieFacesByLevel,
		multiclassPicksComplete: conditions.multiclassPicksComplete ?? true,
	}
}

/**
 * The steps actually shown to the player. `expertise` only appears when the
 * class grants it by the chosen level (task instructions, point 2) — a
 * `null` count means no entitlement at all, so the step is skipped
 * entirely rather than shown empty, and the numbering of every step after
 * it shifts down to stay contiguous.
 *
 * `spells` only appears when the class has spellcasting by the chosen level
 * (a null SpellRequirement — non-casters, or a third-caster subclass not
 * yet chosen/not yet level 3). It comes AFTER `abilities`: some classes'
 * counts read a caster's FINAL level, and positioning it next to `featAsi`
 * (also after abilities) keeps every ability-score-dependent step together.
 *
 * `featAsi` follows the same rule: it only appears when the character has
 * at least one level-4/8/12/16/19(+class bonus levels) grant by the chosen
 * level (D16/D19/D20, feat/ASI slice). It comes AFTER `abilities`, not next
 * to `expertise` — feat prerequisites are checked against FINAL ability
 * scores (base + background bonus, D16/D17), which aren't known until the
 * abilities step has run.
 *
 * `classOptionalFeatures` (Sorcerer Metamagic, Warlock Eldritch Invocations)
 * appears when the CLASS's own optionalfeatureProgression grants at least one
 * pick by the chosen level — `classOptionalFeatureGroupCount` is the length of
 * classOptionalFeatureGroupsFor's result, which already drops count-0 grants.
 * It sits directly AFTER `spells` per D64: several invocations require an
 * already-known damaging cantrip, so running it before the spells step left
 * Agonizing Blast permanently greyed out on a first forward pass. Subclass
 * optional features are unaffected and stay on the class step.
 *
 * `hitPoints` (build order step 8, slice 8b) appears once the character is
 * above level 1 — level 1 is always the die maximum by rule (D92) and there
 * is nothing to choose. It comes AFTER `featAsi`, not next to `abilities`: a
 * feat or an ASI can raise Constitution, and Tough adds per-level hit points,
 * so a step placed earlier would show a running total that changes one step
 * later.
 */
export function visibleSteps(conditions: WizardStepConditions = {}): readonly WizardStep[] {
	const resolved = resolveConditions(conditions)
	return WIZARD_STEPS.filter((step) => {
		if (resolved.levelUpSteps !== null) return resolved.levelUpSteps.has(step)
		if (step === 'expertise') return resolved.expertiseRequiredCount !== null
		if (step === 'featAsi') return resolved.featAsiEligibleLevelCount > 0
		if (step === 'spells') return resolved.spellRequirement !== null
		if (step === 'classOptionalFeatures') return resolved.classOptionalFeatureGroupCount > 0
		if (step === 'hitPoints') return (resolved.characterLevel ?? 1) > 1
		if (step === 'equipment') return !resolved.editingExistingCharacter
		return true
	})
}

/** D174: the class/subclass tool picks the languages step collects. A level-up walk asks only for the ones that level brings (Battle Master at 3). */
export function wizardToolGrants(data: WizardData, levelUpTargetLevel: number | null, heldClasses: readonly CharacterClass[] | null = null): ClassToolChoiceGrant[] {
	const cls = wizardClass(data)
	if (!cls) return []
	// D176: as D174, the wizard sees the background tool and the other slots' picks, not feat tools.
	const heldElsewhere = [
		...(data.backgroundToolProficiency ? [data.backgroundToolProficiency] : []),
		...data.toolChoices.filter((choice) => choice.grantedBy !== 'artificerSubclass').map((choice) => choice.name),
	]
	// D333: as saveCharacter keeps them, the stored first class's grants.
	const grants = toolGrantsForHeldClasses(heldClasses ?? [cls], heldElsewhere)
	// D329: grant levels are class levels; in a level up classChoice.level is the raised class's new level.
	// D328/D330: class level 1 in a level up is a class being entered, which never gets the starting tool picks.
	return levelUpTargetLevel === null ? grants : grants.filter((grant) => grant.level === cls.level && (cls.level > 1 || grant.subclass !== undefined))
}

/** D177: the subclass skill picks the languages step collects; a level-up walk asks only for the ones that level brings. */
export function wizardSubclassSkillGrants(data: WizardData, levelUpTargetLevel: number | null, heldClasses: readonly CharacterClass[] | null = null): SubclassSkillGrant[] {
	const cls = wizardClass(data)
	const grants = cls ? subclassSkillGrantsFor(heldClasses ?? [cls]).filter((grant) => grant.choice) : []
	return levelUpTargetLevel === null || !cls ? grants : grants.filter((grant) => grant.level === cls.level)
}

/** D177: species picks are creation picks, so a level-up walk never asks for them. */
export function wizardSpeciesToolGrants(data: WizardData, levelUpTargetLevel: number | null): ToolSlotGrant[] {
	return levelUpTargetLevel === null ? speciesToolGrantsFor(data.speciesChoice) : []
}

/** The class choice with the chosen subclass, as the grant tables read it. */
export function wizardClass(data: WizardData): (ClassLevelChoice & { subclass: string | null }) | null {
	return data.classChoice ? { ...data.classChoice, subclass: data.subclass?.name ?? null } : null
}

/** The picker steps only — every one of these must be complete before the review step may save. */
/**
 * S2: the species step's cantrip gate. Incomplete while the options for the CURRENT species are loading
 * (or failed), and while a species with the grant has no pick from its own list.
 */
export function isSpeciesCantripComplete(
	species: { name: string; source: string } | null,
	loaded: { key: string; options: readonly { name: string; source: string }[] | null } | null,
	pick: { name: string; source: string } | null,
): boolean {
	if (species === null) return true
	if (loaded?.key !== `${species.name}|${species.source}`) return false
	if (loaded.options === null) return true
	return pick !== null && loaded.options.some((option) => option.name === pick.name && option.source === pick.source)
}

function pickerSteps(conditions: WizardStepConditions): readonly WizardStep[] {
	return visibleSteps(conditions).filter((step) => step !== 'review')
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
	/** D172: class-feature language picks (Thieves' Cant, Deft Explorer), already shaped like storage. Clears whenever the class changes. */
	featureLanguages: CharacterLanguage[]
	/** D174: class/subclass tool picks, already shaped like storage. The class ones clear whenever the class changes; D177's species ones whenever the species does. */
	toolChoices: CharacterToolChoice[]
	/** D177: subclass skill picks, already shaped like storage. Clears whenever the class or subclass changes. */
	subclassSkills: CharacterSubclassSkill[]
	/** D177: Khoravar's skill-or-tool pick when it is a skill. Saved into speciesSkills; clears whenever the species changes. */
	speciesExtraSkill: string | null
	abilityScores: CharacterAbilityScores | null
	/** Class skill proficiencies, weapon masteries, fighting style and subclass are the class's own choices (D13), so they clear whenever classChoice does. */
	classSkills: string[]
	/** The species' skill proficiencies (fixed and/or chosen) — clears whenever speciesChoice does, since the options are keyed to a specific species. */
	speciesSkills: string[]
	/** D175: the size chosen for a species that offers several. Clears whenever speciesChoice does. */
	speciesSize: string | null
	/**
	 * D89 follow-up: which ability the species' own granted spells are cast
	 * with, when `additionalSpells.ability` is the `{choose:[...]}` shape —
	 * clears whenever speciesChoice does, same reasoning as speciesSkills: a
	 * different species (or a different lineage of the same family) may offer
	 * a different choice, or none at all.
	 */
	speciesSpellcastingAbility: Ability | null
	/** S2: the cantrip a species `choose` filter grant was filled with. Kept while the same species is re-reported, cleared when the species or lineage changes. */
	speciesCantrip: { name: string; source: string } | null
	/** Which already-proficient skills the player named as Expertise (D8) — clears whenever class, level, class skills, species, species skills or background change, since all of those affect the offer or the count (task instructions, point 4). */
	expertiseSkills: string[]
	masteries: string[]
	fightingStyle: string | null
	subclass: SubclassChoice | null
	/** The subclass's own optionalfeatureProgression picks (D21) — clear whenever class, level or subclass changes, since the options are keyed to a specific subclass. */
	optionalFeatureChoices: string[]
	/**
	 * The CLASS's own optionalfeatureProgression picks (build order step 6a,
	 * slice 2 — Sorcerer Metamagic, Warlock Eldritch Invocations). Already
	 * shaped like storage, one entry per granted featureType, since a class can
	 * grant more than one and each carries its own count. Clears whenever class
	 * or level changes — NOT on subclass, unlike optionalFeatureChoices above:
	 * these are granted by the class alone and never wait for a subclass.
	 */
	classOptionalFeatureChoices: CharacterOptionalFeatureChoice[]
	/** One entry per level with an ASI-or-feat grant (task instructions, point 7) — clears whenever class or level changes (point 6), since eligibility is keyed to the class's own grant levels. */
	featAsiChoices: FeatAsiChoice[]
	/** D156: sub-choices of the background's (and later the species') feat. The background entry clears whenever the background's identity changes. */
	grantedFeats: CharacterGrantedFeat[]
	/** D205: the Dark Gift feat taken instead of the background's origin feat. Clears whenever the background's identity changes. */
	backgroundOriginFeatOverride: { name: string; source: string } | null
	/** The class spell picks (build order step 6 slice d2) — clears whenever class, level or subclass changes, since the offered list, counts and (for a third caster) eligibility itself are all keyed to those. */
	spellChoices: SpellPick[]
	/** The subclass filter-choice spell picks (build order step 6 slice d6b — the 5 subclasses in subclassSpellChoiceData.ts's SUBCLASS_SPELL_CHOICE_KEYS) — clears whenever class, level or subclass changes, same reasoning as spellChoices: the offered slots and their level caps are keyed to those. */
	subclassSpellChoices: CharacterSubclassSpellChoicePick[]
	/**
	 * The class-feature choices a feature's own text offers (D21 — Divine
	 * Order, Primal Order, Elemental Fury). Already shaped like storage, one
	 * entry per chosen feature. Clears whenever class or level changes — NOT
	 * on subclass, like classOptionalFeatureChoices: these come from the class
	 * alone and never wait for a subclass.
	 */
	classFeatureChoices: CharacterClassFeatureChoice[]
	/**
	 * The Druid's known Wild Shape forms (step 6b slice 3) — picks only; the
	 * class they belong to (D11) is attached at save. Clears whenever class,
	 * level OR subclass changes: Circle of the Moon raises the CR cap, so the
	 * legal pool depends on all three.
	 */
	wildShapeForms: { name: string; source: string }[]
	/**
	 * One entry per character level from 2 upward (build order step 8, slice
	 * 8b) — level 1 is never stored (D92: always the die maximum). Clears
	 * whenever the class changes, since a recorded die result belongs to that
	 * class's own hit die (D11); a level change on the SAME class does not
	 * clear it — a lowered level just leaves the extra entries uncounted
	 * (maxHitPoints.ts, D43) and a raised level asks for the new levels too.
	 */
	hitPointLevels: CharacterHitPointLevel[]
	/**
	 * Which starting-equipment option the player took from the class and from
	 * the background, plus an item for every category element inside them
	 * (step 7 slice a2). The resulting inventory is not held here — it is
	 * derived from the loaded offers at save time, so a changed offer can never
	 * be contradicted by a stale copy.
	 *
	 * The class half clears whenever the class changes and the background half
	 * whenever the background's identity does; neither clears the other, since
	 * the two options are independent.
	 */
	startingEquipment: StartingEquipmentChoice
	/** W-8: the cropped portrait data URL. Keyed to nothing, so no class/background/subclass reset prunes it; absent = none. */
	portrait?: string
	/** D329: set only while levelling one class of a multiclass character — that class's own optionalfeatureProgression codes, which tell its picks from the other classes'. */
	activeClassFeatureTypes?: string[]
	/** D330: every multiclass skill/tool pick — the held ones seeded from the character, plus the class entered in this level up. */
	multiclassPicks?: CharacterMulticlassPick[]
	/** M9: a multiclass Edit holds every class but the active one here; switchClass swaps them. */
	otherClasses?: ClassStash[]
	/** D335: a multiclass Edit's owner of each Expertise and mastery pick; expertiseSkills and masteries stay the whole lists. */
	pickOwners?: { expertiseSkills: HeldPickOwners; masteries: HeldPickOwners }
}

/** D335: the active class's own picks in a multiclass Edit; every pick otherwise. */
export function activeClassPicks(data: WizardData, field: 'expertiseSkills' | 'masteries'): string[] {
	return data.pickOwners && data.classChoice ? ownedPicks(data[field], data.pickOwners[field].owners, data.classChoice) : data[field]
}

/** M9: the per-class fields of WizardData. Everything else (masteries, expertise, ASI/feat, hit points, languages, tools, skills) is on the character axis and shared. */
export type ClassFields = Pick<
	WizardData,
	| 'classChoice'
	| 'subclass'
	| 'fightingStyle'
	| 'optionalFeatureChoices'
	| 'classOptionalFeatureChoices'
	| 'spellChoices'
	| 'subclassSpellChoices'
	| 'classFeatureChoices'
	| 'wildShapeForms'
	| 'activeClassFeatureTypes'
>

/** M9: one held class's own picks while another class is active in a multiclass Edit. */
export type ClassStash = Omit<ClassFields, 'classChoice' | 'activeClassFeatureTypes'> & { classChoice: ClassLevelChoice; activeClassFeatureTypes: string[] }

function stashOf(data: WizardData, classChoice: ClassLevelChoice): ClassStash {
	return {
		classChoice,
		subclass: data.subclass,
		fightingStyle: data.fightingStyle,
		optionalFeatureChoices: data.optionalFeatureChoices,
		classOptionalFeatureChoices: data.classOptionalFeatureChoices,
		spellChoices: data.spellChoices,
		subclassSpellChoices: data.subclassSpellChoices,
		classFeatureChoices: data.classFeatureChoices,
		wildShapeForms: data.wildShapeForms,
		activeClassFeatureTypes: data.activeClassFeatureTypes ?? [],
	}
}

export function emptyWizardData(): WizardData {
	return {
		name: '',
		classChoice: null,
		speciesChoice: null,
		backgroundChoice: null,
		backgroundToolProficiency: null,
		languageChoice: [],
		featureLanguages: [],
		toolChoices: [],
		subclassSkills: [],
		speciesExtraSkill: null,
		abilityScores: null,
		classSkills: [],
		speciesSkills: [],
		speciesSize: null,
		speciesSpellcastingAbility: null,
		speciesCantrip: null,
		expertiseSkills: [],
		masteries: [],
		fightingStyle: null,
		subclass: null,
		optionalFeatureChoices: [],
		classOptionalFeatureChoices: [],
		featAsiChoices: [],
		grantedFeats: [],
		backgroundOriginFeatOverride: null,
		spellChoices: [],
		subclassSpellChoices: [],
		classFeatureChoices: [],
		wildShapeForms: [],
		hitPointLevels: [],
		startingEquipment: emptyStartingEquipmentChoice(),
	}
}

/**
 * The two things storage deliberately does NOT hold that WizardData needs, so
 * seeding an existing character has to be handed them (build order step 8,
 * slice 8d1). Both are already loaded by CharacterWizard for its own panels;
 * minimally typed here so a test can supply two literals instead of a full
 * SubclassOption / SpellDetail.
 */
export interface WizardSeedLookups {
	/** The chosen class's subclasses — `Character.classes[].subclass` is a bare NAME, while SubclassChoice also needs the source and the featureType its optional-feature picks are tagged with (D21). */
	subclasses: readonly { name: string; source: string; featureType: string | null }[]
	/** Every spell's level — SpellPick carries it for the step's own cantrip/leveled counts, and saveCharacter drops it on the way to storage. */
	spellLevels: readonly { name: string; source: string; level: number }[]
	/** D329: the class a multiclass level up raises, with its own optionalfeatureProgression codes; every per-class field is seeded from it alone. */
	activeClass?: { className: string; classSource: string; featureTypes: readonly string[] }
	/** M9: a multiclass Edit (no activeClass) — every held class's subclasses and own optionalfeatureProgression codes. */
	heldClasses?: readonly HeldClassLookup[]
}

export interface HeldClassLookup {
	className: string
	classSource: string
	subclasses: WizardSeedLookups['subclasses']
	featureTypes: readonly string[]
	/** The class level its Fighting Style feature comes at; null for a class without one, absent when not looked up. */
	fightingStyleLevel?: number | null
	/** D335: the class's Expertise and mastery grants; absent when not looked up or the load failed (then it grants neither). */
	expertiseGrant?: HeldPickGrantData
	masteryGrant?: HeldPickGrantData
	/** D337: a grant load failed; the class keeps the picks stamped with its levels and the Edit cannot save. */
	grantLoadFailed?: boolean
}

/** A stored +2/+1 or +1/+1/+1 map read back as the chooser's own state, so an edited background reopens showing which mode was taken rather than an empty chooser beside a filled bonus. */
function distributionFromBonusMap(abilityBonus: AbilityBonusMap | undefined): AbilityBonusDistribution | null {
	const entries = Object.entries(abilityBonus ?? {}) as [Ability, number][]
	if (entries.length === 0) return null
	const plusTwo = entries.find(([, amount]) => amount === 2)
	if (!plusTwo) return { mode: 'oneEach' }
	const plusOne = entries.find(([, amount]) => amount === 1)
	return { mode: 'twoOne', plusTwo: plusTwo[0], plusOne: plusOne ? plusOne[0] : null }
}

/**
 * The inverse of saveCharacter: builds the wizard's in-progress shape from a
 * stored character (build order step 8, slice 8d1), so the whole flow can run
 * over one that already exists.
 *
 * The LEVELS recorded on each mastery, expertise skill and optional-feature
 * pick (D97/D98/D99) are not represented in WizardData — the pickers are
 * name-based controls. They are not lost: saveCharacter is given the same
 * character back and re-attaches the level of every pick that was already on it.
 *
 * `startingEquipment` comes back empty and the equipment step is hidden while
 * editing (WizardStepConditions.editingExistingCharacter) — the character's
 * inventory is carried through untouched instead.
 */
export function wizardDataFromCharacter(character: Character, lookups: WizardSeedLookups): WizardData {
	// D329: a multiclass level up seeds every per-class field from the raised class only; the others pass through saveCharacter.
	const entering = lookups.activeClass !== undefined && !character.classes.some((entry) => isClass(entry, lookups.activeClass!))
	const active = isMulticlass(character.classes) || entering ? lookups.activeClass : undefined
	const ofActive = (entry: { className: string; classSource: string }): boolean =>
		active === undefined || (entry.className === active.className && entry.classSource === active.classSource)
	// D330: a class entered in a level up starts at class level 0 with nothing chosen; the wizard raises it to 1.
	const characterClass = active ? (character.classes.find(ofActive) ?? (entering ? { className: active.className, classSource: active.classSource, subclass: null, level: 0 } : undefined)) : character.classes[0]
	const subclass = subclassChoiceFor(characterClass?.subclass ?? null, lookups.subclasses)

	const subclassFeatureType = subclass?.featureType ?? null
	const storedOptionalFeatures = character.optionalFeatureChoices ?? []

	const spellLevelOf = (spell: { name: string; source: string }): number =>
		lookups.spellLevels.find(
			(detail) => detail.name.toLowerCase() === spell.name.toLowerCase() && detail.source.toUpperCase() === spell.source.toUpperCase(),
		)?.level ?? -1

	const seeded: WizardData = {
		name: character.name,
		classChoice: characterClass
			? { className: characterClass.className, classSource: characterClass.classSource, level: characterClass.level }
			: null,
		speciesChoice: character.species ?? null,
		backgroundChoice: character.background
			? {
					name: character.background.name,
					source: character.background.source,
					abilityBonus: character.abilityBonus ?? {},
					abilityBonusDistribution: distributionFromBonusMap(character.abilityBonus),
				}
			: null,
		backgroundToolProficiency: character.background?.toolProficiency ?? null,
		// Common is added back by saveCharacter, exactly as it is on a first run.
		languageChoice: (character.languages ?? [])
			.filter((language) => language.grantedBy === 'creation')
			.map(({ name, source }) => ({ name, source })),
		featureLanguages: (character.languages ?? []).filter((language) => language.grantedBy !== 'automatic' && language.grantedBy !== 'creation'),
		toolChoices: character.toolChoices ?? [],
		subclassSkills: character.subclassSkills ?? [],
		// D177: Khoravar has no structured species skill, so a stored one is its skill-or-tool pick.
		speciesExtraSkill: isKhoravar(character.species) ? (character.speciesSkills?.[0] ?? null) : null,
		abilityScores: character.abilityScores ?? null,
		classSkills: character.classSkills ?? [],
		speciesSkills: isKhoravar(character.species) ? [] : (character.speciesSkills ?? []),
		speciesSize: character.speciesSize ?? null,
		speciesSpellcastingAbility: character.speciesSpellcastingAbility ?? null,
		speciesCantrip: character.speciesCantrip ?? null,
		expertiseSkills: choiceNames(character.expertiseSkills),
		masteries: choiceNames(character.masteries),
		fightingStyle: entering ? null : (fightingStyleFor(character.fightingStyles, characterClass)?.name ?? null),
		subclass,
		optionalFeatureChoices: subclassFeatureType
			? choiceNames(storedOptionalFeatures.find((entry) => entry.featureType === subclassFeatureType)?.choices)
			: [],
		classOptionalFeatureChoices: storedOptionalFeatures.filter(
			(entry) => entry.featureType !== subclassFeatureType && (active === undefined || active.featureTypes.includes(entry.featureType)),
		),
		featAsiChoices: character.featAsiChoices ?? [],
		grantedFeats: character.grantedFeats ?? [],
		backgroundOriginFeatOverride: character.background?.originFeatOverride ?? null,
		spellChoices: (character.spellChoices ?? []).filter(ofActive).flatMap((entry) =>
			entry.spells.map((spell) => ({ name: spell.name, source: spell.source, level: spellLevelOf(spell) })),
		),
		subclassSpellChoices: (character.subclassSpellChoices ?? []).filter(ofActive).flatMap((entry) => entry.picks),
		classFeatureChoices: (character.classFeatureChoices ?? []).filter(ofActive),
		wildShapeForms: (character.wildShapeForms ?? []).filter(ofActive).flatMap((entry) => entry.forms),
		hitPointLevels: character.hitPointLevels ?? [],
		startingEquipment: emptyStartingEquipmentChoice(),
		...(character.portrait ? { portrait: character.portrait } : {}),
		...(active ? { activeClassFeatureTypes: [...active.featureTypes] } : {}),
		...(character.multiclassPicks ? { multiclassPicks: character.multiclassPicks } : {}),
	}
	if (lookups.activeClass !== undefined || !isMulticlass(character.classes)) return seeded

	// M9: a multiclass Edit seeds classes[0] as active and stashes the others. Optional-feature entries no held class
	// or subclass claims ride with classes[0], as every non-subclass entry does in a single-class Edit, so save keeps them.
	const held = character.classes.map((entry) => {
		const lookup = lookups.heldClasses?.find((candidate) => isClass(candidate, entry))
		return { entry, featureTypes: lookup?.featureTypes ?? [], subclass: subclassChoiceFor(entry.subclass, lookup?.subclasses ?? []) }
	})
	const claimed = new Set(held.flatMap(({ featureTypes, subclass }) => [...featureTypes, ...(subclass?.featureType ? [subclass.featureType] : [])]))
	const storedStyles = character.fightingStyles ?? []
	const taggedStyleOf = (entry: CharacterClass): CharacterFightingStyle | undefined => storedStyles.find((style) => style.className === entry.className && style.classSource === entry.classSource)
	const untaggedStyle = storedStyles.find((style) => style.className === undefined)
	// D334: a pre-58 style goes to the first class with no tagged style whose Fighting Style level its level has reached (the fightingStyleFor rule); none qualifies, it stays untagged.
	const untaggedOwner = untaggedStyle
		? held.findIndex(({ entry }) => {
				const grantLevel = lookups.heldClasses?.find((candidate) => isClass(candidate, entry))?.fightingStyleLevel
				return taggedStyleOf(entry) === undefined && grantLevel !== undefined && grantLevel !== null && grantLevel <= entry.level
			})
		: -1
	// D334: a feature type two held classes list belongs to the first of them.
	const featureTypeOwner = new Map<string, number>()
	held.forEach(({ featureTypes }, index) => featureTypes.forEach((featureType) => !featureTypeOwner.has(featureType) && featureTypeOwner.set(featureType, index)))
	const [first, ...others] = held.map(({ entry, featureTypes, subclass }, index): ClassStash => {
		const ofClass = (record: { className: string; classSource: string }): boolean => isClass(record, entry)
		const ownFeatureType = subclass?.featureType ?? null
		return {
			classChoice: { className: entry.className, classSource: entry.classSource, level: entry.level },
			subclass,
			fightingStyle: taggedStyleOf(entry)?.name ?? (index === untaggedOwner ? (untaggedStyle?.name ?? null) : null),
			optionalFeatureChoices: ownFeatureType ? choiceNames(storedOptionalFeatures.find((stored) => stored.featureType === ownFeatureType)?.choices) : [],
			classOptionalFeatureChoices: storedOptionalFeatures.filter(
				(stored) => stored.featureType !== ownFeatureType && (featureTypeOwner.get(stored.featureType) === index || (index === 0 && !claimed.has(stored.featureType))),
			),
			spellChoices: (character.spellChoices ?? []).filter(ofClass).flatMap((stored) => stored.spells.map((spell) => ({ name: spell.name, source: spell.source, level: spellLevelOf(spell) }))),
			subclassSpellChoices: (character.subclassSpellChoices ?? []).filter(ofClass).flatMap((stored) => stored.picks),
			classFeatureChoices: (character.classFeatureChoices ?? []).filter(ofClass),
			wildShapeForms: (character.wildShapeForms ?? []).filter(ofClass).flatMap((stored) => stored.forms),
			activeClassFeatureTypes: [...featureTypes],
		}
	})
	const levelOrder = character.levelOrder ?? []
	const grants = (field: 'expertiseGrant' | 'masteryGrant') =>
		character.classes.map((entry) => {
			const lookup = lookups.heldClasses?.find((candidate) => isClass(candidate, entry))
			const grant = lookup?.[field]
			return {
				className: entry.className,
				classSource: entry.classSource,
				countsByLevel: grant?.countsByLevel ?? [],
				allowed: grant?.allowed ?? null,
				...(grant === undefined && lookup?.grantLoadFailed ? { loadFailed: true } : {}),
			}
		})
	const pickOwners = {
		expertiseSkills: heldPickOwners(character.expertiseSkills ?? [], levelOrder, grants('expertiseGrant')),
		masteries: heldPickOwners(character.masteries ?? [], levelOrder, grants('masteryGrant')),
	}
	return { ...seeded, ...first, otherClasses: others, pickOwners }
}

/** A subclass missing from the loaded list keeps its name but carries no featureType, which sends its optional-feature picks through classOptionalFeatureChoices — where they pass through save unchanged rather than being dropped. */
function subclassChoiceFor(storedName: string | null, subclasses: WizardSeedLookups['subclasses']): SubclassChoice | null {
	if (!storedName) return null
	const option = subclasses.find((candidate) => candidate.name.toLowerCase() === storedName.toLowerCase())
	return { name: storedName, source: option?.source ?? '', featureType: option?.featureType ?? null }
}

export interface WizardControllerState {
	step: WizardStep
	data: WizardData
}

export function initialControllerState(): WizardControllerState {
	return { step: WIZARD_STEPS[0], data: emptyWizardData() }
}

export function stepIndex(step: WizardStep, conditions: WizardStepConditions = {}): number {
	return visibleSteps(conditions).indexOf(step)
}

function nextStep(step: WizardStep, conditions: WizardStepConditions): WizardStep | null {
	const steps = visibleSteps(conditions)
	const idx = steps.indexOf(step)
	return idx < steps.length - 1 ? steps[idx + 1] : null
}

function previousStep(step: WizardStep, conditions: WizardStepConditions): WizardStep | null {
	const steps = visibleSteps(conditions)
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
export function isStepComplete(step: WizardStep, data: WizardData, conditions: WizardStepConditions = {}): boolean {
	const {
		expertiseRequiredCount,
		expertiseSkillsAvailable,
		featAsiEligibleLevelCount,
		featsRequiringAbilityChoice,
		featAsiChoicesValid,
		spellRequirement,
		subclassSpellChoiceSlotCount,
		classOptionalFeaturesComplete,
		classFeatureChoicesComplete,
		speciesVariantChoiceComplete,
		speciesSkillsComplete,
		speciesSizeComplete,
		speciesSpellcastingAbilityComplete,
		speciesCantripComplete,
		wildShapeFormCount,
		classPickRequirements,
		startingEquipmentCategoryPicksComplete,
		backgroundOriginFeatComplete,
		speciesOriginFeatComplete,
		levelUpTargetLevel,
		hitDieFaces,
		multiclassPickCount,
		heldClasses,
		hitDieFacesByLevel,
		multiclassPicksComplete,
		characterLevel,
	} = resolveConditions(conditions)
	switch (step) {
		case 'class':
			// A granted D21 class-feature choice (Divine Order, Primal Order, Elemental Fury)
			// left unmade blocks the step, the same way classOptionalFeatures gates its own —
			// computed by areClassFeatureChoicesComplete against the loaded choices, since the
			// count of granted choices isn't derivable from WizardData alone.
			// A Druid's known Wild Shape forms are an exact count, like the spells step's:
			// the feature says the character KNOWS that many, not up to that many.
			return (
				data.name.trim() !== '' &&
				data.classChoice !== null &&
				classFeatureChoicesComplete &&
				data.wildShapeForms.length === wildShapeFormCount &&
				classPickRequirements !== null &&
				(classPickRequirements === undefined || classPicksComplete(data, classPickRequirements))
			)
		case 'species':
			// A species is REMEMBERED the moment it is picked, like a background, but the
			// step only COMPLETES once every choice the species itself carries is made
			// (D81/D82, D89 follow-up): the variant the book puts inside it, its skill
			// proficiencies, and (once a variant is resolved) its spellcasting-ability
			// choice. All three counts/lists come from species.json rather than from
			// WizardData, so they arrive as conditions — the same case as
			// classFeatureChoicesComplete.
			return (
				data.speciesChoice !== null &&
				speciesVariantChoiceComplete &&
				speciesSkillsComplete &&
				speciesSizeComplete &&
				speciesSpellcastingAbilityComplete &&
				speciesCantripComplete
			)
		case 'background':
			// A background is REMEMBERED the moment it is picked (D8), but the step only
			// COMPLETES once its ability-bonus distribution is finished: the picker fills
			// backgroundChoice.abilityBonus only for a complete, legal +2/+1 or +1/+1/+1,
			// so a non-empty map is exactly "the distribution is done".
			return (
				data.backgroundChoice !== null &&
				Object.keys(data.backgroundChoice.abilityBonus).length > 0 &&
				data.backgroundToolProficiency !== null &&
				backgroundOriginFeatComplete &&
				speciesOriginFeatComplete
			)
		case 'expertise':
			return expertiseRequiredCount === null || (activeClassPicks(data, 'expertiseSkills').length === expertiseRequiredCount && expertiseSkillsAvailable)
		case 'languages': {
			// A level-up walk only collects the new level's feature picks; the creation picks are not its to demand.
			const creationComplete = levelUpTargetLevel !== null || data.languageChoice.length === CHOSEN_LANGUAGE_COUNT
			const cls = wizardClass(data)
			const grants = cls ? classFeatureLanguageGrantsFor(heldClasses ?? [cls]) : []
			return (
				creationComplete &&
				multiclassPicksComplete &&
				grants.every((grant) => !grant.choice || data.featureLanguages.filter((language) => language.grantedBy === grant.choice?.grantedBy).length === grant.choice.count) &&
				// D176: at least the count — a surplus Artificer replacement pick is kept, not demanded away.
				[...wizardToolGrants(data, levelUpTargetLevel, heldClasses), ...wizardSpeciesToolGrants(data, levelUpTargetLevel)].every(
					(grant) => data.toolChoices.filter((choice) => choice.grantedBy === grant.grantedBy).length >= grant.count,
				) &&
				wizardSubclassSkillGrants(data, levelUpTargetLevel, heldClasses).every((grant) => isSubclassSkillChoiceMade(grant, data.subclassSkills, data.featureLanguages)) &&
				// D330: only a class entered in this level up (class level 1) owes its multiclass picks here.
				(levelUpTargetLevel === null || cls === null || cls.level > 1 || (data.multiclassPicks ?? []).filter((pick) => isClass(pick, cls)).length === multiclassPickCount) &&
				(levelUpTargetLevel !== null || !isKhoravar(data.speciesChoice) || data.speciesExtraSkill !== null || data.toolChoices.some((choice) => choice.grantedBy === 'khoravar'))
			)
		}
		case 'abilities':
			return data.abilityScores !== null
		case 'spells':
			return (
				(spellRequirement === null || isCompleteSpellChoices(data.spellChoices, spellRequirement)) &&
				data.subclassSpellChoices.length === subclassSpellChoiceSlotCount
			)
		case 'classOptionalFeatures':
			// Every granted class-level count filled AND no pick left in the warning state
			// (a chosen option whose prerequisite stopped holding) — computed by
			// areClassOptionalFeaturesComplete in optionalFeatureData.ts, not re-derived here.
			return classOptionalFeaturesComplete
		case 'featAsi':
			return (
				featAsiChoicesValid &&
				data.featAsiChoices.length === featAsiEligibleLevelCount &&
				data.featAsiChoices.every((choice) =>
					isCompleteFeatAsiChoice(choice, featsRequiringAbilityChoice, levelUpTargetLevel ?? (heldClasses ? characterLevel : data.classChoice?.level) ?? 0),
				)
			)
		case 'hitPoints':
			// Every level from 2 up to the character's own needs a recorded choice (D92/D57: "not
			// chosen" and "chose the average" must not look the same in storage). Level 1 is never
			// asked for — it is always the die maximum, not a choice.
			// A level-up walk (D103) narrows that to the single level being gained — the levels
			// below it are left on whatever they already had, not demanded here.
			// W20: "recorded" also means valid for its method (isValidHitPointEntry).
			// D333: a multiclass Edit checks every level against that level's own die (D323).
			if (hitDieFacesByLevel !== undefined) {
				return hitDieFacesByLevel !== null && hitDieFacesByLevel.every((faces, index) => index === 0 || data.hitPointLevels.some((entry) => entry.level === index + 1 && isValidHitPointEntry(entry, faces)))
			}
			return levelUpTargetLevel !== null
				? data.hitPointLevels.some((entry) => entry.level === levelUpTargetLevel && isValidHitPointEntry(entry, hitDieFaces))
				: isCompleteHitPointLevels(data.hitPointLevels, data.classChoice?.level ?? 1, hitDieFaces)
		case 'equipment':
			// A character takes one option from the class AND one from the background;
			// an unmade choice blocks the step. Whether a chosen option still needs a
			// category item picked can only be told from the loaded offers, so it
			// arrives as a condition (missingCategoryPicks computes it).
			return (
				data.startingEquipment.classOptionKey !== null &&
				data.startingEquipment.backgroundOptionKey !== null &&
				startingEquipmentCategoryPicksComplete
			)
		case 'review':
			return true
	}
}

/** Every level from 2 up to `characterLevel` must have its own recorded entry — an exact set, not just a count, so a duplicate or a level above the character's own cannot stand in for a missing one. */
function isCompleteHitPointLevels(hitPointLevels: CharacterHitPointLevel[], characterLevel: number, faces: number | null): boolean {
	for (let level = 2; level <= characterLevel; level++) {
		if (!hitPointLevels.some((entry) => entry.level === level && isValidHitPointEntry(entry, faces))) return false
	}
	return true
}

/** Cantrips and leveled spells are counted separately (a cantrip is not a leveled-spell pick) — both totals must match exactly. */
/** What the wizard stores per pick — `level` rides along so completion/count checks never need to re-fetch the spell list to classify a pick as cantrip vs leveled. */
export interface SpellPick {
	name: string
	source: string
	level: number
}

function isCompleteSpellChoices(spellChoices: SpellPick[], spellRequirement: SpellRequirement): boolean {
	const cantripsChosen = spellChoices.filter((pick) => pick.level === 0).length
	const leveledChosen = spellChoices.filter((pick) => pick.level > 0).length
	return cantripsChosen === spellRequirement.cantripCount && leveledChosen === spellRequirement.leveledSpellCount
}

/**
 * A recorded choice must be a fully-formed ASI (valid shape, D20) or a
 * fully-named feat — not a placeholder left over from picking "ASI" or
 * "Feat" but nothing further. A feat whose key is in
 * `featsRequiringAbilityChoice` (a half-feat, task instructions point 4)
 * additionally needs `chosenAbility` set — the step cannot complete with a
 * feat picked but its ability bonus target unknown. Base Magic Initiate
 * (d5b-2) additionally needs its own `magicInitiate` pick fully formed: a
 * class list, exactly 2 cantrips, 1 level-1 spell, and (like a half-feat) a
 * chosen ability. The 8 generic filter-choice feats (d5b-1) similarly need
 * `filterChoiceSpells` filled to each feat's own required cantrip/spell
 * counts (featSpellChoiceData.ts) — Ritual Caster's ability choice is
 * covered by the ordinary `featsRequiringAbilityChoice` check below since it
 * has a normal half-feat `ability` field, unlike Magic Initiate.
 */
export function isCompleteFeatAsiChoice(choice: FeatAsiChoice, featsRequiringAbilityChoice: ReadonlySet<string>, totalCharacterLevel: number): boolean {
	if (choice.kind === 'feat') {
		if (choice.name.trim() === '' || choice.source.trim() === '') return false
		if (isMagicInitiateFeat(choice)) {
			return (
				choice.chosenAbility !== undefined &&
				choice.magicInitiate !== undefined &&
				choice.magicInitiate.cantrips.length === 2 &&
				choice.magicInitiate.spell !== null
			)
		}
		if (featsRequiringAbilityChoice.has(`${choice.name}|${choice.source}`) && choice.chosenAbility === undefined) return false
		if (isNamedBlockFeat(choice) && (choice.blockName === undefined || choice.chosenAbility === undefined)) return false
		if (isFilterChoiceFeat(choice)) {
			const required = filterChoiceRequiredCounts(choice.name, choice.source, totalCharacterLevel)
			return (
				required !== null &&
				choice.filterChoiceSpells !== undefined &&
				choice.filterChoiceSpells.cantrips.length === required.cantrips &&
				choice.filterChoiceSpells.spells.length === required.spells
			)
		}
		return true
	}
	const amounts = Object.values(choice.increases)
	if (amounts.length === 1) return amounts[0] === 2
	if (amounts.length === 2) return amounts.every((amount) => amount === 1)
	return false
}

/**
 * W9: forward, a step can be jumped to when every visible step before it is complete — exactly as far
 * as repeated Next would get. D252: back (index ≤ the current step's) is always allowed.
 */
export function isStepReachable(step: WizardStep, current: WizardStep, data: WizardData, conditions: WizardStepConditions = {}): boolean {
	return reachableSteps(current, data, conditions).includes(step)
}

/** The steps the step bar may jump to, with each step's completeness evaluated once (D116). */
export function reachableSteps(current: WizardStep, data: WizardData, conditions: WizardStepConditions = {}): readonly WizardStep[] {
	const steps = visibleSteps(conditions)
	const firstIncomplete = steps.findIndex((step) => !isStepComplete(step, data, conditions))
	const prefixEnd = firstIncomplete === -1 ? steps.length - 1 : firstIncomplete
	return steps.filter((_, index) => index <= Math.max(prefixEnd, steps.indexOf(current)))
}

/** Whether every picker step is complete — the gate for the review step's save button. */
export function isReadyToSave(data: WizardData, conditions: WizardStepConditions = {}): boolean {
	return resolveConditions(conditions).heldClassesComplete && pickerSteps(conditions).every((step) => isStepComplete(step, data, conditions))
}

/** M9: what the class step and the spells step ask of one held class — the same values the UI computes for the active class. */
export interface HeldClassConditions {
	classPickRequirements?: ClassPickRequirements | null
	classFeatureChoicesComplete?: boolean
	wildShapeFormCount?: number
	spellRequirement?: SpellRequirement | null
	subclassSpellChoiceSlotCount?: number
	classOptionalFeaturesComplete?: boolean
	/** D335: the class's own mastery count; absent = not checked here (the active class's is the Class step's). */
	masteryCount?: number
	/** D335: the class's own Expertise count (capped by its pool) and how many of its picks fall outside that pool. */
	expertise?: { count: number; stale: number }
}

export interface UnfinishedClass {
	className: string
	classSource: string
	/** Short phrases, e.g. "choose 2 more spells". */
	missing: string[]
}

/**
 * M9 (question 1): the held classes of a multiclass Edit whose own picks are unfinished — the stashed ones and the
 * active one alike. Only the per-class fields are checked; the shared ones belong to their own steps.
 */
export function unfinishedHeldClasses(data: WizardData, conditionsFor: (cls: ClassStash) => HeldClassConditions): UnfinishedClass[] {
	if (!data.classChoice || !data.otherClasses) return []
	return [stashOf(data, data.classChoice), ...data.otherClasses].flatMap((cls) => {
		const conditions = conditionsFor(cls)
		const owned = (field: 'expertiseSkills' | 'masteries'): number => (data.pickOwners ? ownedPicks(data[field], data.pickOwners[field].owners, cls.classChoice).length : 0)
		const missing = [...missingClassPicks(cls, conditions), ...missingHeldPicks(owned('expertiseSkills'), owned('masteries'), conditions)]
		return missing.length > 0 ? [{ className: cls.classChoice.className, classSource: cls.classChoice.classSource, missing }] : []
	})
}

/** D333 (M9 place 32): equal data, whichever held class of a multiclass Edit is active. */
export function sameWizardData(a: WizardData, b: WizardData): boolean {
	const canonical = (data: WizardData): unknown => {
		if (!data.classChoice || !data.otherClasses) return data
		const {
			otherClasses,
			classChoice,
			subclass: _subclass,
			fightingStyle: _fightingStyle,
			optionalFeatureChoices: _optionalFeatureChoices,
			classOptionalFeatureChoices: _classOptionalFeatureChoices,
			spellChoices: _spellChoices,
			subclassSpellChoices: _subclassSpellChoices,
			classFeatureChoices: _classFeatureChoices,
			wildShapeForms: _wildShapeForms,
			activeClassFeatureTypes: _activeClassFeatureTypes,
			...shared
		} = data
		const key = (stash: ClassStash): string => `${stash.classChoice.className}|${stash.classChoice.classSource}`
		return { shared, classes: [stashOf(data, classChoice), ...otherClasses].sort((x, y) => key(x).localeCompare(key(y))) }
	}
	const stable = (value: unknown): string =>
		JSON.stringify(value, (_key, entry: unknown) =>
			entry !== null && typeof entry === 'object' && !Array.isArray(entry) ? Object.fromEntries(Object.entries(entry).sort(([x], [y]) => x.localeCompare(y))) : entry,
		)
	return stable(canonical(a)) === stable(canonical(b))
}

const countPhrase = (have: number, need: number, one: string, many: string): string[] => {
	const diff = Math.abs(need - have)
	const noun = diff === 1 ? one : many
	return have < need ? [`choose ${diff} more ${noun}`] : have > need ? [`remove ${diff} ${noun}`] : []
}

function missingHeldPicks(expertise: number, masteries: number, conditions: HeldClassConditions): string[] {
	const stale = conditions.expertise?.stale ?? 0
	return [
		...(conditions.masteryCount === undefined ? [] : countPhrase(masteries, conditions.masteryCount, 'weapon mastery', 'weapon masteries')),
		...(conditions.expertise === undefined ? [] : countPhrase(expertise, conditions.expertise.count, 'Expertise skill', 'Expertise skills')),
		...(stale > 0 ? [`replace ${stale} Expertise skill${stale === 1 ? '' : 's'} it no longer allows`] : []),
	]
}

function missingClassPicks(cls: ClassStash, conditions: HeldClassConditions): string[] {
	const count = countPhrase
	const required = conditions.classPickRequirements
	if (required === null) return ['requirements still loading']
	const missing: string[] = []
	if (required) {
		if (required.subclass === true && cls.subclass === null) missing.push('choose a subclass')
		if (required.subclass === false && cls.subclass !== null) missing.push('remove the subclass')
		if (required.fightingStyle === true && cls.fightingStyle === null) missing.push('choose a fighting style')
		if (required.fightingStyle === false && cls.fightingStyle !== null) missing.push('remove the fighting style')
		if (required.optionalFeatureCount !== null) missing.push(...count(cls.optionalFeatureChoices.length, required.optionalFeatureCount, 'subclass option', 'subclass options'))
		const featureNames = required.classFeatureNames
		if (featureNames !== null && !cls.classFeatureChoices.every((choice) => featureNames.includes(choice.featureName))) missing.push('remove a class feature choice')
	}
	if (conditions.classFeatureChoicesComplete === false) missing.push('finish the class feature choices')
	missing.push(...count(cls.wildShapeForms.length, conditions.wildShapeFormCount ?? 0, 'Wild Shape form', 'Wild Shape forms'))
	const spells = conditions.spellRequirement ?? null
	if (spells) {
		missing.push(...count(cls.spellChoices.filter((pick) => pick.level === 0).length, spells.cantripCount, 'cantrip', 'cantrips'))
		missing.push(...count(cls.spellChoices.filter((pick) => pick.level > 0).length, spells.leveledSpellCount, 'spell', 'spells'))
	}
	missing.push(...count(cls.subclassSpellChoices.length, conditions.subclassSpellChoiceSlotCount ?? 0, 'subclass spell', 'subclass spells'))
	if (conditions.classOptionalFeaturesComplete === false) missing.push('finish the class options')
	return missing
}

export type WizardAction =
	/** Replaces the whole in-progress character and returns to the first step — how the wizard opens over an existing one (slice 8d1), since the seed needs data loaded asynchronously and cannot be built at reducer-init time. */
	| { type: 'seed'; data: WizardData; conditions?: WizardStepConditions }
	| { type: 'next'; conditions?: WizardStepConditions }
	| { type: 'back'; conditions?: WizardStepConditions }
	| { type: 'goTo'; step: WizardStep; conditions?: WizardStepConditions }
	/** D251: dispatched once the class step's requirements have loaded for the current class, level and subclass. */
	| { type: 'pruneClassPicks'; requirements: ClassPickRequirements }
	| { type: 'pruneClassOptionalFeatures'; featureTypes: readonly string[] }
	| { type: 'setName'; name: string }
	| { type: 'setPortrait'; portrait: string | null }
	| { type: 'setClassChoice'; choice: ClassLevelChoice | null }
	/** M9: a multiclass Edit makes another held class active; the shared fields stay as they are. */
	| { type: 'switchClass'; to: { className: string; classSource: string } }
	| { type: 'setSpeciesChoice'; choice: SpeciesChoice | null }
	| { type: 'setSpeciesSkills'; skills: string[] }
	| { type: 'setSpeciesSpellcastingAbility'; ability: Ability | null }
	| { type: 'setSpeciesCantrip'; cantrip: { name: string; source: string } | null }
	| { type: 'setExpertiseSkills'; skills: string[] }
	/** D335: the active class's own Expertise or mastery picks in a multiclass Edit; the other classes' stay. */
	| { type: 'setActiveClassPicks'; field: 'expertiseSkills' | 'masteries'; picks: string[] }
	| { type: 'setBackgroundChoice'; choice: BackgroundChoice | null }
	| { type: 'setBackgroundToolProficiency'; tool: string | null }
	| { type: 'setLanguageChoice'; choice: LanguageChoice }
	| { type: 'setFeatureLanguages'; languages: CharacterLanguage[] }
	| { type: 'setToolChoices'; choices: CharacterToolChoice[] }
	| { type: 'setSubclassSkills'; skills: CharacterSubclassSkill[]; languages: CharacterLanguage[] }
	| { type: 'setMulticlassPicks'; picks: CharacterMulticlassPick[] }
	| { type: 'setSpeciesSkillOrTool'; skill: string | null; tool: string | null }
	| { type: 'setSpeciesSize'; size: string | null }
	| { type: 'setAbilityScores'; scores: CharacterAbilityScores | null }
	| { type: 'setClassSkills'; skills: string[] }
	| { type: 'setMasteries'; weapons: string[] }
	| { type: 'setFightingStyle'; style: string | null }
	| { type: 'setSubclass'; subclass: SubclassChoice | null }
	| { type: 'setOptionalFeatureChoices'; choices: string[] }
	| { type: 'setClassOptionalFeatureChoices'; choices: CharacterOptionalFeatureChoice[] }
	| { type: 'setFeatAsiChoices'; choices: FeatAsiChoice[] }
	/** Replaces the one entry of `feat.origin`. */
	| { type: 'setGrantedFeat'; feat: CharacterGrantedFeat }
	| { type: 'setBackgroundOriginFeatOverride'; feat: { name: string; source: string } | null }
	| { type: 'setSpellChoices'; choices: SpellPick[] }
	| { type: 'setSubclassSpellChoices'; picks: CharacterSubclassSpellChoicePick[] }
	| { type: 'setClassFeatureChoices'; choices: CharacterClassFeatureChoice[] }
	| { type: 'setWildShapeForms'; forms: { name: string; source: string }[] }
	| { type: 'setHitPointLevels'; levels: CharacterHitPointLevel[] }
	| { type: 'setStartingEquipment'; choice: StartingEquipmentChoice }

/**
 * Pure navigation + edit reducer. `next` is a no-op unless the current step
 * is complete; `back` always succeeds and never touches `data`, so whatever
 * was already chosen on earlier steps survives the round trip.
 */
export function wizardReducer(state: WizardControllerState, action: WizardAction): WizardControllerState {
	switch (action.type) {
		case 'seed':
			// A level-up walk may leave out the class step, so it starts on the first step that level actually offers.
			return { step: visibleSteps(action.conditions ?? {})[0], data: action.data }
		case 'next': {
			const conditions = action.conditions ?? {}
			if (!isStepComplete(state.step, state.data, conditions)) return state
			const next = nextStep(state.step, conditions)
			return next ? { ...state, step: next } : state
		}
		case 'back': {
			const prev = previousStep(state.step, action.conditions ?? {})
			return prev ? { ...state, step: prev } : state
		}
		case 'goTo':
			return isStepReachable(action.step, state.step, state.data, action.conditions ?? {}) ? { ...state, step: action.step } : state
		case 'pruneClassPicks':
			return pruneClassPicks(state, action.requirements)
		case 'pruneClassOptionalFeatures':
			return pruneClassOptionalFeatures(state, action.featureTypes)
		case 'setName':
			return { ...state, data: { ...state.data, name: action.name } }
		case 'setPortrait': {
			const { portrait: _previous, ...data } = state.data
			return { ...state, data: action.portrait ? { ...data, portrait: action.portrait } : data }
		}
		case 'setClassChoice': {
			/*
			 * D100: everything below is keyed to the CLASS — its skill list, its
			 * masteries, its subclasses, its hit die — so a different class must
			 * clear all of it. A different LEVEL on the same class must not: level
			 * up (slice 8d3) and editing an existing character both change only the
			 * level, and wiping there would throw away every choice already
			 * recorded, including the levels they were taken at (D97/D98/D99).
			 */
			const previous = state.data.classChoice
			const sameClass =
				previous !== null &&
				action.choice !== null &&
				previous.className === action.choice.className &&
				previous.classSource === action.choice.classSource
			if (sameClass) return { ...state, data: { ...state.data, classChoice: action.choice } }
			return {
				...state,
				data: {
					...state.data,
					classChoice: action.choice,
					featureLanguages: [],
					toolChoices: state.data.toolChoices.filter(isSpeciesToolChoice),
					subclassSkills: [],
					classSkills: [],
					expertiseSkills: [],
					masteries: [],
					fightingStyle: null,
					subclass: null,
					optionalFeatureChoices: [],
					classOptionalFeatureChoices: [],
					featAsiChoices: [],
					spellChoices: [],
					subclassSpellChoices: [],
					classFeatureChoices: [],
					wildShapeForms: [],
					hitPointLevels: [],
					startingEquipment: clearStartingEquipmentFor(state.data.startingEquipment, 'class'),
				},
			}
		}
		case 'switchClass': {
			const { classChoice, otherClasses } = state.data
			const target = otherClasses?.find((stash) => isClass(stash.classChoice, action.to))
			if (!classChoice || !otherClasses || !target) return state
			const current = stashOf(state.data, classChoice)
			return { ...state, data: { ...state.data, ...target, otherClasses: otherClasses.map((stash) => (stash === target ? current : stash)) } }
		}
		case 'setSpeciesChoice': {
			const prev = state.data.speciesChoice
			const sameSpecies = prev !== null && action.choice !== null && prev.name === action.choice.name && prev.source === action.choice.source
			return {
				...state,
				data: {
					...state.data,
					speciesChoice: action.choice,
					grantedFeats: sameSpecies ? state.data.grantedFeats : state.data.grantedFeats.filter((feat) => feat.origin !== 'species'),
					speciesSkills: [],
					speciesExtraSkill: null,
					toolChoices: state.data.toolChoices.filter((choice) => !isSpeciesToolChoice(choice)),
					speciesSize: null,
					speciesSpellcastingAbility: null,
					speciesCantrip: sameSpecies ? state.data.speciesCantrip : null,
					expertiseSkills: [],
				},
			}
		}
		case 'setSpeciesCantrip':
			return { ...state, data: { ...state.data, speciesCantrip: action.cantrip } }
		case 'setSpeciesSkills':
			return { ...state, data: { ...state.data, speciesSkills: action.skills, expertiseSkills: [] } }
		case 'setSpeciesSpellcastingAbility':
			return { ...state, data: { ...state.data, speciesSpellcastingAbility: action.ability } }
		case 'setExpertiseSkills':
			return { ...state, data: { ...state.data, expertiseSkills: action.skills } }
		case 'setActiveClassPicks': {
			const { classChoice, pickOwners } = state.data
			if (!classChoice || !pickOwners) return { ...state, data: { ...state.data, [action.field]: action.picks } }
			const next = withOwnedPicks(state.data[action.field], pickOwners[action.field], classChoice, action.picks)
			return { ...state, data: { ...state.data, [action.field]: next.names, pickOwners: { ...pickOwners, [action.field]: { ...pickOwners[action.field], owners: next.owners } } } }
		}
		case 'setBackgroundChoice': {
			// The picker now reports through this action on every sub-step of the
			// choice (background picked, then each ability-bonus pick), so tool
			// proficiency and expertise — keyed to a specific background — clear only
			// when the background's identity changes, not when its distribution does.
			const prev = state.data.backgroundChoice
			const sameBackground =
				prev !== null &&
				action.choice !== null &&
				prev.name === action.choice.name &&
				prev.source === action.choice.source
			return {
				...state,
				data: {
					...state.data,
					backgroundChoice: action.choice,
					backgroundToolProficiency: sameBackground ? state.data.backgroundToolProficiency : null,
					expertiseSkills: sameBackground ? state.data.expertiseSkills : [],
					grantedFeats: sameBackground ? state.data.grantedFeats : state.data.grantedFeats.filter((feat) => feat.origin !== 'background'),
					backgroundOriginFeatOverride: sameBackground ? state.data.backgroundOriginFeatOverride : null,
					startingEquipment: sameBackground
						? state.data.startingEquipment
						: clearStartingEquipmentFor(state.data.startingEquipment, 'background'),
				},
			}
		}
		case 'setBackgroundToolProficiency':
			return { ...state, data: { ...state.data, backgroundToolProficiency: action.tool } }
		case 'setLanguageChoice':
			return { ...state, data: { ...state.data, languageChoice: action.choice } }
		case 'setFeatureLanguages':
			return { ...state, data: { ...state.data, featureLanguages: action.languages } }
		case 'setToolChoices':
			return { ...state, data: { ...state.data, toolChoices: action.choices } }
		case 'setSubclassSkills':
			return { ...state, data: { ...state.data, subclassSkills: action.skills, featureLanguages: action.languages } }
		case 'setMulticlassPicks':
			return { ...state, data: { ...state.data, multiclassPicks: action.picks } }
		case 'setSpeciesSkillOrTool': {
			const others = state.data.toolChoices.filter((choice) => choice.grantedBy !== 'khoravar')
			return {
				...state,
				data: { ...state.data, speciesExtraSkill: action.skill, toolChoices: action.tool ? [...others, { grantedBy: 'khoravar', name: action.tool }] : others },
			}
		}
		case 'setSpeciesSize':
			return { ...state, data: { ...state.data, speciesSize: action.size } }
		case 'setAbilityScores':
			return { ...state, data: { ...state.data, abilityScores: action.scores } }
		case 'setClassSkills':
			return { ...state, data: { ...state.data, classSkills: action.skills, expertiseSkills: [] } }
		case 'setMasteries':
			return { ...state, data: { ...state.data, masteries: action.weapons } }
		case 'setFightingStyle':
			return { ...state, data: { ...state.data, fightingStyle: action.style } }
		case 'setSubclass': {
			// M9: in a multiclass Edit the other held classes' subclass picks stay.
			const othersGrants = subclassSkillGrantsFor(
				(state.data.otherClasses ?? []).map((stash) => ({ ...stash.classChoice, subclass: stash.subclass?.name ?? null })),
			)
			const othersLanguages = keepHeldSubclassLanguages(state.data.featureLanguages, othersGrants)
			// D338: a first pick (no subclass before) invalidates none of these; only a change of subclass does (M9b).
			const firstPick = state.data.subclass === null
			return {
				...state,
				// wildShapeForms clears on a change: Circle of the Moon's Circle Forms raises the CR cap, so the legal pool is subclass-dependent.
				data: {
					...state.data,
					subclass: action.subclass,
					optionalFeatureChoices: firstPick ? state.data.optionalFeatureChoices : [],
					spellChoices: firstPick ? state.data.spellChoices : [],
					subclassSpellChoices: [],
					wildShapeForms: firstPick ? state.data.wildShapeForms : [],
					subclassSkills: keepHeldSubclassSkills(state.data.subclassSkills, othersGrants),
					featureLanguages: state.data.featureLanguages.filter((language) => !SUBCLASS_LANGUAGE_SOURCES.has(language.grantedBy) || othersLanguages.includes(language)),
				},
			}
		}
		case 'setOptionalFeatureChoices':
			return { ...state, data: { ...state.data, optionalFeatureChoices: action.choices } }
		case 'setClassOptionalFeatureChoices':
			return { ...state, data: { ...state.data, classOptionalFeatureChoices: action.choices } }
		case 'setFeatAsiChoices':
			return { ...state, data: { ...state.data, featAsiChoices: action.choices } }
		case 'setGrantedFeat':
			return { ...state, data: { ...state.data, grantedFeats: [...state.data.grantedFeats.filter((feat) => feat.origin !== action.feat.origin), action.feat] } }
		case 'setBackgroundOriginFeatOverride':
			return {
				...state,
				data: { ...state.data, backgroundOriginFeatOverride: action.feat, grantedFeats: state.data.grantedFeats.filter((feat) => feat.origin !== 'background') },
			}
		case 'setSpellChoices':
			return { ...state, data: { ...state.data, spellChoices: action.choices } }
		case 'setSubclassSpellChoices':
			return { ...state, data: { ...state.data, subclassSpellChoices: action.picks } }
		case 'setClassFeatureChoices':
			return { ...state, data: { ...state.data, classFeatureChoices: action.choices } }
		case 'setWildShapeForms':
			return { ...state, data: { ...state.data, wildShapeForms: action.forms } }
		case 'setHitPointLevels':
			return { ...state, data: { ...state.data, hitPointLevels: action.levels } }
		case 'setStartingEquipment':
			return { ...state, data: { ...state.data, startingEquipment: action.choice } }
	}
}

/** Drops one side's option and its category picks; the other side's are keyed by their own origin and survive. */
function clearStartingEquipmentFor(choice: StartingEquipmentChoice, origin: 'class' | 'background'): StartingEquipmentChoice {
	return {
		...choice,
		...(origin === 'class' ? { classOptionKey: null } : { backgroundOptionKey: null }),
		categoryPicks: Object.fromEntries(Object.entries(choice.categoryPicks).filter(([key]) => !key.startsWith(`${origin}:`))),
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
 *
 * `startingEquipment` is the inventory and copper total the equipment step's
 * two chosen options produce (buildStartingInventory) — computed by the caller
 * for the same reason as `backgroundSkillProficiencies`: it needs the loaded
 * offers, which WizardData deliberately doesn't carry. Ignored when `existing`
 * is given: that character's inventory is live play state, not a creation grant.
 *
 * `existing` is the character this run was seeded from (slice 8d1). With it the
 * write UPDATES that character instead of creating a second one, the level is
 * refused if it changed at all (D105 — raising is Level up's job, lowering is
 * Remove level's job, slice 8e), every pick that was already on the character
 * keeps the level it was taken at, and the play-time fields the wizard never
 * collects are carried through.
 *
 * `levelUpTo` (slice 8d3) marks the write that ends a level-up walk: it must
 * raise `existing` by exactly one level in the class it already has, and every
 * pick that was not on `existing` records that new level (D97/D98/D99).
 *
 * `computedCurrentHp` (D107) is the `currentHp` this save should write,
 * already resolved by the caller — computing it needs classes.json/feats.json/
 * species.json, which this module has no access to (same reason
 * `backgroundSkillProficiencies`/`startingEquipment` are precomputed args).
 * `undefined` (the default) keeps today's behaviour: `existing`'s own
 * `currentHp` carried through unchanged, which is also correct for a plain
 * edit (D105) and for a character `maxHp` couldn't be resolved for.
 */
export function saveCharacter(
	store: CharacterStore,
	data: WizardData,
	backgroundSkillProficiencies?: [string, string],
	conditions: WizardStepConditions = {},
	startingEquipment?: { inventory: CharacterInventoryItem[]; currencyCopper: number },
	existing?: Character,
	levelUpTo?: number,
	computedCurrentHp?: number,
	/** D318: resolves the source a sourceless fighting style or optional-feature pick is saved with; without it, such picks stay sourceless. */
	pickSources?: PickSourceLookup,
	/** D336: a level up's spent resource counts after a pool split (resourceUsesAfterLevelUp); absent keeps `existing`'s. */
	levelUpResourceUses?: Record<string, number>,
): Character {
	if (!isReadyToSave(data, conditions)) {
		throw new Error('Cannot save a character before every step is complete.')
	}

	// M9: a multiclass Edit keeps every class and its level; each class's records come from the active class or its stash.
	const multiclassEdit = existing !== undefined && levelUpTo === undefined && isMulticlass(existing.classes)
	if (multiclassEdit && !(existing.levelOrder && isConsistentLevelOrder(existing.levelOrder, existing.classes))) {
		throw new Error('Cannot tell which class each level came from (no level history).')
	}
	const heldClasses = multiclassEdit ? heldClassFields(existing, data) : undefined

	const existingLevel = existing ? totalCharacterLevel(existing.classes) : 0
	if (existing && levelUpTo === undefined && !multiclassEdit && (data.classChoice?.level ?? 0) !== existingLevel) {
		throw new Error(`Editing a character cannot change its level: this character is level ${existingLevel}.`)
	}
	// D330: a level up into a class the character does not have yet; it joins at class level 1.
	const entering = levelUpTo !== undefined && existing !== undefined && data.classChoice !== null && !existing.classes.some((entry) => isClass(entry, data.classChoice!))
	// D329: a level up of one class of a multiclass character; every record of the other classes passes through unchanged.
	const activeClass = levelUpTo !== undefined && existing && (isMulticlass(existing.classes) || entering) && data.classChoice ? data.classChoice : undefined
	if (levelUpTo !== undefined) {
		const existingClass = existing?.classes.find((entry) => data.classChoice !== null && isClass(entry, data.classChoice))
		const fromLevel = entering ? 0 : existingClass?.level
		if (!existing || fromLevel === undefined || existingLevel !== levelUpTo - 1 || data.classChoice?.level !== fromLevel + 1) {
			throw new Error(`A level up raises one existing class by exactly one level, or adds one new class at level 1, to level ${levelUpTo}.`)
		}
		const overwritten = overwrittenHeldPicks(
			existing!,
			data,
			activeClass && { className: activeClass.className, classSource: activeClass.classSource, featureTypes: data.activeClassFeatureTypes ?? [] },
		)
		if (overwritten.length > 0) {
			throw new Error(`A level up only adds picks; it cannot change one made at an earlier level: ${overwritten.join(', ')}.`)
		}
		// D330: held picks are kept above; anything else must belong to the class entered now.
		const heldMulticlassPicks = existing!.multiclassPicks ?? []
		const addedPicks = (data.multiclassPicks ?? []).filter((pick) => !heldMulticlassPicks.some((held) => isClass(held, pick) && held.kind === pick.kind && held.name === pick.name))
		if (addedPicks.some((pick) => !entering || !isClass(pick, data.classChoice!))) {
			throw new Error('Only a class entered in this level up takes multiclass picks.')
		}
	}

	const ownClass: CharacterClass | null = data.classChoice
		? {
				className: data.classChoice.className,
				classSource: data.classChoice.classSource,
				subclass: data.subclass?.name ?? null,
				level: data.classChoice.level,
			}
		: null
	const classes: CharacterClass[] = heldClasses
		? heldClasses.map((cls) => ({ className: cls.classChoice!.className, classSource: cls.classChoice!.classSource, subclass: cls.subclass?.name ?? null, level: cls.classChoice!.level }))
		: activeClass
			? classesAfterLevelUp(existing!.classes, ownClass!)
			: ownClass
				? [ownClass]
				: []
	if (activeClass) checkOneClassRaised(existing!.classes, classes, levelUpTo!)
	if (heldClasses) checkNoClassRaised(existing!.classes, classes)
	if (multiclassEdit) {
		const first = firstClass(existing!)
		// D330: a multiclass pick belongs to a held class other than the one that took character level 1.
		if ((data.multiclassPicks ?? []).some((pick) => !classes.some((entry) => isClass(entry, pick)) || (first !== undefined && isClass(pick, first)))) {
			throw new Error('A multiclass pick must belong to a held class other than the first.')
		}
	}

	const background: CharacterBackground | undefined =
		data.backgroundChoice && backgroundSkillProficiencies && data.backgroundToolProficiency
			? {
					name: data.backgroundChoice.name,
					source: data.backgroundChoice.source,
					skillProficiencies: backgroundSkillProficiencies,
					toolProficiency: data.backgroundToolProficiency,
					...(data.backgroundOriginFeatOverride ? { originFeatOverride: data.backgroundOriginFeatOverride } : {}),
				}
			: undefined

	// D337: a level up never passes the Background step, so a character stored without abilityBonus is seeded with {}, which validate rejects.
	const chosenBonus = data.backgroundChoice?.abilityBonus
	const abilityBonus: AbilityBonusMap | undefined = chosenBonus && Object.keys(chosenBonus).length > 0 ? chosenBonus : existing?.abilityBonus

	/**
	 * Common is added here, not in the picker's own value — the picker only
	 * ever reports the player's picks. Every known language carries
	 * `grantedBy` so its source survives into storage (see
	 * CharacterLanguage in storage/character.ts).
	 */
	const allLanguages: CharacterLanguage[] = [
		...(data.languageChoice.length > 0
			? [{ ...AUTOMATIC_LANGUAGE, grantedBy: 'automatic' as const }, ...data.languageChoice.map((entry) => ({ ...entry, grantedBy: 'creation' as const }))]
			: []),
		...keepHeldFeatureLanguages(data.featureLanguages, classFeatureLanguageGrantsFor(classes)),
		...keepHeldSubclassLanguages(data.featureLanguages, subclassSkillGrantsFor(classes)),
	]
	const languages = allLanguages.length > 0 ? allLanguages : undefined
	const heldToolChoices = [...keepHeldToolChoices(data.toolChoices, toolGrantsForHeldClasses(classes)), ...keepHeldSpeciesToolChoices(data.toolChoices, data.speciesChoice)]
	const toolChoices = heldToolChoices.length > 0 ? heldToolChoices : undefined
	const heldSubclassSkills = keepHeldSubclassSkills(data.subclassSkills, subclassSkillGrantsFor(classes))
	const subclassSkills = heldSubclassSkills.length > 0 ? heldSubclassSkills : undefined
	const speciesSkills = data.speciesExtraSkill !== null && isKhoravar(data.speciesChoice) ? [...data.speciesSkills, data.speciesExtraSkill] : data.speciesSkills

	const withPickSource = pickSourceResolver(pickSources)
	const heldStyle = existing && !entering ? fightingStyleFor(existing.fightingStyles, activeClass ?? existing.classes[0]) : undefined
	const own = classRecordsFor(data, heldStyle, existing, levelUpTo, withPickSource)

	/**
	 * No level is recorded (D97): the wizard picks every mastery in one step,
	 * so a character created directly at level 5 could not say which pick
	 * belonged to which level. WizardData keeps bare names because the picker
	 * is a name-based control; the shape is put on here, at the storage edge.
	 */
	const masteries: CharacterMastery[] =
		multiclassEdit && data.pickOwners ? keepHeldClassLevels(data.masteries, existing.masteries, data.pickOwners.masteries) : keepRecordedLevels(data.masteries, existing?.masteries, levelUpTo)

	/** No level is recorded, for exactly the reason masteries records none (D98 following D97). */
	const expertiseSkills: CharacterExpertiseSkill[] =
		multiclassEdit && data.pickOwners
			? keepHeldClassLevels(data.expertiseSkills, existing.expertiseSkills, data.pickOwners.expertiseSkills)
			: keepRecordedLevels(data.expertiseSkills, existing?.expertiseSkills, levelUpTo)

	/** Passes straight through to storage (build order step 8, slice 8b) — already exactly Character.hitPointLevels' own shape, one entry per level from 2 up. */
	const hitPointLevels: CharacterHitPointLevel[] | undefined = data.hitPointLevels.length > 0 ? data.hitPointLevels : undefined

	const orNone = <T,>(list: T[]): T[] | undefined => (list.length > 0 ? list : undefined)
	const activeFeatureTypes = [
		...(data.subclass?.featureType ? [data.subclass.featureType] : []),
		...(data.activeClassFeatureTypes ?? []),
		...data.classOptionalFeatureChoices.map((entry) => entry.featureType),
	]
	const storedStyles = existing?.fightingStyles ?? []
	const hadTaggedStyle = (cls: ClassFields): boolean => storedStyles.some((style) => style.className === cls.classChoice!.className && style.classSource === cls.classChoice!.classSource)
	const held = heldClasses?.map((cls) =>
		classRecordsFor(
			cls,
			// D334: a class with no tagged style may have adopted the untagged one at seed, so its source carries over.
			fightingStyleFor(storedStyles, cls.classChoice!),
			existing,
			undefined,
			withPickSource,
		),
	)
	// D334: a class that had no tagged style and now writes one adopted the pre-58 untagged style; that record is replaced, not duplicated.
	const adoptedUntagged = heldClasses?.some((cls) => cls.fightingStyle !== null && !hadTaggedStyle(cls)) ?? false
	const perClass = held
		? {
				// D318: an untagged style no class adopted stays as it was.
				fightingStyles: orNone([...storedStyles.filter((style) => style.className === undefined).slice(adoptedUntagged ? 1 : 0), ...held.flatMap((records) => records.fightingStyles)]),
				optionalFeatureChoices: orNone(held.flatMap((records) => records.optionalFeatureChoices)),
				spellChoices: orNone(held.flatMap((records) => records.spellChoices)),
				subclassSpellChoices: orNone(held.flatMap((records) => records.subclassSpellChoices)),
				classFeatureChoices: orNone(held.flatMap((records) => records.classFeatureChoices)),
				wildShapeForms: orNone(held.flatMap((records) => records.wildShapeForms)),
			}
		: activeClass
			? {
					fightingStyles: orNone([...otherFightingStyles(existing!.fightingStyles, activeClass, data.fightingStyle === null ? undefined : heldStyle), ...own.fightingStyles]),
					optionalFeatureChoices: orNone([...otherOptionalFeatureChoices(existing!.optionalFeatureChoices, activeFeatureTypes), ...own.optionalFeatureChoices]),
					spellChoices: orNone([...otherClassRecords(existing!.spellChoices, activeClass), ...own.spellChoices]),
					subclassSpellChoices: orNone([...otherClassRecords(existing!.subclassSpellChoices, activeClass), ...own.subclassSpellChoices]),
					classFeatureChoices: orNone([...otherClassRecords(existing!.classFeatureChoices, activeClass), ...own.classFeatureChoices]),
					wildShapeForms: orNone([...otherClassRecords(existing!.wildShapeForms, activeClass), ...own.wildShapeForms]),
				}
			: {
					fightingStyles: orNone(own.fightingStyles),
					optionalFeatureChoices: orNone(own.optionalFeatureChoices),
					spellChoices: orNone(own.spellChoices),
					subclassSpellChoices: orNone(own.subclassSpellChoices),
					classFeatureChoices: orNone(own.classFeatureChoices),
					wildShapeForms: orNone(own.wildShapeForms),
				}

	const input = {
		name: data.name,
		classes,
		abilityScores: data.abilityScores ?? undefined,
		species: data.speciesChoice ?? undefined,
		background,
		abilityBonus,
		languages,
		classSkills: data.classSkills,
		masteries,
		fightingStyles: perClass.fightingStyles,
		optionalFeatureChoices: perClass.optionalFeatureChoices,
		speciesSkills,
		expertiseSkills,
		featAsiChoices: data.featAsiChoices,
		grantedFeats: data.grantedFeats.length > 0 ? data.grantedFeats : undefined,
		spellChoices: perClass.spellChoices,
		subclassSpellChoices: perClass.subclassSpellChoices,
		classFeatureChoices: perClass.classFeatureChoices,
		wildShapeForms: perClass.wildShapeForms,
		// Editing keeps what the character carries: the equipment step is not part of an edit.
		inventory: existing ? existing.inventory : startingEquipment?.inventory,
		currencyCopper: existing ? existing.currencyCopper : startingEquipment?.currencyCopper,
		speciesSpellcastingAbility: data.speciesSpellcastingAbility ?? undefined,
		speciesCantrip: data.speciesCantrip ?? undefined,
		speciesSize: data.speciesSize ?? undefined,
		toolChoices,
		subclassSkills,
		hitPointLevels,
		// Play state the wizard has no control over, carried across an update that replaces every field.
		// D107: a caller-resolved default (creation's fresh maximum, a level up's raised amount) wins when given.
		currentHp: computedCurrentHp !== undefined ? computedCurrentHp : existing?.currentHp,
		maxHpOverride: existing?.maxHpOverride,
		/*
		 * D110: play state, not a level-time choice — an edit or a level up carries it across unchanged.
		 * D111: the store keeps the death saves only while the resulting current is 0, so a level up that raises it clears them by itself.
		 */
		play: levelUpTo !== undefined && levelUpResourceUses !== undefined ? playWithResourceUses(existing?.play, levelUpResourceUses) : existing?.play,
		familiar: existing?.familiar,
		// Slice 8e: set by the creation run only. An edit or a level up keeps what the character had, including "not known".
		createdAtLevel: existing ? existing.createdAtLevel : data.classChoice?.level,
		// D317: create and Edit (single-class since M0, may change the class) rebuild it; a level up appends, and keeps "not known" as it is.
		// D328: what a level up appends is the class whose level rose, not classes[0].
		// M9: a multiclass Edit changes no class or level, so its history stands as stored.
		levelOrder: multiclassEdit ? existing!.levelOrder : levelUpTo === undefined ? singleClassLevelOrder(classes) : existing && levelOrderAfterLevelUp(levelOrderBeforeLevelUp(existing, classes), classes),
		// D330: every class's multiclass picks; only the entered class's may be new (overwrittenHeldPicks keeps the others).
		multiclassPicks: data.multiclassPicks && data.multiclassPicks.length > 0 ? data.multiclassPicks : undefined,
		// Slice 9d2: sheet-only text the wizard never shows, carried across so an edit or a level up does not erase it.
		appearance: existing?.appearance,
		backstory: existing?.backstory,
		notes: existing?.notes,
		// W-8: seeded from the character by wizardDataFromCharacter, so an edit or a level up that does not touch it keeps it.
		portrait: data.portrait,
	}

	return existing ? store.update(existing.id, input) : store.create(input)
}

function playWithResourceUses(play: Character['play'], resourceUses: Record<string, number>): Character['play'] {
	const { resourceUses: _old, ...rest } = play ?? {}
	const next = { ...rest, ...(Object.keys(resourceUses).length > 0 ? { resourceUses } : {}) }
	return Object.keys(next).length > 0 ? next : undefined
}

type WithPickSource =<T extends { name: string; source?: string }>(featureType: string, pick: T) => T

// D318: a pick without a source gets the one its name resolves to today (first same-named row), so the save records what the sheet already showed.
function pickSourceResolver(pickSources: PickSourceLookup | undefined): WithPickSource {
	return (featureType, pick) => {
		if (pick.source !== undefined) return pick
		const source = pickSources?.(featureType, pick.name)
		return source === undefined ? pick : { ...pick, source }
	}
}

/**
 * M9: every class held in a multiclass Edit, in `existing.classes` order — the active one from `data`, the others from
 * its stash. Throws unless the active class and the stash together are exactly the stored classes.
 */
function heldClassFields(existing: Character, data: WizardData): ClassFields[] {
	const others = data.otherClasses ?? []
	const held = existing.classes.map((entry) => (data.classChoice && isClass(entry, data.classChoice) ? data : others.find((stash) => isClass(stash.classChoice, entry))))
	if (others.length !== existing.classes.length - 1 || held.some((cls) => cls === undefined)) {
		throw new Error('Editing a multiclass character must hold every one of its classes.')
	}
	return held as ClassFields[]
}

interface ClassRecords {
	fightingStyles: CharacterFightingStyle[]
	optionalFeatureChoices: CharacterOptionalFeatureChoice[]
	spellChoices: CharacterSpellChoice[]
	subclassSpellChoices: CharacterSubclassSpellChoice[]
	classFeatureChoices: CharacterClassFeatureChoice[]
	wildShapeForms: CharacterWildShapeForms[]
}

/** M9: one class's own storage records, built from its per-class fields; `heldStyle` is the style it held before this run. */
function classRecordsFor(
	cls: ClassFields,
	heldStyle: CharacterFightingStyle | undefined,
	existing: Character | undefined,
	levelUpTo: number | undefined,
	withPickSource: WithPickSource,
): ClassRecords {
	const classTag = cls.classChoice ? { className: cls.classChoice.className, classSource: cls.classChoice.classSource } : null
	const fightingStyles: CharacterFightingStyle[] =
		cls.fightingStyle === null
			? []
			: [
					withPickSource('FS', {
						...(classTag ?? {}),
						name: cls.fightingStyle,
						...(heldStyle?.name === cls.fightingStyle && heldStyle.source !== undefined ? { source: heldStyle.source } : {}),
					}),
				]

	/**
	 * Tagged with the subclass's own featureType (D21) so more than one
	 * progression's picks could coexist later without ambiguity — see
	 * CharacterOptionalFeatureChoice. The class's OWN progression picks (slice
	 * 2) are already in that shape and join the same array: no schema change,
	 * and nothing distinguishes the two beyond the featureType code, which is
	 * enough to tell them apart later (chosenClassOptionalFeatures).
	 */
	const subclassFeatureType = cls.subclass?.featureType
	const subclassOptionalFeatureChoices: CharacterOptionalFeatureChoice[] =
		cls.optionalFeatureChoices.length > 0 && subclassFeatureType
			? // D99, as D97: a creation pick records no level — the wizard makes every pick in one step.
				[
					{
						featureType: subclassFeatureType,
						choices: keepRecordedLevels(
							cls.optionalFeatureChoices,
							existing?.optionalFeatureChoices?.find((entry) => entry.featureType === subclassFeatureType)?.choices,
							levelUpTo,
						).map((choice) => withPickSource(subclassFeatureType, choice)),
					},
				]
			: []
	// The class picker already keeps each existing pick's own level; only a pick new to this walk is stamped.
	const classOptionalFeatureChoices = cls.classOptionalFeatureChoices
		.filter((entry) => entry.choices.length > 0)
		.map((entry) => {
			const sourced = { ...entry, choices: entry.choices.map((choice) => withPickSource(entry.featureType, choice)) }
			if (levelUpTo === undefined) return sourced
			const held = new Set(choiceNames(existing?.optionalFeatureChoices?.find((stored) => stored.featureType === entry.featureType)?.choices))
			return {
				...sourced,
				choices: sourced.choices.map((choice) => (choice.level !== undefined || held.has(choice.name) ? choice : { ...choice, level: levelUpTo })),
			}
		})

	// D334: an unchanged subclass keeps the source it was stored with; the seed's lookup may be missing or a same-named subclass of another source.
	const storedSubclassSource = classTag && cls.subclass
		? existing?.subclassSpellChoices?.find((stored) => stored.className === classTag.className && stored.classSource === classTag.classSource && stored.subclassName.toLowerCase() === cls.subclass!.name.toLowerCase())?.subclassSource
		: undefined

	return {
		fightingStyles,
		optionalFeatureChoices: [...subclassOptionalFeatureChoices, ...classOptionalFeatureChoices],
		/** Tagged with the class the picks belong to (D11), same reasoning as optionalFeatureChoices — only name+source survive into storage, the picker's own `level` field (used for its in-wizard count checks) is dropped here. */
		spellChoices: cls.spellChoices.length > 0 && classTag ? [{ ...classTag, spells: cls.spellChoices.map(({ name, source }) => ({ name, source })) }] : [],
		/** Tagged with both the subclass's own identity and the class it belongs to (D11), same reasoning as spellChoices/optionalFeatureChoices. */
		subclassSpellChoices:
			cls.subclassSpellChoices.length > 0 && classTag && cls.subclass
				? [{ subclassName: cls.subclass.name, subclassSource: storedSubclassSource ?? cls.subclass.source, ...classTag, picks: cls.subclassSpellChoices }]
				: [],
		/** Already storage-shaped in WizardData (D22's level is recorded on each entry by the picker), so it passes straight through. */
		classFeatureChoices: cls.classFeatureChoices,
		/** Tagged with the class the forms belong to (D11), same reasoning as spellChoices. No level is recorded — see CharacterWildShapeForms. */
		wildShapeForms: cls.wildShapeForms.length > 0 && classTag ? [{ ...classTag, forms: cls.wildShapeForms.map(({ name, source }) => ({ name, source })) }] : [],
	}
}

/**
 * The name-based pickers' output turned back into stored choices, keeping the
 * level (D97/D98/D99) of every pick the character already had. A name that was
 * not there before was added during this run and records no level — the same
 * split ClassOptionalFeaturePicker.toggle already makes for its own field —
 * unless the run is a level up, where it records the level it was taken at.
 */
function keepRecordedLevels(names: readonly string[], previous: readonly LeveledChoice[] | undefined, newPickLevel?: number): LeveledChoice[] {
	// D334: in an Edit a new pick takes the stamp of the pick it replaced, paired in order (removed i-th with added i-th), so Remove level still finds it.
	const replaced = newPickLevel === undefined ? (previous ?? []).filter((choice) => !names.includes(choice.name)) : []
	let nextReplaced = 0
	return names.map((name) => {
		const recorded = (previous ?? []).find((choice) => choice.name === name)
		if (recorded) return { ...recorded }
		if (newPickLevel !== undefined) return { name, level: newPickLevel }
		const slot = replaced[nextReplaced++]
		return slot?.level === undefined ? { name } : { name, level: slot.level }
	})
}

/**
 * D335: keepRecordedLevels within each held class of a multiclass Edit. A new pick that inherits no stamp takes the
 * class's earliest grant slot no other pick of that class holds.
 */
function keepHeldClassLevels(names: readonly string[], previous: readonly LeveledChoice[] | undefined, held: HeldPickOwners): LeveledChoice[] {
	const kept = new Map<string, LeveledChoice>()
	for (const key of new Set(names.map((name) => held.owners[name]))) {
		const own = names.filter((name) => held.owners[name] === key)
		const before = (previous ?? []).filter((choice) => held.seeded[choice.name] === key)
		const choices = keepRecordedLevels(own, before)
		const free = [...(key === undefined ? [] : (held.slots[key] ?? []))].sort((a, b) => a - b)
		for (const choice of choices) {
			const index = choice.level === undefined ? -1 : free.indexOf(choice.level)
			if (index !== -1) free.splice(index, 1)
		}
		// D337: a kept pick without a stamp still holds a slot of its class; it is taken to hold the lowest ones.
		const keptUnstamped = choices.filter((choice) => choice.level === undefined && before.some((stored) => stored.name === choice.name)).length
		free.splice(0, keptUnstamped)
		for (const choice of choices) {
			const fresh = choice.level === undefined && !before.some((stored) => stored.name === choice.name)
			kept.set(choice.name, fresh && free.length > 0 ? { ...choice, level: free.shift()! } : choice)
		}
	}
	return names.map((name) => kept.get(name)!)
}
