/*
 * The item file, reduced to what the inventory picker and the sheet's
 * item-resolution need: a name + source per entry (build order step 7, slice
 * a1), plus the gear fields slice b's equip control and Armour Class read
 * (type code, armour/weapon flags, ac, strength, stealth) and the weapon
 * fields slice c's attack lines read (category, damage, properties, mastery,
 * range). The whole file is
 * offered — magic items included (Daniel's decision) — so nothing is filtered
 * here beyond dropping malformed rows.
 *
 * Referenced items are identified by name + source, the same convention every
 * other stored pick in this project uses (CharacterSpellChoice,
 * CharacterWildShapeForms). A stored item whose (name, source) is absent from
 * this list is not dropped — the sheet shows it with a note (D43).
 */

import { loadDataFile } from '../dataLoader/dataLoader'
import type { CharacterInventoryItem, CustomItemDefinition, CustomItemKind } from '../storage/character'

export interface ItemRef {
	name: string
	source: string
	/**
	 * items.json `type`, first segment only ("HA|XPHB" -> "HA"). DATA.md,
	 * "Identifying item kinds": the `armor`/`weapon` flags are carried by
	 * MUNDANE gear only, so the type code has to be read as well or all 61
	 * magic weapons and armours read as ordinary gear. Omitted when the item
	 * carries no `type` at all (258 of them do not).
	 */
	typeCode?: string
	/** items.json `armor` — mundane armour only, see typeCode. */
	armor?: boolean
	/** items.json `weapon` — mundane weapons only, see typeCode. */
	weapon?: boolean
	/** Base AC for a suit of armour; for a shield this is the BONUS (always 2), never a total — DATA.md, "Identifying item kinds". */
	ac?: number
	/** Minimum Strength score for heavy armour, stored as a STRING ("13"/"15") — DATA.md, "Armour AC". Only HA entries carry it. */
	strength?: string
	/** True when wearing the armour gives disadvantage on Stealth checks. */
	stealth?: boolean
	/*
	 * The weapon fields slice c's attack lines read. Field presence measured by
	 * scripts/investigate-weapon-attack-fields.js over the 95 weapons: dmg1 and
	 * dmgTypeFull on all of them, dmg2 on exactly the 42 Versatile ones, range
	 * on 33 (every ranged weapon plus all 16 Thrown ones).
	 */
	/** "simple" or "martial" — what isProficientWithWeapon matches on. */
	weaponCategory?: string
	/** Damage dice, e.g. "1d8". */
	dmg1?: string
	/** Two-handed damage dice of a Versatile weapon, e.g. "1d10". */
	dmg2?: string
	/** Damage type in words, resolved by extraction (D34), e.g. "slashing". */
	dmgTypeFull?: string
	/** Weapon properties in words (D34), e.g. ["Versatile"]. */
	propertyFull?: string[]
	/** Weapon mastery properties in words (D34), e.g. ["Sap"]. */
	masteryFull?: string[]
	/** Normal/long range as the data writes it, e.g. "30/120". */
	range?: string
	/** items.json `firearm` — the Gunner feat's grant matches on it. */
	firearm?: boolean
	/**
	 * True when items.json `reqAttune` says the item is attuned to before it
	 * works (slice d). 272 items carry the field: 174 as boolean `true`, 98 as a
	 * restriction sentence — and nothing states the requirement anywhere else
	 * (counted over data/items.json for slice d, docs/REPORT.md).
	 */
	requiresAttunement?: boolean
	/**
	 * The restriction sentence, verbatim as the data writes it ("by a
	 * spellcaster"), when `reqAttune` is a string. Shown to the player and never
	 * evaluated: deciding "by a creature of good alignment" means reading prose,
	 * which D21 keeps out of the app.
	 */
	attunementCondition?: string
	/**
	 * items.json `bonusWeapon`, parsed from its "+1" STRING form (slice e). One
	 * key covers both the attack roll and the damage roll: the survey found no
	 * item whose two differ, and `bonusWeaponAttack` does not occur at all
	 * (scripts/investigate-magic-bonuses.js). On 21 weapons and, deliberately
	 * unused here, on 8 items that are not weapons (Wraps of Unarmed Power).
	 */
	bonusWeapon?: number
	/**
	 * items.json `bonusAc`, parsed from its "+1" string form (slice e). NOT
	 * already included in `ac`: Dragon Scale Mail is `ac: 14` plus `bonusAc:
	 * "+1"`. Present on 11 suits, 3 shields and — deliberately unused here — 8
	 * wondrous items and 2 weapons.
	 */
	bonusAc?: number
	/*
	 * The five flat bonuses a WORN magic item carries (slice h), each parsed
	 * from the same "+N" string form. Every carrier of these five requires
	 * attunement — the slice's survey (scripts/investigate-worn-bonuses.js)
	 * found the only two unattunable carriers of any of the six bonus fields
	 * are a suit of armour and a shield carrying `bonusAc`, which reach Armour
	 * Class through the armour role instead (see wornAcBonusOf).
	 */
	/** On 6 items (Cloak of Protection, Ring of Protection, Robe of Stars, Rod of Alertness, Staff of Power, Stone of Good Luck). */
	bonusSavingThrow?: number
	/** On 30 items; 22 of them carry bonusSpellSaveDc with the same number. */
	bonusSpellAttack?: number
	/** On 23 items. */
	bonusSpellSaveDc?: number
	/** On 1 item (Stone of Good Luck). */
	bonusAbilityCheck?: number
	/** On 1 item (Ioun Stone of Mastery). Parsed but deliberately not applied — see src/calculation/itemFlatBonuses.ts. */
	bonusProficiencyBonus?: number
	/**
	 * items.json `resist` / `immune` (slice f), each an array of lowercase
	 * damage-type strings. 54 items carry `resist` and 3 carry `immune`; no item
	 * carries the choice shape the 2 species and 1 feat use, and `vulnerable`
	 * occurs nowhere in the data at all
	 * (scripts/investigate-damage-responses.js). `conditionImmune` (1 item) is
	 * conditions, not damage, and is deliberately not read.
	 */
	resist?: string[]
	immune?: string[]
	/**
	 * The item's own description, exactly as items.json writes it (slice g).
	 * `entries` is the ONLY prose key on an item — no `fluff`, no
	 * `additionalEntries` (scripts/investigate-item-descriptions.js) — and 729
	 * of the 900 items carry one; the other 171 have no description at all,
	 * which is why this is optional rather than an empty array.
	 *
	 * Left as `unknown[]`: the array mixes strings with nested `entries`,
	 * `item`, `list`, `table` and `inset` objects, which is precisely the shape
	 * src/markup's <Entries> walks. Nothing here reads INTO it (D21).
	 */
	entries?: unknown[]
	/**
	 * items.json `value`, always a number in COPPER (on 364 of the 900 items —
	 * the survey in scripts/investigate-inventory-shapes.js). Shown on the row
	 * and read by nothing: spending money on an item is a later slice.
	 */
	value?: number
	/**
	 * Set only on a ref built from a row's OWN definition (slice e2a) — the kind
	 * the player declared. It is what makes a custom item equippable, since a
	 * custom item carries none of the structural fields (`type`, `armor`,
	 * `weapon`) the real predicates read.
	 */
	customKind?: CustomItemKind
}

