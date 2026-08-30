/*
 * Starting equipment (build order step 7, slice a2): what a class and a
 * background each offer a new character, resolved into items the inventory can
 * actually hold and coins it can hold as copper (D74).
 *
 * Shapes confirmed by scripts/investigate-starting-equipment.js, not assumed:
 *
 * - classes.json `startingEquipment.defaultData` is ONE row on all 13 classes,
 *   keyed "A"/"B" (Fighter alone also has "C"). backgrounds.json
 *   `startingEquipment` is a 1-element array keyed "A"/"B" on the 16 XPHB
 *   backgrounds and "a"/"b" on the 17 EFA ones, so the key is read as stored
 *   and never assumed uppercase.
 * - An option's elements are: a bare item-code string (backgrounds only, 59 of
 *   them), `{item}`, `{item,quantity}`, `{item,displayName}`, `{value}` in
 *   copper, `{equipmentType}`, `{equipmentTypes}` (Monk: instrument OR artisan
 *   tools) and `{special}` (Wizard's Spellbook, the only one). Anything else
 *   throws rather than being silently dropped.
 * - All 76 item codes carry an explicit `|source`; the code's name is
 *   lowercase, so resolution is case-insensitive and reports items.json's own
 *   spelling. Exactly 4 codes do not resolve — "holy symbol|xphb",
 *   "druidic focus|xphb", "gaming set|xphb" and "musical instrument|xphb" are
 *   5etools item GROUPS, which extraction excludes from items.json (D34), so
 *   they are categories the player picks from, not items.
 * - `{special: "Spellbook"}` carries no source, so it is resolved by NAME. It
 *   resolves to `Spellbook|PHB`, which is in items.json only because extraction
 *   admits, by name, the items a class's or background's starting equipment
 *   names but the source filter would drop (see DATA.md, "Items named by a
 *   feature" — the items counterpart of D72). If that intake ever goes, this
 *   falls back to an unresolved grant rather than dropping the item.
 * - 13 items carry `packContents` (the 7 named packs plus 6 ammunition/spike
 *   bundles). Daniel's decision: every one of them is expanded into its
 *   contents, so nothing in the inventory is an opaque line.
 */

import { loadDataFile } from '../dataLoader/dataLoader'
import { copperToCoins } from './currency'
import type { ItemRef } from './inventoryData'
import type { CharacterInventoryItem } from '../storage/character'

/** Which side of the wizard's equipment step an option belongs to. */
export type EquipmentOrigin = 'class' | 'background'

/** The item categories the starting-equipment data actually names — the three `equipmentType` values plus the two focus groups reached through an item code. */
export type EquipmentCategory = 'toolArtisan' | 'instrumentMusical' | 'setGaming' | 'focusHoly' | 'focusDruidic'

export interface ItemGrant extends ItemRef {
	quantity: number
	/** Not present in items.json, so the sheet shows it with a D43 note. Nothing in today's data reaches this. */
	unresolved?: boolean
}

export type StartingEquipmentElement =
	/** `label` is what the data offered ("Explorer's Pack"); `items` is what the character ends up holding, packs already expanded. */
	| { kind: 'items'; label: string; items: ItemGrant[] }
	| { kind: 'coins'; copper: number; label: string }
	| { kind: 'category'; categories: EquipmentCategory[]; label: string }

export interface StartingEquipmentOption {
	/** The data's own key — "A"/"B"/"C" or "a"/"b". */
	key: string
	label: string
	elements: StartingEquipmentElement[]
}

export interface StartingEquipmentOffer {
	options: StartingEquipmentOption[]
}

/** The player's picks. Category picks are keyed by `categoryPickKey` so a class and a background pick can never collide. */
export interface StartingEquipmentChoice {
	classOptionKey: string | null
	backgroundOptionKey: string | null
	categoryPicks: Record<string, ItemRef>
}

export function emptyStartingEquipmentChoice(): StartingEquipmentChoice {
	return { classOptionKey: null, backgroundOptionKey: null, categoryPicks: {} }
}

