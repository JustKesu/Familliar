/*
 * Typed loader for the weapon-mastery slice: how many masteries a class may
 * choose, and which weapons carry a mastery property.
 *
 * Per docs/REPORT2.md's investigation, "Weapon Mastery" is a class feature
 * on five classes (Barbarian, Fighter, Paladin, Ranger, Rogue), but only
 * Barbarian and Fighter have a classTableGroups column giving the count per
 * level — the other three state it only in feature prose. Parsing prose is
 * out of scope here (see CLAUDE.md's "Undecided questions"), so
 * masteryCountFor reads the table column only and returns null for classes
 * without one, which covers those three classes automatically without a
 * hardcoded list.
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
	startingProficiencies?: { weapons?: unknown[] }
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

/**
 * Reads the class's classTableGroups for a column labelled exactly
 * "Weapon Mastery" and returns the count at `level` (1-indexed rows).
 * Returns null when the class has no such column — meaning it offers no
 * mastery choice, or (Paladin/Ranger/Rogue) states the count only in prose,
 * which this does not parse.
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
	return null
}

/**
 * True when every element of a startingProficiencies.weapons array is a
 * plain category token ("simple", "martial", or an item uid) rather than a
 * prose sentence. Prose entries (Monk, Rogue) contain markup ("{@filter")
 * or spaces; structured entries don't.
 */
function isStructuredWeaponProficiency(weapons: unknown[]): boolean {
	return weapons.every((entry) => typeof entry === 'string' && !entry.includes('{@') && !entry.includes(' '))
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
}

function isRawItemWithMastery(value: unknown): value is RawItem & { name: string; source: string; masteryFull: string[] } {
	if (!isRecord(value)) return false
	return (
		typeof value['name'] === 'string' &&
		typeof value['source'] === 'string' &&
		Array.isArray(value['masteryFull']) &&
		value['masteryFull'].every((m) => typeof m === 'string')
	)
}

/**
 * The weapons a class may pick weapon masteries from: every mastery-bearing
 * item, filtered to the class's weapon-proficiency categories when that
 * field is a structured list. When it's prose, every mastery weapon is
 * returned unfiltered rather than attempting to parse the sentence.
 */
export function masteryWeaponsFor(parsedItems: unknown, parsedClasses: unknown, className: string, classSource: string): MasteryWeapon[] {
	if (!Array.isArray(parsedItems)) {
		throw new Error('items.json: expected a top-level array.')
	}
	const masteryItems = parsedItems.filter(isRawItemWithMastery)

	const cls = findClass(parsedClasses, className, classSource)
	const weaponsField = cls?.startingProficiencies?.weapons

	const filtered =
		Array.isArray(weaponsField) && isStructuredWeaponProficiency(weaponsField)
			? masteryItems.filter((item) => weaponsField.includes(item.weaponCategory))
			: masteryItems

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

/** Fetches items.json and classes.json and returns the class's mastery weapon choices. */
export async function loadMasteryWeaponsFor(className: string, classSource: string): Promise<MasteryWeapon[]> {
	const [items, classes] = await Promise.all([loadDataFile('data/items.json'), loadDataFile('data/classes.json')])
	return masteryWeaponsFor(items, classes, className, classSource)
}
