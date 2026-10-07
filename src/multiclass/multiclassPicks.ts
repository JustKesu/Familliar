import { loadDataFile } from '../dataLoader/dataLoader'
import type { Character, CharacterMulticlassPick } from '../storage/character'
import type { ToolCategory } from '../toolProficiencies/toolProficiencyData'

interface ClassRef {
	className: string
	classSource: string
}

/** D330: what multiclassing.proficienciesGained lets a class joined later choose (DATA.md: only these two shapes occur). */
export interface MulticlassPickShape {
	skills: { count: number; from: string[] } | null
	tools: { count: number; category: ToolCategory } | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Throws on a shape other than `{choose:{from,count}}` skills or `{anyMusicalInstrument:n}` tools, rather than guessing. */
export function multiclassPickShape(parsedClasses: unknown, className: string, classSource: string): MulticlassPickShape {
	if (!Array.isArray(parsedClasses)) throw new Error('classes.json: expected a top-level array.')
	const entry = parsedClasses.find((candidate) => isRecord(candidate) && candidate['entryType'] === 'class' && candidate['name'] === className && candidate['source'] === classSource)
	if (!isRecord(entry)) throw new Error(`No entry for class "${className}" (${classSource}) in classes.json.`)
	const multiclassing = entry['multiclassing']
	const gained = isRecord(multiclassing) && isRecord(multiclassing['proficienciesGained']) ? multiclassing['proficienciesGained'] : {}
	const unexpected = (field: string): never => {
		throw new Error(`${className} (${classSource}): unexpected multiclassing.proficienciesGained.${field} shape.`)
	}

	let skills: MulticlassPickShape['skills'] = null
	if (gained['skills'] !== undefined) {
		const list = gained['skills']
		const choose = Array.isArray(list) && list.length === 1 && isRecord(list[0]) ? list[0]['choose'] : undefined
		if (!isRecord(choose) || !Array.isArray(choose['from']) || typeof choose['count'] !== 'number') unexpected('skills')
		const from = (choose as Record<string, unknown>)['from'] as unknown[]
		skills = { count: (choose as Record<string, unknown>)['count'] as number, from: from.filter((name): name is string => typeof name === 'string') }
	}

	let tools: MulticlassPickShape['tools'] = null
	for (const item of Array.isArray(gained['toolProficiencies']) ? gained['toolProficiencies'] : []) {
		if (!isRecord(item)) unexpected('toolProficiencies')
		for (const [key, value] of Object.entries(item as Record<string, unknown>)) {
			if (value === true) continue
			if (key === 'anyMusicalInstrument' && typeof value === 'number' && tools === null) tools = { count: value, category: 'anyMusicalInstrument' }
			else unexpected('toolProficiencies')
		}
	}
	return { skills, tools }
}

export async function loadMulticlassPickShape(className: string, classSource: string): Promise<MulticlassPickShape> {
	return multiclassPickShape(await loadDataFile('data/classes.json'), className, classSource)
}

export const isPickOf = (pick: ClassRef, target: ClassRef): boolean => pick.className === target.className && pick.classSource === target.classSource

export function multiclassSkillNames(character: Pick<Character, 'multiclassPicks'>): CharacterMulticlassPick[] {
	return (character.multiclassPicks ?? []).filter((pick) => pick.kind === 'skill')
}

/** D330: the skill picks as held skill proficiencies, the shape the wizard's skill lists and the Expertise pool take. */
export function multiclassSkillSources(picks: readonly CharacterMulticlassPick[] | undefined): { skill: string; source: string }[] {
	return (picks ?? []).flatMap((pick) => (pick.kind === 'skill' ? [{ skill: pick.name, source: `${pick.className} (multiclass)` }] : []))
}

export function multiclassToolPicks(character: Pick<Character, 'multiclassPicks'>): CharacterMulticlassPick[] {
	return (character.multiclassPicks ?? []).filter((pick) => pick.kind === 'tool')
}
