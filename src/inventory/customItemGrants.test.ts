import { describe, expect, it } from 'vitest'
import type { SpellcastingEntry } from '../calculation/spellcasting'
import { itemInvocationOptions } from '../optionalFeatures/optionalFeatureData'
import { extractItemInvocationSenses, extractOptionalFeatureGrantedSenses } from '../sheet/grantedSenses'
import { combineSenseEntries } from '../sheet/SensesList'
import { casterFor } from '../sheet/spellActionRowData'
import { combineSpellEntries, provenanceLabel } from '../sheet/SpellList'
import { extractItemInvocationSpells, extractOptionalFeatureGrantedSpells } from '../spells/optionalFeatureSpells'
import type { CharacterInventoryItem } from '../storage/character'
import { itemInvocationGrants } from './customItemGrants'

const optionalFeatures = [
	{ name: 'Witch Sight', source: 'XPHB', featureType: ['EI'], entries: ['You have Truesight with a range of 30 feet.'], senses: [{ truesight: 30 }] },
	{ name: 'Mire the Mind', source: 'XPHB', featureType: ['EI'], entries: ['x'], additionalSpells: [{ innate: { _: ['slow|xphb'] } }] },
	{ name: 'Metamagic Thing', source: 'XPHB', featureType: ['MM'], entries: ['x'] },
]
const spells = [{ name: 'Slow', source: 'XPHB', level: 3, duration: [] }]

const ring = (invocations: { name: string; source: string }[], extra: Partial<CharacterInventoryItem> = {}): CharacterInventoryItem => ({
	name: 'Ring of Eyes',
	source: 'custom',
	quantity: 1,
	custom: { name: 'Ring of Eyes', kind: 'worn', invocations },
	...extra,
})

const warlock: SpellcastingEntry = {
	className: 'Warlock',
	classSource: 'XPHB',
	ability: 'charisma',
	spellAttackBonus: 6,
	spellAttackBreakdown: [],
	spellSaveDC: 14,
	spellSaveDCBreakdown: [],
}

describe('item invocations (R14c1)', () => {
	it('are gated on attunement and resolved only among EI options', () => {
		const gated = ring([{ name: 'Witch Sight', source: 'XPHB' }], { custom: { name: 'Ring of Eyes', kind: 'worn', requiresAttunement: true, invocations: [{ name: 'Witch Sight', source: 'XPHB' }] } })
		expect(itemInvocationGrants([gated])).toEqual([])
		expect(itemInvocationGrants([{ ...gated, attuned: true }])).toEqual([{ name: 'Witch Sight', source: 'XPHB', itemName: 'Ring of Eyes' }])
		const grants = itemInvocationGrants([ring([{ name: 'Witch Sight', source: 'XPHB' }, { name: 'Metamagic Thing', source: 'XPHB' }])])
		expect(itemInvocationOptions(optionalFeatures, grants).map(({ option, itemNames }) => [option.name, itemNames])).toEqual([['Witch Sight', ['Ring of Eyes']]])
	})

	it('a sense from a Warlock pick and from an item is one row naming both', () => {
		const grants = itemInvocationGrants([ring([{ name: 'Witch Sight', source: 'XPHB' }])])
		const senses = [
			...extractOptionalFeatureGrantedSenses(optionalFeatures, [{ featureType: 'EI', choices: [{ name: 'Witch Sight' }] }]),
			...extractItemInvocationSenses(optionalFeatures, grants),
		]
		expect(combineSenseEntries(senses)).toEqual([
			expect.objectContaining({ senseType: 'truesight', range: 30, optionalFeatureOrigins: ['Witch Sight', 'Witch Sight — Ring of Eyes'] }),
		])
	})

	it('a spell from a Warlock pick and from an item is one entry naming both; without a Warlock level it has no numbers', () => {
		const itemSpells = extractItemInvocationSpells(optionalFeatures, spells, itemInvocationGrants([ring([{ name: 'Mire the Mind', source: 'XPHB' }])]))
		const pickSpells = extractOptionalFeatureGrantedSpells(optionalFeatures, spells, [{ featureType: 'EI', choices: [{ name: 'Mire the Mind' }] }])

		const both = combineSpellEntries([], [], [], [...pickSpells, ...itemSpells])
		expect(both).toHaveLength(1)
		expect(provenanceLabel(both[0])).toContain('from invocation (Mire the Mind); from invocation (Mire the Mind — Ring of Eyes)')

		const [itemOnly] = combineSpellEntries([], [], [], itemSpells)
		expect(casterFor(itemOnly, [warlock], [], [])).toEqual({ attack: expect.anything(), save: expect.objectContaining({ dc: 14 }) })
		expect(casterFor(itemOnly, [{ ...warlock, className: 'Wizard' }], [], [])).toEqual({ reason: expect.stringContaining('no Warlock level') })
	})
})
