import { describe, expect, it } from 'vitest'
import { armourCategoryOf, equipSlotOf, extractItemRefs, inventoryRowKey, isConsumable, isShield, isWeapon, itemKey, itemMagicBonusOf } from './inventoryData'

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

	/* Slice e's survey: every bonus is a "+1" STRING, and the AC bonus is NOT already inside `ac`. */
	it('parses the magic bonus fields from their string form', () => {
		const parsed = [
			{ name: 'Dragon Scale Mail', source: 'XDMG', type: 'MA', ac: 14, bonusAc: '+1' },
			{ name: 'Moon Sickle', source: 'TCE', type: 'M', bonusWeapon: '+2' },
			{ name: 'Odd Item', source: 'HOMEBREW', bonusAc: 1 },
		]
		expect(extractItemRefs(parsed)).toEqual([
			{ name: 'Dragon Scale Mail', source: 'XDMG', typeCode: 'MA', ac: 14, bonusAc: 1 },
			{ name: 'Moon Sickle', source: 'TCE', typeCode: 'M', bonusWeapon: 2 },
			// A shape the survey did not find is dropped rather than guessed at.
			{ name: 'Odd Item', source: 'HOMEBREW' },
		])
	})

	/* Slice f's survey: items carry only plain lowercase damage-type strings, never the {choose} shape the 2 species and 1 feat use. */
	it('parses the damage resistance and immunity fields, dropping shapes it cannot represent', () => {
		const parsed = [
			{ name: 'Ring of Fire Resistance', source: 'XDMG', resist: ['fire'] },
			{ name: 'Axe of the Dwarvish Lords', source: 'XDMG', resist: ['fire'], immune: ['poison'] },
			{ name: 'Ghost Step Tattoo', source: 'XDMG', conditionImmune: ['grappled'] },
			{ name: 'Odd Item', source: 'HOMEBREW', resist: [{ choose: { from: ['fire'] } }] },
		]
		expect(extractItemRefs(parsed)).toEqual([
			{ name: 'Axe of the Dwarvish Lords', source: 'XDMG', resist: ['fire'], immune: ['poison'] },
			// conditionImmune is conditions, not damage types — deliberately not read.
			{ name: 'Ghost Step Tattoo', source: 'XDMG' },
			{ name: 'Odd Item', source: 'HOMEBREW' },
			{ name: 'Ring of Fire Resistance', source: 'XDMG', resist: ['fire'] },
		])
	})

	it('reads the bonus in the role the item plays, and nothing for a wondrous item that carries one', () => {
		expect(itemMagicBonusOf({ name: 'Moon Sickle', source: 'TCE', typeCode: 'M', bonusWeapon: 2 })).toBe(2)
		expect(itemMagicBonusOf({ name: 'Dragon Scale Mail', source: 'XDMG', typeCode: 'MA', ac: 14, bonusAc: 1 })).toBe(1)
		expect(itemMagicBonusOf({ name: 'Arrow-Catching Shield', source: 'XDMG', typeCode: 'S', ac: 2, bonusAc: 2 })).toBe(2)
		// Cloak of Protection carries bonusAc but is not armour — this slice puts no number on it.
		expect(itemMagicBonusOf({ name: 'Cloak of Protection', source: 'XDMG', bonusAc: 1 })).toBeNull()
		// Staff of Power is a weapon carrying bonusAc; only its weapon bonus would count, and it has none.
		expect(itemMagicBonusOf({ name: 'Staff of Power', source: 'XDMG', typeCode: 'M', bonusAc: 2 })).toBeNull()
	})

	it('reports the three armour categories and refuses everything that is not gear', () => {
		expect(armourCategoryOf({ name: 'Leather Armor', source: 'XPHB', typeCode: 'LA', armor: true })).toBe('light')
		expect(armourCategoryOf({ name: 'Chain Mail', source: 'XPHB', typeCode: 'HA', armor: true })).toBe('heavy')
		expect(armourCategoryOf({ name: 'Shield', source: 'XPHB', typeCode: 'S' })).toBeNull()
		expect(equipSlotOf({ name: 'Torch', source: 'XPHB', typeCode: 'G' })).toBeNull()
		expect(equipSlotOf({ name: 'Rations', source: 'XPHB' })).toBeNull()
	})

	it('identifies a consumable by type code alone, never by name (slice f-fix, D21)', () => {
		expect(isConsumable({ name: 'Potion of Fire Resistance', source: 'XPHB', typeCode: 'P' })).toBe(true)
		expect(isConsumable({ name: 'Spell Scroll (Fireball)', source: 'XDMG', typeCode: 'SC' })).toBe(true)
		expect(isConsumable({ name: 'Draught of the Salamander', source: 'HB', typeCode: 'P' })).toBe(true)
		expect(isConsumable({ name: 'Ring of Fire Resistance', source: 'XDMG', typeCode: 'RG' })).toBe(false)
		expect(isConsumable({ name: 'Acid Absorbing Tattoo', source: 'XDMG' })).toBe(false)
	})
})

describe('inventoryRowKey', () => {
	const longsword = { name: 'Longsword', source: 'XPHB', quantity: 1 }

	it('separates two otherwise-identical items that carry different bonuses', () => {
		expect(inventoryRowKey({ ...longsword, magicBonus: 1 })).not.toBe(inventoryRowKey(longsword))
		expect(inventoryRowKey({ ...longsword, magicBonus: 1 })).not.toBe(inventoryRowKey({ ...longsword, magicBonus: 2 }))
	})

	it('separates rows on every other per-row fact too, and merges rows that match on all of them', () => {
		expect(inventoryRowKey({ ...longsword, equipped: 'held' })).not.toBe(inventoryRowKey(longsword))
		expect(inventoryRowKey({ ...longsword, attuned: true })).not.toBe(inventoryRowKey(longsword))
		expect(inventoryRowKey({ ...longsword, attackAbility: 'strength' })).not.toBe(inventoryRowKey(longsword))
		// Quantity is not part of it — that is what merging ADDS.
		expect(inventoryRowKey({ ...longsword, quantity: 7 })).toBe(inventoryRowKey(longsword))
	})
})
