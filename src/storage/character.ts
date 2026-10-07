/*
 * Placeholder character shape (PHASE1.md build order step 2).
 *
 * id, name, classes and (as of the ability scores slice) abilityScores
 * exist at this point. The real model (species, background, HP, ...)
 * arrives with the rest of character creation. Do not add fields here for
 * later steps.
 */

import type { Ability, CharacterAbilityScores } from '../abilities/abilityScores'
import type { Skill } from '../calculation/skills'

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
	/** D205: the Dark Gift feat the player took instead of the background's origin feat; featInstances reads it in place of the derived feat. */
	originFeatOverride?: { name: string; source: string }
}

/**
 * Where a known language came from — mirrors section B's "source of each
 * proficiency" idea for skills (class / background / species / feat),
 * applied to languages so overlaps and automatic grants are visible
 * instead of a bare list of names.
 *
 * 'automatic' is the PHB 2024 Common rule and 'creation' the player's two
 * picks. The rest are a class feature's free picks (D172): Rogue's Thieves'
 * Cant (one) and Ranger's Deft Explorer (two); D176 adds Mastermind's two. Fixed feature languages
 * (Thieves' Cant itself, Druidic) are derived, never stored; a feat's pick
 * lives on the feat instance (D158).
 */
export type LanguageGrantSource = 'automatic' | 'creation' | FeatureLanguageSource

/** D177 adds Cavalier's and Samurai's skill-or-language pick when it is a language; D203 Banneret's language. */
export type FeatureLanguageSource = 'thievesCant' | 'deftExplorer' | 'mastermind' | 'cavalier' | 'samurai' | 'banneret'

/** D174: which class or subclass grant a stored tool pick fills; D176 adds the non-XPHB subclass picks, D177 the species picks, D203 Knowledge Domain. */
export type ToolChoiceSource = 'bard' | 'monk' | 'artificer' | 'battleMaster' | 'mastermind' | 'kensei' | 'artificerSubclass' | 'warforged' | 'satyr' | 'khoravar' | 'knowledgeDomain'

/** D177: which subclass grant a stored skill pick fills; D203 adds the RHW/FRHoF subclasses. */
export type SubclassSkillSource =
	| 'battleMaster'
	| 'orderDomain'
	| 'peaceDomain'
	| 'arcaneArcher'
	| 'cavalier'
	| 'samurai'
	| 'bladesinger'
	| 'knowledgeDomain'
	| 'banneret'
	| 'nobleGenies'
	| 'collegeOfTheMoon'

export interface CharacterSubclassSkill {
	grantedBy: SubclassSkillSource
	/** The skill key skills.ts matches on (lowercase). */
	name: string
}

