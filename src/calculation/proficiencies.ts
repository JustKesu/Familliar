import { classPrereqInfoFor } from '../featAsi/featAsiData'
import { CLASS_FEATURE_LANGUAGE_GRANTS, classFeatureLanguageGrantsFor } from '../languages/classFeatureLanguages'
import type { FeatRef } from '../featAsi/featInstances'
import type { Character, FeatChoiceDetails } from '../storage/character'
import {
	extractFeatWeaponProficiencyEntries,
	weaponProficiencyGrantsForClass,
	weaponProficiencyGrantsForFeats,
	type FeatWeaponProficiencyEntry,
	type WeaponProficiencyGrant,
} from '../weapons/weaponProficiency'

export type ProficiencyCategory = 'armor' | 'weapons' | 'tools' | 'languages'

export interface ProficiencySource {
	kind: 'class' | 'subclass' | 'classFeatureChoice' | 'feat' | 'creation' | 'background'
	/** As shown: "Fighter", "Cleric — Protector", "College of Valor", "Heavily Armored (feat)". */
	name: string
}

export interface ProficiencyItem {
	key: string
	label: string
	sources: ProficiencySource[]
	/** D171: a choice the character is owed but has not made; a later picker stores it and this item goes away. */
	pending?: boolean
}

export type Proficiencies = Record<ProficiencyCategory, ProficiencyItem[]>

export interface FeatProficiencyEntry extends FeatWeaponProficiencyEntry {
	/** feats.json's shape, same as weaponProficiencies: `[{"light": true, "shield": true}]`. */
	armorProficiencies?: Record<string, boolean>[]
	/** `[{"sylvan": true}]` for a fixed language, `[{"any": 1}]` for a free pick. */
	languageProficiencies?: Record<string, boolean | number>[]
	/** `{"cook's utensils": true}` fixed, `{anyArtisansTool: 1}` / `{anyMusicalInstrument: 3}` / `{any: 1}` free, `{choose: {from, count}}` (Crafter). */
	toolProficiencies?: Record<string, unknown>[]
}

