import { describe, expect, it } from 'vitest'
import type { Character } from '../storage/character'
import { raceSpellsFor } from './raceSpells'

/*
 * Fixtures mirror the real shapes scripts/investigate-race-spells.js found in
 * species.json (D46), trimmed to the fields the extractor reads. data/ is never
 * opened here.
 */

const spells = [
	{ name: 'Light', source: 'XPHB', level: 0 },
	{ name: 'Mage Hand', source: 'XPHB', level: 0 },
	{ name: 'Healing Word', source: 'XPHB', level: 1 },
	{ name: 'Lesser Restoration', source: 'XPHB', level: 2 },
	{ name: 'Daylight', source: 'XPHB', level: 3 },
	{ name: 'Gust of Wind', source: 'XPHB', level: 2, duration: [{ concentration: true }] },
	{ name: 'Prestidigitation', source: 'XPHB', level: 0 },
	{ name: 'Mending', source: 'XPHB', level: 0 },
	{ name: 'Dancing Lights', source: 'XPHB', level: 0 },
	{ name: 'Detect Magic', source: 'XPHB', level: 1, meta: { ritual: true } },
]

/** The one fixed-ability carrier in the whole file. Its `#c`-tagged, source-less cantrip ref is the shape parseSpellRef had to be fixed for. */
const aasimar = {
	name: 'Aasimar',
	source: 'XPHB',
	additionalSpells: [
		{
			ability: 'cha',
			known: { _: ['light#c'] },
			innate: { 3: { daily: { '1e': ['healing word'] } }, 5: { daily: { '1e': ['daylight'] } } },
		},
	],
}

/** The 33-of-34 majority shape: the ability is still a choice. */
const aarakocra = {
	name: 'Aarakocra',
	source: 'XPHB',
	additionalSpells: [{ ability: { choose: ['int', 'wis', 'cha'] }, known: { _: ['mage hand#c'] }, innate: { 3: { daily: { '1e': ['gust of wind'] } } } }],
}

/** The only `daily: {"pb": …}` carrier in the data. */
const rockGnome = {
	name: 'Gnome; Rock Gnome Lineage',
	source: 'XPHB',
	additionalSpells: [{ ability: { choose: ['int', 'wis', 'cha'] }, known: { _: ['prestidigitation'] }, innate: { _: { daily: { pb: ['mending'] } } } }],
}

/** A resolved variant whose whole grant sits under the `"_"` always-granted key. */
const kobold = {
	name: 'Kobold; Draconic Cry',
	source: 'XPHB',
	additionalSpells: [{ ability: { choose: ['int', 'wis', 'cha'] }, known: { _: ['dancing lights', 'detect magic|xphb'] } }],
}

/** One of the 5 deferred entries: the grant is a `choose` FILTER, not a spell. */
const highElf = {
	name: 'Elf; High Elf Lineage',
	source: 'XPHB',
	additionalSpells: [{ ability: { choose: ['int', 'wis', 'cha'] }, known: { 1: [{ choose: 'level=0|class=Wizard' }], 3: ['detect magic|xphb'] } }],
}

/** The family-BASE shape D81 guarantees is never stored — carried here only to prove it grants nothing if it ever were. */
const elfBase = {
	name: 'Elf',
	source: 'XPHB',
	additionalSpells: [
		{ name: 'Drow', ability: { choose: ['int', 'wis', 'cha'] }, innate: { 3: { daily: { '1e': ['daylight'] } } } },
		{ name: 'High Elf', ability: { choose: ['int', 'wis', 'cha'] }, known: { _: ['light#c'] } },
	],
}

const species = [aasimar, aarakocra, rockGnome, kobold, highElf, elfBase]

function character(speciesName: string, level: number, source = 'XPHB', speciesSpellcastingAbility?: Character['speciesSpellcastingAbility']): Character {
	return {
		id: 'test',
		name: 'Test',
		classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level }],
		species: { name: speciesName, source },
		...(speciesSpellcastingAbility ? { speciesSpellcastingAbility } : {}),
	}
}

