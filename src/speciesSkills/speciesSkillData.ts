/*
 * Typed loader for the skillProficiencies slice of species.json.
 *
 * Confirmed via scripts/investigate-species-skills.js against all 26
 * selectable species that carry the field (of 75 selectable species total):
 *
 * - Every entry's `skillProficiencies` array has exactly 1 element.
 * - Variant entries (Elf; Drow Lineage, Shifter; Beasthide, Kobold;
 *   Craftiness, ...) already carry their OWN `skillProficiencies`, equal to
 *   their parent's — the 5etools extraction step already resolved
 *   inheritance, so there is nothing to merge here; reading the selected
 *   entry's own field is correct as-is.
 * - Five shapes occur:
 *     - `{ skill: true }` — one fixed skill.
 *     - `{ skillA: true, skillB: true }` — TWO fixed skills (Satyr, Tabaxi).
 *       Confirmed with user: every `true`-valued key in the object is a
 *       fixed skill, not just the first.
 *     - `{ choose: { from: [...] } }` — a choice with no `count` (13 of 26
 *       occurrences); count defaults to 1 (task instructions, point 2).
 *     - `{ choose: { from: [...], count: N } }` — a choice with count.
 *     - `{ any: N }` — choose N from every skill (Githyanki, Human, Kenku,
 *       Warforged). Confirmed with user: treat like the class-skill `any`
 *       shape (classSkillData.ts) — count=N, options=ALL_SKILLS.
 */

import { ALL_SKILLS } from '../classSkills/classSkillData'

export type SpeciesSkillProficiencies =
	| { kind: 'fixed'; skills: string[] }
	| { kind: 'choice'; count: number; options: string[] }

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Reads `skillProficiencies` for one species entry. Returns `null` if the
 * field is absent (the species grants no skill proficiency at all — the
 * picker should not render). Throws if the field is present but doesn't
 * match one of the five confirmed shapes above.
 */
export function parseSpeciesSkillProficiencies(raw: unknown): SpeciesSkillProficiencies | null {
	if (raw === undefined) return null
	if (!Array.isArray(raw) || raw.length !== 1 || !isRecord(raw[0])) {
		throw new Error(`species: expected a 1-element "skillProficiencies" array, got ${JSON.stringify(raw)}`)
	}
	const entry = raw[0]

	if (typeof entry['any'] === 'number') {
		return { kind: 'choice', count: entry['any'], options: [...ALL_SKILLS] }
	}

	const choose = entry['choose']
	if (isRecord(choose) && Array.isArray(choose['from'])) {
		const options = choose['from'].filter((s): s is string => typeof s === 'string')
		if (options.length !== choose['from'].length) {
			throw new Error(`species: "choose.from" contained a non-string skill: ${JSON.stringify(choose['from'])}`)
		}
		const count = typeof choose['count'] === 'number' ? choose['count'] : 1
		return { kind: 'choice', count, options }
	}

	const fixedSkills = Object.entries(entry)
		.filter(([, value]) => value === true)
		.map(([skill]) => skill)
	if (fixedSkills.length > 0 && fixedSkills.length === Object.keys(entry).length) {
		return { kind: 'fixed', skills: fixedSkills }
	}

	throw new Error(`species: "skillProficiencies" did not match any confirmed shape: ${JSON.stringify(raw)}`)
}

interface RawSpeciesEntry {
	name: string
	source: string
}

function isRawSpeciesEntry(value: unknown): value is RawSpeciesEntry {
	return isRecord(value) && typeof value['name'] === 'string' && typeof value['source'] === 'string'
}

/**
 * Finds the named species entry in a parsed species.json array and returns
 * its skill proficiencies (or null if it grants none). Throws if the
 * species isn't present.
 */
export function extractSpeciesSkillProficiencies(
	parsed: unknown,
	speciesName: string,
	speciesSource: string,
): SpeciesSkillProficiencies | null {
	if (!Array.isArray(parsed)) {
		throw new Error('species.json: expected a top-level array.')
	}
	const entry = parsed.find(
		(candidate) => isRawSpeciesEntry(candidate) && candidate.name === speciesName && candidate.source === speciesSource,
	) as (RawSpeciesEntry & Record<string, unknown>) | undefined
	if (!entry) {
		throw new Error(`species.json: no species entry for "${speciesName}" (${speciesSource})`)
	}
	return parseSpeciesSkillProficiencies(entry['skillProficiencies'])
}

/** Fetches species.json and returns the named species' skill proficiencies. */
export async function loadSpeciesSkillProficiencies(
	speciesName: string,
	speciesSource: string,
): Promise<SpeciesSkillProficiencies | null> {
	const response = await fetch(`${import.meta.env.BASE_URL}data/species.json`)
	if (!response.ok) {
		throw new Error(`species.json — HTTP ${response.status}`)
	}
	const parsed: unknown = await response.json()
	return extractSpeciesSkillProficiencies(parsed, speciesName, speciesSource)
}