function isItemEntry(value: unknown): value is Record<string, unknown> & { name: string; source: string } {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as { name?: unknown }).name === 'string' &&
		typeof (value as { source?: unknown }).source === 'string'
	)
}

/** Armour categories, in the order the Dex cap tightens. */
export type ArmourCategory = 'light' | 'medium' | 'heavy'

const ARMOUR_CATEGORY_BY_CODE: Record<string, ArmourCategory> = { LA: 'light', MA: 'medium', HA: 'heavy' }

const SHIELD_CODE = 'S'
/** 2014 melee/ranged weapon codes; a bare "M" is the 2014 entry and "M|XPHB" the 2024 one, but the first segment is the same either way (DATA.md, "Blank source means PHB"). */
const WEAPON_CODES = ['M', 'R']

/**
 * items.json `type` codes for things spent on use — a potion, a scroll, food or
 * drink. Read structurally, not from the name (D21): the survey for slice f-fix
 * found the 11 ungated resist/immune items that are consumables are all `P`, and
 * a homebrew "Scroll of Fire Resistance" should be caught the same way.
 */
const CONSUMABLE_CODES = ['P', 'SC', 'FD']

/** The five kinds a custom item can declare, in the order the create form offers them. */
export const CUSTOM_ITEM_KINDS: readonly CustomItemKind[] = ['weapon', 'armour', 'shield', 'worn', 'other']

