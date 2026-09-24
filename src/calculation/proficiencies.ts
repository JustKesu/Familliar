import { classPrereqInfoFor } from '../featAsi/featAsiData'
import { CLASS_FEATURE_LANGUAGE_GRANTS, classFeatureLanguageGrantsFor } from '../languages/classFeatureLanguages'
import type { FeatRef } from '../featAsi/featInstances'
import { ARTIFICER_SUBCLASS_TOOLS, classToolGrantsFor } from '../toolProficiencies/classToolChoices'
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

interface FeatureGrant {
	className: string
	source: ProficiencySource
	applies: (character: Character, parsedClasses: unknown) => boolean
	armor: string[]
	/** A category token (`martial`) or a key of EXTRA_WEAPON_LABELS. */
	weapons: string[]
	tools?: string[]
	languages?: string[]
	/** D176: a weapon choice with no picker yet, shown as one pending row. */
	pendingWeapons?: string
}

const EXTRA_WEAPON_LABELS: Record<string, string> = { 'martial:ranged': 'Martial ranged weapons', scimitar: 'Scimitar' }

/** The stored subclass name resolved to the source of its offered classes.json entry (storage keeps no source). */
function subclassSourceOf(parsedClasses: unknown, cls: Character['classes'][number]): string | null {
	if (!Array.isArray(parsedClasses)) return null
	const entry = parsedClasses.find(
		(candidate) =>
			isRecord(candidate) &&
			candidate['entryType'] === 'subclass' &&
			candidate['className'] === cls.className &&
			candidate['classSource'] === cls.classSource &&
			candidate['name'] === cls.subclass &&
			!candidate['reprintedAs'],
	)
	return isRecord(entry) && typeof entry['source'] === 'string' ? entry['source'] : null
}

// D176: every non-XPHB grant arrives at class level 3, whatever level the 2014 feature entry carries (DATA.md).
function subclassGrant(className: string, subclass: string, subclassSource: string, grants: Partial<FeatureGrant>, classSource = 'XPHB'): FeatureGrant {
	return {
		className,
		source: { kind: 'subclass', name: subclass },
		applies: (character, parsedClasses) =>
			character.classes.some(
				(cls) => cls.className === className && cls.classSource === classSource && cls.subclass === subclass && cls.level >= 3 && subclassSourceOf(parsedClasses, cls) === subclassSource,
			),
		armor: [],
		weapons: [],
		...grants,
	}
}

// D170: XPHB class/subclass grants exist only in feature text (DATA.md), so they are a hand table. D176 adds the non-XPHB subclasses, keyed by name AND source.
const FEATURE_GRANTS: FeatureGrant[] = [
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
	subclassGrant('Artificer', 'Alchemist', 'EFA', { tools: ARTIFICER_SUBCLASS_TOOLS['Alchemist'] }, 'EFA'),
	subclassGrant('Artificer', 'Armorer', 'EFA', { armor: ['heavy'], tools: ARTIFICER_SUBCLASS_TOOLS['Armorer'] }, 'EFA'),
	subclassGrant('Artificer', 'Artillerist', 'EFA', { weapons: ['martial:ranged'], tools: ARTIFICER_SUBCLASS_TOOLS['Artillerist'] }, 'EFA'),
	subclassGrant('Artificer', 'Battle Smith', 'EFA', { weapons: ['martial'], tools: ARTIFICER_SUBCLASS_TOOLS['Battle Smith'] }, 'EFA'),
	subclassGrant('Artificer', 'Cartographer', 'EFA', { tools: ARTIFICER_SUBCLASS_TOOLS['Cartographer'] }, 'EFA'),
	subclassGrant('Bard', 'College of Swords', 'XGE', { armor: ['medium'], weapons: ['scimitar'] }),
	subclassGrant('Cleric', 'Forge Domain', 'XGE', { armor: ['heavy'], tools: ["Smith's Tools"] }),
	subclassGrant('Cleric', 'Order Domain', 'TCE', { armor: ['heavy'] }),
	subclassGrant('Cleric', 'Twilight Domain', 'TCE', { armor: ['heavy'], weapons: ['martial'] }),
	subclassGrant('Druid', 'Circle of the Shepherd', 'XGE', { languages: ['Sylvan'] }),
	subclassGrant('Fighter', 'Rune Knight', 'TCE', { tools: ["Smith's Tools"], languages: ['Giant'] }),
	subclassGrant('Monk', 'Way of the Drunken Master', 'XGE', { tools: ["Brewer's Supplies"] }),
	subclassGrant('Monk', 'Way of the Kensei', 'XGE', { pendingWeapons: 'Kensei weapons' }),
	subclassGrant('Rogue', 'Mastermind', 'XGE', { tools: ['Disguise Kit', 'Forgery Kit'] }),
	subclassGrant('Sorcerer', 'Storm Sorcery', 'XGE', { languages: ['Primordial'] }),
	subclassGrant('Warlock', 'The Hexblade', 'XGE', { armor: ['medium', 'shield'], weapons: ['martial'] }),
]

