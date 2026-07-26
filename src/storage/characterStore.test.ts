import { describe, expect, it } from 'vitest'
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
		backing.setItem(STORAGE_KEY, JSON.stringify([{ schemaVersion: 1, id: '1', classes: [] }]))
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

	it('is a no-op for an unknown id', () => {
		const store = new CharacterStore(new MemoryStorage())
		store.create('Aria')
		expect(() => store.delete('missing')).not.toThrow()
		expect(store.list()).toHaveLength(1)
	})
})

describe('CharacterStore.exportCharacter / import', () => {
	it('exports a character as a top-level array with a schema version', () => {
		const store = new CharacterStore(new MemoryStorage())
		const character = store.create('Aria')
		const exported: unknown = JSON.parse(store.exportCharacter(character.id))
		expect(Array.isArray(exported)).toBe(true)
		expect(exported).toEqual([{ ...character, schemaVersion: 1 }])
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
		const badFile = JSON.stringify([{ schemaVersion: 1, id: '1', classes: [] }]) // missing name
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
				schemaVersion: 1,
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
