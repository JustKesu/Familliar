import { describe, expect, it, vi } from 'vitest'
import type { CharacterAbilityScores } from '../abilities/abilityScores'
import { freeCastCounter, remainingUses } from '../calculation/freeCastResources'
import { featInstances } from '../featAsi/featInstances'
import { applyHealing } from '../hitPoints/damageHealing'
import { choiceNames, CURRENT_SCHEMA_VERSION, CUSTOM_ITEM_SOURCE, PORTRAIT_MAX_LENGTH, PORTRAIT_PREFIX } from './character'
import type { Character } from './character'
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
		const created = store.create({ name: 'Aria', fightingStyles: [{ name: 'Archery' }], currentHp: 12 })

		const updated = store.update(created.id, { name: 'Aria', currentHp: 12 })

		expect(updated.fightingStyles).toBeUndefined()
		expect(updated.currentHp).toBe(12)
	})

	it('rejects an unknown id and an empty name without writing anything', () => {
		const store = new CharacterStore(new MemoryStorage())
		const created = store.create({ name: 'Aria' })

		expect(() => store.update('nope', { name: 'Aria' })).toThrow(CharacterNotFoundError)
		expect(() => store.update(created.id, { name: '  ' })).toThrow(ImportValidationError)
		expect(store.list()).toEqual([created])
	})

	/* W20: a value list() would reject must never be written, or the whole character list fails to load. */
	it('refuses hit point values the stored-data validation rejects, on create and update, leaving the list readable', () => {
		const store = new CharacterStore(new MemoryStorage())
		const created = store.create({ name: 'Aria' })
		for (const dieResult of [-1, 2.5, Number.NaN]) {
			const hitPointLevels = [{ level: 2, kind: 'manual' as const, dieResult }]
			expect(() => store.create({ name: 'Bad', hitPointLevels })).toThrow(ImportValidationError)
			expect(() => store.update(created.id, { name: 'Aria', hitPointLevels })).toThrow(ImportValidationError)
		}
		expect(store.list()).toEqual([created])

		const ok = store.update(created.id, { name: 'Aria', hitPointLevels: [{ level: 2, kind: 'manual', dieResult: 5 }] })
		expect(store.list()).toEqual([ok])
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
			fightingStyles: [{ className: 'Fighter', classSource: 'XPHB', name: 'Dueling' }],
		})

		expect(character.classes[0]?.subclass).toBe('Champion')
		expect(character.background).toEqual(background)
		expect(character.classSkills).toEqual(['acrobatics', 'perception'])
		// A creation pick carries no level (D97) — the wizard chooses all of them in one step.
		expect(character.masteries).toEqual([{ name: 'longsword' }, { name: 'shortbow' }])
		expect(choiceNames(character.masteries)).toEqual(['longsword', 'shortbow'])
		expect(character.fightingStyles).toEqual([{ className: 'Fighter', classSource: 'XPHB', name: 'Dueling' }])

		const reloaded = store.list().find((c) => c.id === character.id)
		expect(reloaded).toEqual(character)
	})

	it('leaves classSkills, masteries and fightingStyle undefined when none were provided (old-save compatibility)', () => {
		const store = new CharacterStore(new MemoryStorage())
		const character = store.create({ name: 'Cato' })
		expect(character.classSkills).toBeUndefined()
		expect(character.masteries).toBeUndefined()
		expect(character.fightingStyles).toBeUndefined()
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

	it('stores the familiar\'s own hit points, and writes "full" and "no temp" as absence (D213)', () => {
		const store = new CharacterStore(new MemoryStorage())
		const character = store.create({ name: 'Conjurer' })
		store.setFamiliar(character.id, { name: 'Imp', source: 'XMM' })

		store.setFamiliarHitPoints(character.id, { currentHp: 16, temporaryHitPoints: 4 })
		expect(store.list()[0].familiar).toEqual({ name: 'Imp', source: 'XMM', currentHp: 16, temporaryHitPoints: 4 })

		store.setFamiliarHitPoints(character.id, { currentHp: 0, temporaryHitPoints: 0 })
		expect(store.list()[0].familiar).toEqual({ name: 'Imp', source: 'XMM', currentHp: 0 })

		store.setFamiliarHitPoints(character.id, {})
		expect(store.list()[0].familiar).toEqual({ name: 'Imp', source: 'XMM' })
	})

	it('does nothing for the familiar\'s hit points when there is no familiar, and throws for an unknown id', () => {
		const store = new CharacterStore(new MemoryStorage())
		const character = store.create({ name: 'Conjurer' })
		store.setFamiliarHitPoints(character.id, { currentHp: 5 })
		expect(store.list()[0].familiar).toBeUndefined()
		expect(() => store.setFamiliarHitPoints('nope', { currentHp: 5 })).toThrow(CharacterNotFoundError)
	})

	it('a new form always starts at full hit points, even when the caller passes the old ones along (D213)', () => {
		const store = new CharacterStore(new MemoryStorage())
		const character = store.create({ name: 'Conjurer' })
		store.setFamiliar(character.id, { name: 'Imp', source: 'XMM' })
		store.setFamiliarHitPoints(character.id, { currentHp: 3, temporaryHitPoints: 2 })

		store.setFamiliar(character.id, { name: 'Owl', source: 'XMM', currentHp: 3, temporaryHitPoints: 2 })
		expect(store.list()[0].familiar).toEqual({ name: 'Owl', source: 'XMM' })
	})

	it('a Long Rest (resetFamiliarHp) drops the familiar\'s hit points; a rest without it leaves them (D213)', () => {
		const store = new CharacterStore(new MemoryStorage())
		const character = store.create({ name: 'Conjurer' })
		store.setFamiliar(character.id, { name: 'Imp', source: 'XMM' })
		store.setFamiliarHitPoints(character.id, { currentHp: 3, temporaryHitPoints: 2 })

		store.applyRest(character.id, { resourceUses: {}, spentSpellSlots: {}, spentHitDice: {} })
		expect(store.list()[0].familiar).toEqual({ name: 'Imp', source: 'XMM', currentHp: 3, temporaryHitPoints: 2 })

		store.applyRest(character.id, { resourceUses: {}, spentSpellSlots: {}, spentHitDice: {}, resetFamiliarHp: true })
		expect(store.list()[0].familiar).toEqual({ name: 'Imp', source: 'XMM' })
	})

	it('rejects a familiar hit-point field that is negative or not a whole number', () => {
		for (const bad of [{ currentHp: -1 }, { currentHp: 1.5 }, { temporaryHitPoints: -2 }, { currentHp: '3' }]) {
			const storage = new MemoryStorage()
			storage.setItem(STORAGE_KEY, JSON.stringify([{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Conjurer', classes: [], familiar: { name: 'Imp', source: 'XMM', ...bad } }]))
			expect(() => new CharacterStore(storage).list()).toThrow(CorruptDataError)
		}
	})

	it('replaces the Wild Shape forms, drops a class left with none, and clears the field when nothing remains (R11a)', () => {
		const store = new CharacterStore(new MemoryStorage())
		const character = store.create({ name: 'Shifter' })
		expect(character.wildShapeForms).toBeUndefined()

		const wolf = { name: 'Wolf', source: 'XMM' }
		const cat = { name: 'Cat', source: 'XMM' }
		store.setWildShapeForms(character.id, [{ className: 'Druid', classSource: 'XPHB', forms: [wolf, cat] }])
		expect(store.list()[0].wildShapeForms).toEqual([{ className: 'Druid', classSource: 'XPHB', forms: [wolf, cat] }])

		store.setWildShapeForms(character.id, [
			{ className: 'Druid', classSource: 'XPHB', forms: [cat] },
			{ className: 'Ranger', classSource: 'XPHB', forms: [] },
		])
		expect(store.list()[0].wildShapeForms).toEqual([{ className: 'Druid', classSource: 'XPHB', forms: [cat] }])

		store.setWildShapeForms(character.id, [{ className: 'Druid', classSource: 'XPHB', forms: [] }])
		expect('wildShapeForms' in store.list()[0]).toBe(false)
	})

	it('throws CharacterNotFoundError when setting Wild Shape forms on an unknown id', () => {
		const store = new CharacterStore(new MemoryStorage())
		expect(() => store.setWildShapeForms('nope', [])).toThrow(CharacterNotFoundError)
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

	it('keeps an inventory row whose quantity is 0 — the last arrow was spent (slice 9d3)', () => {
		const backing = new MemoryStorage()
		const store = new CharacterStore(backing)
		const character = store.create({ name: 'Aria' })
		store.setInventory(character.id, [{ name: 'Arrow', source: 'XPHB', quantity: 0 }])
		// A fresh store over the same backing storage — the validator has to accept what was written.
		expect(new CharacterStore(backing).list()[0].inventory).toEqual([{ name: 'Arrow', source: 'XPHB', quantity: 0 }])
	})

	it('rejects a saved inventory entry with a negative or fractional quantity, and a fractional currencyCopper', () => {
		for (const quantity of [-1, 1.5]) {
			const badQuantity = new MemoryStorage()
			badQuantity.setItem(
				STORAGE_KEY,
				JSON.stringify([
					{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Aria', classes: [], inventory: [{ name: 'Torch', source: 'XPHB', quantity }] },
				]),
			)
			expect(() => new CharacterStore(badQuantity).list()).toThrow(CorruptDataError)
		}

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
				bonuses: [
					{ target: 'armourClass' as const, amount: 1 },
					{ target: 'maxHitPoints' as const, amount: 1, perLevel: true as const },
					{ target: 'skill' as const, skill: 'stealth' as const, amount: 3 },
				],
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

	/* Slice 9b6: the targeted writer for spent hit dice, replacing only that field. */
	it('sets spent hit dice on their own, drops a 0 count, and leaves every other play field and the hit points alone', () => {
		const backing = new MemoryStorage()
		const store = new CharacterStore(backing)
		const character = store.create({ name: 'Aria', currentHp: 12, play: { resourceUses: { Rage: 1 } } })

		store.setSpentHitDice(character.id, { 'Fighter|XPHB': 2, 'Bard|XPHB': 0 })
		const after = new CharacterStore(backing).list()[0]
		expect(after.play).toEqual({ resourceUses: { Rage: 1 }, spentHitDice: { 'Fighter|XPHB': 2 } })
		expect(after.currentHp).toBe(12)

		store.setSpentHitDice(character.id, undefined)
		expect(new CharacterStore(backing).list()[0].play).toEqual({ resourceUses: { Rage: 1 } })
		expect(() => store.setSpentHitDice('missing', {})).toThrow()
	})

	/* Slice 9d1: the seventh play field, written on its own, replaced outright, and stored as absence when cleared. */
	it('sets, replaces and clears the concentration spell, and no other write disturbs it', () => {
		const backing = new MemoryStorage()
		const store = new CharacterStore(backing)
		const character = store.create({ name: 'Aria', currentHp: 20, play: { resourceUses: { Rage: 1 } } })

		store.setConcentration(character.id, { name: 'Bless', source: 'XPHB' })
		expect(new CharacterStore(backing).list()[0].play).toEqual({ resourceUses: { Rage: 1 }, concentratingOn: { name: 'Bless', source: 'XPHB' } })

		store.setConcentration(character.id, { name: 'Hex', source: 'XPHB' })
		expect(new CharacterStore(backing).list()[0].play?.concentratingOn).toEqual({ name: 'Hex', source: 'XPHB' })

		// Neither a hit-point write nor a rest is a reason to stop concentrating.
		store.setHitPoints(character.id, { currentHp: 12, temporaryHitPoints: 3 })
		store.applyRest(character.id, { currentHp: 39, resourceUses: {}, spentSpellSlots: {}, spentHitDice: {} })
		const afterWrites = new CharacterStore(backing).list()[0]
		expect(afterWrites.currentHp).toBe(39)
		expect(afterWrites.play).toEqual({ temporaryHitPoints: 3, concentratingOn: { name: 'Hex', source: 'XPHB' } })

		store.setConcentration(character.id, null)
		store.setHitPoints(character.id, { currentHp: 39 })
		const cleared = new CharacterStore(backing).list()[0]
		expect(cleared.play).toBeUndefined()
		expect('play' in cleared).toBe(false)
	})

	/* R4b (D167): a manual boolean; off is absence, so a character that never turned it on is byte-for-byte what it was. */
	it('turns Heroic Inspiration on and off, surviving a reload and every other play write', () => {
		const backing = new MemoryStorage()
		const store = new CharacterStore(backing)
		const character = store.create({ name: 'Aria', currentHp: 20 })
		expect(new CharacterStore(backing).list()[0].play?.heroicInspiration).toBeUndefined()

		store.setHeroicInspiration(character.id, true)
		expect(new CharacterStore(backing).list()[0].play).toEqual({ heroicInspiration: true })

		store.setConcentration(character.id, { name: 'Bless', source: 'XPHB' })
		store.setHitPoints(character.id, { currentHp: 12 })
		expect(new CharacterStore(backing).list()[0].play).toEqual({ heroicInspiration: true, concentratingOn: { name: 'Bless', source: 'XPHB' } })

		store.setHeroicInspiration(character.id, false)
		store.setConcentration(character.id, null)
		expect('play' in new CharacterStore(backing).list()[0]).toBe(false)
	})

	it('throws CharacterNotFoundError for an unknown id on a Heroic Inspiration write, and rejects a non-boolean stored value', () => {
		expect(() => new CharacterStore(new MemoryStorage()).setHeroicInspiration('nope', true)).toThrow(CharacterNotFoundError)

		const wrongType = new MemoryStorage()
		wrongType.setItem(STORAGE_KEY, JSON.stringify([{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Aria', classes: [], play: { heroicInspiration: 'yes' } }]))
		expect(() => new CharacterStore(wrongType).list()).toThrow(CorruptDataError)
	})

	/* R12 (D214): conditions and exhaustion follow the same absence convention as every play field. */
	it('stores conditions and exhaustion, surviving a reload and other play writes, and clears them to absence', () => {
		const backing = new MemoryStorage()
		const store = new CharacterStore(backing)
		const character = store.create({ name: 'Aria', currentHp: 20 })

		store.setConditions(character.id, ['Poisoned', 'Prone'])
		store.setExhaustion(character.id, 2)
		store.setHitPoints(character.id, { currentHp: 12 })
		expect(new CharacterStore(backing).list()[0].play).toEqual({ conditions: ['Poisoned', 'Prone'], exhaustion: 2 })

		store.setConditions(character.id, [])
		store.setExhaustion(character.id, 0)
		expect('play' in new CharacterStore(backing).list()[0]).toBe(false)
	})

	it('rejects unknown, repeated and Exhaustion names, and a bad exhaustion level, on write and on load', () => {
		const backing = new MemoryStorage()
		const store = new CharacterStore(backing)
		const { id } = store.create({ name: 'Aria', currentHp: 20 })
		expect(() => store.setConditions(id, ['Sleepy'])).toThrow()
		expect(() => store.setConditions(id, ['Prone', 'Prone'])).toThrow()
		expect(() => store.setConditions(id, ['Exhaustion'])).toThrow()
		for (const level of [-1, 7, 1.5]) expect(() => store.setExhaustion(id, level)).toThrow()
		expect(() => store.setConditions('nope', [])).toThrow(CharacterNotFoundError)
		expect(() => store.setExhaustion('nope', 1)).toThrow(CharacterNotFoundError)

		for (const play of [{ conditions: ['Sleepy'] }, { conditions: ['Prone', 'Prone'] }, { conditions: 'Prone' }, { exhaustion: 0 }, { exhaustion: 7 }, { exhaustion: 1.5 }, { exhaustion: '2' }]) {
			const stored = new MemoryStorage()
			stored.setItem(STORAGE_KEY, JSON.stringify([{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Aria', classes: [], play }]))
			expect(() => new CharacterStore(stored).list()).toThrow(CorruptDataError)
		}
	})

	it('lowers Exhaustion by one on a Long Rest write, drops it at 0, and leaves conditions alone', () => {
		const backing = new MemoryStorage()
		const store = new CharacterStore(backing)
		const { id } = store.create({ name: 'Aria', currentHp: 20 })
		store.setConditions(id, ['Poisoned'])
		store.setExhaustion(id, 2)

		store.applyRest(id, { currentHp: 20, resourceUses: {}, spentSpellSlots: {}, spentHitDice: {}, exhaustion: 1 })
		expect(new CharacterStore(backing).list()[0].play).toEqual({ conditions: ['Poisoned'], exhaustion: 1 })

		store.applyRest(id, { currentHp: 20, resourceUses: {}, spentSpellSlots: {}, spentHitDice: {} })
		expect(new CharacterStore(backing).list()[0].play).toEqual({ conditions: ['Poisoned'], exhaustion: 1 })

		store.applyRest(id, { currentHp: 20, resourceUses: {}, spentSpellSlots: {}, spentHitDice: {}, exhaustion: 0 })
		expect(new CharacterStore(backing).list()[0].play).toEqual({ conditions: ['Poisoned'] })
	})

	it('a Long Rest write clears Concentration; a Short Rest write leaves it (F-7b)', () => {
		const backing = new MemoryStorage()
		const store = new CharacterStore(backing)
		const { id } = store.create({ name: 'Aria', currentHp: 20 })
		store.setConcentration(id, { name: 'Bless', source: 'XPHB' })

		store.applyRest(id, { currentHp: 20, resourceUses: {}, spentSpellSlots: {}, spentHitDice: {} })
		expect(new CharacterStore(backing).list()[0].play?.concentratingOn).toEqual({ name: 'Bless', source: 'XPHB' })

		store.applyRest(id, { currentHp: 20, resourceUses: {}, spentSpellSlots: {}, spentHitDice: {}, concentratingOn: null })
		expect(new CharacterStore(backing).list()[0].play?.concentratingOn).toBeUndefined()
	})

	it('throws CharacterNotFoundError for an unknown id on a concentration write', () => {
		expect(() => new CharacterStore(new MemoryStorage()).setConcentration('nope', { name: 'Bless', source: 'XPHB' })).toThrow(CharacterNotFoundError)
	})

	it('reads a stored null concentration as none and drops a non-name value (D320)', () => {
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
		expect(new CharacterStore(wrongType).list()[0].play?.concentratingOn).toBeUndefined()
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
		const character = store.create({ name: 'Aria', currentHp: 9, play: { concentratingOn: { name: 'Bless', source: 'XPHB' } } })
		store.setText(character.id, 'appearance', 'Tall')
		store.setText(character.id, 'notes', 'Owes Cato 5 gp')

		store.setText(character.id, 'backstory', 'Orphan')
		store.setText(character.id, 'appearance', 'Short')

		const stored = new CharacterStore(backing).list()[0]
		expect(stored).toMatchObject({ appearance: 'Short', backstory: 'Orphan', notes: 'Owes Cato 5 gp', currentHp: 9, play: { concentratingOn: { name: 'Bless', source: 'XPHB' } } })
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

describe('stored granted feats (D156)', () => {
	const magicInitiate = {
		className: 'Cleric',
		classSource: 'XPHB',
		cantrips: [{ name: 'Guidance', source: 'XPHB' }],
		spell: { name: 'Bless', source: 'XPHB' },
	}
	const filterChoiceSpells = { cantrips: [], spells: [{ name: 'Charm Person', source: 'XPHB' }] }

	it('round-trips grantedFeats and the shared sub-choice fields through save, reload, export and import', () => {
		const backing = new MemoryStorage()
		const store = new CharacterStore(backing)
		const created = store.create({
			name: 'Aria',
			featAsiChoices: [{ level: 4, kind: 'feat', name: 'Fey-Touched', source: 'XPHB', chosenAbility: 'wisdom', filterChoiceSpells }],
			grantedFeats: [
				{ origin: 'background', name: 'Magic Initiate; Cleric', source: 'XPHB', chosenAbility: 'wisdom', magicInitiate },
				{ origin: 'species', name: 'Alert', source: 'XPHB' },
			],
		})

		const reloaded = new CharacterStore(backing).list()[0]
		expect(reloaded.grantedFeats).toEqual(created.grantedFeats)
		expect(reloaded.featAsiChoices).toEqual(created.featAsiChoices)

		const [imported] = new CharacterStore(new MemoryStorage()).import(store.exportCharacter(created.id))
		expect(imported.grantedFeats).toEqual(created.grantedFeats)
	})

	it('loads a save without the field unchanged, and stores an empty list as absence', () => {
		const backing = new MemoryStorage()
		const saved = { schemaVersion: 41, id: '1', name: 'Aria', classes: [], featAsiChoices: [{ level: 4, kind: 'feat', name: 'Alert', source: 'XPHB' }] }
		backing.setItem(STORAGE_KEY, JSON.stringify([saved]))
		const [loaded] = new CharacterStore(backing).list()
		expect(loaded).toEqual({ id: '1', name: 'Aria', classes: [], featAsiChoices: [{ level: 4, kind: 'feat', name: 'Alert', source: 'XPHB' }], levelOrder: [] })

		expect('grantedFeats' in new CharacterStore(new MemoryStorage()).create({ name: 'Cato', grantedFeats: [] })).toBe(false)
	})

	it('rejects a malformed entry, and a second entry for the same origin', () => {
		const bad = [
			[{ origin: 'class', name: 'Alert', source: 'XPHB' }],
			[{ origin: 'background', source: 'XPHB' }],
			[{ origin: 'background', name: 'Alert', source: 'XPHB', chosenAbility: 'luck' }],
			[
				{ origin: 'background', name: 'Alert', source: 'XPHB' },
				{ origin: 'background', name: 'Tough', source: 'XPHB' },
			],
		]
		for (const grantedFeats of bad) {
			const backing = new MemoryStorage()
			backing.setItem(STORAGE_KEY, JSON.stringify([{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Aria', classes: [], grantedFeats }]))
			expect(() => new CharacterStore(backing).list()).toThrow(CorruptDataError)
		}
	})
})

describe('manual feats (R13a, D215)', () => {
	it('loads several manual entries with sub-choices, but still rejects a bad one', () => {
		const grantedFeats = [
			{ origin: 'background', name: 'Alert', source: 'XPHB' },
			{ origin: 'manual', id: '0', name: 'Elemental Adept', source: 'XPHB', chosenAbility: 'intelligence' },
			{ origin: 'manual', id: '1', name: 'Elemental Adept', source: 'XPHB' },
		]
		const backing = new MemoryStorage()
		backing.setItem(STORAGE_KEY, JSON.stringify([{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Aria', classes: [], grantedFeats }]))
		expect(new CharacterStore(backing).list()[0].grantedFeats).toEqual(grantedFeats)

		for (const bad of [{ origin: 'manual', source: 'XPHB' }, { origin: 'manual', name: 'Tough', source: 'XPHB', chosenAbility: 'luck' }]) {
			const badBacking = new MemoryStorage()
			badBacking.setItem(STORAGE_KEY, JSON.stringify([{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Aria', classes: [], grantedFeats: [bad] }]))
			expect(() => new CharacterStore(badBacking).list()).toThrow(CorruptDataError)
		}
	})

	it('adds a repeatable feat twice and removes one of the two with what was stored on it', () => {
		const backing = new MemoryStorage()
		const store = new CharacterStore(backing)
		const { id } = store.create({ name: 'Aria', grantedFeats: [{ origin: 'background', name: 'Alert', source: 'XPHB' }] })
		store.addManualFeat(id, { name: 'Elemental Adept', source: 'XPHB' })
		store.addManualFeat(id, { name: 'Elemental Adept', source: 'XPHB' })
		store.addManualFeat(id, { name: 'Tough', source: 'XPHB' })
		expect(store.list()[0].grantedFeats).toHaveLength(4)
		const [, first, second, third] = store.list()[0].grantedFeats!

		store.removeManualFeat(id, `manual:${first.id}`)
		expect(new CharacterStore(backing).list()[0].grantedFeats).toEqual([
			{ origin: 'background', name: 'Alert', source: 'XPHB' },
			{ origin: 'manual', id: second.id, name: 'Elemental Adept', source: 'XPHB' },
			{ origin: 'manual', id: third.id, name: 'Tough', source: 'XPHB' },
		])

		store.removeManualFeat(id, `manual:${third.id}`)
		store.removeManualFeat(id, `manual:${second.id}`)
		expect(store.list()[0].grantedFeats).toEqual([{ origin: 'background', name: 'Alert', source: 'XPHB' }])
	})

	it('drops the field when the last entry goes, and refuses a key that is not a manual one', () => {
		const store = new CharacterStore(new MemoryStorage())
		const { id } = store.create({ name: 'Aria' })
		store.addManualFeat(id, { name: 'Tough', source: 'XPHB' })
		store.removeManualFeat(id, `manual:${store.list()[0].grantedFeats![0].id}`)
		expect('grantedFeats' in store.list()[0]).toBe(false)
		expect(() => store.removeManualFeat(id, 'asi:4')).toThrow()
		expect(() => store.addManualFeat('nope', { name: 'Tough', source: 'XPHB' })).toThrow(CharacterNotFoundError)
	})
})

describe('editing feat choices and ASI increases (R13b, D215)', () => {
	it("replaces an asi:N feat choice's sub-choices, keeping its name/source", () => {
		const store = new CharacterStore(new MemoryStorage())
		const { id } = store.create({ name: 'Aria', featAsiChoices: [{ level: 4, kind: 'feat', name: 'Skilled', source: 'XPHB' }] })
		store.setFeatChoiceDetails(id, 'asi:4', { name: 'Skilled', source: 'XPHB' }, { proficiencies: { skills: ['arcana'] } })
		expect(store.list()[0].featAsiChoices).toEqual([{ level: 4, kind: 'feat', name: 'Skilled', source: 'XPHB', proficiencies: { skills: ['arcana'] } }])
	})

	it('creates a background grantedFeats entry when none names the feat yet, and replaces it on a second edit', () => {
		const store = new CharacterStore(new MemoryStorage())
		const { id } = store.create({ name: 'Aria' })
		store.setFeatChoiceDetails(id, 'background', { name: 'Magic Initiate; Cleric', source: 'XPHB' }, { chosenAbility: 'wisdom' })
		expect(store.list()[0].grantedFeats).toEqual([{ origin: 'background', name: 'Magic Initiate; Cleric', source: 'XPHB', chosenAbility: 'wisdom' }])

		store.setFeatChoiceDetails(id, 'background', { name: 'Magic Initiate; Cleric', source: 'XPHB' }, { chosenAbility: 'intelligence' })
		expect(store.list()[0].grantedFeats).toEqual([{ origin: 'background', name: 'Magic Initiate; Cleric', source: 'XPHB', chosenAbility: 'intelligence' }])
	})

	it("replaces a manual:n feat's sub-choices, keeping its name/source", () => {
		const store = new CharacterStore(new MemoryStorage())
		const { id } = store.create({ name: 'Aria' })
		store.addManualFeat(id, { name: 'Skilled', source: 'XPHB' })
		const featId = store.list()[0].grantedFeats![0].id
		store.setFeatChoiceDetails(id, `manual:${featId}`, { name: 'Skilled', source: 'XPHB' }, { proficiencies: { skills: ['arcana', 'history', 'nature'] } })
		expect(store.list()[0].grantedFeats).toEqual([{ origin: 'manual', id: featId, name: 'Skilled', source: 'XPHB', proficiencies: { skills: ['arcana', 'history', 'nature'] } }])
	})

	it("writes an item:row:n feat's sub-choices into that row's custom.feats (R14c1)", () => {
		const store = new CharacterStore(new MemoryStorage())
		const { id } = store.create({ name: 'Aria' })
		const custom = { name: 'Ring', kind: 'worn' as const, feats: [{ name: 'Tough', source: 'XPHB' }, { name: 'Skilled', source: 'XPHB' }] }
		store.setInventory(id, [{ name: 'Rope', source: 'XPHB', quantity: 1 }, { name: 'Ring', source: 'custom', quantity: 1, custom }])
		store.setFeatChoiceDetails(id, 'item:1:1', { name: 'Skilled', source: 'XPHB' }, { proficiencies: { skills: ['arcana'] } })
		expect(store.list()[0].inventory?.[1].custom?.feats).toEqual([{ name: 'Tough', source: 'XPHB' }, { name: 'Skilled', source: 'XPHB', proficiencies: { skills: ['arcana'] } }])
		expect(() => store.setFeatChoiceDetails(id, 'item:1:0', { name: 'Skilled', source: 'XPHB' }, {})).toThrow()
	})

	it('refuses a key that names no feat instance', () => {
		const store = new CharacterStore(new MemoryStorage())
		const { id } = store.create({ name: 'Aria' })
		expect(() => store.setFeatChoiceDetails(id, 'species', { name: 'Tough', source: 'XPHB' }, {})).toThrow()
		expect(() => store.setFeatChoiceDetails(id, 'asi:4', { name: 'Tough', source: 'XPHB' }, {})).toThrow()
		expect(() => store.setFeatChoiceDetails(id, 'manual:0', { name: 'Tough', source: 'XPHB' }, {})).toThrow()
	})

	it("replaces an ASI level's increases", () => {
		const store = new CharacterStore(new MemoryStorage())
		const { id } = store.create({ name: 'Aria', featAsiChoices: [{ level: 4, kind: 'asi', increases: { strength: 2 } }] })
		store.setAsiIncreases(id, 4, { strength: 1, dexterity: 1 })
		expect(store.list()[0].featAsiChoices).toEqual([{ level: 4, kind: 'asi', increases: { strength: 1, dexterity: 1 } }])

		store.setAsiIncreases(id, 4, { constitution: 2 })
		expect(store.list()[0].featAsiChoices).toEqual([{ level: 4, kind: 'asi', increases: { constitution: 2 } }])
	})

	it('rejects an invalid or incomplete increase shape, and a level with no ASI choice', () => {
		const store = new CharacterStore(new MemoryStorage())
		const { id } = store.create({ name: 'Aria', featAsiChoices: [{ level: 4, kind: 'asi', increases: { strength: 2 } }] })
		expect(() => store.setAsiIncreases(id, 4, { strength: 3 })).toThrow()
		expect(() => store.setAsiIncreases(id, 4, { strength: 1, dexterity: 1, constitution: 1 })).toThrow()
		// The schema has no "empty" state for a stored 'asi' choice — an in-progress pick (mode switched, nothing chosen yet) is refused, not persisted.
		expect(() => store.setAsiIncreases(id, 4, {})).toThrow()
		expect(() => store.setAsiIncreases(id, 4, { strength: 1 })).toThrow()
		expect(() => store.setAsiIncreases(id, 8, { strength: 2 })).toThrow()
	})
})

describe('background origin-feat override (D205)', () => {
	const background = { name: 'Spirit Medium', source: 'RHW', skillProficiencies: ['arcana', 'religion'], toolProficiency: 'Calligrapher’s Supplies' }

	it('round-trips the override through save and reload', () => {
		const backing = new MemoryStorage()
		new CharacterStore(backing).create({ name: 'Aria', background: { ...background, skillProficiencies: ['arcana', 'religion'], originFeatOverride: { name: 'Gathered Whispers', source: 'RHW' } } })
		expect(new CharacterStore(backing).list()[0].background?.originFeatOverride).toEqual({ name: 'Gathered Whispers', source: 'RHW' })
	})

	it('rejects an override without a name or source', () => {
		for (const originFeatOverride of [{ name: 'Gathered Whispers' }, 'Gathered Whispers', { name: '', source: 'RHW' }]) {
			const backing = new MemoryStorage()
			backing.setItem(STORAGE_KEY, JSON.stringify([{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Aria', classes: [], background: { ...background, originFeatOverride } }]))
			expect(() => new CharacterStore(backing).list()).toThrow(CorruptDataError)
		}
	})
})

describe('stored feat proficiency picks (task A2)', () => {
	it('round-trips proficiencies through save, reload, export and import, and migrates a version-42 save', () => {
		const backing = new MemoryStorage()
		const store = new CharacterStore(backing)
		const created = store.create({
			name: 'Aria',
			featAsiChoices: [
				{
					level: 4,
					kind: 'feat',
					name: 'Keen Mind',
					source: 'XPHB',
					proficiencies: { skills: ['history'] },
				},
			],
			grantedFeats: [
				{
					origin: 'background',
					name: 'Skilled',
					source: 'XPHB',
					proficiencies: { skills: ['persuasion', 'insight'], tools: ['Gaming Set (Dice)'], languages: [{ name: 'Elvish', source: 'XPHB' }], expertise: ['persuasion'] },
				},
			],
		})

		const reloaded = new CharacterStore(backing).list()[0]
		expect(reloaded.grantedFeats).toEqual(created.grantedFeats)
		expect(reloaded.featAsiChoices).toEqual(created.featAsiChoices)

		const [imported] = new CharacterStore(new MemoryStorage()).import(store.exportCharacter(created.id))
		expect(imported.grantedFeats).toEqual(created.grantedFeats)

		const v42 = { schemaVersion: 42, id: '2', name: 'Bram', classes: [], featAsiChoices: [{ level: 4, kind: 'feat', name: 'Alert', source: 'XPHB' }] }
		const migratedBacking = new MemoryStorage()
		migratedBacking.setItem(STORAGE_KEY, JSON.stringify([v42]))
		const [migrated] = new CharacterStore(migratedBacking).list()
		expect(migrated).toEqual({ id: '2', name: 'Bram', classes: [], featAsiChoices: [{ level: 4, kind: 'feat', name: 'Alert', source: 'XPHB' }], levelOrder: [] })
	})

	it('rejects a malformed proficiencies field', () => {
		const bad = [
			{ skills: 'history' },
			{ tools: [1] },
			{ expertise: [true] },
			{ languages: [{ name: 'Elvish' }] },
		]
		for (const proficiencies of bad) {
			const backing = new MemoryStorage()
			const featAsiChoices = [{ level: 4, kind: 'feat', name: 'Keen Mind', source: 'XPHB', proficiencies }]
			backing.setItem(STORAGE_KEY, JSON.stringify([{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Aria', classes: [], featAsiChoices }]))
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

	describe('M0 multiclass import checks (D316)', () => {
		const klass = (className: string, level: number) => ({ className, classSource: 'XPHB', subclass: null, level })
		const file = (classes: unknown[]) => JSON.stringify([{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Aria', classes }])

		it('rejects levels adding up to 21 and leaves the store unchanged', () => {
			const store = new CharacterStore(new MemoryStorage())
			store.create({ name: 'Existing' })
			expect(() => store.import(file([klass('Warlock', 12), klass('Sorcerer', 9)]))).toThrow(
				'That file could not be imported: Entry [0] classes add up to level 21, the maximum is 20.',
			)
			expect(store.list()).toHaveLength(1)
		})

		it('rejects the same class twice', () => {
			const store = new CharacterStore(new MemoryStorage())
			expect(() => store.import(file([klass('Wizard', 2), klass('Wizard', 3)]))).toThrow('has the class Wizard (XPHB) twice.')
		})

		it('accepts a valid Warlock 6 / Sorcerer 3 file', () => {
			const store = new CharacterStore(new MemoryStorage())
			expect(store.import(file([klass('Warlock', 6), klass('Sorcerer', 3)]))).toHaveLength(1)
		})

		it('still lists a stored 2-class character whose levels add up to 21', () => {
			const storage = new MemoryStorage()
			storage.setItem(STORAGE_KEY, file([klass('Warlock', 12), klass('Sorcerer', 9)]))
			expect(new CharacterStore(storage).list()[0]?.classes).toHaveLength(2)
		})
	})

	it('throws StorageFullError when the destination storage is full', () => {
		const source = new CharacterStore(new MemoryStorage())
		const original = source.create({ name: 'Aria' })
		const file = source.exportCharacter(original.id)

		const store = new CharacterStore(new FullStorage())
		expect(() => store.import(file)).toThrow(StorageFullError)
	})
})

describe('Character.portrait (W-8)', () => {
	const PORTRAIT = 'data:image/jpeg;base64,/9j/AAAA'

	it('round-trips through export and import', () => {
		const source = new CharacterStore(new MemoryStorage())
		const original = source.create({ name: 'Aria', portrait: PORTRAIT })
		const destination = new CharacterStore(new MemoryStorage())
		const [imported] = destination.import(source.exportCharacter(original.id))
		expect(imported?.portrait).toBe(PORTRAIT)
		expect(destination.list()[0].portrait).toBe(PORTRAIT)
	})

	it.each([
		['a PNG data URL', 'data:image/png;base64,AAAA'],
		['a number', 7],
		['an oversized string', `data:image/jpeg;base64,${'A'.repeat(200_000)}`],
	])('rejects an import file whose portrait is %s, naming the problem, and leaves the store unchanged', (_label, portrait) => {
		const store = new CharacterStore(new MemoryStorage())
		store.create({ name: 'Existing' })
		const file = JSON.stringify([{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Aria', classes: [], portrait }])
		expect(() => store.import(file)).toThrow(ImportValidationError)
		expect(() => store.import(file)).toThrow(/portrait must be a JPEG data URL/)
		expect(store.list()).toHaveLength(1)
	})

	it('the length cap is inclusive: exactly PORTRAIT_MAX_LENGTH characters is stored, one more is refused', () => {
		const store = new CharacterStore(new MemoryStorage())
		const { id } = store.create({ name: 'Aria' })
		const ofLength = (length: number) => PORTRAIT_PREFIX + 'A'.repeat(length - PORTRAIT_PREFIX.length)
		store.setPortrait(id, ofLength(PORTRAIT_MAX_LENGTH))
		expect(store.list()[0].portrait).toHaveLength(PORTRAIT_MAX_LENGTH)
		expect(() => store.setPortrait(id, ofLength(PORTRAIT_MAX_LENGTH + 1))).toThrow(ImportValidationError)
		expect(store.list()[0].portrait).toHaveLength(PORTRAIT_MAX_LENGTH)
		const file = JSON.stringify([{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Bran', classes: [], portrait: ofLength(PORTRAIT_MAX_LENGTH) }])
		expect(store.import(file)).toHaveLength(1)
	})

	it('drops a malformed stored portrait on read instead of failing the whole list', () => {
		const backing = new MemoryStorage()
		backing.setItem(
			STORAGE_KEY,
			JSON.stringify([
				{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Aria', classes: [], portrait: 'not an image' },
				{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '2', name: 'Bran', classes: [], portrait: PORTRAIT },
			]),
		)
		const characters = new CharacterStore(backing).list()
		expect(characters.map((character) => character.name)).toEqual(['Aria', 'Bran'])
		expect('portrait' in characters[0]).toBe(false)
		expect(characters[1].portrait).toBe(PORTRAIT)
	})

	it('F-5: drops a malformed stored speciesCantrip on read; Import still refuses it', () => {
		const backing = new MemoryStorage()
		const fire = { name: 'Fire Bolt', source: 'XPHB' }
		backing.setItem(
			STORAGE_KEY,
			JSON.stringify([
				{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Aria', classes: [], speciesCantrip: { name: '' } },
				{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '2', name: 'Bran', classes: [], speciesCantrip: fire },
			]),
		)
		const store = new CharacterStore(backing)
		const characters = store.list()
		expect(characters.map((character) => character.name)).toEqual(['Aria', 'Bran'])
		expect('speciesCantrip' in characters[0]).toBe(false)
		expect(characters[1].speciesCantrip).toEqual(fire)
		const file = JSON.stringify([{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '3', name: 'Cora', classes: [], speciesCantrip: 'Fire Bolt' }])
		expect(() => store.import(file)).toThrow(/speciesCantrip must be an object/)
	})

	it('setPortrait sets, replaces and removes it; a malformed one is refused before anything is written', () => {
		const store = new CharacterStore(new MemoryStorage())
		const { id } = store.create({ name: 'Aria' })
		store.setPortrait(id, PORTRAIT)
		expect(store.list()[0].portrait).toBe(PORTRAIT)
		expect(() => store.setPortrait(id, 'data:image/png;base64,AAAA')).toThrow(ImportValidationError)
		expect(store.list()[0].portrait).toBe(PORTRAIT)
		store.setPortrait(id, null)
		expect('portrait' in store.list()[0]).toBe(false)
	})

	it('create and update refuse a malformed portrait', () => {
		const store = new CharacterStore(new MemoryStorage())
		expect(() => store.create({ name: 'Aria', portrait: 'nope' })).toThrow(/portrait could not be saved/)
		const { id } = store.create({ name: 'Aria', portrait: PORTRAIT })
		expect(() => store.update(id, { name: 'Aria', portrait: 'nope' })).toThrow(ImportValidationError)
		expect(store.list()[0].portrait).toBe(PORTRAIT)
	})

	it('a full storage keeps the previous portrait', () => {
		const backing = new MemoryStorage()
		const store = new CharacterStore(backing)
		const { id } = store.create({ name: 'Aria', portrait: PORTRAIT })
		backing.setItem = () => {
			throw new DOMException('quota exceeded', 'QuotaExceededError')
		}
		expect(() => store.setPortrait(id, 'data:image/jpeg;base64,BBBB')).toThrow(StorageFullError)
		expect(store.list()[0].portrait).toBe(PORTRAIT)
	})
})

describe('Character.speciesCantrip (S2)', () => {
	const HIGH_ELF = { name: 'Elf; High Elf Lineage', source: 'XPHB' }
	const FIRE_BOLT = { name: 'Fire Bolt', source: 'XPHB' }

	it('round-trips through create, export and import', () => {
		const source = new CharacterStore(new MemoryStorage())
		const original = source.create({ name: 'Aria', species: HIGH_ELF, speciesCantrip: FIRE_BOLT })
		expect(source.list()[0].speciesCantrip).toEqual(FIRE_BOLT)
		const destination = new CharacterStore(new MemoryStorage())
		const [imported] = destination.import(source.exportCharacter(original.id))
		expect(imported?.speciesCantrip).toEqual(FIRE_BOLT)
	})

	it('imports a version-55 High Elf without the field', () => {
		const store = new CharacterStore(new MemoryStorage())
		const [imported] = store.import(JSON.stringify([{ schemaVersion: 55, id: '1', name: 'Aria', classes: [], species: HIGH_ELF }]))
		expect(imported?.species).toEqual(HIGH_ELF)
		expect('speciesCantrip' in imported!).toBe(false)
	})

	it.each([
		['a string', 'Fire Bolt'],
		['an object without a source', { name: 'Fire Bolt' }],
		['an empty name', { name: '', source: 'XPHB' }],
	])('rejects an import file whose speciesCantrip is %s and leaves the store unchanged', (_label, speciesCantrip) => {
		const store = new CharacterStore(new MemoryStorage())
		store.create({ name: 'Existing' })
		const file = JSON.stringify([{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Aria', classes: [], species: HIGH_ELF, speciesCantrip }])
		expect(() => store.import(file)).toThrow(/speciesCantrip must be an object/)
		expect(store.list()).toHaveLength(1)
	})
})

describe('Character.levelOrder (M1a, D317)', () => {
	const FIGHTER = { className: 'Fighter', classSource: 'XPHB' }
	const WIZARD = { className: 'Wizard', classSource: 'XPHB' }
	const fighter = (level: number) => ({ ...FIGHTER, subclass: level >= 3 ? 'Battle Master' : null, level })

	/** A realistic schema-56 level-5 Fighter, every field in the shape toCharacter keeps verbatim. */
	function schema56Fighter() {
		return {
			schemaVersion: 56,
			id: 'f1',
			name: 'Aria',
			classes: [fighter(5)],
			abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 } },
			species: { name: 'Elf', source: 'XPHB' },
			background: { name: 'Soldier', source: 'XPHB', skillProficiencies: ['athletics', 'intimidation'], toolProficiency: 'Dice Set' },
			abilityBonus: { strength: 2, constitution: 1 },
			languages: [
				{ name: 'Common', source: 'XPHB', grantedBy: 'automatic' },
				{ name: 'Draconic', source: 'XPHB', grantedBy: 'creation' },
			],
			classSkills: ['acrobatics', 'survival'],
			masteries: [{ name: 'Longsword', level: 4 }, { name: 'Greataxe' }],
			expertiseSkills: [{ name: 'acrobatics', level: 3 }],
			fightingStyle: 'Archery',
			optionalFeatureChoices: [{ featureType: 'MV:B', choices: [{ name: 'Precision Attack', level: 3 }, { name: 'Riposte' }] }],
			speciesSkills: ['perception'],
			featAsiChoices: [{ level: 4, kind: 'feat', name: 'Alert', source: 'XPHB' }],
			spellChoices: [{ className: 'Fighter', classSource: 'XPHB', spells: [{ name: 'Fire Bolt', source: 'XPHB' }] }],
			hitPointLevels: [
				{ level: 2, kind: 'average', dieResult: 6 },
				{ level: 3, kind: 'roll', dieResult: 4 },
				{ level: 4, kind: 'average', dieResult: 6 },
				{ level: 5, kind: 'manual', dieResult: 10 },
			],
			inventory: [{ name: 'Longsword', source: 'XPHB', quantity: 1 }],
			currencyCopper: 500,
			currentHp: 30,
			createdAtLevel: 1,
			notes: 'Owes the guild 10 gp.',
		}
	}

	function storeWith(records: unknown[]): CharacterStore {
		const backing = new MemoryStorage()
		backing.setItem(STORAGE_KEY, JSON.stringify(records))
		return new CharacterStore(backing)
	}

	it('a full schema-56 single-class character loads exactly as before, plus its level history', () => {
		const { schemaVersion: _v, fightingStyle, ...before } = schema56Fighter()
		const [loaded] = storeWith([schema56Fighter()]).list()
		expect(loaded).toEqual({ ...before, fightingStyles: [{ ...FIGHTER, name: fightingStyle }], levelOrder: [FIGHTER, FIGHTER, FIGHTER, FIGHTER, FIGHTER] })
	})

	it.each([
		['too short', [FIGHTER, FIGHTER]],
		['the wrong class', [FIGHTER, FIGHTER, FIGHTER, FIGHTER, WIZARD]],
		['not an array', 'Fighter'],
		['an entry without a source', [FIGHTER, FIGHTER, FIGHTER, FIGHTER, { className: 'Fighter' }]],
	])('drops a stored history that is %s, and the list still loads', (_label, levelOrder) => {
		const other = { schemaVersion: CURRENT_SCHEMA_VERSION, id: 'o1', name: 'Bram', classes: [], levelOrder: [] }
		const list = storeWith([{ ...schema56Fighter(), schemaVersion: CURRENT_SCHEMA_VERSION, levelOrder }, other]).list()
		expect(list).toHaveLength(2)
		expect('levelOrder' in list[0]).toBe(false)
		expect(list[0].classes).toEqual([fighter(5)])
		expect(list[1].levelOrder).toEqual([])
	})

	it('keeps a consistent multiclass history in any order', () => {
		const record = { schemaVersion: CURRENT_SCHEMA_VERSION, id: 'm1', name: 'Cato', classes: [fighter(2), { ...WIZARD, subclass: null, level: 1 }], levelOrder: [FIGHTER, WIZARD, FIGHTER] }
		expect(storeWith([record]).list()[0].levelOrder).toEqual([FIGHTER, WIZARD, FIGHTER])
	})

	it('imports a file with a bad history without it, and the import still succeeds', () => {
		const store = new CharacterStore(new MemoryStorage())
		const [imported] = store.import(JSON.stringify([{ ...schema56Fighter(), schemaVersion: CURRENT_SCHEMA_VERSION, levelOrder: [WIZARD] }]))
		expect(imported.name).toBe('Aria')
		expect('levelOrder' in imported).toBe(false)
		expect('levelOrder' in store.list()[0]).toBe(false)
	})

	it('export then import keeps it', () => {
		const source = new CharacterStore(new MemoryStorage())
		const created = source.create({ name: 'Aria', classes: [fighter(2)], levelOrder: [FIGHTER, FIGHTER] })
		expect(source.exportCharacter(created.id)).toContain('"levelOrder"')
		const [imported] = new CharacterStore(new MemoryStorage()).import(source.exportCharacter(created.id))
		expect(imported.levelOrder).toEqual([FIGHTER, FIGHTER])
	})

	it('a write never stores an inconsistent history', () => {
		const store = new CharacterStore(new MemoryStorage())
		expect('levelOrder' in store.create({ name: 'Aria', classes: [fighter(2)], levelOrder: [FIGHTER] })).toBe(false)
	})
})

describe('fightingStyles and option sources (M1b, D318)', () => {
	const FIGHTER = { className: 'Fighter', classSource: 'XPHB' }
	const PALADIN = { className: 'Paladin', classSource: 'XPHB' }

	function storeWith(records: unknown[]): CharacterStore {
		const backing = new MemoryStorage()
		backing.setItem(STORAGE_KEY, JSON.stringify(records))
		return new CharacterStore(backing)
	}

	/** Realistic schema-57 saves: every field in the shape toCharacter keeps verbatim. */
	function schema57Fighter() {
		return {
			schemaVersion: 57,
			id: 'f5',
			name: 'Aria',
			classes: [{ ...FIGHTER, subclass: 'Champion', level: 5 }],
			abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 } },
			species: { name: 'Elf', source: 'XPHB' },
			background: { name: 'Soldier', source: 'XPHB', skillProficiencies: ['athletics', 'intimidation'], toolProficiency: 'Dice Set' },
			abilityBonus: { strength: 2, constitution: 1 },
			classSkills: ['acrobatics', 'survival'],
			masteries: [{ name: 'Longsword', level: 4 }, { name: 'Greataxe' }],
			fightingStyle: 'Archery',
			featAsiChoices: [{ level: 4, kind: 'feat', name: 'Alert', source: 'XPHB' }],
			hitPointLevels: [2, 3, 4, 5].map((level) => ({ level, kind: 'average', dieResult: 6 })),
			currentHp: 30,
			createdAtLevel: 1,
			levelOrder: [FIGHTER, FIGHTER, FIGHTER, FIGHTER, FIGHTER],
		}
	}

	function schema57BattleMaster() {
		return {
			schemaVersion: 57,
			id: 'bm3',
			name: 'Brakka',
			classes: [{ ...FIGHTER, subclass: 'Battle Master', level: 3 }],
			classSkills: ['athletics', 'perception'],
			masteries: [{ name: 'Longsword' }],
			fightingStyle: 'Defense',
			optionalFeatureChoices: [{ featureType: 'MV:B', choices: [{ name: 'Trip Attack' }, { name: 'Riposte', level: 3 }, { name: 'Parry', level: 3 }] }],
			toolChoices: [{ grantedBy: 'battleMaster', name: "Smith's Tools" }],
			levelOrder: [FIGHTER, FIGHTER, FIGHTER],
		}
	}

	it('a schema-57 Fighter 5 with a style loads as before, the style now tagged with its class', () => {
		const { schemaVersion: _v, fightingStyle, ...before } = schema57Fighter()
		const [loaded] = storeWith([schema57Fighter()]).list()
		expect(loaded).toEqual({ ...before, fightingStyles: [{ ...FIGHTER, name: fightingStyle }] })
	})

	it('a schema-57 Battle Master 3 keeps every maneuver exactly, with no source invented', () => {
		const { schemaVersion: _v, fightingStyle, ...before } = schema57BattleMaster()
		const [loaded] = storeWith([schema57BattleMaster()]).list()
		expect(loaded).toEqual({ ...before, fightingStyles: [{ ...FIGHTER, name: fightingStyle }] })
		expect(loaded.optionalFeatureChoices![0].choices.every((choice) => !('source' in choice))).toBe(true)
	})

	it('saves and reloads styles for two classes and picks with a source', () => {
		const store = new CharacterStore(new MemoryStorage())
		const fightingStyles = [
			{ ...FIGHTER, name: 'Archery', source: 'XPHB' },
			{ ...PALADIN, name: 'Defense', source: 'XPHB' },
		]
		const optionalFeatureChoices = [{ featureType: 'MV:B', choices: [{ name: 'Trip Attack', level: 3, source: 'XPHB' }, { name: 'Riposte' }] }]
		const created = store.create({ name: 'Aria', classes: [{ ...FIGHTER, subclass: null, level: 1 }, { ...PALADIN, subclass: null, level: 2 }], fightingStyles, optionalFeatureChoices })
		expect(store.list()).toEqual([created])
		expect(created.fightingStyles).toEqual(fightingStyles)
		expect(created.optionalFeatureChoices).toEqual(optionalFeatureChoices)
	})

	it('export then import keeps class, source and pick sources', () => {
		const source = new CharacterStore(new MemoryStorage())
		const created = source.create({
			name: 'Aria',
			classes: [{ ...FIGHTER, subclass: 'Battle Master', level: 3 }],
			fightingStyles: [{ ...FIGHTER, name: 'Archery', source: 'XPHB' }],
			optionalFeatureChoices: [{ featureType: 'MV:B', choices: [{ name: 'Trip Attack', source: 'XPHB' }] }],
		})
		const [imported] = new CharacterStore(new MemoryStorage()).import(source.exportCharacter(created.id))
		expect(imported.fightingStyles).toEqual(created.fightingStyles)
		expect(imported.optionalFeatureChoices).toEqual(created.optionalFeatureChoices)
	})

	it('imports a schema-57 file through the migration', () => {
		const [imported] = new CharacterStore(new MemoryStorage()).import(JSON.stringify([schema57BattleMaster()]))
		expect(imported.fightingStyles).toEqual([{ ...FIGHTER, name: 'Defense' }])
	})

	it('rejects stored fightingStyles that are not an array, as the old field was', () => {
		expect(() => storeWith([{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Aria', classes: [], fightingStyles: 'Archery' }]).list()).toThrow(CorruptDataError)
	})

	// D320: a bad entry in a stored list is repaired on read, not fatal.
	it.each([
		['an entry without a name', [{ ...FIGHTER }], []],
		['a class without its source', [{ className: 'Fighter', name: 'Archery' }], []],
		['an empty source', [{ ...FIGHTER, name: 'Archery', source: '' }], []],
		['two entries for one class', [{ ...FIGHTER, name: 'Archery' }, { ...FIGHTER, name: 'Defense' }], [{ ...FIGHTER, name: 'Archery' }]],
		['two unassigned entries', [{ name: 'Archery' }, { name: 'Defense' }], [{ name: 'Archery' }]],
	])('repairs stored fightingStyles that are %s', (_label, fightingStyles, expected) => {
		const [loaded] = storeWith([{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Aria', classes: [], fightingStyles }]).list()
		expect(loaded.fightingStyles ?? []).toEqual(expected)
	})

	it('rejects a schema-57 save whose old style is malformed, as before', () => {
		expect(() => storeWith([{ schemaVersion: 57, id: '1', name: 'Aria', classes: [], fightingStyle: 5 }]).list()).toThrow(CorruptDataError)
	})

	it('rejects a pick whose source is not a non-empty string', () => {
		const optionalFeatureChoices = [{ featureType: 'MV:B', choices: [{ name: 'Trip Attack', source: 7 }] }]
		expect(() => storeWith([{ schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Aria', classes: [], optionalFeatureChoices }]).list()).toThrow(CorruptDataError)
	})

	it('drops unknown extra keys on a style and a pick, as every other nested field does', () => {
		const [loaded] = storeWith([
			{
				schemaVersion: CURRENT_SCHEMA_VERSION,
				id: '1',
				name: 'Aria',
				classes: [],
				fightingStyles: [{ name: 'Archery', note: 'x' }],
				optionalFeatureChoices: [{ featureType: 'MV:B', choices: [{ name: 'Trip Attack', source: 'XPHB', extra: true }] }],
			},
		]).list()
		expect(loaded.fightingStyles).toEqual([{ name: 'Archery' }])
		expect(loaded.optionalFeatureChoices).toEqual([{ featureType: 'MV:B', choices: [{ name: 'Trip Attack', source: 'XPHB' }] }])
	})

	it('a write never stores two styles for one class', () => {
		const store = new CharacterStore(new MemoryStorage())
		expect(() => store.create({ name: 'Aria', fightingStyles: [{ ...FIGHTER, name: 'Archery' }, { ...FIGHTER, name: 'Defense' }] })).toThrow(ImportValidationError)
		expect(store.list()).toEqual([])
	})
})

describe('concentration source and stable manual feat ids (M1c, D319)', () => {
	const initiate = (className: string, spell: string) => ({ className, classSource: 'XPHB', cantrips: [], spell: { name: spell, source: 'XPHB' } })
	const SLEEP_KEY = (n: string) => `spell:feat:Magic Initiate#manual:${n}:sleep|XPHB`
	const BLESS_KEY = (n: string) => `spell:feat:Magic Initiate#manual:${n}:bless|XPHB`
	const v58 = {
		schemaVersion: 58,
		id: 'm1c',
		name: 'Aria',
		classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 4 }],
		levelOrder: Array.from({ length: 4 }, () => ({ className: 'Fighter', classSource: 'XPHB' })),
		grantedFeats: [
			{ origin: 'background', name: 'Alert', source: 'XPHB' },
			{ origin: 'manual', name: 'Magic Initiate', source: 'XPHB', chosenAbility: 'intelligence', magicInitiate: initiate('Wizard', 'Sleep') },
			{ origin: 'manual', name: 'Magic Initiate', source: 'XPHB', chosenAbility: 'wisdom', magicInitiate: initiate('Cleric', 'Bless') },
		],
		play: { concentratingOn: 'Bless', resourceUses: { [SLEEP_KEY('0')]: 1, [BLESS_KEY('1')]: 1, Rage: 2 } },
	}

	function seeded(): { backing: MemoryStorage; store: CharacterStore } {
		const backing = new MemoryStorage()
		backing.setItem(STORAGE_KEY, JSON.stringify([v58]))
		return { backing, store: new CharacterStore(backing) }
	}

	it('a schema-58 character loads with the same resourceUses keys, instance keys and remaining uses', () => {
		const [loaded] = seeded().store.list()
		expect(loaded.play).toEqual({ concentratingOn: { name: 'Bless' }, resourceUses: v58.play.resourceUses })
		expect(loaded.grantedFeats?.map((entry) => entry.id)).toEqual([undefined, '0', '1'])
		expect(featInstances(loaded, null).map((instance) => instance.key)).toEqual(['manual:0', 'manual:1'])
		for (const [instanceKey, spell] of [['manual:0', 'Sleep'], ['manual:1', 'Bless']] as const) {
			const counter = freeCastCounter({ name: spell, source: 'XPHB' }, { origin: 'feat', originName: 'Magic Initiate', usage: { kind: 'onceFreePerLongRest' }, instanceKey })
			expect(remainingUses(1, loaded.play?.resourceUses?.[counter!.key] ?? 0)).toBe(0)
		}
	})

	it('removing the first manual feat keeps the second one’s key and spent use, and drops only the first one’s uses', () => {
		const { backing, store } = seeded()
		store.removeManualFeat('m1c', 'manual:0')
		const [after] = new CharacterStore(backing).list()
		expect(featInstances(after, null).map((instance) => instance.key)).toEqual(['manual:1'])
		expect(after.play?.resourceUses).toEqual({ [BLESS_KEY('1')]: 1, Rage: 2 })
	})

	it('a feat added after a deletion gets an id never used on the character', () => {
		const { store } = seeded()
		store.removeManualFeat('m1c', 'manual:1')
		store.addManualFeat('m1c', { name: 'Tough', source: 'XPHB' })
		const ids = store.list()[0].grantedFeats!.filter((entry) => entry.origin === 'manual').map((entry) => entry.id)
		expect(ids[0]).toBe('0')
		expect(ids[1]).not.toBe('0')
		expect(ids[1]).not.toBe('1')
		expect(ids[1]?.length).toBeGreaterThan(0)
	})

	it('editing a manual feat keeps its id', () => {
		const { store } = seeded()
		store.setFeatChoiceDetails('m1c', 'manual:1', { name: 'Magic Initiate', source: 'XPHB' }, { chosenAbility: 'charisma' })
		expect(store.list()[0].grantedFeats?.[2]).toEqual({ origin: 'manual', id: '1', name: 'Magic Initiate', source: 'XPHB', chosenAbility: 'charisma' })
	})

	describe('repair on read (F-8, D320)', () => {
		const current = { schemaVersion: CURRENT_SCHEMA_VERSION, id: '1', name: 'Aria', classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 4 }] }
		const manual = { origin: 'manual', name: 'Tough', source: 'XPHB' }
		const load = (extra: object): Character => {
			const backing = new MemoryStorage()
			backing.setItem(STORAGE_KEY, JSON.stringify([{ ...current, ...extra }, { ...current, id: '2', name: 'Valid' }]))
			const list = new CharacterStore(backing).list()
			expect(list.map((c) => c.name)).toEqual(['Aria', 'Valid'])
			return list[0]
		}
		const manualIds = (character: Character) => character.grantedFeats?.filter((entry) => entry.origin === 'manual').map((entry) => entry.id)

		it('drops a bare-string, empty-name or empty-source concentration and keeps the character readable', () => {
			for (const concentratingOn of ['Bless', { name: '' }, { name: 'Bless', source: '' }, { name: 'Bless', source: 3 }]) {
				expect(load({ play: { concentratingOn, resourceUses: { Rage: 1 } } }).play).toEqual({ resourceUses: { Rage: 1 } })
			}
		})

		it('keeps the first fighting style per class owner and drops malformed entries', () => {
			const fighter = { className: 'Fighter', classSource: 'XPHB' }
			const kept = load({ fightingStyles: [{ ...fighter, name: 'Archery' }, { ...fighter, name: 'Defense' }, { name: '' }, 'Dueling', { className: 'Cleric', name: 'Blessed Warrior' }, { name: 'Unassigned' }] })
			expect(kept.fightingStyles).toEqual([{ ...fighter, name: 'Archery' }, { name: 'Unassigned' }])
		})

		it('gives a manual feat without an id the id the 58→59 migration would have', () => {
			expect(manualIds(load({ grantedFeats: [{ origin: 'background', name: 'Alert', source: 'XPHB' }, manual, manual] }))).toEqual(['0', '1'])
		})

		it('repairs a repeated or malformed id; the first holder of a valid id keeps it and a taken fallback never collides', () => {
			expect(manualIds(load({ grantedFeats: [{ ...manual, id: '0' }, { ...manual, id: '0' }] }))).toEqual(['0', '1'])
			expect(manualIds(load({ grantedFeats: [{ ...manual, id: '1' }, manual, { ...manual, id: '1' }] }))).toEqual(['1', 'repaired-1', '2'])
			expect(manualIds(load({ grantedFeats: [{ ...manual, id: 'a:b' }, { ...manual, id: 'x#1' }, { ...manual, id: 'p|q' }] }))).toEqual(['0', '1', '2'])
			expect(manualIds(load({ grantedFeats: [{ ...manual, id: '1' }, { ...manual, id: 'repaired-1' }, { ...manual, id: 'a:b' }, { ...manual, id: '' }] }))).toEqual(['1', 'repaired-1', '2', '3'])
		})

		it('drops an id stored on a background or species feat instead of rejecting the list', () => {
			const [background, species] = load({ grantedFeats: [{ origin: 'background', name: 'Alert', source: 'XPHB', id: '0' }, { origin: 'species', name: 'Skilled', source: 'XPHB', id: '9' }] }).grantedFeats!
			expect(background).toEqual({ origin: 'background', name: 'Alert', source: 'XPHB' })
			expect(species).toEqual({ origin: 'species', name: 'Skilled', source: 'XPHB' })
		})

		it('repairs the same fields in an imported file', () => {
			const text = JSON.stringify([{ ...current, play: { concentratingOn: 'Bless' }, grantedFeats: [manual], fightingStyles: [{ name: 'Archery' }, { name: 'Defense' }] }])
			const [imported] = new CharacterStore(new MemoryStorage()).import(text)
			expect(imported.play?.concentratingOn).toBeUndefined()
			expect(manualIds(imported)).toEqual(['0'])
			expect(imported.fightingStyles).toEqual([{ name: 'Archery' }])
		})

		it('still rejects what is not repairable: a bad shape inside a granted feat', () => {
			const backing = new MemoryStorage()
			backing.setItem(STORAGE_KEY, JSON.stringify([{ ...current, grantedFeats: [{ origin: 'manual', source: 'XPHB' }] }]))
			expect(() => new CharacterStore(backing).list()).toThrow(CorruptDataError)
		})
	})

	describe('write guard (F-8, D320)', () => {
		it('setConcentration with an empty source throws and writes nothing', () => {
			const { backing, store } = seeded()
			const before = backing.getItem(STORAGE_KEY)
			expect(() => store.setConcentration('m1c', { name: 'Bless', source: '' })).toThrow(ImportValidationError)
			expect(backing.getItem(STORAGE_KEY)).toBe(before)
		})

		it('addManualFeat throws and writes nothing when the new id would not be valid, or the feat has no source', () => {
			const { backing, store } = seeded()
			const before = backing.getItem(STORAGE_KEY)
			for (const bad of ['', 'a:b']) {
				const spy = vi.spyOn(crypto, 'randomUUID').mockReturnValue(bad as ReturnType<typeof crypto.randomUUID>)
				expect(() => store.addManualFeat('m1c', { name: 'Tough', source: 'XPHB' })).toThrow(ImportValidationError)
				spy.mockRestore()
			}
			expect(() => store.addManualFeat('m1c', { name: 'Tough', source: '' })).toThrow(ImportValidationError)
			expect(backing.getItem(STORAGE_KEY)).toBe(before)
		})

		it('removeManualFeat throws "No manual feat at key" for an unknown key and leaves resourceUses alone', () => {
			const { backing, store } = seeded()
			const before = backing.getItem(STORAGE_KEY)
			expect(() => store.removeManualFeat('m1c', 'manual:nope')).toThrow('No manual feat at key: manual:nope')
			expect(backing.getItem(STORAGE_KEY)).toBe(before)
		})

		it('rejects a manual feat id containing a separator', () => {
			const { store } = seeded()
			const spy = vi.spyOn(crypto, 'randomUUID').mockReturnValue('1:x' as ReturnType<typeof crypto.randomUUID>)
			expect(() => store.addManualFeat('m1c', { name: 'Tough', source: 'XPHB' })).toThrow(ImportValidationError)
			spy.mockRestore()
		})
	})

	describe('removing a manual feat and its pre-A2-1 counter (F-8, D320)', () => {
		const LEGACY = 'spell:feat:Magic Initiate:sleep|XPHB'
		const withUses = (grantedFeats: unknown[], resourceUses: Record<string, number>) => {
			const backing = new MemoryStorage()
			backing.setItem(STORAGE_KEY, JSON.stringify([{ ...v58, schemaVersion: CURRENT_SCHEMA_VERSION, grantedFeats, play: { resourceUses } }]))
			return { backing, store: new CharacterStore(backing) }
		}
		const mi = (id: string) => ({ origin: 'manual', id, name: 'Magic Initiate', source: 'XPHB', chosenAbility: 'intelligence', magicInitiate: initiate('Wizard', 'Sleep') })

		it('drops the legacy counter with the last instance of that feat', () => {
			const { store } = withUses([mi('a')], { [LEGACY]: 1, [SLEEP_KEY('a')]: 1, Rage: 2 })
			store.removeManualFeat('m1c', 'manual:a')
			expect(store.list()[0].play?.resourceUses).toEqual({ Rage: 2 })
		})

		it('keeps the legacy counter while another instance of the feat remains', () => {
			const { store } = withUses([mi('a'), mi('b')], { [LEGACY]: 1, [SLEEP_KEY('a')]: 1, [SLEEP_KEY('b')]: 1 })
			store.removeManualFeat('m1c', 'manual:a')
			expect(store.list()[0].play?.resourceUses).toEqual({ [LEGACY]: 1, [SLEEP_KEY('b')]: 1 })
		})
	})

	it('survives an export and import round trip unchanged', () => {
		const { store } = seeded()
		store.setConcentration('m1c', { name: 'Bless', source: 'XPHB' })
		const original = store.list()[0]
		const [imported] = new CharacterStore(new MemoryStorage()).import(store.exportCharacter('m1c'))
		expect({ ...imported, id: original.id }).toEqual(original)
		expect(imported.play?.concentratingOn).toEqual({ name: 'Bless', source: 'XPHB' })
		expect(imported.grantedFeats?.map((entry) => entry.id)).toEqual([undefined, '0', '1'])
	})
})
