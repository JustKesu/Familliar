/*
 * What the sheet has to fetch and resolve before
 * src/calculation/damageResponses.ts can produce the character's damage
 * responses (build order step 7, slice f). The collapsing and the precedence
 * rule stay there and stay pure (D38); this file only reads data.
 *
 * Four sources, which is the whole list this slice covers:
 *
 *   items.json                   `resist` / `immune` on a carried item
 *   species.json                 `resist` on the species entry
 *   feats.json                   `resist` on a chosen feat
 *   class-/subclass-features.json  the D70 hand table
 *                                (src/damageResponses/featureDamageResponses.ts)
 *
 * backgrounds.json carries nothing: all 33 were checked and none has any of
 * the three keys (scripts/investigate-damage-responses.js).
 *
 * ITEMS ARE GATED ON ATTUNEMENT, and on nothing else: an item that requires
 * attunement grants its resistance only while attuned, read through slice d's
 * plain `isAttuned` rather than a second copy of the rule. An item that does
 * not require attunement grants it while carried — there is no "equipped"
 * concept for a cloak or a tattoo in this app (equipSlotOf covers armour,
 * shields and weapons only).
 */

import { isAttuned } from '../calculation/attunement'
import type { DamageResponseGrant } from '../calculation/damageResponses'
import { featureDamageResponsesAmong } from '../damageResponses/featureDamageResponses'
import { loadDataFile } from '../dataLoader/dataLoader'
import { isConsumable, itemKey, type ItemRef } from '../inventory/inventoryData'
import { magicItemLabel } from '../calculation/magicBonus'
import type { Character, CharacterInventoryItem } from '../storage/character'
import { featureNamesFor } from './weaponAttackData'

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * `resist`/`immune` as the data writes them, split into the plain damage types
 * and the one choice shape. The survey found exactly two element shapes, so an
 * element that is neither is dropped rather than guessed at.
 */
function readResponseField(value: unknown): { types: string[]; choices: string[][] } {
	const types: string[] = []
	const choices: string[][] = []
	if (!Array.isArray(value)) return { types, choices }
	for (const element of value) {
		if (typeof element === 'string') {
			types.push(element)
			continue
		}
		if (!isRecord(element)) continue
		const choose = element['choose']
		if (!isRecord(choose)) continue
		const from = choose['from']
		if (Array.isArray(from)) choices.push(from.filter((item): item is string => typeof item === 'string'))
	}
	return { types, choices }
}

/** One source's `resist` and `immune` fields, turned into grants. `sourceName` is what the sheet shows. */
function grantsFromEntry(entry: Record<string, unknown>, sourceName: string): DamageResponseGrant[] {
	const grants: DamageResponseGrant[] = []
	for (const [key, kind] of [
		['resist', 'resistance'],
		['immune', 'immunity'],
	] as const) {
		const { types, choices } = readResponseField(entry[key])
		if (types.length > 0) grants.push({ kind, sourceName, damageTypes: types })
		for (const choiceFrom of choices) {
			if (choiceFrom.length > 0) grants.push({ kind, sourceName, damageTypes: [], choiceFrom })
		}
	}
	return grants
}

/**
 * The carried items' grants. A consumable's resistance never enters the applied
 * set from being carried — it applies only while the item is used, and using
 * items is step 9 (D76: shown as a considered candidate with the reason). An
 * item requiring attunement contributes only while attuned (same D76 treatment).
 * A row absent from items.json cannot be known to grant anything, so it is named
 * with the problem stated rather than silently skipped (D43).
 *
 * The consumable check runs before the attunement one because it is the primary
 * reason a potion grants nothing; no consumable in the data requires attunement
 * anyway (scripts/investigate-consumable-resist.js), so the order never decides
 * an outcome.
 */
