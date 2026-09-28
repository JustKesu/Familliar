import { describe, expect, it, vi } from 'vitest'
import { loadClassSpellPool } from './classSpellPool'
import type { ClassSpellListSpell } from './classSpellListData'
import { filterSpellsByLevel } from './spellLevelFilter'
import type { SpellSlotsEntry } from '../calculation/spellSlots'

function spell(name: string, level: number): ClassSpellListSpell {
	return { name, source: 'XPHB', level, ritual: false, concentration: false, viaVariant: false }
}

vi.mock('../dataLoader/dataLoader', () => ({
	loadDataFile: vi.fn(async () => [
		{
			entryType: 'class',
			name: 'Bard',
			source: 'XPHB',
			additionalSpells: [
				{
					expanded: {
						'10': [{ all: 'level=1;2;3;4;5|class=Cleric;Druid;Wizard' }],
						s6: [{ all: 'level=6|class=Cleric;Druid;Wizard' }],
					},
				},
			],
		},
	]),
}))

vi.mock('./classSpellListData', async () => {
	const actual = await vi.importActual<typeof import('./classSpellListData')>('./classSpellListData')
	return {
		...actual,
		loadClassSpellList: vi.fn(async (className: string) => {
			if (className === 'Bard') return [spell('Vicious Mockery', 0), spell('Cure Wounds', 1)]
			if (className === 'Cleric') return [spell('Bless', 1), spell('Shield', 1)]
			if (className === 'Druid') return [spell('Cure Wounds', 1)]
			if (className === 'Wizard') return [spell('Fire Bolt', 0), spell('Fireball', 3), spell('Chain Lightning', 6), spell('Wish', 9)]
			if (className === 'Sorcerer') return [spell('Fire Bolt', 0), spell('Shield', 1)]
			if (className === 'Cleric') return [spell('Bless', 1), spell('Shield', 1)]
			return []
		}),
		loadFeatExpandedSpellList: vi.fn(async (featName: string) => (featName === 'Mark of Detection' ? [spell('Identify', 1)] : [])),
	}
})

describe('loadClassSpellPool with a class record’s own expanded (D209, Bard Magical Secrets)', () => {
	const bard = { className: 'Bard', classSource: 'XPHB' }

	// "sN" blocks carry no gate of their own — the slot-level filter is what keeps a 6th-level pick out until a 6th slot exists.
	const slots = (ordinary: number[]) => ({ ordinarySlots: ordinary }) as SpellSlotsEntry

	it('adds nothing below the level gate — Bard 9 has no Cleric/Wizard-only spell once the slot filter applies', async () => {
		const pool = await loadClassSpellPool({ ...bard, classLevel: 9 })
		expect(filterSpellsByLevel(pool, slots([4, 3, 3, 3, 1])).map((s) => s.name)).toEqual(['Vicious Mockery', 'Cure Wounds'])
	})

	it('at Bard 10 offers levels 1-5 of the other lists, tagged; no cantrips, nothing above 5, no tag on a spell the Bard list has', async () => {
		const pool = filterSpellsByLevel(await loadClassSpellPool({ ...bard, classLevel: 10 }), slots([4, 3, 3, 3, 2]))
		expect(pool.map((s) => s.name)).toEqual(['Vicious Mockery', 'Cure Wounds', 'Bless', 'Shield', 'Fireball'])
		expect(pool.find((s) => s.name === 'Fireball')?.viaClassExpanded).toBe(true)
		expect(pool.find((s) => s.name === 'Cure Wounds')?.viaClassExpanded).toBeUndefined()
	})

	it('at Bard 11 the sN block lets a 6th-level Wizard-only spell through', async () => {
		expect(filterSpellsByLevel(await loadClassSpellPool({ ...bard, classLevel: 11 }), slots([4, 3, 3, 3, 2, 1])).map((s) => s.name)).toContain('Chain Lightning')
	})

	it('is not applied without a class level', async () => {
		expect((await loadClassSpellPool(bard)).map((s) => s.name)).toEqual(['Vicious Mockery', 'Cure Wounds'])
	})
})

describe('loadClassSpellPool (D208: the one pool SpellPicker and Manage Spells share)', () => {
	it('is the class list alone when nothing widens it', async () => {
		expect((await loadClassSpellPool({ className: 'Sorcerer', classSource: 'XPHB' })).map((s) => s.name)).toEqual(['Fire Bolt', 'Shield'])
	})

	it('unions the D46 expanded class list and every feat’s expanded spells, once per spell', async () => {
		const pool = await loadClassSpellPool({
			className: 'Sorcerer',
			classSource: 'XPHB',
			expandedClassName: 'Cleric',
			expandedClassSource: 'XPHB',
			featChoices: [
				{ name: 'Mark of Detection', source: 'EFA' },
				{ name: 'Alert', source: 'XPHB' },
			],
		})
		expect(pool.map((s) => s.name)).toEqual(['Fire Bolt', 'Shield', 'Bless', 'Identify'])
	})
})
