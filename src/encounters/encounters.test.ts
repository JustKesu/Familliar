import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractMonsters } from '../monsters/monsterData'
import { crXpTable, difficultyLabel, encounterXp, extractEncounterRules, monsterIndex, partyThresholds, uncountedNpcs } from './encounterDifficulty'
import { addMonster, newGroup, setGroupCount } from './encounterEdit'
import { ENCOUNTER_STORAGE_KEY, EncounterStorageError, EncounterStore, type EncounterInput } from './encounterStore'
import type { KeyValueStorage } from '../storage/characterStore'

function memoryStorage(initial?: string): KeyValueStorage & { value: () => string | null } {
	let stored: string | null = initial ?? null
	return {
		getItem: (key) => (key === ENCOUNTER_STORAGE_KEY ? stored : null),
		setItem: (key, value) => {
			if (key === ENCOUNTER_STORAGE_KEY) stored = value
		},
		removeItem: (key) => {
			if (key === ENCOUNTER_STORAGE_KEY) stored = null
		},
		value: () => stored,
	}
}

const WOLF = { name: 'Wolf', source: 'XMM' }
const DIRE_WOLF = { name: 'Dire Wolf', source: 'XMM' }

function input(): EncounterInput {
	return { name: 'Wolves', party: { size: 4, level: 2 }, players: ['Ana'], groups: [setGroupCount(newGroup(WOLF), 6), newGroup(DIRE_WOLF)], npcs: [] }
}

describe('EncounterStore', () => {
	it('round-trips a saved encounter and keeps ids and createdAt on update', () => {
		const storage = memoryStorage()
		const store = new EncounterStore(storage)
		const created = store.save(null, input(), new Date('2026-11-27T10:00:00Z'))
		expect(JSON.parse(storage.value()!).schemaVersion).toBe(3)
		expect(created.combat).toBeNull()
		expect(new EncounterStore(storage).list()).toEqual([created])

		const updated = store.save(created.id, { ...input(), name: 'Pack', groups: created.groups }, new Date('2026-11-27T11:00:00Z'))
		expect(updated.id).toBe(created.id)
		expect(updated.createdAt).toBe('2026-11-27T10:00:00.000Z')
		expect(updated.updatedAt).toBe('2026-11-27T11:00:00.000Z')
		expect(store.get(created.id)?.groups[0].members.map((m) => m.id)).toEqual(created.groups[0].members.map((m) => m.id))
		expect(store.list()).toHaveLength(1)

		store.delete(created.id)
		expect(store.list()).toEqual([])
	})

	it('reports a corrupt key without throwing and refuses to overwrite it', () => {
		const storage = memoryStorage('{not json')
		const store = new EncounterStore(storage)
		expect(store.read()).toEqual({ encounters: [], skipped: 0, error: 'The saved data is not valid JSON.' })
		expect(() => store.save(null, input())).toThrow(EncounterStorageError)
		expect(storage.value()).toBe('{not json')
		store.clearAll()
		expect(store.read().error).toBeNull()
	})

	it('treats a newer schema version as unreadable', () => {
		const store = new EncounterStore(memoryStorage(JSON.stringify({ schemaVersion: 4, encounters: [] })))
		expect(store.read().error).toMatch(/schema version 4/)
	})

	it('migrates a v1 entry to combat: null and no NPCs, and writes v3', () => {
		const v1 = { id: 'e1', name: 'Old', createdAt: 'x', updatedAt: 'x', party: null, players: [], groups: [] }
		const storage = memoryStorage(JSON.stringify({ schemaVersion: 1, encounters: [v1] }))
		const store = new EncounterStore(storage)
		expect(store.list()).toEqual([{ ...v1, combat: null, npcs: [] }])
		store.save(null, { ...input(), name: 'New' })
		const written = JSON.parse(storage.value()!)
		expect(written.schemaVersion).toBe(3)
		expect(written.encounters[0]).toEqual({ ...v1, combat: null, npcs: [] })
	})

	it('migrates a v2 entry to no NPCs, keeping its fight', () => {
		const combat = { round: 3, turn: 0, order: [], hp: { m1: 4 }, conditions: {}, adv: {}, saveResults: {} }
		const v2 = { id: 'e2', name: 'Two', createdAt: 'x', updatedAt: 'x', party: { size: 4, level: 2 }, players: ['Ana'], groups: [], combat }
		const storage = memoryStorage(JSON.stringify({ schemaVersion: 2, encounters: [v2] }))
		const store = new EncounterStore(storage)
		expect(store.list()).toEqual([{ ...v2, npcs: [] }])
		store.setCombat('e2', combat)
		expect(JSON.parse(storage.value()!)).toEqual({ schemaVersion: 3, encounters: [{ ...v2, npcs: [] }] })
	})

	it('refuses the same NPC twice in one encounter', () => {
		const store = new EncounterStore(memoryStorage())
		const npc = { id: 'n1', characterId: 'c1', name: 'Mira', cr: null }
		expect(store.save(null, { ...input(), npcs: [npc] }).npcs).toEqual([npc])
		expect(() => store.save(null, { ...input(), npcs: [npc, { ...npc, id: 'n2' }] })).toThrow(EncounterStorageError)
	})

	it('keeps the fight when the setup is saved, stores and clears it with setCombat', () => {
		const store = new EncounterStore(memoryStorage())
		const created = store.save(null, input())
		const combat = { round: 2, turn: 0, order: [{ kind: 'player' as const, name: 'Ana', initiative: 12 }], hp: {}, conditions: {}, adv: {}, saveResults: {} }
		store.setCombat(created.id, combat)
		expect(store.save(created.id, { ...input(), name: 'Renamed' }).combat).toEqual(combat)
		expect(store.setCombat(created.id, null).combat).toBeNull()
		expect(store.get(created.id)?.name).toBe('Renamed')
	})

	it('skips an entry whose combat is malformed', () => {
		const storage = memoryStorage()
		const store = new EncounterStore(storage)
		const good = store.save(null, input())
		storage.setItem(ENCOUNTER_STORAGE_KEY, JSON.stringify({ schemaVersion: 3, encounters: [good, { ...good, id: 'b', combat: { round: 0 } }] }))
		expect(store.read().skipped).toBe(1)
	})

	it('skips a bad entry, loads the rest and keeps the bad one on write', () => {
		const storage = memoryStorage()
		const store = new EncounterStore(storage)
		const good = store.save(null, input())
		const bad = { id: 'x', name: 42 }
		storage.setItem(ENCOUNTER_STORAGE_KEY, JSON.stringify({ schemaVersion: 3, encounters: [bad, good] }))
		expect(store.read()).toEqual({ encounters: [good], skipped: 1, error: null })
		store.save(null, { ...input(), name: 'Second' })
		expect(JSON.parse(storage.value()!).encounters).toContainEqual(bad)
		expect(store.read().skipped).toBe(1)
	})
})

