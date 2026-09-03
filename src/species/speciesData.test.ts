import { describe, expect, it } from 'vitest'
import { extractSpeciesOptions, findSpeciesSelection, speciesDisplayName } from './speciesData'

/*
 * The three linkages and the label heuristic are confirmed against the real
 * species.json by scripts/investigate-species-families.js; the fixtures here
 * are cut to the shape that investigation found, not invented.
 */

describe('extractSpeciesOptions', () => {
	it('drops entries carrying reprintedAs (superseded printings)', () => {
		const parsed = [
			{ name: 'Aasimar; Radiant Soul', source: 'MPMM', reprintedAs: ['Aasimar|XPHB'] },
			{ name: 'Aasimar', source: 'XPHB' },
		]
		const result = extractSpeciesOptions(parsed)
		expect(result).toHaveLength(1)
		expect(result[0]).toEqual({ name: 'Aasimar', source: 'XPHB', displayName: 'Aasimar', choiceLabel: null, variants: [] })
	})

	it('collapses a name-prefixed family to one entry, named as the book names the choice', () => {
		const parsed = [
			{
				name: 'Elf',
				source: 'XPHB',
				entries: [
					{ name: 'Darkvision', entries: ['60 feet.'] },
					{ name: 'Elven Lineage', entries: ['Choose Drow, High Elf, or Wood Elf.'] },
					{ name: 'Fey Ancestry', entries: ['Advantage on saves against Charmed.'] },
				],
			},
			{ name: 'Elf; Drow Lineage', source: 'XPHB' },
			{ name: 'Elf; High Elf Lineage', source: 'XPHB' },
			{ name: 'Elf; Wood Elf Lineage', source: 'XPHB' },
		]
		const options = extractSpeciesOptions(parsed)
		expect(options).toHaveLength(1)
		expect(options[0].name).toBe('Elf')
		expect(options[0].choiceLabel).toBe('Elven Lineage')
		expect(options[0].variants).toEqual([
			{ name: 'Elf; Drow Lineage', source: 'XPHB', optionName: 'Drow' },
			{ name: 'Elf; High Elf Lineage', source: 'XPHB', optionName: 'High Elf' },
			{ name: 'Elf; Wood Elf Lineage', source: 'XPHB', optionName: 'Wood Elf' },
		])
	})

	it('collapses a parenthesised family too (Dragonborn), leaving option names that share no trailing word alone', () => {
		const parsed = [
			{
				name: 'Dragonborn',
				source: 'XPHB',
				entries: [
					{ name: 'Draconic Ancestry', entries: ['Black, Blue, or Brass.'] },
					{ name: 'Breath Weapon', entries: ['Exhale destructive energy.'] },
				],
			},
			{ name: 'Dragonborn (Black)', source: 'XPHB' },
			{ name: 'Dragonborn (Blue)', source: 'XPHB' },
			{ name: 'Dragonborn (Brass)', source: 'XPHB' },
		]
		const options = extractSpeciesOptions(parsed)
		expect(options).toHaveLength(1)
		expect(options[0].choiceLabel).toBe('Draconic Ancestry')
		expect(options[0].variants.map((variant) => variant.optionName)).toEqual(['Black', 'Blue', 'Brass'])
	})

	it('collapses a field-linked family (Genasi), falling back to a generic label when no trait names the options', () => {
		const parsed = [
			{ name: 'Genasi', source: 'MPMM', entries: [{ name: 'Size', entries: ['Medium or Small.'] }] },
			{ name: 'Air', source: 'MPMM', raceName: 'Genasi', raceSource: 'MPMM' },
			{ name: 'Earth', source: 'MPMM', raceName: 'Genasi', raceSource: 'MPMM' },
		]
		const options = extractSpeciesOptions(parsed)
		expect(options).toHaveLength(1)
		expect(options[0].name).toBe('Genasi')
		expect(options[0].choiceLabel).toBe('Lineage')
		expect(options[0].variants).toEqual([
			{ name: 'Air', source: 'MPMM', optionName: 'Air' },
			{ name: 'Earth', source: 'MPMM', optionName: 'Earth' },
		])
	})

	it('leaves a species with no variants alone', () => {
		const parsed = [{ name: 'Human', source: 'XPHB', entries: [{ name: 'Resourceful', entries: ['Gain Heroic Inspiration.'] }] }]
		expect(extractSpeciesOptions(parsed)).toEqual([
			{ name: 'Human', source: 'XPHB', displayName: 'Human', choiceLabel: null, variants: [] },
		])
	})

	it('keeps a variant whose parent is not selectable as a top-level entry of its own', () => {
		const parsed = [{ name: 'Air', source: 'MPMM', raceName: 'Genasi', raceSource: 'MPMM' }]
		const options = extractSpeciesOptions(parsed)
		expect(options).toHaveLength(1)
		expect(options[0].displayName).toBe('Genasi; Air')
		expect(options[0].variants).toEqual([])
	})

	it('ignores malformed entries missing required fields', () => {
		expect(extractSpeciesOptions([{ name: 'No Source' }, { source: 'XPHB' }])).toEqual([])
	})

	it('throws when the top level is not an array', () => {
		expect(() => extractSpeciesOptions({ not: 'an array' })).toThrow(/top-level array/)
	})
})

describe('findSpeciesSelection', () => {
	const options = extractSpeciesOptions([
		{ name: 'Elf', source: 'XPHB', entries: [{ name: 'Elven Lineage', entries: ['Drow, High Elf, Wood Elf.'] }] },
		{ name: 'Elf; Drow Lineage', source: 'XPHB' },
		{ name: 'Elf; High Elf Lineage', source: 'XPHB' },
		{ name: 'Elf; Wood Elf Lineage', source: 'XPHB' },
		{ name: 'Genasi', source: 'MPMM' },
		{ name: 'Air', source: 'MPMM', raceName: 'Genasi', raceSource: 'MPMM' },
		{ name: 'Human', source: 'XPHB' },
	])

	it('resolves a stored variant back to its species and its choice', () => {
		const found = findSpeciesSelection(options, { name: 'Elf; Drow Lineage', source: 'XPHB' })
		expect(found?.option.name).toBe('Elf')
		expect(found?.variant?.optionName).toBe('Drow')
	})

	it('resolves a Genasi subrace, which stores only its own element name', () => {
		const found = findSpeciesSelection(options, { name: 'Air', source: 'MPMM' })
		expect(found?.option.name).toBe('Genasi')
		expect(found?.variant?.optionName).toBe('Air')
	})

	it('resolves a bare species stored before the choice was enforced, with no variant', () => {
		const found = findSpeciesSelection(options, { name: 'Elf', source: 'XPHB' })
		expect(found?.option.name).toBe('Elf')
		expect(found?.variant).toBeNull()
	})

	it('returns null for nothing chosen, and for a species not in the data', () => {
		expect(findSpeciesSelection(options, null)).toBeNull()
		expect(findSpeciesSelection(options, { name: 'Made Up', source: 'XPHB' })).toBeNull()
	})
})

describe('speciesDisplayName', () => {
	it('prefixes the parent name for Genasi subraces', () => {
		expect(speciesDisplayName({ name: 'Air', source: 'MPMM', raceName: 'Genasi', raceSource: 'MPMM' })).toBe(
			'Genasi; Air',
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
