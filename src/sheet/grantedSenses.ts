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

import { featInstances, loadBackgroundOriginFeat, type FeatRef } from '../featAsi/featInstances'
import { choiceNames, type Character, type CharacterOptionalFeatureChoice } from '../storage/character'
import { isRecord } from '../spells/subclassPreparedSpells'
import { loadDataFile } from '../dataLoader/dataLoader'
import { hasSubclassBySource } from '../calculation/featureGrants'

export interface GrantedSense {
	/** The sense's own key in the data — "blindsight", "darkvision", "truesight", "tremorsense", whatever occurs. Not narrowed to a fixed union: display only, no calculation branches on this beyond the label. */
	senseType: string
	/** Range in feet, as the data states it. */
	range: number
	/** Provenance kind — a chosen optional feature ("from invocation (Name)"), a chosen feat ("from feat (Name)") or a class/subclass feature ("from class feature (Name)", D195). */
	origin: 'optionalFeature' | 'feat' | 'classFeature'
	/** The option's, feat's or feature's own name — the "(...)" part of the provenance label. */
	name: string
	/** D195: darkvision that adds to the character's other darkvision (see speciesTraits.ts's GrantedDarkvision). */
	additive?: true
}

interface ClassSenseGrant {
	className: string
	/** Base class features are keyed by class level; subclass ones go through hasSubclassBySource (level 3, D176). */
	level?: number
	subclass?: { name: string; source: string }
	name: string
	senses: { senseType: string; range: number; additive?: true }[]
}

// D195: class and subclass senses exist only in feature text (scripts confirmed the five), so they are a hand table like FEATURE_GRANTS.
const CLASS_SENSE_GRANTS: ClassSenseGrant[] = [
	{ className: 'Ranger', level: 18, name: 'Feral Senses', senses: [{ senseType: 'blindsight', range: 30 }] },
	{ className: 'Cleric', subclass: { name: 'Twilight Domain', source: 'TCE' }, name: 'Eyes of Night', senses: [{ senseType: 'darkvision', range: 300 }] },
	{
		className: 'Sorcerer',
		subclass: { name: 'Shadow Sorcery', source: 'RHW' },
		name: 'Eyes of the Dark',
		senses: [
			{ senseType: 'darkvision', range: 120 },
			{ senseType: 'blindsight', range: 10 },
		],
	},
	{ className: 'Monk', subclass: { name: 'Warrior of Shadow', source: 'XPHB' }, name: 'Shadow Arts', senses: [{ senseType: 'darkvision', range: 60, additive: true }] },
	{ className: 'Ranger', subclass: { name: 'Gloom Stalker', source: 'XPHB' }, name: 'Umbral Sight', senses: [{ senseType: 'darkvision', range: 60, additive: true }] },
]

/** Pure filter (D38). The senses the character's class and subclass features grant (D195). */
export function extractClassFeatureGrantedSenses(character: Character, parsedClasses: unknown): GrantedSense[] {
	return CLASS_SENSE_GRANTS.filter((grant) =>
		grant.subclass
			? hasSubclassBySource(character, parsedClasses, grant.className, grant.subclass.name, grant.subclass.source)
			: character.classes.some((cls) => cls.className === grant.className && cls.classSource === 'XPHB' && cls.level >= (grant.level ?? 1)),
	).flatMap((grant) => grant.senses.map((sense) => ({ ...sense, origin: 'classFeature' as const, name: grant.name })))
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
		for (const chosenName of choiceNames(stored.choices)) {
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

/** Pure filter (D38). The senses a character's feats (featInstances, D156) grant — Blind Fighting, Boon of Truesight, Skulker, matched by (name, source) the same way featSpells.ts's extractFixedFeatSpells matches a feat entry. */
export function extractFeatGrantedSenses(parsedFeats: unknown, character: Character, backgroundOriginFeat: FeatRef | null): GrantedSense[] {
	if (!Array.isArray(parsedFeats)) {
		throw new Error('feats.json: expected a top-level array.')
	}
	const entries = parsedFeats.filter(isRawFeatSenseEntry)
	const result: GrantedSense[] = []

	for (const choice of featInstances(character, backgroundOriginFeat)) {
		const feat = entries.find((candidate) => candidate.name === choice.name && candidate.source === choice.source)
		if (!feat) continue
		for (const { senseType, range } of parseSenses(feat.senses)) {
			result.push({ senseType, range, origin: 'feat', name: feat.name })
		}
	}

	return result
}

/** Fetches optional-features.json, feats.json and classes.json through the shared cache (D39) and returns every source's granted senses, unmerged — merging same-type grants into one row is SensesList.tsx's job, the same split combineSpellEntries/SpellList.tsx already has. */
export async function loadGrantedSenses(character: Character): Promise<GrantedSense[]> {
	const selection = character.optionalFeatureChoices ?? []
	const [optionalFeatures, feats, classes, backgroundOriginFeat] = await Promise.all([
		loadDataFile('data/optional-features.json'),
		loadDataFile('data/feats.json'),
		loadDataFile('data/classes.json'),
		loadBackgroundOriginFeat(character.background),
	])
	return [
		...extractOptionalFeatureGrantedSenses(optionalFeatures, selection),
		...extractFeatGrantedSenses(feats, character, backgroundOriginFeat),
		...extractClassFeatureGrantedSenses(character, classes),
	]
}
