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
import type { CharacterInventoryItem } from '../storage/character'

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
	if (armourCategoryOf(ref) !== null || ref.armor === true) return 'worn'
	if (isShield(ref) || isWeapon(ref)) return 'held'
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
 * `magicBonus` (slice e), `equipped` (b), `attackAbility` (c) and `attuned`
 * (d). Merging on identity alone would drop three of them.
 */
export function inventoryRowKey(item: CharacterInventoryItem): string {
	return [item.name, item.source, item.magicBonus ?? '', item.equipped ?? '', item.attackAbility ?? '', item.attuned ? 'attuned' : ''].join('|')
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
			return {
				name: entry.name,
				source: entry.source,
				...(typeof type === 'string' ? { typeCode: type.split('|')[0] } : {}),
				...(entry['armor'] === true ? { armor: true } : {}),
				...(entry['weapon'] === true ? { weapon: true } : {}),
				...(typeof ac === 'number' ? { ac } : {}),
				...(typeof strength === 'string' ? { strength } : {}),
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
			}
		})
		.sort((a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source))
}

export async function loadItemRefs(): Promise<ItemRef[]> {
	return extractItemRefs(await loadDataFile('data/items.json'))
}
