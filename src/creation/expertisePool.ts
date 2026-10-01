import type { FeatInstance } from '../featAsi/featInstances'

export interface SkillSource {
	skill: string
	source: string
}

export type StaleReason = 'proficiency' | 'taken' | 'restricted'

type SkillFeat = Pick<FeatInstance, 'origin' | 'name' | 'source' | 'proficiencies'>

/** D303: skills of a feat an item grants leave with the item, so they are not a lasting source of Expertise. */
export function featSkillSources(instances: readonly SkillFeat[], fixedSkills: Readonly<Record<string, string[]>>): SkillSource[] {
	return instances
		.filter((instance) => instance.origin !== 'item')
		.flatMap((instance) => [...(fixedSkills[`${instance.name}|${instance.source}`] ?? []), ...(instance.proficiencies?.skills ?? [])].map((skill) => ({ skill, source: instance.name })))
}

/**
 * The Expertise pool: every source skill that has no Expertise from elsewhere (fixed, or a feat's own choice) and
 * passes the class's restriction (Scholar). `stale` lists the picks that no longer fit and why (D307).
 */
export function expertisePoolOf({
	sourceSkills,
	fixedExpertise,
	feats,
	restrictedTo,
	picked,
}: {
	sourceSkills: readonly SkillSource[]
	fixedExpertise: readonly string[]
	feats: readonly SkillFeat[]
	restrictedTo: readonly string[] | null | undefined
	picked: readonly string[]
}): { taken: string[]; pool: SkillSource[]; stale: { skill: string; reason: StaleReason }[] } {
	const taken = [...fixedExpertise, ...feats.flatMap((instance) => instance.proficiencies?.expertise ?? [])]
	const pool = sourceSkills.filter((entry) => !taken.includes(entry.skill) && (!restrictedTo || restrictedTo.includes(entry.skill)))
	const stale = picked.flatMap((skill): { skill: string; reason: StaleReason }[] => {
		if (pool.some((entry) => entry.skill === skill)) return []
		if (!sourceSkills.some((entry) => entry.skill === skill)) return [{ skill, reason: 'proficiency' }]
		return [{ skill, reason: taken.includes(skill) ? 'taken' : 'restricted' }]
	})
	return { taken, pool, stale }
}