describe('raceSpellsFor', () => {
	it('carries the fixed ability and gates numeric keys on total character level (Aasimar)', () => {
		const atOne = raceSpellsFor(character('Aasimar', 1), species, spells)
		expect(atOne.spells.map((s) => s.name)).toEqual(['Light'])
		expect(atOne.spells[0]).toMatchObject({ origin: 'species', speciesName: 'Aasimar', ability: 'cha', grantedAtLevel: null, level: 0 })
		expect(atOne.spells[0].unresolvedAbilityReason).toBeUndefined()

		const atFive = raceSpellsFor(character('Aasimar', 5), species, spells)
		expect(atFive.spells.map((s) => s.name)).toEqual(['Light', 'Healing Word', 'Daylight'])
		expect(atFive.spells[1]).toMatchObject({ grantedAtLevel: 3, usage: { kind: 'onceFreePerLongRest' } })
	})

	it('leaves the spell granted but marks the ability unresolved for a `choose` ability with no stored pick (Aarakocra)', () => {
		const result = raceSpellsFor(character('Aarakocra', 3), species, spells)
		expect(result.spells.map((s) => s.name)).toEqual(['Mage Hand', 'Gust of Wind'])
		for (const spell of result.spells) {
			expect(spell.ability).toBeUndefined()
			expect(spell.unresolvedAbilityReason).toBe('spellcasting ability not chosen yet')
		}
		expect(result.spells[1].concentration).toBe(true)
	})

	/* D89 follow-up: a stored speciesSpellcastingAbility resolves a `choose` ability exactly like Aasimar's fixed one. */
	it('resolves a `choose` ability from the character’s stored pick (Aarakocra)', () => {
		const result = raceSpellsFor(character('Aarakocra', 3, 'XPHB', 'wisdom'), species, spells)
		expect(result.spells.map((s) => s.name)).toEqual(['Mage Hand', 'Gust of Wind'])
		for (const spell of result.spells) {
			expect(spell.ability).toBe('wis')
			expect(spell.unresolvedAbilityReason).toBeUndefined()
		}
	})

	it('resolves a `daily: {pb: …}` grant to the character’s own proficiency bonus (Rock Gnome)', () => {
		const atOne = raceSpellsFor(character('Gnome; Rock Gnome Lineage', 1), species, spells)
		expect(atOne.spells.find((s) => s.name === 'Mending')?.usage).toEqual({ kind: 'freePerLongRestByProficiencyBonus', casts: 2 })

		const atThirteen = raceSpellsFor(character('Gnome; Rock Gnome Lineage', 13), species, spells)
		expect(atThirteen.spells.find((s) => s.name === 'Mending')?.usage).toEqual({ kind: 'freePerLongRestByProficiencyBonus', casts: 5 })
	})

	it('grants a `"_"`-keyed spell at every level, and resolves both the bare and the `name|source` ref shapes (Kobold)', () => {
		const result = raceSpellsFor(character('Kobold; Draconic Cry', 1), species, spells)
		expect(result.spells.map((s) => s.name)).toEqual(['Dancing Lights', 'Detect Magic'])
		expect(result.spells.every((s) => s.grantedAtLevel === null)).toBe(true)
		expect(result.spells[1].ritual).toBe(true)
		expect(result.notes).toEqual([])
	})

	it('grants no spell for a `choose` filter node but says so in one visible note (High Elf)', () => {
		const result = raceSpellsFor(character('Elf; High Elf Lineage', 3), species, spells)
		expect(result.spells.map((s) => s.name)).toEqual(['Detect Magic'])
		expect(result.notes).toEqual([
			{ speciesName: 'Elf; High Elf Lineage', text: 'Elf; High Elf Lineage lets you pick a cantrip from the Wizard spell list — not yet supported.' },
		])
	})

	it('grants nothing for the unresolved family-base shape D81 rules out', () => {
		expect(raceSpellsFor(character('Elf', 5), species, spells)).toEqual({ spells: [], notes: [] })
	})

	it('returns nothing for a character with no species, or a species absent from the data', () => {
		const noSpecies: Character = { id: 'x', name: 'X', classes: [] }
		expect(raceSpellsFor(noSpecies, species, spells)).toEqual({ spells: [], notes: [] })
		expect(raceSpellsFor(character('Nonexistent', 5), species, spells)).toEqual({ spells: [], notes: [] })
	})
})
