import { describe, expect, it } from 'vitest'
import type { CharacterAbilityScores } from '../abilities/abilityScores'
import { CURRENT_SCHEMA_VERSION } from './character'
import { CharacterStore, type KeyValueStorage } from './characterStore'
import {
	CharacterNotFoundError,
	CorruptDataError,
	ImportValidationError,
	StorageFullError,
	StorageUnavailableError,
	UnknownSchemaVersionError,
} from './errors'

const STORAGE_KEY = 'familliar:characters'

class MemoryStorage implements KeyValueStorage {
	private data = new Map<string, string>()

	getItem(key: string): string | null {
		return this.data.has(key) ? (this.data.get(key) ?? null) : null
	}

	setItem(key: string, value: string): void {
		this.data.set(key, value)
	}

	removeItem(key: string): void {
		this.data.delete(key)
	}
}

class ThrowingStorage implements KeyValueStorage {
	getItem(): string | null {
		throw new Error('blocked')
	}
	setItem(): void {
		throw new Error('blocked')
	}
	removeItem(): void {
		throw new Error('blocked')
	}
}

class FullStorage implements KeyValueStorage {
	getItem(): string | null {
		return null
	}
	setItem(): void {
		throw new DOMException('quota exceeded', 'QuotaExceededError')
	}
	removeItem(): void {}
}

