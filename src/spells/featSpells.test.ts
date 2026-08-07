import { describe, expect, it } from 'vitest'
import type { Character } from '../storage/character'
import { extractFeatGrantedSpells } from './featSpells'

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

const feats = [drowHighMagic, feyTeleportation]

const detectMagic = { name: 'Detect Magic', source: 'XPHB', level: 1, duration: [{ type: 'timed', duration: { type: 'minute', amount: 10 }, concentration: true }], meta: {} }
const levitate = { name: 'Levitate', source: 'XPHB', level: 2, duration: [{ type: 'timed', duration: { type: 'minute', amount: 10 }, concentration: true }], meta: {} }
const dispelMagic = { name: 'Dispel Magic', source: 'XPHB', level: 3, duration: [{ type: 'instant' }], meta: {} }
const mistyStep = { name: 'Misty Step', source: 'XPHB', level: 2, duration: [{ type: 'instant' }], meta: {} }

const spells = [detectMagic, levitate, dispelMagic, mistyStep]

function characterWithFeats(featChoices: { name: string; source: string }[], classes: Character['classes'] = []): Character {
	return {
		id: 'test',
		name: 'Test Character',
		classes,
		featAsiChoices: featChoices.map((f, i) => ({ level: (i + 1) * 4, kind: 'feat' as const, name: f.name, source: f.source })),
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
})
