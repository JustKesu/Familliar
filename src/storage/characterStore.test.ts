import { describe, expect, it } from 'vitest'
import type { CharacterAbilityScores } from '../abilities/abilityScores'
import { applyHealing } from '../hitPoints/damageHealing'
import { choiceNames, CURRENT_SCHEMA_VERSION, CUSTOM_ITEM_SOURCE } from './character'
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
		const character = store.create({ name: 'Aria' })
		expect(character.id).toBeTruthy()
		expect(character.name).toBe('Aria')
		expect(character.classes).toEqual([])
		expect(store.list()).toEqual([character])
	})

	it('trims the name', () => {
		const store = new CharacterStore(new MemoryStorage())
		const character = store.create({ name: '  Aria  ' })
		expect(character.name).toBe('Aria')
	})

	it('rejects an empty name and does not save anything', () => {
		const store = new CharacterStore(new MemoryStorage())
		expect(() => store.create({ name: '   ' })).toThrow(ImportValidationError)
		expect(store.list()).toEqual([])
	})

	it('throws StorageFullError when the backing storage is full', () => {
		const store = new CharacterStore(new FullStorage())
		expect(() => store.create({ name: 'Aria' })).toThrow(StorageFullError)
	})
})

/* Build order step 8, slice 8d1 — the write behind an edited character. */
describe('CharacterStore.update', () => {
	it('replaces the character in place, keeping its id and leaving the others alone', () => {
		const store = new CharacterStore(new MemoryStorage())
		const first = store.create({ name: 'Aria', classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 1 }] })
		const second = store.create({ name: 'Cato' })

		const updated = store.update(first.id, { name: 'Aria', classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 6 }] })

		expect(updated.id).toBe(first.id)
		expect(updated.classes[0].level).toBe(6)
		expect(store.list()).toEqual([updated, second])
	})

	/* Everything but the id comes from the input, so a field left out is genuinely removed. */
	it('drops a field the input does not carry', () => {
		const store = new CharacterStore(new MemoryStorage())
		const created = store.create({ name: 'Aria', fightingStyle: 'Archery', currentHp: 12 })

		const updated = store.update(created.id, { name: 'Aria', currentHp: 12 })

		expect(updated.fightingStyle).toBeUndefined()
		expect(updated.currentHp).toBe(12)
	})

	it('rejects an unknown id and an empty name without writing anything', () => {
		const store = new CharacterStore(new MemoryStorage())
		const created = store.create({ name: 'Aria' })

		expect(() => store.update('nope', { name: 'Aria' })).toThrow(CharacterNotFoundError)
		expect(() => store.update(created.id, { name: '  ' })).toThrow(ImportValidationError)
		expect(store.list()).toEqual([created])
	})
})

describe('CharacterStore.create with ability scores', () => {
	it('saves and reloads ability scores from the point buy method', () => {
		const store = new CharacterStore(new MemoryStorage())
		const abilityScores: CharacterAbilityScores = {
			method: 'pointBuy',
			scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 },
		}
		const character = store.create({ name: 'Aria', abilityScores })
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
		const character = store.create({ name: 'Bram', abilityScores })

		const reloaded = store.list().find((c) => c.id === character.id)
		expect(reloaded?.abilityScores).toEqual(abilityScores)
	})

	it('leaves abilityScores undefined when none were provided (old-save compatibility)', () => {
		const store = new CharacterStore(new MemoryStorage())
		const character = store.create({ name: 'Cato' })
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
		const character = store.create({
			name: 'Aria',
			languages: [
				{ name: 'Common', source: 'XPHB', grantedBy: 'automatic' },
				{ name: 'Draconic', source: 'XPHB', grantedBy: 'creation' },
				{ name: 'Dwarvish', source: 'XPHB', grantedBy: 'creation' },
			],
		})

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

		const character = store.create({
			name: 'Aria',
			classes,
			background,
			classSkills: ['acrobatics', 'perception'],
			masteries: [{ name: 'longsword' }, { name: 'shortbow' }],
			fightingStyle: 'Dueling',
		})

		expect(character.classes[0]?.subclass).toBe('Champion')
		expect(character.background).toEqual(background)
		expect(character.classSkills).toEqual(['acrobatics', 'perception'])
		// A creation pick carries no level (D97) — the wizard chooses all of them in one step.
		expect(character.masteries).toEqual([{ name: 'longsword' }, { name: 'shortbow' }])
		expect(choiceNames(character.masteries)).toEqual(['longsword', 'shortbow'])
		expect(character.fightingStyle).toBe('Dueling')

		const reloaded = store.list().find((c) => c.id === character.id)
		expect(reloaded).toEqual(character)
	})

	it('leaves classSkills, masteries and fightingStyle undefined when none were provided (old-save compatibility)', () => {
		const store = new CharacterStore(new MemoryStorage())
		const character = store.create({ name: 'Cato' })
		expect(character.classSkills).toBeUndefined()
		expect(character.masteries).toBeUndefined()
		expect(character.fightingStyle).toBeUndefined()
	})
})

