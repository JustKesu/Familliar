import { describe, expect, it } from 'vitest'
import {
	addCondition,
	applyDamage,
	applyHeal,
	entryKey,
	flipSave,
	initiativeEntries,
	isCombat,
	nextTurn,
	removeCondition,
	rollSaves,
	sortInitiative,
	startCombat,
	toggleAdv,
	type Combat,
	type InitiativeEntry,
} from './combat'
import type { EncounterGroup } from './encounterStore'

const wolves: EncounterGroup = {
	id: 'gw',
	monster: { name: 'Wolf', source: 'XMM' },
	oneInitiative: true,
	members: [1, 2, 3].map((n) => ({ id: `w${n}`, name: `Wolf ${n}` })),
}
const alpha: EncounterGroup = { id: 'gd', monster: { name: 'Dire Wolf', source: 'XMM' }, oneInitiative: false, members: [{ id: 'd1', name: 'Alpha' }] }
const groups = [wolves, alpha]
const sequence = (...values: number[]) => () => values.shift() ?? 10

describe('initiative', () => {
	it('one entry per one-roll group, one per member otherwise, players blank', () => {
		const entries = initiativeEntries(groups, ['Ana'], (group) => (group.id === 'gw' ? 2 : 3), sequence(10, 15))
		expect(entries).toEqual([
			{ kind: 'group', groupId: 'gw', initiative: 12, bonus: 2 },
			{ kind: 'member', groupId: 'gd', memberId: 'd1', initiative: 18, bonus: 3 },
			{ kind: 'player', name: 'Ana', initiative: null },
		])
		const split = initiativeEntries([{ ...wolves, oneInitiative: false }], [], () => 0, sequence(1, 2, 3))
		expect(split.map(entryKey)).toEqual(['m:w1', 'm:w2', 'm:w3'])
	})

	it('sorts by total, ties by higher bonus, then players first; blank players last in list order', () => {
		const entries: InitiativeEntry[] = [
			{ kind: 'player', name: 'Blank1', initiative: null },
			{ kind: 'member', groupId: 'a', memberId: 'low', initiative: 14, bonus: 1 },
			{ kind: 'player', name: 'Ana', initiative: 14 },
			{ kind: 'member', groupId: 'a', memberId: 'high', initiative: 14, bonus: 3 },
			{ kind: 'player', name: 'Blank2', initiative: null },
			{ kind: 'player', name: 'Bor', initiative: 20 },
		]
		expect(sortInitiative(entries).map(entryKey)).toEqual(['p:Bor', 'p:Ana', 'm:high', 'm:low', 'p:Blank1', 'p:Blank2'])
	})

	it('starts at round 1, turn 0, every member at max HP, and validates', () => {
		const combat = startCombat(initiativeEntries(groups, ['Ana'], () => 2, sequence(5, 18)), groups, (group) => (group.id === 'gw' ? 11 : 22))
		expect(combat.order.map(entryKey)).toEqual(['m:d1', 'g:gw', 'p:Ana'])
		expect(combat.hp).toEqual({ w1: 11, w2: 11, w3: 11, d1: 22 })
		expect(combat.round).toBe(1)
		expect(isCombat(combat)).toBe(true)
		expect(isCombat({ ...combat, turn: 3 })).toBe(false)
	})
})

function combatOf(order: InitiativeEntry[], hp: Record<string, number>): Combat {
	return { round: 1, turn: 0, order, hp, conditions: {}, adv: {}, saveResults: {} }
}

const ORDER: InitiativeEntry[] = [
	{ kind: 'player', name: 'Ana', initiative: 20 },
	{ kind: 'group', groupId: 'gw', initiative: 15, bonus: 2 },
	{ kind: 'member', groupId: 'gd', memberId: 'd1', initiative: 10, bonus: 2 },
]

describe('next turn', () => {
	it('advances and wraps into the next round', () => {
		const hp = { w1: 11, w2: 11, w3: 11, d1: 22 }
		let combat = combatOf(ORDER, hp)
		combat = nextTurn(combat, groups)
		expect([combat.turn, combat.round]).toEqual([1, 1])
		combat = nextTurn(nextTurn(combat, groups), groups)
		expect([combat.turn, combat.round]).toEqual([0, 2])
	})

	it('skips an entry whose every member is down, not one with a member standing', () => {
		const partly = combatOf(ORDER, { w1: 0, w2: 0, w3: 1, d1: 22 })
		expect(nextTurn(partly, groups).turn).toBe(1)
		const wolvesDown = combatOf(ORDER, { w1: 0, w2: 0, w3: 0, d1: 22 })
		expect(nextTurn(wolvesDown, groups).turn).toBe(2)
		const lastDown = { ...combatOf(ORDER, { w1: 5, w2: 0, w3: 0, d1: 0 }), turn: 1 }
		const wrapped = nextTurn(lastDown, groups)
		expect([wrapped.turn, wrapped.round]).toEqual([0, 2])
	})
})

describe('saves, damage and healing', () => {
	const max = (id: string) => (id === 'd1' ? 22 : 11)

	it('rolls with advantage, skips the down, compares to the DC', () => {
		const base = toggleAdv(combatOf(ORDER, { w1: 11, w2: 11, w3: 0, d1: 22 }), 'w2')
		const rolled = rollSaves(base, ['w1', 'w2', 'w3'], 'dex', 13, () => 2, sequence(10, 5, 12))
		expect(rolled.saveResults).toEqual({ w1: { ability: 'dex', total: 12, success: false }, w2: { ability: 'dex', total: 14, success: true } })
		expect(flipSave(rolled, 'w1').saveResults.w1.success).toBe(true)
	})

	it('failed takes full, succeeded half rounded down or none, no save full to all; results clear', () => {
		const withSaves: Combat = {
			...combatOf(ORDER, { w1: 11, w2: 11, w3: 11, d1: 22 }),
			saveResults: { w1: { ability: 'dex', total: 8, success: false }, w2: { ability: 'dex', total: 15, success: true } },
		}
		const half = applyDamage(withSaves, ['w1', 'w2', 'w3'], 7, true, 'half', max)
		expect(half.hp).toMatchObject({ w1: 4, w2: 8, w3: 4 })
		expect(half.saveResults).toEqual({})
		expect(applyDamage(withSaves, ['w2'], 7, true, 'none', max).hp.w2).toBe(11)
		expect(applyDamage(withSaves, ['w1', 'w2'], 7, false, 'half', max).hp).toMatchObject({ w1: 4, w2: 4 })
		expect(applyDamage(withSaves, ['d1'], 50, true, 'half', max).hp.d1).toBe(0)
	})

	it('heal clamps at max; conditions add once and remove', () => {
		const hurt = combatOf(ORDER, { w1: 3, d1: 20 })
		expect(applyHeal(hurt, ['w1', 'd1'], 5, max).hp).toMatchObject({ w1: 8, d1: 22 })
		const prone = addCondition(addCondition(hurt, ['w1', 'w2'], 'Prone'), ['w1'], 'Prone')
		expect(prone.conditions).toEqual({ w1: ['Prone'], w2: ['Prone'] })
		expect(removeCondition(prone, 'w1', 'Prone').conditions).toEqual({ w2: ['Prone'] })
	})
})
