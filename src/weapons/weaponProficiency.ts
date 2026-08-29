/*
 * Which weapons a character is proficient with (D38: pure, all data passed
 * in). Two readers turn a proficiency SOURCE into grants —
 * `weaponProficiencyGrantsForClass` reads classes.json's
 * startingProficiencies.weapons, `weaponProficiencyGrantsFor` adds the
 * character's feats — and one test, `isProficientWithWeapon`, decides whether
 * an items.json entry matches those grants.
 *
 * The grants are structural (weaponCategory / propertyFull / firearm),
 * never a list of weapon names: those fields are already resolved in the
 * items data (D34), so a new source's weapons are covered the day they are
 * extracted. A name list would not be.
 *
 * Survey behind this (scripts/investigate-weapon-proficiency-fields.js,
 * scripts/investigate-weapon-prof-shapes.js): of the 13 classes, 11 have a
 * purely structured `weapons` array ("simple", "martial"); Monk and Rogue
 * mix "simple" with one prose sentence, handled by PROSE_WEAPON_PROFICIENCIES
 * below (D70). Species (78) and backgrounds (33) carry no
 * weaponProficiencies field at all; 3 of 128 feats do.
 */

import type { Character } from '../storage/character'

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * One source's weapon proficiency, expressed against fields items.json
 * already carries. `anyOfProperties` narrows a category to the weapons
 * having at least one of those `propertyFull` values (the prose classes);
 * absent means the whole category.
 */
export type WeaponProficiencyGrant =
	| { kind: 'category'; category: string; anyOfProperties?: string[] }
	| { kind: 'firearms' }

/** The slice of a feats.json entry this file reads — a caller-supplied parameter (D38), same contract as featEffects.ts's FeatEffectEntry. */
export interface FeatWeaponProficiencyEntry {
	name: string
	source: string
	/** feats.json's shape: an array of objects with boolean keys, e.g. `[{"martial": true}]`. */
	weaponProficiencies?: Record<string, boolean>[]
}

/*
 * D70 hand table. Monk and Rogue state part of their weapon proficiency in
 * a sentence rather than in a token, quoted here from classes.json
 * (XPHB, via scripts/investigate-weapon-prof-shapes.js) with its 5etools
 * markup stripped:
 *
 *  Monk:  "Martial weapons that have the {@filter Light|items|type=martial
 *    weapon|property=light} property"
 *  Rogue: "Martial weapons that have the {@filter Finesse or
 *    Light|items|type=martial weapon|property=finesse;light} property"
 *
 * Both sit alongside a structured "simple" in the same array, so only the
 * prose element is replaced here — the "simple" token is still read normally.
 * One prose element per class; nothing keys off its position.
 */
const PROSE_WEAPON_PROFICIENCIES: Record<string, WeaponProficiencyGrant[]> = {
	'Monk|XPHB': [{ kind: 'category', category: 'martial', anyOfProperties: ['Light'] }],
	'Rogue|XPHB': [{ kind: 'category', category: 'martial', anyOfProperties: ['Finesse', 'Light'] }],
}

/** The only `weapons` tokens the data actually uses — anything else is not a weaponCategory and cannot be matched structurally. */
const CATEGORY_TOKENS = ['simple', 'martial']

function isProseEntry(entry: string): boolean {
	return entry.includes('{@') || entry.includes(' ')
}

interface RawClass {
	entryType?: unknown
	name?: unknown
	source?: unknown
	startingProficiencies?: { weapons?: unknown }
}

function findClass(parsedClasses: unknown, className: string, classSource: string): RawClass | undefined {
	if (!Array.isArray(parsedClasses)) {
		throw new Error('classes.json: expected a top-level array.')
	}
	return parsedClasses.find(
		(candidate): candidate is RawClass =>
			isRecord(candidate) && candidate['entryType'] === 'class' && candidate['name'] === className && candidate['source'] === classSource,
	)
}

/**
 * What one class grants. Unknown classes, and tokens that name neither a
 * weaponCategory nor a recorded prose rule, contribute nothing: offering
 * every weapon when the source can't be read is what made the mastery
 * picker offer a Rogue a greataxe.
 */
export function weaponProficiencyGrantsForClass(parsedClasses: unknown, className: string, classSource: string): WeaponProficiencyGrant[] {
	const cls = findClass(parsedClasses, className, classSource)
	const weapons = cls?.startingProficiencies?.weapons
	if (!Array.isArray(weapons)) return []

	const grants: WeaponProficiencyGrant[] = []
	let proseApplied = false
	for (const entry of weapons) {
		if (typeof entry !== 'string') continue
		if (isProseEntry(entry)) {
			if (proseApplied) continue
			grants.push(...(PROSE_WEAPON_PROFICIENCIES[`${className}|${classSource}`] ?? []))
			proseApplied = true
		} else if (CATEGORY_TOKENS.includes(entry)) {
			grants.push({ kind: 'category', category: entry })
		}
	}
	return grants
}

/**
 * What the character's chosen feats grant. Only 3 feats carry the field:
 * Martial Weapon Training ("martial"), Gunner ("firearms" — items.json's
 * `firearm` flag, 10 items) and Tavern Brawler ("improvised"), which is
 * skipped: improvised weapons are not items, so there is nothing to match.
 */
export function weaponProficiencyGrantsForFeats(character: Character, feats: FeatWeaponProficiencyEntry[]): WeaponProficiencyGrant[] {
	const grants: WeaponProficiencyGrant[] = []
	for (const choice of character.featAsiChoices ?? []) {
		if (choice.kind !== 'feat') continue
		const feat = feats.find((candidate) => candidate.name === choice.name && candidate.source === choice.source)
		for (const entry of feat?.weaponProficiencies ?? []) {
			for (const [key, granted] of Object.entries(entry)) {
				if (!granted) continue
				if (CATEGORY_TOKENS.includes(key)) grants.push({ kind: 'category', category: key })
				else if (key === 'firearms') grants.push({ kind: 'firearms' })
			}
		}
	}
	return grants
}

/**
 * Every weapon proficiency the character has, from every class they hold
 * (D11) plus their feats. Species and backgrounds are absent on purpose:
 * neither data file has a weaponProficiencies field on any entry.
 */
export function weaponProficiencyGrantsFor(character: Character, parsedClasses: unknown, feats: FeatWeaponProficiencyEntry[]): WeaponProficiencyGrant[] {
	const grants = character.classes.flatMap((cls) => weaponProficiencyGrantsForClass(parsedClasses, cls.className, cls.classSource))
	return [...grants, ...weaponProficiencyGrantsForFeats(character, feats)]
}

/** Whether an items.json entry is covered by any of the grants. */
export function isProficientWithWeapon(weapon: unknown, grants: WeaponProficiencyGrant[]): boolean {
	if (!isRecord(weapon)) return false
	const category = weapon['weaponCategory']
	const properties = Array.isArray(weapon['propertyFull']) ? weapon['propertyFull'] : []

	return grants.some((grant) => {
		if (grant.kind === 'firearms') return weapon['firearm'] === true
		if (category !== grant.category) return false
		return grant.anyOfProperties === undefined || grant.anyOfProperties.some((property) => properties.includes(property))
	})
}