/** A taken feat, optionally with the sub-choices stored on its instance (D158). */
export type TakenFeat = FeatRef & Pick<FeatChoiceDetails, 'proficiencies'>

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function extractFeatProficiencyEntries(parsedFeats: unknown): FeatProficiencyEntry[] {
	if (!Array.isArray(parsedFeats)) return []
	return parsedFeats.flatMap((feat) => {
		const [entry] = extractFeatWeaponProficiencyEntries([feat])
		if (!entry) return []
		const armor = isRecord(feat) ? feat['armorProficiencies'] : undefined
		const languages = isRecord(feat) ? feat['languageProficiencies'] : undefined
		const tools = isRecord(feat) ? feat['toolProficiencies'] : undefined
		return [
			{
				...entry,
				toolProficiencies: Array.isArray(tools) ? tools.filter(isRecord) : undefined,
				armorProficiencies: Array.isArray(armor) ? (armor.filter(isRecord) as Record<string, boolean>[]) : undefined,
				languageProficiencies: Array.isArray(languages) ? (languages.filter(isRecord) as Record<string, boolean | number>[]) : undefined,
			},
		]
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
	tools?: string[]
	/** D173: an artisan's tool the subclass owes but no picker stores yet. */
	pendingArtisanTools?: number
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
	{
		className: 'Monk',
		source: { kind: 'subclass', name: 'Warrior of Mercy' },
		applies: (character) => hasSubclass(character, 'Monk', 'Warrior of Mercy', 3),
		armor: [],
		weapons: [],
		tools: ['herbalism kit'],
	},
	{
		className: 'Fighter',
		source: { kind: 'subclass', name: 'Battle Master' },
		applies: (character) => hasSubclass(character, 'Fighter', 'Battle Master', 3),
		armor: [],
		weapons: [],
		pendingArtisanTools: 1,
	},
]

// D173: the two "choose" shapes in classes.json / feats.json. `any` is Prodigy's untyped pick.
const TOOL_CHOICE_NOUNS: Record<string, [string, string]> = {
	anyArtisansTool: ["artisan's tool", "artisan's tools"],
	anyMusicalInstrument: ['musical instrument', 'musical instruments'],
	choose: ["artisan's tool", "artisan's tools"],
	any: ['tool', 'tools'],
}

function toolChoices(entry: Record<string, unknown>): { noun: [string, string]; count: number }[] {
	return Object.entries(entry).flatMap(([token, value]) => {
		const noun = TOOL_CHOICE_NOUNS[token]
		const count = token === 'choose' ? (isRecord(value) ? value['count'] : undefined) : value
		return noun && typeof count === 'number' ? [{ noun, count }] : []
	})
}

const nounText = (noun: [string, string], count: number) => noun[count === 1 ? 0 : 1]

function titleCase(text: string): string {
	return text.replace(/(^|\s)(\S)/g, (_, space: string, letter: string) => `${space}${letter.toUpperCase()}`)
}

/** classes.json's structured `toolProficiencies` (not the parallel prose `tools`); several array elements are alternatives. */
function classToolProficiencies(parsedClasses: unknown, className: string, classSource: string): Record<string, unknown>[] {
	if (!Array.isArray(parsedClasses)) return []
	const entry = parsedClasses.find((candidate) => isRecord(candidate) && candidate['name'] === className && candidate['source'] === classSource && candidate['classFeatures'] !== undefined)
	const starting = isRecord(entry) ? entry['startingProficiencies'] : undefined
	const tools = isRecord(starting) ? starting['toolProficiencies'] : undefined
	return Array.isArray(tools) ? tools.filter(isRecord) : []
}

function hasSubclass(character: Character, className: string, subclass: string, level: number): boolean {
	return character.classes.some((cls) => cls.className === className && cls.classSource === 'XPHB' && cls.subclass === subclass && cls.level >= level)
}

function capitalize(text: string): string {
	return `${text[0].toUpperCase()}${text.slice(1)}`
}

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
export function computeProficiencies(character: Character, parsedClasses: unknown, takenFeats: readonly TakenFeat[], feats: FeatProficiencyEntry[]): Proficiencies {
	const armor = new Map<string, ProficiencyItem>()
	const weapons = new Map<string, ProficiencyItem>()
	const languages = new Map<string, ProficiencyItem>()
	const tools = new Map<string, ProficiencyItem>()
	const pending: ProficiencyItem[] = []
	const pendingTools: ProficiencyItem[] = []
	const addTool = (name: string, source: ProficiencySource) => add(tools, name.toLowerCase(), name, source)
	const addPendingTool = (count: number, nouns: string, owner: string, source: ProficiencySource) => {
		if (count > 0) pendingTools.push({ key: `pending:tools:${source.name}`, label: `${count} ${nouns} (${owner}) — not chosen`, sources: [source], pending: true })
	}
	const addLanguage = (name: string, source: ProficiencySource) => add(languages, name.toLowerCase(), name, source)
	const addPending = (count: number, sourceName: string, kind: ProficiencySource['kind'], label = `${count} ${count === 1 ? 'language' : 'languages'}`) => {
		if (count > 0) pending.push({ key: `pending:${sourceName}`, label: `${label} — not chosen`, sources: [{ kind, name: sourceName }], pending: true })
	}
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
		const toolEntries = classToolProficiencies(parsedClasses, startingClass.className, startingClass.classSource)
		if (toolEntries.length > 1) {
			const choices = toolEntries.flatMap(toolChoices)
			addPendingTool(choices[0]?.count ?? 0, choices.map((choice) => nounText(choice.noun, choice.count)).join(' or '), startingClass.className, source)
		} else {
			for (const entry of toolEntries) {
				for (const [token, granted] of Object.entries(entry)) if (granted === true) addTool(titleCase(token), source)
				for (const { noun, count } of toolChoices(entry)) addPendingTool(count, nounText(noun, count), startingClass.className, source)
			}
		}
	}

	if (character.background?.toolProficiency) {
		addTool(character.background.toolProficiency, { kind: 'background', name: `${character.background.name} (background)` })
	}

	for (const grant of XPHB_FEATURE_GRANTS) {
		if (!grant.applies(character)) continue
		grant.armor.forEach((token) => addArmor(token, grant.source))
		grant.weapons.forEach((category) => addWeapon({ kind: 'category', category }, grant.source))
		grant.tools?.forEach((tool) => addTool(titleCase(tool), grant.source))
		const owed = grant.pendingArtisanTools ?? 0
		addPendingTool(owed, nounText(TOOL_CHOICE_NOUNS['anyArtisansTool'], owed), grant.source.name, grant.source)
	}

	for (const language of character.languages ?? []) {
		const grant = CLASS_FEATURE_LANGUAGE_GRANTS.find((candidate) => candidate.choice?.grantedBy === language.grantedBy)
		if (grant) addLanguage(language.name, { kind: 'classFeatureChoice', name: `${grant.className} — ${grant.featureName}` })
		else addLanguage(language.name, { kind: 'creation', name: language.grantedBy === 'automatic' ? 'Every character' : 'Chosen at creation' })
	}

	for (const grant of classFeatureLanguageGrantsFor(character.classes)) {
		if (grant.fixed) addLanguage(grant.fixed, { kind: 'class', name: grant.className })
		if (!grant.choice) continue
		const { count, grantedBy } = grant.choice
		// D172: a partial choice leaves only the remainder pending.
		const missing = count - (character.languages ?? []).filter((language) => language.grantedBy === grantedBy).length
		const label = count === 1 ? `Extra language (${grant.featureName})` : `${missing} extra ${missing === 1 ? 'language' : 'languages'} (${grant.featureName})`
		addPending(missing, `${grant.className} — ${grant.featureName}`, 'class', label)
	}

	for (const ref of takenFeats) {
		const feat = feats.find((candidate) => candidate.name === ref.name && candidate.source === ref.source)
		if (!feat) continue
		const source: ProficiencySource = { kind: 'feat', name: `${feat.name} (feat)` }
		const stored = ref.proficiencies?.languages ?? []
		stored.forEach((language) => addLanguage(language.name, source))
		let free = 0
		for (const entry of feat.languageProficiencies ?? []) {
			for (const [token, granted] of Object.entries(entry)) {
				if (token === 'any' && typeof granted === 'number') free += granted
				else if (granted === true) addLanguage(capitalize(token), source)
			}
		}
		addPending(free - stored.length, source.name, 'feat')
		// D173: Skilled's picks may be skills, so a stored tool is shown but nothing is ever owed for it.
		const storedTools = ref.proficiencies?.tools ?? []
		storedTools.forEach((tool) => addTool(tool, source))
		const toolEntries = feat.toolProficiencies ?? []
		for (const entry of toolEntries) for (const [token, granted] of Object.entries(entry)) if (granted === true) addTool(titleCase(token), source)
		const toolChoicesOwed = toolEntries.flatMap(toolChoices)
		if (toolChoicesOwed.length > 0) {
			const remaining = toolChoicesOwed.reduce((sum, choice) => sum + choice.count, 0) - storedTools.length
			addPendingTool(remaining, nounText(toolChoicesOwed[0].noun, remaining), feat.name, source)
		}
		for (const entry of feat.armorProficiencies ?? []) for (const [token, granted] of Object.entries(entry)) if (granted) addArmor(token, source)
		for (const grant of weaponProficiencyGrantsForFeats([ref], feats)) addWeapon(grant, source)
		if (feat.weaponProficiencies?.some((entry) => entry['improvised'])) add(weapons, 'improvised', 'Improvised weapons', source)
	}

	// D170: a Monk/Rogue subset says nothing once full Martial weapons are there.
	if (weapons.has('martial')) for (const key of [...weapons.keys()]) if (key.startsWith('martial:')) weapons.delete(key)

	return {
		armor: ARMOR_ORDER.flatMap((key) => armor.get(key) ?? []),
		weapons: [...weapons.values()].sort((a, b) => weaponRank(a.key) - weaponRank(b.key)),
		tools: [...[...tools.values()].sort((a, b) => a.label.localeCompare(b.label)), ...pendingTools],
		languages: [
			...[...languages.values()].sort((a, b) => Number(b.key === 'common') - Number(a.key === 'common') || a.label.localeCompare(b.label)),
			...pending,
		],
	}
}
