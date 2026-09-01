import { describe, expect, it } from 'vitest'
import { armourCategoryOf, equipSlotOf, extractItemRefs, isShield, isWeapon, itemKey } from './inventoryData'

describe('extractItemRefs', () => {
	it('keeps every entry with a string name and source, sorted by name then source', () => {
		const parsed = [
			{ name: 'Torch', source: 'XPHB', type: 'G', value: 1 },
			{ name: 'Longsword', source: 'XPHB', weapon: true },
			{ name: 'Longsword', source: 'XDMG', rarity: 'rare' },
		]
		expect(extractItemRefs(parsed)).toEqual([
			{ name: 'Longsword', source: 'XDMG' },
			{ name: 'Longsword', source: 'XPHB', weapon: true },
			{ name: 'Torch', source: 'XPHB', typeCode: 'G' },
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

	/* items.json states the requirement two ways and nowhere else: a bare `true` (174 items), or the restriction as a sentence (98). */
	it('carries the attunement requirement, keeping a restriction string verbatim', () => {
		const parsed = [
			{ name: 'Amulet of Health', source: 'XDMG', reqAttune: true },
			{ name: 'Wand of the War Mage, +1', source: 'XDMG', reqAttune: 'by a spellcaster', reqAttuneTags: [{ spellcasting: true }] },
			{ name: 'Backpack', source: 'XPHB' },
		]
		expect(extractItemRefs(parsed)).toEqual([
			{ name: 'Amulet of Health', source: 'XDMG', requiresAttunement: true },
			{ name: 'Backpack', source: 'XPHB' },
			{ name: 'Wand of the War Mage, +1', source: 'XDMG', requiresAttunement: true, attunementCondition: 'by a spellcaster' },
		])
	})

	it('throws when the parsed value is not an array', () => {
		expect(() => extractItemRefs({ items: [] })).toThrow('items.json')
	})

	it('carries the gear fields slice b reads, taking only the first segment of the type code', () => {
		const parsed = [{ name: 'Chain Mail', source: 'XPHB', type: 'HA|XPHB', armor: true, ac: 16, strength: '13', stealth: true }]
		expect(extractItemRefs(parsed)).toEqual([
			{ name: 'Chain Mail', source: 'XPHB', typeCode: 'HA', armor: true, ac: 16, strength: '13', stealth: true },
		])
	})
})

describe('item kinds', () => {
	// DATA.md, "Identifying item kinds": magic weapons and armour carry NO armor/weapon flag, only a type code.
	it('recognises magic armour, shields and magic weapons that carry no flag', () => {
		expect(armourCategoryOf({ name: 'Dragon Scale Mail', source: 'XDMG', typeCode: 'MA', ac: 14 })).toBe('medium')
		expect(equipSlotOf({ name: 'Dragon Scale Mail', source: 'XDMG', typeCode: 'MA', ac: 14 })).toBe('worn')
		expect(isShield({ name: 'Arrow-Catching Shield', source: 'XDMG', typeCode: 'S', ac: 2 })).toBe(true)
		expect(equipSlotOf({ name: 'Arrow-Catching Shield', source: 'XDMG', typeCode: 'S', ac: 2 })).toBe('held')
		expect(isWeapon({ name: 'Sun Blade', source: 'XDMG', typeCode: 'M' })).toBe(true)
		expect(equipSlotOf({ name: 'Sun Blade', source: 'XDMG', typeCode: 'M' })).toBe('held')
	})

	it('reports the three armour categories and refuses everything that is not gear', () => {
		expect(armourCategoryOf({ name: 'Leather Armor', source: 'XPHB', typeCode: 'LA', armor: true })).toBe('light')
		expect(armourCategoryOf({ name: 'Chain Mail', source: 'XPHB', typeCode: 'HA', armor: true })).toBe('heavy')
		expect(armourCategoryOf({ name: 'Shield', source: 'XPHB', typeCode: 'S' })).toBeNull()
		expect(equipSlotOf({ name: 'Torch', source: 'XPHB', typeCode: 'G' })).toBeNull()
		expect(equipSlotOf({ name: 'Rations', source: 'XPHB' })).toBeNull()
	})
})
