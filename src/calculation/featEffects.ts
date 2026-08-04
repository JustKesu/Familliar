/*
 * Feat/ASI effects into the calculation layer (build order step 4a, closing
 * D16/D19/D20/D42/D44/D55/D57 — the wizard already selects and stores these
 * (src/featAsi/), this file is what reads that storage back out into the
 * numbers other calculation files already compute.
 *
 * D38: pure functions, feat data comes in as a typed parameter (the caller
 * fetches feats.json and shapes it — no Sheet consumer exists yet, so
 * nothing does that today; tests build `FeatEffectEntry[]` fixtures
 * directly, same as savingThrows.ts's ClassSavingThrowProficiencies).
 *
 * Scope, confirmed via scripts/investigate-feat-structured-fields.js and
 * scripts/investigate-feat-calc-fields.js against the real 128-feat data,
 * not assumed:
 *   - `ability` (82 feats: 13 fixed, 68 choice) -> ability score bonus.
 *   - `savingThrowProficiencies` (1 feat, Resilient) -> save proficiency;
 *     its `choose` list is identical to Resilient's own `ability` choose
 *     list and the feat's prose ties them to the SAME chosen ability, so
 *     the already-stored `chosenAbility` (D57) resolves this one too —
 *     confirmed by reading Resilient's entry, not guessed.
 *   - `skillProficiencies` (6 feats) -> skill proficiency, but only ONE is
 *     computable: Boon of Skill's is a FIXED grant of all 18 skills. The
 *     other 5 (Keen Mind, Observant, Prodigy, Squat Nimbleness, Skill
 *     Expert) are a player choice among named skills (or "any") that
 *     nothing in this app stores yet (confirmed with the user — out of
 *     this task's scope to add; see docs/REPORT.md). Flagged with a
 *     distinct "awaiting a choice" note, not silently dropped and not
 *     conflated with D55's "known effect, not computed" prose-feat note.
 *   - `expertise` (3 feats: Boon of Skill, Prodigy, Skill Expert) is ALWAYS
 *     `anyProficientSkill` (choose one already-proficient skill) — never a
 *     fixed grant, so it is NEVER computed, only flagged the same
 *     "awaiting a choice" way, on every skill the character is currently
 *     proficient in (the one thing that choice's candidate set actually is).
 *   - `speed` does not exist as a feats.json field on any of the 128 feats
 *     (checked directly) — nothing to project onto speciesTraits.ts.
 *   - `senses` (3 feats) only ever grants blindsight/truesight, never
 *     darkvision — speciesTraits.ts computes darkvision only, so none of
 *     these 3 have anywhere to plug in yet (not a gap to flag here; there
 *     is no computed value for them to attach to).
 *   - `toolProficiencies`/`weaponProficiencies`/`armorProficiencies`/
 *     `languageProficiencies`/`skillToolLanguageProficiencies`/`resist`/
 *     `additionalSpells`/`optionalfeatureProgression` have no computed
 *     value anywhere in this app yet (no AC/attacks/spells/tools step) —
 *     out of scope until those steps exist.
 */

import { ALL_SKILLS } from '../classSkills/classSkillData'
import type { Ability } from '../abilities/abilityScores'
import type { Character, FeatAsiChoice } from '../storage/character'
import { ABILITY_ABBREVIATIONS, type AbilityAbbreviation } from './abilityAbbreviations'
import type { Contribution } from './types'

type Skill = (typeof ALL_SKILLS)[number]

/** feats.json's `ability` array entry: a fixed bonus (abbreviation keys) or a choice among named abilities. Always exactly one entry per feat (confirmed, scripts/investigate-feat-ability-choice-shape.js) — Ability Score Improvement's own 2-entry shape never reaches here since it isn't a selectable feat. */
export type RawFeatAbilityEntry = { choose: { from: AbilityAbbreviation[] } } | Partial<Record<AbilityAbbreviation, number>>

/** feats.json's `savingThrowProficiencies` array entry — only Resilient carries this, always a `choose`. */
export interface RawFeatSavingThrowProficienciesEntry {
	choose: { from: AbilityAbbreviation[] }
}

