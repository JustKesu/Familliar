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
	CharacterExpertiseSkill,
	CharacterMastery,
	CharacterOptionalFeatureChoice,
	CharacterSpellChoice,
	CharacterSubclassSpellChoice,
	CharacterSubclassSpellChoicePick,
	FeatAsiChoice,
	LeveledChoice,
} from '../storage/character'
import { choiceNames } from '../storage/character'
import type { AbilityBonusDistribution } from '../backgrounds/abilityBonus'
import type { CharacterStore } from '../storage/characterStore'
import type { ClassLevelChoice } from '../classes/ClassPicker'
import type { SpeciesChoice } from '../species/SpeciesPicker'
import type { BackgroundChoice } from '../backgrounds/BackgroundPicker'
import type { LanguageChoice } from '../languages/LanguagePicker'
import { AUTOMATIC_LANGUAGE, CHOSEN_LANGUAGE_COUNT } from '../languages/languageData'
import type { Ability, CharacterAbilityScores } from '../abilities/abilityScores'
import type { SpellPick } from '../spells/SpellPicker'
import type { SpellCountLabel } from '../calculation/spellCounts'
import { isMagicInitiateFeat } from '../featAsi/featAsiData'
import { emptyStartingEquipmentChoice, type StartingEquipmentChoice } from '../inventory/startingEquipmentData'
import { filterChoiceRequiredCounts, isFilterChoiceFeat } from '../spells/featSpellChoiceData'

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
	/** Levels granting an ASI-or-feat choice; 0 skips the 'featAsi' step. */
	featAsiEligibleLevelCount?: number
	/** `${name}|${source}` keys of feats that additionally need `chosenAbility` (half-feats). */
	featsRequiringAbilityChoice?: ReadonlySet<string>
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
	/** D89 follow-up: whether the species' own spellcasting-ability choice (`additionalSpells.ability: {choose:[...]}`) is settled. True for a species with a fixed ability or none at all — the count/list comes from species.json, not from WizardData. */
	speciesSpellcastingAbilityComplete?: boolean
	/** Wild Shape forms the class step must collect (wildShapeData.ts's Beast Shapes table); 0 for a character without Wild Shape. */
	wildShapeFormCount?: number
	/** Whether every category element inside the two chosen starting-equipment options has an item picked. Which elements those are is only known from the loaded offers, so the caller computes it (missingCategoryPicks). */
	startingEquipmentCategoryPicksComplete?: boolean
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
}

