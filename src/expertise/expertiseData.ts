/*
 * Typed loader for the expertise slice of class-features.json.
 *
 * Confirmed via scripts/investigate-expertise.js and
 * scripts/investigate-expertise-2.js:
 *
 * - The skill COUNT each feature grants is nowhere structured in the data,
 *   only in prose, so it is hardcoded below from the PHB 2024 (XPHB) text.
 * - Features named exactly "Expertise" (Bard 2/9, Ranger 9, Rogue 1/6) all
 *   read "two of your skill proficiencies of your choice" — count 2, any
 *   skill the character is already proficient in.
 * - "Deft Explorer" (Ranger 2) is NOT named "Expertise" but its own
 *   "Expertise" sub-entry reads "Choose one of your skill proficiencies
 *   with which you lack Expertise" — count 1, any proficient skill.
 * - "Scholar" (Wizard 2) is also not named "Expertise": "Choose one of the
 *   following skills in which you have proficiency: Arcana, History,
 *   Investigation, Medicine, Nature, or Religion" — count 1, restricted to
 *   those six AND the character must already be proficient in the one
 *   chosen (confirmed with user).
 * - "Infiltration Expertise" (Rogue/Assassin subclass, level 9) is excluded
 *   outright: its prose (Masterful Mimicry, Roving Aim) confirms it grants
 *   no skill expertise despite the name (confirmed with user) — it is not
 *   in GRANT_RULES and subclass-features.json is never consulted here.
 */

export const EXPERTISE_SKILL_COUNT = 2
export const DEFT_EXPLORER_SKILL_COUNT = 1
export const SCHOLAR_SKILL_COUNT = 1
export const SCHOLAR_SKILLS = ['arcana', 'history', 'investigation', 'medicine', 'nature', 'religion'] as const

interface GrantRule {
	count: number
	restrictedTo: readonly string[] | null
}

const GRANT_RULES: Record<string, GrantRule> = {
	Expertise: { count: EXPERTISE_SKILL_COUNT, restrictedTo: null },
	'Deft Explorer': { count: DEFT_EXPLORER_SKILL_COUNT, restrictedTo: null },
	Scholar: { count: SCHOLAR_SKILL_COUNT, restrictedTo: SCHOLAR_SKILLS },
}

export interface ExpertiseEligibility {
	/** Total number of skills the character may name as Expertise, summed across every granting feature up to its level. */
	count: number
	/** null = any skill the character is already proficient in; otherwise the pool is this list intersected with proficient skills (Scholar). */
	restrictedTo: readonly string[] | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

interface RawClassFeatureEntry {
	name: string
	className: string
	classSource: string
	level: number
}

function isRawClassFeatureEntry(value: unknown): value is RawClassFeatureEntry {
	if (!isRecord(value)) return false
	return (
		typeof value['name'] === 'string' &&
		typeof value['className'] === 'string' &&
		typeof value['classSource'] === 'string' &&
		typeof value['level'] === 'number'
	)
}

/**
 * Sums every expertise-granting class feature the class has by `level`
 * (inclusive) and returns the combined pick count and pool restriction, or
 * `null` if the class grants no expertise at all by that level.
 */
export function expertiseEligibilityFor(
	parsedClassFeatures: unknown,
	className: string,
	classSource: string,
	level: number,
): ExpertiseEligibility | null {
	if (!Array.isArray(parsedClassFeatures)) {
		throw new Error('class-features.json: expected a top-level array.')
	}
	const matches = parsedClassFeatures.filter(
		(candidate): candidate is RawClassFeatureEntry =>
			isRawClassFeatureEntry(candidate) &&
			candidate.className === className &&
			candidate.classSource === classSource &&
			candidate.level <= level &&
			Object.prototype.hasOwnProperty.call(GRANT_RULES, candidate.name),
	)
	if (matches.length === 0) return null

	const rules = matches.map((f) => GRANT_RULES[f.name])
	const count = rules.reduce((sum, rule) => sum + rule.count, 0)
	const restrictedTo = rules.every((rule) => rule.restrictedTo !== null)
		? rules.flatMap((rule) => rule.restrictedTo as readonly string[])
		: null

	return { count, restrictedTo }
}

/** Fetches class-features.json and returns the named class's expertise eligibility at `level`, or null. */
export async function loadExpertiseEligibility(
	className: string,
	classSource: string,
	level: number,
): Promise<ExpertiseEligibility | null> {
	const response = await fetch(`${import.meta.env.BASE_URL}data/class-features.json`)
	if (!response.ok) {
		throw new Error(`class-features.json — HTTP ${response.status}`)
	}
	const parsed: unknown = await response.json()
	return expertiseEligibilityFor(parsed, className, classSource, level)
}
