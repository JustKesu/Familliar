/*
 * Speed, size and darkvision (build order step 4), all read straight off
 * the character's species entry.
 *
 * scripts/investigate-calc-slice2.js confirmed the shapes and two data
 * traps, both resolved with the user before writing this file:
 *
 * - The four Genasi subraces (Air/Earth/Fire/Water, all MPMM) don't carry
 *   size or darkvision at all, and Earth/Fire don't even carry speed —
 *   those fields exist only on the parent "Genasi" entry, linked via
 *   raceName/raceSource (the same linkage speciesData.ts already uses for
 *   the display name). Resolved: fall back to the parent entry's value for
 *   whichever field the subrace entry itself omits.
 * - 23 species (XPHB Human, Aasimar, Tiefling among them) list size as a
 *   2-element array ["S","M"] — a real player choice the wizard doesn't
 *   capture yet. Resolved: report 'unknown' rather than default to one.
 *
 * MPMM speed can be an object ({ walk, fly/swim/climb: true }) where a
 * non-walk mode of `true` means "equal to walk speed" — confirmed against
 * every object-shaped speed entry in the data, always exactly one such key.
 */

import type { Character } from '../storage/character'
import { type Calculated, type Contribution, known, unknown } from './types'

export type RawSpeciesSpeed = number | { walk: number; fly?: true; swim?: true; climb?: true }

export interface SpeciesTraitsData {
	name: string
	source: string
	speed?: RawSpeciesSpeed
	size?: string[]
	darkvision?: number
	/** Present only for the Genasi-subrace linkage shape — see module doc. */
	raceName?: string
	raceSource?: string
}

function findSpeciesEntry(data: SpeciesTraitsData[], name: string, source: string): SpeciesTraitsData | undefined {
	return data.find((entry) => entry.name === name && entry.source === source)
}

/** Resolves one field for the character's species, falling back to the parent entry (Genasi trap) when the species entry itself omits it. */
function resolveField<K extends 'speed' | 'size' | 'darkvision'>(
	entry: SpeciesTraitsData,
	data: SpeciesTraitsData[],
	field: K,
): { value: NonNullable<SpeciesTraitsData[K]>; source: string } | undefined {
	const own = entry[field]
	if (own !== undefined) return { value: own, source: entry.name }

	if (entry.raceName && entry.raceSource) {
		const parent = findSpeciesEntry(data, entry.raceName, entry.raceSource)
		const parentValue = parent?.[field]
		if (parent && parentValue !== undefined) return { value: parentValue, source: parent.name }
	}

	return undefined
}

function findCharacterSpeciesEntry(character: Character, data: SpeciesTraitsData[]): Calculated<SpeciesTraitsData> | undefined {
	if (!character.species) return undefined
	const entry = findSpeciesEntry(data, character.species.name, character.species.source)
	if (!entry) return unknown(`No species data for "${character.species.name}" (${character.species.source}).`)
	return known(entry, [])
}

export interface SpeedValue {
	walk: number
	fly?: number
	swim?: number
	climb?: number
}

export function computeSpeed(character: Character, speciesData: SpeciesTraitsData[]): Calculated<SpeedValue> {
	const lookup = findCharacterSpeciesEntry(character, speciesData)
	if (!lookup) return unknown('Species has not been chosen for this character yet.')
	if (lookup.status === 'unknown') return unknown(lookup.reason)

	const resolved = resolveField(lookup.value, speciesData, 'speed')
	if (!resolved) return unknown(`No speed data for species "${lookup.value.name}" (${lookup.value.source}).`)

	const raw = resolved.value
	const walk = typeof raw === 'number' ? raw : raw.walk
	const value: SpeedValue = { walk }
	if (typeof raw === 'object') {
		if (raw.fly) value.fly = walk
		if (raw.swim) value.swim = walk
		if (raw.climb) value.climb = walk
	}

	const breakdown: Contribution[] = [{ source: resolved.source, amount: walk }]
	return known(value, breakdown)
}

export function computeSize(character: Character, speciesData: SpeciesTraitsData[]): Calculated<string> {
	const lookup = findCharacterSpeciesEntry(character, speciesData)
	if (!lookup) return unknown('Species has not been chosen for this character yet.')
	if (lookup.status === 'unknown') return unknown(lookup.reason)

	const resolved = resolveField(lookup.value, speciesData, 'size')
	if (!resolved) return unknown(`No size data for species "${lookup.value.name}" (${lookup.value.source}).`)

	if (resolved.value.length !== 1) {
		return unknown(`"${lookup.value.name}" (${lookup.value.source}) offers a choice of size (${resolved.value.join('/')}) that hasn't been made yet.`)
	}

	const size = resolved.value[0]
	return known(size, [{ source: resolved.source, amount: 0 }])
}

export function computeDarkvision(character: Character, speciesData: SpeciesTraitsData[]): Calculated<number> {
	const lookup = findCharacterSpeciesEntry(character, speciesData)
	if (!lookup) return unknown('Species has not been chosen for this character yet.')
	if (lookup.status === 'unknown') return unknown(lookup.reason)

	const resolved = resolveField(lookup.value, speciesData, 'darkvision')
	if (!resolved) return known(0, [])

	return known(resolved.value, [{ source: resolved.source, amount: resolved.value }])
}