describe('CharacterStore.create with optionalFeatureChoices', () => {
	it('saves and reloads a v4 character with the optional-feature picks intact, tagged with their featureType', () => {
		const store = new CharacterStore(new MemoryStorage())
		const classes = [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Battle Master', level: 3 }]
		const optionalFeatureChoices = [{ featureType: 'MV:B', choices: [{ name: 'Trip Attack' }, { name: 'Riposte' }] }]

		const character = store.create({
			name: 'Aria',
			classes,
			optionalFeatureChoices,
		})

		expect(character.optionalFeatureChoices).toEqual(optionalFeatureChoices)

		const reloaded = store.list().find((c) => c.id === character.id)
		expect(reloaded).toEqual(character)
	})

	it('leaves optionalFeatureChoices undefined when none were provided (old-save compatibility)', () => {
		const store = new CharacterStore(new MemoryStorage())
		const character = store.create({ name: 'Cato' })
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
		expect(new CharacterStore(new MemoryStorage()).create({ name: 'Cato' }).classFeatureChoices).toBeUndefined()
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
		expect(new CharacterStore(new MemoryStorage()).create({ name: 'Cato' }).wildShapeForms).toBeUndefined()
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
		const character = store.create({ name: 'Conjurer' })
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
					optionalFeatureChoices: [{ choices: [{ name: 'Trip Attack' }] }],
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
				choices: [{ name: 'Pact of the Tome' }],
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
							choices: [{ name: 'Pact of the Tome' }],
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
					optionalFeatureChoices: [{ featureType: 'EI', choices: [{ name: 'Pact of the Tome' }], spellChoices: [{ cantrips: [], spells: [] }] }],
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
		store.create({ name: 'Existing' })
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
		const character = new CharacterStore(new MemoryStorage()).create({ name: 'Cato' })
		expect(character.inventory).toBeUndefined()
		expect(character.currencyCopper).toBeUndefined()
	})

	it('sets, updates a quantity on, and clears the inventory of a saved character', () => {
		const store = new CharacterStore(new MemoryStorage())
		const character = store.create({ name: 'Packrat' })

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
		const character = store.create({ name: 'Rich' })

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
		const character = store.create({ name: 'Rowan' })

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
		const character = store.create({ name: 'Nyx' })

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
		const character = store.create({ name: 'Nyx' })

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
		const character = store.create({ name: 'Nyx' })

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
		const character = store.create({ name: 'Nyx' })

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
		const character = store.create({ name: 'Nyx' })
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
		const character = store.create({ name: 'Nyx' })
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

describe('CharacterStore hand-set hit points (persistent-header slice 1; the max is an override as of 8a)', () => {
	it('leaves currentHp, maxHpOverride and hitPointLevels undefined on a freshly created character', () => {
		const character = new CharacterStore(new MemoryStorage()).create({ name: 'Cato' })
		expect(character.currentHp).toBeUndefined()
		expect(character.maxHpOverride).toBeUndefined()
		expect(character.hitPointLevels).toBeUndefined()
	})

	it('round-trips both fields through save and reload, and clears one back to undefined', () => {
		const backing = new MemoryStorage()
		const store = new CharacterStore(backing)
		const character = store.create({ name: 'Bruiser' })

		store.setHitPoints(character.id, { currentHp: 31, maxHpOverride: 44 })
		const reloaded = new CharacterStore(backing).list()[0]
		expect(reloaded.currentHp).toBe(31)
		expect(reloaded.maxHpOverride).toBe(44)

		// 0 is a real value (a downed character) and is kept; undefined clears the override so the computed maximum stands again.
		store.setHitPoints(character.id, { currentHp: 0 })
		const after = new CharacterStore(backing).list()[0]
		expect(after.currentHp).toBe(0)
		expect(after.maxHpOverride).toBeUndefined()
		expect('maxHpOverride' in after).toBe(false)
	})

	/* Slice 9a1 (D110): the third field, stored only while there are any. */
	it('round-trips temporary hit points and stores none as the field’s absence', () => {
		const backing = new MemoryStorage()
		const store = new CharacterStore(backing)
		const character = store.create({ name: 'Bruiser' })

		store.setHitPoints(character.id, { currentHp: 20, temporaryHitPoints: 8 })
		expect(new CharacterStore(backing).list()[0].play?.temporaryHitPoints).toBe(8)

		store.setHitPoints(character.id, { currentHp: 20, temporaryHitPoints: 0 })
		const after = new CharacterStore(backing).list()[0]
		expect(after.play?.temporaryHitPoints).toBeUndefined()
		expect('play' in after).toBe(false)
	})

	/* Slice 9b1: the fourth play field, which no hit-point write may disturb. */
	it('carries resourceUses through a hit-point write and stores 0 as absence', () => {
		const backing = new MemoryStorage()
		const store = new CharacterStore(backing)
		const character = store.create({ name: 'Rager', play: { resourceUses: { Rage: 2 } } })
		expect(character.play).toEqual({ resourceUses: { Rage: 2 } })

		store.setHitPoints(character.id, { currentHp: 20, temporaryHitPoints: 5 })
		expect(new CharacterStore(backing).list()[0].play).toEqual({ temporaryHitPoints: 5, resourceUses: { Rage: 2 } })

		expect(store.update(character.id, { name: 'Rager', play: { resourceUses: { Rage: 0 } } }).play).toBeUndefined()
	})

	/* Slice 9b3: the fifth play field, written on its own and normalised by the same rule as the four before it. */
	it('writes spent spell slots per pool, leaves the other play fields alone, and stores 0 as absence', () => {
		const backing = new MemoryStorage()
		const store = new CharacterStore(backing)
		const character = store.create({ name: 'Bindra', currentHp: 12, play: { resourceUses: { Rage: 1 } } })

		store.setSpentSpellSlots(character.id, { ordinary: { 1: 2, 3: 0 }, pact: 1 })
		const after = new CharacterStore(backing).list()[0]
		expect(after.play).toEqual({ resourceUses: { Rage: 1 }, spentSpellSlots: { ordinary: { 1: 2 }, pact: 1 } })
		expect(after.currentHp).toBe(12)

		store.setSpentSpellSlots(character.id, { ordinary: { 1: 0 }, pact: 0 })
		expect(new CharacterStore(backing).list()[0].play).toEqual({ resourceUses: { Rage: 1 } })
	})

	/* Slice 9b4: the sixth play field, normalised by storedPlayState's own zero-drop rule and riding through a write that does not mention it. */
	it('stores spent hit dice keyed per class, drops a 0 count, and carries them through a hit-point write', () => {
		const backing = new MemoryStorage()
		const store = new CharacterStore(backing)
		const character = store.create({ name: 'Aria', play: { spentHitDice: { 'Fighter|XPHB': 2, 'Bard|XPHB': 0 } } })
		expect(character.play).toEqual({ spentHitDice: { 'Fighter|XPHB': 2 } })

		store.setHitPoints(character.id, { currentHp: 20, temporaryHitPoints: 5 })
		expect(new CharacterStore(backing).list()[0].play).toEqual({ temporaryHitPoints: 5, spentHitDice: { 'Fighter|XPHB': 2 } })

		expect(store.update(character.id, { name: 'Aria', play: { spentHitDice: { 'Fighter|XPHB': 0 } } }).play).toBeUndefined()
	})

	/* Slice 9d1: the seventh play field, written on its own, replaced outright, and stored as absence when cleared. */
	it('sets, replaces and clears the concentration spell, and no other write disturbs it', () => {
		const backing = new MemoryStorage()
		const store = new CharacterStore(backing)
		const character = store.create({ name: 'Aria', currentHp: 20, play: { resourceUses: { Rage: 1 } } })

		store.setConcentration(character.id, 'Bless')
		expect(new CharacterStore(backing).list()[0].play).toEqual({ resourceUses: { Rage: 1 }, concentratingOn: 'Bless' })

		store.setConcentration(character.id, 'Hex')
		expect(new CharacterStore(backing).list()[0].play?.concentratingOn).toBe('Hex')

		// Neither a hit-point write nor a rest is a reason to stop concentrating.
		store.setHitPoints(character.id, { currentHp: 12, temporaryHitPoints: 3 })
		store.applyRest(character.id, { currentHp: 39, resourceUses: {}, spentSpellSlots: {}, spentHitDice: {} })
		const afterWrites = new CharacterStore(backing).list()[0]
		expect(afterWrites.currentHp).toBe(39)
		expect(afterWrites.play).toEqual({ temporaryHitPoints: 3, concentratingOn: 'Hex' })

		store.setConcentration(character.id, null)
		store.setHitPoints(character.id, { currentHp: 39 })
		const cleared = new CharacterStore(backing).list()[0]
		expect(cleared.play).toBeUndefined()
		expect('play' in cleared).toBe(false)
	})

	it('throws CharacterNotFoundError for an unknown id on a concentration write', () => {
		expect(() => new CharacterStore(new MemoryStorage()).setConcentration('nope', 'Bless')).toThrow(CharacterNotFoundError)
	})

	it('reads a stored null concentration as none and rejects a non-name value', () => {
		const withNull = new MemoryStorage()
		withNull.setItem(
			STORAGE_KEY,
			JSON.stringify([{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Aria', classes: [], play: { concentratingOn: null } }]),
		)
		expect(new CharacterStore(withNull).list()[0].play?.concentratingOn).toBeUndefined()

		const wrongType = new MemoryStorage()
		wrongType.setItem(
			STORAGE_KEY,
			JSON.stringify([{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Aria', classes: [], play: { concentratingOn: 7 } }]),
		)
		expect(() => new CharacterStore(wrongType).list()).toThrow(CorruptDataError)
	})

	/* Slice 9b5: one write for all four spent piles, with temporary hit points riding through both rests. */
	it('applies a rest as a single write, keeping temporary hit points and clearing death saves the heal ends', () => {
		const backing = new MemoryStorage()
		const store = new CharacterStore(backing)
		const character = store.create({
			name: 'Kessa',
			currentHp: 0,
			play: {
				temporaryHitPoints: 6,
				deathSaves: { successes: 1, failures: 2 },
				resourceUses: { Rage: 3 },
				spentSpellSlots: { ordinary: { 1: 2 }, pact: 1 },
				spentHitDice: { 'Barbarian|XPHB': 2 },
			},
		})

		// A Short Rest: one Rage back and the Pact slot, everything else passed through as it stands.
		store.applyRest(character.id, {
			currentHp: character.currentHp,
			resourceUses: { Rage: 2 },
			spentSpellSlots: { ordinary: { 1: 2 }, pact: 0 },
			spentHitDice: character.play?.spentHitDice,
		})
		const short = new CharacterStore(backing).list()[0]
		expect(short.currentHp).toBe(0)
		expect(short.play).toEqual({
			temporaryHitPoints: 6,
			deathSaves: { successes: 1, failures: 2 },
			resourceUses: { Rage: 2 },
			spentSpellSlots: { ordinary: { 1: 2 } },
			spentHitDice: { 'Barbarian|XPHB': 2 },
		})

		// A Long Rest: everything spent is gone, the heal lifts the character off 0 and takes the death saves with it (D111).
		store.applyRest(character.id, { currentHp: 39, resourceUses: {}, spentSpellSlots: {}, spentHitDice: {} })
		const long = new CharacterStore(backing).list()[0]
		expect(long.currentHp).toBe(39)
		expect(long.play).toEqual({ temporaryHitPoints: 6 })
	})

	it('throws CharacterNotFoundError for an unknown id on a rest', () => {
		expect(() => new CharacterStore(new MemoryStorage()).applyRest('nope', { resourceUses: {} })).toThrow(CharacterNotFoundError)
	})

	/* D110: negative current hit points mean nothing under the 2024 rules; no write path may leave one behind. */
	it('clamps a negative current HP at 0, whether it arrives through create, update or setHitPoints', () => {
		const backing = new MemoryStorage()
		const store = new CharacterStore(backing)
		const character = store.create({ name: 'Bruiser', currentHp: -4 })
		expect(character.currentHp).toBe(0)

		store.setHitPoints(character.id, { currentHp: -9 })
		expect(new CharacterStore(backing).list()[0].currentHp).toBe(0)

		expect(store.update(character.id, { name: 'Bruiser', currentHp: -1 }).currentHp).toBe(0)
	})

	it('throws CharacterNotFoundError for an unknown id', () => {
		const store = new CharacterStore(new MemoryStorage())
		expect(() => store.setHitPoints('nope', { currentHp: 10, maxHpOverride: 10 })).toThrow(CharacterNotFoundError)
	})

	it('rejects a saved character whose hit points are negative or fractional', () => {
		const negative = new MemoryStorage()
		negative.setItem(
			STORAGE_KEY,
			JSON.stringify([{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Aria', classes: [], currentHp: -1 }]),
		)
		expect(() => new CharacterStore(negative).list()).toThrow(CorruptDataError)

		const fractional = new MemoryStorage()
		fractional.setItem(
			STORAGE_KEY,
			JSON.stringify([{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Aria', classes: [], maxHpOverride: 12.5 }]),
		)
		expect(() => new CharacterStore(fractional).list()).toThrow(CorruptDataError)
	})

	/* Slice 9a2 (D111): the progress is bound to the current, so the store is where the pair can never go wrong. */
	it('keeps death saves only while current HP is exactly 0, on every write path', () => {
		const backing = new MemoryStorage()
		const store = new CharacterStore(backing)
		const character = store.create({ name: 'Bruiser', currentHp: 0, play: { deathSaves: { successes: 2, failures: 1 } } })
		expect(character.play?.deathSaves).toEqual({ successes: 2, failures: 1 })

		// The heal a player applies through the damage panel — the progress goes with the dying.
		const healed = applyHealing({ currentHp: 0, temporaryHitPoints: 0 }, 7, 39)
		store.setHitPoints(character.id, { currentHp: healed.currentHp, deathSaves: { successes: 2, failures: 1 } })
		const after = new CharacterStore(backing).list()[0]
		expect(after.currentHp).toBe(7)
		expect(after.play?.deathSaves).toBeUndefined()
		expect('play' in after).toBe(false)

		// Direct entry back to 0 starts a fresh death save; nothing survived to come back to.
		store.setHitPoints(character.id, { currentHp: 0 })
		expect(new CharacterStore(backing).list()[0].play?.deathSaves).toBeUndefined()

		// All-zero counts are "none", written as the field's absence, like temporary 0 (D110).
		store.setHitPoints(character.id, { currentHp: 0, deathSaves: { successes: 0, failures: 0 } })
		expect('play' in new CharacterStore(backing).list()[0]).toBe(false)

		// An update that leaves the character conscious drops them too, whatever the caller passed.
		expect(store.update(character.id, { name: 'Bruiser', currentHp: 12, play: { deathSaves: { successes: 1, failures: 1 } } }).play).toBeUndefined()
	})

	it('rejects a saved character whose death saves are out of range', () => {
		const backing = new MemoryStorage()
		backing.setItem(
			STORAGE_KEY,
			JSON.stringify([{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Aria', classes: [], currentHp: 0, play: { deathSaves: { successes: 4, failures: 0 } } }]),
		)
		expect(() => new CharacterStore(backing).list()).toThrow(CorruptDataError)
	})

	it('round-trips death saves at 0 hit points', () => {
		const backing = new MemoryStorage()
		backing.setItem(
			STORAGE_KEY,
			JSON.stringify([{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Aria', classes: [], currentHp: 0, play: { deathSaves: { successes: 1, failures: 2 } } }]),
		)
		expect(new CharacterStore(backing).list()[0].play?.deathSaves).toEqual({ successes: 1, failures: 2 })
	})

	it('round-trips hitPointLevels and rejects a malformed one (slice 8a)', () => {
		const backing = new MemoryStorage()
		backing.setItem(
			STORAGE_KEY,
			JSON.stringify([
				{
					schemaVersion: CURRENT_SCHEMA_VERSION,
					id: '1',
					name: 'Aria',
					classes: [],
					hitPointLevels: [
						{ level: 1, dieResult: 10, kind: 'maximum' },
						{ level: 2, dieResult: 7, kind: 'roll' },
					],
				},
			]),
		)
		expect(new CharacterStore(backing).list()[0].hitPointLevels).toEqual([
			{ level: 1, dieResult: 10, kind: 'maximum' },
			{ level: 2, dieResult: 7, kind: 'roll' },
		])

		const badKind = new MemoryStorage()
		badKind.setItem(
			STORAGE_KEY,
			JSON.stringify([
				{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Aria', classes: [], hitPointLevels: [{ level: 1, dieResult: 10, kind: 'guess' }] },
			]),
		)
		expect(() => new CharacterStore(badKind).list()).toThrow(CorruptDataError)

		const badLevel = new MemoryStorage()
		badLevel.setItem(
			STORAGE_KEY,
			JSON.stringify([
				{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Aria', classes: [], hitPointLevels: [{ level: 0, dieResult: 10, kind: 'maximum' }] },
			]),
		)
		expect(() => new CharacterStore(badLevel).list()).toThrow(CorruptDataError)
	})
})

describe('stored weapon masteries (D97)', () => {
	it('reads a mastery with a level and one without, and rejects a bare name or an out-of-range level', () => {
		const good = new MemoryStorage()
		good.setItem(
			STORAGE_KEY,
			JSON.stringify([
				{
					schemaVersion: CURRENT_SCHEMA_VERSION,
					id: '1',
					name: 'Aria',
					classes: [],
					masteries: [{ name: 'Longsword' }, { name: 'Shortbow', level: 4 }],
				},
			]),
		)
		// An absent level is "not known", not an error — it is what every creation pick carries.
		expect(new CharacterStore(good).list()[0].masteries).toEqual([{ name: 'Longsword' }, { name: 'Shortbow', level: 4 }])

		const bareName = new MemoryStorage()
		bareName.setItem(
			STORAGE_KEY,
			JSON.stringify([{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Aria', classes: [], masteries: ['Longsword'] }]),
		)
		expect(() => new CharacterStore(bareName).list()).toThrow(CorruptDataError)

		const badLevel = new MemoryStorage()
		badLevel.setItem(
			STORAGE_KEY,
			JSON.stringify([{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Aria', classes: [], masteries: [{ name: 'Longsword', level: 0 }] }]),
		)
		expect(() => new CharacterStore(badLevel).list()).toThrow(CorruptDataError)
	})

	it('returns the plain names from the stored shape', () => {
		expect(choiceNames([{ name: 'Longsword' }, { name: 'Shortbow', level: 4 }])).toEqual(['Longsword', 'Shortbow'])
		expect(choiceNames(undefined)).toEqual([])
	})
})

describe('stored expertise skills (D98)', () => {
	it('reads an expertise skill with a level and one without, and rejects a bare name or an out-of-range level', () => {
		const good = new MemoryStorage()
		good.setItem(
			STORAGE_KEY,
			JSON.stringify([
				{
					schemaVersion: CURRENT_SCHEMA_VERSION,
					id: '1',
					name: 'Aria',
					classes: [],
					expertiseSkills: [{ name: 'stealth' }, { name: 'perception', level: 6 }],
				},
			]),
		)
		expect(new CharacterStore(good).list()[0].expertiseSkills).toEqual([{ name: 'stealth' }, { name: 'perception', level: 6 }])

		const bareName = new MemoryStorage()
		bareName.setItem(
			STORAGE_KEY,
			JSON.stringify([{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Aria', classes: [], expertiseSkills: ['stealth'] }]),
		)
		expect(() => new CharacterStore(bareName).list()).toThrow(CorruptDataError)

		const badLevel = new MemoryStorage()
		badLevel.setItem(
			STORAGE_KEY,
			JSON.stringify([
				{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Aria', classes: [], expertiseSkills: [{ name: 'stealth', level: 21 }] },
			]),
		)
		expect(() => new CharacterStore(badLevel).list()).toThrow(CorruptDataError)
	})

	it('saves a creation pick with no level and reloads it unchanged', () => {
		const store = new CharacterStore(new MemoryStorage())
		const character = store.create({ name: 'Aria', expertiseSkills: [{ name: 'stealth' }] })
		expect(character.expertiseSkills).toEqual([{ name: 'stealth' }])
		expect(store.list().find((c) => c.id === character.id)).toEqual(character)
	})
})

describe('stored optional-feature picks (D99)', () => {
	/** One featureType holding picks from three levels — the case a level on the ENTRY would get wrong. */
	const metamagic = [
		{
			featureType: 'MM',
			choices: [{ name: 'Careful Spell' }, { name: 'Twinned Spell', level: 10 }, { name: 'Quickened Spell', level: 17 }],
		},
	]

	it('reads picks with and without a level side by side, and rejects a bare name or an out-of-range level', () => {
		const good = new MemoryStorage()
		good.setItem(
			STORAGE_KEY,
			JSON.stringify([{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Aria', classes: [], optionalFeatureChoices: metamagic }]),
		)
		expect(new CharacterStore(good).list()[0].optionalFeatureChoices).toEqual(metamagic)

		const bareName = new MemoryStorage()
		bareName.setItem(
			STORAGE_KEY,
			JSON.stringify([
				{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Aria', classes: [], optionalFeatureChoices: [{ featureType: 'MM', choices: ['Careful Spell'] }] },
			]),
		)
		expect(() => new CharacterStore(bareName).list()).toThrow(CorruptDataError)

		const badLevel = new MemoryStorage()
		badLevel.setItem(
			STORAGE_KEY,
			JSON.stringify([
				{
					schemaVersion: CURRENT_SCHEMA_VERSION,
					id: '1',
					name: 'Aria',
					classes: [],
					optionalFeatureChoices: [{ featureType: 'MM', choices: [{ name: 'Careful Spell', level: 0 }] }],
				},
			]),
		)
		expect(() => new CharacterStore(badLevel).list()).toThrow(CorruptDataError)
	})

	it('saves a creation pick with no level and reloads it unchanged', () => {
		const store = new CharacterStore(new MemoryStorage())
		const character = store.create({ name: 'Aria', optionalFeatureChoices: [{ featureType: 'EI', choices: [{ name: 'Agonizing Blast' }] }] })
		expect(character.optionalFeatureChoices).toEqual([{ featureType: 'EI', choices: [{ name: 'Agonizing Blast' }] }])
		expect(store.list().find((c) => c.id === character.id)).toEqual(character)
	})
})

/* Slice 9d2: three plain strings on Character itself, verbatim, each written on its own. */
describe('CharacterStore free-text fields (slice 9d2)', () => {
	const MULTI_LINE = '- first line\n\n  indented, with trailing spaces   \n* second line\n'

	it('stores each field under its own name, exactly as typed, and reads it back', () => {
		const backing = new MemoryStorage()
		const store = new CharacterStore(backing)
		const character = store.create({ name: 'Aria' })

		store.setText(character.id, 'appearance', MULTI_LINE)
		store.setText(character.id, 'backstory', 'Raised by owls.\nLeft at dawn.')
		store.setText(character.id, 'notes', ' ')

		const stored = new CharacterStore(backing).list()[0]
		expect(stored.appearance).toBe(MULTI_LINE)
		expect(stored.backstory).toBe('Raised by owls.\nLeft at dawn.')
		// A whitespace-only note is what the player typed, so it stays; only the empty string is none.
		expect(stored.notes).toBe(' ')
	})

	it('replaces one field without touching the other two or the play state', () => {
		const backing = new MemoryStorage()
		const store = new CharacterStore(backing)
		const character = store.create({ name: 'Aria', currentHp: 9, play: { concentratingOn: 'Bless' } })
		store.setText(character.id, 'appearance', 'Tall')
		store.setText(character.id, 'notes', 'Owes Cato 5 gp')

		store.setText(character.id, 'backstory', 'Orphan')
		store.setText(character.id, 'appearance', 'Short')

		const stored = new CharacterStore(backing).list()[0]
		expect(stored).toMatchObject({ appearance: 'Short', backstory: 'Orphan', notes: 'Owes Cato 5 gp', currentHp: 9, play: { concentratingOn: 'Bless' } })
	})

	it('stores the empty string as absence', () => {
		const backing = new MemoryStorage()
		const store = new CharacterStore(backing)
		const character = store.create({ name: 'Aria' })
		store.setText(character.id, 'notes', 'something')

		store.setText(character.id, 'notes', '')

		const stored = new CharacterStore(backing).list()[0]
		expect('notes' in stored).toBe(false)
		expect(store.create({ name: 'Cato', appearance: '' }).appearance).toBeUndefined()
	})

	it('is not disturbed by a rest or a hit-point write', () => {
		const backing = new MemoryStorage()
		const store = new CharacterStore(backing)
		const character = store.create({ name: 'Aria', currentHp: 10 })
		store.setText(character.id, 'backstory', MULTI_LINE)

		store.setHitPoints(character.id, { currentHp: 4 })
		store.applyRest(character.id, { currentHp: 30, resourceUses: {}, spentSpellSlots: {}, spentHitDice: {} })

		expect(new CharacterStore(backing).list()[0].backstory).toBe(MULTI_LINE)
	})

	it('keeps the text through update when the input carries it, and drops it when it does not', () => {
		const store = new CharacterStore(new MemoryStorage())
		const created = store.create({ name: 'Aria', appearance: 'Tall', backstory: 'Orphan', notes: 'Note' })

		const kept = store.update(created.id, { name: 'Aria', appearance: 'Tall', backstory: 'Orphan', notes: 'Note' })
		expect(kept).toMatchObject({ appearance: 'Tall', backstory: 'Orphan', notes: 'Note' })

		const dropped = store.update(created.id, { name: 'Aria' })
		expect(dropped.appearance).toBeUndefined()
	})

	it('throws CharacterNotFoundError for an unknown id', () => {
		expect(() => new CharacterStore(new MemoryStorage()).setText('nope', 'notes', 'x')).toThrow(CharacterNotFoundError)
	})

	it('survives an export and an import unchanged', () => {
		const source = new CharacterStore(new MemoryStorage())
		const original = source.create({ name: 'Aria' })
		source.setText(original.id, 'appearance', MULTI_LINE)
		source.setText(original.id, 'notes', 'a\r\nb')

		const [imported] = new CharacterStore(new MemoryStorage()).import(source.exportCharacter(original.id))

		expect(imported.appearance).toBe(MULTI_LINE)
		expect(imported.notes).toBe('a\r\nb')
		expect(imported.backstory).toBeUndefined()
	})

	it('rejects a stored field that is not a string', () => {
		for (const field of ['appearance', 'backstory', 'notes']) {
			const backing = new MemoryStorage()
			backing.setItem(STORAGE_KEY, JSON.stringify([{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Aria', classes: [], [field]: 7 }]))
			expect(() => new CharacterStore(backing).list()).toThrow(CorruptDataError)
		}
	})
})

describe('CharacterStore.rename', () => {
	it('renames an existing character', () => {
		const store = new CharacterStore(new MemoryStorage())
		const character = store.create({ name: 'Aria' })
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
		const character = store.create({ name: 'Aria' })
		store.delete(character.id)
		expect(store.list()).toEqual([])
	})

	it('throws CharacterNotFoundError for an unknown id and leaves the store unchanged', () => {
		const store = new CharacterStore(new MemoryStorage())
		store.create({ name: 'Aria' })
		expect(() => store.delete('missing')).toThrow(CharacterNotFoundError)
		expect(store.list()).toHaveLength(1)
	})
})

describe('CharacterStore.exportCharacter / import', () => {
	it('exports a character as a top-level array with a schema version', () => {
		const store = new CharacterStore(new MemoryStorage())
		const character = store.create({ name: 'Aria' })
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
		const original = source.create({ name: 'Aria' })
		const file = source.exportCharacter(original.id)

		const destination = new CharacterStore(new MemoryStorage())
		destination.create({ name: 'Existing Character' })
		const [imported] = destination.import(file)

		expect(imported?.id).not.toBe(original.id)
		expect(imported?.name).toBe('Aria')
		expect(destination.list()).toHaveLength(2)
	})

	it('re-importing the same file twice creates two separate characters', () => {
		const source = new CharacterStore(new MemoryStorage())
		const original = source.create({ name: 'Aria' })
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
		store.create({ name: 'Existing' })
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
		store.create({ name: 'Existing' })
		const badFile = JSON.stringify([{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', classes: [] }]) // missing name
		expect(() => store.import(badFile)).toThrow(ImportValidationError)
		expect(store.list()).toHaveLength(1)
	})

	it('rejects an unsupported schema version and leaves the store unchanged', () => {
		const store = new CharacterStore(new MemoryStorage())
		store.create({ name: 'Existing' })
		const futureFile = JSON.stringify([{ schemaVersion: 999, id: '1', name: 'Aria', classes: [] }])
		expect(() => store.import(futureFile)).toThrow(UnknownSchemaVersionError)
		expect(store.list()).toHaveLength(1)
	})

	it('rejects a version-2 import file, naming the version found and the version expected, and leaves the store unchanged', () => {
		const store = new CharacterStore(new MemoryStorage())
		store.create({ name: 'Existing' })
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
		const original = source.create({ name: 'Aria' })
		const file = source.exportCharacter(original.id)

		const store = new CharacterStore(new FullStorage())
		expect(() => store.import(file)).toThrow(StorageFullError)
	})
})
