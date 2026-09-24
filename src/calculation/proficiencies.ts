import { classPrereqInfoFor } from '../featAsi/featAsiData'
import type { FeatRef } from '../featAsi/featInstances'
import type { Character } from '../storage/character'
import {
	extractFeatWeaponProficiencyEntries,
	weaponProficiencyGrantsForClass,
	weaponProficiencyGrantsForFeats,
	type FeatWeaponProficiencyEntry,
	type WeaponProficiencyGrant,
} from '../weapons/weaponProficiency'

export type ProficiencyCategory = 'armor' | 'weapons'

export interface ProficiencySource {
	kind: 'class' | 'subclass' | 'classFeatureChoice' | 'feat'
	/** As shown: "Fighter", "Cleric — Protector", "College of Valor", "Heavily Armored (feat)". */
	name: string
}

export interface ProficiencyItem {
	key: string
	label: string
	sources: ProficiencySource[]
}

export type Proficiencies = Record<ProficiencyCategory, ProficiencyItem[]>

export interface FeatProficiencyEntry extends FeatWeaponProficiencyEntry {
	/** feats.json's shape, same as weaponProficiencies: `[{"light": true, "shield": true}]`. */
	armorProficiencies?: Record<string, boolean>[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function extractFeatProficiencyEntries(parsedFeats: unknown): FeatProficiencyEntry[] {
	if (!Array.isArray(parsedFeats)) return []
	return parsedFeats.flatMap((feat) => {
		const [entry] = extractFeatWeaponProficiencyEntries([feat])
		if (!entry) return []
		const armor = isRecord(feat) ? feat['armorProficiencies'] : undefined
		return [{ ...entry, armorProficiencies: Array.isArray(armor) ? (armor.filter(isRecord) as Record<string, boolean>[]) : undefined }]
	})
}

const ARMOR_LABELS: Record<string, string> = { light: 'Light armor', medium: 'Medium armor', heavy: 'Heavy armor', shield: 'Shields' }
const ARMOR_ORDER = Object.keys(ARMOR_LABELS)

// D170: XPHB class/subclass grants exist only in feature text (DATA.md), so they are a hand table.
const XPHB_FEATURE_GRANTS: {
	className: string
	source: ProficiencySource
	applies: (character: Character) => boolean
	armor: string[]
	weapons: string[]
}[] = [
	{
		className: 'Cleric',
		source: { kind: 'classFeatureChoice', name: 'Cleric — Protector' },
		applies: (character) => hasChoice(character, 'Cleric', 'Divine Order', 'Protector'),
		armor: ['heavy'],
		weapons: ['martial'],
	},
	{
		className: 'Druid',
		source: { kind: 'classFeatureChoice', name: 'Druid — Warden' },
		applies: (character) => hasChoice(character, 'Druid', 'Primal Order', 'Warden'),
		armor: ['medium'],
		weapons: ['martial'],
	},
	{
		className: 'Bard',
		source: { kind: 'subclass', name: 'College of Valor' },
		applies: (character) => character.classes.some((cls) => cls.className === 'Bard' && cls.classSource === 'XPHB' && cls.subclass === 'College of Valor' && cls.level >= 3),
		armor: ['medium', 'shield'],
		weapons: ['martial'],
	},
]

function hasChoice(character: Character, className: string, featureName: string, optionName: string): boolean {
	return (character.classFeatureChoices ?? []).some(
		(choice) => choice.className === className && choice.classSource === 'XPHB' && choice.featureName === featureName && choice.optionName === optionName,
	)
}

function weaponKeyAndLabel(grant: WeaponProficiencyGrant): { key: string; label: string } {
	if (grant.kind === 'firearms') return { key: 'firearms', label: 'Firearms' }
	const base = `${grant.category[0].toUpperCase()}${grant.category.slice(1)} weapons`
	if (!grant.anyOfProperties) return { key: grant.category, label: base }
	return { key: `${grant.category}:${grant.anyOfProperties.join('|').toLowerCase()}`, label: `${base} with the ${grant.anyOfProperties.join(' or ')} property` }
}

function weaponRank(key: string): number {
	if (key === 'simple') return 0
	if (key === 'martial') return 1
	if (key === 'firearms') return 3
	if (key === 'improvised') return 4
	return 2
}

/**
 * Armor and weapon proficiencies for display (D170). Starting proficiencies come
 * from the first class only; attack proficiency itself stays with
 * weaponProficiency.ts. Tavern Brawler's "improvised" is listed here although
 * weaponProficiency.ts skips it (no item to match).
 */
export function computeProficiencies(character: Character, parsedClasses: unknown, takenFeats: readonly FeatRef[], feats: FeatProficiencyEntry[]): Proficiencies {
	const armor = new Map<string, ProficiencyItem>()
	const weapons = new Map<string, ProficiencyItem>()
	const add = (map: Map<string, ProficiencyItem>, key: string, label: string, source: ProficiencySource) => {
		const item = map.get(key) ?? { key, label, sources: [] }
		if (!item.sources.some((existing) => existing.name === source.name)) item.sources.push(source)
		map.set(key, item)
	}
	const addArmor = (token: string, source: ProficiencySource) => {
		if (ARMOR_LABELS[token]) add(armor, token, ARMOR_LABELS[token], source)
	}
	const addWeapon = (grant: WeaponProficiencyGrant, source: ProficiencySource) => {
		const { key, label } = weaponKeyAndLabel(grant)
		add(weapons, key, label, source)
	}

	const startingClass = character.classes[0]
	if (startingClass) {
		const source: ProficiencySource = { kind: 'class', name: startingClass.className }
		for (const token of classPrereqInfoFor(parsedClasses, startingClass.className, startingClass.classSource)?.armorProficiencies ?? []) addArmor(token, source)
		for (const grant of weaponProficiencyGrantsForClass(parsedClasses, startingClass.className, startingClass.classSource)) addWeapon(grant, source)
	}

	for (const grant of XPHB_FEATURE_GRANTS) {
		if (!grant.applies(character)) continue
		grant.armor.forEach((token) => addArmor(token, grant.source))
		grant.weapons.forEach((category) => addWeapon({ kind: 'category', category }, grant.source))
	}

	for (const ref of takenFeats) {
		const feat = feats.find((candidate) => candidate.name === ref.name && candidate.source === ref.source)
		if (!feat) continue
		const source: ProficiencySource = { kind: 'feat', name: `${feat.name} (feat)` }
		for (const entry of feat.armorProficiencies ?? []) for (const [token, granted] of Object.entries(entry)) if (granted) addArmor(token, source)
		for (const grant of weaponProficiencyGrantsForFeats([ref], feats)) addWeapon(grant, source)
		if (feat.weaponProficiencies?.some((entry) => entry['improvised'])) add(weapons, 'improvised', 'Improvised weapons', source)
	}

	// D170: a Monk/Rogue subset says nothing once full Martial weapons are there.
	if (weapons.has('martial')) for (const key of [...weapons.keys()]) if (key.startsWith('martial:')) weapons.delete(key)

	return {
		armor: ARMOR_ORDER.flatMap((key) => armor.get(key) ?? []),
		weapons: [...weapons.values()].sort((a, b) => weaponRank(a.key) - weaponRank(b.key)),
	}
}
