/*
 * Which of the character's features belong in the actions table, and under what
 * name (sheet rebuild, slice 5 part A). Pure selection (D38) over data the sheet
 * already holds: the D87 resolver's granted class/subclass features, and the
 * feats the character took. Whether a feature qualifies is D86's
 * isActionTableFeature, unchanged and not re-implemented here.
 *
 * A row carries a NAME only — Range/To Hit/Damage null, Notes empty. Uses,
 * recharge and the pool a feature spends are structured well enough to select
 * on but not to print (`consumes` names a pool, never a count of uses), so
 * inventing those cells would mean parsing prose, which D21 forbids.
 *
 * Which sources are wired, from scripts/investigate-choice-option-usability.js:
 *
 * - GRANTED CLASS/SUBCLASS FEATURES — yes. 215 qualify data-wide; 72 of them
 *   only via `consumes`, which is why GrantedFeature now carries that field.
 * - FEATS — yes. 0 of the 128 feats carry `consumes` and 39 carry the rest tag,
 *   so FeatTextEntry's `entries` alone decide it, with nothing lost.
 * - The D21 class-feature choices (Divine Order, Primal Order, Elemental Fury) —
 *   nothing to wire: none of their 6 option children qualifies under either test.
 * - The optional-feature picks (Metamagic, Eldritch Invocations, Maneuvers,
 *   Arcane Shot, fighting styles) — yes, now that OptionalFeatureOption carries
 *   `consumes`. 38 of their 41 qualifying options qualify ONLY that way, which
 *   is why part A deferred this source rather than shipping the 3 invocations
 *   the rest tag reaches.
 */

import { type ActionType, classifyActionType, isActionTableFeature } from '../actions/actionTableFeatureData'
import { resolveResourceName, speciesTraitUses } from '../calculation/resources'
import { featOriginLabel, type FeatInstance } from '../featAsi/featInstances'
import type { OptionalFeatureOption } from '../optionalFeatures/optionalFeatureData'
import type { GrantedFeature } from './grantedClassFeatures'
import type { FeatTextEntry } from './sheetData'
import type { SpeciesTrait } from './speciesTraitNames'

export interface FeatureActionData {
	key: string
	name: string
	/**
	 * The resolved name computeCharacterResources would file this feature's
	 * resource under — its `consumes` pool if it has one, or (a Rage, a Second
	 * Wind) its own name resolved the same way (slice 9b2). Never a re-decision
	 * of WHICH features are resources: it names a candidate, and the caller
	 * decides whether that name is one of the 8 with a computed maximum by
	 * looking it up in computeCharacterResources' own list.
	 */
	resourceName: string
	/** Where the feature came from, as the row labels it ("Fighter 2", "Champion, Fighter 3", "Feat, level 4", "Sorcerer"); null when that is not known. */
	origin: string | null
	/** D182's R-phrase group. */
	actionType: ActionType
	/** The record's own text, for the row's expanded view. */
	entries: unknown[]
}

/** A granted class/subclass feature's origin: its class and the class level it is gained at, plus the subclass for a subclass feature. */
export function grantedFeatureOrigin(feature: Pick<GrantedFeature, 'className' | 'subclassShortName' | 'level'>): string {
	const classLevel = `${feature.className} ${feature.level}`
	return feature.subclassShortName ? `${feature.subclassShortName}, ${classLevel}` : classLevel
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** `consumes` is either a `{ name, amount? }` record or a bare string across the four feature files — the same read resources.ts's consumedPoolName does, not exported from there (D-scope: this task does not touch resources.ts). */
function consumedResourceName(feature: { name: string; consumes?: unknown }): string | null {
	const consumes = feature.consumes
	if (typeof consumes === 'string') return resolveResourceName(consumes)
	if (isRecord(consumes) && typeof consumes['name'] === 'string') return resolveResourceName(consumes['name'])
	return null
}

/**
 * The resolved name to test a feature against the character's resource list
 * under. A pool-spender (Stunning Strike, a Metamagic) is filed under its
 * `consumes` name; a SELF-limited feature (Rage, Second Wind, Favored Enemy)
 * carries no `consumes` at all and is its own resource, named after itself
 * (resources.ts's isSelfLimitedFeature, not re-run here — a passive feature's
 * own name only ever matches something in computeCharacterResources' list by
 * coincidence, which the data does not do).
 */
export function resourceCandidateName(feature: { name: string; consumes?: unknown }): string {
	return consumedResourceName(feature) ?? resolveResourceName(feature.name)
}


/**
 * Every usable feature as an actions-table entry: granted class and subclass
 * features first, in the resolver's own order (the level they were gained at,
 * then name), then the character's feats, then the options they chose from an
 * optionalfeatureProgression, in the order those were stored.
 *
 * Deduplicated by name, because the row IS the name: the data holds one record
 * per level a feature is restated at (Fighter's Action Surge at 2 and again at
 * 17), and two rows reading "Action Surge" tell the player nothing the one row
 * does not. The row keeps the first record's origin, the level it was first gained at.
 *
 * `optionOrigin` names the class or subclass an option was chosen through. It
 * carries no level: a pick made in the wizard records none (D99).
 */
export function featureActionRows(
	granted: GrantedFeature[],
	chosenFeats: readonly FeatInstance[],
	featTexts: FeatTextEntry[],
	chosenOptions: OptionalFeatureOption[],
	optionOrigin: (option: OptionalFeatureOption) => string | null = () => null,
	speciesTraits: readonly SpeciesTrait[] = [],
	speciesName: string | null = null,
): FeatureActionData[] {
	const rows: FeatureActionData[] = []
	const seen = new Set<string>()

	// D182: D86's set, plus any feature R-phrase places in Action/Bonus Action/Reaction (Cunning Action, Uncanny Dodge).
	function add(kind: 'feature' | 'feat' | 'option' | 'species',name: string, record: { name: string; consumes?: unknown; entries: unknown[] }, origin: string | null): void {
		const actionType = classifyActionType(record)
		// D186: a species trait needs an R-phrase group or a tracked use count; a bare rest mention (Trance) is not enough.
		const qualifies = kind === 'species' ? actionType !== 'other' || speciesTraitUses(record) !== null : isActionTableFeature(record) || actionType !== 'other'
		if (!qualifies) return
		const key = name.toLowerCase()
		if (seen.has(key)) return
		seen.add(key)
		rows.push({ key: `${kind}|${key}`, name, resourceName: resourceCandidateName(record), origin, actionType, entries: record.entries })
	}

	for (const feature of granted) add('feature', feature.name, feature, grantedFeatureOrigin(feature))

	for (const choice of chosenFeats) {
		// D43: a feat whose text is missing cannot be tested, so it gets no row —
		// the Feats list already says the text was not found.
		const text = featTexts.find((entry) => entry.name === choice.name && entry.source === choice.source)
		if (text) add('feat', choice.name, text, `Feat, ${featOriginLabel(choice)}`)
	}

	// Already resolved to the full option record by the caller, so — unlike a feat —
	// there is no second lookup to do: D43's no-text-no-row is applied when the pick
	// is resolved, and an unresolvable pick never reaches here.
	for (const option of chosenOptions) add('option', option.name, option, optionOrigin(option))

	// D185/D186: the caller passes only the traits the character's level has reached (speciesTraitsAtLevel).
	for (const trait of speciesTraits) add('species', trait.name, trait, speciesName)

	return rows
}