export function categoryPickKey(origin: EquipmentOrigin, optionKey: string, elementIndex: number): string {
	return `${origin}:${optionKey}:${elementIndex}`
}

const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
	toolArtisan: "artisan's tools",
	instrumentMusical: 'a musical instrument',
	setGaming: 'a gaming set',
	focusHoly: 'a holy symbol',
	focusDruidic: 'a druidic focus',
}

/**
 * The item-group codes that stand in for a category. They are absent from
 * items.json by D34, so they are matched before the item lookup rather than
 * after it failing.
 */
const ITEM_GROUP_CATEGORIES: Record<string, EquipmentCategory> = {
	'holy symbol|xphb': 'focusHoly',
	'druidic focus|xphb': 'focusDruidic',
	'gaming set|xphb': 'setGaming',
	'musical instrument|xphb': 'instrumentMusical',
}

/**
 * Structural filters over items.json. AT/GS/INS repeat what
 * toolProficiencyData.ts uses for the background's tool choice — the same
 * three codes, confirmed by the same survey — but this list also needs the two
 * spellcasting-focus groups and returns name+source, since these picks become
 * inventory refs rather than a proficiency name. INS and SCF additionally
 * filter on rarity: both codes are shared with magic items.
 */
const CATEGORY_FILTERS: Record<EquipmentCategory, (item: Record<string, unknown>) => boolean> = {
	toolArtisan: (item) => typeCode(item) === 'AT',
	setGaming: (item) => typeCode(item) === 'GS',
	instrumentMusical: (item) => typeCode(item) === 'INS' && item['rarity'] === 'none',
	focusHoly: (item) => typeCode(item) === 'SCF' && item['scfType'] === 'holy' && item['rarity'] === 'none',
	focusDruidic: (item) => typeCode(item) === 'SCF' && item['scfType'] === 'druid' && item['rarity'] === 'none',
}

export const EQUIPMENT_CATEGORIES = Object.keys(CATEGORY_FILTERS) as EquipmentCategory[]

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function typeCode(item: Record<string, unknown>): string | null {
	return typeof item['type'] === 'string' ? item['type'].split('|')[0] : null
}

function titleCase(text: string): string {
	return text
		.split(' ')
		.map((word) => (word.length === 0 ? word : word[0].toUpperCase() + word.slice(1)))
		.join(' ')
}

interface IndexedItem {
	name: string
	source: string
	packContents?: unknown[]
}

export interface ItemIndex {
	/** Keyed by lowercase `name|source`. */
	byCode: Map<string, IndexedItem>
	/** Keyed by lowercase name — the only way a `{special}` element could be resolved, since it carries no source. */
	byName: Map<string, IndexedItem>
}

export function buildItemIndex(parsedItems: unknown): ItemIndex {
	if (!Array.isArray(parsedItems)) {
		throw new Error('items.json: expected a top-level array.')
	}
	const byCode = new Map<string, IndexedItem>()
	const byName = new Map<string, IndexedItem>()
	for (const entry of parsedItems) {
		if (!isRecord(entry) || typeof entry['name'] !== 'string' || typeof entry['source'] !== 'string') continue
		const item: IndexedItem = {
			name: entry['name'],
			source: entry['source'],
			...(Array.isArray(entry['packContents']) ? { packContents: entry['packContents'] } : {}),
		}
		byCode.set(`${item.name.toLowerCase()}|${item.source.toLowerCase()}`, item)
		if (!byName.has(item.name.toLowerCase())) byName.set(item.name.toLowerCase(), item)
	}
	return { byCode, byName }
}

/** The items one or more categories offer, name+source, sorted and de-duplicated. */
export function itemCategoryOptions(parsedItems: unknown, categories: readonly EquipmentCategory[]): ItemRef[] {
	if (!Array.isArray(parsedItems)) {
		throw new Error('items.json: expected a top-level array.')
	}
	const refs = new Map<string, ItemRef>()
	for (const entry of parsedItems) {
		if (!isRecord(entry) || typeof entry['name'] !== 'string' || typeof entry['source'] !== 'string') continue
		if (!categories.some((category) => CATEGORY_FILTERS[category](entry))) continue
		refs.set(`${entry['name']}|${entry['source']}`, { name: entry['name'], source: entry['source'] })
	}
	return [...refs.values()].sort((a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source))
}