export interface CharacterToolChoice {
	grantedBy: ToolChoiceSource
	/** The item's name in items.json — the same string a background's tool pick stores. */
	name: string
}

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
	 * field's `grantedBy` fixes. Class-feature picks join the same list — see
	 * LanguageGrantSource.
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
	 * character isn't otherwise proficient in. Objects rather than bare skill
	 * names since schema version 32 — see LeveledChoice (D98, following D97).
	 */
	expertiseSkills?: CharacterExpertiseSkill[]
	/**
	 * Optional for the same reason as abilityScores above. Objects rather than
	 * bare weapon names since schema version 31 — see CharacterMastery (D97).
	 */
	masteries?: CharacterMastery[]
	/** D318: at most one entry per class; a style migrated from a pre-58 multiclass save carries no class. */
	fightingStyles?: CharacterFightingStyle[]
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
	 * Sub-choices of the feats the background and species grant, and the feats
	 * added manually (D215). At most one background/species entry; 'manual' may
	 * repeat. Read only through featInstances (featInstances.ts).
	 */
	grantedFeats?: CharacterGrantedFeat[]
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
	/**
	 * Optional for the same reason as abilityScores above. The Beast forms a
	 * Druid knows for Wild Shape (build order step 6b slice 3). One entry per
	 * class (D11), same reasoning as spellChoices.
	 *
	 * Deliberately carries NO level, unlike every other stored choice under
	 * D22: these are not a permanent record of a level-time decision. The
	 * feature's own text — "Whenever you finish a Long Rest, you can replace
	 * one of your known forms with another eligible form" — makes the set
	 * swappable at any point, so a recorded level would claim a provenance the
	 * rules do not give it.
	 *
	 * Uses per rest, transforming, and the temporary hit points / stat
	 * replacement that happen while transformed are play tracking (build order
	 * step 9) and are not represented here.
	 */
	wildShapeForms?: CharacterWildShapeForms[]
	/**
	 * Optional for the same reason as abilityScores above. The form the
	 * character's familiar currently has — absent means no familiar is
	 * summoned, which is the state a sheet starts in.
	 *
	 * Not a creation choice and not in the wizard: the form is chosen when
	 * Find Familiar is cast and can be a different one next time, so it is
	 * edited from the sheet. Carries no level for the same reason
	 * CharacterWildShapeForms does not.
	 */
	familiar?: CharacterFamiliar
	/**
	 * Optional for the same reason as abilityScores above. What the character
	 * carries and how many of each (build order step 7, slice a1). Each item
	 * is referenced by name + source only — the same convention as
	 * CharacterSpellChoice / CharacterWildShapeForms — never by copying the
	 * item's fields into storage. An absent or empty array is a normal state
	 * (the character owns nothing), not a failure. Starting equipment is the
	 * next slice; nothing here is populated by the wizard.
	 */
	inventory?: CharacterInventoryItem[]
	/**
	 * Optional for the same reason as abilityScores above. The character's
	 * money, held as a single total in COPPER pieces — the unit items.json's
	 * own `value` field already uses, so a later "spend money on an item"
	 * slice needs no conversion. The sheet shows and edits it as gold /
	 * silver / copper (1 gp = 100 cp, 1 sp = 10 cp); platinum and electrum
	 * are not represented in phase 1. Absent means zero.
	 */
	currencyCopper?: number
	/**
	 * Current hit points (persistent-header rebuild, slice 1). D9: this one IS
	 * the value the player edits by hand — nothing derives it. Absent means "not
	 * set yet" (the header shows "—"), which is distinct from 0. Never negative
	 * (slice 9a1, D110): every writer clamps at 0.
	 *
	 * Still not clamped against the MAXIMUM — the maximum is not stored (see
	 * hitPointLevels) and a character may legitimately sit above a maximum that
	 * has just been lowered. Healing is what clamps upwards (D110).
	 */
	currentHp?: number
	/**
	 * Everything that changes BETWEEN levels rather than at one (slice 9b1).
	 * Temporary hit points and death saves lived at the top level in 9a1/9a2 and
	 * moved here when resource uses joined them: all three are spent and refilled
	 * in play, none is a record of a decision, and grouping them keeps a rest —
	 * which resets several at once — a write to one field.
	 *
	 * Absent means nothing is in play, which is the state every character starts
	 * and ends a rest in.
	 */
	play?: CharacterPlayState
	/**
	 * One contribution per character level, WITHOUT Constitution (build order
	 * step 8, slice 8a). The maximum is never stored as a single finished number:
	 * a later Constitution increase raises hit points retroactively for every
	 * level already gained, and a stored total would quietly stay low.
	 * computeMaxHitPoints sums these, adds the Constitution modifier times the
	 * total level, and adds the per-level bonuses.
	 *
	 * Absent or empty is the state every character is in today — the picker that
	 * fills it is slice 8b. computeMaxHitPoints then falls back to level 1 =
	 * the die maximum and the fixed average thereafter, and says in the
	 * breakdown that those are defaults rather than recorded choices.
	 */
	hitPointLevels?: CharacterHitPointLevel[]
	/**
	 * A hand-typed maximum that REPLACES the computed one outright (slice 8a) —
	 * the escape hatch for a DM-granted maximum or a rule the app cannot
	 * compute. Absent means the computed value stands. A version-29 character's
	 * manually typed `maxHp` migrates into this field, so a character that
	 * already had a number keeps showing it.
	 */
	maxHpOverride?: number
	/**
	 * Which ability the character's species-granted spells (raceSpells.ts)
	 * are cast with — set only when the STORED species record's
	 * `additionalSpells.ability` is the `{choose:[...]}` shape (33 of the 34
	 * carriers; only Aasimar is fixed). Same D57 convention as
	 * FeatAsiChoice.chosenAbility: absent means either the species has
	 * nothing to choose (no additionalSpells, or a fixed ability), or an
	 * older save/wizard run hasn't recorded a pick yet — computeSpeciesSpellcasting
	 * keeps today's "not chosen yet" placeholder in both cases, never a guess.
	 */
	speciesSpellcastingAbility?: Ability
	/** S2: the cantrip a species' `choose` filter grant was filled with (High Elf, Khoravar, Kobold; Draconic Sorcery). Absent = the species has none, or it is not chosen yet. */
	speciesCantrip?: { name: string; source: string }
	/** D175: the size a species that offers more than one ('S'/'M') was played as. Absent means not chosen yet (D54). */
	speciesSize?: string
	/** D174: the class/subclass tool picks (Bard, Monk, Artificer, Battle Master). Absent means none chosen. */
	toolChoices?: CharacterToolChoice[]
	/** D177: subclass skill picks (Battle Master, Order, Peace, Arcane Archer, Cavalier, Samurai). Fixed subclass skills are derived, never stored. */
	subclassSkills?: CharacterSubclassSkill[]
	/** D330: the skill/tool pick of multiclassing.proficienciesGained, one per pick, tagged with the class entered. Absent = none. */
	multiclassPicks?: CharacterMulticlassPick[]
	/**
	 * The character level the creation wizard made this character at (slice 8e).
	 * Set once, never changed afterwards. It is the floor for removing a level:
	 * creation picks carry no level (D97), so nothing at or below it can be told
	 * apart by level. Absent means "not known" — every character saved before
	 * schema version 34 — and removal is then refused rather than guessed.
	 */
	createdAtLevel?: number
	/** D317: entry i is the class that took character level i+1. Absent = order not known (e.g. a migrated multiclass character). */
	levelOrder?: CharacterLevelOrderEntry[]
	/**
	 * The three free-text fields of the "Vzhled a poznámky" tab (slice 9d2), each
	 * exactly what the player typed — line breaks and spacing included, nothing
	 * parsed or trimmed. They describe the character rather than a play session,
	 * so they live here and not under `play`: a rest never touches them. Absent
	 * and the empty string both mean nothing written, and the store writes none
	 * as absence, the convention every optional field above uses.
	 */
	appearance?: string
	backstory?: string
	notes?: string
	/** W-8: the cropped 256×256 portrait as a JPEG data URL (`isValidPortrait`); never the uploaded original. Absent = the sheet shows the name's letter. */
	portrait?: string
}

