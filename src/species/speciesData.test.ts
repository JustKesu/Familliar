import { describe, expect, it } from 'vitest'
import { extractSelectableSpecies, speciesDisplayName } from './speciesData'

describe('extractSelectableSpecies', () => {
	it('drops entries carrying reprintedAs (superseded printings)', () => {
		const parsed = [
			{ name: 'Aasimar; Radiant Soul', source: 'MPMM', reprintedAs: ['Aasimar|XPHB'] },
			{ name: 'Aasimar', source: 'XPHB' },
		]
		const result = extractSelectableSpecies(parsed)
		expect(result).toHaveLength(1)
		expect(result[0]).toEqual({ name: 'Aasimar', source: 'XPHB' })
	})

	it('keeps entries with no reprintedAs field', () => {
		const parsed = [{ name: 'Elf; Drow Lineage', source: 'XPHB' }]
		expect(extractSelectableSpecies(parsed)).toEqual([{ name: 'Elf; Drow Lineage', source: 'XPHB' }])
	})

	it('matches the expected count after filtering (78 entries, 3 carry reprintedAs)', () => {
		const parsed = [
			...Array.from({ length: 75 }, (_, i) => ({ name: `Species ${i}`, source: 'XPHB' })),
			{ name: 'Aasimar; Necrotic Shroud', source: 'MPMM', reprintedAs: ['Aasimar|XPHB'] },
			{ name: 'Aasimar; Radiant Consumption', source: 'MPMM', reprintedAs: ['Aasimar|XPHB'] },
			{ name: 'Aasimar; Radiant Soul', source: 'MPMM', reprintedAs: ['Aasimar|XPHB'] },
		]
		expect(parsed).toHaveLength(78)
		expect(extractSelectableSpecies(parsed)).toHaveLength(75)
	})

	it('keeps parent entries carrying raceName/raceSource (Genasi subraces)', () => {
		const parsed = [{ name: 'Air', source: 'MPMM', raceName: 'Genasi', raceSource: 'MPMM' }]
		expect(extractSelectableSpecies(parsed)).toEqual([
			{ name: 'Air', source: 'MPMM', raceName: 'Genasi', raceSource: 'MPMM' },
		])
	})

	it('ignores malformed entries missing required fields', () => {
		const parsed = [{ name: 'No Source' }, { source: 'XPHB' }]
		expect(extractSelectableSpecies(parsed)).toEqual([])
	})

	it('throws when the top level is not an array', () => {
		expect(() => extractSelectableSpecies({ not: 'an array' })).toThrow(/top-level array/)
	})
})

describe('speciesDisplayName', () => {
	it('prefixes the parent name for Genasi subraces', () => {
		expect(speciesDisplayName({ name: 'Air', source: 'MPMM', raceName: 'Genasi', raceSource: 'MPMM' })).toBe(
			'Genasi; Air',
		)
		expect(speciesDisplayName({ name: 'Earth', source: 'MPMM', raceName: 'Genasi', raceSource: 'MPMM' })).toBe(
			'Genasi; Earth',
		)
		expect(speciesDisplayName({ name: 'Fire', source: 'MPMM', raceName: 'Genasi', raceSource: 'MPMM' })).toBe(
			'Genasi; Fire',
		)
		expect(speciesDisplayName({ name: 'Water', source: 'MPMM', raceName: 'Genasi', raceSource: 'MPMM' })).toBe(
			'Genasi; Water',
		)
	})

	it('displays the stored name unchanged for entries without raceName', () => {
		expect(speciesDisplayName({ name: 'Elf; Drow Lineage', source: 'XPHB' })).toBe('Elf; Drow Lineage')
		expect(speciesDisplayName({ name: 'Aasimar', source: 'XPHB' })).toBe('Aasimar')
	})
})
