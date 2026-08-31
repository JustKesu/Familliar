/*
 * The two things the sheet has to work out before it can ask for an Armour
 * Class (build order step 7, slice b): which alternative formulas the
 * character is eligible for, and what their equipped rows resolve to in the
 * item data. The formulas and the arithmetic themselves live in
 * src/calculation/armourClass.ts, which stays pure (D38) and is handed both.
 *
 * Each formula is a feature the character HAS, or a spell in their list.
 * scripts/investigate-armour-class.js established what the data carries:
 *
 *   class-features.json      "Unarmored Defense"  Barbarian/XPHB 1, Monk/XPHB 1
 *   subclass-features.json   "Draconic Resilience"  Sorcerer/XPHB, Draconic/XPHB 3
 *   subclass-features.json   "Unarmored Defense"    Bard/XPHB, Dance/XPHB 3
 *   spells.json              "Mage Armor"           one entry, XPHB
 *
 * The formula each one sets is in its PROSE, not in a field, so which ability
 * scores it adds is written out in AC_FORMULAS rather than parsed. What is
 * read from the data here is only whether the character has the feature at
 * their level — the same split expertiseData.ts uses.
 *
 * Character.classes[].subclass stores the subclass's NAME ("Draconic
 * Sorcery"), while subclass-features.json keys on its shortName
 * ("Draconic"), so classes.json is read to join the two. An ambiguous name
 * resolves to nothing rather than guessing, the same rule sheetData.ts's
 * resolveSubclassSource follows.
 */

import type { AcFormulaKey, EquippedGear } from '../calculation/armourClass'
import { loadDataFile } from '../dataLoader/dataLoader'
import { armourCategoryOf, isShield, itemKey, type ItemRef } from '../inventory/inventoryData'
import type { Character, CharacterInventoryItem } from '../storage/character'

interface FeatureSource {
	key: AcFormulaKey
	featureName: string
	className: string
	/** null for a class feature; the subclass's shortName for a subclass feature. */
	subclassShortName: string | null
}

const AC_FEATURE_SOURCES: readonly FeatureSource[] = [
	{ key: 'barbarian-unarmored-defense', featureName: 'Unarmored Defense', className: 'Barbarian', subclassShortName: null },
	{ key: 'monk-unarmored-defense', featureName: 'Unarmored Defense', className: 'Monk', subclassShortName: null },
	{ key: 'draconic-resilience', featureName: 'Draconic Resilience', className: 'Sorcerer', subclassShortName: 'Draconic' },
	{ key: 'dance-unarmored-defense', featureName: 'Unarmored Defense', className: 'Bard', subclassShortName: 'Dance' },
]

/** The only spell in the data that sets an AC formula; one entry, so the source is not needed to disambiguate. */
const MAGE_ARMOR = 'Mage Armor'