/** W-8 storage rule: what a stored portrait must look like (prefix and size cap). */
export const PORTRAIT_PREFIX = 'data:image/jpeg;base64,'
export const PORTRAIT_MAX_LENGTH = 200_000

export function isValidPortrait(value: unknown): value is string {
	return typeof value === 'string' && value.startsWith(PORTRAIT_PREFIX) && value.length <= PORTRAIT_MAX_LENGTH
}

/** What the character has spent and gained since the last rest (slice 9b1) — see Character.play. */
export interface CharacterPlayState {
	/**
	 * Temporary hit points (slice 9a1, D110). A SECOND pile, never folded into
	 * currentHp: damage spends it first, healing never restores it, and a new
	 * grant replaces it only when it is higher. Absent means none; 0 is stored as
	 * absence, since "no temporary hit points" has one meaning here, unlike
	 * currentHp's 0.
	 */
	temporaryHitPoints?: number
	/**
	 * Death saving throw progress (slice 9a2, D111). Present ONLY while
	 * `currentHp` is exactly 0 — the store drops it on any write that leaves the
	 * current above 0, so there is no leftover progress to come back to. Absent
	 * means no death save is in progress, and all-zero counts are stored as that
	 * absence, the same way temporary 0 is (D110).
	 */
	deathSaves?: CharacterDeathSaves
	/**
	 * How many uses of each limited resource have been SPENT (slice 9b1), keyed
	 * by the resolved resource name computeCharacterResources returns — so the
	 * data's two names for the Monk pool ("Ki" on the TCE subclasses, "Focus
	 * Point" on the 2024 Monk) share the single entry "Focus Point".
	 *
	 * Spent, not remaining: the maximum is computed and changes with level, and a
	 * remaining count would silently mean something different after every level
	 * up. An absent key is nothing spent, the same convention the two fields above
	 * use; the whole record is absent until something is spent.
	 *
	 * Never above the resource's current maximum — resourceUsesWithinMaxima
	 * (src/calculation/resources.ts) enforces that wherever the level changes.
	 */
	resourceUses?: Record<string, number>
	/**
	 * How many spell slots have been SPENT (slice 9b3), for the same reason
	 * resourceUses counts spent rather than remaining: the maximum is computed and
	 * changes with level. Absent means nothing is spent, and an emptied record is
	 * stored as that absence, the convention every field above uses.
	 *
	 * Never above the current maximum — spentSpellSlotsWithinMaxima
	 * (src/calculation/spellSlots.ts) enforces that wherever the level changes.
	 */
	spentSpellSlots?: SpentSpellSlots
	/**
	 * How many hit dice have been SPENT (slice 9b4), keyed `className|classSource`
	 * — the composite key the rest of the app already identifies a class by, and
	 * the only one that survives D11's classes array once multiclass lands. Counts
	 * spent rather than remaining, for the reason the two fields above do.
	 *
	 * A class's maximum is its level, so no data file is needed to clamp it —
	 * spentHitDiceWithinMaxima (src/calculation/hitDice.ts) enforces that wherever
	 * the level changes. Absent means nothing is spent; a zero count is absence.
	 */
	spentHitDice?: Record<string, number>
	/**
	 * The name of the spell the character is concentrating on (slice 9d1) — play
	 * tracking only, nothing detects a cast or prompts a save. One name because a
	 * character concentrates on one spell at a time; setting another replaces it.
	 * Absent and null both mean none, and the store writes none as absence, the
	 * convention every field above uses. D319: `source` is absent on a value saved
	 * before schema 59; matched through choiceMatch.ts.
	 */
	concentratingOn?: ConcentrationRef | null
	/**
	 * Heroic Inspiration (R4b, D167) — a manual on/off the player toggles. Nothing
	 * grants or spends it. Absent means off, and off is stored as absence, the
	 * convention every field above uses.
	 */
	heroicInspiration?: boolean
	/**
	 * Active conditions except Exhaustion (R12, D214) — names from CONDITION_NAMES,
	 * no duplicates, in the order they were turned on. Play tracking only: nothing
	 * is recalculated from them. Empty is stored as absence.
	 */
	conditions?: string[]
	/** Exhaustion level, an integer 1–6 (R12, D214); 0 is stored as absence. */
	exhaustion?: number
}

/**
 * The two pools D11 keeps apart, kept apart in storage too: a Warlock's Pact
 * Magic slots are never merged with ordinary ones, so a single count would be
 * unable to say which pool was spent.
 */
export interface SpentSpellSlots {
	/** Keyed by SPELL level (1-9), not character level. An absent level is nothing spent there. */
	ordinary?: Record<number, number>
	/** One count, no level key: all of a character's Pact Magic slots sit at the same spell level at any one time. */
	pact?: number
}

/** Three boxes each, counted 0–3 (D111). Which individual box was ticked carries no meaning, so only the counts are stored. */
export interface CharacterDeathSaves {
	successes: number
	failures: number
}