export function buildItemGrants(inventory: readonly CharacterInventoryItem[], itemRefs: readonly ItemRef[]): DamageResponseGrant[] {
	const byKey = new Map(itemRefs.map((ref) => [itemKey(ref), ref]))
	const grants: DamageResponseGrant[] = []

	for (const item of inventory) {
		const ref = byKey.get(itemKey(item))
		if (!ref) {
			grants.push({
				kind: 'resistance',
				sourceName: magicItemLabel(item.name, item.magicBonus ?? 0),
				damageTypes: [],
				unresolvedReason: `not found in the item data (${item.source}) — any resistance it grants is not counted`,
			})
			continue
		}
		if (ref.resist === undefined && ref.immune === undefined) continue

		const label = magicItemLabel(ref.name, item.magicBonus ?? 0)
		if (isConsumable(ref)) {
			grants.push({
				kind: 'resistance',
				sourceName: label,
				damageTypes: [],
				withheldReason: 'applies only while the item is used, and using items arrives in step 9',
			})
			continue
		}
		if (ref.requiresAttunement === true && !isAttuned(item)) {
			grants.push({
				kind: 'resistance',
				sourceName: label,
				damageTypes: [],
				withheldReason: 'requires attunement and you are not attuned to it',
			})
			continue
		}
		grants.push(...grantsFromEntry({ resist: ref.resist, immune: ref.immune }, label))
	}
	return grants
}

/**
 * The species' own grant. Matched by name + source exactly, the same lookup
 * speciesTraits.ts uses. No parent fallback is needed: the three Genasi
 * variants that carry `resist` carry it themselves, and the concrete
 * ancestries are their own top-level entries — "Dragonborn (Red)" resolves to
 * `["fire"]`, while the bare "Dragonborn" entry is the `{choose}` shape and
 * becomes an unmade choice.
 */
export function buildSpeciesGrants(character: Character, parsedSpecies: unknown): DamageResponseGrant[] {
	if (!character.species) return []
	if (!Array.isArray(parsedSpecies)) throw new Error('species.json: expected a top-level array.')

	const entry = parsedSpecies.find((candidate) => isRecord(candidate) && candidate['name'] === character.species?.name && candidate['source'] === character.species?.source)
	if (!isRecord(entry)) {
		return [
			{
				kind: 'resistance',
				sourceName: character.species.name,
				damageTypes: [],
				unresolvedReason: `no species data for "${character.species.name}" (${character.species.source})`,
			},
		]
	}
	return grantsFromEntry(entry, character.species.name)
}

/** The chosen feats' grants. Only Boon of Energy Resistance carries the field, and it carries the choice shape. */
export function buildFeatGrants(character: Character, parsedFeats: unknown): DamageResponseGrant[] {
	const chosen = (character.featAsiChoices ?? []).filter((choice) => choice.kind === 'feat')
	if (chosen.length === 0) return []
	if (!Array.isArray(parsedFeats)) throw new Error('feats.json: expected a top-level array.')

	const grants: DamageResponseGrant[] = []
	for (const choice of chosen) {
		const entry = parsedFeats.find((candidate) => isRecord(candidate) && candidate['name'] === choice.name && candidate['source'] === choice.source)
		if (!isRecord(entry)) {
			grants.push({ kind: 'resistance', sourceName: choice.name, damageTypes: [], unresolvedReason: `no feat data for "${choice.name}" (${choice.source})` })
			continue
		}
		grants.push(...grantsFromEntry(entry, choice.name))
	}
	return grants
}

/** The D70 table's grants, for the class and subclass features the character has reached. */
export function buildFeatureGrants(featureNames: readonly string[]): DamageResponseGrant[] {
	return featureDamageResponsesAmong(featureNames).map((entry) => ({
		kind: entry.kind,
		sourceName: `${entry.feature} (${entry.origin})`,
		damageTypes: entry.damageTypes,
		...(entry.condition !== undefined ? { condition: entry.condition } : {}),
	}))
}

/** Everything but the items — those need itemRefs, which the sheet already holds for the inventory section. */
export interface DamageResponseData {
	speciesGrants: DamageResponseGrant[]
	featGrants: DamageResponseGrant[]
	featureGrants: DamageResponseGrant[]
}

export async function loadDamageResponseData(character: Character): Promise<DamageResponseData> {
	const [species, feats, classFeatures, subclassFeatures, classes] = await Promise.all([
		loadDataFile('data/species.json'),
		loadDataFile('data/feats.json'),
		loadDataFile('data/class-features.json'),
		loadDataFile('data/subclass-features.json'),
		loadDataFile('data/classes.json'),
	])
	return {
		speciesGrants: buildSpeciesGrants(character, species),
		featGrants: buildFeatGrants(character, feats),
		featureGrants: buildFeatureGrants(featureNamesFor(character, classFeatures, subclassFeatures, classes)),
	}
}
