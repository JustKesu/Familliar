import { describe, expect, it } from 'vitest'
import { CharacterStore, type KeyValueStorage } from './characterStore'
import { ImportValidationError } from './errors'

const STORAGE_KEY = 'familliar:characters'

class MemoryStorage implements KeyValueStorage {
	data = new Map<string, string>()
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

const FIGHTER = [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 1 }]

function seeded(record: Record<string, unknown>): CharacterStore {
	const backing = new MemoryStorage()
	backing.setItem(STORAGE_KEY, JSON.stringify([record]))
	return new CharacterStore(backing)
}

describe('NPC flag (D437)', () => {
	it('a schema-72 record loads as a player character with no flag', () => {
		const [character] = seeded({ schemaVersion: 72, id: '1', name: 'Aria', classes: FIGHTER }).list()
		expect(character.name).toBe('Aria')
		expect('npc' in character).toBe(false)
	})

	it('validation keeps npc: true and rejects any other value', () => {
		expect(seeded({ schemaVersion: 73, id: '1', name: 'Bandit', classes: FIGHTER, npc: true }).list()[0].npc).toBe(true)
		const store = seeded({ schemaVersion: 73, id: '1', name: 'Bandit', classes: FIGHTER, npc: 'yes' })
		expect(store.list()).toEqual([])
		expect(store.listUnreadable()[0].message).toMatch(/npc must be true/)
	})

	it('export keeps the flag and import stores an NPC', () => {
		const store = seeded({ schemaVersion: 73, id: '1', name: 'Bandit', classes: FIGHTER, npc: true })
		const [imported] = store.import(store.exportCharacter('1'))
		expect(imported.npc).toBe(true)
		expect(imported.id).not.toBe('1')
	})

	it('update (Edit, level up) keeps the flag', () => {
		const store = seeded({ schemaVersion: 73, id: '1', name: 'Bandit', classes: FIGHTER, npc: true })
		expect(store.update('1', { name: 'Bandit chief', classes: FIGHTER }).npc).toBe(true)
		expect(store.list()[0].npc).toBe(true)
	})

	it('markNpc flags a created character', () => {
		const store = new CharacterStore(new MemoryStorage())
		const created = store.create({ name: 'Guard', classes: FIGHTER })
		store.markNpc(created.id)
		expect(store.list()[0].npc).toBe(true)
	})
})

describe('CharacterStore.duplicateAsNpc (D437)', () => {
	const original = {
		schemaVersion: 73,
		id: '1',
		name: 'Bandit',
		classes: FIGHTER,
		npc: true,
		currentHp: 4,
		inventory: [{ name: 'Scimitar', source: 'XPHB', quantity: 1 }],
	}

	it('saves a copy with a new id, the flag and the new name; the rest is equal', () => {
		const store = seeded(original)
		const copy = store.duplicateAsNpc('1', '  Bandit two ')
		const [stored, storedCopy] = store.list()
		expect(copy.id).not.toBe('1')
		expect(storedCopy).toEqual(copy)
		const { id: _a, name: _b, ...rest } = stored
		const { id: _c, name: copyName, ...copyRest } = storedCopy
		expect(copyName).toBe('Bandit two')
		expect(copyRest).toEqual(rest)
		expect(copyRest.npc).toBe(true)
	})

	it('flags a copy of a player character as NPC and leaves the original alone', () => {
		const store = seeded({ ...original, npc: undefined })
		store.duplicateAsNpc('1', 'Copy')
		const [stored, copy] = store.list()
		expect(stored.npc).toBeUndefined()
		expect(copy.npc).toBe(true)
	})

	it('refuses an empty name', () => {
		const store = seeded(original)
		expect(() => store.duplicateAsNpc('1', '   ')).toThrow(ImportValidationError)
		expect(store.list()).toHaveLength(1)
	})
})