/**
 * A stored choice that used to be a bare name and now records the level it was
 * made at (D22, as D97 shapes it). `name` is exactly the string the bare array
 * held before the shape changed.
 *
 * `level` is the character level the player PICKED this at, and it is absent
 * whenever that is not known: a character created by the wizard makes every
 * such pick in one step, even when created directly at level 5, so no level is
 * recorded for a creation pick rather than inventing one (D43). Only the
 * level-up writer (slice 8d) sets it. Deliberately not named `grantedAtLevel`
 * like CharacterClassFeatureChoice's field — that one answers when the FEATURE
 * offered the choice, this one when the player made it.
 */
export interface LeveledChoice {
	name: string
	level?: number
}

/** One weapon mastery the character has (slice 8c1, D97). `name` is the weapon's name. */
export type CharacterMastery = LeveledChoice

/** One skill named as Expertise (slice 8c2, D98). `name` is the skill key skills.ts matches on. */
export type CharacterExpertiseSkill = LeveledChoice

/** The names alone, for readers that only match on names. Derived — a name is never stored twice. */
export function choiceNames(choices: readonly LeveledChoice[] | undefined): string[] {
	return (choices ?? []).map((choice) => choice.name)
}

/**
 * How one level's hit die result came about (build order step 8, slice 8a).
 * 'maximum' is level 1, which the rules never roll and never average;
 * 'average' is the PHB fixed value (half the die rounded down, plus one);
 * 'roll' is a die the player actually rolled; 'manual' is a number typed in
 * because the table did something the app has no way to reproduce.
 */
export type HitPointLevelKind = 'maximum' | 'average' | 'roll' | 'manual'

/**
 * One level's contribution to the maximum, WITHOUT Constitution — see
 * Character.hitPointLevels for why Constitution is left out. `level` is the
 * CHARACTER level this belongs to, not a level within a class: multiclass is
 * build order step 10 and nothing here anticipates it.
 */
export interface CharacterHitPointLevel {
	level: number
	/** The hit die result alone. Level 1's is always the die maximum, whatever is stored. */
	dieResult: number
	kind: HitPointLevelKind
}

/**
 * Which body slot an item occupies while equipped (build order step 7, slice
 * b). Armour is worn; a shield or a weapon is held. Absent means carried but
 * not in use — the state every item starts in, including one the wizard's
 * starting-equipment step just granted.
 */
export type EquippedSlot = 'worn' | 'held'

/**
 * The player's Strength-or-Dexterity pick for a Finesse weapon (build order
 * step 7, slice c). Absent means the default — whichever of the two is higher
 * — so the choice only ever appears in storage once the player has overridden
 * it. Spelled out rather than reusing `Ability`: no other ability can be
 * picked here, and storage stays free of a calculation-layer import.
 */
export type WeaponAttackAbility = 'strength' | 'dexterity'

/**
 * How a Versatile weapon is being held (build order step 7, slice b-fix).
 * Absent means one-handed, the default the rules give — so the field only
 * reaches storage once the player has two-handed the weapon deliberately.
 * The grip decides both the hand it occupies and the damage die (`dmg1` one-
 * handed, `dmg2` two-handed), which is why it is one field and not two.
 */
export type WeaponGrip = 'one-handed' | 'two-handed'

/**
 * One line of the inventory: which item (name + source, enough to look the
 * full entry back up in items.json) and how many are carried. `quantity` may
 * be 0 (slice 9d3: the last arrow is spent, the row stays so it can be
 * restocked); removing an item is still its own action, Discard.
 */
export interface CharacterInventoryItem {
	name: string
	source: string
	quantity: number
	/**
	 * Set only while the item is in use (slice b). Equipping is a play-time
	 * action taken on the sheet; nothing in the wizard sets this. At most one
	 * suit of armour is worn, and what is held has to fit in two hands — the
	 * sheet enforces both when equipping, since they are rules about what a body
	 * can carry, not about what storage can hold.
	 */
	equipped?: EquippedSlot
	/**
	 * Set only once the player has two-handed a Versatile weapon (slice b-fix).
	 * On the row for the same reason `attackAbility` is: a grip cannot outlive
	 * the weapon it is a grip on. Absent is one-handed, so no existing row has
	 * to be backfilled.
	 */
	grip?: WeaponGrip
	/**
	 * Set only once the player has overridden a Finesse weapon's default
	 * ability (slice c). It lives on the inventory row rather than in a list of
	 * its own so it cannot outlive the weapon it belongs to; a row that is not
	 * a Finesse weapon simply never gets one.
	 */
	attackAbility?: WeaponAttackAbility
	/**
	 * Set while the character is attuned to this item (slice d), never `false`
	 * — an absent flag is "not attuned". On the row for the same reason
	 * `attackAbility` is: attunement dies with the item, and cannot outlive it
	 * in a list of its own. Independent of `equipped`: a worn cloak and a
	 * carried rod are attuned the same way.
	 *
	 * Whether the item REQUIRES attunement is not stored — that is an
	 * items.json fact (`reqAttune`), re-read whenever the row is shown, so it
	 * cannot go stale against the data.
	 */
	attuned?: true
	/**
	 * The magic bonus the player set on this item (slice e) — a plain Longsword
	 * declared to be a +1 Longsword. Absent means none was set, which is not the
	 * same as "no bonus": the ITEM's own bonus (items.json `bonusWeapon` /
	 * `bonusAc`) is re-read from the data and never stored, for the same reason
	 * `attuned` does not store the requirement.
	 *
	 * The two never sum — a bonus set here REPLACES the item's own
	 * (src/calculation/magicBonus.ts). Capped at 3 because that is where the
	 * rules stop; the data's own bonuses are not capped by this type and reach 5.
	 */
	magicBonus?: MagicItemBonus
	/**
	 * The item's own definition, present only on a custom item (slice e2a).
	 * A row carrying one never resolves against items.json — this IS the item.
	 *
	 * Its contents are deliberately not validated by the storage layer: D43
	 * requires a malformed definition to render with the problem stated, which
	 * it cannot do if the whole character is refused. describeCustomItemProblem
	 * (src/inventory/inventoryData.ts) is what checks it, at resolution time.
	 */
	custom?: CustomItemDefinition
	/**
	 * R14c2 (D219): spent uses of the custom item's spells, keyed `name|source`
	 * (itemSpellKey). On the row for the reason `attuned` is: the count dies with
	 * the item and follows it when other rows move. Absent or 0 is none spent.
	 */
	spellUses?: Record<string, number>
}

