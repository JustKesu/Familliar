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
import type {
	CharacterInventoryItem,
	CustomArmourCategory,
	CustomItemDefinition,
	CustomItemKind,
	CustomWeaponCategory,
	CustomWeaponRange,
	WeaponGrip,
} from '../storage/character'

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
	 * Feet added to (or taken off) the walking speed, reaching computeSpeed
	 * through its `adjustments` parameter (slice e2b). extractItemRefs sets it
	 * for no item in items.json — nothing there is read into it — so today only
	 * a custom definition fills it; the reader is written against the field
	 * rather than against "is this custom" so extraction could feed it later.
	 */
	speedBonus?: number
	/** Darkvision in feet, reaching computeDarkvision through the same senses path a feat's grant uses (slice e2b). Set by a custom definition only, as speedBonus is. */
	darkvision?: number
	/**
	 * Set only on a ref built from a row's OWN definition (slice e2a) — the kind
	 * the player declared. It is what makes a custom item equippable, since the
	 * structural fields above are synthesised from the kind rather than read
	 * from a `type` string.
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

/** The armour categories a custom suit can declare, in the order the Dexterity cap tightens (slice e2b). */
export const CUSTOM_ARMOUR_CATEGORIES: readonly CustomArmourCategory[] = ['light', 'medium', 'heavy']

/** D77's two rules, as a custom weapon declares them. */
export const CUSTOM_WEAPON_RANGES: readonly CustomWeaponRange[] = ['melee', 'ranged']

/** The two `weaponCategory` values a weapon proficiency grant can match. */
export const CUSTOM_WEAPON_CATEGORIES: readonly CustomWeaponCategory[] = ['simple', 'martial']

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

/** propertyFull's own spelling for the two properties that decide hand occupancy; nothing in the data carries both (this slice's survey). */
const TWO_HANDED_PROPERTY = 'Two-Handed'
const VERSATILE_PROPERTY = 'Versatile'

function hasWeaponProperty(ref: ItemRef, property: string): boolean {
	return (ref.propertyFull ?? []).includes(property)
}

/** A weapon that can be held in one hand or two, for a bigger damage die (`dmg2`). 42 of the 95 weapons. */
export function isVersatileWeapon(ref: ItemRef): boolean {
	return isWeapon(ref) && hasWeaponProperty(ref, VERSATILE_PROPERTY)
}

/**
 * How many of the two hands this item occupies while held, or null when it is
 * not held-slot gear at all. PHB 2024's weapon properties, in the only place
 * the app needs them as a number: a shield or an ordinary weapon takes one
 * hand, a Two-Handed weapon takes both, and a Versatile weapon takes whichever
 * the player chose.
 *
 * A CUSTOM weapon reaches the same rule through `propertyFull`, built from the
 * definition's own `twoHanded`/`versatile` flags (customWeaponHandProperties)
 * — one hand unless the player declared otherwise, same as a real item.
 */
