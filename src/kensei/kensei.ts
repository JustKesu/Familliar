import { loadDataFile } from '../dataLoader/dataLoader'
import type { CharacterClass, CharacterKenseiWeapon } from '../storage/character'
import { compareText } from '../text/compareText'

export const KENSEI_SUBCLASS = 'Way of the Kensei'
export const SAMURAI_SUBCLASS = 'Samurai'
export const ELEGANT_COURTIER_LEVEL = 7

export type KenseiSlotKind = 'melee' | 'ranged' | 'any'

export interface KenseiSlot {
	level: number
	kind: KenseiSlotKind
}

// XGE Path of the Kensei: one melee and one ranged at 3rd level, one more of either at 6th, 11th and 17th.
const KENSEI_SLOTS: readonly KenseiSlot[] = [
	{ level: 3, kind: 'melee' },
	{ level: 3, kind: 'ranged' },
	{ level: 6, kind: 'any' },
	{ level: 11, kind: 'any' },
	{ level: 17, kind: 'any' },
]

export interface KenseiWeaponOption {
	name: string
	ranged: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The Monk class whose subclass is Kensei, or undefined. */
function kenseiMonk(classes: readonly CharacterClass[]): CharacterClass | undefined {
	return classes.find((cls) => cls.className === 'Monk' && cls.classSource === 'XPHB' && cls.subclass === KENSEI_SUBCLASS && cls.level >= 3)
}

/** The slots the character's Monk level has reached; none without a Kensei Monk. */
export function kenseiSlotsFor(classes: readonly CharacterClass[]): KenseiSlot[] {
	const monk = kenseiMonk(classes)
	return monk ? KENSEI_SLOTS.filter((slot) => slot.level <= monk.level) : []
}

/** The stored picks that still count: the character is a Kensei Monk and has reached the pick's level. */
export function heldKenseiWeapons(classes: readonly CharacterClass[], picks: readonly CharacterKenseiWeapon[] | undefined): CharacterKenseiWeapon[] {
	const slots = kenseiSlotsFor(classes)
	return (picks ?? []).filter((pick) => slots.some((slot) => slot.level === pick.level))
}

/** Each slot level has as many picks stamped with it as it has slots; the picker keeps level 3's melee/ranged split. */
export function kenseiSlotsFilled(slots: readonly KenseiSlot[], picks: readonly CharacterKenseiWeapon[]): boolean {
	return slots.every((slot) => picks.filter((pick) => pick.level === slot.level).length >= slots.filter((other) => other.level === slot.level).length)
}

export function kenseiWeaponsOwed(classes: readonly CharacterClass[], picks: readonly CharacterKenseiWeapon[] | undefined): number {
	return Math.max(0, kenseiSlotsFor(classes).length - heldKenseiWeapons(classes, picks).length)
}

/**
 * XGE Kensei Weapons: "any simple or martial weapon that lacks the heavy and special properties. The longbow is also
 * a valid choice." Ordinary weapons only (rarity "none", as masteryData.ts); one option per name (DATA.md).
 */
export function kenseiWeaponOptions(parsedItems: unknown): KenseiWeaponOption[] {
	if (!Array.isArray(parsedItems)) throw new Error('items.json: expected a top-level array.')
	const byName = new Map<string, KenseiWeaponOption>()
	for (const item of parsedItems) {
		if (!isRecord(item) || typeof item['name'] !== 'string' || item['rarity'] !== 'none') continue
		if (item['weaponCategory'] !== 'simple' && item['weaponCategory'] !== 'martial') continue
		const properties = Array.isArray(item['propertyFull']) ? item['propertyFull'] : []
		if (item['name'] !== 'Longbow' && properties.some((property) => property === 'Heavy' || property === 'Special')) continue
		if (!byName.has(item['name'])) byName.set(item['name'], { name: item['name'], ranged: typeof item['type'] === 'string' && item['type'].startsWith('R') })
	}
	return [...byName.values()].sort((a, b) => compareText(a.name, b.name))
}

export async function loadKenseiWeaponOptions(): Promise<KenseiWeaponOption[]> {
	return kenseiWeaponOptions(await loadDataFile('data/items.json'))
}

/** XGE Samurai 7: Elegant Courtier grants a save proficiency once the Fighter reaches level 7. */
export function hasElegantCourtier(classes: readonly CharacterClass[]): boolean {
	return classes.some((cls) => cls.className === 'Fighter' && cls.classSource === 'XPHB' && cls.subclass === SAMURAI_SUBCLASS && cls.level >= ELEGANT_COURTIER_LEVEL)
}
