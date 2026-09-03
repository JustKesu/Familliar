/*
 * What the sheet has to fetch and resolve before src/calculation/weaponAttacks.ts
 * can produce attack lines (build order step 7, slice c). The arithmetic and
 * the rules stay there and stay pure (D38); this file only reads data.
 *
 * Three things come out of the data files:
 *
 *   items.json          the held inventory rows, resolved to weapons
 *   classes.json        the weapon proficiency grants (via the shared
 *                       weaponProficiencyGrantsFor) and the Monk's Martial
 *                       Arts die
 *   class-features.json / subclass-features.json
 *                       the feature NAMES that carry an attack count (D70)
 *
 * The Martial Arts die is READ, not tabled: unlike the Extra Attack counts,
 * the Monk's class table has a real "Martial Arts" column whose cells are
 * `{"type":"dice","toRoll":[{"number":1,"faces":6}]}` — one row per level, four
 * distinct values (d6/d8/d10/d12). Established by
 * scripts/investigate-weapon-attack-fields.js, so D70's hand-table rule does
 * not apply here.
 */

import { isAttuned } from '../calculation/attunement'
import { resolveMagicBonus } from '../calculation/magicBonus'
import type { HeldWeapon, ResolvedWeapon } from '../calculation/weaponAttacks'
import { loadDataFile } from '../dataLoader/dataLoader'
import { buildInventoryResolver, inventoryRowKey, isWeapon, itemMagicBonusOf, type ItemRef } from '../inventory/inventoryData'
import type { Character, CharacterInventoryItem } from '../storage/character'
import {
	extractFeatWeaponProficiencyEntries,
	weaponProficiencyGrantsFor,
	type WeaponProficiencyGrant,
} from '../weapons/weaponProficiency'
import { resolveSubclassShortName } from './armourClassData'

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * The held rows of an inventory, in the shape computeWeaponAttacks takes. A
 * held row that resolves to something which is not a weapon (a Shield) is not
 * an attack and is skipped; a held row that resolves to nothing at all is kept
 * with `weapon: null` so the attack list names it (D43) rather than dropping it.
 *
 * A CUSTOM weapon (slice e2a) is skipped by that same not-a-weapon test: it
 * carries no damage dice, and dice are slice e2b's. An attack line built from
 * a definition that has none would print a to-hit and a damage figure the item
 * cannot back up, which is the one thing D76 rules out.
 */
export function buildHeldWeapons(inventory: CharacterInventoryItem[], itemRefs: ItemRef[]): HeldWeapon[] {
	const resolve = buildInventoryResolver(itemRefs)

	const held: HeldWeapon[] = []
	for (const item of inventory) {
		if (item.equipped !== 'held') continue
		const { ref } = resolve(item)
		if (ref && !isWeapon(ref)) continue
		held.push({
			key: inventoryRowKey(item),
			name: item.name,
			source: item.source,
			weapon: ref ? toResolvedWeapon(ref) : null,
			chosenAbility: item.attackAbility ?? null,
			/* Slice e. An unresolved row keeps whatever the player set on it (D43); nothing else about it can be known. */
			magicBonus: resolveMagicBonus({
				name: item.name,
				itemBonus: ref ? itemMagicBonusOf(ref) : null,
				playerBonus: item.magicBonus ?? null,
				requiresAttunement: ref?.requiresAttunement === true,
				attuned: isAttuned(item),
			}),
		})
	}
	return held
}

function toResolvedWeapon(ref: ItemRef): ResolvedWeapon {
	return {
		name: ref.name,
		source: ref.source,
		...(ref.typeCode !== undefined ? { typeCode: ref.typeCode } : {}),
		...(ref.weaponCategory !== undefined ? { weaponCategory: ref.weaponCategory } : {}),
		...(ref.dmg1 !== undefined ? { dmg1: ref.dmg1 } : {}),
		...(ref.dmg2 !== undefined ? { dmg2: ref.dmg2 } : {}),
		...(ref.dmgTypeFull !== undefined ? { dmgTypeFull: ref.dmgTypeFull } : {}),
		...(ref.propertyFull !== undefined ? { propertyFull: ref.propertyFull } : {}),
		...(ref.masteryFull !== undefined ? { masteryFull: ref.masteryFull } : {}),
		...(ref.range !== undefined ? { range: ref.range } : {}),
		...(ref.firearm !== undefined ? { firearm: ref.firearm } : {}),
	}
}

