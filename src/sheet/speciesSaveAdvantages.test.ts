import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SPECIES_SAVE_ADVANTAGES, speciesSaveAdvantageLines } from './speciesSaveAdvantages'

interface SpeciesRecord {
	name: string
	source: string
	entries?: unknown[]
}

describe('SPECIES_SAVE_ADVANTAGES — against the generated data (D314)', () => {
	const species = JSON.parse(readFileSync('data/species.json', 'utf8')) as SpeciesRecord[]
	const traitNames = new Map(
		species.map((record) => [
			`${record.name}|${record.source}`,
			new Set((record.entries ?? []).flatMap((child) => (child && typeof child === 'object' && 'name' in child && typeof child.name === 'string' ? [child.name] : []))),
		]),
	)

	it.each(SPECIES_SAVE_ADVANTAGES.flatMap((entry) => entry.records.map((record) => [record, entry.trait])))('%s carries %s', (record, trait) => {
		expect(traitNames.get(record)?.has(trait)).toBe(true)
	})
})

describe('speciesSaveAdvantageLines', () => {
	it('Gnome lineages get Gnomish Cunning', () => {
		expect(speciesSaveAdvantageLines({ name: 'Gnome; Rock Gnome Lineage', source: 'XPHB' })).toEqual(['Advantage on Intelligence, Wisdom and Charisma saves (Gnomish Cunning)'])
	})

	it('an Elf lineage gets Fey Ancestry', () => {
		expect(speciesSaveAdvantageLines({ name: 'Elf; Drow Lineage', source: 'XPHB' })).toEqual(['Advantage on saves to avoid or end Charmed (Fey Ancestry)'])
	})

	it('a species with two traits gets two lines; one without an entry or no species gets none', () => {
		expect(speciesSaveAdvantageLines({ name: 'Yuan-Ti', source: 'MPMM' })).toEqual(['Advantage on saves to avoid or end Poisoned (Poison Resilience)', 'Advantage on saves against spells (Magic Resistance)'])
		expect(speciesSaveAdvantageLines({ name: 'Human', source: 'XPHB' })).toEqual([])
		expect(speciesSaveAdvantageLines(undefined)).toEqual([])
	})
})
