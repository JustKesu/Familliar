import { classPrereqInfoFor } from '../featAsi/featAsiData'
import type { Character } from '../storage/character'
import { weaponProficiencyGrantsForClass, type WeaponProficiencyGrant } from '../weapons/weaponProficiency'
import { firstClass } from './characterLevel'
import type { ProficiencySource } from './proficiencies'

export interface ClassProficiencyGrants {
	armor: { token: string; source: ProficiencySource }[]
	weapons: { grant: WeaponProficiencyGrant; source: ProficiencySource }[]
	/** Fixed multiclass tools only; the first class's starting tools and picks stay with computeProficiencies. */
	tools: { name: string; source: ProficiencySource }[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function titleCase(text: string): string {
	return text.replace(/(^|\s)(\S)/g, (_, space: string, letter: string) => `${space}${letter.toUpperCase()}`)
}

function proficienciesGained(parsedClasses: unknown, className: string, classSource: string): Record<string, unknown> | undefined {
	if (!Array.isArray(parsedClasses)) return undefined
	const entry = parsedClasses.find((candidate) => isRecord(candidate) && candidate['entryType'] === 'class' && candidate['name'] === className && candidate['source'] === classSource)
	const multiclassing = isRecord(entry) ? entry['multiclassing'] : undefined
	const gained = isRecord(multiclassing) ? multiclassing['proficienciesGained'] : undefined
	return isRecord(gained) ? gained : undefined
}

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [])

/**
 * D321: the first class gives its starting armor and weapons; every other class only the fixed part of its
 * multiclassing.proficienciesGained (choices wait for M7). The Proficiencies card and weapon attacks both read this (D178).
 */
export function classProficiencyGrants(character: Pick<Character, 'classes' | 'levelOrder'>, parsedClasses: unknown): ClassProficiencyGrants {
	const result: ClassProficiencyGrants = { armor: [], weapons: [], tools: [] }
	const start = firstClass(character)
	if (!start) return result
	const startSource: ProficiencySource = { kind: 'class', name: start.className }
	for (const token of classPrereqInfoFor(parsedClasses, start.className, start.classSource)?.armorProficiencies ?? []) result.armor.push({ token, source: startSource })
	for (const grant of weaponProficiencyGrantsForClass(parsedClasses, start.className, start.classSource)) result.weapons.push({ grant, source: startSource })

	for (const cls of character.classes) {
		if (cls === start) continue
		const gained = proficienciesGained(parsedClasses, cls.className, cls.classSource)
		if (!gained) continue
		const source: ProficiencySource = { kind: 'class', name: `${cls.className} (multiclass)` }
		for (const token of strings(gained['armor'])) result.armor.push({ token, source })
		for (const token of strings(gained['weapons'])) if (token === 'simple' || token === 'martial') result.weapons.push({ grant: { kind: 'category', category: token }, source })
		// The text-only `tools` field is ignored; a numeric value (Bard's anyMusicalInstrument) is a choice, deferred to M7.
		for (const entry of Array.isArray(gained['toolProficiencies']) ? gained['toolProficiencies'].filter(isRecord) : []) {
			for (const [token, granted] of Object.entries(entry)) if (granted === true) result.tools.push({ name: titleCase(token), source })
		}
	}
	return result
}