/**
 * Where each kind goes when equipped. 'worn' (a cloak, a ring) and 'other' get
 * no slot at all, matching the real items they stand for: equipSlotOf offers no
 * control on a Cloak of Protection either, because a worn wondrous item is
 * gated on attunement and nothing else (slice h).
 */
const CUSTOM_KIND_SLOT: Record<CustomItemKind, 'worn' | 'held' | null> = {
	weapon: 'held',
	armour: 'worn',
	shield: 'held',
	worn: null,
	other: null,
}

/** True when the item is used up on use, so any resistance it carries applies only while it is being used, not while it sits in the pack. */
export function isConsumable(ref: ItemRef): boolean {
	return ref.typeCode !== undefined && CONSUMABLE_CODES.includes(ref.typeCode)
}

/** The armour category of a suit of armour, read from the type code first (the `armor` flag misses every magic piece). Null for anything that isn't a suit of armour. */
export function armourCategoryOf(ref: ItemRef): ArmourCategory | null {
	return ref.typeCode === undefined ? null : (ARMOUR_CATEGORY_BY_CODE[ref.typeCode] ?? null)
}

export function isShield(ref: ItemRef): boolean {
	return ref.typeCode === SHIELD_CODE
}

export function isWeapon(ref: ItemRef): boolean {
	return ref.weapon === true || (ref.typeCode !== undefined && WEAPON_CODES.includes(ref.typeCode))
}

/**
 * Which slot this item occupies when equipped, or null when it is not
 * equippable at all. Armour is worn; a shield or a weapon is held. Worn
 * wondrous items (cloaks, rings) are deliberately not here — attunement and
 * magic bonuses are later slices of step 7.
 */
export function equipSlotOf(ref: ItemRef): 'worn' | 'held' | null {
	// A custom item declares its kind instead of carrying the structural fields the predicates below read (slice e2a).
	if (ref.customKind !== undefined) return CUSTOM_KIND_SLOT[ref.customKind]
	if (armourCategoryOf(ref) !== null || ref.armor === true) return 'worn'
	if (isShield(ref) || isWeapon(ref)) return 'held'
	return null
}

/**
 * Which SINGLE-occupancy slot the item claims when equipped — a body wears one
 * suit and holds one shield, but may hold two weapons. Null when it claims
 * none.
 *
 * Custom items are why this exists as its own function: a custom suit of
 * armour has no armour category (that is slice e2b's), so the displacement rule
 * cannot be written in terms of armourCategoryOf without letting a player wear
 * two suits at once — which storage then refuses to load.
 */
export function exclusiveSlotOf(ref: ItemRef): 'armour' | 'shield' | null {
	if (equipSlotOf(ref) === 'worn') return 'armour'
	if (isShield(ref) || ref.customKind === 'shield') return 'shield'
	return null
}

/** Stable key for an item reference — also the SearchableOptionList option key. */
export function itemKey(ref: ItemRef): string {
	return `${ref.name}|${ref.source}`
}

/**
 * The item's own numeric bonus in the role slice e applies it: a weapon's
 * attack/damage bonus, or a suit's or shield's Armour Class bonus. Null for
 * everything else — including the wondrous items that carry `bonusAc`
 * (Cloak of Protection, Bracers of Defense) and `bonusWeapon` (Wraps of
 * Unarmed Power), which are not gear this slice puts a number on, and the two
 * weapons carrying `bonusAc` (Staff of Power, Quarterstaff of the Acrobat).
 */
