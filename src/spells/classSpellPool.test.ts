import { describe, expect, it, vi } from 'vitest'
import { loadClassSpellPool } from './classSpellPool'
import type { ClassSpellListSpell } from './classSpellListData'

function spell(name: string, level: number): ClassSpellListSpell {
	return { name, source: 'XPHB', level, ritual: false, concentration: false, viaVariant: false }
}

vi.mock('./classSpellListData', async () => {
	const actual = await vi.importActual<typeof import('./classSpellListData')>('./classSpellListData')
	return {
		...actual,
		loadClassSpellList: vi.fn(async (className: string) => {
			if (className === 'Sorcerer') return [spell('Fire Bolt', 0), spell('Shield', 1)]
			if (className === 'Cleric') return [spell('Bless', 1), spell('Shield', 1)]
			return []
		}),
		loadFeatExpandedSpellList: vi.fn(async (featName: string) => (featName === 'Mark of Detection' ? [spell('Identify', 1)] : [])),
	}
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
