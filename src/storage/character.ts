/*
 * Placeholder character shape (PHASE1.md build order step 2).
 *
 * id, name, classes and (as of the ability scores slice) abilityScores
 * exist at this point. The real model (species, background, HP, ...)
 * arrives with the rest of character creation. Do not add fields here for
 * later steps.
 */

import type { Ability, CharacterAbilityScores } from '../abilities/abilityScores'

export interface CharacterClass {
	className: string
	classSource: string
	subclass: string | null
	level: number
}

/** Identifies a species.json entry unambiguously — enough to look it back up later. */
export interface CharacterSpecies {
	name: string
	source: string
}

/** Identifies a backgrounds.json entry unambiguously — enough to look it back up later. */
export interface CharacterBackground {
	name: string
	source: string
	/**
	 * The background's two fixed skill proficiencies (BackgroundEntry.skillProficiencies),
	 * stored here rather than re-derived from backgrounds.json — the class step already
	 * needs them to disable the same two skills (D18), and the sheet/calculation layer
	 * will need them too.
	 */
	skillProficiencies: [string, string]
	/**
	 * The background's tool proficiency (BackgroundEntry.toolProficiency) —
	 * the named tool it grants outright, or the specific tool the player
	 * chose from its category. Always exactly one tool: every background's
	 * toolProficiencies entry offers exactly 1 (confirmed against all 33 in
	 * scripts/investigate-tool-proficiencies.js).
	 */
	toolProficiency: string
}

/**
 * Where a known language came from — mirrors section B's "source of each
 * proficiency" idea for skills (class / background / species / feat),
 * applied to languages so overlaps and automatic grants are visible
 * instead of a bare list of names.
 *
 * Only 'automatic' (the PHB 2024 Common rule) and 'creation' (the player's
 * two picks) exist yet. Class-feature grants (Rogue's Thieves' Cant plus
 * one, Druid's Druidic, Ranger's Deft Explorer) and feat grants are NOT
 * built — the wizard doesn't select class features at this slice. When
 * they arrive, add new members here (e.g. 'class-feature', 'feat') rather
 * than reworking this type.
 */
export type LanguageGrantSource = 'automatic' | 'creation'

/** Identifies a languages.json entry unambiguously, plus how the character came to know it. */
export interface CharacterLanguage {
	name: string
	source: string
	grantedBy: LanguageGrantSource
}

/**
 * The player's chosen distribution of a background's ability bonus
 * (PHASE1.md A.3): either +2 to one ability and +1 to another, or +1 to
 * each of the three the background offers. Stored as a plain mapping
 * rather than as a discriminated choice — this is the derived amount to
 * apply per ability, not which UI path produced it.
 */
export type AbilityBonusMap = Partial<Record<Ability, number>>

