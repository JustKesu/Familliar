import { describe, expect, it } from 'vitest'
import type { CharacterAbilityScores } from '../abilities/abilityScores'
import { CURRENT_SCHEMA_VERSION, CUSTOM_ITEM_SOURCE } from './character'
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

	it('throws UnknownSchemaVersionError for a character saved at schema version 2 (before class-choice fields existed) and leaves the store unchanged', () => {
		// Before this change, background had no skillProficiencies and there
		// was no classSkills/masteries/fightingStyle at all. That shape is not
		// migrated (see CURRENT_SCHEMA_VERSION in character.ts) — a version-2
		// save like this is rejected outright rather than guessed at.
		const backing = new MemoryStorage()
		backing.setItem(
			STORAGE_KEY,
			JSON.stringify([
				{
					schemaVersion: 2,
					id: '1',
					name: 'Aria',
					classes: [],
					background: { name: 'Sage', source: 'XPHB' },
				},
			]),
		)
		const store = new CharacterStore(backing)
		expect(() => store.list()).toThrow(UnknownSchemaVersionError)
		expect(backing.getItem(STORAGE_KEY)).toBe(
			JSON.stringify([
				{
					schemaVersion: 2,
					id: '1',
					name: 'Aria',
					classes: [],
					background: { name: 'Sage', source: 'XPHB' },
				},
			]),
		)
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

describe('CharacterStore.create with class choices', () => {
	it('saves and reloads classSkills, masteries, fightingStyle, subclass and the background skill proficiencies', () => {
		const store = new CharacterStore(new MemoryStorage())
		const classes = [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Champion', level: 1 }]
		const background = {
			name: 'Soldier',
			source: 'XPHB',
			skillProficiencies: ['athletics', 'intimidation'] as [string, string],
			toolProficiency: 'Dice Set',
		}

		const character = store.create(
			'Aria',
			classes,
			undefined,
			undefined,
			background,
			undefined,
			undefined,
			['acrobatics', 'perception'],
			['longsword', 'shortbow'],
			'Dueling',
		)

		expect(character.classes[0]?.subclass).toBe('Champion')
		expect(character.background).toEqual(background)
		expect(character.classSkills).toEqual(['acrobatics', 'perception'])
		expect(character.masteries).toEqual(['longsword', 'shortbow'])
		expect(character.fightingStyle).toBe('Dueling')

		const reloaded = store.list().find((c) => c.id === character.id)
		expect(reloaded).toEqual(character)
	})

	it('leaves classSkills, masteries and fightingStyle undefined when none were provided (old-save compatibility)', () => {
		const store = new CharacterStore(new MemoryStorage())
		const character = store.create('Cato')
		expect(character.classSkills).toBeUndefined()
		expect(character.masteries).toBeUndefined()
		expect(character.fightingStyle).toBeUndefined()
	})
})

describe('CharacterStore.create with optionalFeatureChoices', () => {
	it('saves and reloads a v4 character with the optional-feature picks intact, tagged with their featureType', () => {
		const store = new CharacterStore(new MemoryStorage())
		const classes = [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Battle Master', level: 3 }]
		const optionalFeatureChoices = [{ featureType: 'MV:B', choices: ['Trip Attack', 'Riposte'] }]

		const character = store.create(
			'Aria',
			classes,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			optionalFeatureChoices,
		)

		expect(character.optionalFeatureChoices).toEqual(optionalFeatureChoices)

		const reloaded = store.list().find((c) => c.id === character.id)
		expect(reloaded).toEqual(character)
	})

	it('leaves optionalFeatureChoices undefined when none were provided (old-save compatibility)', () => {
		const store = new CharacterStore(new MemoryStorage())
		const character = store.create('Cato')
		expect(character.optionalFeatureChoices).toBeUndefined()
	})

	/** The D21 class-feature choices are their own field, validated alongside the rest. */
	it('reloads a classFeatureChoices entry intact and rejects a malformed one', () => {
		const classFeatureChoices = [
			{ className: 'Cleric', classSource: 'XPHB', featureName: 'Divine Order', grantedAtLevel: 1, optionName: 'Thaumaturge' },
		]
		const good = new MemoryStorage()
		good.setItem(STORAGE_KEY, JSON.stringify([{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Aria', classes: [], classFeatureChoices }]))
		expect(new CharacterStore(good).list()[0].classFeatureChoices).toEqual(classFeatureChoices)

		const bad = new MemoryStorage()
		bad.setItem(
			STORAGE_KEY,
			JSON.stringify([
				{
					schemaVersion: CURRENT_SCHEMA_VERSION,
					id: '1',
					name: 'Aria',
					classes: [],
					// grantedAtLevel out of the 1-20 range — D22's level must be a real one.
					classFeatureChoices: [{ className: 'Cleric', classSource: 'XPHB', featureName: 'Divine Order', grantedAtLevel: 0, optionName: 'Thaumaturge' }],
				},
			]),
		)
		expect(() => new CharacterStore(bad).list()).toThrow(CorruptDataError)
	})

	it('leaves classFeatureChoices undefined when none were provided (old-save compatibility)', () => {
		expect(new CharacterStore(new MemoryStorage()).create('Cato').classFeatureChoices).toBeUndefined()
	})

	/** The Druid's known Wild Shape forms (step 6b slice 3) — no level is stored, so none is validated. */
	it('reloads a wildShapeForms entry intact and rejects a malformed one', () => {
		const wildShapeForms = [
			{
				className: 'Druid',
				classSource: 'XPHB',
				forms: [
					{ name: 'Wolf', source: 'XMM' },
					{ name: 'Rat', source: 'XMM' },
				],
			},
		]
		const good = new MemoryStorage()
		good.setItem(STORAGE_KEY, JSON.stringify([{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Rowan', classes: [], wildShapeForms }]))
		expect(new CharacterStore(good).list()[0].wildShapeForms).toEqual(wildShapeForms)

		const bad = new MemoryStorage()
		bad.setItem(
			STORAGE_KEY,
			JSON.stringify([
				{
					schemaVersion: CURRENT_SCHEMA_VERSION,
					id: '1',
					name: 'Rowan',
					classes: [],
					// A form with no source — name alone cannot identify a stat block.
					wildShapeForms: [{ className: 'Druid', classSource: 'XPHB', forms: [{ name: 'Wolf' }] }],
				},
			]),
		)
		expect(() => new CharacterStore(bad).list()).toThrow(CorruptDataError)
	})

	it('leaves wildShapeForms undefined when none were provided (old-save compatibility)', () => {
		expect(new CharacterStore(new MemoryStorage()).create('Cato').wildShapeForms).toBeUndefined()
	})

	/** The familiar's current form — chosen from the sheet, not at creation. */
	it('reloads a familiar intact and rejects a malformed one', () => {
		const good = new MemoryStorage()
		good.setItem(
			STORAGE_KEY,
			JSON.stringify([{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Conjurer', classes: [], familiar: { name: 'Owl', source: 'XMM' } }]),
		)
		expect(new CharacterStore(good).list()[0].familiar).toEqual({ name: 'Owl', source: 'XMM' })

		const bad = new MemoryStorage()
		bad.setItem(
			STORAGE_KEY,
			// No source — name alone cannot identify a stat block, same rule as a Wild Shape form.
			JSON.stringify([{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Conjurer', classes: [], familiar: { name: 'Owl' } }]),
		)
		expect(() => new CharacterStore(bad).list()).toThrow(CorruptDataError)
	})

	it('sets, replaces and clears the familiar on a saved character', () => {
		const store = new CharacterStore(new MemoryStorage())
		const character = store.create('Conjurer')
		expect(character.familiar).toBeUndefined()

		store.setFamiliar(character.id, { name: 'Owl', source: 'XMM' })
		expect(store.list()[0].familiar).toEqual({ name: 'Owl', source: 'XMM' })

		store.setFamiliar(character.id, { name: 'Imp', source: 'XMM' })
		expect(store.list()[0].familiar).toEqual({ name: 'Imp', source: 'XMM' })

		store.setFamiliar(character.id, null)
		expect(store.list()[0].familiar).toBeUndefined()
		expect('familiar' in store.list()[0]).toBe(false)
	})

	it('throws CharacterNotFoundError when setting a familiar on an unknown id', () => {
		const store = new CharacterStore(new MemoryStorage())
		expect(() => store.setFamiliar('nope', { name: 'Owl', source: 'XMM' })).toThrow(CharacterNotFoundError)
	})

	it('rejects a saved optionalFeatureChoices entry missing featureType', () => {
		const backing = new MemoryStorage()
		backing.setItem(
			STORAGE_KEY,
			JSON.stringify([
				{
					schemaVersion: CURRENT_SCHEMA_VERSION,
					id: '1',
					name: 'Aria',
					classes: [],
					optionalFeatureChoices: [{ choices: ['Trip Attack'] }],
				},
			]),
		)
		const store = new CharacterStore(backing)
		expect(() => store.list()).toThrow(CorruptDataError)
	})

	/** Pact of the Tome's picks (build order step 6a) ride on the same entry, so they validate with it. */
	it('reloads an optionalFeatureChoices entry carrying spellChoices intact', () => {
		const backing = new MemoryStorage()
		const optionalFeatureChoices = [
			{
				featureType: 'EI',
				choices: ['Pact of the Tome'],
				spellChoices: [{ optionName: 'Pact of the Tome', cantrips: [{ name: 'Mage Hand', source: 'XPHB' }], spells: [{ name: 'Alarm', source: 'XPHB' }] }],
			},
		]
		backing.setItem(
			STORAGE_KEY,
			JSON.stringify([{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Aria', classes: [], optionalFeatureChoices }]),
		)
		const store = new CharacterStore(backing)
		expect(store.list()[0].optionalFeatureChoices).toEqual(optionalFeatureChoices)
	})

	it('rejects a spellChoices entry whose spell ref is missing a source', () => {
		const backing = new MemoryStorage()
		backing.setItem(
			STORAGE_KEY,
			JSON.stringify([
				{
					schemaVersion: CURRENT_SCHEMA_VERSION,
					id: '1',
					name: 'Aria',
					classes: [],
					optionalFeatureChoices: [
						{
							featureType: 'EI',
							choices: ['Pact of the Tome'],
							spellChoices: [{ optionName: 'Pact of the Tome', cantrips: [{ name: 'Mage Hand' }], spells: [] }],
						},
					],
				},
			]),
		)
		const store = new CharacterStore(backing)
		expect(() => store.list()).toThrow(CorruptDataError)
	})

	it('rejects a spellChoices entry missing optionName', () => {
		const backing = new MemoryStorage()
		backing.setItem(
			STORAGE_KEY,
			JSON.stringify([
				{
					schemaVersion: CURRENT_SCHEMA_VERSION,
					id: '1',
					name: 'Aria',
					classes: [],
					optionalFeatureChoices: [{ featureType: 'EI', choices: ['Pact of the Tome'], spellChoices: [{ cantrips: [], spells: [] }] }],
				},
			]),
		)
		const store = new CharacterStore(backing)
		expect(() => store.list()).toThrow(CorruptDataError)
	})

	/*
	 * D69: from version 16 on, a save one version behind is migrated instead of
	 * rejected. Version 16 is the last shape before Character.familiar existed.
	 */
	it('migrates a version-16 character forward instead of rejecting it', () => {
		const backing = new MemoryStorage()
		backing.setItem(
			STORAGE_KEY,
			JSON.stringify([
				{
					schemaVersion: 16,
					id: '1',
					name: 'Rowan',
					classes: [{ className: 'Druid', classSource: 'XPHB', subclass: 'Circle of the Moon', level: 6 }],
					wildShapeForms: [{ className: 'Druid', classSource: 'XPHB', forms: [{ name: 'Wolf', source: 'XMM' }] }],
				},
			]),
		)
		const store = new CharacterStore(backing)
		const [migrated] = store.list()
		expect(migrated.name).toBe('Rowan')
		expect(migrated.wildShapeForms).toEqual([{ className: 'Druid', classSource: 'XPHB', forms: [{ name: 'Wolf', source: 'XMM' }] }])
		// No familiar was summonable at version 16, and the absent field is what "none summoned" means.
		expect(migrated.familiar).toBeUndefined()

		// The migrated shape is written back at the current version on the next write.
		store.rename(migrated.id, 'Rowan the Green')
		expect(JSON.parse(backing.getItem(STORAGE_KEY)!)[0].schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
	})

	it('migrates a version-16 import file rather than refusing it', () => {
		const store = new CharacterStore(new MemoryStorage())
		const imported = store.import(JSON.stringify([{ schemaVersion: 16, id: 'old', name: 'Conjurer', classes: [] }]))
		expect(imported).toHaveLength(1)
		expect(imported[0].name).toBe('Conjurer')
		expect(store.list()).toHaveLength(1)
	})

	it('rejects a version-3 character (before optionalFeatureChoices existed) and leaves the store unchanged', () => {
		// Per docs/QUESTIONS.md "Migrace uložených postav", the v3 -> v4 bump
		// rejects old saves outright rather than migrating them.
		const backing = new MemoryStorage()
		const v3Payload = [
			{
				schemaVersion: 3,
				id: '1',
				name: 'Aria',
				classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Battle Master', level: 3 }],
			},
		]
		backing.setItem(STORAGE_KEY, JSON.stringify(v3Payload))
		const store = new CharacterStore(backing)
		expect(() => store.list()).toThrow(UnknownSchemaVersionError)
		expect(backing.getItem(STORAGE_KEY)).toBe(JSON.stringify(v3Payload))
	})

	it('rejects a version-3 import file, naming the version found and the version expected, and leaves the store unchanged', () => {
		const store = new CharacterStore(new MemoryStorage())
		store.create('Existing')
		const v3File = JSON.stringify([
			{
				schemaVersion: 3,
				id: '1',
				name: 'Aria',
				classes: [],
			},
		])
		expect(() => store.import(v3File)).toThrow(UnknownSchemaVersionError)
		try {
			store.import(v3File)
		} catch (error) {
			expect(error).toBeInstanceOf(UnknownSchemaVersionError)
			expect((error as Error).message).toContain('3')
			expect((error as Error).message).toContain(String(CURRENT_SCHEMA_VERSION))
		}
		expect(store.list()).toHaveLength(1)
	})
})

describe('CharacterStore inventory and currency (step 7 slice a1)', () => {
	it('leaves inventory and currencyCopper undefined on a freshly created character (owning nothing is normal)', () => {
		const character = new CharacterStore(new MemoryStorage()).create('Cato')
		expect(character.inventory).toBeUndefined()
		expect(character.currencyCopper).toBeUndefined()
	})

	it('sets, updates a quantity on, and clears the inventory of a saved character', () => {
		const store = new CharacterStore(new MemoryStorage())
		const character = store.create('Packrat')

		store.setInventory(character.id, [
			{ name: 'Longsword', source: 'XPHB', quantity: 1 },
			{ name: 'Torch', source: 'XPHB', quantity: 5 },
		])
		expect(store.list()[0].inventory).toEqual([
			{ name: 'Longsword', source: 'XPHB', quantity: 1 },
			{ name: 'Torch', source: 'XPHB', quantity: 5 },
		])

		store.setInventory(character.id, [
			{ name: 'Longsword', source: 'XPHB', quantity: 1 },
			{ name: 'Torch', source: 'XPHB', quantity: 10 },
		])
		expect(store.list()[0].inventory?.[1].quantity).toBe(10)

		store.setInventory(character.id, [])
		expect(store.list()[0].inventory).toBeUndefined()
		expect('inventory' in store.list()[0]).toBe(false)
	})

	it('round-trips currency through save and reload, and clears the field at zero', () => {
		const backing = new MemoryStorage()
		const store = new CharacterStore(backing)
		const character = store.create('Rich')

		store.setCurrency(character.id, 1234)
		// A fresh store over the same backing storage — proves it survived serialisation, not just an in-memory copy.
		expect(new CharacterStore(backing).list()[0].currencyCopper).toBe(1234)

		store.setCurrency(character.id, 0)
		expect(new CharacterStore(backing).list()[0].currencyCopper).toBeUndefined()
	})

	it('throws CharacterNotFoundError for an unknown id', () => {
		const store = new CharacterStore(new MemoryStorage())
		expect(() => store.setInventory('nope', [])).toThrow(CharacterNotFoundError)
		expect(() => store.setCurrency('nope', 10)).toThrow(CharacterNotFoundError)
	})

	it('rejects a saved inventory entry with a non-positive quantity, and a fractional currencyCopper', () => {
		const badQuantity = new MemoryStorage()
		badQuantity.setItem(
			STORAGE_KEY,
			JSON.stringify([
				{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Aria', classes: [], inventory: [{ name: 'Torch', source: 'XPHB', quantity: 0 }] },
			]),
		)
		expect(() => new CharacterStore(badQuantity).list()).toThrow(CorruptDataError)

		const badCurrency = new MemoryStorage()
		badCurrency.setItem(
			STORAGE_KEY,
			JSON.stringify([{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Aria', classes: [], currencyCopper: 12.5 }]),
		)
		expect(() => new CharacterStore(badCurrency).list()).toThrow(CorruptDataError)
	})

	it('keeps an inventory item whose data cannot be resolved — validation is structural only, never a lookup against items.json', () => {
		const backing = new MemoryStorage()
		backing.setItem(
			STORAGE_KEY,
			JSON.stringify([
				{
					schemaVersion: CURRENT_SCHEMA_VERSION,
					id: '1',
					name: 'Aria',
					classes: [],
					inventory: [{ name: 'Longsword of a Dropped Source', source: 'HOMEBREW', quantity: 1 }],
				},
			]),
		)
		expect(new CharacterStore(backing).list()[0].inventory).toEqual([
			{ name: 'Longsword of a Dropped Source', source: 'HOMEBREW', quantity: 1 },
		])
	})

	/* D69: the 17 -> 18 bump ships a migration, so a version-17 save is carried forward, not rejected. */
	it('migrates a version-17 character forward, keeping its fields and adding no inventory', () => {
		const backing = new MemoryStorage()
		backing.setItem(
			STORAGE_KEY,
			JSON.stringify([
				{ schemaVersion: 17, id: '1', name: 'Rowan', classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 3 }], familiar: { name: 'Owl', source: 'XMM' } },
			]),
		)
		const store = new CharacterStore(backing)
		const [migrated] = store.list()
		expect(migrated.name).toBe('Rowan')
		expect(migrated.familiar).toEqual({ name: 'Owl', source: 'XMM' })
		expect(migrated.inventory).toBeUndefined()
		expect(migrated.currencyCopper).toBeUndefined()

		store.rename(migrated.id, 'Rowan the Green')
		expect(JSON.parse(backing.getItem(STORAGE_KEY)!)[0].schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
	})

	it('round-trips an equipped item and refuses a bad equipped value or a second worn suit (step 7 slice b)', () => {
		const backing = new MemoryStorage()
		const store = new CharacterStore(backing)
		const character = store.create('Rowan')

		store.setInventory(character.id, [
			{ name: 'Chain Mail', source: 'XPHB', quantity: 1, equipped: 'worn' },
			{ name: 'Shield', source: 'XPHB', quantity: 1, equipped: 'held' },
			{ name: 'Leather Armor', source: 'XPHB', quantity: 1 },
		])
		expect(new CharacterStore(backing).list()[0].inventory).toEqual([
			{ name: 'Chain Mail', source: 'XPHB', quantity: 1, equipped: 'worn' },
			{ name: 'Shield', source: 'XPHB', quantity: 1, equipped: 'held' },
			{ name: 'Leather Armor', source: 'XPHB', quantity: 1 },
		])

		const badSlot = new MemoryStorage()
		badSlot.setItem(
			STORAGE_KEY,
			JSON.stringify([
				{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Aria', classes: [], inventory: [{ name: 'Shield', source: 'XPHB', quantity: 1, equipped: 'hand' }] },
			]),
		)
		expect(() => new CharacterStore(badSlot).list()).toThrow(CorruptDataError)

		const twoSuits = new MemoryStorage()
		twoSuits.setItem(
			STORAGE_KEY,
			JSON.stringify([
				{
					schemaVersion: CURRENT_SCHEMA_VERSION,
					id: '1',
					name: 'Aria',
					classes: [],
					inventory: [
						{ name: 'Chain Mail', source: 'XPHB', quantity: 1, equipped: 'worn' },
						{ name: 'Leather Armor', source: 'XPHB', quantity: 1, equipped: 'worn' },
					],
				},
			]),
		)
		expect(() => new CharacterStore(twoSuits).list()).toThrow(CorruptDataError)
	})

	/* D69: the 18 -> 19 bump ships a migration, so a version-18 save is carried forward with its inventory unequipped. */
	it('migrates a version-18 character forward, keeping its inventory and equipping nothing', () => {
		const backing = new MemoryStorage()
		backing.setItem(
			STORAGE_KEY,
			JSON.stringify([
				{
					schemaVersion: 18,
					id: '1',
					name: 'Rowan',
					classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 3 }],
					inventory: [{ name: 'Chain Mail', source: 'XPHB', quantity: 1 }],
					currencyCopper: 500,
				},
			]),
		)
		const [migrated] = new CharacterStore(backing).list()
		expect(migrated.inventory).toEqual([{ name: 'Chain Mail', source: 'XPHB', quantity: 1 }])
		expect(migrated.inventory?.[0].equipped).toBeUndefined()
		expect(migrated.currencyCopper).toBe(500)
	})

	it('round-trips a Finesse weapon ability pick and refuses a bad one (step 7 slice c)', () => {
		const backing = new MemoryStorage()
		const store = new CharacterStore(backing)
		const character = store.create('Nyx')

		store.setInventory(character.id, [{ name: 'Rapier', source: 'XPHB', quantity: 1, equipped: 'held', attackAbility: 'strength' }])
		// A fresh store over the same backing storage — proves the pick survived serialisation, not just an in-memory copy.
		expect(new CharacterStore(backing).list()[0].inventory).toEqual([
			{ name: 'Rapier', source: 'XPHB', quantity: 1, equipped: 'held', attackAbility: 'strength' },
		])

		const badAbility = new MemoryStorage()
		badAbility.setItem(
			STORAGE_KEY,
			JSON.stringify([
				{
					schemaVersion: CURRENT_SCHEMA_VERSION,
					id: '1',
					name: 'Aria',
					classes: [],
					inventory: [{ name: 'Rapier', source: 'XPHB', quantity: 1, attackAbility: 'charisma' }],
				},
			]),
		)
		expect(() => new CharacterStore(badAbility).list()).toThrow(CorruptDataError)
	})

	/* D69: the 19 -> 20 bump ships a migration, so a version-19 save keeps its equipped state and picks no ability. */
	it('migrates a version-19 character forward, keeping equipped state and choosing no attack ability', () => {
		const backing = new MemoryStorage()
		backing.setItem(
			STORAGE_KEY,
			JSON.stringify([
				{
					schemaVersion: 19,
					id: '1',
					name: 'Rowan',
					classes: [{ className: 'Rogue', classSource: 'XPHB', subclass: null, level: 3 }],
					inventory: [{ name: 'Rapier', source: 'XPHB', quantity: 1, equipped: 'held' }],
				},
			]),
		)
		const [migrated] = new CharacterStore(backing).list()
		expect(migrated.inventory).toEqual([{ name: 'Rapier', source: 'XPHB', quantity: 1, equipped: 'held' }])
		expect(migrated.inventory?.[0].attackAbility).toBeUndefined()
	})

	it('round-trips a Versatile weapon’s grip and refuses a bad one (step 7 slice b-fix)', () => {
		const backing = new MemoryStorage()
		const store = new CharacterStore(backing)
		const character = store.create('Nyx')

		store.setInventory(character.id, [{ name: 'Longsword', source: 'XPHB', quantity: 1, equipped: 'held', grip: 'two-handed' }])
		expect(new CharacterStore(backing).list()[0].inventory).toEqual([
			{ name: 'Longsword', source: 'XPHB', quantity: 1, equipped: 'held', grip: 'two-handed' },
		])

		const badGrip = new MemoryStorage()
		badGrip.setItem(
			STORAGE_KEY,
			JSON.stringify([
				{
					schemaVersion: CURRENT_SCHEMA_VERSION,
					id: '1',
					name: 'Aria',
					classes: [],
					inventory: [{ name: 'Longsword', source: 'XPHB', quantity: 1, grip: 'both-hands' }],
				},
			]),
		)
		expect(() => new CharacterStore(badGrip).list()).toThrow(CorruptDataError)
	})

	it('round-trips an attunement flag and refuses any value but true (step 7 slice d)', () => {
		const backing = new MemoryStorage()
		const store = new CharacterStore(backing)
		const character = store.create('Nyx')

		store.setInventory(character.id, [{ name: 'Cloak of Protection', source: 'XDMG', quantity: 1, attuned: true }])
		expect(new CharacterStore(backing).list()[0].inventory).toEqual([{ name: 'Cloak of Protection', source: 'XDMG', quantity: 1, attuned: true }])

		const badFlag = new MemoryStorage()
		badFlag.setItem(
			STORAGE_KEY,
			JSON.stringify([
				{
					schemaVersion: CURRENT_SCHEMA_VERSION,
					id: '1',
					name: 'Aria',
					classes: [],
					inventory: [{ name: 'Cloak of Protection', source: 'XDMG', quantity: 1, attuned: false }],
				},
			]),
		)
		expect(() => new CharacterStore(badFlag).list()).toThrow(CorruptDataError)
	})

	/* D69: the 20 -> 21 bump ships a migration, so a version-20 save keeps its inventory and is attuned to nothing. */
	it('migrates a version-20 character forward, attuning nothing it owns', () => {
		const backing = new MemoryStorage()
		backing.setItem(
			STORAGE_KEY,
			JSON.stringify([
				{
					schemaVersion: 20,
					id: '1',
					name: 'Rowan',
					classes: [{ className: 'Rogue', classSource: 'XPHB', subclass: null, level: 3 }],
					inventory: [{ name: 'Cloak of Protection', source: 'XDMG', quantity: 1 }],
				},
			]),
		)
		const [migrated] = new CharacterStore(backing).list()
		expect(migrated.inventory).toEqual([{ name: 'Cloak of Protection', source: 'XDMG', quantity: 1 }])
		expect(migrated.inventory?.[0].attuned).toBeUndefined()
	})

	it('round-trips a player-set magic bonus and refuses a value outside +1..+3 (step 7 slice e)', () => {
		const backing = new MemoryStorage()
		const store = new CharacterStore(backing)
		const character = store.create('Nyx')

		store.setInventory(character.id, [{ name: 'Longsword', source: 'XPHB', quantity: 1, magicBonus: 3 }])
		expect(new CharacterStore(backing).list()[0].inventory).toEqual([{ name: 'Longsword', source: 'XPHB', quantity: 1, magicBonus: 3 }])

		const badBonus = new MemoryStorage()
		badBonus.setItem(
			STORAGE_KEY,
			JSON.stringify([
				{
					schemaVersion: CURRENT_SCHEMA_VERSION,
					id: '1',
					name: 'Aria',
					classes: [],
					inventory: [{ name: 'Longsword', source: 'XPHB', quantity: 1, magicBonus: 4 }],
				},
			]),
		)
		expect(() => new CharacterStore(badBonus).list()).toThrow(CorruptDataError)
	})

	/* D69: the 21 -> 22 bump ships a migration, so a version-21 save keeps its inventory and carries no player-set bonus. */
	it('migrates a version-21 character forward, setting no bonus on anything it owns', () => {
		const backing = new MemoryStorage()
		backing.setItem(
			STORAGE_KEY,
			JSON.stringify([
				{
					schemaVersion: 21,
					id: '1',
					name: 'Rowan',
					classes: [{ className: 'Rogue', classSource: 'XPHB', subclass: null, level: 3 }],
					inventory: [{ name: 'Longsword', source: 'XPHB', quantity: 1 }],
				},
			]),
		)
		const [migrated] = new CharacterStore(backing).list()
		expect(migrated.inventory).toEqual([{ name: 'Longsword', source: 'XPHB', quantity: 1 }])
		expect(migrated.inventory?.[0].magicBonus).toBeUndefined()
	})

	/* Slice e2a: a custom item lives on its row, so surviving a save is the whole of "it exists". */
	it('round-trips a custom item’s whole definition, alongside the row state it carries (step 7 slice e2a)', () => {
		const backing = new MemoryStorage()
		const store = new CharacterStore(backing)
		const character = store.create('Nyx')
		const row = {
			name: 'Scarf of Warmth',
			source: CUSTOM_ITEM_SOURCE,
			quantity: 1,
			equipped: 'held' as const,
			attuned: true as const,
			magicBonus: 1 as const,
			custom: {
				name: 'Scarf of Warmth',
				kind: 'weapon' as const,
				valueCopper: 5000,
				requiresAttunement: true as const,
				attunementCondition: 'by a bard',
				description: 'You are comfortable in cold weather.',
			},
		}

		store.setInventory(character.id, [row])
		expect(new CharacterStore(backing).list()[0].inventory).toEqual([row])
	})

	/* Slice e2b: the definition grew eleven fields, and the storage layer still carries `custom` whole rather than field by field. */
	it('round-trips every computed field a custom item can declare (step 7 slice e2b)', () => {
		const backing = new MemoryStorage()
		const store = new CharacterStore(backing)
		const character = store.create('Nyx')
		const row = {
			name: 'Everything Plate',
			source: CUSTOM_ITEM_SOURCE,
			quantity: 1,
			custom: {
				name: 'Everything Plate',
				kind: 'armour' as const,
				armourClass: 14,
				armourCategory: 'medium' as const,
				damageDice: '1d8',
				damageType: 'slashing',
				weaponRange: 'melee' as const,
				weaponCategory: 'martial' as const,
				resist: ['fire'],
				immune: ['poison'],
				speedBonus: 10,
				darkvision: 60,
				bonusArmourClass: 1,
				bonusSavingThrow: 2,
				bonusSpellAttack: 1,
				bonusSpellSaveDc: 1,
				bonusAbilityCheck: 1,
			},
		}

		store.setInventory(character.id, [row])
		expect(new CharacterStore(backing).list()[0].inventory).toEqual([row])
	})

	/*
	 * D43: a definition the app cannot read must still LOAD, or the row that
	 * needs fixing is the one the player can never see. The storage layer
	 * therefore checks that `custom` is an object and stops there.
	 */
	it('loads a row whose custom definition is malformed, and refuses one that is not an object at all', () => {
		const broken = new MemoryStorage()
		broken.setItem(
			STORAGE_KEY,
			JSON.stringify([
				{
					schemaVersion: CURRENT_SCHEMA_VERSION,
					id: '1',
					name: 'Aria',
					classes: [],
					inventory: [{ name: 'Bad Thing', source: CUSTOM_ITEM_SOURCE, quantity: 1, custom: { name: 'Bad Thing', kind: 'banana' } }],
				},
			]),
		)
		expect(new CharacterStore(broken).list()[0].inventory?.[0].custom).toEqual({ name: 'Bad Thing', kind: 'banana' })

		const notAnObject = new MemoryStorage()
		notAnObject.setItem(
			STORAGE_KEY,
			JSON.stringify([
				{
					schemaVersion: CURRENT_SCHEMA_VERSION,
					id: '1',
					name: 'Aria',
					classes: [],
					inventory: [{ name: 'Bad Thing', source: CUSTOM_ITEM_SOURCE, quantity: 1, custom: 'a string' }],
				},
			]),
		)
		expect(() => new CharacterStore(notAnObject).list()).toThrow(CorruptDataError)
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

	it('rejects a version-2 import file, naming the version found and the version expected, and leaves the store unchanged', () => {
		const store = new CharacterStore(new MemoryStorage())
		store.create('Existing')
		const v2File = JSON.stringify([
			{
				schemaVersion: 2,
				id: '1',
				name: 'Aria',
				classes: [],
				background: { name: 'Sage', source: 'XPHB' },
			},
		])
		expect(() => store.import(v2File)).toThrow(UnknownSchemaVersionError)
		try {
			store.import(v2File)
		} catch (error) {
			expect(error).toBeInstanceOf(UnknownSchemaVersionError)
			expect((error as Error).message).toContain('2')
			expect((error as Error).message).toContain(String(CURRENT_SCHEMA_VERSION))
		}
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
