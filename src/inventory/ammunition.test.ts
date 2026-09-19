import { describe, expect, it } from 'vitest'
import type { CharacterInventoryItem } from '../storage/character'
import { ammoEntriesFor, autoSpendEntry, canSpendAmmo, spendAmmo } from './ammunition'
import type { ItemRef } from './inventoryData'

const ARROW: ItemRef = { name: 'Arrow', source: 'XPHB', typeCode: 'A' }
const ARROWS_20: ItemRef = { name: 'Arrows (20)', source: 'XPHB', typeCode: 'A', packContents: [{ item: 'arrow|xphb', quantity: 20 }] }
const BOLT: ItemRef = { name: 'Bolt', source: 'XPHB', typeCode: 'A' }
/** A gear pack that happens to list arrows among other things: not ammunition, so never a source of it. */
const HUNTERS_KIT: ItemRef = { name: "Hunter's Kit", source: 'XPHB', typeCode: 'G', packContents: [{ item: 'arrow|xphb', quantity: 5 }] }
const REFS = [ARROW, ARROWS_20, BOLT, HUNTERS_KIT]

const row = (name: string, quantity: number, extra: Partial<CharacterInventoryItem> = {}): CharacterInventoryItem => ({ name, source: 'XPHB', quantity, ...extra })

describe('ammoEntriesFor', () => {
	it('pairs a weapon with the one inventory row that IS its ammoType', () => {
		expect(ammoEntriesFor('arrow|xphb', [row('Bolt', 9), row('Arrow', 12)], REFS)).toEqual([{ kind: 'loose', index: 1, name: 'Arrow', quantity: 12 }])
	})

	it('shows every matching row on its own line — never summed or merged', () => {
		const entries = ammoEntriesFor('arrow|xphb', [row('Arrow', 12), row('Arrow', 3, { magicBonus: 1 }), row('Arrows (20)', 1)], REFS)
		expect(entries.map((entry) => [entry.kind, entry.name, entry.quantity])).toEqual([
			['loose', 'Arrow', 12],
			['loose', 'Arrow +1', 3],
			['pack', 'Arrows (20)', 1],
		])
	})

	it('a match with quantity 0 is still listed, at 0', () => {
		expect(ammoEntriesFor('arrow|xphb', [row('Arrow', 0)], REFS)).toEqual([{ kind: 'loose', index: 0, name: 'Arrow', quantity: 0 }])
	})

	it('names the missing ammunition, at 0, when nothing in the inventory feeds the weapon (D43)', () => {
		expect(ammoEntriesFor('arrow|xphb', [row('Bolt', 9)], REFS)).toEqual([{ kind: 'none', index: null, name: 'Arrow', quantity: 0 }])
	})

	it('falls back to the raw key when the item data has no such item', () => {
		expect(ammoEntriesFor('nail|xphb', [], REFS)).toEqual([{ kind: 'none', index: null, name: 'nail|xphb', quantity: 0 }])
	})

	it('does not count a non-ammunition pack that lists the ammunition', () => {
		expect(ammoEntriesFor('arrow|xphb', [row("Hunter's Kit", 1)], REFS)).toEqual([{ kind: 'none', index: null, name: 'Arrow', quantity: 0 }])
	})

	it('reads a pack through packContents, with what it opens into', () => {
		expect(ammoEntriesFor('arrow|xphb', [row('Arrows (20)', 2)], REFS)).toEqual([
			{ kind: 'pack', index: 0, name: 'Arrows (20)', quantity: 2, pieces: 20, looseItem: { name: 'Arrow', source: 'XPHB' } },
		])
	})
})

describe('canSpendAmmo', () => {
	it('is false with nothing, at 0, and for a pack whose loose item is not in the data', () => {
		expect(canSpendAmmo({ kind: 'none', index: null, name: 'Arrow', quantity: 0 })).toBe(false)
		expect(canSpendAmmo({ kind: 'loose', index: 0, name: 'Arrow', quantity: 0 })).toBe(false)
		expect(canSpendAmmo({ kind: 'pack', index: 0, name: 'Arrows (20)', quantity: 1, pieces: 20, looseItem: null })).toBe(false)
		expect(canSpendAmmo({ kind: 'loose', index: 0, name: 'Arrow', quantity: 1 })).toBe(true)
	})
})