export interface Character {
	id: string
	name: string
	classes: CharacterClass[]
	/**
	 * Optional so characters saved before this field existed still load
	 * (PHASE1.md section D — additive fields must not break old saves).
	 */
	abilityScores?: CharacterAbilityScores
	/**
	 * Optional for the same reason as abilityScores above.
	 */
	species?: CharacterSpecies
	/**
	 * Optional for the same reason as abilityScores above.
	 */
	background?: CharacterBackground
	/**
	 * Optional for the same reason as abilityScores above. Present whenever
	 * `background` is, but kept as its own field rather than nested inside
	 * `background` since it's a player choice, not part of the background's
	 * identity.
	 */
	abilityBonus?: AbilityBonusMap
	/**
	 * Optional for the same reason as abilityScores above. Every language the
	 * character knows, INCLUDING Common — unlike the earlier shape, Common is
	 * stored explicitly (with `grantedBy: 'automatic'`) rather than assumed,
	 * since a stored language without a recorded source is exactly what this
	 * field's `grantedBy` fixes. Feature-granted languages (Thieves' Cant,
	 * Druidic, ...) are not represented yet — see LanguageGrantSource.
	 */
	languages?: CharacterLanguage[]
	/**
	 * Optional for the same reason as abilityScores above. The class step's
	 * own skill picks — distinct from background.skillProficiencies, the
	 * background's fixed pair.
	 */
	classSkills?: string[]
	/**
	 * Optional for the same reason as abilityScores above. The species' own
	 * skill proficiencies — both the fixed skill(s) some species grant
	 * outright and the ones the player chose from that species' list.
	 * Distinct from classSkills and background.skillProficiencies so the
	 * sheet can show "species" as the source (SPEC section B).
	 */
	speciesSkills?: string[]
	/**
	 * Optional for the same reason as abilityScores above. The skills named
	 * as Expertise (doubled proficiency bonus) — a subset of classSkills,
	 * speciesSkills or background.skillProficiencies, never a skill the
	 * character isn't otherwise proficient in.
	 */
	expertiseSkills?: string[]
	/**
	 * Optional for the same reason as abilityScores above.
	 */
	masteries?: string[]
	/**
	 * Optional for the same reason as abilityScores above.
	 */
	fightingStyle?: string | null
	/**
	 * Optional for the same reason as abilityScores above. A subclass's own
	 * optionalfeatureProgression picks (D21) — Battle Master maneuvers, Rune
	 * Knight runes, Arcane Archer shots, College of Swords fighting styles.
	 * An array, not a bare list of names, since a character could in
	 * principle have picks from more than one progression at once; each
	 * entry's featureType says which progression its choices belong to.
	 */
	optionalFeatureChoices?: CharacterOptionalFeatureChoice[]
	/**
	 * Optional for the same reason as abilityScores above. One entry per
	 * character level that grants an ASI-or-feat choice (D16/D19/D20) —
	 * effects are NOT applied to any calculation yet (deferred to the next
	 * slice); this is selection and storage only.
	 */
	featAsiChoices?: FeatAsiChoice[]
	/**
	 * Optional for the same reason as abilityScores above. The character's
	 * class spell picks (build order step 6 slice d2) — cantrips and leveled
	 * spells, prepared/known distinction is a LABEL only, not stored (there is
	 * one picker, not two). One entry per class in `character.classes` (D11),
	 * same reasoning as optionalFeatureChoices — a future multiclass caster's
	 * picks stay unambiguous. Subclass always-prepared spells (domains, oaths,
	 * circles) are OUT of scope (slice d2b); nothing here represents them.
	 */
	spellChoices?: CharacterSpellChoice[]
	/**
	 * Optional for the same reason as abilityScores above. The 5 subclasses
	 * whose additionalSpells is a player CHOICE, not a fixed grant (build
	 * order step 6, slice d6b — the LAST picker of step 6): Bard College of
	 * Lore and the 4 core Wizard subclasses. Distinct from
	 * subclassPreparedSpells.ts's DERIVED always-prepared spells (domains,
	 * oaths, circles, and the fixed portion of these same 5 subclasses'
	 * grants) — those are never stored; these are a player pick and must be.
	 * One entry per class carrying one of the 5 subclasses (D11), same
	 * reasoning as spellChoices.
	 */
	subclassSpellChoices?: CharacterSubclassSpellChoice[]
	/**
	 * Optional for the same reason as abilityScores above. The "pick one
	 * version of this feature" choices a class feature's own text offers
	 * (D21) — Cleric's Divine Order, Druid's Primal Order and Elemental Fury.
	 * Distinct from optionalFeatureChoices: those come from an
	 * optionalfeatureProgression and grow a list with level, these replace a
	 * feature with one of its named alternatives exactly once.
	 *
	 * What a chosen option GRANTS is not applied anywhere yet — Thaumaturge's
	 * extra cantrip and Protector/Warden's armour and weapon proficiencies
	 * both wait on later build order steps. This records and displays the
	 * choice only.
	 */
	classFeatureChoices?: CharacterClassFeatureChoice[]
}

/**
 * One class-feature choice (D21), tagged with the class it belongs to (D11,
 * same reasoning as spellChoices/optionalFeatureChoices) and with the level
 * the feature is granted at (D22). `optionName` is the chosen alternative's
 * resolved feature name, matching ClassFeatureChoiceOption.name.
 */
export interface CharacterClassFeatureChoice {
	className: string
	classSource: string
	featureName: string
	grantedAtLevel: number
	optionName: string
}

/** One class's spell picks. `spells` names each pick (name + source) only — level, ritual, concentration etc. are re-derived from spells.json when needed (sheet display, slice d4), not duplicated here. */
export interface CharacterSpellChoice {
	className: string
	classSource: string
	spells: { name: string; source: string }[]
}

/** One pick for a subclass spell-choice slot (subclassSpellChoiceData.ts SubclassSpellChoiceSlot) — identified by (grantedAtLevel, slotIndex) rather than array position, so it stays self-describing regardless of storage order. */
export interface CharacterSubclassSpellChoicePick {
	grantedAtLevel: number
	slotIndex: number
	name: string
	source: string
}

/**
 * One subclass's own filter-choice spell picks (build order step 6, slice
 * d6b — the LAST picker of step 6), present only for the 5 subclasses
 * subclassSpellChoiceData.ts's SUBCLASS_SPELL_CHOICE_KEYS names. Cleared
 * whenever class, level or subclass changes (same trigger points
 * wizardState.ts already uses for spellChoices/optionalFeatureChoices),
 * since the offered slots and their level caps are keyed to those.
 */
export interface CharacterSubclassSpellChoice {
	subclassName: string
	subclassSource: string
	className: string
	classSource: string
	picks: CharacterSubclassSpellChoicePick[]
}