/** feats.json's `skillProficiencies` array entry: a fixed set (skill-name keys, Boon of Skill), a named choice, or "any N". */
export type RawFeatSkillProficienciesEntry = { choose: { from: string[] } } | { any: number } | Record<string, boolean>

/** feats.json's `expertise` array entry — all 3 feats that carry this use the same shape: choose N skill(s) you're already proficient in. */
export interface RawFeatExpertiseEntry {
	anyProficientSkill: number
}

/** The slice of a feats.json entry the calculation layer reads — a caller-supplied parameter (D38), never fetched here. */
export interface FeatEffectEntry {
	name: string
	source: string
	ability?: RawFeatAbilityEntry[]
	savingThrowProficiencies?: RawFeatSavingThrowProficienciesEntry[]
	skillProficiencies?: RawFeatSkillProficienciesEntry[]
	expertise?: RawFeatExpertiseEntry[]
}

type FeatChoice = Extract<FeatAsiChoice, { kind: 'feat' }>

function chosenFeats(character: Character): FeatChoice[] {
	return (character.featAsiChoices ?? []).filter((choice): choice is FeatChoice => choice.kind === 'feat')
}

function findFeat(feats: FeatEffectEntry[], name: string, source: string): FeatEffectEntry | undefined {
	return feats.find((f) => f.name === name && f.source === source)
}

function isChoiceAbilityEntry(entry: RawFeatAbilityEntry): entry is { choose: { from: AbilityAbbreviation[] } } {
	return 'choose' in entry
}

/**
 * `RawFeatSkillProficienciesEntry`'s fixed shape is `Record<string, boolean>`
 * (Boon of Skill's skill-name keys), which structurally overlaps a `choose`
 * or `any` shape's index signature — a plain `'choose' in entry` can't tell
 * them apart, so these check the SHAPE of the value at that key instead.
 */
function isChooseSkillEntry(entry: RawFeatSkillProficienciesEntry): entry is { choose: { from: string[] } } {
	const choose = (entry as { choose?: unknown }).choose
	return typeof choose === 'object' && choose !== null && Array.isArray((choose as { from?: unknown }).from)
}

function isAnySkillEntry(entry: RawFeatSkillProficienciesEntry): entry is { any: number } {
	return typeof (entry as { any?: unknown }).any === 'number'
}

/**
 * Every ability-score contribution from ASI picks and feats (D42: additional
 * list entries, never a rewritten sum; a feat/ASI pick that doesn't touch
 * this ability contributes nothing, so the list stays exactly as long as
 * what actually applies).
 */
export function featAbilityScoreContributions(ability: Ability, character: Character, feats: FeatEffectEntry[]): Contribution[] {
	const abbreviation = ABILITY_ABBREVIATIONS[ability]
	const contributions: Contribution[] = []

	for (const choice of character.featAsiChoices ?? []) {
		if (choice.kind === 'asi') {
			const amount = choice.increases[ability]
			if (amount) contributions.push({ source: `ASI (level ${choice.level})`, amount })
			continue
		}

		const feat = findFeat(feats, choice.name, choice.source)
		const entry = feat?.ability?.[0]
		if (!feat || !entry) continue

		if (isChoiceAbilityEntry(entry)) {
			if (choice.chosenAbility === ability) contributions.push({ source: `feat (${feat.name})`, amount: 1 })
		} else {
			const amount = entry[abbreviation]
			if (amount) contributions.push({ source: `feat (${feat.name})`, amount })
		}
	}

	return contributions
}

/**
 * Feats granting saving throw proficiency in `ability` (D44: names only —
 * the caller joins these into its own existing source list so the
 * proficiency bonus is still added once, whatever else already grants it).
 * Resilient is the only feat with this field; its saving-throw choice is
 * the SAME chosen ability as its own ability-score bonus (confirmed by
 * reading the feat's prose, not assumed), so no separate stored choice is
 * needed — `chosenAbility` (D57) answers both.
 */
export function featSavingThrowProficiencyNames(ability: Ability, character: Character, feats: FeatEffectEntry[]): string[] {
	const names: string[] = []
	for (const choice of chosenFeats(character)) {
		const feat = findFeat(feats, choice.name, choice.source)
		if (feat?.savingThrowProficiencies?.[0] && choice.chosenAbility === ability) {
			names.push(feat.name)
		}
	}
	return names
}