/** One cell of a class table, when it holds a die: `{"type":"dice","toRoll":[{"number":1,"faces":6}]}` -> "1d6". Null for any other cell shape. */
export function formatTableDice(cell: unknown): string | null {
	if (!isRecord(cell) || cell['type'] !== 'dice') return null
	const toRoll = cell['toRoll']
	if (!Array.isArray(toRoll) || toRoll.length === 0) return null
	const parts = toRoll.filter(isRecord).filter((roll) => typeof roll['number'] === 'number' && typeof roll['faces'] === 'number')
	if (parts.length === 0) return null
	return parts.map((roll) => `${roll['number'] as number}d${roll['faces'] as number}`).join(' + ')
}

/**
 * The Martial Arts die at the character's Monk level, or null when they have
 * no class carrying such a column. Pure; loadWeaponAttackData does the fetch.
 */
export function martialArtsDieFrom(character: Character, parsedClasses: unknown): string | null {
	if (!Array.isArray(parsedClasses)) throw new Error('classes.json: expected a top-level array.')

	for (const characterClass of character.classes) {
		const entry = parsedClasses.find(
			(candidate) =>
				isRecord(candidate) && candidate['entryType'] === 'class' && candidate['name'] === characterClass.className && candidate['source'] === characterClass.classSource,
		)
		if (!isRecord(entry) || !Array.isArray(entry['classTableGroups'])) continue

		for (const group of entry['classTableGroups']) {
			if (!isRecord(group) || !Array.isArray(group['colLabels']) || !Array.isArray(group['rows'])) continue
			const column = group['colLabels'].findIndex((label) => typeof label === 'string' && label.toLowerCase().includes('martial arts'))
			if (column === -1) continue
			const row = group['rows'][characterClass.level - 1]
			const die = Array.isArray(row) ? formatTableDice(row[column]) : null
			if (die) return die
		}
	}
	return null
}

interface RawFeature {
	name: string
	className: string
	classSource: string
	level: number
	subclassShortName?: string
	subclassSource?: string
}

function isRawFeature(value: unknown): value is RawFeature {
	return (
		isRecord(value) &&
		typeof value['name'] === 'string' &&
		typeof value['className'] === 'string' &&
		typeof value['classSource'] === 'string' &&
		typeof value['level'] === 'number'
	)
}

function asFeatureArray(parsed: unknown, file: string): RawFeature[] {
	if (!Array.isArray(parsed)) throw new Error(`${file}: expected a top-level array.`)
	return parsed.filter(isRawFeature)
}

/**
 * Every class and subclass feature the character has reached, by name.
 * Deduplicated: a name reached through two classes would otherwise be listed
 * twice in the attacks-per-action breakdown. Both files are read because Extra
 * Attack arrives as a class feature for five classes and as a SUBCLASS feature
 * for Armorer, Battle Smith, Swords, Valor and Bladesinging
 * (src/attacks/extraAttackData.ts).
 */
export function featureNamesFor(character: Character, parsedClassFeatures: unknown, parsedSubclassFeatures: unknown, parsedClasses: unknown): string[] {
	const classFeatures = asFeatureArray(parsedClassFeatures, 'class-features.json')
	const subclassFeatures = asFeatureArray(parsedSubclassFeatures, 'subclass-features.json')

	const names = new Set<string>()
	for (const characterClass of character.classes) {
		for (const feature of classFeatures) {
			if (feature.className !== characterClass.className || feature.classSource !== characterClass.classSource) continue
			if (feature.level <= characterClass.level) names.add(feature.name)
		}

		if (!characterClass.subclass) continue
		const subclass = resolveSubclassShortName(parsedClasses, characterClass.className, characterClass.classSource, characterClass.subclass)
		if (!subclass) continue
		for (const feature of subclassFeatures) {
			if (feature.className !== characterClass.className || feature.classSource !== characterClass.classSource) continue
			if (feature.subclassShortName !== subclass.shortName || feature.subclassSource !== subclass.source) continue
			if (feature.level <= characterClass.level) names.add(feature.name)
		}
	}
	return [...names]
}

export interface WeaponAttackData {
	grants: WeaponProficiencyGrant[]
	martialArtsDie: string | null
	/** Feature names, for computeAttacksPerAction. */
	featureNames: string[]
}

/** One fetch of each file the attacks section needs; the loader caches per path (D39), so classes.json is shared with the rest of the sheet. */
export async function loadWeaponAttackData(character: Character): Promise<WeaponAttackData> {
	const [classes, feats, classFeatures, subclassFeatures] = await Promise.all([
		loadDataFile('data/classes.json'),
		loadDataFile('data/feats.json'),
		loadDataFile('data/class-features.json'),
		loadDataFile('data/subclass-features.json'),
	])
	return {
		grants: weaponProficiencyGrantsFor(character, classes, extractFeatWeaponProficiencyEntries(feats)),
		martialArtsDie: martialArtsDieFrom(character, classes),
		featureNames: featureNamesFor(character, classFeatures, subclassFeatures, classes),
	}
}