/**
 * Turns one item code into what the character actually holds. A pack is
 * replaced by its contents, recursively and with the outer quantity carried
 * down; `seen` stops a pack that (however wrongly) listed itself.
 */
function expandItemCode(code: string, quantity: number, index: ItemIndex, seen: ReadonlySet<string> = new Set()): ItemGrant[] {
	const key = code.toLowerCase()
	const entry = index.byCode.get(key)
	if (!entry) {
		const [rawName, rawSource] = code.split('|')
		return [{ name: titleCase(rawName), source: (rawSource ?? '').toUpperCase(), quantity, unresolved: true }]
	}
	if (!entry.packContents || seen.has(key)) {
		return [{ name: entry.name, source: entry.source, quantity }]
	}
	const nested = new Set([...seen, key])
	const grants: ItemGrant[] = []
	for (const content of entry.packContents) {
		if (typeof content === 'string') {
			grants.push(...expandItemCode(content, quantity, index, nested))
			continue
		}
		if (isRecord(content) && typeof content['item'] === 'string') {
			const contentQuantity = typeof content['quantity'] === 'number' ? content['quantity'] : 1
			grants.push(...expandItemCode(content['item'], quantity * contentQuantity, index, nested))
			continue
		}
		throw new Error(`startingEquipment: unrecognised packContents entry in "${entry.name}": ${JSON.stringify(content)}`)
	}
	return grants
}

function coinLabel(copper: number): string {
	const coins = copperToCoins(copper)
	const parts: string[] = []
	if (coins.gp > 0) parts.push(`${coins.gp} gp`)
	if (coins.sp > 0) parts.push(`${coins.sp} sp`)
	if (coins.cp > 0) parts.push(`${coins.cp} cp`)
	return parts.length > 0 ? parts.join(', ') : '0 gp'
}

function categoryElement(categories: EquipmentCategory[]): StartingEquipmentElement {
	return {
		kind: 'category',
		categories,
		label: `${categories.map((category) => CATEGORY_LABELS[category]).join(' or ')} (your choice)`,
	}
}

function itemsElement(code: string, quantity: number, displayName: string | undefined, index: ItemIndex): StartingEquipmentElement {
	const items = expandItemCode(code, quantity, index)
	const resolvedName = index.byCode.get(code.toLowerCase())?.name ?? titleCase(code.split('|')[0])
	const label = quantity > 1 ? `${displayName ?? resolvedName} ×${quantity}` : (displayName ?? resolvedName)
	return { kind: 'items', label, items }
}

function parseElement(raw: unknown, index: ItemIndex): StartingEquipmentElement {
	if (typeof raw === 'string') {
		const category = ITEM_GROUP_CATEGORIES[raw.toLowerCase()]
		return category ? categoryElement([category]) : itemsElement(raw, 1, undefined, index)
	}
	if (!isRecord(raw)) {
		throw new Error(`startingEquipment: unrecognised element ${JSON.stringify(raw)}`)
	}
	if (typeof raw['value'] === 'number') {
		return { kind: 'coins', copper: raw['value'], label: coinLabel(raw['value']) }
	}
	if (typeof raw['equipmentType'] === 'string') {
		return categoryElement([asCategory(raw['equipmentType'])])
	}
	if (Array.isArray(raw['equipmentTypes'])) {
		return categoryElement(raw['equipmentTypes'].map((value) => asCategory(String(value))))
	}
	if (typeof raw['item'] === 'string') {
		const category = ITEM_GROUP_CATEGORIES[raw['item'].toLowerCase()]
		if (category) return categoryElement([category])
		const quantity = typeof raw['quantity'] === 'number' ? raw['quantity'] : 1
		const displayName = typeof raw['displayName'] === 'string' ? raw['displayName'] : undefined
		return itemsElement(raw['item'], quantity, displayName, index)
	}
	if (typeof raw['special'] === 'string') {
		return specialElement(raw['special'], index)
	}
	throw new Error(`startingEquipment: unrecognised element ${JSON.stringify(raw)}`)
}

