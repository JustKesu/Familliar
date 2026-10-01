import { describe, expect, it } from 'vitest'
import { extractSpeciesCantripSlot, speciesCantripOptions } from './speciesCantripData'

/* Shapes from scripts/investigate-species-cantrips.js (DATA.md, S2). */
const species = [
	{ name: 'Elf', source: 'XPHB', additionalSpells: [{ name: 'High Elf', ability: { choose: ['int', 'wis', 'cha'] }, known: { 1: { _: [{ choose: 'level=0|class=Wizard' }] } } }] },
	{ name: 'Elf; High Elf Lineage', source: 'XPHB', additionalSpells: [{ ability: { choose: ['int', 'wis', 'cha'] }, known: { 1: { _: [{ choose: 'level=0|class=Wizard' }] } } }] },
	{ name: 'Khoravar', source: 'EFA', additionalSpells: [{ ability: { choose: ['int', 'wis', 'cha'] }, known: { 1: { _: [{ choose: 'level=0|class=Cleric;Druid;Wizard' }] } } }] },
	{ name: 'Elf; Wood Elf Lineage', source: 'XPHB', additionalSpells: [{ ability: { choose: ['int', 'wis', 'cha'] }, known: { 1: ['druidcraft|xphb'] } }] },
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