export function itemMagicBonusOf(ref: ItemRef): number | null {
	if (isWeapon(ref)) return ref.bonusWeapon ?? null
	if (armourCategoryOf(ref) !== null || ref.armor === true || isShield(ref)) return ref.bonusAc ?? null
	return null
}

/**
 * The `bonusAc` that lands on the CHARACTER rather than on a suit of armour or
 * a shield (slice h): the 8 wondrous items (Cloak of Protection, Bracers of
 * Defense, Ioun Stone of Protection…) and the 2 staves slice e left out. Null
 * for armour and shields, whose `bonusAc` armourClass.ts already applies
 * through itemMagicBonusOf — reading it here too would count it twice.
 */
export function wornAcBonusOf(ref: ItemRef): number | null {
	if (armourCategoryOf(ref) !== null || ref.armor === true || isShield(ref)) return null
	return ref.bonusAc ?? null
}

/**
 * What makes two inventory lines the SAME line. Rows merge — quantities add —
 * only when every per-row fact matches, so a +1 Longsword and a plain
 * Longsword stay two rows and neither of them silently loses its state.
 *
 * The set is every field the row carries beyond its identity and count:
 * `magicBonus` (slice e), `equipped` (b), `attackAbility` (c), `attuned` (d)
 * and the whole custom definition (e2a). Merging on identity alone would drop
 * five of them — and two custom items are BOTH named by the same (name,
 * "Custom") pair, so without the definition itself in the key a scarf and a
 * magic scarf of the same name would collapse into one row.
 */
export function inventoryRowKey(item: CharacterInventoryItem): string {
	return [
		item.name,
		item.source,
		item.magicBonus ?? '',
		item.equipped ?? '',
		item.attackAbility ?? '',
		item.attuned ? 'attuned' : '',
		customDefinitionKey(item.custom),
	].join('|')
}

/** A custom definition reduced to one comparable string. Field order is fixed here so two equal definitions cannot differ by key order alone. */
function customDefinitionKey(custom: CustomItemDefinition | undefined): string {
	if (custom === undefined) return ''
	return JSON.stringify([custom.name, custom.kind, custom.valueCopper ?? null, custom.requiresAttunement ?? null, custom.attunementCondition ?? null, custom.description ?? null])
}

/** items.json writes every bonus as a "+1"/"+2" string, never a number (this slice's survey). Anything else is dropped rather than guessed at. */
function bonusField<K extends string>(entry: Record<string, unknown>, key: K): Partial<Record<K, number>> {
	const value = entry[key]
	if (typeof value !== 'string' || !/^[+-]\d+$/.test(value)) return {}
	return { [key]: Number.parseInt(value, 10) } as Record<K, number>
}

function stringField<K extends string>(entry: Record<string, unknown>, key: K): Partial<Record<K, string>> {
	const value = entry[key]
	return typeof value === 'string' ? ({ [key]: value } as Record<K, string>) : {}
}

/** Keeps only the plain damage-type strings: an object element is the `{choose:{from}}` shape, which no ITEM uses and which this field cannot represent. */
function damageTypeArrayField<K extends string>(entry: Record<string, unknown>, key: K): Partial<Record<K, string[]>> {
	const value = entry[key]
	if (!Array.isArray(value)) return {}
	const types = value.filter((item): item is string => typeof item === 'string')
	return types.length > 0 ? ({ [key]: types } as Record<K, string[]>) : {}
}

function stringArrayField<K extends string>(entry: Record<string, unknown>, key: K): Partial<Record<K, string[]>> {
	const value = entry[key]
	return Array.isArray(value) ? ({ [key]: value.filter((item): item is string => typeof item === 'string') } as Record<K, string[]>) : {}
}

