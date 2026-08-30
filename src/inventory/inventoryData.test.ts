import { describe, expect, it } from 'vitest'
import { extractItemRefs, itemKey } from './inventoryData'

describe('extractItemRefs', () => {
	it('keeps every entry with a string name and source, sorted by name then source', () => {
		const parsed = [
			{ name: 'Torch', source: 'XPHB', type: 'G', value: 1 },
			{ name: 'Longsword', source: 'XPHB', weapon: true },
			{ name: 'Longsword', source: 'XDMG', rarity: 'rare' },
		]
		expect(extractItemRefs(parsed)).toEqual([
			{ name: 'Longsword', source: 'XDMG' },
			{ name: 'Longsword', source: 'XPHB' },
			{ name: 'Torch', source: 'XPHB' },
		])
	})

	it('drops malformed rows rather than throwing', () => {
		const parsed = [{ name: 'Real Item', source: 'XPHB' }, { name: 'no source' }, null, 'string', { source: 'XPHB' }]
		expect(extractItemRefs(parsed)).toEqual([{ name: 'Real Item', source: 'XPHB' }])
	})

	it('offers magic items too — nothing is filtered by rarity', () => {
		const parsed = [
			{ name: 'Holy Avenger', source: 'XDMG', rarity: 'legendary', reqAttune: true },
			{ name: 'Club', source: 'XPHB', rarity: 'none' },
		]
		expect(extractItemRefs(parsed).map(itemKey)).toEqual(['Club|XPHB', 'Holy Avenger|XDMG'])
	})

	it('throws when the parsed value is not an array', () => {
		expect(() => extractItemRefs({ items: [] })).toThrow('items.json')
	})
})