export function handsRequiredOf(ref: ItemRef, grip: WeaponGrip | undefined): number | null {
	if (equipSlotOf(ref) !== 'held') return null
	if (isShield(ref)) return 1
	if (hasWeaponProperty(ref, TWO_HANDED_PROPERTY)) return 2
	if (isVersatileWeapon(ref) && grip === 'two-handed') return 2
	return 1
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
 * `magicBonus` (slice e), `equipped` (b), `grip` (b-fix), `attackAbility` (c),
 * `attuned` (d) and the whole custom definition (e2a). Merging on identity
 * alone would drop six of them — and two custom items are BOTH named by the
 * same (name, "Custom") pair, so without the definition itself in the key a
 * scarf and a magic scarf of the same name would collapse into one row.
 */
export function inventoryRowKey(item: CharacterInventoryItem): string {
	return [
		item.name,
		item.source,
		item.magicBonus ?? '',
		item.equipped ?? '',
		item.grip ?? '',
		item.attackAbility ?? '',
		item.attuned ? 'attuned' : '',
		customDefinitionKey(item.custom),
	].join('|')
}

/**
 * A custom definition reduced to one comparable string. The keys are SORTED so
 * two equal definitions cannot differ by key order alone — which also means the
 * key covers every field the definition grows, rather than a list that has to
 * be extended each time (slice e2b added eleven).
 */
function customDefinitionKey(custom: CustomItemDefinition | undefined): string {
	if (custom === undefined) return ''
	return JSON.stringify(custom, Object.keys(custom).sort())
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

/** The type code each armour category is filed under in items.json, so a custom suit reads through armourCategoryOf like any other. */
const ARMOUR_CODE_BY_CATEGORY: Record<CustomArmourCategory, string> = { light: 'LA', medium: 'MA', heavy: 'HA' }

/**
 * The structural fields a custom item's KIND stands in for (slice e2b). A real
 * item says what it is with a `type` code; a custom one says it with `kind`
 * plus the two fields that refine it, and this is where the two meet — so
 * isWeapon, armourCategoryOf, isShield, itemMagicBonusOf and wornAcBonusOf all
 * work on a custom ref without knowing it is one.
 *
 * A weapon with no declared range is melee: D77's default, and the alternative
 * is a weapon that is not a weapon at all. Armour is the opposite case — an
 * absent category is left absent, because guessing 'light' would silently
 * hand the character an uncapped Dexterity bonus, and an error upward is the
 * one D76 rules out. The sheet names such a suit instead (armourClass.ts).
 */
function customStructuralFields(custom: CustomItemDefinition): Partial<ItemRef> {
	switch (custom.kind) {
		case 'weapon':
			return {
				typeCode: custom.weaponRange === 'ranged' ? 'R' : 'M',
				...(custom.weaponCategory !== undefined ? { weaponCategory: custom.weaponCategory } : {}),
				...(custom.damageDice !== undefined && custom.damageDice !== '' ? { dmg1: custom.damageDice } : {}),
				...(custom.damageType !== undefined && custom.damageType !== '' ? { dmgTypeFull: custom.damageType } : {}),
				...customWeaponHandProperties(custom),
			}
		case 'armour':
			return {
				...(custom.armourCategory !== undefined ? { typeCode: ARMOUR_CODE_BY_CATEGORY[custom.armourCategory] } : {}),
				...(typeof custom.armourClass === 'number' ? { ac: custom.armourClass } : {}),
				...customArmourPenalties(custom),
			}
		case 'shield':
			// DATA.md: a shield's `ac` is the bonus it adds, never a finished Armour Class.
			return { typeCode: SHIELD_CODE, ...(typeof custom.armourClass === 'number' ? { ac: custom.armourClass } : {}), ...customArmourPenalties(custom) }
		default:
			return {}
	}
}

/**
 * The two weapon properties that decide hand cost (fix slice, see hands.ts):
 * a real weapon carries them in `propertyFull`, handsRequiredOf's only source,
 * so a custom weapon has to land in the same array or it always costs one
 * hand regardless of what the player declared. A Versatile weapon's second
 * die (`dmg2`) rides along — without it the grip control has nothing to
 * switch to (isVersatileWeapon reads `propertyFull` alone to decide whether
 * to offer the control at all).
 */
function customWeaponHandProperties(custom: CustomItemDefinition): Partial<ItemRef> {
	const propertyFull: string[] = []
	if (custom.twoHanded === true) propertyFull.push(TWO_HANDED_PROPERTY)
	if (custom.versatile === true) propertyFull.push(VERSATILE_PROPERTY)
	return {
		...(propertyFull.length > 0 ? { propertyFull } : {}),
		...(custom.versatile === true && custom.damageDice2 !== undefined && custom.damageDice2 !== '' ? { dmg2: custom.damageDice2 } : {}),
	}
}

/**
 * The two penalties a suit or shield can carry (slice e2c), written in
 * items.json's own spelling so armourClassData.ts reads them with no custom
 * branch: `strength` is a STRING in the data (DATA.md, "Armour AC"), so the
 * definition's number becomes one here.
 */
function customArmourPenalties(custom: CustomItemDefinition): Partial<ItemRef> {
	return {
		...(custom.stealthDisadvantage === true ? { stealth: true } : {}),
		...(typeof custom.strengthRequirement === 'number' ? { strength: String(custom.strengthRequirement) } : {}),
	}
}

/** A numeric field carried through only when it is a number that changes something — a declared 0 is the same as declaring nothing. */
function customNumber<K extends string>(value: number | undefined, key: K): Partial<Record<K, number>> {
	return typeof value === 'number' && value !== 0 ? ({ [key]: value } as Record<K, number>) : {}
}

function customDamageTypes<K extends string>(value: string[] | undefined, key: K): Partial<Record<K, string[]>> {
	if (!Array.isArray(value)) return {}
	const types = value.filter((entry): entry is string => typeof entry === 'string' && entry !== '')
	return types.length > 0 ? ({ [key]: types } as Record<K, string[]>) : {}
}

/** The ref a custom definition resolves to. `source` comes from the row so the ref and the row agree on what to call the thing (D43 messages read both). */
export function customItemRef(custom: CustomItemDefinition, source: string): ItemRef {
	const entries = custom.description === undefined ? [] : descriptionEntries(custom.description)
	return {
		name: custom.name,
		source,
		customKind: custom.kind,
		...customStructuralFields(custom),
		...(typeof custom.valueCopper === 'number' ? { value: custom.valueCopper } : {}),
		...(custom.requiresAttunement === true ? { requiresAttunement: true } : {}),
		...(custom.attunementCondition !== undefined && custom.attunementCondition !== '' ? { attunementCondition: custom.attunementCondition } : {}),
		...customDamageTypes(custom.resist, 'resist'),
		...customDamageTypes(custom.immune, 'immune'),
		...customNumber(custom.speedBonus, 'speedBonus'),
		...customNumber(custom.darkvision, 'darkvision'),
		/*
		 * The five flat-bonus fields land on the same ItemRef keys items.json's
		 * own bonuses use, so itemFlatBonusData.ts reads them with no second
		 * branch. `bonusAc` on an armour- or shield-kind item is that suit's
		 * magic bonus rather than a worn bonus, exactly as Dragon Scale Mail's is
		 * (itemMagicBonusOf / wornAcBonusOf make that split, not this function).
		 */
		...customNumber(custom.bonusArmourClass, 'bonusAc'),
		...customNumber(custom.bonusSavingThrow, 'bonusSavingThrow'),
		...customNumber(custom.bonusSpellAttack, 'bonusSpellAttack'),
		...customNumber(custom.bonusSpellSaveDc, 'bonusSpellSaveDc'),
		...customNumber(custom.bonusAbilityCheck, 'bonusAbilityCheck'),
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

	/* Slice e2b's computed fields. Each one feeds a number, so a wrong shape here would reach a breakdown rather than a paragraph. */
	for (const key of NUMERIC_CUSTOM_FIELDS) {
		const value = record[key]
		if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) return `its ${key} must be a number`
	}
	const armourClass = record['armourClass']
	if (armourClass !== undefined && (typeof armourClass !== 'number' || !Number.isInteger(armourClass) || armourClass < 0)) {
		return 'its armour class must be a whole number, not below zero'
	}
	const category = record['armourCategory']
	if (category !== undefined && !CUSTOM_ARMOUR_CATEGORIES.includes(category as CustomArmourCategory)) {
		return `its armour category "${String(category)}" is not one of ${CUSTOM_ARMOUR_CATEGORIES.join(', ')}`
	}
	if (record['stealthDisadvantage'] !== undefined && record['stealthDisadvantage'] !== true) return 'its Stealth disadvantage must be true when present'
	const strengthRequirement = record['strengthRequirement']
	if (strengthRequirement !== undefined && (typeof strengthRequirement !== 'number' || !Number.isInteger(strengthRequirement) || strengthRequirement < 0)) {
		return 'its Strength requirement must be a whole number, not below zero'
	}
	const range = record['weaponRange']
	if (range !== undefined && !CUSTOM_WEAPON_RANGES.includes(range as CustomWeaponRange)) {
		return `its weapon range "${String(range)}" is not one of ${CUSTOM_WEAPON_RANGES.join(', ')}`
	}
	const weaponCategory = record['weaponCategory']
	if (weaponCategory !== undefined && !CUSTOM_WEAPON_CATEGORIES.includes(weaponCategory as CustomWeaponCategory)) {
		return `its weapon category "${String(weaponCategory)}" is not one of ${CUSTOM_WEAPON_CATEGORIES.join(', ')}`
	}
	if (record['damageDice'] !== undefined && typeof record['damageDice'] !== 'string') return 'its damage dice must be text'
	if (record['damageType'] !== undefined && typeof record['damageType'] !== 'string') return 'its damage type must be text'
	if (record['twoHanded'] !== undefined && record['twoHanded'] !== true) return 'its two-handed flag must be true when present'
	if (record['versatile'] !== undefined && record['versatile'] !== true) return 'its versatile flag must be true when present'
	if (record['damageDice2'] !== undefined && typeof record['damageDice2'] !== 'string') return 'its second damage dice must be text'
	for (const key of ['resist', 'immune'] as const) {
		const value = record[key]
		if (value === undefined) continue
		if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) return `its ${key} must be a list of damage types`
	}
	return null
}

/** Every field of the definition that must be a number when present. Listed once so the check cannot fall behind the type. */
const NUMERIC_CUSTOM_FIELDS = ['speedBonus', 'darkvision', 'bonusArmourClass', 'bonusSavingThrow', 'bonusSpellAttack', 'bonusSpellSaveDc', 'bonusAbilityCheck'] as const

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
 *
 * Slice e2b: the computed fields copy too, so a suit copied from Chain Mail
 * really is 16 heavy and a sword copied from a Longsword really does 1d8
 * slashing. Slice e2c added the Stealth disadvantage and the Strength
 * requirement, so a copy of Chain Mail starts out hampering Stealth and
 * demanding Strength 13. The fix slice added the two hand properties and the
 * Versatile second die, so a Greatsword copies in as Two-Handed and a Longsword
 * copies in Versatile with its 1d10 intact — each switched off deliberately
 * rather than lost by accident.
 */
export function customItemFromRef(ref: ItemRef): CustomItemDefinition {
	const paragraphs = (ref.entries ?? []).filter((entry): entry is string => typeof entry === 'string')
	const category = armourCategoryOf(ref)
	const strengthRequirement = ref.strength === undefined ? Number.NaN : Number.parseInt(ref.strength, 10)
	const kind: CustomItemKind = isWeapon(ref) ? 'weapon' : isShield(ref) ? 'shield' : category !== null || ref.armor === true ? 'armour' : 'other'
	return {
		name: ref.name,
		kind,
		...(typeof ref.value === 'number' ? { valueCopper: ref.value } : {}),
		...(ref.requiresAttunement === true ? { requiresAttunement: true as const } : {}),
		...(ref.attunementCondition !== undefined ? { attunementCondition: ref.attunementCondition } : {}),
		...(kind === 'weapon'
			? {
					...(ref.dmg1 !== undefined ? { damageDice: ref.dmg1 } : {}),
					...(ref.dmgTypeFull !== undefined ? { damageType: ref.dmgTypeFull } : {}),
					weaponRange: ref.typeCode === 'R' ? ('ranged' as const) : ('melee' as const),
					...(ref.weaponCategory === 'simple' || ref.weaponCategory === 'martial' ? { weaponCategory: ref.weaponCategory } : {}),
					...(hasWeaponProperty(ref, TWO_HANDED_PROPERTY) ? { twoHanded: true as const } : {}),
					...(hasWeaponProperty(ref, VERSATILE_PROPERTY) ? { versatile: true as const } : {}),
					...(ref.dmg2 !== undefined ? { damageDice2: ref.dmg2 } : {}),
				}
			: {}),
		...((kind === 'armour' || kind === 'shield') && typeof ref.ac === 'number' ? { armourClass: ref.ac } : {}),
		...(kind === 'armour' && category !== null ? { armourCategory: category } : {}),
		...(kind === 'armour' || kind === 'shield'
			? {
					...(ref.stealth === true ? { stealthDisadvantage: true as const } : {}),
					...(Number.isFinite(strengthRequirement) ? { strengthRequirement } : {}),
				}
			: {}),
		...(ref.resist !== undefined ? { resist: [...ref.resist] } : {}),
		...(ref.immune !== undefined ? { immune: [...ref.immune] } : {}),
		/* The AC bonus copies into the field that lands where the ORIGINAL's did — a cloak's on the character, a suit's on the suit. */
		...(ref.bonusAc !== undefined ? { bonusArmourClass: ref.bonusAc } : {}),
		...(ref.bonusSavingThrow !== undefined ? { bonusSavingThrow: ref.bonusSavingThrow } : {}),
		...(ref.bonusSpellAttack !== undefined ? { bonusSpellAttack: ref.bonusSpellAttack } : {}),
		...(ref.bonusSpellSaveDc !== undefined ? { bonusSpellSaveDc: ref.bonusSpellSaveDc } : {}),
		...(ref.bonusAbilityCheck !== undefined ? { bonusAbilityCheck: ref.bonusAbilityCheck } : {}),
		...(paragraphs.length > 0 ? { description: paragraphs.join('\n\n') } : {}),
	}
}