export function extractItemRefs(parsed: unknown): ItemRef[] {
	if (!Array.isArray(parsed)) {
		throw new Error('items.json: expected a top-level array.')
	}
	return parsed
		.filter(isItemEntry)
		.map((entry) => {
			const type = entry['type']
			const ac = entry['ac']
			const strength = entry['strength']
			const reqAttune = entry['reqAttune']
			const entries = entry['entries']
			const value = entry['value']
			return {
				name: entry.name,
				source: entry.source,
				...(typeof type === 'string' ? { typeCode: type.split('|')[0] } : {}),
				...(entry['armor'] === true ? { armor: true } : {}),
				...(entry['weapon'] === true ? { weapon: true } : {}),
				...(typeof ac === 'number' ? { ac } : {}),
				...(typeof strength === 'string' ? { strength } : {}),
				...(typeof value === 'number' ? { value } : {}),
				...(entry['stealth'] === true ? { stealth: true } : {}),
				...stringField(entry, 'weaponCategory'),
				...stringField(entry, 'dmg1'),
				...stringField(entry, 'dmg2'),
				...stringField(entry, 'dmgTypeFull'),
				...stringArrayField(entry, 'propertyFull'),
				...stringArrayField(entry, 'masteryFull'),
				...stringField(entry, 'range'),
				...(entry['firearm'] === true ? { firearm: true } : {}),
				...bonusField(entry, 'bonusWeapon'),
				...bonusField(entry, 'bonusAc'),
				...bonusField(entry, 'bonusSavingThrow'),
				...bonusField(entry, 'bonusSpellAttack'),
				...bonusField(entry, 'bonusSpellSaveDc'),
				...bonusField(entry, 'bonusAbilityCheck'),
				...bonusField(entry, 'bonusProficiencyBonus'),
				...damageTypeArrayField(entry, 'resist'),
				...damageTypeArrayField(entry, 'immune'),
				...(reqAttune === true || typeof reqAttune === 'string' ? { requiresAttunement: true } : {}),
				...(typeof reqAttune === 'string' ? { attunementCondition: reqAttune } : {}),
				// An empty array is the same thing as no description, so it is not carried through as one.
				...(Array.isArray(entries) && entries.length > 0 ? { entries } : {}),
			}
		})
		.sort((a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source))
}

export async function loadItemRefs(): Promise<ItemRef[]> {
	return extractItemRefs(await loadDataFile('data/items.json'))
}

/*
 * Custom items (build order step 7, slice e2a).
 *
 * A custom item is defined on its own inventory row and resolves to an ItemRef
 * exactly like a real one, so every consumer below this line — Armour Class,
 * the attacks section, damage responses, the flat bonuses, the sheet's own
 * rows — needs no knowledge that the item is homebrew. The ref carries ONLY
 * the fields this slice defines: nothing that would make a calculation produce
 * a number the definition cannot back up (slice e2b adds those).
 */

/** Blank lines separate paragraphs. Each one becomes its own entry, so free text renders like a real item's `entries` rather than as one wall. */
function descriptionEntries(description: string): string[] {
	return description
		.split(/\r?\n\s*\r?\n/)
		.map((paragraph) => paragraph.trim())
		.filter((paragraph) => paragraph.length > 0)
}

/** The ref a custom definition resolves to. `source` comes from the row so the ref and the row agree on what to call the thing (D43 messages read both). */
export function customItemRef(custom: CustomItemDefinition, source: string): ItemRef {
	const entries = custom.description === undefined ? [] : descriptionEntries(custom.description)
	return {
		name: custom.name,
		source,
		customKind: custom.kind,
		...(typeof custom.valueCopper === 'number' ? { value: custom.valueCopper } : {}),
		...(custom.requiresAttunement === true ? { requiresAttunement: true } : {}),
		...(custom.attunementCondition !== undefined && custom.attunementCondition !== '' ? { attunementCondition: custom.attunementCondition } : {}),
		...(entries.length > 0 ? { entries } : {}),
	}
}

/**
 * What is wrong with a stored custom definition, or null when it is usable.
 * Takes `unknown` on purpose: the storage layer lets the field through
 * unchecked so a broken definition can be SHOWN rather than take the character
 * down with it (D43), which makes this the only place its shape is proved.
 */
