/*
 * Senses granted by a chosen optional feature and by a chosen feat (build
 * order step 6a, final piece — closes 6a). This module only extracts the
 * grants; it does not decide where a darkvision grant is DISPLAYED — that
 * split (folded into speciesTraits.ts's computeDarkvision vs. shown as its
 * own Senses row) is CharacterSheet.tsx's job, done by filtering this
 * module's output before it reaches either destination (see that file and
 * the "darkvision reconciliation" follow-up task's docs/REPORT.md).
 *
 * Shape confirmed by scripts/investigate-senses.js (D46) before this module
 * was written:
 *
 * - 3 optional-features.json entries and 3 feats.json entries carry a
 *   `senses` field. Every one of the 6 is `[{ <senseType>: <range number> }]`
 *   — a one-element array holding a single-key object, never a plain string,
 *   never more than one sense per grant. Parsed generically (loop the
 *   array, loop each item's keys) rather than assuming the one-element shape
 *   forever, so a future data entry with two senses at once or a second
 *   array element degrades to "both granted" instead of silently losing one.
 * - Of the 3 optional-features.json entries, only 2 are actually reachable
 *   through any picker: Stone Rune (featureType "RN", a Rune Knight rune)
 *   and Witch Sight (featureType "EI", a Warlock invocation). The third,
 *   "Blind Fighting", carries featureType `["FS:F","FS:P","FS:R"]` — every
 *   code is `FS:*`, which per D12 resolves against feats.json instead (the
 *   same dead-data shape optionalFeatureSpells.ts already found for 2 of its
 *   19 additionalSpells entries). Because it is never offered by any picker,
 *   it can never appear in a stored `optionalFeatureChoices` pick either, so
 *   extractOptionalFeatureGrantedSenses needs no special-case filter for
 *   it — the same reasoning the spells module relies on for its own 2 dead
 *   entries.
 * - All 3 feats.json entries (Blind Fighting, Boon of Truesight, Skulker)
 *   are ordinary selectable feats — none is in featAsiData.ts's
 *   HIDDEN_FEAT_KEYS.
 * - ONE of the 6 grants IS darkvision: Stone Rune, 120 ft. This was flagged
 *   when this module was first written as a collision needing a decision.
 *   Resolved in the darkvision-reconciliation follow-up task: a darkvision
 *   grant now reconciles with the species value in speciesTraits.ts's
 *   computeDarkvision (largest of the two wins, breakdown names both)
 *   instead of appearing as a separate Senses row — CharacterSheet.tsx
 *   filters this module's darkvision entries out of the Senses list and
 *   into computeDarkvision instead. See docs/REPORT.md for that task.
 * - None of the 3 feats.json grants is darkvision (blindsight/truesight
 *   only) — already documented in calculation/featEffects.ts's own module
 *   comment from the earlier feat/ASI slice; this investigation confirms it
 *   again against the current data rather than trusting the old note.
 * - No entry carrying `senses` also carries `additionalSpells` — no overlap
 *   with the already-built spell-grant path.
 */

import type { Character, CharacterOptionalFeatureChoice, FeatAsiChoice } from '../storage/character'
import { isRecord } from '../spells/subclassPreparedSpells'
import { loadDataFile } from '../dataLoader/dataLoader'

export interface GrantedSense {
	/** The sense's own key in the data — "blindsight", "darkvision", "truesight", "tremorsense", whatever occurs. Not narrowed to a fixed union: display only, no calculation branches on this beyond the label. */
	senseType: string
	/** Range in feet, as the data states it. */
	range: number
	/** Provenance kind — a chosen optional feature ("from invocation (Name)") or a chosen feat ("from feat (Name)"), matching the wording SpellList.tsx's provenanceLabel already uses for the same two sources. */
	origin: 'optionalFeature' | 'feat'
	/** The option's or feat's own name — the "(...)" part of the provenance label. */
	name: string
}

interface RawOptionalFeatureSenseEntry {
	name: string
	source: string
	featureType?: unknown
	senses?: unknown
}

function isRawOptionalFeatureSenseEntry(value: unknown): value is RawOptionalFeatureSenseEntry {
	return isRecord(value) && typeof value['name'] === 'string' && typeof value['source'] === 'string'
}