/** A player-set magic bonus. +1 to +3 is the whole range the rules give a magic weapon or suit of armour. */
export type MagicItemBonus = 1 | 2 | 3

/**
 * What a custom item IS (build order step 7, slice e2a). Not a category from
 * the data: it is the smallest thing the app has to know to treat the row like
 * any other — whether it can be worn, held, or neither.
 */
export type CustomItemKind = 'weapon' | 'armour' | 'shield' | 'worn' | 'other'

/**
 * A DM's homebrew item, or an ordinary one the player altered, defined ON the
 * inventory row that holds it (slice e2a). There is deliberately no shared
 * library: one kept in this browser could never reach another player, and what
 * would actually serve a DM handing items out is export to a file — its own
 * slice.
 *
 * The shape is therefore a complete item on its own — name included, so
 * `JSON.stringify(row.custom)` is already the whole thing and an exporter has
 * nothing to inject. The row's own `name` mirrors this one; `source` is always
 * CUSTOM_ITEM_SOURCE.
 *
 * It may set exactly the fields the app already reads from a real item, and no
 * others. Slice e2b added the COMPUTED half of that set: every field below the
 * description already had a reader before this slice, so a custom item gives
 * those readers a second source and no arithmetic was added for it. A field
 * that would need new calculation is not here.
 *
 * The +1/+2/+3 magic bonus is NOT here either: `CharacterInventoryItem.magicBonus`
 * already holds exactly that (D79's player-set bonus) and works on a custom row
 * unchanged.
 */
