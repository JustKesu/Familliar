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

/**
 * `adjustments` are contributions from outside the species entry that change
 * the speed itself — today only the heavy-armour Strength penalty (build order
 * step 7 slice b, armourClass.ts's armourSpeedPenalty). Passed in rather than
 * computed here so this file stays ignorant of equipment (D38), and applied to
 * the walking speed before the other modes are derived from it: an
 * object-shaped species speed means "equal to your walking speed", so a
 * reduced walk reduces them too.
 */
export function computeSpeed(character: Character, speciesData: SpeciesTraitsData[], adjustments: Contribution[] = []): Calculated<SpeedValue> {
	const lookup = findCharacterSpeciesEntry(character, speciesData)
	if (!lookup) return unknown('Species has not been chosen for this character yet.')
	if (lookup.status === 'unknown') return unknown(lookup.reason)

	const resolved = resolveField(lookup.value, speciesData, 'speed')
	if (!resolved) return unknown(`No speed data for species "${lookup.value.name}" (${lookup.value.source}).`)

	const raw = resolved.value
	const base = typeof raw === 'number' ? raw : raw.walk
	const breakdown: Contribution[] = [{ source: resolved.source, amount: base }, ...adjustments]
	const walk = Math.max(
		0,
		breakdown.reduce((sum, contribution) => sum + contribution.amount, 0),
	)

	const value: SpeedValue = { walk }
	if (typeof raw === 'object') {
		if (raw.fly) value.fly = walk
		if (raw.swim) value.swim = walk
		if (raw.climb) value.climb = walk
	}

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

/**
 * A darkvision grant from a chosen optional feature or feat (grantedSenses.ts),
 * or from a carried item (slice e2b's custom items — itemEffectData.ts), passed
 * in per D38: this file fetches nothing.
 */
export interface GrantedDarkvision {
	range: number
	origin: 'optionalFeature' | 'feat' | 'item'
	name: string
	/**
	 * Set when the app can see the character HAS the grant but not that it is in
	 * effect — an item that requires attunement and is not attuned. Such a grant
	 * never wins and appears as a zero-amount note saying what it would have
	 * given (D76, the same treatment its owner's flat bonuses get).
	 */
	withheldReason?: string
}

interface DarkvisionCandidate {
	label: string
	value: number
	/** Set on a grant the app cannot see as active (D76). It is listed, never chosen. */
	withheldReason?: string
}

const DARKVISION_ORIGIN_LABELS: Record<GrantedDarkvision['origin'], (name: string) => string> = {
	feat: (name) => `from feat (${name})`,
	optionalFeature: (name) => `from invocation (${name})`,
	item: (name) => `from item (${name})`,
}

/**
 * Senses of the same type don't stack: darkvision is the LARGEST of the
 * species value and any granted darkvision, never their sum. Every
 * candidate still gets its own breakdown row (every source named, same
 * wording used elsewhere: the species name, `from invocation (Name)`,
 * `from feat (Name)`), but only the winning row carries its real amount —
 * every other row carries 0 plus a note explaining why it didn't apply
 * (D60's mechanism, generalized past its original D55/D58 scope; see
 * docs/REPORT.md). That keeps the breakdown's summed amount equal to the
 * displayed value, the same invariant abilityScores.ts's D42 breakdown
 * relies on, even though this value isn't itself a sum of its sources.
 */
function combineDarkvision(species: { source: string; value: number } | null, granted: GrantedDarkvision[], unresolvedSpeciesReason?: string): Calculated<number> {
	const candidates: DarkvisionCandidate[] = []
	if (species) candidates.push({ label: species.source, value: species.value })
	for (const grant of granted) {
		candidates.push({
			label: DARKVISION_ORIGIN_LABELS[grant.origin](grant.name),
			value: grant.range,
			...(grant.withheldReason !== undefined ? { withheldReason: grant.withheldReason } : {}),
		})
	}

	if (candidates.length === 0) return known(0, [])

	let winnerIndex = -1
	for (let i = 0; i < candidates.length; i++) {
		if (candidates[i].withheldReason !== undefined) continue
		if (winnerIndex === -1 || candidates[i].value > candidates[winnerIndex].value) winnerIndex = i
	}
	// Every candidate withheld: nothing applies, but each is still listed with its reason rather than the section going blank.
	const winner = winnerIndex === -1 ? null : candidates[winnerIndex]

	const breakdown: Contribution[] = candidates.map((candidate, index) => {
		if (candidate.withheldReason !== undefined) {
			return { source: candidate.label, amount: 0, note: `considered (${candidate.value} ft.) — not applied: ${candidate.withheldReason}` }
		}
		if (index === winnerIndex) return { source: candidate.label, amount: candidate.value }
		return { source: candidate.label, amount: 0, note: `does not exceed ${winner!.label} (${winner!.value} ft.)` }
	})
	// D43: the species figure itself couldn't be resolved — say so plainly rather than presenting the grant as though it were the whole, confirmed answer.
	if (unresolvedSpeciesReason) breakdown.unshift({ source: 'species', amount: 0, note: `unresolved — ${unresolvedSpeciesReason}` })

	return known(winner === null ? 0 : winner.value, breakdown)
}

export function computeDarkvision(character: Character, speciesData: SpeciesTraitsData[], grantedDarkvision: GrantedDarkvision[] = []): Calculated<number> {
	const lookup = findCharacterSpeciesEntry(character, speciesData)

	if (lookup && lookup.status === 'known') {
		const resolved = resolveField(lookup.value, speciesData, 'darkvision')
		return combineDarkvision(resolved ? { source: resolved.source, value: resolved.value } : null, grantedDarkvision)
	}

	if (grantedDarkvision.length === 0) {
		return lookup ? unknown(lookup.reason) : unknown('Species has not been chosen for this character yet.')
	}
	return combineDarkvision(null, grantedDarkvision, lookup ? lookup.reason : 'Species has not been chosen for this character yet.')
}
