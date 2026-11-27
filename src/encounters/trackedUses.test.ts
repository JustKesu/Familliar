import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractMonsters, type Monster } from '../monsters/monsterData'
import { isCombat, nextTurn, rollRecharge, startCombat, toggleLair, toggleUseBox, usedCount, type Combat, type InitiativeEntry } from './combat'
import type { EncounterGroup } from './encounterStore'
import { hasLairUses, LEGENDARY_ACTIONS_KEY, trackedUses } from './trackedUses'

const monsters = extractMonsters(JSON.parse(readFileSync(join(process.cwd(), 'data', 'monsters.json'), 'utf8')))
const named = (name: string): Monster => {
	const monster = monsters.find((m) => m.name === name)
	if (!monster) throw new Error(`${name} missing from data/monsters.json`)
	return monster
}
const summary = (monster: Monster, inLair = false) => trackedUses(monster, inLair).map((use) => `${use.name} | ${use.note} | ${use.total}`)

describe('tracked uses parsed from data/monsters.json', () => {
	it('Adult Green Dragon: Legendary Resistance 3, or 4 in lair; breath recharge 5; legendary actions 3, or 4 in lair; Geas 1/day', () => {
		const dragon = named('Adult Green Dragon')
		expect(hasLairUses(dragon)).toBe(true)
		expect(summary(dragon)).toEqual([
			'Legendary Resistance | 3/Day | 3',
			'Poison Breath | Recharge 5-6 | 1',
			'Legendary Actions | 3 per round, refills at the start of its turn | 3',
			'Geas | 1/Day shared | 1',
		])
		expect(summary(dragon, true).filter((line) => line.startsWith('Legendary'))).toEqual([
			'Legendary Resistance | 4/Day | 4',
			'Legendary Actions | 4 per round, refills at the start of its turn | 4',
		])
		expect(trackedUses(dragon, false).find((use) => use.recharge !== undefined)?.recharge).toBe(5)
		expect(trackedUses(dragon, false)[0].short).toBe('LR')
	})

	it('Aboleth: plain "(2/Day)" next to the lair-dependent Legendary Resistance', () => {
		expect(summary(named('Aboleth')).filter((line) => line.includes('/Day'))).toEqual(['Legendary Resistance | 3/Day | 3', 'Dominate Mind | 2/Day | 2'])
	})

	it('Animal Lord has no lair toggle', () => {
		expect(hasLairUses(named('Animal Lord'))).toBe(false)
	})

	it('Barlgura: "2e"/"1e" daily spells give one row per spell', () => {
		expect(summary(named('Barlgura')).filter((line) => line.includes('each'))).toEqual([
			'Disguise Self | 2/Day each | 2',
			'Invisibility (self only) | 2/Day each | 2',
			'Entangle | 1/Day each | 1',
			'Phantasmal Killer (level 6 version) | 1/Day each | 1',
		])
	})

	it('Green Hag: restLong is tracked, at-will spells are not', () => {
		const lines = summary(named('Green Hag'))
		expect(lines.some((line) => line.includes('1/Long Rest'))).toBe(true)
		expect(lines.some((line) => line.includes('Dancing Lights'))).toBe(false)
	})

	it('bare {@recharge} means recharge 6 (Ankheg)', () => {
		const use = trackedUses(named('Ankheg'), false).find((item) => item.recharge !== undefined)
		expect(use?.recharge).toBe(6)
		expect(use?.note).toBe('Recharge 6')
	})
})

const dragonGroup: EncounterGroup = { id: 'gd', monster: { name: 'Adult Green Dragon', source: 'XMM' }, oneInitiative: false, members: [{ id: 'd1', name: 'Dragon' }] }
const heroGroup: EncounterGroup = { id: 'gh', monster: { name: 'Barlgura', source: 'XMM' }, oneInitiative: false, members: [{ id: 'b1', name: 'Barlgura' }] }
const groups = [dragonGroup, heroGroup]
const ORDER: InitiativeEntry[] = [
	{ kind: 'member', groupId: 'gd', memberId: 'd1', initiative: 20, bonus: 11 },
	{ kind: 'member', groupId: 'gh', memberId: 'b1', initiative: 10, bonus: 2 },
]

describe('uses in combat state', () => {
	const fresh = (): Combat => startCombat(ORDER, groups, () => 100)

	it('boxes fill up to the clicked one and empty from a filled one', () => {
		let combat = toggleUseBox(fresh(), 'd1', 'd:trait:Legendary Resistance', 1)
		expect(usedCount(combat, 'd1', 'd:trait:Legendary Resistance')).toBe(2)
		combat = toggleUseBox(combat, 'd1', 'd:trait:Legendary Resistance', 1)
		expect(usedCount(combat, 'd1', 'd:trait:Legendary Resistance')).toBe(1)
	})

	it('legendary actions refill when the turn reaches that monster, other uses stay', () => {
		let combat = toggleUseBox(fresh(), 'd1', LEGENDARY_ACTIONS_KEY, 2)
		combat = toggleUseBox(combat, 'd1', 'd:trait:Legendary Resistance', 0)
		combat = nextTurn(combat, groups)
		expect(usedCount(combat, 'd1', LEGENDARY_ACTIONS_KEY)).toBe(3)
		combat = nextTurn(combat, groups)
		expect(combat.turn).toBe(0)
		expect(usedCount(combat, 'd1', LEGENDARY_ACTIONS_KEY)).toBe(0)
		expect(usedCount(combat, 'd1', 'd:trait:Legendary Resistance')).toBe(1)
	})

	it('a new combat starts with nothing used and out of the lair', () => {
		const used = toggleLair(toggleUseBox(fresh(), 'd1', LEGENDARY_ACTIONS_KEY, 0), 'd1')
		expect(used.uses).toBeDefined()
		const again = startCombat(ORDER, groups, () => 100)
		expect(again.uses).toBeUndefined()
		expect(again.lair).toBeUndefined()
	})

	it('recharge roll: 5 or 6 makes it ready, lower leaves it spent', () => {
		const spent = toggleUseBox(fresh(), 'd1', 'r:action:Poison Breath', 0)
		expect(rollRecharge(spent, 'd1', 'r:action:Poison Breath', 5, () => 4).success).toBe(false)
		expect(usedCount(rollRecharge(spent, 'd1', 'r:action:Poison Breath', 5, () => 4).combat, 'd1', 'r:action:Poison Breath')).toBe(1)
		expect(usedCount(rollRecharge(spent, 'd1', 'r:action:Poison Breath', 5, () => 5).combat, 'd1', 'r:action:Poison Breath')).toBe(0)
	})

	it('a combat saved before MON-5 (no uses, no lair) still loads; bad uses do not', () => {
		const old: Combat = { ...fresh(), turn: 1 }
		expect('uses' in old || 'lair' in old).toBe(false)
		expect(isCombat(JSON.parse(JSON.stringify(old)))).toBe(true)
		expect(usedCount(old, 'd1', LEGENDARY_ACTIONS_KEY)).toBe(0)
		expect(isCombat({ ...old, uses: { d1: { x: -1 } } })).toBe(false)
	})
})
