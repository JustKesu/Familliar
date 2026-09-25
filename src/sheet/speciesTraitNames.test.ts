import { describe, expect, it } from 'vitest'
import type { Character } from '../storage/character'
import { speciesTraitMinLevel, speciesTraitNamesFrom, speciesTraitsAtLevel } from './speciesTraitNames'

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

describe('speciesTraitMinLevel (D186)', () => {
	it.each([
		['When you reach character level 3, you can transform as a {@variantrule Bonus Action|XPHB}.', 3],
		['Starting at character level 5, you can change your size to Large.', 5],
		['Starting at 3rd level, you can cast the {@spell gust of wind} spell with this trait.', 3],
		['When you reach 3rd level, you can use a bonus action to transform.', 3],
	])('%s → %i', (text, level) => {
		expect(speciesTraitMinLevel({ name: 'T', entries: [text] })).toBe(level)
	})

	it('a level later in the text raises part of the trait and does not gate it', () => {
		expect(speciesTraitMinLevel({ name: 'Fey Step', entries: ['As a bonus action, you teleport. Starting at 3rd level, your Fey Step gains an effect.'] })).toBeNull()
		expect(speciesTraitMinLevel({ name: 'Empty', entries: [] })).toBeNull()
		expect(speciesTraitMinLevel({ name: 'Object first', entries: [{ type: 'list', items: ['When you reach character level 3, x.'] }] })).toBeNull()
	})

	it('speciesTraitsAtLevel keeps a gated trait from its level on', () => {
		const traits = [
			{ name: 'Healing Hands', entries: ['As a Magic action, you touch a creature.'] },
			{ name: 'Celestial Revelation', entries: ['When you reach character level 3, you can transform.'] },
		]
		expect(speciesTraitsAtLevel(traits, 2).map((t) => t.name)).toEqual(['Healing Hands'])
		expect(speciesTraitsAtLevel(traits, 3).map((t) => t.name)).toEqual(['Healing Hands', 'Celestial Revelation'])
	})
})
