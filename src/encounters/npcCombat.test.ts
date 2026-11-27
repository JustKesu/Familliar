import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { Character } from '../storage/character'
import { CharacterStore, type KeyValueStorage } from '../storage/characterStore'
import { initiativeEntries, nextTurn, removeEntry, rollSaves, type Combat } from './combat'
import { addNpcCondition, damageNpc, healNpc, npcConditions, removeNpcCondition } from './npcCharacter'
import { loadNpcStats } from './npcStats'

class MemoryStorage implements KeyValueStorage {
	private data = new Map<string, string>()
	getItem(key: string): string | null {
		return this.data.get(key) ?? null
	}
	setItem(key: string, value: string): void {
		this.data.set(key, value)
	}
	removeItem(key: string): void {
		this.data.delete(key)
	}
}

/* Fighter 3 (XPHB), STR 15 DEX 14 CON 13: saves STR +4 / CON +3 proficient, DEX +2, initiative +2, AC 10 + 2 = 12, HP 10 + 1 + 2 × (6 + 1) = 25. */
function seedNpc(store: CharacterStore): Character {
	const created = store.create({
		name: 'Mira',
		classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 3 }],
		abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 8, wisdom: 12, charisma: 10 } },
	} as Parameters<CharacterStore['create']>[0])
	store.markNpc(created.id)
	return store.list().find((c) => c.id === created.id)!
}

const fresh = (store: CharacterStore, id: string): Character => store.list().find((c) => c.id === id)!

beforeAll(() => {
	vi.stubGlobal('fetch', async (url: string) => new Response(readFileSync(join(process.cwd(), url.replace(/^\//, '')), 'utf8')))
})

describe('NPC numbers from the sheet calculations (D438)', () => {
	it('reads AC, initiative, save bonuses and max HP of a seeded Fighter 3', async () => {
		const npc = seedNpc(new CharacterStore(new MemoryStorage()))
		const stats = await loadNpcStats(npc)
		expect(stats.initiative).toBe(2)
		expect(stats.ac).toBe(12)
		expect(stats.maxHp).toBe(25)
		expect(stats.saves.str).toEqual({ bonus: 4, proficient: true })
		expect(stats.saves.con).toEqual({ bonus: 3, proficient: true })
		expect(stats.saves.dex).toEqual({ bonus: 2, proficient: false })
	}, 30000)

	it('rolls initiative and saves with the sheet bonus', () => {
		expect(initiativeEntries([], [], () => 0, () => 10, [{ id: 'n1', bonus: 2 }])).toEqual([{ kind: 'npc', npcId: 'n1', initiative: 12, bonus: 2 }])
		const combat: Combat = { round: 1, turn: 0, order: [], hp: {}, conditions: {}, adv: {}, saveResults: {} }
		expect(rollSaves(combat, ['n1'], 'str', 14, () => 4, () => 10).saveResults.n1).toEqual({ ability: 'str', total: 14, success: true })
	})

	it('Next turn skips an NPC at 0 HP; removing an entry keeps the turn on the same creature', () => {
		const order: Combat['order'] = [
			{ kind: 'player', name: 'Ana', initiative: 15 },
			{ kind: 'npc', npcId: 'n1', initiative: 12, bonus: 2 },
			{ kind: 'player', name: 'Bo', initiative: 5 },
		]
		const combat: Combat = { round: 1, turn: 0, order, hp: {}, conditions: {}, adv: {}, saveResults: {} }
		expect(nextTurn(combat, [], (id) => id === 'n1').turn).toBe(2)
		expect(nextTurn(combat, [], () => false).turn).toBe(1)
		expect(removeEntry({ ...combat, turn: 2 }, 'n:n1')).toMatchObject({ turn: 1, order: [order[0], order[2]] })
	})
})

describe('NPC HP and conditions write the stored character (D438)', () => {
	it('damage spends temporary HP first and stops at 0; heal stops at the maximum', () => {
		const store = new CharacterStore(new MemoryStorage())
		const npc = seedNpc(store)
		store.setHitPoints(npc.id, { currentHp: 20, temporaryHitPoints: 3 })
		damageNpc(store, fresh(store, npc.id), 25, 5)
		expect(fresh(store, npc.id).currentHp).toBe(18)
		expect(fresh(store, npc.id).play?.temporaryHitPoints).toBeUndefined()
		healNpc(store, fresh(store, npc.id), 25, 100)
		expect(fresh(store, npc.id).currentHp).toBe(25)
		damageNpc(store, fresh(store, npc.id), 25, 40)
		expect(fresh(store, npc.id).currentHp).toBe(0)
	})

	it('an NPC without current HP starts at its maximum', () => {
		const store = new CharacterStore(new MemoryStorage())
		const npc = seedNpc(store)
		damageNpc(store, { ...npc, currentHp: undefined }, 25, 5)
		expect(fresh(store, npc.id).currentHp).toBe(20)
	})

	it('conditions and Exhaustion go to play.conditions and play.exhaustion', () => {
		const store = new CharacterStore(new MemoryStorage())
		const npc = seedNpc(store)
		addNpcCondition(store, npc, 'Prone')
		addNpcCondition(store, fresh(store, npc.id), 'Exhaustion')
		expect(fresh(store, npc.id).play).toMatchObject({ conditions: ['Prone'], exhaustion: 1 })
		expect(npcConditions(fresh(store, npc.id))).toEqual(['Prone', 'Exhaustion'])
		removeNpcCondition(store, fresh(store, npc.id), 'Exhaustion')
		removeNpcCondition(store, fresh(store, npc.id), 'Prone')
		expect(npcConditions(fresh(store, npc.id))).toEqual([])
	})
})
