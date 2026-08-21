/*
 * Optional-feature filter-choice spell data layer (build order step 6a — the
 * Pact of the Tome picker). Sits to optionalFeatureSpells.ts exactly as
 * subclassSpellChoiceData.ts (d6b) sits to subclassPreparedSpells.ts: the
 * FIXED grants live in the other module, the player-CHOSEN ones here.
 *
 * Shape confirmed by scripts/investigate-pact-of-the-tome.js (D46) before
 * anything was written:
 *
 *   [{ "ability": "cha",
 *      "known":    { "_": [{ "choose": "level=0", "count": 3 }] },
 *      "prepared": { "_": [{ "choose": "level=1|components & miscellaneous=ritual", "count": 2 }] } }]
 *
 * - Counts come from the DATA (3 and 2) and happen to agree with the 2024
 *   rules text, so nothing is hardcoded here the way Ritual Caster's
 *   proficiency-bonus count had to be.
 * - The cantrip node carries NO class clause — a bare `"level=0"`, i.e. any
 *   cantrip from any class's list. That is the one thing
 *   featSpellChoiceData.ts's mini-language parser could not express, so
 *   `parseChooseString` was generalized in place (filter clause now optional,
 *   yielding the new `{kind:'any'}` filter) rather than a second parser being
 *   written. Pact of the Tome is the only bare `level=` node in feats.json,
 *   classes.json or optional-features.json, so that generalization cannot
 *   change how any existing feat or subclass parses.
 * - `ability` is "cha", the Warlock's own spellcasting ability (EI is
 *   Warlock-only), so as with every other invocation grant these spells are
 *   cast with the class's existing entry and no new spellcasting entry
 *   appears — see optionalFeatureSpells.ts's module comment.
 *
 * The `count` special case in featSpellChoiceData.ts's own parseChooseNode
 * (ritual slots get `count: null`, because Ritual Caster's count is derived
 * from proficiency bonus) deliberately is NOT reused: Pact of the Tome's
 * ritual node states `count: 2` explicitly and that number is honoured.
 */

import { loadDataFile } from '../dataLoader/dataLoader'
import { findChooseNodes, offeredSpellsForSlot, parseChooseString, type FilterChoiceCandidateSpell, type SpellChoiceFilter } from './featSpellChoiceData'

/** One pick-N-spells slot an option offers. `count` always comes from the node's own `count` (defaulting to 1), never from a table. */
export interface OptionalFeatureSpellChoiceSlot {
	levels: number[]
	filter: SpellChoiceFilter
	count: number
}

export interface OptionalFeatureSpellChoiceShape {
	/** From `known` — Pact of the Tome's 3 cantrips. Null when the option offers no cantrip choice. */
	cantripSlot: OptionalFeatureSpellChoiceSlot | null
	/** From `innate`/`prepared` — Pact of the Tome's 2 level-1 rituals. Null when the option offers no leveled-spell choice. */
	spellSlot: OptionalFeatureSpellChoiceSlot | null
}

const EMPTY_SHAPE: OptionalFeatureSpellChoiceShape = { cantripSlot: null, spellSlot: null }

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

interface RawOptionalFeatureEntry {
	name: string
	source: string
	featureType?: unknown
	additionalSpells?: unknown
}

function isRawOptionalFeatureEntry(value: unknown): value is RawOptionalFeatureEntry {
	return isRecord(value) && typeof value['name'] === 'string' && typeof value['source'] === 'string'
}

function slotFrom(node: { choose: string; count?: number } | undefined): OptionalFeatureSpellChoiceSlot | null {
	if (!node) return null
	const parsed = parseChooseString(node.choose)
	if (!parsed) return null // mini-language didn't parse — skip cleanly (D43), the option simply offers no choice.
	return { levels: parsed.levels, filter: parsed.filter, count: node.count ?? 1 }
}

/**
 * Pure filter (D38). The choice slots one named option offers, both null when
 * the option isn't found, carries no `additionalSpells`, or grants only
 * literal spells (every invocation except Pact of the Tome — those are
 * derived grants, handled by optionalFeatureSpells.ts instead).
 *
 * The option is matched on name AND featureType, the same scoping
 * optionalFeatureSpells.ts uses, so a pick stored under one progression can
 * never resolve against another's option list.
 */
export function optionalFeatureSpellChoiceShape(
	parsedOptionalFeatures: unknown,
	optionName: string,
	featureType: string,
): OptionalFeatureSpellChoiceShape {
	if (!Array.isArray(parsedOptionalFeatures)) {
		throw new Error('optional-features.json: expected a top-level array.')
	}
	const option = parsedOptionalFeatures
		.filter(isRawOptionalFeatureEntry)
		.find(
			(candidate) =>
				candidate.name.toLowerCase() === optionName.toLowerCase() && Array.isArray(candidate.featureType) && candidate.featureType.includes(featureType),
		)
	const block = option && Array.isArray(option.additionalSpells) ? option.additionalSpells[0] : undefined
	if (!isRecord(block)) return EMPTY_SHAPE

	const cantripNode = findChooseNodes(block['known'])[0]
	const spellNode = findChooseNodes(block['innate'])[0] ?? findChooseNodes(block['prepared'])[0]

	return { cantripSlot: slotFrom(cantripNode), spellSlot: slotFrom(spellNode) }
}

/** Whether an option offers any spell choice at all — the picker's "show the sub-picker" test. */
export function offersSpellChoice(shape: OptionalFeatureSpellChoiceShape): boolean {
	return shape.cantripSlot !== null || shape.spellSlot !== null
}

/** The exact counts a completed pick for this option must have. */
export function requiredSpellChoiceCounts(shape: OptionalFeatureSpellChoiceShape): { cantrips: number; spells: number } {
	return { cantrips: shape.cantripSlot?.count ?? 0, spells: shape.spellSlot?.count ?? 0 }
}

export async function loadOptionalFeatureSpellChoiceShape(optionName: string, featureType: string): Promise<OptionalFeatureSpellChoiceShape> {
	const parsed = await loadDataFile('data/optional-features.json')
	return optionalFeatureSpellChoiceShape(parsed, optionName, featureType)
}

/** The candidate list for one slot — `offeredSpellsForSlot` unchanged, so class/school/ritual/any filters all behave as they do for feats and subclasses. */
export async function loadOptionalFeatureSlotCandidates(slot: OptionalFeatureSpellChoiceSlot): Promise<FilterChoiceCandidateSpell[]> {
	const parsed = await loadDataFile('data/spells.json')
	return offeredSpellsForSlot(parsed, slot)
}