/**
 * The spells a single CHOSEN optional feature let the player pick (build
 * order step 6a — Pact of the Tome, the only such option in the data:
 * 3 cantrips from any class's list plus 2 level-1 ritual spells). Keyed by
 * the option's own NAME rather than by position, so a pick stays
 * self-describing if the surrounding `choices` array is reordered. Same
 * `{cantrips, spells}` split as a feat's FilterChoiceSpellsChoice (slice
 * d5b-1), for the same reason: the two slots have independent counts and
 * filters.
 */
export interface OptionalFeatureSpellChoice {
	optionName: string
	cantrips: { name: string; source: string }[]
	spells: { name: string; source: string }[]
}

/** One subclass optionalfeatureProgression's picks, tagged with which progression (featureType code) they belong to. */
export interface CharacterOptionalFeatureChoice {
	featureType: string
	choices: string[]
	/** Present only for options that let the player pick spells (step 6a). One entry per such option chosen; absent entirely for every other progression. */
	spellChoices?: OptionalFeatureSpellChoice[]
}

/**
 * The +2-to-one-ability or +1-to-two-abilities distribution for an Ability
 * Score Improvement pick (D20). Never more than 2 keys, values always 1 or 2.
 */
export type AbilityIncreaseMap = Partial<Record<Ability, number>>

/**
 * Base Magic Initiate's own class-list + spell picks (build order step 6,
 * slice d5b-2) — present only when the feat entry's `name` is "Magic
 * Initiate" (guarded the same way featSpells.ts guards Mark feats). Cleared
 * whenever the feat itself is removed or changed, since it lives on the same
 * FeatAsiChoice entry.
 */
export interface MagicInitiateChoice {
	className: string
	classSource: string
	cantrips: { name: string; source: string }[]
	spell: { name: string; source: string } | null
}

/**
 * The generic filter-choice feat picker's own picks (build order step 6,
 * slice d5b-1 — the LAST feat-spell picker), present only when the feat
 * entry's `name`+`source` is one of featSpellChoiceData.ts's
 * FILTER_CHOICE_FEAT_KEYS (Artificer Initiate, Blessed Warrior, Druidic
 * Warrior, Wood Elf Magic, Aberrant Dragonmark, Fey-Touched, Shadow-Touched,
 * Ritual Caster). `cantrips` holds a `known`-slot pick (Artificer
 * Initiate/Wood Elf Magic/Aberrant Dragonmark: 1; Blessed Warrior/Druidic
 * Warrior: 2); `spells` holds an `innate`/`prepared`-slot pick (most feats:
 * 1; Ritual Caster: the character's proficiency bonus). A feat only ever has
 * one of the two slots filled in the data except Artificer Initiate/Wood Elf
 * Magic/Aberrant Dragonmark, which have both. Cleared whenever the feat
 * itself is removed or changed, since it lives on the same FeatAsiChoice
 * entry (same pattern as MagicInitiateChoice).
 */
export interface FilterChoiceSpellsChoice {
	cantrips: { name: string; source: string }[]
	spells: { name: string; source: string }[]
}

/**
 * One level-4/8/12/16/19(+class bonus levels)-and-up choice between an
 * Ability Score Improvement and a feat (build order step 4a, D16/D19/D20).
 * `level` is the character level the choice was taken at — this doubles as
 * the D22 provenance the sheet will need, so no separate field for it.
 */
export type FeatAsiChoice =
	| { level: number; kind: 'asi'; increases: AbilityIncreaseMap }
	| {
			level: number
			kind: 'feat'
			name: string
			source: string
			/**
			 * Which ability the feat's bonus applies to — required for the 68
			 * half-feats whose feats.json `ability` field is a choice among named
			 * abilities (featAbilityChoiceOptions), AND for base Magic Initiate's
			 * own int/wis/cha spellcasting-ability choice (which lives in
			 * `additionalSpells`, not the half-feat `ability` field, but reuses
			 * this same slot per the task instructions rather than a second one).
			 * Absent for the 13 fixed-bonus feats and every feat with no ability
			 * choice at all. Selection only: no calculation reads this field yet.
			 */
			chosenAbility?: Ability
			/** Base Magic Initiate only (slice d5b-2) — see MagicInitiateChoice. */
			magicInitiate?: MagicInitiateChoice
			/** The 8 generic filter-choice feats only (slice d5b-1) — see FilterChoiceSpellsChoice. */
			filterChoiceSpells?: FilterChoiceSpellsChoice
	  }

/**
 * Schema version for the persisted/exported character wire format
 * (see wireFormat.ts). Bumped to 15 to add Character.classFeatureChoices —
 * the class-feature choice picker (D21: Divine Order, Primal Order,
 * Elemental Fury). Per PHASE1.md section D, and per docs/QUESTIONS.md
 * "Migrace uložených postav", a version bump this app does not understand is
 * rejected outright (UnknownSchemaVersionError) rather than guessed at — no
 * migration from version 14 is written, so a character saved before this
 * change will no longer load and must be recreated.
 */
export const CURRENT_SCHEMA_VERSION = 15
