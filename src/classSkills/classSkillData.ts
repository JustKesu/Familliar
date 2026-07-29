/*
 * Typed loader for the class-skill-proficiency slice of classes.json.
 *
 * Confirmed via scripts/investigate-class-skills.js against all 13 base
 * classes: `startingProficiencies.skills` is present on every one, in one
 * of two shapes —
 *   - `[{ choose: { from: [...skillNames], count: N } }]` for 12 classes
 *     (count is always present in the data; N ranges 2-4 across classes).
 *   - `[{ any: N }]` for Bard alone — "choose N from every skill".
 * No class was missing the field and no third shape occurred.
 */

import { loadDataFile } from '../dataLoader/dataLoader'

export const ALL_SKILLS = [
	'acrobatics',
	'animal handling',
	'arcana',
	'athletics',
	'deception',
	'history',
	'insight',
	'intimidation',
	'investigation',
	'medicine',
	'nature',
	'perception',
	'performance',
	'persuasion',
	'religion',
	'sleight of hand',
	'stealth',
	'survival',
] as const

export interface ClassSkillChoice {
	count: number
	options: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Reads `startingProficiencies.skills` for one class entry and returns how
 * many skills the player picks and which skills are offered. Throws if the
 * entry's shape doesn't match either of the two shapes confirmed above,
 * rather than guessing.
 */
export function parseClassSkillChoice(raw: unknown): ClassSkillChoice {
	if (!Array.isArray(raw) || raw.length !== 1 || !isRecord(raw[0])) {
		throw new Error(`class: expected a 1-element "skills" array, got ${JSON.stringify(raw)}`)
	}
	const entry = raw[0]

	if (typeof entry['any'] === 'number') {
		return { count: entry['any'], options: [...ALL_SKILLS] }
	}

	const choose = entry['choose']
	if (isRecord(choose) && Array.isArray(choose['from']) && typeof choose['count'] === 'number') {
		const options = choose['from'].filter((s): s is string => typeof s === 'string')
		if (options.length !== choose['from'].length) {
			throw new Error(`class: "choose.from" contained a non-string skill: ${JSON.stringify(choose['from'])}`)
		}
		return { count: choose['count'], options }
	}

	throw new Error(`class: "skills" did not match the expected choose/from or any shape: ${JSON.stringify(raw)}`)
}

interface RawClassEntry {
	entryType: string
	name: string
	source: string
}

function isRawClassEntry(value: unknown): value is RawClassEntry {
	if (!isRecord(value)) return false
	return (
		value['entryType'] === 'class' &&
		typeof value['name'] === 'string' &&
		typeof value['source'] === 'string'
	)
}

/**
 * Finds the named base class in a parsed classes.json array and returns its
 * skill choice. Throws if the class isn't present or has no `skills` field.
 */
export function extractClassSkillChoice(parsed: unknown, className: string, classSource: string): ClassSkillChoice {
	if (!Array.isArray(parsed)) {
		throw new Error('classes.json: expected a top-level array.')
	}
	const entry = parsed.find(
		(candidate) =>
			isRawClassEntry(candidate) &&
			candidate.name === className &&
			candidate.source === classSource,
	) as (RawClassEntry & Record<string, unknown>) | undefined
	if (!entry) {
		throw new Error(`classes.json: no class entry for "${className}" (${classSource})`)
	}
	const skills = isRecord(entry['startingProficiencies']) ? entry['startingProficiencies']['skills'] : undefined
	if (skills === undefined) {
		throw new Error(`classes.json: "${className}" (${classSource}) has no startingProficiencies.skills`)
	}
	return parseClassSkillChoice(skills)
}

/** Fetches classes.json and returns the named class's skill choice. */
export async function loadClassSkillChoice(className: string, classSource: string): Promise<ClassSkillChoice> {
	const parsed = await loadDataFile('data/classes.json')
	return extractClassSkillChoice(parsed, className, classSource)
}
