import { describe, expect, it } from 'vitest'
import {
	armourCategoryOf,
	buildInventoryResolver,
	customItemFromRef,
	customItemRef,
	describeCustomItemProblem,
	equipSlotOf,
	extractItemRefs,
	handsRequiredOf,
	inventoryRowKey,
	isConsumable,
	isShield,
	isVersatileWeapon,
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
		expect(describeCustomItemProblem({ name: 'X', kind: 'armour', stealthDisadvantage: false })).toContain('Stealth disadvantage')
		expect(describeCustomItemProblem({ name: 'X', kind: 'armour', strengthRequirement: -1 })).toContain('Strength requirement')
		expect(describeCustomItemProblem({ name: 'X', kind: 'armour', strengthRequirement: 13.5 })).toContain('Strength requirement')
		expect(describeCustomItemProblem({ name: 'X', kind: 'armour', stealthDisadvantage: true, strengthRequirement: 13 })).toBeNull()
	})

	it('gives the equip control to the kinds a body can wear or hold, and to no other', () => {
		const ref = (kind: CustomItemKind): ItemRef => customItemRef({ name: 'Thing', kind }, CUSTOM_ITEM_SOURCE)
		expect(equipSlotOf(ref('weapon'))).toBe('held')
		expect(equipSlotOf(ref('shield'))).toBe('held')
		expect(equipSlotOf(ref('armour'))).toBe('worn')
		// A worn wondrous item is gated on attunement alone — the real ones get no equip control either (slice h).
		expect(equipSlotOf(ref('worn'))).toBeNull()
		expect(equipSlotOf(ref('other'))).toBeNull()

		// A custom weapon declares no properties, so it takes one hand and nothing about it is two-handed.
		expect(handsRequiredOf(ref('weapon'), undefined)).toBe(1)
		expect(handsRequiredOf(ref('shield'), undefined)).toBe(1)
		expect(handsRequiredOf(ref('armour'), undefined)).toBeNull()
	})

	/* Slice b-fix: two hands is the whole rule, so what each thing takes has to be a number. */
	it('counts the hands each held thing takes', () => {
		const shield: ItemRef = { name: 'Shield', source: 'XPHB', typeCode: 'S', ac: 2 }
		const greatsword: ItemRef = { name: 'Greatsword', source: 'XPHB', typeCode: 'M', weapon: true, propertyFull: ['Heavy', 'Two-Handed'] }
		const shortsword: ItemRef = { name: 'Shortsword', source: 'XPHB', typeCode: 'M', weapon: true, propertyFull: ['Finesse', 'Light'] }
		const longsword: ItemRef = { name: 'Longsword', source: 'XPHB', typeCode: 'M', weapon: true, propertyFull: ['Versatile'] }
		const chainMail: ItemRef = { name: 'Chain Mail', source: 'XPHB', typeCode: 'HA', armor: true }

		expect(handsRequiredOf(shield, undefined)).toBe(1)
		expect(handsRequiredOf(greatsword, undefined)).toBe(2)
		expect(handsRequiredOf(shortsword, undefined)).toBe(1)
		expect(handsRequiredOf(longsword, undefined)).toBe(1)
		expect(handsRequiredOf(longsword, 'two-handed')).toBe(2)
		// A grip stored on a weapon that has no Versatile property changes nothing.
		expect(handsRequiredOf(shortsword, 'two-handed')).toBe(1)
		// Armour is worn, not held, so it occupies no hand at all.
		expect(handsRequiredOf(chainMail, undefined)).toBeNull()

		expect(isVersatileWeapon(longsword)).toBe(true)
		expect(isVersatileWeapon(shortsword)).toBe(false)
		expect(isVersatileWeapon(shield)).toBe(false)
	})

	/*
	 * Slice e2b: the kind stands in for the structural fields a real item carries,
	 * so the predicates every consumer reads answer for a custom item too.
	 */
	it('synthesises the structural fields its kind stands for', () => {
		const armour = customItemRef({ name: 'Bark Plate', kind: 'armour', armourClass: 14, armourCategory: 'medium' }, CUSTOM_ITEM_SOURCE)
		expect(armourCategoryOf(armour)).toBe('medium')
		expect(armour.ac).toBe(14)
		// bonusArmourClass on a SUIT is that suit's magic bonus, exactly as Dragon Scale Mail's bonusAc is — not a second, worn one.
		const magicArmour = customItemRef({ name: 'Bark Plate', kind: 'armour', armourClass: 14, armourCategory: 'medium', bonusArmourClass: 1 }, CUSTOM_ITEM_SOURCE)
		expect(itemMagicBonusOf(magicArmour)).toBe(1)
		expect(wornAcBonusOf(magicArmour)).toBeNull()
		// On a worn wondrous item the same field lands on the character instead.
		expect(wornAcBonusOf(customItemRef({ name: 'Cloak', kind: 'worn', bonusArmourClass: 1 }, CUSTOM_ITEM_SOURCE))).toBe(1)

		const weapon = customItemRef({ name: 'Bone Club', kind: 'weapon', damageDice: '1d6', damageType: 'bludgeoning', weaponCategory: 'simple' }, CUSTOM_ITEM_SOURCE)
		expect(isWeapon(weapon)).toBe(true)
		expect(weapon).toMatchObject({ typeCode: 'M', dmg1: '1d6', dmgTypeFull: 'bludgeoning', weaponCategory: 'simple' })
		expect(customItemRef({ name: 'Bone Bow', kind: 'weapon', weaponRange: 'ranged' }, CUSTOM_ITEM_SOURCE).typeCode).toBe('R')
	})

	/* Slice e2c: written in items.json's own spelling, so armourClassData.ts reads them with no custom branch — `strength` is a string there. */
	it('writes the two armour penalties the way the item data writes them', () => {
		const hampering = customItemRef(
			{ name: 'Bark Plate', kind: 'armour', armourClass: 16, armourCategory: 'heavy', stealthDisadvantage: true, strengthRequirement: 13 },
			CUSTOM_ITEM_SOURCE,
		)
		expect(hampering).toMatchObject({ stealth: true, strength: '13' })

		const quiet = customItemRef({ name: 'Bark Plate', kind: 'armour', armourClass: 16, armourCategory: 'heavy' }, CUSTOM_ITEM_SOURCE)
		expect(quiet.stealth).toBeUndefined()
		expect(quiet.strength).toBeUndefined()

		expect(customItemRef({ name: 'Bark Shield', kind: 'shield', armourClass: 2, stealthDisadvantage: true }, CUSTOM_ITEM_SOURCE).stealth).toBe(true)
		// A weapon has neither, whatever the definition happens to hold.
		expect(customItemRef({ name: 'Bone Club', kind: 'weapon', stealthDisadvantage: true, strengthRequirement: 13 }, CUSTOM_ITEM_SOURCE).stealth).toBeUndefined()
	})

	/* An armour category is never guessed: 'light' would hand the character an uncapped Dexterity bonus, and erring upward is what D76 rules out. */
	it('leaves an unfinished armour without a category rather than guessing one', () => {
		const unfinished = customItemRef({ name: 'Bark Plate', kind: 'armour' }, CUSTOM_ITEM_SOURCE)
		expect(unfinished.typeCode).toBeUndefined()
		expect(armourCategoryOf(unfinished)).toBeNull()
		expect(unfinished.ac).toBeUndefined()
		// A weapon has no such problem: melee is D77's default, and the alternative is a weapon that is not a weapon.
		expect(isWeapon(customItemRef({ name: 'Bone Club', kind: 'weapon' }, CUSTOM_ITEM_SOURCE))).toBe(true)
	})

	it('carries the effects that need no armour or weapon role, gated by nothing here', () => {
		const ring = customItemRef(
			{ name: 'Ring of Ash', kind: 'worn', resist: ['fire'], immune: ['poison'], speedBonus: 10, darkvision: 60, bonusSavingThrow: 2, bonusSpellAttack: 1, bonusSpellSaveDc: 1, bonusAbilityCheck: 1 },
			CUSTOM_ITEM_SOURCE,
		)
		expect(ring).toMatchObject({
			resist: ['fire'],
			immune: ['poison'],
			speedBonus: 10,
			darkvision: 60,
			bonusSavingThrow: 2,
			bonusSpellAttack: 1,
			bonusSpellSaveDc: 1,
			bonusAbilityCheck: 1,
		})
		// A declared zero says nothing a blank field does not, so it is not carried through as a contribution of 0.
		expect(customItemRef({ name: 'Ring of Ash', kind: 'worn', speedBonus: 0 }, CUSTOM_ITEM_SOURCE).speedBonus).toBeUndefined()
	})

	it('seeds a definition from an existing item, computed fields included', () => {
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
			// Slice e2c: both penalties come with the copy, so switching either off is a decision rather than an accident.
		).toEqual({
			name: 'Chain Mail',
			kind: 'armour',
			valueCopper: 7500,
			armourClass: 16,
			armourCategory: 'heavy',
			stealthDisadvantage: true,
			strengthRequirement: 13,
		})

		// Light armour carries neither field in the data, and the copy carries neither either.
		expect(customItemFromRef({ name: 'Leather Armor', source: 'XPHB', typeCode: 'LA', armor: true, ac: 11 })).toEqual({
			name: 'Leather Armor',
			kind: 'armour',
			armourClass: 11,
			armourCategory: 'light',
		})

		expect(customItemFromRef({ name: 'Longsword', source: 'XPHB', typeCode: 'M', weapon: true, weaponCategory: 'martial', dmg1: '1d8', dmgTypeFull: 'slashing' })).toEqual({
			name: 'Longsword',
			kind: 'weapon',
			damageDice: '1d8',
			damageType: 'slashing',
			weaponRange: 'melee',
			weaponCategory: 'martial',
		})
		expect(customItemFromRef({ name: 'Shield', source: 'XPHB', typeCode: 'S', ac: 2 })).toEqual({ name: 'Shield', kind: 'shield', armourClass: 2 })
		// Nothing in the data separates a cloak from a coil of rope, so a wondrous item copies as 'other' — and its bonusAc copies as the flat one it already was.
		expect(customItemFromRef({ name: 'Cloak of Protection', source: 'XDMG', requiresAttunement: true, bonusAc: 1 })).toEqual({
			name: 'Cloak of Protection',
			kind: 'other',
			requiresAttunement: true,
			bonusArmourClass: 1,
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