/** True when Mage Armor is in the character's spell list, however it got there — same test hasFindFamiliar (beastData.ts) makes for its own spell. */
export function hasMageArmor(spells: { name: string }[]): boolean {
	return spells.some((spell) => spell.name === MAGE_ARMOR)
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
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

/** The stored subclass NAME resolved to the shortName + source its features are filed under, or null when the data does not answer unambiguously. */
function resolveSubclassShortName(parsedClasses: unknown, className: string, classSource: string, subclassName: string): { shortName: string; source: string } | null {
	if (!Array.isArray(parsedClasses)) throw new Error('classes.json: expected a top-level array.')
	const candidates = parsedClasses.filter(
		(entry) =>
			isRecord(entry) &&
			entry['entryType'] === 'subclass' &&
			entry['name'] === subclassName &&
			entry['className'] === className &&
			entry['classSource'] === classSource &&
			typeof entry['shortName'] === 'string' &&
			typeof entry['source'] === 'string',
	) as Record<string, unknown>[]
	if (candidates.length !== 1) return null
	return { shortName: candidates[0]['shortName'] as string, source: candidates[0]['source'] as string }
}

/** Pure (testable without a fetch); loadAcFormulaKeys is the fetching wrapper. */
export function acFormulaKeysFrom(
	character: Character,
	parsedClassFeatures: unknown,
	parsedSubclassFeatures: unknown,
	parsedClasses: unknown,
	knowsMageArmor: boolean,
): AcFormulaKey[] {
	const classFeatures = asFeatureArray(parsedClassFeatures, 'class-features.json')
	const subclassFeatures = asFeatureArray(parsedSubclassFeatures, 'subclass-features.json')

	const keys: AcFormulaKey[] = []
	for (const entry of AC_FEATURE_SOURCES) {
		const matched = character.classes.some((characterClass) => {
			if (characterClass.className !== entry.className) return false

			if (entry.subclassShortName === null) {
				return classFeatures.some(
					(feature) =>
						feature.name === entry.featureName &&
						feature.className === characterClass.className &&
						feature.classSource === characterClass.classSource &&
						feature.level <= characterClass.level,
				)
			}

			if (!characterClass.subclass) return false
			const subclass = resolveSubclassShortName(parsedClasses, characterClass.className, characterClass.classSource, characterClass.subclass)
			if (!subclass || subclass.shortName !== entry.subclassShortName) return false
			return subclassFeatures.some(
				(feature) =>
					feature.name === entry.featureName &&
					feature.className === characterClass.className &&
					feature.classSource === characterClass.classSource &&
					feature.subclassShortName === subclass.shortName &&
					feature.subclassSource === subclass.source &&
					feature.level <= characterClass.level,
			)
		})
		if (matched) keys.push(entry.key)
	}

	if (knowsMageArmor) keys.push('mage-armor')
	return keys
}

export async function loadAcFormulaKeys(character: Character, knowsMageArmor: boolean): Promise<AcFormulaKey[]> {
	const [classFeatures, subclassFeatures, classes] = await Promise.all([
		loadDataFile('data/class-features.json'),
		loadDataFile('data/subclass-features.json'),
		loadDataFile('data/classes.json'),
	])
	return acFormulaKeysFrom(character, classFeatures, subclassFeatures, classes, knowsMageArmor)
}

/**
 * The equipped rows of an inventory, resolved against the loaded item list
 * into the shape computeArmourClass takes. A row whose (name, source) is not
 * in the item list is reported as unresolved rather than dropped (D43); armour
 * the character owns but is not wearing is named too, so "10 + Dex" carries
 * its own explanation.
 *
 * At most one worn suit and one shield are used: the sheet's equip control
 * already refuses to leave two, and a hand-edited import taking the first is
 * better than an Armour Class that adds both.
 */
export function buildEquippedGear(inventory: CharacterInventoryItem[], itemRefs: ItemRef[]): EquippedGear {
	const byKey = new Map(itemRefs.map((ref) => [itemKey(ref), ref]))

	const gear: EquippedGear = { armour: null, shield: null, unresolved: [], carriedArmourNotWorn: [] }
	for (const item of inventory) {
		const ref = byKey.get(itemKey(item))
		if (!ref) {
			if (item.equipped) gear.unresolved.push({ name: item.name, source: item.source })
			continue
		}

		const category = armourCategoryOf(ref)
		if (category !== null && item.equipped !== 'worn') {
			gear.carriedArmourNotWorn.push(ref.name)
			continue
		}
		if (!item.equipped) continue

		if (category !== null && gear.armour === null) {
			const strength = ref.strength === undefined ? Number.NaN : Number.parseInt(ref.strength, 10)
			gear.armour = {
				name: ref.name,
				category,
				ac: ref.ac ?? 0,
				strengthRequirement: Number.isFinite(strength) ? strength : null,
				stealthDisadvantage: ref.stealth === true,
			}
		} else if (isShield(ref) && gear.shield === null) {
			// DATA.md: a shield's `ac` is the bonus it adds (always 2), never a total.
			gear.shield = { name: ref.name, acBonus: ref.ac ?? 0 }
		}
	}
	return gear
}