/** Feats granting FIXED skill proficiency in `skill` (D44: names only, same join-into-existing-source-list contract as featSavingThrowProficiencyNames). Only Boon of Skill qualifies — see module doc. */
export function featFixedSkillProficiencyNames(skill: Skill, character: Character, feats: FeatEffectEntry[]): string[] {
	const names: string[] = []
	for (const choice of chosenFeats(character)) {
		const feat = findFeat(feats, choice.name, choice.source)
		const entry = feat?.skillProficiencies?.[0]
		if (feat && entry && !isChooseSkillEntry(entry) && !isAnySkillEntry(entry) && (entry as Record<string, boolean>)[skill] === true) {
			names.push(feat.name)
		}
	}
	return names
}

/**
 * A note (D40 Contribution with `amount: 0` and a `note`) for every feat
 * whose skillProficiencies/expertise field offers `skill` as a candidate
 * but has no stored player pick anywhere in this app — distinct from D55's
 * "prose feat, effect not computed" wording: the mechanism here IS
 * structured and known, only the player's choice is missing. `isProficient`
 * is whether the character is already proficient in `skill` from any OTHER
 * source (including featFixedSkillProficiencyNames) — the exact candidate
 * set an `expertise` (`anyProficientSkill`) entry offers.
 */
export function featSkillChoiceAwaitingNotes(skill: Skill, character: Character, feats: FeatEffectEntry[], isProficient: boolean): Contribution[] {
	const notes: Contribution[] = []
	for (const choice of chosenFeats(character)) {
		const feat = findFeat(feats, choice.name, choice.source)
		if (!feat) continue

		const skillEntry = feat.skillProficiencies?.[0]
		if (skillEntry && (isAnySkillEntry(skillEntry) || (isChooseSkillEntry(skillEntry) && skillEntry.choose.from.includes(skill)))) {
			notes.push(skillChoiceAwaitingNote(feat.name))
		}

		if (feat.expertise?.[0] && isProficient) {
			notes.push(skillChoiceAwaitingNote(feat.name))
		}
	}
	return notes
}

function skillChoiceAwaitingNote(featName: string): Contribution {
	return { source: `feat (${featName})`, amount: 0, note: 'grants a skill choice this app has nowhere to store yet — waiting on a player pick' }
}

/**
 * MANUAL LIST (task instructions point 4) — the 15 "pure prose" feats
 * (scripts/investigate-feat-structured-fields.js: no structured field at
 * all) carry their effect only in text a script can't read. Filled in by
 * hand, checked against each feat's actual PHB 2024 text, for every one of
 * the 15 that touches a value THIS APP ALREADY COMPUTES. Feats aimed at
 * attacks or AC are deliberately left out (those values don't exist until
 * build order steps 7/8 — see docs/REPORT.md for which feats those are).
 *
 * MUST be revisited whenever the calculation layer starts computing a new
 * value (max HP, AC, attacks, ...): re-check all 15 prose feats' text
 * against that new value, don't assume this list is exhaustive for
 * something it predates.
 */
export const PROSE_FEAT_EFFECT_TARGETS = {
	Alert: ['initiative'],
} as const satisfies Record<string, readonly ProseFeatEffectTarget[]>

export type ProseFeatEffectTarget = 'initiative'

/**
 * A D55 note ("known effect, not computed") for every chosen prose feat
 * that touches `target` per PROSE_FEAT_EFFECT_TARGETS above.
 */
export function proseFeatEffectNotes(target: ProseFeatEffectTarget, character: Character): Contribution[] {
	const notes: Contribution[] = []
	for (const choice of chosenFeats(character)) {
		const targets: readonly ProseFeatEffectTarget[] | undefined = (
			PROSE_FEAT_EFFECT_TARGETS as Record<string, readonly ProseFeatEffectTarget[] | undefined>
		)[choice.name]
		if (targets?.includes(target)) {
			notes.push({ source: `feat (${choice.name})`, amount: 0, note: 'has an effect on this value that is not computed (D55)' })
		}
	}
	return notes
}
