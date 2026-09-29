import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { computeAbilityScore } from '../calculation/abilityScores'
import { itemAbilityScoreContributions, type ItemAbilityGrant } from '../calculation/itemAbilityScores'
import { extractItemRefs, type ItemRef } from '../inventory/inventoryData'
import type { Character, CharacterInventoryItem } from '../storage/character'
import { buildItemAbilityGrants } from './itemAbilityScoreData'

const require = createRequire(import.meta.url)
const { itemAbilityMax } = require('../../scripts/extract-data.js') as { itemAbilityMax: (item: unknown) => number | null }

/** Shapes as DATA.md "Item `ability`" records them. */
const refs: ItemRef[] = extractItemRefs([
	{ name: 'Belt of Hill Giant Strength', source: 'XDMG', reqAttune: true, ability: { static: { str: 21 } } },
	{ name: 'Amulet of Health', source: 'XDMG', reqAttune: true, ability: { static: { con: 19 } } },
	{ name: 'Belt of Dwarvenkind', source: 'XDMG', reqAttune: true, ability: { con: 2 }, abilityMax: 20 },
	{ name: 'Potion of Giant Strength (Hill)', source: 'XDMG', ability: { static: { str: 21 } } },
	{ name: 'Manual of Gainful Exercise', source: 'XDMG', ability: { str: 2 }, abilityMax: 30 },
	{ name: 'Book of Vile Darkness', source: 'XDMG', reqAttune: true, ability: { choose: [{ from: ['str', 'dex', 'con', 'int', 'wis', 'cha'], count: 1, amount: 2 }] } },
	{ name: 'Deck of Many Things', source: 'XDMG', ability: { from: ['str', 'dex'], count: 1, amount: 2 } },
])
const byName = (name: string): ItemRef => refs.find((ref) => ref.name === name)!
const belt = byName('Belt of Hill Giant Strength')
const amulet = byName('Amulet of Health')
const dwarvenkind = byName('Belt of Dwarvenkind')
const potion = byName('Potion of Giant Strength (Hill)')
const manual = byName('Manual of Gainful Exercise')
const vileDarkness = byName('Book of Vile Darkness')
const deck = byName('Deck of Many Things')

function row(ref: ItemRef, attuned = false): CharacterInventoryItem {
	return { name: ref.name, source: ref.source, quantity: 1, ...(attuned ? { attuned: true } : {}) }
}

function character(strength: number, constitution = 13): Character {
	return {
		id: '1',
		name: 'Test',
		classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 5 }],
		abilityScores: { method: 'roll', scores: { strength, dexterity: 14, constitution, intelligence: 12, wisdom: 10, charisma: 8 } },
	}
}

const set = (sourceName: string, score: number): ItemAbilityGrant => ({ sourceName, ability: 'strength', effect: { kind: 'set', score } })
const add = (sourceName: string, amount: number, max: number): ItemAbilityGrant => ({ sourceName, ability: 'strength', effect: { kind: 'add', amount, max } })

describe('extractor abilityMax', () => {
	it('reads the "maximum of N" sentence of an additive item, through markup', () => {
		expect(itemAbilityMax({ ability: { con: 2 }, entries: ['Your Constitution increases by 2, to a {@b maximum of 24}.'] })).toBe(24)
	})
	it('is absent for the set, choose and from shapes', () => {
		expect(itemAbilityMax({ ability: { static: { str: 21 } }, entries: ['maximum of 20'] })).toBeNull()
		expect(itemAbilityMax({ ability: { choose: [] }, entries: ['maximum of 20'] })).toBeNull()
		expect(itemAbilityMax({ ability: { from: ['str'] }, entries: ['maximum of 20'] })).toBeNull()
	})
})

describe('extractItemRefs ability fields', () => {
	it('maps static to set, additive to add with its max, choose to abilityChoice, and ignores from', () => {
		expect(belt.abilityEffects).toEqual([{ ability: 'strength', effect: { kind: 'set', score: 21 } }])
		expect(dwarvenkind.abilityEffects).toEqual([{ ability: 'constitution', effect: { kind: 'add', amount: 2, max: 20 } }])
		expect(vileDarkness.abilityChoice).toBe(true)
		expect(deck.abilityEffects).toBeUndefined()
	})
})

