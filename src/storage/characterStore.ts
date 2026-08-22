import type { CharacterAbilityScores } from '../abilities/abilityScores'
import type {
	AbilityBonusMap,
	Character,
	CharacterBackground,
	CharacterClass,
	CharacterClassFeatureChoice,
	CharacterWildShapeForms,
	CharacterLanguage,
	CharacterOptionalFeatureChoice,
	CharacterSpecies,
	CharacterSpellChoice,
	CharacterSubclassSpellChoice,
	FeatAsiChoice,
} from './character'
import { CURRENT_SCHEMA_VERSION } from './character'
import {
	CharacterNotFoundError,
	CorruptDataError,
	ImportValidationError,
	StorageFullError,
	StorageUnavailableError,
	UnknownSchemaVersionError,
} from './errors'
import { describeStoredCharacterError, isSupportedVersion, toStoredCharacter } from './validate'
import type { StoredCharacter } from './wireFormat'

/*
 * The storage layer. Nothing else in the app touches localStorage
 * directly (CLAUDE.md task instructions) — every read and write goes
 * through a CharacterStore instance.
 *
 * Storage access is behind this small interface so tests can inject an
 * in-memory fake instead of a real browser localStorage.
 */
export interface KeyValueStorage {
	getItem(key: string): string | null
	setItem(key: string, value: string): void
	removeItem(key: string): void
}

const STORAGE_KEY = 'familliar:characters'

function getBrowserStorage(): KeyValueStorage {
	try {
		const probeKey = '__familliar_storage_probe__'
		globalThis.localStorage.setItem(probeKey, '1')
		globalThis.localStorage.removeItem(probeKey)
		return globalThis.localStorage
	} catch {
		throw new StorageUnavailableError()
	}
}

