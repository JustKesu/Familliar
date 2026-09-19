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
	 * character isn't otherwise proficient in. Objects rather than bare skill
	 * names since schema version 32 — see LeveledChoice (D98, following D97).
	 */
	expertiseSkills?: CharacterExpertiseSkill[]
	/**
	 * Optional for the same reason as abilityScores above. Objects rather than
	 * bare weapon names since schema version 31 — see CharacterMastery (D97).
	 */
	masteries?: CharacterMastery[]
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
	/**
	 * The character level the creation wizard made this character at (slice 8e).
	 * Set once, never changed afterwards. It is the floor for removing a level:
	 * creation picks carry no level (D97), so nothing at or below it can be told
	 * apart by level. Absent means "not known" — every character saved before
	 * schema version 34 — and removal is then refused rather than guessed.
	 */
	createdAtLevel?: number
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
	 * convention every field above uses.
	 */
	concentratingOn?: string | null
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
 * full entry back up in items.json) and how many are carried. `quantity` has
 * a floor of 1 — removing an item is its own action, never "set quantity to 0".
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
	/*
	 * The flat bonuses slice h wired, one field each. `bonusProficiencyBonus` is
	 * deliberately absent: slice h leaves that one unapplied, so a field for it
	 * would be a number the sheet shows and never counts.
	 */
	bonusArmourClass?: number
	bonusSavingThrow?: number
	bonusSpellAttack?: number
	bonusSpellSaveDc?: number
	bonusAbilityCheck?: number
}

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
export interface CharacterOptionalFeatureChoice {
	featureType: string
	/** Objects rather than bare option names since schema version 33 — see LeveledChoice (D99, following D97/D98). */
	choices: LeveledChoice[]
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
 * (see wireFormat.ts). Bumped to 40 for Character.play.concentratingOn
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
export const CURRENT_SCHEMA_VERSION = 40