// D173: the two "choose" shapes in classes.json / feats.json. `any` is Prodigy's untyped pick.
const TOOL_CHOICE_NOUNS: Record<string, [string, string]> = {
	anyArtisansTool: ["artisan's tool", "artisan's tools"],
	anyMusicalInstrument: ['musical instrument', 'musical instruments'],
	anyGamingSet: ['gaming set', 'gaming sets'],
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

/** D176: the tools held from a source other than the subclass — what an Artificer subclass's replacement count reads. */
export function toolsHeldElsewhere(tools: readonly ProficiencyItem[], subclass: string | null): string[] {
	return tools.filter((item) => !item.pending && item.sources.some((source) => source.name !== subclass)).map((item) => item.label)
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
		// D174: stored picks join the tools, and only the remainder stays pending.
		const startGrant = classToolGrantsFor(character.classes).find((grant) => !grant.subclass)
		const startPicks = (character.toolChoices ?? []).filter((choice) => choice.grantedBy === startGrant?.grantedBy)
		startPicks.forEach((choice) => addTool(choice.name, source))
		if (toolEntries.length > 1) {
			const choices = toolEntries.flatMap(toolChoices)
			const remaining = Math.max(0, (choices[0]?.count ?? 0) - startPicks.length)
			addPendingTool(remaining, choices.map((choice) => nounText(choice.noun, remaining)).join(' or '), startingClass.className, source)
		} else {
			let unassigned = startPicks.length
			for (const entry of toolEntries) {
				for (const [token, granted] of Object.entries(entry)) if (granted === true) addTool(titleCase(token), source)
				for (const { noun, count } of toolChoices(entry)) {
					const remaining = Math.max(0, count - unassigned)
					unassigned = Math.max(0, unassigned - count)
					addPendingTool(remaining, nounText(noun, remaining), startingClass.className, source)
				}
			}
		}
	}

	if (character.background?.toolProficiency) {
		addTool(character.background.toolProficiency, { kind: 'background', name: `${character.background.name} (background)` })
	}

	const pendingWeapons: ProficiencyItem[] = []
	for (const grant of FEATURE_GRANTS) {
		if (!grant.applies(character, parsedClasses)) continue
		grant.armor.forEach((token) => addArmor(token, grant.source))
		grant.weapons.forEach((key) => (EXTRA_WEAPON_LABELS[key] ? add(weapons, key, EXTRA_WEAPON_LABELS[key], grant.source) : addWeapon({ kind: 'category', category: key }, grant.source)))
		grant.tools?.forEach((tool) => addTool(titleCase(tool), grant.source))
		grant.languages?.forEach((language) => addLanguage(language, grant.source))
		if (grant.pendingWeapons) pendingWeapons.push({ key: `pending:weapons:${grant.source.name}`, label: `${grant.pendingWeapons} — not chosen`, sources: [grant.source], pending: true })
	}

	const featureLanguageSource = (grant: (typeof CLASS_FEATURE_LANGUAGE_GRANTS)[number]) => `${grant.subclass ?? grant.className} — ${grant.featureName}`

	for (const language of character.languages ?? []) {
		const grant = CLASS_FEATURE_LANGUAGE_GRANTS.find((candidate) => candidate.choice?.grantedBy === language.grantedBy)
		if (grant) addLanguage(language.name, { kind: 'classFeatureChoice', name: featureLanguageSource(grant) })
		else addLanguage(language.name, { kind: 'creation', name: language.grantedBy === 'automatic' ? 'Every character' : 'Chosen at creation' })
	}

	for (const grant of classFeatureLanguageGrantsFor(character.classes)) {
		if (grant.fixed) addLanguage(grant.fixed, { kind: 'class', name: grant.className })
		if (!grant.choice) continue
		const { count, grantedBy } = grant.choice
		// D172: a partial choice leaves only the remainder pending.
		const missing = count - (character.languages ?? []).filter((language) => language.grantedBy === grantedBy).length
		const label = count === 1 ? `Extra language (${grant.featureName})` : `${missing} extra ${missing === 1 ? 'language' : 'languages'} (${grant.featureName})`
		addPending(missing, featureLanguageSource(grant), grant.subclass ? 'subclass' : 'class', label)
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

	// D174: a subclass's own pick (Battle Master), pending until a slot stores it. After every other tool source,
	// since D176's Artificer replacement count is the subclass tools the character also has from elsewhere.
	for (const grant of classToolGrantsFor(character.classes, toolsHeldElsewhere([...tools.values()], startingClass?.subclass ?? null))) {
		if (!grant.subclass) continue
		const source: ProficiencySource = { kind: 'subclass', name: grant.owner }
		const picks = (character.toolChoices ?? []).filter((choice) => choice.grantedBy === grant.grantedBy)
		picks.slice(0, grant.count).forEach((choice) => addTool(choice.name, source))
		// D176: a replacement whose duplicate went away stays stored and shown, but grants nothing.
		picks.slice(grant.count).forEach((choice) => pendingTools.push({ key: `surplus:${choice.name}`, label: `${choice.name} — no longer owed, not counted`, sources: [source] }))
		const remaining = Math.max(0, grant.count - picks.length)
		const nouns = grant.options ? grant.options.join(' or ') : nounText(TOOL_CHOICE_NOUNS[grant.categories[0]], remaining)
		addPendingTool(remaining, nouns, grant.owner, source)
	}

	// D170: a Monk/Rogue subset says nothing once full Martial weapons are there.
	if (weapons.has('martial')) for (const key of [...weapons.keys()]) if (key.startsWith('martial:')) weapons.delete(key)

	return {
		armor: ARMOR_ORDER.flatMap((key) => armor.get(key) ?? []),
		weapons: [...[...weapons.values()].sort((a, b) => weaponRank(a.key) - weaponRank(b.key)), ...pendingWeapons],
		tools: [...[...tools.values()].sort((a, b) => a.label.localeCompare(b.label)), ...pendingTools],
		languages: [
			...[...languages.values()].sort((a, b) => Number(b.key === 'common') - Number(a.key === 'common') || a.label.localeCompare(b.label)),
			...pending,
		],
	}
}
