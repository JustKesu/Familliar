/*
 * Species natural armour and natural weapons (S5, D357/D358). Hand-mapped by
 * "name|source": species.json states both only in prose (DATA.md, "Species
 * natural armor and natural weapons are prose only"), nine records in all.
 */

import type { CharacterSpecies } from '../storage/character'

export interface NaturalArmour {
	label: string
	base: number
	addsDexterity: boolean
	/** The species text forbids worn armour; wearing it is still allowed, the breakdown warns (D357). */
	forbidsArmour: boolean
	/** Shown on the winning row. */
	note: string
}

export interface NaturalWeapon {
	name: string
	die: string
	damageType: string
	note?: string
}

const key = (species: CharacterSpecies | undefined): string => (species ? `${species.name}|${species.source}` : '')

const NATURAL_ARMOUR: Record<string, NaturalArmour> = {
	'Lizardfolk|MPMM': { label: 'Natural Armor (Lizardfolk)', base: 13, addsDexterity: true, forbidsArmour: false, note: 'a shield applies as normal' },
	'Tortle|MPMM': { label: 'Natural Armor (Tortle)', base: 17, addsDexterity: false, forbidsArmour: true, note: 'Dexterity does not affect it; a shield applies as normal' },
}

const NATURAL_WEAPONS: Record<string, NaturalWeapon> = {
	'Aarakocra|MPMM': { name: 'Talons', die: '1d6', damageType: 'slashing' },
	'Centaur|MPMM': { name: 'Hooves', die: '1d6', damageType: 'bludgeoning' },
	'Lizardfolk|MPMM': { name: 'Bite', die: '1d6', damageType: 'slashing' },
	'Minotaur|MPMM': { name: 'Horns', die: '1d6', damageType: 'piercing' },
	'Satyr|MPMM': { name: 'Ram', die: '1d6', damageType: 'bludgeoning' },
	'Tabaxi|MPMM': { name: "Cat's Claws", die: '1d6', damageType: 'slashing' },
	'Tortle|MPMM': { name: 'Claws', die: '1d6', damageType: 'slashing' },
	// The Shifting text: the fangs strike only while shifted, and the app does not track that state.
	'Shifter; Longtooth|EFA': { name: 'Elongated Fangs', die: '1d6', damageType: 'piercing', note: 'only while shifted' },
}

/** Lupin "Feral Pounce": every Unarmed Strike deals slashing instead of bludgeoning (the Shove rider is not implemented). */
const UNARMED_DAMAGE_TYPE: Record<string, string> = { 'Lupin|RHW': 'slashing' }

export const naturalArmourOf = (species: CharacterSpecies | undefined): NaturalArmour | null => NATURAL_ARMOUR[key(species)] ?? null
export const naturalWeaponOf = (species: CharacterSpecies | undefined): NaturalWeapon | null => NATURAL_WEAPONS[key(species)] ?? null
export const unarmedDamageTypeOf = (species: CharacterSpecies | undefined): string => UNARMED_DAMAGE_TYPE[key(species)] ?? 'bludgeoning'