describe('CharacterStore.list', () => {
	it('returns an empty array when nothing has been saved', () => {
		const store = new CharacterStore(new MemoryStorage())
		expect(store.list()).toEqual([])
	})

	it('throws StorageUnavailableError when the backing storage is unreachable', () => {
		const store = new CharacterStore(new ThrowingStorage())
		expect(() => store.list()).toThrow(StorageUnavailableError)
	})

	it('throws CorruptDataError when the saved value is not valid JSON', () => {
		const backing = new MemoryStorage()
		backing.setItem(STORAGE_KEY, '{not json')
		const store = new CharacterStore(backing)
		expect(() => store.list()).toThrow(CorruptDataError)
	})

	it('throws CorruptDataError when the saved value is not an array', () => {
		const backing = new MemoryStorage()
		backing.setItem(STORAGE_KEY, JSON.stringify({ id: '1' }))
		const store = new CharacterStore(backing)
		expect(() => store.list()).toThrow(CorruptDataError)
	})

	it('throws CorruptDataError when a saved character is missing required fields', () => {
		const backing = new MemoryStorage()
		backing.setItem(STORAGE_KEY, JSON.stringify([{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', classes: [] }]))
		const store = new CharacterStore(backing)
		expect(() => store.list()).toThrow(CorruptDataError)
	})

	it('throws UnknownSchemaVersionError when a saved character has an unsupported version', () => {
		const backing = new MemoryStorage()
		backing.setItem(
			STORAGE_KEY,
			JSON.stringify([{ schemaVersion: 999, id: '1', name: 'Aria', classes: [] }]),
		)
		const store = new CharacterStore(backing)
		expect(() => store.list()).toThrow(UnknownSchemaVersionError)
	})

	it('throws UnknownSchemaVersionError for a character saved under the old languages shape (schema version 1)', () => {
		// Before this change, `languages` held only the two chosen entries as
		// { name, source } pairs (book source), with no Common and no
		// `grantedBy`. That shape is not migrated (see CURRENT_SCHEMA_VERSION
		// in character.ts) — an old save like this is rejected outright rather
		// than guessed at.
		const backing = new MemoryStorage()
		backing.setItem(
			STORAGE_KEY,
			JSON.stringify([
				{
					schemaVersion: 1,
					id: '1',
					name: 'Aria',
					classes: [],
					languages: [
						{ name: 'Draconic', source: 'XPHB' },
						{ name: 'Dwarvish', source: 'XPHB' },
					],
				},
			]),
		)
		const store = new CharacterStore(backing)
		expect(() => store.list()).toThrow(UnknownSchemaVersionError)
	})
})

describe('CharacterStore.create', () => {
	it('adds a character with a generated id', () => {
		const store = new CharacterStore(new MemoryStorage())
		const character = store.create('Aria')
		expect(character.id).toBeTruthy()
		expect(character.name).toBe('Aria')
		expect(character.classes).toEqual([])
		expect(store.list()).toEqual([character])
	})

	it('trims the name', () => {
		const store = new CharacterStore(new MemoryStorage())
		const character = store.create('  Aria  ')
		expect(character.name).toBe('Aria')
	})

	it('rejects an empty name and does not save anything', () => {
		const store = new CharacterStore(new MemoryStorage())
		expect(() => store.create('   ')).toThrow(ImportValidationError)
		expect(store.list()).toEqual([])
	})

	it('throws StorageFullError when the backing storage is full', () => {
		const store = new CharacterStore(new FullStorage())
		expect(() => store.create('Aria')).toThrow(StorageFullError)
	})
})

describe('CharacterStore.create with ability scores', () => {
	it('saves and reloads ability scores from the point buy method', () => {
		const store = new CharacterStore(new MemoryStorage())
		const abilityScores: CharacterAbilityScores = {
			method: 'pointBuy',
			scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 },
		}
		const character = store.create('Aria', [], abilityScores)
		expect(character.abilityScores).toEqual(abilityScores)

		const reloaded = store.list().find((c) => c.id === character.id)
		expect(reloaded?.abilityScores).toEqual(abilityScores)
	})

	it('saves and reloads rolled sets so a rolled value never changes on reload', () => {
		const store = new CharacterStore(new MemoryStorage())
		const abilityScores: CharacterAbilityScores = {
			method: 'roll',
			scores: { strength: 16, dexterity: 12, constitution: 14, intelligence: 9, wisdom: 13, charisma: 10 },
			rolledSets: [
				{ dice: [6, 6, 4, 1], total: 16 },
				{ dice: [5, 4, 3, 1], total: 12 },
				{ dice: [6, 5, 3, 2], total: 14 },
				{ dice: [4, 3, 2, 1], total: 9 },
				{ dice: [5, 4, 4, 1], total: 13 },
				{ dice: [4, 3, 3, 2], total: 10 },
			],
		}
		const character = store.create('Bram', [], abilityScores)

		const reloaded = store.list().find((c) => c.id === character.id)
		expect(reloaded?.abilityScores).toEqual(abilityScores)
	})

	it('leaves abilityScores undefined when none were provided (old-save compatibility)', () => {
		const store = new CharacterStore(new MemoryStorage())
		const character = store.create('Cato')
		expect(character.abilityScores).toBeUndefined()
		expect(store.list()[0]?.abilityScores).toBeUndefined()
	})

	it('rejects a saved character whose ability score is out of range', () => {
		const backing = new MemoryStorage()
		backing.setItem(
			STORAGE_KEY,
			JSON.stringify([
				{
					schemaVersion: CURRENT_SCHEMA_VERSION,
					id: '1',
					name: 'Aria',
					classes: [],
					abilityScores: {
						method: 'pointBuy',
						scores: { strength: 99, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 },
					},
				},
			]),
		)
		const badStore = new CharacterStore(backing)
		expect(() => badStore.list()).toThrow(CorruptDataError)
	})
})

describe('CharacterStore.create with languages', () => {
	it('saves and reloads Common with the automatic source and picks with the creation source', () => {
		const store = new CharacterStore(new MemoryStorage())
		const character = store.create('Aria', [], undefined, undefined, undefined, undefined, [
			{ name: 'Common', source: 'XPHB', grantedBy: 'automatic' },
			{ name: 'Draconic', source: 'XPHB', grantedBy: 'creation' },
			{ name: 'Dwarvish', source: 'XPHB', grantedBy: 'creation' },
		])

		expect(character.languages).toEqual([
			{ name: 'Common', source: 'XPHB', grantedBy: 'automatic' },
			{ name: 'Draconic', source: 'XPHB', grantedBy: 'creation' },
			{ name: 'Dwarvish', source: 'XPHB', grantedBy: 'creation' },
		])

		const reloaded = store.list().find((c) => c.id === character.id)
		expect(reloaded?.languages).toEqual(character.languages)
	})

	it('rejects a saved language missing grantedBy', () => {
		const backing = new MemoryStorage()
		backing.setItem(
			STORAGE_KEY,
			JSON.stringify([
				{
					schemaVersion: CURRENT_SCHEMA_VERSION,
					id: '1',
					name: 'Aria',
					classes: [],
					languages: [{ name: 'Common', source: 'XPHB' }],
				},
			]),
		)
		const store = new CharacterStore(backing)
		expect(() => store.list()).toThrow(CorruptDataError)
	})
})

describe('CharacterStore.rename', () => {
	it('renames an existing character', () => {
		const store = new CharacterStore(new MemoryStorage())
		const character = store.create('Aria')
		store.rename(character.id, 'Bree')
		expect(store.list()[0]?.name).toBe('Bree')
	})

	it('throws CharacterNotFoundError for an unknown id', () => {
		const store = new CharacterStore(new MemoryStorage())
		expect(() => store.rename('missing', 'Bree')).toThrow(CharacterNotFoundError)
	})
})

describe('CharacterStore.delete', () => {
	it('removes a character', () => {
		const store = new CharacterStore(new MemoryStorage())
		const character = store.create('Aria')
		store.delete(character.id)
		expect(store.list()).toEqual([])
	})

	it('throws CharacterNotFoundError for an unknown id and leaves the store unchanged', () => {
		const store = new CharacterStore(new MemoryStorage())
		store.create('Aria')
		expect(() => store.delete('missing')).toThrow(CharacterNotFoundError)
		expect(store.list()).toHaveLength(1)
	})
})

describe('CharacterStore.exportCharacter / import', () => {
	it('exports a character as a top-level array with a schema version', () => {
		const store = new CharacterStore(new MemoryStorage())
		const character = store.create('Aria')
		const exported: unknown = JSON.parse(store.exportCharacter(character.id))
		expect(Array.isArray(exported)).toBe(true)
		expect(exported).toEqual([{ ...character, schemaVersion: CURRENT_SCHEMA_VERSION }])
	})

	it('throws CharacterNotFoundError when exporting an unknown id', () => {
		const store = new CharacterStore(new MemoryStorage())
		expect(() => store.exportCharacter('missing')).toThrow(CharacterNotFoundError)
	})

	it('imports a character as a new one with a fresh id, never overwriting', () => {
		const source = new CharacterStore(new MemoryStorage())
		const original = source.create('Aria')
		const file = source.exportCharacter(original.id)

		const destination = new CharacterStore(new MemoryStorage())
		destination.create('Existing Character')
		const [imported] = destination.import(file)

		expect(imported?.id).not.toBe(original.id)
		expect(imported?.name).toBe('Aria')
		expect(destination.list()).toHaveLength(2)
	})

	it('re-importing the same file twice creates two separate characters', () => {
		const source = new CharacterStore(new MemoryStorage())
		const original = source.create('Aria')
		const file = source.exportCharacter(original.id)

		const destination = new CharacterStore(new MemoryStorage())
		destination.import(file)
		destination.import(file)

		expect(destination.list()).toHaveLength(2)
		const ids = destination.list().map((c) => c.id)
		expect(new Set(ids).size).toBe(2)
	})

	it('rejects invalid JSON and leaves the store unchanged', () => {
		const store = new CharacterStore(new MemoryStorage())
		store.create('Existing')
		expect(() => store.import('{not json')).toThrow(ImportValidationError)
		expect(store.list()).toHaveLength(1)
	})

	it('rejects a file whose top level is not an array', () => {
		const store = new CharacterStore(new MemoryStorage())
		expect(() => store.import(JSON.stringify({ id: '1', name: 'Aria', classes: [] }))).toThrow(
			ImportValidationError,
		)
	})

	it('rejects a file with no characters in it', () => {
		const store = new CharacterStore(new MemoryStorage())
		expect(() => store.import('[]')).toThrow(ImportValidationError)
	})

	it('rejects a malformed character and leaves the store unchanged', () => {
		const store = new CharacterStore(new MemoryStorage())
		store.create('Existing')
		const badFile = JSON.stringify([{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', classes: [] }]) // missing name
		expect(() => store.import(badFile)).toThrow(ImportValidationError)
		expect(store.list()).toHaveLength(1)
	})

	it('rejects an unsupported schema version and leaves the store unchanged', () => {
		const store = new CharacterStore(new MemoryStorage())
		store.create('Existing')
		const futureFile = JSON.stringify([{ schemaVersion: 999, id: '1', name: 'Aria', classes: [] }])
		expect(() => store.import(futureFile)).toThrow(UnknownSchemaVersionError)
		expect(store.list()).toHaveLength(1)
	})

	it('rejects a character with an invalid class entry', () => {
		const store = new CharacterStore(new MemoryStorage())
		const badFile = JSON.stringify([
			{
				schemaVersion: CURRENT_SCHEMA_VERSION,
				id: '1',
				name: 'Aria',
				classes: [{ className: 'Wizard', classSource: 'XPHB', subclass: null, level: 0 }],
			},
		])
		expect(() => store.import(badFile)).toThrow(ImportValidationError)
	})

	it('throws StorageFullError when the destination storage is full', () => {
		const source = new CharacterStore(new MemoryStorage())
		const original = source.create('Aria')
		const file = source.exportCharacter(original.id)

		const store = new CharacterStore(new FullStorage())
		expect(() => store.import(file)).toThrow(StorageFullError)
	})
})
