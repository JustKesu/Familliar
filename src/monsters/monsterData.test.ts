import { afterEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_FILTER, filterMonsters, filterOptions } from './bestiaryFilter'
import {
	extractLegendaryGroups,
	extractMonsters,
	findLegendaryGroup,
	loadMonsterData,
	monsterInitiative,
	monsterProficiencyBonus,
	monsterSave,
	monsterTypes,
	type Monster,
} from './monsterData'
import { challengeText, formatAlignment, formatMonsterSpeed, formatMonsterType, legendaryUsesText } from './monsterFormat'

function monster(overrides: Partial<Monster>): Monster {
	return {
		name: 'Test',
		source: 'XMM',
		size: ['M'],
		type: 'beast',
		ac: [10],
		hp: { average: 1, formula: '1d4' },
		speed: { walk: 30 },
		str: 10,
		dex: 10,
		con: 10,
		int: 10,
		wis: 10,
		cha: 10,
		cr: '0',
		crNumber: 0,
		...overrides,
	}
}

// Values as printed by scripts over data/monsters.json (MON-2).
const wolf = monster({ name: 'Wolf', ac: [12], hp: { average: 11, formula: '2d8 + 2' }, dex: 15, cr: '1/4', crNumber: 0.25, xp: 50, environment: ['forest', 'grassland', 'hill'] })
const direWolf = monster({ name: 'Dire Wolf', ac: [14], dex: 15, cr: '1', crNumber: 1, xp: 200, environment: ['forest', 'hill'] })
const dragon = monster({
	name: 'Adult Green Dragon',
	size: ['H'],
	type: { type: 'dragon', tags: ['chromatic'] },
	alignment: ['L', 'E'],
	dex: 12,
	cr: '15',
	crNumber: 15,
	xp: 13000,
	xpLair: 15000,
	initiative: { proficiency: 2 },
	save: { dex: '+6', wis: '+7' },
	legendaryActionsLair: 4,
	legendaryGroup: { name: 'Green Dragon', source: 'XMM' },
	environment: ['forest'],
})
const lich = monster({ name: 'Lich', type: 'undead', dex: 16, int: 21, cr: '21', crNumber: 21, initiative: { proficiency: 2 }, save: { dex: '+10', con: '+10', int: '+12', wis: '+9' } })
const empyrean = monster({ name: 'Empyrean', source: 'XMM', type: { type: { choose: ['celestial', 'fiend'] }, tags: ['titan'] }, cr: '23', crNumber: 23 })

describe('loader', () => {
	afterEach(() => vi.unstubAllGlobals())

	it('keeps well-formed monsters and drops broken entries', () => {
		expect(extractMonsters([wolf, { name: 'Broken' }, null]).map((m) => m.name)).toEqual(['Wolf'])
		expect(extractLegendaryGroups([{ name: 'Green Dragon', source: 'XMM', regionalEffects: [] }, 3])).toHaveLength(1)
	})

	it('throws on a non-array file', () => {
		expect(() => extractMonsters({})).toThrow(/monsters\.json/)
		expect(() => extractLegendaryGroups('x')).toThrow(/legendary-groups\.json/)
	})

	it('rejects (never crashes) when a file is missing', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })))
		await expect(loadMonsterData()).rejects.toThrow(/HTTP 404/)
	})

	it('finds the legendary group by name and source', () => {
		const groups = [
			{ name: 'Green Dragon', source: 'MM' },
			{ name: 'Green Dragon', source: 'XMM' },
		]
		expect(findLegendaryGroup(dragon, groups)).toBe(groups[1])
		expect(findLegendaryGroup(wolf, groups)).toBeUndefined()
	})
})