export interface CustomItemDefinition {
	name: string
	kind: CustomItemKind
	/** Cost in COPPER, the unit items.json's own `value` uses. Absent means no price was recorded. */
	valueCopper?: number
	/** Present only when the item requires attunement, never `false` — same convention as the row's `attuned`. */
	requiresAttunement?: true
	/**
	 * The restriction sentence, in the player's own words ("by a druid"). Shown
	 * and never evaluated, exactly like items.json's own `reqAttune` string (D78).
	 */
	attunementCondition?: string
	/**
	 * Free text. What the app cannot compute goes here and is SHOWN, never
	 * silently applied (D9/D55) — a custom chain mail that does not hamper
	 * Stealth still shows the disadvantage; the sentence lives in this field.
	 * Blank lines separate paragraphs; each one is rendered through the step-1
	 * markup renderer, the same way a real item's `entries` are.
	 */
	description?: string
	/**
	 * kind 'armour': the suit's base Armour Class, items.json's `ac`.
	 * kind 'shield': the BONUS it adds, which is what a shield's `ac` means in
	 * the data (DATA.md, "Identifying item kinds"). Absent on an armour-kind
	 * item is a visible unfinished state, not a zero — the sheet names the item
	 * and says the value is not set (D43).
	 */
	armourClass?: number
	/** kind 'armour': which Dexterity cap applies. Spelled out rather than imported, for the same reason WeaponAttackAbility is. */
	armourCategory?: CustomArmourCategory
	/**
	 * kind 'armour'/'shield': wearing it gives disadvantage on Stealth checks —
	 * items.json's `stealth` (slice e2c). Present only when it does, never
	 * `false`, the same convention `requiresAttunement` uses; absent is what
	 * every custom item made before this slice carries, and it means no
	 * disadvantage.
	 */
	stealthDisadvantage?: true
	/**
	 * kind 'armour'/'shield': the minimum Strength score below which the suit
	 * costs 10 feet of speed — items.json's `strength`, which is a STRING there
	 * (DATA.md, "Armour AC") and a number here. Absent means no requirement.
	 * Only HEAVY armour is measured against it (armourSpeedPenalty), exactly as
	 * in the data, where nothing but an HA entry carries the field.
	 */
	strengthRequirement?: number
	/** kind 'weapon': items.json's `dmg1`, e.g. "1d8". */
	damageDice?: string
	/** kind 'weapon': items.json's `dmgTypeFull`, e.g. "slashing". */
	damageType?: string
	/** kind 'weapon': melee attacks with Strength, ranged with Dexterity (D77) — items.json's "M"/"R" type code. */
	weaponRange?: CustomWeaponRange
	/** kind 'weapon': items.json's `weaponCategory`, which is what decides proficiency (isProficientWithWeapon). */
	weaponCategory?: CustomWeaponCategory
	/**
	 * kind 'weapon': the Two-Handed property (fix slice) — items.json's
	 * `propertyFull` carrying "Two-Handed", which handsRequiredOf reads to cost
	 * both hands. Present only when it does, never `false`, the same convention
	 * `requiresAttunement` uses.
	 */
	twoHanded?: true
	/**
	 * kind 'weapon': the Versatile property (fix slice) — items.json's
	 * `propertyFull` carrying "Versatile". Only this flag makes the grip control
	 * appear at all (isVersatileWeapon); without it `damageDice2` is inert.
	 */
	versatile?: true
	/**
	 * kind 'weapon', versatile only: the two-handed damage die — items.json's
	 * `dmg2`, e.g. "1d10". Meaningless without `versatile`, same as
	 * `strengthRequirement` is without heavy armour.
	 */
	damageDice2?: string
	/** Damage types resisted, lowercase, the shape items.json's own `resist` uses. Gated on attunement exactly as a real item's is. */
	resist?: string[]
	/** As `resist`, for items.json's `immune`. */
	immune?: string[]
	/** Feet added to (or, negative, taken off) the walking speed. */
	speedBonus?: number
	/** Darkvision in feet. Reconciled against every other source, never summed with them (speciesTraits.ts). */
	darkvision?: number
	/** R14a2 (D216): fixed fly / swim / climb speeds in feet. The highest of these and the species-derived speed applies, never a sum (speciesTraits.ts). */
	flySpeed?: number
	swimSpeed?: number
	climbSpeed?: number
	/** R14a2 (D216): senses in feet, listed in Granted senses; the largest range of a type wins over every other source. */
	blindsight?: number
	tremorsense?: number
	truesight?: number
	/**
	 * R14a1 (D216): the numeric bonuses, each target at most once. Replaced the
	 * five `bonus*` fields of slice h (migration 53 → 54). The proficiency bonus
	 * is deliberately not a target: slice h leaves that one unapplied, so it
	 * would be a number the sheet shows and never counts.
	 */
	bonuses?: CustomItemBonus[]
	/** R14b (D217): proficiencies the item grants, each entry at most once (a skill once, expertise or not). */
	proficiencies?: CustomItemProficiency[]
	/** R14b: damage types the wearer is vulnerable to, the shape of `resist`. */
	vulnerable?: string[]
	/** R14b: names from CONDITION_NAMES plus Exhaustion. Shown on the Defenses card and in the Conditions drawer; nothing is switched off (D214). */
	conditionImmune?: string[]
	/** R14b: conditions the wearer has advantage on saving throws against. Text under Saving Throws only. */
	conditionAdvantage?: string[]
	/** R14c1 (D218): feats the item grants, each at most once, with their sub-choices — which leave with the item. */
	feats?: CustomItemFeat[]
	/** R14c1 (D218): Eldritch Invocations (featureType "EI") the item grants, each at most once; no prerequisite or class check. */
	invocations?: { name: string; source: string }[]
	/** R14c2 (D219): spells the item grants, each name|source at most once; cast only from the item, never with slots. */
	spells?: CustomItemSpell[]
	/** R14e2 (D222): ability scores the item sets or raises, each ability at most once. */
	abilityScores?: CustomItemAbilityScore[]
}

/** One entry of CustomItemDefinition.abilityScores; whole numbers, `value` and `max` 1 to 30, `amount` not 0. describeCustomItemProblem proves the shape (D43). */
export type CustomItemAbilityScore = { ability: Ability; kind: 'set'; value: number } | { ability: Ability; kind: 'add'; amount: number; max: number }

/** One entry of CustomItemDefinition.spells; describeCustomItemProblem proves the shape (D43). A cantrip is always at will and has no castLevel. */
export interface CustomItemSpell {
	name: string
	source: string
	/** perShortRest recharges on a Short Rest and a Long Rest. */
	uses: { kind: 'atWill' } | { kind: 'perLongRest'; count: number } | { kind: 'perShortRest'; count: number }
	/** Leveled spells only, from the spell's own level to 9; absent is its own level. */
	castLevel?: number
	caster: { kind: 'own'; ability: CustomItemSpellAbility } | { kind: 'fixed'; saveDc?: number; attackBonus?: number }
}

export type CustomItemSpellAbility = 'int' | 'wis' | 'cha'

/** One entry of CustomItemDefinition.feats; describeCustomItemProblem proves the shape (D43). */
export type CustomItemFeat = { name: string; source: string } & FeatChoiceDetails

/** One entry of CustomItemDefinition.proficiencies; describeCustomItemProblem proves the shape (D43). */
export type CustomItemProficiency =
	| { kind: 'weaponCategory'; category: CustomWeaponCategory }
	/** A base weapon from the item data. */
	| { kind: 'weapon'; name: string; source: string }
	| { kind: 'armor'; armor: CustomProficiencyArmor }
	/** The tool's name as the wizard stores a tool choice ("Thieves' Tools"). */
	| { kind: 'tool'; tool: string }
	/** The language's name as the wizard stores a language ("Elvish"). */
	| { kind: 'language'; language: string }
	| { kind: 'savingThrow'; ability: Ability }
	| { kind: 'skill'; skill: Skill; expertise?: true }

/** The armour tokens the Proficiencies card knows (proficiencies.ts's ARMOR_LABELS). */
export type CustomProficiencyArmor = 'light' | 'medium' | 'heavy' | 'shield'

