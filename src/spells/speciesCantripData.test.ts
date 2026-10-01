import { describe, expect, it, vi } from 'vitest'
import { extractSpeciesCantripSlot, loadSpeciesCantripChoice, speciesCantripOptions } from './speciesCantripData'

vi.mock('../dataLoader/dataLoader', () => ({
	loadDataFile: vi.fn(async (path: string) => {
		if (path === 'data/species.json') return species
		throw new Error('spells.json failed')
	}),
}))

/* Shapes from scripts/investigate-species-cantrips.js (DATA.md, S2). */
const species = [
	{ name: 'Elf', source: 'XPHB', additionalSpells: [{ name: 'High Elf', ability: { choose: ['int', 'wis', 'cha'] }, known: { 1: { _: [{ choose: 'level=0|class=Wizard' }] } } }] },
	{ name: 'Elf; High Elf Lineage', source: 'XPHB', additionalSpells: [{ ability: { choose: ['int', 'wis', 'cha'] }, known: { 1: { _: [{ choose: 'level=0|class=Wizard' }] } } }] },
	{ name: 'Khoravar', source: 'EFA', additionalSpells: [{ ability: { choose: ['int', 'wis', 'cha'] }, known: { 1: { _: [{ choose: 'level=0|class=Cleric;Druid;Wizard' }] } } }] },
	{ name: 'Elf; Wood Elf Lineage', source: 'XPHB', additionalSpells: [{ ability: { choose: ['int', 'wis', 'cha'] }, known: { 1: ['druidcraft|xphb'] } }] },
	{ name: 'Kobold; Draconic Sorcery', source: 'MPMM', additionalSpells: [{ ability: { choose: ['int', 'wis', 'cha'] }, known: { _: [{ choose: 'level=0|class=Sorcerer', count: 1 }] } }] },
]

const onList = (...classes: string[]) => ({ classes: classes.map((name) => ({ name, classSource: 'XPHB' })) })
const spells = [
	{ name: 'Fire Bolt', source: 'XPHB', level: 0, availableTo: onList('Wizard') },
	{ name: 'Sacred Flame', source: 'XPHB', level: 0, availableTo: onList('Cleric') },
	{ name: 'Druidcraft', source: 'XPHB', level: 0, availableTo: onList('Druid') },
	{ name: 'Light', source: 'XPHB', level: 0, availableTo: onList('Cleric', 'Wizard') },
	{ name: 'Magic Missile', source: 'XPHB', level: 1, availableTo: onList('Wizard') },
]

describe('species cantrip choice (S2)', () => {
	it('reads the class list off the stored variant, never off a family base or a fixed grant', () => {
		expect(extractSpeciesCantripSlot(species, 'Elf; High Elf Lineage', 'XPHB')?.classes.map((c) => c.className)).toEqual(['Wizard'])
		expect(extractSpeciesCantripSlot(species, 'Elf', 'XPHB')).toBeNull()
		expect(extractSpeciesCantripSlot(species, 'Elf; Wood Elf Lineage', 'XPHB')).toBeNull()
	})

	it('reads Kobold’s always-granted known._ node with an explicit count 1', () => {
		expect(extractSpeciesCantripSlot(species, 'Kobold; Draconic Sorcery', 'MPMM')?.classes.map((c) => c.className)).toEqual(['Sorcerer'])
	})

	it('a spells.json failure hits only a species with the grant (finding 3)', async () => {
		await expect(loadSpeciesCantripChoice('Elf; Wood Elf Lineage', 'XPHB')).resolves.toBeNull()
		await expect(loadSpeciesCantripChoice('Khoravar', 'EFA')).rejects.toThrow('spells.json failed')
	})

	it('merges Khoravar’s three lists into one, cantrips only, each labelled with its classes', () => {
		const slot = extractSpeciesCantripSlot(species, 'Khoravar', 'EFA')!
		expect(speciesCantripOptions(spells, slot)).toEqual([
			{ name: 'Druidcraft', source: 'XPHB', classNames: ['Druid'] },
			{ name: 'Fire Bolt', source: 'XPHB', classNames: ['Wizard'] },
			{ name: 'Light', source: 'XPHB', classNames: ['Cleric', 'Wizard'] },
			{ name: 'Sacred Flame', source: 'XPHB', classNames: ['Cleric'] },
		])
	})
})
