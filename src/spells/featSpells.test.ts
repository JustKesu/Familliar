import { describe, expect, it } from 'vitest'
import type { Ability } from '../abilities/abilityScores'
import type { Character } from '../storage/character'
import { extractFeatGrantedSpells } from './featSpells'

const markOfDetection = {
	name: 'Mark of Detection',
	source: 'EFA',
	additionalSpells: [
		{
			ability: { choose: ['int', 'wis', 'cha'] },
			prepared: {
				3: { daily: { 1: ['see invisibility'] } },
				_: { daily: { 1: ['detect magic'] } },
			},
			expanded: {
				s1: ['detect evil and good', 'identify'],
			},
		},
	],
}

const markOfStorm = {
	name: 'Mark of Storm',
	source: 'EFA',
	additionalSpells: [
		{
			ability: { choose: ['int', 'wis', 'cha'] },
			known: { _: ['thunderclap'] },
			prepared: { 3: { daily: { 1: ['gust of wind'] } } },
			expanded: {
				s1: ['feather fall', 'fog cloud'],
			},
		},
	],
}

const drowHighMagic = {
	name: 'Drow High Magic',
	source: 'XGE',
	additionalSpells: [
		{
			ability: 'cha',
			innate: {
				_: {
					will: ['detect magic'],
					daily: { '1e': ['levitate', 'dispel magic'] },
				},
			},
		},
	],
}

const feyTeleportation = {
	name: 'Fey Teleportation',
	source: 'XGE',
	additionalSpells: [
		{
			ability: 'int',
			innate: {
				_: { daily: { '1': ['misty step'] } },
			},
		},
	],
}

const feats = [drowHighMagic, feyTeleportation, markOfDetection, markOfStorm]

const detectMagic = { name: 'Detect Magic', source: 'XPHB', level: 1, duration: [{ type: 'timed', duration: { type: 'minute', amount: 10 }, concentration: true }], meta: {} }
const levitate = { name: 'Levitate', source: 'XPHB', level: 2, duration: [{ type: 'timed', duration: { type: 'minute', amount: 10 }, concentration: true }], meta: {} }
const dispelMagic = { name: 'Dispel Magic', source: 'XPHB', level: 3, duration: [{ type: 'instant' }], meta: {} }
const mistyStep = { name: 'Misty Step', source: 'XPHB', level: 2, duration: [{ type: 'instant' }], meta: {} }
const seeInvisibility = { name: 'See Invisibility', source: 'XPHB', level: 2, duration: [{ type: 'timed', duration: { type: 'hour', amount: 1 } }], meta: {} }
const thunderclap = { name: 'Thunderclap', source: 'XPHB', level: 0, duration: [{ type: 'instant' }], meta: {} }
const gustOfWind = { name: 'Gust of Wind', source: 'XPHB', level: 2, duration: [{ type: 'timed', duration: { type: 'minute', amount: 1 }, concentration: true }], meta: {} }

const spells = [detectMagic, levitate, dispelMagic, mistyStep, seeInvisibility, thunderclap, gustOfWind]

function characterWithFeats(featChoices: { name: string; source: string; chosenAbility?: Ability }[], classes: Character['classes'] = []): Character {
	return {
		id: 'test',
		name: 'Test Character',
		classes,
		featAsiChoices: featChoices.map((f, i) => ({ level: (i + 1) * 4, kind: 'feat' as const, name: f.name, source: f.source, chosenAbility: f.chosenAbility })),
	}
}