/** A `{special}` element names an item by prose, with no source — see this file's header for how "Spellbook", the only one, reaches items.json. */
function specialElement(special: string, index: ItemIndex): StartingEquipmentElement {
	const entry = index.byName.get(special.toLowerCase())
	const grant: ItemGrant = entry
		? { name: entry.name, source: entry.source, quantity: 1 }
		: { name: special, source: 'PHB', quantity: 1, unresolved: true }
	return { kind: 'items', label: special, items: [grant] }
}

function asCategory(value: string): EquipmentCategory {
	if (!(value in CATEGORY_FILTERS)) {
		throw new Error(`startingEquipment: unrecognised equipment category "${value}"`)
	}
	return value as EquipmentCategory
}

function parseOptionRow(row: Record<string, unknown>, index: ItemIndex): StartingEquipmentOption[] {
	const options: StartingEquipmentOption[] = []
	for (const key of Object.keys(row).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))) {
		const value = row[key]
		if (!Array.isArray(value)) {
			throw new Error(`startingEquipment: option "${key}" is not an array`)
		}
		options.push({
			key,
			label: `Option ${key.toUpperCase()}`,
			elements: value.map((element) => parseElement(element, index)),
		})
	}
	if (options.length === 0) {
		throw new Error('startingEquipment: no options in the entry')
	}
	return options
}

export function extractClassStartingEquipment(
	parsedClasses: unknown,
	className: string,
	classSource: string,
	index: ItemIndex,
): StartingEquipmentOffer {
	if (!Array.isArray(parsedClasses)) {
		throw new Error('classes.json: expected a top-level array.')
	}
	const entry = parsedClasses.find(
		(candidate) =>
			isRecord(candidate) &&
			candidate['entryType'] === 'class' &&
			candidate['name'] === className &&
			candidate['source'] === classSource,
	)
	if (!isRecord(entry)) {
		throw new Error(`classes.json: no class "${className}" (${classSource}).`)
	}
	const startingEquipment = entry['startingEquipment']
	const defaultData = isRecord(startingEquipment) ? startingEquipment['defaultData'] : undefined
	if (!Array.isArray(defaultData) || defaultData.length !== 1 || !isRecord(defaultData[0])) {
		throw new Error(`classes.json: "${className}" has no single-row startingEquipment.defaultData.`)
	}
	return { options: parseOptionRow(defaultData[0], index) }
}

export function extractBackgroundStartingEquipment(
	parsedBackgrounds: unknown,
	name: string,
	source: string,
	index: ItemIndex,
): StartingEquipmentOffer {
	if (!Array.isArray(parsedBackgrounds)) {
		throw new Error('backgrounds.json: expected a top-level array.')
	}
	const entry = parsedBackgrounds.find(
		(candidate) => isRecord(candidate) && candidate['name'] === name && candidate['source'] === source,
	)
	if (!isRecord(entry)) {
		throw new Error(`backgrounds.json: no background "${name}" (${source}).`)
	}
	return parseBackgroundStartingEquipment(entry['startingEquipment'], name, index)
}

/**
 * One background's raw `startingEquipment` field: a 1-element array holding the
 * option row. Exported because backgroundData.ts renders the same field as the
 * background step's preview — one parser over the shape, two renderings of it.
 */
export function parseBackgroundStartingEquipment(raw: unknown, backgroundName: string, index: ItemIndex): StartingEquipmentOffer {
	if (!Array.isArray(raw) || raw.length !== 1 || !isRecord(raw[0])) {
		throw new Error(`backgrounds.json: "${backgroundName}" has no single-row startingEquipment.`)
	}
	return { options: parseOptionRow(raw[0], index) }
}

export function findOption(offer: StartingEquipmentOffer | null, key: string | null): StartingEquipmentOption | null {
	if (!offer || key === null) return null
	return offer.options.find((option) => option.key === key) ?? null
}