describe('itemAbilityScoreContributions (D221)', () => {
	it('sets the score when higher, naming the item', () => {
		expect(itemAbilityScoreContributions('strength', 15, [set('Belt', 21)])).toEqual([{ source: 'Belt: set to 21', amount: 6 }])
	})
	it('does not lower a higher score', () => {
		expect(itemAbilityScoreContributions('strength', 20, [set('Gauntlets', 19)])).toEqual([{ source: 'Gauntlets: set to 19', amount: 0, note: 'no effect: the score is already 20' }])
	})
	it('lets the highest set-to win and marks the others as no effect', () => {
		expect(itemAbilityScoreContributions('strength', 15, [set('Gauntlets', 19), set('Belt', 21)])).toEqual([
			{ source: 'Belt: set to 21', amount: 6 },
			{ source: 'Gauntlets: set to 19', amount: 0, note: 'no effect: Belt sets a score at least as high' },
		])
	})
	it('caps an addition at its maximum and never lowers a score above it', () => {
		expect(itemAbilityScoreContributions('strength', 19, [add('Stone', 2, 20)])).toEqual([{ source: 'Stone: +2, maximum 20', amount: 1, note: 'capped at 20' }])
		expect(itemAbilityScoreContributions('strength', 22, [add('Stone', 2, 20)])).toEqual([{ source: 'Stone: +2, maximum 20', amount: 0, note: 'no effect: the score is already 22' }])
	})
	it('applies additions before set-to', () => {
		const lines = itemAbilityScoreContributions('strength', 18, [set('Gauntlets', 19), add('Stone', 2, 20)])
		expect(lines.reduce((sum, line) => sum + line.amount, 18)).toBe(20)
	})
	it('ignores grants for another ability', () => {
		expect(itemAbilityScoreContributions('dexterity', 15, [set('Belt', 21)])).toEqual([])
	})
})

describe('buildItemAbilityGrants', () => {
	it('applies an attuned attunement item and withholds an unattuned one', () => {
		expect(buildItemAbilityGrants([row(belt, true)], refs)).toEqual([{ sourceName: 'Belt of Hill Giant Strength', ability: 'strength', effect: { kind: 'set', score: 21 } }])
		const withheld = computeAbilityScore('strength', character(15), [], buildItemAbilityGrants([row(belt)], refs))
		expect(withheld).toMatchObject({ value: { score: 15 } })
		expect(withheld.status === 'known' && withheld.breakdown.at(-1)).toEqual({
			source: 'Belt of Hill Giant Strength',
			amount: 0,
			note: 'considered (set to 21) — not applied: not attuned',
		})
	})
	it('skips items that need no attunement: potions, manuals, the Deck', () => {
		expect(buildItemAbilityGrants([row(potion), row(manual), row(deck)], refs)).toEqual([])
	})
	it('names Book of Vile Darkness on every ability while attuned, changing nothing', () => {
		const grants = buildItemAbilityGrants([row(vileDarkness, true)], refs)
		expect(grants).toHaveLength(6)
		const con = computeAbilityScore('constitution', character(15), [], grants)
		expect(con).toMatchObject({ value: { score: 13 } })
		expect(con.status === 'known' && con.breakdown.at(-1)).toEqual({ source: 'Book of Vile Darkness', amount: 0, note: 'not applied: ability choice not supported' })
		expect(buildItemAbilityGrants([row(vileDarkness)], refs)).toEqual([])
	})
	it('caps Belt of Dwarvenkind at 20 with Con 19', () => {
		expect(computeAbilityScore('constitution', character(15, 19), [], buildItemAbilityGrants([row(dwarvenkind, true)], refs))).toMatchObject({ value: { score: 20 } })
	})
	it('sets Constitution from Amulet of Health', () => {
		expect(computeAbilityScore('constitution', character(15), [], buildItemAbilityGrants([row(amulet, true)], refs))).toMatchObject({ value: { score: 19, modifier: 4 } })
	})
})