export function describeCustomItemProblem(custom: unknown): string | null {
	if (typeof custom !== 'object' || custom === null || Array.isArray(custom)) return 'the definition is not an object'
	const record = custom as Record<string, unknown>
	if (typeof record['name'] !== 'string' || record['name'].trim() === '') return 'it has no name'
	if (typeof record['kind'] !== 'string' || !CUSTOM_ITEM_KINDS.includes(record['kind'] as CustomItemKind)) {
		return `its kind "${String(record['kind'])}" is not one of ${CUSTOM_ITEM_KINDS.join(', ')}`
	}
	const value = record['valueCopper']
	if (value !== undefined && (typeof value !== 'number' || !Number.isInteger(value) || value < 0)) {
		return 'its value must be a whole number of copper pieces, not below zero'
	}
	if (record['requiresAttunement'] !== undefined && record['requiresAttunement'] !== true) return 'its attunement requirement must be true when present'
	if (record['attunementCondition'] !== undefined && typeof record['attunementCondition'] !== 'string') return 'its attunement condition must be text'
	if (record['description'] !== undefined && typeof record['description'] !== 'string') return 'its description must be text'
	return null
}

/** Why a row could not be resolved. The two kinds are separated because only the first is independent of whether items.json has loaded yet. */
export interface InventoryRowProblem {
	kind: 'malformed-custom' | 'not-in-item-data'
	message: string
}

export interface ResolvedInventoryRow {
	ref: ItemRef | null
	/** Null when the row resolved; otherwise the D43 note to show beside it. */
	problem: InventoryRowProblem | null
}

export type InventoryResolver = (item: CharacterInventoryItem) => ResolvedInventoryRow

/**
 * The ONE place an inventory row becomes an item. Every consumer builds one of
 * these instead of indexing items.json itself, so a custom row cannot be
 * missed by a call site that predates it.
 */
export function buildInventoryResolver(itemRefs: readonly ItemRef[]): InventoryResolver {
	const byKey = new Map(itemRefs.map((ref) => [itemKey(ref), ref]))
	return (item) => {
		if (item.custom !== undefined) {
			const problem = describeCustomItemProblem(item.custom)
			if (problem !== null) {
				return { ref: null, problem: { kind: 'malformed-custom', message: `Custom item "${item.name}" cannot be read: ${problem}.` } }
			}
			return { ref: customItemRef(item.custom, item.source), problem: null }
		}
		const ref = byKey.get(itemKey(item))
		if (ref) return { ref, problem: null }
		return { ref: null, problem: { kind: 'not-in-item-data', message: `Item data not found for "${item.name}" (${item.source}).` } }
	}
}

/**
 * A definition seeded from an existing item — the copy route, which is how a
 * player makes "chain mail that does not hamper stealth" without retyping
 * every field.
 *
 * The kind is derived from the same structural predicates the equip control
 * reads. 'worn' is never derived: nothing in items.json separates a cloak from
 * a coil of rope, so a wondrous item copies as 'other' and the player changes
 * it if they mean to wear it. The description copies the PLAIN paragraphs of
 * the item's text; its nested lists and tables are structure this field cannot
 * hold, and are left behind rather than flattened into something the player
 * would have to repair.
 */
export function customItemFromRef(ref: ItemRef): CustomItemDefinition {
	const paragraphs = (ref.entries ?? []).filter((entry): entry is string => typeof entry === 'string')
	return {
		name: ref.name,
		kind: isWeapon(ref) ? 'weapon' : isShield(ref) ? 'shield' : armourCategoryOf(ref) !== null || ref.armor === true ? 'armour' : 'other',
		...(typeof ref.value === 'number' ? { valueCopper: ref.value } : {}),
		...(ref.requiresAttunement === true ? { requiresAttunement: true as const } : {}),
		...(ref.attunementCondition !== undefined ? { attunementCondition: ref.attunementCondition } : {}),
		...(paragraphs.length > 0 ? { description: paragraphs.join('\n\n') } : {}),
	}
}
