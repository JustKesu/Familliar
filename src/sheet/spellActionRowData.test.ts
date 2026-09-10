import { describe, expect, it } from 'vitest'
import type { FeatSpellcastingEntry, SpellcastingEntry } from '../calculation/spellcasting'
import type { SpellDetail, SpellScalingLevelDiceEntry } from '../spells/spellDetailData'
import type { SheetSpellEntry } from './SpellList'
import { cantripDamageAtLevel, spellActionRows } from './spellActionRowData'

function detail(over: Partial<SpellDetail> & { name: string }): SpellDetail {
	return {
		source: 'XPHB',
		level: 1,
		ritual: false,
		concentration: false,
		time: [],
		range: { type: 'point', distance: { type: 'feet', amount: 60 } },
		components: undefined,
		duration: [],
		entries: [],
		entriesHigherLevel: [],
		scalingLevelDice: [],
		damageInflict: [],
		...over,
	}
}

function entry(name: string, over: Partial<SheetSpellEntry> = {}): SheetSpellEntry {
	return { name, source: 'XPHB', chosen: true, subclassOrigins: [], featOrigins: [], optionalFeatureOrigins: [], usages: [], ...over }
}

const wizard: SpellcastingEntry = {
	className: 'Wizard',
	classSource: 'XPHB',
	ability: 'intelligence',
	spellAttackBonus: 7,
	spellAttackBreakdown: [{ source: 'Intelligence', amount: 4 }],
	spellSaveDC: 15,
	spellSaveDCBreakdown: [{ source: 'Intelligence', amount: 4 }],
}

const magicInitiate: FeatSpellcastingEntry = {
	featName: 'Magic Initiate',
	ability: 'charisma',
	spellAttackBonus: 4,
	spellAttackBreakdown: [{ source: 'Charisma', amount: 1 }],
	spellSaveDC: 12,
	spellSaveDCBreakdown: [{ source: 'Charisma', amount: 1 }],
}

const details = [
	detail({ name: 'Fire Bolt', level: 0, spellAttack: ['R'], scalingLevelDice: [{ label: 'fire damage', scaling: { '1': '1d10', '5': '2d10', '11': '3d10', '17': '4d10' } }] }),
	detail({ name: 'Fireball', level: 3, savingThrow: ['dexterity'] }),
	detail({ name: 'Storm Sphere', level: 4, spellAttack: ['R'], savingThrow: ['strength'] }),
	detail({ name: 'Mage Armor', level: 1 }),
	detail({ name: 'Transmute Rock', level: 5, savingThrow: ['strength', 'dexterity'] }),
	detail({ name: 'Detect Magic', level: 1, ritual: true, concentration: true }),
]

describe('spellActionRows', () => {
	it('gives a row only to a spell with an attack roll or a save, sorted by level then name', () => {
		const rows = spellActionRows(
			[entry('Fire Bolt'), entry('Fireball'), entry('Mage Armor'), entry('Detect Magic'), entry('Transmute Rock')],
			details,
			5,
			[wizard],
			[],
		)
		expect(rows.map((row) => row.name)).toEqual(['Fire Bolt', 'Fireball', 'Transmute Rock'])
	})

	it('puts the class attack bonus on an attack spell and the class DC plus ability on a save spell', () => {
		const rows = spellActionRows([entry('Fire Bolt'), entry('Fireball')], details, 5, [wizard], [])
		expect(rows[0]).toMatchObject({ attack: { bonus: 7 }, save: null })
		expect(rows[1]).toMatchObject({ attack: null, save: { dc: 15, abilities: ['dexterity'] } })
		expect(rows[1]!.save!.breakdown).toEqual(wizard.spellSaveDCBreakdown)
	})

	it('shows both numbers for the 5 spells that carry an attack roll and a save at once', () => {
		const [row] = spellActionRows([entry('Storm Sphere')], details, 5, [wizard], [])
		expect(row).toMatchObject({ attack: { bonus: 7 }, save: { dc: 15, abilities: ['strength'] } })
	})

	it('keeps both abilities of an either-or save', () => {
		const [row] = spellActionRows([entry('Transmute Rock')], details, 5, [wizard], [])
		expect(row!.save!.abilities).toEqual(['strength', 'dexterity'])
	})

	it("uses the feat's own attack bonus for a spell only a feat grants, and the class's for one the player picked", () => {
		const fromFeat = spellActionRows([entry('Fire Bolt', { chosen: false, featOrigins: ['Magic Initiate'] })], details, 5, [wizard], [magicInitiate])
		expect(fromFeat[0]).toMatchObject({ attack: { bonus: 4 } })
		const picked = spellActionRows([entry('Fire Bolt', { featOrigins: ['Magic Initiate'] })], details, 5, [wizard], [magicInitiate])
		expect(picked[0]).toMatchObject({ attack: { bonus: 7 } })
	})

	it('states why the number is missing rather than dropping the row when no caster can be attributed (D43)', () => {
		const [row] = spellActionRows([entry('Fireball')], details, 5, [], [])
		expect(row).toMatchObject({ name: 'Fireball', attack: null, save: null })
		expect(row!.unresolved).toContain('No spellcasting ability')
	})

	it('leaves a spell whose text was not found out of the table entirely', () => {
		expect(spellActionRows([entry('Spell Of Nothing')], details, 5, [wizard], [])).toEqual([])
	})

	it('carries the ritual and concentration flags and the formatted range', () => {
		const [row] = spellActionRows([entry('Fireball')], details, 5, [wizard], [])
		// The range string is whatever the Kouzla tab's own formatRange makes of the same field — only that it reaches the row is this module's business.
		expect(row).toMatchObject({ level: 3, ritual: false, concentration: false, range: expect.stringContaining('60') })
	})

	it('fills Damage only from structured cantrip scaling, leaving a leveled spell empty (D21)', () => {
		const rows = spellActionRows([entry('Fire Bolt'), entry('Fireball')], details, 11, [wizard], [])
		expect(rows[0]!.damage).toEqual(['3d10 fire damage'])
		expect(rows[1]!.damage).toEqual([])
	})
})

describe('cantripDamageAtLevel', () => {
	const booming: SpellScalingLevelDiceEntry[] = [
		{ label: 'thunder damage on hit', scaling: { '1': '1d8', '5': '2d8', '11': '3d8', '17': '4d8' } },
		{ label: 'thunder damage on moving', scaling: { '5': '1d8', '11': '2d8', '17': '3d8' } },
	]

	it('takes the highest threshold the character has reached', () => {
		expect(cantripDamageAtLevel([booming[0]!], 10)).toEqual(['2d8 thunder damage on hit'])
		expect(cantripDamageAtLevel([booming[0]!], 17)).toEqual(['4d8 thunder damage on hit'])
	})

	it('omits an entry whose lowest threshold is above the character level', () => {
		expect(cantripDamageAtLevel(booming, 4)).toEqual(['1d8 thunder damage on hit'])
		expect(cantripDamageAtLevel(booming, 5)).toEqual(['2d8 thunder damage on hit', '1d8 thunder damage on moving'])
	})
})