interface RawFeatSenseEntry {
	name: string
	source: string
	senses?: unknown
}

function isRawFeatSenseEntry(value: unknown): value is RawFeatSenseEntry {
	return isRecord(value) && typeof value['name'] === 'string' && typeof value['source'] === 'string'
}

/** Parses a raw `senses` field into (senseType, range) pairs. Handles more than one element or more than one key per element even though today's data never uses either — skips anything that isn't a finite number cleanly (D43) rather than guessing. */
function parseSenses(raw: unknown): { senseType: string; range: number }[] {
	if (!Array.isArray(raw)) return []
	const result: { senseType: string; range: number }[] = []
	for (const item of raw) {
		if (!isRecord(item)) continue
		for (const [senseType, range] of Object.entries(item)) {
			if (typeof range === 'number' && Number.isFinite(range)) result.push({ senseType, range })
		}
	}
	return result
}

/**
 * Pure filter (D38). The senses a character's CHOSEN optional features grant
 * — Stone Rune, Witch Sight and anything else reachable that carries a
 * `senses` field. Mirrors optionalFeatureSpells.ts's
 * extractOptionalFeatureGrantedSpells matching: a stored pick is matched by
 * option NAME and featureType together, the same scoping the picker itself
 * used to offer it.
 */
export function extractOptionalFeatureGrantedSenses(parsedOptionalFeatures: unknown, selection: CharacterOptionalFeatureChoice[]): GrantedSense[] {
	if (!Array.isArray(parsedOptionalFeatures)) {
		throw new Error('optional-features.json: expected a top-level array.')
	}
	const entries = parsedOptionalFeatures.filter(isRawOptionalFeatureSenseEntry)
	const result: GrantedSense[] = []

	for (const stored of selection) {
		for (const chosenName of stored.choices) {
			const option = entries.find(
				(candidate) =>
					candidate.name.toLowerCase() === chosenName.toLowerCase() &&
					Array.isArray(candidate.featureType) &&
					candidate.featureType.includes(stored.featureType),
			)
			if (!option) continue
			for (const { senseType, range } of parseSenses(option.senses)) {
				result.push({ senseType, range, origin: 'optionalFeature', name: option.name })
			}
		}
	}

	return result
}

function chosenFeats(character: Character): Extract<FeatAsiChoice, { kind: 'feat' }>[] {
	return (character.featAsiChoices ?? []).filter((choice): choice is Extract<FeatAsiChoice, { kind: 'feat' }> => choice.kind === 'feat')
}

/** Pure filter (D38). The senses a character's chosen feats grant — Blind Fighting, Boon of Truesight, Skulker, matched by (name, source) the same way featSpells.ts's extractFixedFeatSpells matches a feat entry. */
export function extractFeatGrantedSenses(parsedFeats: unknown, character: Character): GrantedSense[] {
	if (!Array.isArray(parsedFeats)) {
		throw new Error('feats.json: expected a top-level array.')
	}
	const entries = parsedFeats.filter(isRawFeatSenseEntry)
	const result: GrantedSense[] = []

	for (const choice of chosenFeats(character)) {
		const feat = entries.find((candidate) => candidate.name === choice.name && candidate.source === choice.source)
		if (!feat) continue
		for (const { senseType, range } of parseSenses(feat.senses)) {
			result.push({ senseType, range, origin: 'feat', name: feat.name })
		}
	}

	return result
}

/** Fetches optional-features.json and feats.json through the shared cache (D39) and returns both sources' granted senses, unmerged — merging same-type grants into one row is SensesList.tsx's job, the same split combineSpellEntries/SpellList.tsx already has. */
export async function loadGrantedSenses(character: Character): Promise<GrantedSense[]> {
	const selection = character.optionalFeatureChoices ?? []
	const [optionalFeatures, feats] = await Promise.all([loadDataFile('data/optional-features.json'), loadDataFile('data/feats.json')])
	return [...extractOptionalFeatureGrantedSenses(optionalFeatures, selection), ...extractFeatGrantedSenses(feats, character)]
}