describe('group editing', () => {
	it('numbers default names, keeps renamed members and their ids', () => {
		const one = newGroup(WOLF)
		expect(one.members.map((m) => m.name)).toEqual(['Wolf'])
		const three = setGroupCount(one, 3)
		expect(three.members.map((m) => m.name)).toEqual(['Wolf 1', 'Wolf 2', 'Wolf 3'])
		expect(three.members[0].id).toBe(one.members[0].id)
		expect(three.oneInitiative).toBe(true)
		const renamed = { ...three, members: three.members.map((m, i) => (i === 1 ? { ...m, name: 'Alpha' } : m)) }
		expect(setGroupCount(renamed, 2).members.map((m) => m.name)).toEqual(['Wolf 1', 'Alpha'])
		expect(setGroupCount(three, 1).members.map((m) => m.name)).toEqual(['Wolf'])
		expect(setGroupCount(three, 0).members).toHaveLength(1)
	})

	it('adding a monster already present raises its count', () => {
		const groups = addMonster(addMonster([], WOLF), WOLF)
		expect(groups).toHaveLength(1)
		expect(groups[0].members).toHaveLength(2)
		expect(addMonster(groups, DIRE_WOLF)).toHaveLength(2)
	})
})

describe('difficulty against data/encounter-rules.json and data/monsters.json', () => {
	const read = (file: string): unknown => JSON.parse(readFileSync(join(process.cwd(), 'data', file), 'utf8'))
	const rules = extractEncounterRules(read('encounter-rules.json'))
	const monsters = monsterIndex(extractMonsters(read('monsters.json')))

	it('six Wolves and a Dire Wolf are 500 XP, Moderate for four level 2 characters', () => {
		const total = encounterXp(input().groups, monsters)
		expect(total).toBe(500)
		// XDMG level 2 per character: Low 100, Moderate 150, High 200.
		const thresholds = partyThresholds(rules, { size: 4, level: 2 })
		expect(thresholds).toEqual({ low: 400, moderate: 600, high: 800 })
		expect(difficultyLabel(total, thresholds!)).toBe('Moderate')
	})

	it('labels each band as a cap, an unknown monster counts 0 XP, no party gives no thresholds', () => {
		const t = { low: 400, moderate: 600, high: 800 }
		expect([0, 400, 401, 600, 601, 800, 801].map((xp) => difficultyLabel(xp, t))).toEqual(['Low', 'Low', 'Moderate', 'Moderate', 'High', 'High', 'Above High'])
		expect(encounterXp([newGroup({ name: 'Renamed Thing', source: 'XMM' })], monsters)).toBe(0)
		expect(partyThresholds(rules, null)).toBeNull()
		expect(partyThresholds(rules, { size: 1, level: 20 })?.high).toBeGreaterThan(0)
	})

	it('an NPC with CR 1 counts 200 XP like a CR 1 monster; without CR it is not counted', () => {
		const crs = crXpTable(extractMonsters(read('monsters.json')))
		expect(crs.find((row) => row.cr === '1')?.xp).toBe(200)
		expect(crs.find((row) => row.cr === '1/2')?.xp).toBe(100)
		expect(crs[0]).toEqual({ cr: '0', xp: 10 })
		const npcs = [
			{ id: 'n1', characterId: 'c1', name: 'Mira', cr: '1' },
			{ id: 'n2', characterId: 'c2', name: 'Oswin', cr: null },
		]
		expect(encounterXp(input().groups, monsters, npcs, crs)).toBe(700)
		expect(uncountedNpcs(npcs)).toBe(1)
		expect(encounterXp([], monsters, [npcs[1]], crs)).toBe(0)
	})
})
