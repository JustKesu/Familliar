/*
 * Typed loader for the weapon-mastery slice: how many masteries a class may
 * choose, and which weapons carry a mastery property.
 *
 * Per docs/REPORT2.md's investigation, "Weapon Mastery" is a class feature
 * on five classes (Barbarian, Fighter, Paladin, Ranger, Rogue), but only
 * Barbarian and Fighter have a classTableGroups column giving the count per
 * level — the other three state it only in feature prose. Those three now
 * come from PROSE_MASTERY_COUNTS below (D70), consulted only when the class
 * has no table column; the column still wins wherever it exists.
 *
 * The mastery property descriptions (Cleave, Graze, Nick, Push, Sap, Slow,
 * Topple, Vex) are not present in data/items.json — only the resolved name
 * (masteryFull) is. The rule text lives in items-base.json's itemMastery
 * table in data-source/, which extraction does not currently carry into
 * data/. Rather than extend extraction for this slice, the text is
 * hardcoded below, the same way armour AC's Dex-cap rule is hardcoded per
 * DATA.md's "Armour AC" trap — these are fixed 2024 PHB rules, not
 * per-character data.
 */

import { loadDataFile } from '../dataLoader/dataLoader'
import type { Character } from '../storage/character'
import {
	extractFeatWeaponProficiencyEntries,
	isProficientWithWeapon,
	weaponProficiencyGrantsForClass,
	weaponProficiencyGrantsForFeats,
	type FeatWeaponProficiencyEntry,
} from '../weapons/weaponProficiency'

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Rule text for each mastery property, from the 2024 PHB (XPHB) via items-base.json's itemMastery table. */
export const MASTERY_DESCRIPTIONS: Record<string, string> = {
	Cleave:
		"If you hit a creature with a melee attack roll using this weapon, you can make a melee attack roll with the weapon against a second creature within 5 feet of the first that is also within your reach. On a hit, the second creature takes the weapon's damage, but don't add your ability modifier to that damage unless that modifier is negative. You can make this extra attack only once per turn.",
	Graze:
		'If your attack roll with this weapon misses a creature, you can deal damage to that creature equal to the ability modifier you used to make the attack roll. This damage is the same type dealt by the weapon, and the damage can be increased only by increasing the ability modifier.',
	Nick: 'When you make the extra attack of the Light property, you can make it as part of the Attack action instead of as a Bonus Action. You can make this extra attack only once per turn.',
	Push: 'If you hit a creature with this weapon, you can push the creature up to 10 feet straight away from yourself if it is Large or smaller.',
	Sap: "If you hit a creature with this weapon, that creature has Disadvantage on its next attack roll before the start of your next turn.",
	Slow: "If you hit a creature with this weapon and deal damage to it, you can reduce its Speed by 10 feet until the start of your next turn. If the creature is hit more than once by weapons that have this property, the Speed reduction doesn't exceed 10 feet.",
	Topple:
		'If you hit a creature with this weapon, you can force the creature to make a Constitution saving throw (DC 8 plus the ability modifier used to make the attack roll and your Proficiency Bonus). On a failed save, the creature has the Prone condition.',
	Vex: 'If you hit a creature with this weapon and deal damage to the creature, you have Advantage on your next attack roll against that creature before the end of your next turn.',
}

interface RawClass {
	entryType?: string
	name: string
	source: string
	classTableGroups?: { colLabels?: unknown[]; rows?: unknown[][] }[]
}

function isRawClass(value: unknown): value is RawClass {
	if (!isRecord(value)) return false
	return typeof value['name'] === 'string' && typeof value['source'] === 'string'
}

function findClass(parsedClasses: unknown, className: string, classSource: string): RawClass | undefined {
	if (!Array.isArray(parsedClasses)) {
		throw new Error('classes.json: expected a top-level array.')
	}
	return parsedClasses.find(
		(candidate) =>
			isRawClass(candidate) &&
			candidate.entryType === 'class' &&
			candidate.name === className &&
			candidate.source === classSource,
	) as RawClass | undefined
}

/*
 * D70 hand table. Paladin, Ranger and Rogue grant Weapon Mastery at level 1
 * but carry no "Weapon Mastery" table column, so the number is only in the
 * feature's own sentence — quoted here, PHB 2024 (XPHB) via
 * scripts/investigate-d70-prose-counts.js:
 *
 *  Paladin: "Your training with weapons allows you to use the weapon mastery
 *    properties of two kinds of weapons of your choice with which you have
 *    proficiency, such as Longsword and Javelin."
 *  Ranger:  "…of two kinds of weapons of your choice with which you have
 *    proficiency, such as Longbow and Shortsword."
 *  Rogue:   "…of two kinds of weapons of your choice with which you have
 *    proficiency, such as Dagger and Shortbow."
 *
 * The count never rises for these three — unlike Barbarian's and Fighter's
 * table columns, no later class or subclass feature changes the NUMBER of
 * mastery weapons (the same script checked all of them; the two that mention
 * mastery, Fighter's Tactical Master and Barbarian's Battering Roots, change
 * WHICH property applies). Hence one count per class, not a per-level row.
 */
const PROSE_MASTERY_COUNTS: Record<string, { fromLevel: number; count: number }> = {
	'Paladin|XPHB': { fromLevel: 1, count: 2 },
	'Ranger|XPHB': { fromLevel: 1, count: 2 },
	'Rogue|XPHB': { fromLevel: 1, count: 2 },
}

