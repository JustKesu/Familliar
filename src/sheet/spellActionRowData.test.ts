import { describe, expect, it } from 'vitest'
import type { FeatSpellcastingEntry, SpellcastingEntry } from '../calculation/spellcasting'
import type { SpellDetail, SpellScalingLevelDiceEntry } from '../spells/spellDetailData'
import type { SheetSpellEntry } from './SpellList'
import { cantripDamageAtLevel, isScaledHealing, leveledSpellDice, spellActionRows } from './spellActionRowData'

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
		conditionInflict: [],
		...over,
	}
}

function entry(name: string, over: Partial<SheetSpellEntry> = {}): SheetSpellEntry {
	return { name, source: 'XPHB', chosen: true, subclassOrigins: [], classOrigins: [], featOrigins: [], optionalFeatureOrigins: [], itemInvocationOrigins: [], speciesOrigins: [], usages: [], unresolvedAbilityReasons: [], grants: [], ...over }
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

	it('fills Damage from cantrip scaling, and a leveled spell from its tags at its own level (D206)', () => {
		const withTags = [...details.filter((d) => d.name !== 'Fireball'), fireball]
		const rows = spellActionRows([entry('Fire Bolt'), entry('Fireball')], withTags, 11, [wizard], [])
		expect(rows[0]!.damage).toEqual(['3d10 fire damage'])
		expect(rows[1]!.damage).toEqual(['8d6'])
	})
})

const higher = (tag: string) => [{ type: 'entries', name: 'Using a Higher-Level Spell Slot', entries: [`The damage increases by ${tag}.`] }]
const fireball = detail({
	name: 'Fireball',
	level: 3,
	savingThrow: ['dexterity'],
	entries: ['Each creature takes {@damage 8d6} Fire damage on a failed save.'],
	entriesHigherLevel: higher('{@scaledamage 8d6|3-9|1d6}'),
})

describe('leveledSpellDice (D206)', () => {
	it('Fireball merges the increment into the same die', () => {
		expect(leveledSpellDice(fireball, 3)).toEqual(['8d6'])
		expect(leveledSpellDice(fireball, 5)).toEqual(['10d6'])
	})

	it('Cure Wounds shows its {@dice} because it scales them, and is healing', () => {
		const cure = detail({ name: 'Cure Wounds', miscTags: ['HL'], entries: ['regains {@dice 2d8} plus your modifier.'], entriesHigherLevel: higher('{@scaledice 2d8|1-9|2d8}') })
		expect(leveledSpellDice(cure, 1)).toEqual(['2d8'])
		expect(leveledSpellDice(cure, 3)).toEqual(['6d8'])
		expect(isScaledHealing(cure)).toBe(true)
	})

	it('Heal: a flat base with no entry tag is its own line and adds flat', () => {
		const heal = detail({ name: 'Heal', level: 6, miscTags: ['HL'], entries: ['regains 70 Hit Points.'], entriesHigherLevel: higher('{@scaledice 70|6-9|10}') })
		expect(leveledSpellDice(heal, 6)).toEqual(['70'])
		expect(leveledSpellDice(heal, 7)).toEqual(['80'])
	})

	it("Melf's Acid Arrow scales both bases", () => {
		const arrow = detail({ name: "Melf's Acid Arrow", level: 2, entries: ['{@damage 4d4} Acid damage', 'and {@damage 2d4} Acid damage at the end'], entriesHigherLevel: higher('{@scaledamage 4d4;2d4|2-9|1d4}') })
		expect(leveledSpellDice(arrow, 2)).toEqual(['4d4', '2d4'])
		expect(leveledSpellDice(arrow, 3)).toEqual(['5d4', '3d4'])
	})

	it('Divine Smite leaves the Fiend/Undead die unscaled', () => {
		const smite = detail({ name: 'Divine Smite', entries: ['an extra {@damage 2d8} Radiant damage', 'increases by {@damage 1d8} if the target is a Fiend or an Undead'], entriesHigherLevel: higher('{@scaledamage 2d8|1-9|1d8}') })
		expect(leveledSpellDice(smite, 1)).toEqual(['2d8', '1d8'])
		expect(leveledSpellDice(smite, 2)).toEqual(['3d8', '1d8'])
	})

	it('Ice Storm after the D206 base correction', () => {
		const storm = detail({ name: 'Ice Storm', level: 4, entries: ['{@damage 2d10} Bludgeoning damage and {@damage 4d6} Cold damage'], entriesHigherLevel: higher('{@scaledamage 2d10|4-9|1d10}') })
		expect(leveledSpellDice(storm, 4)).toEqual(['2d10', '4d6'])
		expect(leveledSpellDice(storm, 5)).toEqual(['3d10', '4d6'])
	})

	it('Magic Missile has no scale tag and stays the same at any level', () => {
		const missile = detail({ name: 'Magic Missile', entries: ['Each dart deals {@damage 1d4 + 1} Force damage.'], entriesHigherLevel: higher('one more dart') })
		expect(leveledSpellDice(missile, 1)).toEqual(['1d4 + 1'])
		expect(leveledSpellDice(missile, 4)).toEqual(['1d4 + 1'])
	})

	it('Enervation/Backlash/Wall of Light: the same dice named twice in entries scales to one line, not two (D207)', () => {
		const enervation = detail({ name: 'Enervation', entries: ['deals {@damage 4d8} Necrotic damage', 'you gain {@damage 4d8} temporary hit points'], entriesHigherLevel: higher('{@scaledamage 4d8|5-9|2d8}') })
		expect(leveledSpellDice(enervation, 5)).toEqual(['4d8'])
		expect(leveledSpellDice(enervation, 6)).toEqual(['6d8'])
	})

	it('Chaos Bolt keeps its mixed dice as one line; Disintegrate bumps the dice term of "10d6 + 40"; Spirit Shroud steps by its level list', () => {
		const bolt = detail({ name: 'Chaos Bolt', entries: ['{@damage 2d8 + 1d6} damage', 'roll the {@dice d8}s'], entriesHigherLevel: higher('{@scaledamage 2d8 + 1d6|1-9|1d6}') })
		expect(leveledSpellDice(bolt, 1)).toEqual(['2d8 + 1d6'])
		expect(leveledSpellDice(bolt, 2)).toEqual(['2d8 + 2d6'])
		const disintegrate = detail({ name: 'Disintegrate', level: 6, entries: ['{@damage 10d6 + 40} Force damage'], entriesHigherLevel: higher('{@scaledamage 10d6 + 40|6-9|3d6}') })
		expect(leveledSpellDice(disintegrate, 7)).toEqual(['13d6 + 40'])
		const shroud = detail({ name: 'Spirit Shroud', level: 3, entries: ['an extra {@damage 1d8}'], entriesHigherLevel: higher('{@scaledamage 1d8|3,5,7,9|1d8}') })
		expect([3, 4, 5, 9].map((level) => leveledSpellDice(shroud, level))).toEqual([['1d8'], ['1d8'], ['2d8'], ['4d8']])
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
