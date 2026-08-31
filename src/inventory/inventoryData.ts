/*
 * The item file, reduced to what the inventory picker and the sheet's
 * item-resolution need: a name + source per entry (build order step 7, slice
 * a1), plus the gear fields slice b's equip control and Armour Class read
 * (type code, armour/weapon flags, ac, strength, stealth). The whole file is
 * offered — magic items included (Daniel's decision) — so nothing is filtered
 * here beyond dropping malformed rows.
 *
 * Referenced items are identified by name + source, the same convention every
 * other stored pick in this project uses (CharacterSpellChoice,
 * CharacterWildShapeForms). A stored item whose (name, source) is absent from
 * this list is not dropped — the sheet shows it with a note (D43).
 */

import { loadDataFile } from '../dataLoader/dataLoader'

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
			return {
				name: entry.name,
				source: entry.source,
				...(typeof type === 'string' ? { typeCode: type.split('|')[0] } : {}),
				...(entry['armor'] === true ? { armor: true } : {}),
				...(entry['weapon'] === true ? { weapon: true } : {}),
				...(typeof ac === 'number' ? { ac } : {}),
				...(typeof strength === 'string' ? { strength } : {}),
				...(entry['stealth'] === true ? { stealth: true } : {}),
			}
		})
		.sort((a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source))
}

export async function loadItemRefs(): Promise<ItemRef[]> {
	return extractItemRefs(await loadDataFile('data/items.json'))
}