/** One entry of CustomItemDefinition.bonuses. `amount` is a non-zero integer; describeCustomItemProblem proves the shape (D43). */
export type CustomItemBonus =
	| {
			target: 'armourClass' | 'initiative' | 'allSavingThrows' | 'allAbilityChecks' | 'weaponAttack' | 'weaponDamage' | 'spellAttack' | 'spellSaveDc'
			amount: number
	  }
	/** R14d (D220): bonuses for the familiar in the Extras tab, never the character. */
	| { target: 'familiarArmourClass' | 'familiarAttack' | 'familiarDamage' | 'familiarSavingThrows' | 'familiarWalkingSpeed'; amount: number }
	/** `perLevel`: amount × total character level. Present only when true. */
	| { target: 'maxHitPoints' | 'familiarMaxHitPoints'; amount: number; perLevel?: true }
	| { target: 'savingThrow'; ability: Ability; amount: number }
	| { target: 'skill'; skill: Skill; amount: number }
	| { target: 'passive'; passive: CustomBonusPassive; amount: number }

/** The three passive values the sheet shows. */
export type CustomBonusPassive = 'perception' | 'investigation' | 'insight'

/** The three Dexterity-cap categories, as items.json's LA/MA/HA type codes name them. */
export type CustomArmourCategory = 'light' | 'medium' | 'heavy'

/** Which of D77's two rules a custom weapon follows. */
export type CustomWeaponRange = 'melee' | 'ranged'

/** The two `weaponCategory` values the data uses; a weapon proficiency grant matches on nothing else. */
export type CustomWeaponCategory = 'simple' | 'martial'

/**
 * The `source` every custom item's row carries. A custom item comes from no
 * book, and claiming the source of the item it was copied from would make the
 * row lie about which entry in items.json it is.
 */
export const CUSTOM_ITEM_SOURCE = 'Custom'

/**
 * The familiar's current form. Names the creature (name + source) only — the
 * stat block is re-derived from beasts.json, same as CharacterWildShapeForms
 * and CharacterSpellChoice.
 */
export interface CharacterFamiliar {
	name: string
	source: string
	/** D213: the familiar's own hit points; absent means full (its stat block's average). */
	currentHp?: number
	/** D213: absent or 0 is none. */
	temporaryHitPoints?: number
}

/**
 * One class's known Wild Shape forms. `forms` names each pick (name + source)
 * only — the stat block itself is re-derived from beasts.json when needed,
 * never duplicated into storage, same as CharacterSpellChoice.
 */