/** The omitted-field values, in one place, so every entry point agrees on them. */
function resolveConditions(conditions: WizardStepConditions): Required<WizardStepConditions> {
	return {
		expertiseRequiredCount: conditions.expertiseRequiredCount ?? null,
		featAsiEligibleLevelCount: conditions.featAsiEligibleLevelCount ?? 0,
		featsRequiringAbilityChoice: conditions.featsRequiringAbilityChoice ?? EMPTY_FEAT_SET,
		spellRequirement: conditions.spellRequirement ?? null,
		subclassSpellChoiceSlotCount: conditions.subclassSpellChoiceSlotCount ?? 0,
		classOptionalFeaturesComplete: conditions.classOptionalFeaturesComplete ?? true,
		classOptionalFeatureGroupCount: conditions.classOptionalFeatureGroupCount ?? 0,
		classFeatureChoicesComplete: conditions.classFeatureChoicesComplete ?? true,
		speciesVariantChoiceComplete: conditions.speciesVariantChoiceComplete ?? true,
		speciesSkillsComplete: conditions.speciesSkillsComplete ?? true,
		speciesSpellcastingAbilityComplete: conditions.speciesSpellcastingAbilityComplete ?? true,
		wildShapeFormCount: conditions.wildShapeFormCount ?? 0,
		startingEquipmentCategoryPicksComplete: conditions.startingEquipmentCategoryPicksComplete ?? true,
		characterLevel: conditions.characterLevel ?? 1,
		editingExistingCharacter: conditions.editingExistingCharacter ?? false,
		levelUpSteps: conditions.levelUpSteps ?? null,
		levelUpTargetLevel: conditions.levelUpTargetLevel ?? null,
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

/** The picker steps only — every one of these must be complete before the review step may save. */
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
	abilityScores: CharacterAbilityScores | null
	/** Class skill proficiencies, weapon masteries, fighting style and subclass are the class's own choices (D13), so they clear whenever classChoice does. */
	classSkills: string[]
	/** The species' skill proficiencies (fixed and/or chosen) — clears whenever speciesChoice does, since the options are keyed to a specific species. */
	speciesSkills: string[]
	/**
	 * D89 follow-up: which ability the species' own granted spells are cast
	 * with, when `additionalSpells.ability` is the `{choose:[...]}` shape —
	 * clears whenever speciesChoice does, same reasoning as speciesSkills: a
	 * different species (or a different lineage of the same family) may offer
	 * a different choice, or none at all.
	 */
	speciesSpellcastingAbility: Ability | null
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
		speciesSpellcastingAbility: null,
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
	const characterClass = character.classes[0]
	const storedSubclassName = characterClass?.subclass ?? null
	// A subclass missing from the loaded list keeps its name but carries no featureType,
	// which sends its optional-feature picks through classOptionalFeatureChoices below —
	// where they pass through save unchanged rather than being dropped.
	const subclassOption = storedSubclassName
		? (lookups.subclasses.find((option) => option.name.toLowerCase() === storedSubclassName.toLowerCase()) ?? null)
		: null
	const subclass: SubclassChoice | null = storedSubclassName
		? { name: storedSubclassName, source: subclassOption?.source ?? '', featureType: subclassOption?.featureType ?? null }
		: null

	const subclassFeatureType = subclass?.featureType ?? null
	const storedOptionalFeatures = character.optionalFeatureChoices ?? []

	const spellLevelOf = (spell: { name: string; source: string }): number =>
		lookups.spellLevels.find(
			(detail) => detail.name.toLowerCase() === spell.name.toLowerCase() && detail.source.toUpperCase() === spell.source.toUpperCase(),
		)?.level ?? -1

	return {
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
		abilityScores: character.abilityScores ?? null,
		classSkills: character.classSkills ?? [],
		speciesSkills: character.speciesSkills ?? [],
		speciesSpellcastingAbility: character.speciesSpellcastingAbility ?? null,
		expertiseSkills: choiceNames(character.expertiseSkills),
		masteries: choiceNames(character.masteries),
		fightingStyle: character.fightingStyle ?? null,
		subclass,
		optionalFeatureChoices: subclassFeatureType
			? choiceNames(storedOptionalFeatures.find((entry) => entry.featureType === subclassFeatureType)?.choices)
			: [],
		classOptionalFeatureChoices: storedOptionalFeatures.filter((entry) => entry.featureType !== subclassFeatureType),
		featAsiChoices: character.featAsiChoices ?? [],
		spellChoices: (character.spellChoices ?? []).flatMap((entry) =>
			entry.spells.map((spell) => ({ name: spell.name, source: spell.source, level: spellLevelOf(spell) })),
		),
		subclassSpellChoices: (character.subclassSpellChoices ?? []).flatMap((entry) => entry.picks),
		classFeatureChoices: character.classFeatureChoices ?? [],
		wildShapeForms: (character.wildShapeForms ?? []).flatMap((entry) => entry.forms),
		hitPointLevels: character.hitPointLevels ?? [],
		startingEquipment: emptyStartingEquipmentChoice(),
	}
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
		featAsiEligibleLevelCount,
		featsRequiringAbilityChoice,
		spellRequirement,
		subclassSpellChoiceSlotCount,
		classOptionalFeaturesComplete,
		classFeatureChoicesComplete,
		speciesVariantChoiceComplete,
		speciesSkillsComplete,
		speciesSpellcastingAbilityComplete,
		wildShapeFormCount,
		startingEquipmentCategoryPicksComplete,
		levelUpTargetLevel,
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
				data.wildShapeForms.length === wildShapeFormCount
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
				speciesSpellcastingAbilityComplete
			)
		case 'background':
			// A background is REMEMBERED the moment it is picked (D8), but the step only
			// COMPLETES once its ability-bonus distribution is finished: the picker fills
			// backgroundChoice.abilityBonus only for a complete, legal +2/+1 or +1/+1/+1,
			// so a non-empty map is exactly "the distribution is done".
			return (
				data.backgroundChoice !== null &&
				Object.keys(data.backgroundChoice.abilityBonus).length > 0 &&
				data.backgroundToolProficiency !== null
			)
		case 'expertise':
			return expertiseRequiredCount === null || data.expertiseSkills.length === expertiseRequiredCount
		case 'languages':
			return data.languageChoice.length === CHOSEN_LANGUAGE_COUNT
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
				data.featAsiChoices.length === featAsiEligibleLevelCount &&
				data.featAsiChoices.every((choice) =>
					isCompleteFeatAsiChoice(choice, featsRequiringAbilityChoice, data.classChoice?.level ?? 0),
				)
			)
		case 'hitPoints':
			// Every level from 2 up to the character's own needs a recorded choice (D92/D57: "not
			// chosen" and "chose the average" must not look the same in storage). Level 1 is never
			// asked for — it is always the die maximum, not a choice.
			// A level-up walk (D103) narrows that to the single level being gained — the levels
			// below it are left on whatever they already had, not demanded here.
			return levelUpTargetLevel !== null
				? data.hitPointLevels.some((entry) => entry.level === levelUpTargetLevel)
				: isCompleteHitPointLevels(data.hitPointLevels, data.classChoice?.level ?? 1)
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
function isCompleteHitPointLevels(hitPointLevels: CharacterHitPointLevel[], characterLevel: number): boolean {
	for (let level = 2; level <= characterLevel; level++) {
		if (!hitPointLevels.some((entry) => entry.level === level)) return false
	}
	return true
}