describe('initiative, PB and saves', () => {
	it('PB follows CR, with CR below 1 counting as 1', () => {
		expect(monsterProficiencyBonus(wolf)).toBe(2)
		expect(monsterProficiencyBonus(dragon)).toBe(5)
		expect(monsterProficiencyBonus(lich)).toBe(7)
		expect(monsterProficiencyBonus({ crNumber: 30 })).toBe(9)
	})

	it('initiative = DEX mod + PB × initiative.proficiency', () => {
		expect(monsterInitiative(wolf)).toBe(2)
		// XMM prints Adult Green Dragon initiative +11 and Lich +17.
		expect(monsterInitiative(dragon)).toBe(11)
		expect(monsterInitiative(lich)).toBe(17)
	})

	it('a save in the data is proficient; others are the plain modifier', () => {
		expect(monsterSave(dragon, 'wis')).toEqual({ bonus: 7, proficient: true })
		expect(monsterSave(dragon, 'dex')).toEqual({ bonus: 6, proficient: true })
		expect(monsterSave(dragon, 'str')).toEqual({ bonus: 0, proficient: false })
		// Lich INT 21 (+5) + PB 7 = +12, matching its save field.
		expect(monsterSave(lich, 'int')).toEqual({ bonus: 12, proficient: true })
	})
})

describe('bestiary filters', () => {
	const all = [dragon, wolf, lich, direWolf, empyrean]

	it('sorts by name and searches case-insensitively by substring', () => {
		expect(filterMonsters(all, EMPTY_FILTER).map((m) => m.name)).toEqual(['Adult Green Dragon', 'Dire Wolf', 'Empyrean', 'Lich', 'Wolf'])
		expect(filterMonsters(all, { ...EMPTY_FILTER, query: 'WOLF' }).map((m) => m.name)).toEqual(['Dire Wolf', 'Wolf'])
	})

	it('narrows by CR range (inclusive), type, environment and book', () => {
		expect(filterMonsters(all, { ...EMPTY_FILTER, crMin: 1, crMax: 15 }).map((m) => m.name)).toEqual(['Adult Green Dragon', 'Dire Wolf'])
		expect(filterMonsters(all, { ...EMPTY_FILTER, crMax: 0.25 }).map((m) => m.name)).toEqual(['Wolf'])
		expect(filterMonsters(all, { ...EMPTY_FILTER, type: 'fiend' }).map((m) => m.name)).toEqual(['Empyrean'])
		expect(filterMonsters(all, { ...EMPTY_FILTER, environment: 'hill' }).map((m) => m.name)).toEqual(['Dire Wolf', 'Wolf'])
		expect(filterMonsters(all, { ...EMPTY_FILTER, source: 'RHW' })).toEqual([])
	})

	it('builds option lists from the data', () => {
		const options = filterOptions(all)
		expect(options.cr.map((cr) => cr.label)).toEqual(['1/4', '1', '15', '21', '23'])
		expect(options.types).toEqual(['beast', 'celestial', 'dragon', 'fiend', 'undead'])
		expect(options.environments).toEqual(['forest', 'grassland', 'hill'])
		expect(options.sources).toEqual(['XMM'])
		expect(monsterTypes(empyrean)).toEqual(['celestial', 'fiend'])
	})
})

describe('stat block text', () => {
	it('formats type, alignment, speed, CR and legendary uses', () => {
		expect(formatMonsterType(dragon.type)).toBe('Dragon (Chromatic)')
		expect(formatMonsterType(empyrean.type)).toBe('Celestial or Fiend (Titan)')
		expect(formatAlignment(['L', 'E'])).toBe('Lawful Evil')
		expect(formatAlignment(['U'])).toBe('Unaligned')
		expect(formatMonsterSpeed({ walk: 5, fly: { number: 30, condition: '(hover)' }, canHover: true })).toBe('5 ft., fly 30 ft. (hover)')
		expect(challengeText(dragon)).toBe('15 (XP 13,000, or 15,000 in lair; PB +5)')
		expect(legendaryUsesText(dragon)).toBe('Legendary Action Uses: 3 (4 in Lair).')
		expect(legendaryUsesText({ legendaryActions: 2 })).toBe('Legendary Action Uses: 2.')
	})
})