describe('autoSpendEntry', () => {
	const entriesFor = (inventory: CharacterInventoryItem[]) => ammoEntriesFor('arrow|xphb', inventory, REFS)

	it('picks the one entry when the match is unambiguous', () => {
		expect(autoSpendEntry(entriesFor([row('Arrow', 5)]))).toEqual({ kind: 'loose', index: 0, name: 'Arrow', quantity: 5 })
		expect(autoSpendEntry(entriesFor([row('Arrows (20)', 1)]))?.kind).toBe('pack')
	})

	it('is null for two entries — plain and +1, or loose and pack — never a guess', () => {
		expect(autoSpendEntry(entriesFor([row('Arrow', 12), row('Arrow', 3, { magicBonus: 1 })]))).toBeNull()
		expect(autoSpendEntry(entriesFor([row('Arrow', 12), row('Arrows (20)', 1)]))).toBeNull()
	})

	it('is null when the one entry cannot be spent: at 0, or nothing matching', () => {
		expect(autoSpendEntry(entriesFor([row('Arrow', 0)]))).toBeNull()
		expect(autoSpendEntry(entriesFor([row('Bolt', 9)]))).toBeNull()
	})
})

describe('spendAmmo', () => {
	function spendFirst(ammoType: string, inventory: CharacterInventoryItem[]): CharacterInventoryItem[] {
		return spendAmmo(inventory, ammoEntriesFor(ammoType, inventory, REFS)[0])
	}

	it('takes one off a loose row and leaves every other row alone', () => {
		expect(spendFirst('arrow|xphb', [row('Bolt', 9), row('Arrow', 12)])).toEqual([row('Bolt', 9), row('Arrow', 11)])
	})

	it('stops at 0 and keeps the row — spending the last one, then spending again', () => {
		const last = spendFirst('arrow|xphb', [row('Arrow', 1)])
		expect(last).toEqual([row('Arrow', 0)])
		expect(spendFirst('arrow|xphb', last)).toEqual([row('Arrow', 0)])
	})

	it('changes nothing when there is nothing to spend', () => {
		const inventory = [row('Bolt', 9)]
		expect(spendFirst('arrow|xphb', inventory)).toEqual(inventory)
	})

	it('spends from the entry it is given, not from the first match', () => {
		const inventory = [row('Arrow', 12), row('Arrow', 3, { magicBonus: 1 })]
		const entries = ammoEntriesFor('arrow|xphb', inventory, REFS)
		expect(spendAmmo(inventory, entries[1])).toEqual([row('Arrow', 12), row('Arrow', 2, { magicBonus: 1 })])
	})

	it('does not modify the inventory it was given', () => {
		const inventory = [row('Arrow', 12)]
		spendFirst('arrow|xphb', inventory)
		expect(inventory).toEqual([row('Arrow', 12)])
	})

	describe('opening a pack', () => {
		it('the only pack becomes its pieces, minus the one spent, where the pack was', () => {
			expect(spendFirst('arrow|xphb', [row('Backpack', 1), row('Arrows (20)', 1), row('Torch', 5)])).toEqual([
				row('Backpack', 1),
				row('Arrow', 19),
				row('Torch', 5),
			])
		})

		it('with more packs, one is opened and the rest stay closed', () => {
			expect(spendFirst('arrow|xphb', [row('Arrows (20)', 3)])).toEqual([row('Arrows (20)', 2), row('Arrow', 19)])
		})

		it('adds the pieces to the plain row of the loose item instead of starting a second one', () => {
			expect(spendFirst('arrow|xphb', [row('Arrows (20)', 1), row('Arrow', 4)])).toEqual([row('Arrow', 23)])
		})

		/** The pack line, wherever it sits among the entries. */
		function openPack(inventory: CharacterInventoryItem[]): CharacterInventoryItem[] {
			return spendAmmo(inventory, ammoEntriesFor('arrow|xphb', inventory, REFS).find((entry) => entry.kind === 'pack')!)
		}

		it('revives a loose row that had run down to 0', () => {
			expect(openPack([row('Arrow', 0), row('Arrows (20)', 1)])).toEqual([row('Arrow', 19)])
		})

		it('does not fold the pieces into a loose row carrying its own state', () => {
			expect(openPack([row('Arrow', 4, { magicBonus: 1 }), row('Arrows (20)', 1)])).toEqual([row('Arrow', 4, { magicBonus: 1 }), row('Arrow', 19)])
		})

		it('cannot open a pack whose loose item is missing from the item data', () => {
			const inventory = [row('Arrows (20)', 1)]
			const entry = ammoEntriesFor('arrow|xphb', inventory, [ARROWS_20])[0]
			expect(entry.looseItem).toBeNull()
			expect(spendAmmo(inventory, entry)).toEqual(inventory)
		})
	})
})