export interface CharacterWildShapeForms {
	className: string
	classSource: string
	forms: { name: string; source: string }[]
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

/**
 * One optionalfeatureProgression's picks, tagged with which progression
 * (featureType code) they belong to.
 *
 * The level sits on each individual pick, not on this entry (D99): one
 * featureType collects picks made at several different levels — a Sorcerer
 * takes Metamagic at 3, 10 and 17, all under `MM` — so an entry-level field
 * would be wrong for all but one of them.
 */
/** D318: `source` is absent on a pick saved before schema 58; matched through choiceMatch.ts. */
export interface CharacterOptionalFeaturePick {
	name: string
	level?: number
	source?: string
}

/** D318: `className`/`classSource` are both absent on a style whose class a pre-58 save could not tell. */
export interface CharacterFightingStyle {
	className?: string
	classSource?: string
	name: string
	source?: string
}

/** D318: the style this class's own feature granted, else the unassigned one, read as before schema 58. */
export function fightingStyleFor(
	styles: readonly CharacterFightingStyle[] | undefined,
	owner: { className: string; classSource: string } | undefined,
): CharacterFightingStyle | undefined {
	const all = styles ?? []
	return all.find((style) => owner !== undefined && style.className === owner.className && style.classSource === owner.classSource) ?? all.find((style) => style.className === undefined)
}

export interface CharacterOptionalFeatureChoice {
	featureType: string
	/** Objects rather than bare option names since schema version 33 — see LeveledChoice (D99, following D97/D98). */
	choices: CharacterOptionalFeaturePick[]
	/**
	 * Present only for options that let the player pick spells (step 6a). One
	 * entry per such option chosen; absent entirely for every other progression.
	 *
	 * Deliberately carries NO level, unlike the `choices` beside it — D99 leaves
	 * nested spell picks out of D22 for the reason CharacterWildShapeForms and
	 * Character.familiar are out: a spell can be swapped at any time, so a
	 * recorded level would be false provenance.
	 */
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
	| ({
			level: number
			kind: 'feat'
			name: string
			source: string
	  } & FeatChoiceDetails)

/** A feat's own sub-choices, wherever the feat came from — an ASI level or a grantedFeats entry. */
export interface FeatChoiceDetails {
	/**
	 * Which ability the feat's bonus applies to — required for the 68
	 * half-feats whose feats.json `ability` field is a choice among named
	 * abilities (featAbilityChoiceOptions), AND for base Magic Initiate's
	 * own int/wis/cha spellcasting-ability choice (which lives in
	 * `additionalSpells`, not the half-feat `ability` field, but reuses
	 * this same slot per the task instructions rather than a second one).
	 * Absent for the 13 fixed-bonus feats and every feat with no ability
	 * choice at all.
	 */
	chosenAbility?: Ability
	/** Base Magic Initiate only (slice d5b-2) — see MagicInitiateChoice. */
	magicInitiate?: MagicInitiateChoice
	/** The 8 generic filter-choice feats only (slice d5b-1) — see FilterChoiceSpellsChoice. */
	filterChoiceSpells?: FilterChoiceSpellsChoice
	/** Strixhaven Initiate only (D200): the name of the chosen `additionalSpells` block ("Quandrix 2"); the college is its prefix. */
	blockName?: string
	/**
	 * Skill/tool/language/expertise picks from the 10 feats that offer one
	 * (DATA.md "Feat proficiency / expertise / language choices"; build order
	 * task A2). Flat per kind rather than per feats.json field, since a feat
	 * like Skilled can mix skills and tools in one choice. Tools and languages
	 * are stored only — nothing computed reads them yet (a later task). No
	 * picker enforces the count or the allowed pool here; that is also a
	 * later task's job.
	 */
	proficiencies?: FeatChoiceProficiencies
}

/** See FeatChoiceDetails.proficiencies. */
export interface FeatChoiceProficiencies {
	skills?: string[]
	tools?: string[]
	/** D158: a feat's own language pick lives only on the feat instance, never merged into Character.languages. */
	languages?: { name: string; source: string }[]
	/** D159: may name a skill the SAME feat instance also granted. */
	expertise?: string[]
}

/** Where a feat that no ASI level paid for came from (D156). 'species' is shape only until the wizard rebuild (D157). 'manual': added on the sheet (D215). */
export type GrantedFeatOrigin = 'background' | 'species' | 'manual'

/**
 * A feat granted by the background or the species, or added manually, with its
 * sub-choices. A 'background' entry never decides WHICH feat the character has —
 * that is derived from the background — and applies only while its name/source
 * match the current background's origin feat (featInstances.ts). A 'manual'
 * entry does decide it, and may repeat.
 */
export type CharacterGrantedFeat = {
	origin: GrantedFeatOrigin
	name: string
	source: string
	/** D319: present on every stored 'manual' entry, never reused on the character; its featInstances key is `manual:<id>`. */
	id?: string
} & FeatChoiceDetails

/** D319: the spell concentrated on. */
export interface ConcentrationRef {
	name: string
	source?: string
}

/**
 * Schema version for the persisted/exported character wire format
 * (see wireFormat.ts). Bumped to 60 for Character.multiclassPicks (M7b, D330); 59 for play.concentratingOn's source and manual feat ids (M1c, D319); 57 for Character.levelOrder (M1a, D317); 56 for Character.speciesCantrip (S2); 55 for Character.portrait (W-8); 54 for CustomItemDefinition.bonuses (R14a1,
 * D216); 53 for the 'manual' grantedFeats origin
 * (R13a, D215); 52 for Character.play.conditions and
 * .exhaustion (R12, D214); 51 for CharacterFamiliar.currentHp and
 * .temporaryHitPoints (D213); 50 for CharacterBackground.originFeatOverride
 * (D205); 49 for the RHW/FRHoF subclass `grantedBy`
 * values (D203); 48 for Character.subclassSkills and the
 * species/Cavalier/Samurai `grantedBy` values (B6c, D177); 47 for the non-XPHB subclass
 * `grantedBy` values (B6b, D176); 46 for Character.toolChoices and
 * .speciesSize (D174, D175); 45 for the class-feature language
 * `grantedBy` values (B3b, D172); 44 for Character.play.heroicInspiration
 * (R4b); 43 for FeatChoiceDetails.proficiencies
 * (build order task A2); 42 for Character.grantedFeats (D156); 41
 * added Character.appearance, .backstory and .notes (slice 9d2); 40 added Character.play.concentratingOn
 * (slice 9d1); 39 added Character.play.spentHitDice
 * (slice 9b4); 38 added Character.play.spentSpellSlots (slice 9b3); 37
 * grouped play state under Character.play (slice 9b1), absorbing the two
 * play fields 35 and 36 added at the top level.
 *
 * Under D69 every bump from 16 on ships a migration from the immediately
 * previous version (see migrations.ts): a version-19 character is migrated,
 * not rejected. Versions 15 and older are still rejected outright with
 * UnknownSchemaVersionError — D69 explicitly does not backfill the chain.
 */
export const CURRENT_SCHEMA_VERSION = 60

export interface CharacterLevelOrderEntry {
	className: string
	classSource: string
}

export interface CharacterMulticlassPick {
	className: string
	classSource: string
	kind: 'skill' | 'tool'
	name: string
}

/** D317: valid only when it has one entry per character level and each class appears exactly its `level` times. */
export function isConsistentLevelOrder(levelOrder: readonly CharacterLevelOrderEntry[], classes: readonly CharacterClass[]): boolean {
	const counts = new Map<string, number>()
	for (const entry of levelOrder) counts.set(`${entry.className}|${entry.classSource}`, (counts.get(`${entry.className}|${entry.classSource}`) ?? 0) + 1)
	return levelOrder.length === classes.reduce((sum, c) => sum + c.level, 0) && classes.every((c) => counts.get(`${c.className}|${c.classSource}`) === c.level)
}

/** D317: one class taking every level — the history create and Edit write. */
export function singleClassLevelOrder(classes: readonly CharacterClass[]): CharacterLevelOrderEntry[] {
	return classes.flatMap((c) => Array.from({ length: c.level }, () => ({ className: c.className, classSource: c.classSource })))
}
