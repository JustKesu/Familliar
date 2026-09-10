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

import { isActionTableFeature } from '../actions/actionTableFeatureData'
import type { OptionalFeatureOption } from '../optionalFeatures/optionalFeatureData'
import type { GrantedFeature } from './grantedClassFeatures'
import type { FeatTextEntry } from './sheetData'

export interface FeatureActionData {
	key: string
	name: string
}

/** A feat the character took, as `character.featAsiChoices` records it. */
export interface ChosenFeatRef {
	name: string
	source: string
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
 * does not.
 */
export function featureActionRows(
	granted: GrantedFeature[],
	chosenFeats: ChosenFeatRef[],
	featTexts: FeatTextEntry[],
	chosenOptions: OptionalFeatureOption[],
): FeatureActionData[] {
	const rows: FeatureActionData[] = []
	const seen = new Set<string>()

	function add(kind: 'feature' | 'feat' | 'option', name: string): void {
		const key = name.toLowerCase()
		if (seen.has(key)) return
		seen.add(key)
		rows.push({ key: `${kind}|${key}`, name })
	}

	for (const feature of granted) {
		if (isActionTableFeature(feature)) add('feature', feature.name)
	}

	for (const choice of chosenFeats) {
		// D43: a feat whose text is missing cannot be tested, so it gets no row —
		// the Feats list already says the text was not found.
		const text = featTexts.find((entry) => entry.name === choice.name && entry.source === choice.source)
		if (text && isActionTableFeature(text)) add('feat', choice.name)
	}

	// Already resolved to the full option record by the caller, so — unlike a feat —
	// there is no second lookup to do: D43's no-text-no-row is applied when the pick
	// is resolved, and an unresolvable pick never reaches here.
	for (const option of chosenOptions) {
		if (isActionTableFeature(option)) add('option', option.name)
	}

	return rows
}
