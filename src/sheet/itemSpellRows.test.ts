import { describe, expect, it } from 'vitest'
import { computeAbilitySpellcasting } from '../calculation/spellcasting'
import { itemSpellGrants, withItemSpellSpent } from '../inventory/customItemGrants'
import { describeCustomItemProblem } from '../inventory/inventoryData'
import { afterLongRest, afterShortRest } from '../rest/rest'
import type { SpellDetail } from '../spells/spellDetailData'
import type { Character, CharacterInventoryItem, CustomItemSpell } from '../storage/character'
import { spellRowsFrom, spellRowsIncomplete, spellsFromRows } from './CustomItemSpellList'
import { itemSpellAbilityOf, itemSpellActionRows, itemSpells } from './itemSpellRows'
import { spellsTabActionSections, spellsTabRowCaster } from './spellsTabData'
import { toCaster } from './spellActionRowData'

function detail(name: string, level: number, over: Partial<SpellDetail> = {}): SpellDetail {
	return {
		name,
		source: 'XPHB',
		level,
		ritual: false,
		concentration: false,
		time: [{ number: 1, unit: 'action' }],
		range: undefined,
		components: { v: true, s: true },
		duration: [{ type: 'instant' }],
		entries: [],
		entriesHigherLevel: [],
		scalingLevelDice: [],
		damageInflict: [],
		conditionInflict: [],
		...over,
	}
}

const DETAILS = [
	detail('Misty Step', 2),
	detail('Fireball', 3, {
		savingThrow: ['dexterity'],
		entries: ['takes {@damage 8d6} Fire damage'],
		entriesHigherLevel: [{ type: 'entries', entries: ['{@scaledamage 8d6|3-9|1d6}'] }],
	}),
	detail('Fire Bolt', 0, { spellAttack: ['R'], scalingLevelDice: [{ label: 'Fire damage', scaling: { '1': '1d10', '5': '2d10' } }] }),
	detail('Hold Person', 2, { savingThrow: ['wisdom'] }),
]

const spell = (name: string, over: Partial<CustomItemSpell> = {}): CustomItemSpell => ({ name, source: 'XPHB', uses: { kind: 'atWill' }, caster: { kind: 'fixed' }, ...over })
const item = (name: string, spells: CustomItemSpell[], extra: Partial<CharacterInventoryItem> = {}): CharacterInventoryItem => ({
	name,
	source: 'custom',
	quantity: 1,
	custom: { name, kind: 'worn', spells },
	...extra,
})

const NO_SLOTS = [0, 0, 0, 0, 0, 0, 0, 0, 0]
const noOwn = () => ({ reason: 'no own' })

const fighter3: Character = {
	id: 'f',
	name: 'Fighter',
	classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 3 }],
	abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 8, wisdom: 12, charisma: 10 } },
}

describe('custom item spells: shape (R14c2, D219)', () => {
	const problem = (spells: unknown) => describeCustomItemProblem({ name: 'Ring', kind: 'worn', spells })
	it('accepts the three uses and both caster kinds', () => {
		expect(
			problem([
				spell('Misty Step', { uses: { kind: 'perLongRest', count: 2 }, castLevel: 4, caster: { kind: 'own', ability: 'cha' } }),
				spell('Fireball', { uses: { kind: 'perShortRest', count: 1 }, caster: { kind: 'fixed', saveDc: 15 } }),
				spell('Fire Bolt'),
			]),
		).toBeNull()
	})
	it('refuses a repeat, a zero count, a level outside 1–9, an unknown ability and a fractional DC', () => {
		expect(problem([spell('Fire Bolt'), spell('Fire Bolt')])).toContain('more than once')
		expect(problem([spell('Misty Step', { uses: { kind: 'perLongRest', count: 0 } })])).toContain('at least 1')
		expect(problem([spell('Misty Step', { castLevel: 10 })])).toContain('from 1 to 9')
		expect(problem([spell('Misty Step', { caster: { kind: 'own', ability: 'str' as 'int' } })])).toContain('unknown spellcasting ability')
		expect(problem([spell('Fireball', { caster: { kind: 'fixed', saveDc: 14.5 } })])).toContain('whole number save DC')
	})
})

describe('custom item spells: gate and counters', () => {
	it('an item that requires attunement grants only while attuned; one that does not grants unequipped; a malformed one grants nothing', () => {
		const gated = item('Wand', [spell('Misty Step')], { custom: { name: 'Wand', kind: 'worn', requiresAttunement: true, spells: [spell('Misty Step')] } })
		expect(itemSpellGrants([gated])).toEqual([])
		expect(itemSpellGrants([{ ...gated, attuned: true }])).toHaveLength(1)
		expect(itemSpellGrants([item('Pebble', [spell('Misty Step')])])).toHaveLength(1)
		expect(itemSpellGrants([item('Bad', [spell('Misty Step'), spell('Misty Step')])])).toEqual([])
	})

	it('the spent count lives on the row: it follows the item when another row is removed, and leaves with it', () => {
		const inventory = [item('A', [spell('Misty Step', { uses: { kind: 'perLongRest', count: 2 } })]), item('B', [spell('Misty Step', { uses: { kind: 'perLongRest', count: 2 } })])]
		const spent = withItemSpellSpent(inventory, 1, inventory[1]!.custom!.spells![0]!, 1)
		expect(spent[1]!.spellUses).toEqual({ 'Misty Step|XPHB': 1 })
		expect(itemSpellGrants(spent.slice(1)).map((grant) => grant.spent)).toEqual([1])
		expect(withItemSpellSpent(spent, 1, inventory[1]!.custom!.spells![0]!, 0)[1]).not.toHaveProperty('spellUses')
	})

	it('a Short Rest refills per-Short-Rest counters only, a Long Rest all; with no counter the inventory is left out', () => {
		const inventory = [
			item('Ring', [spell('Misty Step', { uses: { kind: 'perLongRest', count: 2 } }), spell('Fireball', { uses: { kind: 'perShortRest', count: 1 } })], {
				spellUses: { 'Misty Step|XPHB': 2, 'Fireball|XPHB': 1 },
			}),
		]
		expect(afterShortRest(undefined, undefined, [], null, inventory).inventory?.[0]!.spellUses).toEqual({ 'Misty Step|XPHB': 2 })
		expect(afterLongRest(undefined, undefined, null, inventory).inventory?.[0]).not.toHaveProperty('spellUses')
		expect(afterLongRest(undefined, undefined, null, [item('Ring', [])])).not.toHaveProperty('inventory')
	})
})