/**
 * How many weapon masteries the class may choose at `level`: the class's own
 * "Weapon Mastery" classTableGroups column where it has one (Barbarian,
 * Fighter), otherwise PROSE_MASTERY_COUNTS. Null when the class grants no
 * mastery choice at all, when it isn't in the supplied data, or when the level
 * is below the one that grants the feature.
 */
export function masteryCountFor(parsedClasses: unknown, className: string, classSource: string, level: number): number | null {
	const cls = findClass(parsedClasses, className, classSource)
	if (!cls) return null

	for (const group of cls.classTableGroups ?? []) {
		const labels = group.colLabels ?? []
		const colIndex = labels.findIndex((label) => label === 'Weapon Mastery')
		if (colIndex === -1) continue
		const rows = group.rows ?? []
		const row = rows[level - 1]
		if (!row) return null
		const raw = row[colIndex]
		const count = typeof raw === 'string' ? Number.parseInt(raw, 10) : NaN
		return Number.isNaN(count) ? null : count
	}

	const prose = PROSE_MASTERY_COUNTS[`${className}|${classSource}`]
	return prose && level >= prose.fromLevel ? prose.count : null
}

export interface MasteryWeapon {
	name: string
	source: string
	masteryFull: string
}

interface RawItem {
	name?: unknown
	source?: unknown
	mastery?: unknown
	masteryFull?: unknown
	weaponCategory?: unknown
	rarity?: unknown
}

function isRawItemWithMastery(
	value: unknown,
): value is RawItem & { name: string; source: string; masteryFull: string[]; rarity: string } {
	if (!isRecord(value)) return false
	return (
		typeof value['name'] === 'string' &&
		typeof value['source'] === 'string' &&
		typeof value['rarity'] === 'string' &&
		Array.isArray(value['masteryFull']) &&
		value['masteryFull'].every((m) => typeof m === 'string')
	)
}

/**
 * The weapons a class may pick weapon masteries from: every mastery-bearing
 * item the class is actually proficient with. The feature grants mastery
 * only in weapons "with which you have proficiency" (quoted in
 * PROSE_MASTERY_COUNTS above), so the pool is the shared weapon-proficiency
 * answer, not every mastery weapon in the data.
 *
 * Includes feat-granted proficiency (Martial Weapon Training, Gunner) when the
 * caller passes the character's feat/ASI choices plus the feats.json slice —
 * both default to empty, so a class-only call is unchanged. The grant reading
 * is the shared weaponProficiency.ts functions, not re-done here.
 */
export function masteryWeaponsFor(
	parsedItems: unknown,
	parsedClasses: unknown,
	className: string,
	classSource: string,
	featAsiChoices: Character['featAsiChoices'] = [],
	feats: FeatWeaponProficiencyEntry[] = [],
): MasteryWeapon[] {
	if (!Array.isArray(parsedItems)) {
		throw new Error('items.json: expected a top-level array.')
	}
	const masteryItems = parsedItems.filter(isRawItemWithMastery)

	/*
	 * Mastery is chosen for a KIND of weapon at character creation — a level-1
	 * character does not own a Sun Blade — so the pool is ordinary weapons only.
	 * items.json's resolved `rarity` (D34: already a plain word) is the clean
	 * separator: of the 92 mastery-bearing items, the 49 with rarity "none" are
	 * exactly the ordinary weapons, and none of those carry reqAttune / wondrous
	 * / tier / baseItem / bonusWeapon (scripts/investigate-mastery-magic-marker.js).
	 * The other 43 are magic items (Sun Blade, Scimitar of Speed, Blackrazor…).
	 */
	const ordinaryWeapons = masteryItems.filter((item) => item.rarity === 'none')

	const grants = [
		...weaponProficiencyGrantsForClass(parsedClasses, className, classSource),
		...weaponProficiencyGrantsForFeats(featAsiChoices, feats),
	]
	const filtered = ordinaryWeapons.filter((item) => isProficientWithWeapon(item, grants))

	const result: MasteryWeapon[] = []
	for (const item of filtered) {
		for (const masteryFull of item.masteryFull) {
			result.push({ name: item.name, source: item.source, masteryFull })
		}
	}
	return result
}

/** Fetches classes.json and returns masteryCountFor's result for the given class/level. */
export async function loadMasteryCountFor(className: string, classSource: string, level: number): Promise<number | null> {
	const parsed = await loadDataFile('data/classes.json')
	return masteryCountFor(parsed, className, classSource, level)
}

/**
 * Fetches items.json, classes.json and feats.json and returns the class's
 * mastery weapon choices. `featAsiChoices` is the character's stored feat/ASI
 * picks (the wizard passes its in-progress list); a feat that grants weapon
 * proficiency (Martial Weapon Training, Gunner) widens the pool accordingly.
 */
export async function loadMasteryWeaponsFor(
	className: string,
	classSource: string,
	featAsiChoices: Character['featAsiChoices'] = [],
): Promise<MasteryWeapon[]> {
	const [items, classes, feats] = await Promise.all([
		loadDataFile('data/items.json'),
		loadDataFile('data/classes.json'),
		loadDataFile('data/feats.json'),
	])
	return masteryWeaponsFor(items, classes, className, classSource, featAsiChoices, extractFeatWeaponProficiencyEntries(feats))
}