describe('extractFeatGrantedSpells', () => {
	it('returns Drow High Magic\'s fixed spells, marked from-feat with the feat name, CHA carried as the ability', () => {
		const character = characterWithFeats([{ name: 'Drow High Magic', source: 'XGE' }])
		const result = extractFeatGrantedSpells(feats, spells, character)

		expect(result.map((s) => s.name).sort()).toEqual(['Detect Magic', 'Dispel Magic', 'Levitate'])
		expect(result.every((s) => s.origin === 'feat')).toBe(true)
		expect(result.every((s) => s.featName === 'Drow High Magic')).toBe(true)
		expect(result.every((s) => s.ability === 'cha')).toBe(true)
	})

	it('returns Fey Teleportation\'s fixed spell, INT carried as the ability', () => {
		const character = characterWithFeats([{ name: 'Fey Teleportation', source: 'XGE' }])
		const result = extractFeatGrantedSpells(feats, spells, character)

		expect(result.map((s) => s.name)).toEqual(['Misty Step'])
		expect(result[0].featName).toBe('Fey Teleportation')
		expect(result[0].ability).toBe('int')
	})

	it('a character with neither feat returns nothing, cleanly', () => {
		const character = characterWithFeats([])
		expect(extractFeatGrantedSpells(feats, spells, character)).toEqual([])
	})

	it('a NON-caster (Fighter) with Fey Teleportation still gets the spell, with INT carried — the fixed ability needs no class caster', () => {
		const character = characterWithFeats([{ name: 'Fey Teleportation', source: 'XGE' }], [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 4 }])
		const result = extractFeatGrantedSpells(feats, spells, character)

		expect(result.map((s) => s.name)).toEqual(['Misty Step'])
		expect(result[0].ability).toBe('int')
	})

	it('carries concentration flags through and does not affect the class picker (these are additional, not stored in spellChoices)', () => {
		const character = characterWithFeats([{ name: 'Drow High Magic', source: 'XGE' }])
		const result = extractFeatGrantedSpells(feats, spells, character)

		expect(result.find((s) => s.name === 'Detect Magic')?.concentration).toBe(true)
		expect(result.find((s) => s.name === 'Dispel Magic')?.concentration).toBe(false)
		expect(character.spellChoices ?? []).toEqual([])
	})

	it('Mark of Storm (a mark with TWO fixed grants) returns both once the character is high enough level for the gated one, with the chosen ability carried', () => {
		const character = characterWithFeats(
			[{ name: 'Mark of Storm', source: 'EFA', chosenAbility: 'wisdom' }],
			[{ className: 'Cleric', classSource: 'XPHB', subclass: null, level: 3 }],
		)
		const result = extractFeatGrantedSpells(feats, spells, character)

		expect(result.map((s) => s.name).sort()).toEqual(['Gust of Wind', 'Thunderclap'])
		expect(result.every((s) => s.featName === 'Mark of Storm')).toBe(true)
		expect(result.every((s) => s.ability === 'wis')).toBe(true)
	})

	it("a mark's level-3 spell is withheld below character level 3, but its always-on spell is not", () => {
		const character = characterWithFeats(
			[{ name: 'Mark of Detection', source: 'EFA', chosenAbility: 'intelligence' }],
			[{ className: 'Cleric', classSource: 'XPHB', subclass: null, level: 1 }],
		)
		const result = extractFeatGrantedSpells(feats, spells, character)

		expect(result.map((s) => s.name)).toEqual(['Detect Magic'])
		expect(result[0].ability).toBe('int')
	})

	it("a mark's fixed spell(s) are still granted even if the character hasn't recorded a chosenAbility yet — ability comes back undefined, not invented", () => {
		const character = characterWithFeats([{ name: 'Mark of Detection', source: 'EFA' }])
		const result = extractFeatGrantedSpells(feats, spells, character)

		expect(result.map((s) => s.name)).toEqual(['Detect Magic'])
		expect(result[0].ability).toBeUndefined()
	})

	it("a mark's `expanded` pool-widening list does NOT leak in as a granted spell", () => {
		const character = characterWithFeats(
			[{ name: 'Mark of Storm', source: 'EFA', chosenAbility: 'charisma' }],
			[{ className: 'Cleric', classSource: 'XPHB', subclass: null, level: 5 }],
		)
		const result = extractFeatGrantedSpells(feats, spells, character)

		expect(result.map((s) => s.name)).not.toContain('Feather Fall')
		expect(result.map((s) => s.name)).not.toContain('Fog Cloud')
	})

	it('a character with no mark returns nothing extra from that mark', () => {
		const character = characterWithFeats([{ name: 'Drow High Magic', source: 'XGE' }])
		const result = extractFeatGrantedSpells(feats, spells, character)

		expect(result.map((s) => s.name)).not.toContain('Gust of Wind')
		expect(result.map((s) => s.name)).not.toContain('See Invisibility')
	})
})
