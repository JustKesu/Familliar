import { describe, expect, it } from 'vitest'
import type { Character } from '../storage/character'
import { computeDarkvision, computeSize, computeSpeed, type SpeciesTraitsData } from './speciesTraits'

/**
 * Genasi (MPMM) fixture mirrors the real data trap confirmed by
 * scripts/investigate-calc-slice2.js: Air carries its own speed but not
 * size/darkvision, Earth carries none of the three — both fall back to the
 * parent "Genasi" entry. Genasi's size here is fixed (['M']) rather than
 * the real data's ['S','M'] choice, to keep the fallback assertion
 * separate from the choice-unknown assertion covered by Human below.
 */
const speciesData: SpeciesTraitsData[] = [
	{ name: 'Aarakocra', source: 'MPMM', speed: { walk: 30, fly: true }, size: ['M'], darkvision: 60 },
	{ name: 'Elf', source: 'XPHB', speed: 30, size: ['M'], darkvision: 60 },
	{ name: 'Human', source: 'XPHB', speed: 30, size: ['S', 'M'] },
	{ name: 'Genasi', source: 'MPMM', speed: 30, size: ['M'], darkvision: 60 },
	{ name: 'Air', source: 'MPMM', raceName: 'Genasi', raceSource: 'MPMM', speed: 35 },
	{ name: 'Earth', source: 'MPMM', raceName: 'Genasi', raceSource: 'MPMM' },
]

function withSpecies(name: string, source: string): Character {
	return { id: '1', name: 'Test', classes: [], species: { name, source } }
}

describe('computeSpeed', () => {
	it('reads a plain-number speed', () => {
		expect(computeSpeed(withSpecies('Elf', 'XPHB'), speciesData)).toEqual({
			status: 'known',
			value: { walk: 30 },
			breakdown: [{ source: 'Elf', amount: 30 }],
		})
	})

	it('a `true`-valued extra movement mode equals the walk speed', () => {
		expect(computeSpeed(withSpecies('Aarakocra', 'MPMM'), speciesData)).toEqual({
			status: 'known',
			value: { walk: 30, fly: 30 },
			breakdown: [{ source: 'Aarakocra', amount: 30 }],
		})
	})

	it('a subrace entry with its own speed field is not overridden by the parent', () => {
		expect(computeSpeed(withSpecies('Air', 'MPMM'), speciesData)).toEqual({
			status: 'known',
			value: { walk: 35 },
			breakdown: [{ source: 'Air', amount: 35 }],
		})
	})

	it('a subrace entry missing speed falls back to the parent entry', () => {
		expect(computeSpeed(withSpecies('Earth', 'MPMM'), speciesData)).toEqual({
			status: 'known',
			value: { walk: 30 },
			breakdown: [{ source: 'Genasi', amount: 30 }],
		})
	})

	it('returns unknown when no species has been chosen', () => {
		expect(computeSpeed({ id: '1', name: 'Test', classes: [] }, speciesData).status).toBe('unknown')
	})
})

describe('computeSize', () => {
	it('reads a fixed single-element size', () => {
		expect(computeSize(withSpecies('Elf', 'XPHB'), speciesData)).toEqual({
			status: 'known',
			value: 'M',
			breakdown: [{ source: 'Elf', amount: 0 }],
		})
	})

	it('a species offering a size choice is unknown until the wizard captures it', () => {
		const result = computeSize(withSpecies('Human', 'XPHB'), speciesData)
		expect(result.status).toBe('unknown')
	})

	it('a subrace entry missing size falls back to the parent entry', () => {
		expect(computeSize(withSpecies('Air', 'MPMM'), speciesData)).toEqual({
			status: 'known',
			value: 'M',
			breakdown: [{ source: 'Genasi', amount: 0 }],
		})
	})
})

describe('computeDarkvision', () => {
	it('reads a species with darkvision', () => {
		expect(computeDarkvision(withSpecies('Elf', 'XPHB'), speciesData)).toEqual({
			status: 'known',
			value: 60,
			breakdown: [{ source: 'Elf', amount: 60 }],
		})
	})

	it('a species with no darkvision field has none, not unknown', () => {
		expect(computeDarkvision(withSpecies('Human', 'XPHB'), speciesData)).toEqual({
			status: 'known',
			value: 0,
			breakdown: [],
		})
	})

	it('a subrace entry missing darkvision falls back to the parent entry', () => {
		expect(computeDarkvision(withSpecies('Earth', 'MPMM'), speciesData)).toEqual({
			status: 'known',
			value: 60,
			breakdown: [{ source: 'Genasi', amount: 60 }],
		})
	})

	it('returns unknown when the species is not in the supplied data (D43)', () => {
		const result = computeDarkvision(withSpecies('Made Up Species', 'XPHB'), speciesData)
		expect(result.status).toBe('unknown')
	})

	/*
	 * Senses of the same type don't stack: darkvision is the LARGEST of the
	 * species value and any granted darkvision. Every source still gets its
	 * own breakdown row, but only the winner carries a real amount — the
	 * others carry 0 plus a note, so the breakdown's summed amount still
	 * equals the displayed value.
	 */
	describe('with a granted darkvision', () => {
		it('a larger grant wins over the species value, breakdown names both', () => {
			expect(computeDarkvision(withSpecies('Elf', 'XPHB'), speciesData, [{ range: 120, origin: 'optionalFeature', name: 'Stone Rune' }])).toEqual({
				status: 'known',
				value: 120,
				breakdown: [
					{ source: 'Elf', amount: 0, note: 'does not exceed from invocation (Stone Rune) (120 ft.)' },
					{ source: 'from invocation (Stone Rune)', amount: 120 },
				],
			})
		})

		it('a smaller or equal grant does not override the species value', () => {
			expect(computeDarkvision(withSpecies('Elf', 'XPHB'), speciesData, [{ range: 30, origin: 'feat', name: 'Some Feat' }])).toEqual({
				status: 'known',
				value: 60,
				breakdown: [{ source: 'Elf', amount: 60 }, { source: 'from feat (Some Feat)', amount: 0, note: 'does not exceed Elf (60 ft.)' }],
			})
		})

		it('a species with no darkvision field plus a grant reads as the grant, not none', () => {
			expect(computeDarkvision(withSpecies('Human', 'XPHB'), speciesData, [{ range: 60, origin: 'feat', name: 'Skulker' }])).toEqual({
				status: 'known',
				value: 60,
				breakdown: [{ source: 'from feat (Skulker)', amount: 60 }],
			})
		})

		it('an unresolved species with a grant reports the grant, and says the species figure is unknown rather than presenting the grant as the whole answer', () => {
			const result = computeDarkvision(withSpecies('Made Up Species', 'XPHB'), speciesData, [{ range: 120, origin: 'optionalFeature', name: 'Stone Rune' }])
			expect(result).toEqual({
				status: 'known',
				value: 120,
				breakdown: [
					{ source: 'species', amount: 0, note: expect.stringContaining('unresolved') },
					{ source: 'from invocation (Stone Rune)', amount: 120 },
				],
			})
		})

		it('no species chosen at all, but a grant exists, still reports the grant', () => {
			const character: Character = { id: '1', name: 'Test', classes: [] }
			const result = computeDarkvision(character, speciesData, [{ range: 30, origin: 'feat', name: 'Skulker' }])
			expect(result.status).toBe('known')
			if (result.status === 'known') expect(result.value).toBe(30)
		})

		it('no species chosen and no grant stays unknown, unchanged', () => {
			const character: Character = { id: '1', name: 'Test', classes: [] }
			expect(computeDarkvision(character, speciesData, []).status).toBe('unknown')
		})
	})
})