describe('custom item spells: rows and numbers', () => {
	it('a leveled N-per-rest spell is a USE row with its own counter in its cast level section, badged with its own level', () => {
		const spells = itemSpells(
			itemSpellGrants([item('Staff', [spell('Fireball', { uses: { kind: 'perShortRest', count: 1 }, castLevel: 5, caster: { kind: 'fixed', saveDc: 15 } })])]),
			DETAILS,
			noOwn,
		)
		const sections = spellsTabActionSections({ entries: [], details: DETAILS, ordinarySlots: NO_SLOTS, pact: null, resourceMaxima: new Map(), itemSpells: spells })
		expect(sections.map((section) => section.key)).toEqual([5])
		const [row] = sections[0]!.rows
		expect(row!.badgeLevel).toBe(3)
		expect(row!.action).toEqual(expect.objectContaining({ kind: 'use', counterKey: 'item:0:Fireball|XPHB', max: 1, label: '1/SR' }))
		expect(spellsTabRowCaster(row!, [], [], [])).toEqual(expect.objectContaining({ save: expect.objectContaining({ dc: 15 }) }))
		expect(itemSpellActionRows(spells, 3)).toEqual([expect.objectContaining({ damage: ['10d6'], save: expect.objectContaining({ dc: 15 }), origin: 'Staff' })])
	})

	it('a cantrip is an At will row in Cantrips; an empty needed field is a reason, not a number', () => {
		const withBonus = itemSpells(itemSpellGrants([item('Rod', [spell('Fire Bolt', { caster: { kind: 'fixed', attackBonus: 7 } })])]), DETAILS, noOwn)
		const sections = spellsTabActionSections({ entries: [], details: DETAILS, ordinarySlots: NO_SLOTS, pact: null, resourceMaxima: new Map(), itemSpells: withBonus })
		expect(sections[0]!.key).toBe(0)
		expect(sections[0]!.rows[0]!.action).toEqual({ kind: 'label', label: 'At will' })
		expect(withBonus[0]!.caster).toEqual(expect.objectContaining({ attack: expect.objectContaining({ bonus: 7 }) }))
		const empty = itemSpells(itemSpellGrants([item('Rod', [spell('Fire Bolt')])]), DETAILS, noOwn)
		expect(empty[0]!.caster).toEqual({ reason: 'The item does not state an attack bonus for Fire Bolt.' })
	})

	it('own numbers: 8 + PB + ability modifier with the item bonuses, for a character with no spellcasting class', () => {
		const own = computeAbilitySpellcasting(fighter3, 'charisma', [], [], [{ source: 'Amulet', amount: 1 }])
		expect(own).toEqual(expect.objectContaining({ status: 'known', value: expect.objectContaining({ spellSaveDC: 8 + 2 + 0 + 1, spellAttackBonus: 2 }) }))
		const spells = itemSpells(itemSpellGrants([item('Charm', [spell('Hold Person', { caster: { kind: 'own', ability: 'cha' } })])]), DETAILS, (ability) =>
			ability === 'charisma' && own.status === 'known' ? toCaster(own.value) : { reason: 'wrong ability' },
		)
		expect(spells[0]!.caster).toEqual(expect.objectContaining({ save: expect.objectContaining({ dc: 11 }) }))
		expect(itemSpellAbilityOf('wisdom')).toBe('wis')
		expect(itemSpellAbilityOf('strength')).toBeNull()
	})
})

describe('custom item spells: form rows', () => {
	it('round-trips, and a chosen "Use my own" row without an ability blocks saving', () => {
		const stored = [spell('Fireball', { uses: { kind: 'perShortRest', count: 1 }, castLevel: 5, caster: { kind: 'fixed', saveDc: 15 } }), spell('Misty Step', { caster: { kind: 'own', ability: 'wis' } })]
		expect(spellsFromRows(spellRowsFrom(stored))).toEqual(stored)
		const rows = spellRowsFrom([spell('Misty Step')])
		expect(spellRowsIncomplete([{ ...rows[0]!, caster: 'own', ability: '' }])).toBe(true)
		expect(spellRowsIncomplete([{ ...rows[0]!, uses: 'perLongRest', count: '0' }])).toBe(true)
		expect(spellRowsIncomplete([{ ...rows[0]!, spell: '', caster: 'own', ability: '' }])).toBe(false)
	})
})
