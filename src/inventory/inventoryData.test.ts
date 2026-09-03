import { describe, expect, it } from 'vitest'
import {
	armourCategoryOf,
	buildInventoryResolver,
	customItemFromRef,
	customItemRef,
	describeCustomItemProblem,
	equipSlotOf,
	exclusiveSlotOf,
	extractItemRefs,
	inventoryRowKey,
	isConsumable,
	isShield,
	isWeapon,
	itemKey,
	itemMagicBonusOf,
	wornAcBonusOf,
	type ItemRef,
} from './inventoryData'
import { CUSTOM_ITEM_SOURCE, type CustomItemDefinition, type CustomItemKind } from '../storage/character'

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
			{ name: 'Torch', source: 'XPHB', typeCode: 'G', value: 1 },
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

	/* Slice g. The array is carried through untouched — nothing here reads into it, and an empty one is the same as no description. */
	it('carries the description entries verbatim, and omits the field when there is nothing to show', () => {
		const entries = ['You gain a +1 bonus to {@variantrule Armor Class|XPHB}.', { type: 'list', items: ['One', 'Two'] }]
		const parsed = [
			{ name: 'Cloak of Protection', source: 'XDMG', entries },
			{ name: 'Empty', source: 'XPHB', entries: [] },
			{ name: 'Longsword', source: 'XPHB' },
		]
		expect(extractItemRefs(parsed)).toEqual([
			{ name: 'Cloak of Protection', source: 'XDMG', entries },
			{ name: 'Empty', source: 'XPHB' },
			{ name: 'Longsword', source: 'XPHB' },
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

	/* Slice h's survey: the five worn-item bonus fields, all "+N" strings like slice e's two. */
	it('parses the five worn-item bonus fields', () => {
		const parsed = [
			{ name: 'Cloak of Protection', source: 'XDMG', reqAttune: true, bonusAc: '+1', bonusSavingThrow: '+1' },
			{ name: 'Ioun Stone, Mastery', source: 'XDMG', reqAttune: true, bonusProficiencyBonus: '+1' },
			{ name: 'Rod of the Pact Keeper', source: 'XDMG', type: 'RD', reqAttune: true, bonusSpellAttack: '+2', bonusSpellSaveDc: '+2' },
			{ name: 'Stone of Good Luck', source: 'XDMG', reqAttune: true, bonusSavingThrow: '+1', bonusAbilityCheck: '+1' },
		]
		expect(extractItemRefs(parsed)).toEqual([
			{ name: 'Cloak of Protection', source: 'XDMG', requiresAttunement: true, bonusAc: 1, bonusSavingThrow: 1 },
			{ name: 'Ioun Stone, Mastery', source: 'XDMG', requiresAttunement: true, bonusProficiencyBonus: 1 },
			{ name: 'Rod of the Pact Keeper', source: 'XDMG', typeCode: 'RD', requiresAttunement: true, bonusSpellAttack: 2, bonusSpellSaveDc: 2 },
			{ name: 'Stone of Good Luck', source: 'XDMG', requiresAttunement: true, bonusSavingThrow: 1, bonusAbilityCheck: 1 },
		])
	})

	it('reads bonusAc as a WORN bonus only where no armour role already claims it', () => {
		expect(wornAcBonusOf({ name: 'Cloak of Protection', source: 'XDMG', bonusAc: 1 })).toBe(1)
		// A staff is a weapon, so its own bonus is bonusWeapon; the bonusAc it also carries lands on the character.
		expect(wornAcBonusOf({ name: 'Staff of Power', source: 'XDMG', typeCode: 'M', bonusAc: 2 })).toBe(2)
		// itemMagicBonusOf already applies these two through the armour and shield roles (slice e).
		expect(wornAcBonusOf({ name: 'Glamoured Studded Leather', source: 'XDMG', typeCode: 'LA', ac: 12, bonusAc: 1 })).toBeNull()
		expect(wornAcBonusOf({ name: 'Repulsion Shield', source: 'EFA', typeCode: 'S', ac: 2, bonusAc: 1 })).toBeNull()
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

	/* Two custom items share the same (name, "Custom") pair, so the definition itself has to be in the key or they collapse (slice e2a). */
	it('separates two custom items that differ in a single field', () => {
		const scarf: CustomItemDefinition = { name: 'Scarf', kind: 'worn' }
		const row = { name: 'Scarf', source: CUSTOM_ITEM_SOURCE, quantity: 1 }

		expect(inventoryRowKey({ ...row, custom: scarf })).not.toBe(inventoryRowKey(row))
		expect(inventoryRowKey({ ...row, custom: scarf })).toBe(inventoryRowKey({ ...row, custom: { name: 'Scarf', kind: 'worn' } }))
		expect(inventoryRowKey({ ...row, custom: scarf })).not.toBe(inventoryRowKey({ ...row, custom: { ...scarf, kind: 'other' } }))
		expect(inventoryRowKey({ ...row, custom: scarf })).not.toBe(inventoryRowKey({ ...row, custom: { ...scarf, valueCopper: 5 } }))
		expect(inventoryRowKey({ ...row, custom: scarf })).not.toBe(inventoryRowKey({ ...row, custom: { ...scarf, requiresAttunement: true } }))
		expect(inventoryRowKey({ ...row, custom: scarf })).not.toBe(inventoryRowKey({ ...row, custom: { ...scarf, attunementCondition: 'by a bard' } }))
		expect(inventoryRowKey({ ...row, custom: scarf })).not.toBe(inventoryRowKey({ ...row, custom: { ...scarf, description: 'It is warm.' } }))
	})
})

/*
 * Custom items (build order step 7, slice e2a). The resolver is the single
 * point every consumer goes through, so these prove the two branches (own
 * definition vs items.json) and the malformed one D43 covers.
 */
describe('custom items', () => {
	const magicScarf: CustomItemDefinition = {
		name: 'Scarf of Warmth',
		kind: 'worn',
		valueCopper: 5000,
		requiresAttunement: true,
		attunementCondition: 'by a bard',
		description: 'You are comfortable in cold weather.\n\nIt is a nice scarf.',
	}

	it('resolves a row against its own definition, never against items.json', () => {
		const resolve = buildInventoryResolver([{ name: 'Scarf of Warmth', source: 'XPHB', typeCode: 'HA', ac: 18 }])
		const { ref, problem } = resolve({ name: 'Scarf of Warmth', source: CUSTOM_ITEM_SOURCE, quantity: 1, custom: magicScarf })

		expect(problem).toBeNull()
		expect(ref).toEqual({
			name: 'Scarf of Warmth',
			source: CUSTOM_ITEM_SOURCE,
			customKind: 'worn',
			value: 5000,
			requiresAttunement: true,
			attunementCondition: 'by a bard',
			entries: ['You are comfortable in cold weather.', 'It is a nice scarf.'],
		})
		// The same-named real item's armour class is not borrowed: a custom item is only what it declares.
		expect(ref?.ac).toBeUndefined()
	})

	it('still resolves ordinary rows, and reports one the item data does not know (D43)', () => {
		const resolve = buildInventoryResolver([{ name: 'Torch', source: 'XPHB', typeCode: 'G' }])
		expect(resolve({ name: 'Torch', source: 'XPHB', quantity: 1 }).ref?.typeCode).toBe('G')

		const missing = resolve({ name: 'Mystery Plate', source: 'HB', quantity: 1 })
		expect(missing.ref).toBeNull()
		expect(missing.problem).toEqual({ kind: 'not-in-item-data', message: 'Item data not found for "Mystery Plate" (HB).' })
	})

	it('reports a malformed definition with the problem stated instead of resolving it (D43)', () => {
		const resolve = buildInventoryResolver([])
		const broken = resolve({ name: 'Bad Thing', source: CUSTOM_ITEM_SOURCE, quantity: 1, custom: { name: 'Bad Thing', kind: 'banana' } as unknown as CustomItemDefinition })

		expect(broken.ref).toBeNull()
		expect(broken.problem?.kind).toBe('malformed-custom')
		expect(broken.problem?.message).toContain('Bad Thing')
		expect(broken.problem?.message).toContain('banana')
	})

	it('names what is wrong with each malformed shape, and passes a sound one', () => {
		expect(describeCustomItemProblem(magicScarf)).toBeNull()
		expect(describeCustomItemProblem({ name: 'Plain', kind: 'other' })).toBeNull()
		expect(describeCustomItemProblem('a string')).toBe('the definition is not an object')
		expect(describeCustomItemProblem({ kind: 'other' })).toBe('it has no name')
		expect(describeCustomItemProblem({ name: '  ', kind: 'other' })).toBe('it has no name')
		expect(describeCustomItemProblem({ name: 'X', kind: 'armor' })).toContain('is not one of')
		expect(describeCustomItemProblem({ name: 'X', kind: 'other', valueCopper: -1 })).toContain('whole number of copper')
		expect(describeCustomItemProblem({ name: 'X', kind: 'other', valueCopper: 1.5 })).toContain('whole number of copper')
		expect(describeCustomItemProblem({ name: 'X', kind: 'other', requiresAttunement: false })).toContain('attunement requirement')
		expect(describeCustomItemProblem({ name: 'X', kind: 'other', attunementCondition: 3 })).toContain('attunement condition')
		expect(describeCustomItemProblem({ name: 'X', kind: 'other', description: [] })).toContain('description must be text')
	})

	it('gives the equip control to the kinds a body can wear or hold, and to no other', () => {
		const ref = (kind: CustomItemKind): ItemRef => customItemRef({ name: 'Thing', kind }, CUSTOM_ITEM_SOURCE)
		expect(equipSlotOf(ref('weapon'))).toBe('held')
		expect(equipSlotOf(ref('shield'))).toBe('held')
		expect(equipSlotOf(ref('armour'))).toBe('worn')
		// A worn wondrous item is gated on attunement alone — the real ones get no equip control either (slice h).
		expect(equipSlotOf(ref('worn'))).toBeNull()
		expect(equipSlotOf(ref('other'))).toBeNull()

		expect(exclusiveSlotOf(ref('armour'))).toBe('armour')
		expect(exclusiveSlotOf(ref('shield'))).toBe('shield')
		// Two weapons can be held at once, so a weapon displaces nothing.
		expect(exclusiveSlotOf(ref('weapon'))).toBeNull()
		expect(exclusiveSlotOf({ name: 'Chain Mail', source: 'XPHB', typeCode: 'HA', armor: true })).toBe('armour')
		expect(exclusiveSlotOf({ name: 'Shield', source: 'XPHB', typeCode: 'S', ac: 2 })).toBe('shield')
	})

	/* Slice e2b's fields are deliberately absent, so nothing computes a number the definition cannot back up. */
	it('carries no computed field, so it reaches no calculation', () => {
		const armour = customItemRef({ name: 'Bark Plate', kind: 'armour' }, CUSTOM_ITEM_SOURCE)
		expect(armourCategoryOf(armour)).toBeNull()
		expect(armour.ac).toBeUndefined()
		expect(itemMagicBonusOf(armour)).toBeNull()
		expect(wornAcBonusOf(armour)).toBeNull()

		const weapon = customItemRef({ name: 'Bone Club', kind: 'weapon' }, CUSTOM_ITEM_SOURCE)
		expect(isWeapon(weapon)).toBe(false)
		expect(weapon.dmg1).toBeUndefined()
	})

	it('seeds a definition from an existing item, copying only what this slice holds', () => {
		expect(
			customItemFromRef({
				name: 'Chain Mail',
				source: 'XPHB',
				typeCode: 'HA',
				armor: true,
				ac: 16,
				strength: '13',
				stealth: true,
				value: 7500,
			}),
		).toEqual({ name: 'Chain Mail', kind: 'armour', valueCopper: 7500 })

		expect(customItemFromRef({ name: 'Longsword', source: 'XPHB', typeCode: 'M', weapon: true, dmg1: '1d8' }).kind).toBe('weapon')
		expect(customItemFromRef({ name: 'Shield', source: 'XPHB', typeCode: 'S', ac: 2 }).kind).toBe('shield')
		// Nothing in the data separates a cloak from a coil of rope, so a wondrous item copies as 'other'.
		expect(customItemFromRef({ name: 'Cloak of Protection', source: 'XDMG', requiresAttunement: true, bonusAc: 1 })).toEqual({
			name: 'Cloak of Protection',
			kind: 'other',
			requiresAttunement: true,
		})
	})

	it('copies the plain paragraphs of an item’s text and leaves its structure behind', () => {
		const copied = customItemFromRef({
			name: 'Torch',
			source: 'XPHB',
			entries: ['It burns for an hour.', { type: 'list', items: ['bright light', 'dim light'] }, 'It can be used as a weapon.'],
		})
		expect(copied.description).toBe('It burns for an hour.\n\nIt can be used as a weapon.')
		// And the copy round-trips back into the same two paragraphs the sheet renders.
		expect(customItemRef({ name: 'Torch', kind: 'other', description: copied.description }, CUSTOM_ITEM_SOURCE).entries).toEqual([
			'It burns for an hour.',
			'It can be used as a weapon.',
		])
	})
})
