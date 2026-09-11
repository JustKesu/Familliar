import { describe, expect, it } from 'vitest'
import type { Character } from '../storage/character'
import { speciesTraitNamesFrom } from './speciesTraitNames'

const SPECIES = [
	{
		name: 'Dwarf',
		source: 'XPHB',
		entries: [
			{ type: 'entries', name: 'Darkvision', entries: ['120 feet.'] },
			{ type: 'entries', name: 'Dwarven Resilience', entries: ['Resistance to Poison damage.'] },
			{ type: 'entries', name: 'Dwarven Toughness', entries: ['Your Hit Point maximum increases by 1...'] },
			{ type: 'entries', name: 'Stonecunning', entries: ['Tremorsense.'] },
		],
	},
	{ name: 'Elf', source: 'XPHB', entries: [{ type: 'entries', name: 'Darkvision', entries: ['60 feet.'] }, 'A loose string with no name.'] },
	{ name: 'Nameless', source: 'XPHB' },
]

function character(species: { name: string; source: string } | undefined): Character {
	return { id: 'c1', name: 'Aria', classes: [], ...(species ? { species } : {}) }
}

describe('speciesTraitNamesFrom', () => {
	it('returns the species entry’s own named traits, in order', () => {
		expect(speciesTraitNamesFrom(character({ name: 'Dwarf', source: 'XPHB' }), SPECIES)).toEqual([
			'Darkvision',
			'Dwarven Resilience',
			'Dwarven Toughness',
			'Stonecunning',
		])
	})

	it('skips elements that carry no name', () => {
		expect(speciesTraitNamesFrom(character({ name: 'Elf', source: 'XPHB' }), SPECIES)).toEqual(['Darkvision'])
	})

	it('matches on name AND source, never name alone', () => {
		expect(speciesTraitNamesFrom(character({ name: 'Dwarf', source: 'MPMM' }), SPECIES)).toEqual([])
	})

	it('is empty, not a throw, for a character with no species or an entry with no traits (D43)', () => {
		expect(speciesTraitNamesFrom(character(undefined), SPECIES)).toEqual([])
		expect(speciesTraitNamesFrom(character({ name: 'Nameless', source: 'XPHB' }), SPECIES)).toEqual([])
	})

	it('throws only when species.json itself is not an array', () => {
		expect(() => speciesTraitNamesFrom(character({ name: 'Dwarf', source: 'XPHB' }), { nope: true })).toThrow('species.json')
	})
})