/** Cantrips and leveled spells are counted separately (a cantrip is not a leveled-spell pick) — both totals must match exactly. */
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
function isCompleteFeatAsiChoice(choice: FeatAsiChoice, featsRequiringAbilityChoice: ReadonlySet<string>, totalCharacterLevel: number): boolean {
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

/** Whether every picker step is complete — the gate for the review step's save button. */
export function isReadyToSave(data: WizardData, conditions: WizardStepConditions = {}): boolean {
	return pickerSteps(conditions).every((step) => isStepComplete(step, data, conditions))
}

export type WizardAction =
	/** Replaces the whole in-progress character and returns to the first step — how the wizard opens over an existing one (slice 8d1), since the seed needs data loaded asynchronously and cannot be built at reducer-init time. */
	| { type: 'seed'; data: WizardData; conditions?: WizardStepConditions }
	| { type: 'next'; conditions?: WizardStepConditions }
	| { type: 'back'; conditions?: WizardStepConditions }
	| { type: 'setName'; name: string }
	| { type: 'setClassChoice'; choice: ClassLevelChoice | null }
	| { type: 'setSpeciesChoice'; choice: SpeciesChoice | null }
	| { type: 'setSpeciesSkills'; skills: string[] }
	| { type: 'setSpeciesSpellcastingAbility'; ability: Ability | null }
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
	| { type: 'setClassOptionalFeatureChoices'; choices: CharacterOptionalFeatureChoice[] }
	| { type: 'setFeatAsiChoices'; choices: FeatAsiChoice[] }
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
		case 'setName':
			return { ...state, data: { ...state.data, name: action.name } }
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
		case 'setSpeciesChoice':
			return {
				...state,
				data: { ...state.data, speciesChoice: action.choice, speciesSkills: [], speciesSpellcastingAbility: null, expertiseSkills: [] },
			}
		case 'setSpeciesSkills':
			return { ...state, data: { ...state.data, speciesSkills: action.skills, expertiseSkills: [] } }
		case 'setSpeciesSpellcastingAbility':
			return { ...state, data: { ...state.data, speciesSpellcastingAbility: action.ability } }
		case 'setExpertiseSkills':
			return { ...state, data: { ...state.data, expertiseSkills: action.skills } }
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
		case 'setAbilityScores':
			return { ...state, data: { ...state.data, abilityScores: action.scores } }
		case 'setClassSkills':
			return { ...state, data: { ...state.data, classSkills: action.skills, expertiseSkills: [] } }
		case 'setMasteries':
			return { ...state, data: { ...state.data, masteries: action.weapons } }
		case 'setFightingStyle':
			return { ...state, data: { ...state.data, fightingStyle: action.style } }
		case 'setSubclass':
			return {
				...state,
				// wildShapeForms clears here too: Circle of the Moon's Circle Forms raises the CR cap, so the legal pool is subclass-dependent.
				data: { ...state.data, subclass: action.subclass, optionalFeatureChoices: [], spellChoices: [], subclassSpellChoices: [], wildShapeForms: [] },
			}
		case 'setOptionalFeatureChoices':
			return { ...state, data: { ...state.data, optionalFeatureChoices: action.choices } }
		case 'setClassOptionalFeatureChoices':
			return { ...state, data: { ...state.data, classOptionalFeatureChoices: action.choices } }
		case 'setFeatAsiChoices':
			return { ...state, data: { ...state.data, featAsiChoices: action.choices } }
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
 * refused if it went down (D100 — removing a level is slice 8e's job), every
 * pick that was already on the character keeps the level it was taken at, and
 * the play-time fields the wizard never collects are carried through.
 *
 * `levelUpTo` (slice 8d3) marks the write that ends a level-up walk: it must
 * raise `existing` by exactly one level in the class it already has, and every
 * pick that was not on `existing` records that new level (D97/D98/D99).
 */
export function saveCharacter(
	store: CharacterStore,
	data: WizardData,
	backgroundSkillProficiencies?: [string, string],
	conditions: WizardStepConditions = {},
	startingEquipment?: { inventory: CharacterInventoryItem[]; currencyCopper: number },
	existing?: Character,
	levelUpTo?: number,
): Character {
	if (!isReadyToSave(data, conditions)) {
		throw new Error('Cannot save a character before every step is complete.')
	}

	const existingLevel = existing ? existing.classes.reduce((total, entry) => total + entry.level, 0) : 0
	if (existing && (data.classChoice?.level ?? 0) < existingLevel) {
		throw new Error(`A character's level cannot be lowered: this character is level ${existingLevel}.`)
	}
	if (levelUpTo !== undefined) {
		const existingClass = existing?.classes.length === 1 ? existing.classes[0] : undefined
		const sameClass =
			existingClass !== undefined &&
			data.classChoice !== null &&
			existingClass.className === data.classChoice.className &&
			existingClass.classSource === data.classChoice.classSource
		if (!sameClass || existingLevel !== levelUpTo - 1 || data.classChoice?.level !== levelUpTo) {
			throw new Error(`A level up raises one existing class by exactly one level, to level ${levelUpTo}.`)
		}
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

	/**
	 * Tagged with the subclass's own featureType (D21) so more than one
	 * progression's picks could coexist later without ambiguity — see
	 * CharacterOptionalFeatureChoice. The class's OWN progression picks (slice
	 * 2) are already in that shape and join the same array: no schema change,
	 * and nothing distinguishes the two beyond the featureType code, which is
	 * enough to tell them apart later (chosenClassOptionalFeatures).
	 */
	const subclassOptionalFeatureChoices: CharacterOptionalFeatureChoice[] =
		data.optionalFeatureChoices.length > 0 && data.subclass?.featureType
			? // D99, as D97: a creation pick records no level — the wizard makes every pick in one step.
				[
					{
						featureType: data.subclass.featureType,
						choices: keepRecordedLevels(
							data.optionalFeatureChoices,
							existing?.optionalFeatureChoices?.find((entry) => entry.featureType === data.subclass!.featureType)?.choices,
							levelUpTo,
						),
					},
				]
			: []
	// The class picker already keeps each existing pick's own level; only a pick new to this walk is stamped.
	const classOptionalFeatureChoices = data.classOptionalFeatureChoices
		.filter((entry) => entry.choices.length > 0)
		.map((entry) => {
			if (levelUpTo === undefined) return entry
			const held = new Set(choiceNames(existing?.optionalFeatureChoices?.find((stored) => stored.featureType === entry.featureType)?.choices))
			return {
				...entry,
				choices: entry.choices.map((choice) => (choice.level !== undefined || held.has(choice.name) ? choice : { ...choice, level: levelUpTo })),
			}
		})
	const optionalFeatureChoices: CharacterOptionalFeatureChoice[] | undefined =
		subclassOptionalFeatureChoices.length + classOptionalFeatureChoices.length > 0
			? [...subclassOptionalFeatureChoices, ...classOptionalFeatureChoices]
			: undefined

	/** Tagged with the class the picks belong to (D11), same reasoning as optionalFeatureChoices — only name+source survive into storage, the picker's own `level` field (used for its in-wizard count checks) is dropped here. */
	const spellChoices: CharacterSpellChoice[] | undefined =
		data.spellChoices.length > 0 && data.classChoice
			? [
					{
						className: data.classChoice.className,
						classSource: data.classChoice.classSource,
						spells: data.spellChoices.map(({ name, source }) => ({ name, source })),
					},
				]
			: undefined

	/** Tagged with both the subclass's own identity and the class it belongs to (D11), same reasoning as spellChoices/optionalFeatureChoices. */
	const subclassSpellChoices: CharacterSubclassSpellChoice[] | undefined =
		data.subclassSpellChoices.length > 0 && data.classChoice && data.subclass
			? [
					{
						subclassName: data.subclass.name,
						subclassSource: data.subclass.source,
						className: data.classChoice.className,
						classSource: data.classChoice.classSource,
						picks: data.subclassSpellChoices,
					},
				]
			: undefined

	/** Already storage-shaped in WizardData (D22's level is recorded on each entry by the picker), so it passes straight through. */
	const classFeatureChoices: CharacterClassFeatureChoice[] | undefined =
		data.classFeatureChoices.length > 0 ? data.classFeatureChoices : undefined

	/**
	 * No level is recorded (D97): the wizard picks every mastery in one step,
	 * so a character created directly at level 5 could not say which pick
	 * belonged to which level. WizardData keeps bare names because the picker
	 * is a name-based control; the shape is put on here, at the storage edge.
	 */
	const masteries: CharacterMastery[] = keepRecordedLevels(data.masteries, existing?.masteries, levelUpTo)

	/** No level is recorded, for exactly the reason masteries records none (D98 following D97). */
	const expertiseSkills: CharacterExpertiseSkill[] = keepRecordedLevels(data.expertiseSkills, existing?.expertiseSkills, levelUpTo)

	/** Passes straight through to storage (build order step 8, slice 8b) — already exactly Character.hitPointLevels' own shape, one entry per level from 2 up. */
	const hitPointLevels: CharacterHitPointLevel[] | undefined = data.hitPointLevels.length > 0 ? data.hitPointLevels : undefined

	/** Tagged with the class the forms belong to (D11), same reasoning as spellChoices. No level is recorded — see CharacterWildShapeForms. */
	const wildShapeForms: CharacterWildShapeForms[] | undefined =
		data.wildShapeForms.length > 0 && data.classChoice
			? [
					{
						className: data.classChoice.className,
						classSource: data.classChoice.classSource,
						forms: data.wildShapeForms.map(({ name, source }) => ({ name, source })),
					},
				]
			: undefined

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
		fightingStyle: data.fightingStyle,
		optionalFeatureChoices,
		speciesSkills: data.speciesSkills,
		expertiseSkills,
		featAsiChoices: data.featAsiChoices,
		spellChoices,
		subclassSpellChoices,
		classFeatureChoices,
		wildShapeForms,
		// Editing keeps what the character carries: the equipment step is not part of an edit.
		inventory: existing ? existing.inventory : startingEquipment?.inventory,
		currencyCopper: existing ? existing.currencyCopper : startingEquipment?.currencyCopper,
		speciesSpellcastingAbility: data.speciesSpellcastingAbility ?? undefined,
		hitPointLevels,
		// Play state the wizard has no control over, carried across an update that replaces every field.
		currentHp: existing?.currentHp,
		maxHpOverride: existing?.maxHpOverride,
		familiar: existing?.familiar,
		// Slice 8e: set by the creation run only. An edit or a level up keeps what the character had, including "not known".
		createdAtLevel: existing ? existing.createdAtLevel : data.classChoice?.level,
	}

	return existing ? store.update(existing.id, input) : store.create(input)
}

/**
 * The name-based pickers' output turned back into stored choices, keeping the
 * level (D97/D98/D99) of every pick the character already had. A name that was
 * not there before was added during this run and records no level — the same
 * split ClassOptionalFeaturePicker.toggle already makes for its own field —
 * unless the run is a level up, where it records the level it was taken at.
 */
function keepRecordedLevels(names: readonly string[], previous: readonly LeveledChoice[] | undefined, newPickLevel?: number): LeveledChoice[] {
	return names.map((name) => {
		const recorded = (previous ?? []).find((choice) => choice.name === name)
		if (recorded) return { ...recorded }
		return newPickLevel === undefined ? { name } : { name, level: newPickLevel }
	})
}