function isQuotaExceeded(error: unknown): boolean {
	return (
		error instanceof DOMException &&
		(error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
	)
}

/**
 * Parses and validates a raw JSON string into the array of stored records
 * it should contain. Throws `UnknownSchemaVersionError` directly (shared
 * between the two callers below); any other problem throws a plain `Error`
 * whose message the caller wraps in the error type appropriate to its
 * context (an app's own saved data vs. an imported file).
 */
function parseStoredCharacters(raw: string): StoredCharacter[] {
	let parsed: unknown
	try {
		parsed = JSON.parse(raw)
	} catch {
		throw new Error('The data is not valid JSON.')
	}

	if (!Array.isArray(parsed)) {
		throw new Error('The data is not a list of characters.')
	}

	if (parsed.length === 0) {
		return []
	}

	for (let i = 0; i < parsed.length; i++) {
		const entry: unknown = parsed[i]
		const version = isRecordWithSchemaVersion(entry) ? entry.schemaVersion : undefined
		if (typeof version === 'number' && !isSupportedVersion(version)) {
			throw new UnknownSchemaVersionError(version)
		}
	}

	for (let i = 0; i < parsed.length; i++) {
		const error = describeStoredCharacterError(parsed[i], i)
		if (error) throw new Error(`Entry ${error} is malformed.`)
	}

	return (parsed as Record<string, unknown>[]).map(toStoredCharacter)
}

function isRecordWithSchemaVersion(value: unknown): value is { schemaVersion: unknown } {
	return typeof value === 'object' && value !== null && 'schemaVersion' in value
}

function toCharacter({ schemaVersion: _schemaVersion, ...character }: StoredCharacter): Character {
	return character
}

function toStoredCharacters(characters: Character[]): StoredCharacter[] {
	return characters.map((character) => ({ ...character, schemaVersion: CURRENT_SCHEMA_VERSION }))
}

function newId(): string {
	return crypto.randomUUID()
}

export class CharacterStore {
	private readonly storage: KeyValueStorage

	constructor(storage?: KeyValueStorage) {
		this.storage = storage ?? getBrowserStorage()
	}

	/** All saved characters. Empty array if nothing has been saved yet. */
	list(): Character[] {
		let raw: string | null
		try {
			raw = this.storage.getItem(STORAGE_KEY)
		} catch {
			throw new StorageUnavailableError()
		}

		if (raw === null) return []

		try {
			return parseStoredCharacters(raw).map(toCharacter)
		} catch (error) {
			if (error instanceof UnknownSchemaVersionError) throw error
			const message = error instanceof Error ? error.message : String(error)
			throw new CorruptDataError(`Saved character data is corrupted: ${message}`)
		}
	}

	private writeAll(characters: Character[]): void {
		const payload = JSON.stringify(toStoredCharacters(characters))
		try {
			this.storage.setItem(STORAGE_KEY, payload)
		} catch (error) {
			if (isQuotaExceeded(error)) throw new StorageFullError()
			throw new StorageUnavailableError()
		}
	}

	create(
		name: string,
		classes: CharacterClass[] = [],
		abilityScores?: CharacterAbilityScores,
		species?: CharacterSpecies,
		background?: CharacterBackground,
		abilityBonus?: AbilityBonusMap,
		languages?: CharacterLanguage[],
		classSkills?: string[],
		masteries?: string[],
		fightingStyle?: string | null,
		optionalFeatureChoices?: CharacterOptionalFeatureChoice[],
		speciesSkills?: string[],
		expertiseSkills?: string[],
		featAsiChoices?: FeatAsiChoice[],
		spellChoices?: CharacterSpellChoice[],
		subclassSpellChoices?: CharacterSubclassSpellChoice[],
		classFeatureChoices?: CharacterClassFeatureChoice[],
		wildShapeForms?: CharacterWildShapeForms[],
	): Character {
		const trimmed = name.trim()
		if (!trimmed) throw new ImportValidationError('A character needs a name.')

		const character: Character = {
			id: newId(),
			name: trimmed,
			classes,
			...(abilityScores ? { abilityScores } : {}),
			...(species ? { species } : {}),
			...(background ? { background } : {}),
			...(abilityBonus ? { abilityBonus } : {}),
			...(languages ? { languages } : {}),
			...(classSkills && classSkills.length > 0 ? { classSkills } : {}),
			...(masteries && masteries.length > 0 ? { masteries } : {}),
			...(fightingStyle ? { fightingStyle } : {}),
			...(optionalFeatureChoices && optionalFeatureChoices.length > 0 ? { optionalFeatureChoices } : {}),
			...(speciesSkills && speciesSkills.length > 0 ? { speciesSkills } : {}),
			...(expertiseSkills && expertiseSkills.length > 0 ? { expertiseSkills } : {}),
			...(featAsiChoices && featAsiChoices.length > 0 ? { featAsiChoices } : {}),
			...(spellChoices && spellChoices.length > 0 ? { spellChoices } : {}),
			...(subclassSpellChoices && subclassSpellChoices.length > 0 ? { subclassSpellChoices } : {}),
			...(classFeatureChoices && classFeatureChoices.length > 0 ? { classFeatureChoices } : {}),
			...(wildShapeForms && wildShapeForms.length > 0 ? { wildShapeForms } : {}),
		}
		this.writeAll([...this.list(), character])
		return character
	}

	rename(id: string, name: string): void {
		const trimmed = name.trim()
		if (!trimmed) throw new ImportValidationError('A character needs a name.')

		const characters = this.list()
		const index = characters.findIndex((character) => character.id === id)
		if (index === -1) throw new CharacterNotFoundError(id)

		const updated = [...characters]
		updated[index] = { ...characters[index], name: trimmed }
		this.writeAll(updated)
	}

	delete(id: string): void {
		const characters = this.list()
		const index = characters.findIndex((character) => character.id === id)
		if (index === -1) throw new CharacterNotFoundError(id)

		this.writeAll(characters.filter((character) => character.id !== id))
	}

	/** Serializes one saved character to an export file's contents (still an array — see wireFormat.ts). */
	exportCharacter(id: string): string {
		const character = this.list().find((c) => c.id === id)
		if (!character) throw new CharacterNotFoundError(id)
		return JSON.stringify(toStoredCharacters([character]), null, 2)
	}

	/**
	 * Reads an export file's contents and adds every character it contains
	 * to the store as NEW characters with freshly generated ids — existing
	 * characters are never overwritten (PHASE1.md section D). On any
	 * validation failure the store is left completely unchanged.
	 */
	import(raw: string): Character[] {
		let stored: StoredCharacter[]
		try {
			stored = parseStoredCharacters(raw)
		} catch (error) {
			if (error instanceof UnknownSchemaVersionError) throw error
			const message = error instanceof Error ? error.message : String(error)
			throw new ImportValidationError(`That file could not be imported: ${message}`)
		}

		if (stored.length === 0) {
			throw new ImportValidationError('That file does not contain any characters.')
		}

		const imported = stored.map((character) => ({ ...toCharacter(character), id: newId() }))
		this.writeAll([...this.list(), ...imported])
		return imported
	}
}