/** The category-pick keys a chosen option still needs filled — the step's own "not finished yet" list. */
export function missingCategoryPicks(
	offer: StartingEquipmentOffer | null,
	origin: EquipmentOrigin,
	choice: StartingEquipmentChoice,
): string[] {
	const option = findOption(offer, origin === 'class' ? choice.classOptionKey : choice.backgroundOptionKey)
	if (!option) return []
	return option.elements
		.map((element, elementIndex) => (element.kind === 'category' ? categoryPickKey(origin, option.key, elementIndex) : null))
		.filter((key): key is string => key !== null && choice.categoryPicks[key] === undefined)
}

/** Both packages chosen and every category element inside them picked. */
export function isStartingEquipmentComplete(
	classOffer: StartingEquipmentOffer | null,
	backgroundOffer: StartingEquipmentOffer | null,
	choice: StartingEquipmentChoice,
): boolean {
	if (findOption(classOffer, choice.classOptionKey) === null) return false
	if (findOption(backgroundOffer, choice.backgroundOptionKey) === null) return false
	return missingCategoryPicks(classOffer, 'class', choice).length === 0 && missingCategoryPicks(backgroundOffer, 'background', choice).length === 0
}

/**
 * The class's chosen option and the background's chosen option combined into
 * one inventory and one copper total (D74). Identical items merge and their
 * quantities add, so a Fighter who gets daggers from both sides carries one
 * line, not two.
 */
export function buildStartingInventory(
	classOffer: StartingEquipmentOffer | null,
	backgroundOffer: StartingEquipmentOffer | null,
	choice: StartingEquipmentChoice,
): { inventory: CharacterInventoryItem[]; currencyCopper: number } {
	const merged = new Map<string, CharacterInventoryItem>()
	let currencyCopper = 0

	function add(grant: { name: string; source: string; quantity: number }): void {
		const key = `${grant.name}|${grant.source}`
		const existing = merged.get(key)
		merged.set(key, existing ? { ...existing, quantity: existing.quantity + grant.quantity } : { ...grant })
	}

	for (const origin of ['class', 'background'] as const) {
		const offer = origin === 'class' ? classOffer : backgroundOffer
		const option = findOption(offer, origin === 'class' ? choice.classOptionKey : choice.backgroundOptionKey)
		if (!option) continue
		option.elements.forEach((element, elementIndex) => {
			if (element.kind === 'coins') {
				currencyCopper += element.copper
				return
			}
			if (element.kind === 'items') {
				for (const item of element.items) add({ name: item.name, source: item.source, quantity: item.quantity })
				return
			}
			const pick = choice.categoryPicks[categoryPickKey(origin, option.key, elementIndex)]
			if (pick) add({ ...pick, quantity: 1 })
		})
	}

	return {
		inventory: [...merged.values()].sort((a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source)),
		currencyCopper,
	}
}

export async function loadClassStartingEquipment(className: string, classSource: string): Promise<StartingEquipmentOffer> {
	const [parsedClasses, parsedItems] = await Promise.all([loadDataFile('data/classes.json'), loadDataFile('data/items.json')])
	return extractClassStartingEquipment(parsedClasses, className, classSource, buildItemIndex(parsedItems))
}

export async function loadBackgroundStartingEquipment(name: string, source: string): Promise<StartingEquipmentOffer> {
	const [parsedBackgrounds, parsedItems] = await Promise.all([
		loadDataFile('data/backgrounds.json'),
		loadDataFile('data/items.json'),
	])
	return extractBackgroundStartingEquipment(parsedBackgrounds, name, source, buildItemIndex(parsedItems))
}

/** Every category's item list, loaded once — the picker needs whichever ones the chosen options ask for. */
export async function loadEquipmentCategoryItems(): Promise<Record<EquipmentCategory, ItemRef[]>> {
	const parsedItems = await loadDataFile('data/items.json')
	const entries = EQUIPMENT_CATEGORIES.map((category) => [category, itemCategoryOptions(parsedItems, [category])] as const)
	return Object.fromEntries(entries) as Record<EquipmentCategory, ItemRef[]>
}
