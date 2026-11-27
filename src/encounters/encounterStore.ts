import type { KeyValueStorage } from '../storage/characterStore'

export const ENCOUNTER_STORAGE_KEY = 'familliar:encounters'
export const ENCOUNTER_SCHEMA_VERSION = 1

export interface EncounterMember {
	id: string
	name: string
}

export interface EncounterGroup {
	id: string
	monster: { name: string; source: string }
	oneInitiative: boolean
	members: EncounterMember[]
}

export interface EncounterParty {
	size: number
	level: number
}

export interface Encounter {
	id: string
	name: string
	createdAt: string
	updatedAt: string
	party: EncounterParty | null
	players: string[]
	groups: EncounterGroup[]
}

export type EncounterInput = Omit<Encounter, 'id' | 'createdAt' | 'updatedAt'>

/** The whole key cannot be read: not JSON, not the expected wrapper, or saved by a newer app version. Writes are refused so nothing is overwritten. */
export class EncounterStorageError extends Error {}

export interface EncounterReadResult {
	encounters: Encounter[]
	/** Entries skipped because they fail validation (D43); kept untouched on every write. */
	skipped: number
	/** Set when the whole key is unreadable. */
	error: string | null
}

const isString = (value: unknown): value is string => typeof value === 'string'
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isWhole = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max

function isMember(value: unknown): value is EncounterMember {
	return isRecord(value) && isString(value.id) && value.id !== '' && isString(value.name)
}

function isGroup(value: unknown): value is EncounterGroup {
	return (
		isRecord(value) &&
		isString(value.id) &&
		value.id !== '' &&
		isRecord(value.monster) &&
		isString(value.monster.name) &&
		isString(value.monster.source) &&
		typeof value.oneInitiative === 'boolean' &&
		Array.isArray(value.members) &&
		value.members.length > 0 &&
		value.members.every(isMember)
	)
}

export function isEncounter(value: unknown): value is Encounter {
	if (!isRecord(value)) return false
	const party = value.party
	return (
		isString(value.id) &&
		value.id !== '' &&
		isString(value.name) &&
		isString(value.createdAt) &&
		isString(value.updatedAt) &&
		(party === null || (isRecord(party) && isWhole(party.size, 1, 20) && isWhole(party.level, 1, 20))) &&
		Array.isArray(value.players) &&
		value.players.every(isString) &&
		Array.isArray(value.groups) &&
		value.groups.every(isGroup)
	)
}

function browserStorage(): KeyValueStorage | null {
	try {
		return globalThis.localStorage ?? null
	} catch {
		return null
	}
}

export class EncounterStore {
	private readonly storage: KeyValueStorage | null

	constructor(storage?: KeyValueStorage) {
		this.storage = storage ?? browserStorage()
	}

	private readRaw(): { entries: unknown[] } | { error: string } {
		if (!this.storage) return { error: 'Browser storage is not available.' }
		let raw: string | null
		try {
			raw = this.storage.getItem(ENCOUNTER_STORAGE_KEY)
		} catch {
			return { error: 'Browser storage is not available.' }
		}
		if (raw === null) return { entries: [] }
		let parsed: unknown
		try {
			parsed = JSON.parse(raw)
		} catch {
			return { error: 'The saved data is not valid JSON.' }
		}
		if (!isRecord(parsed) || !Array.isArray(parsed.encounters)) return { error: 'The saved data is not a list of encounters.' }
		if (parsed.schemaVersion !== ENCOUNTER_SCHEMA_VERSION) {
			return typeof parsed.schemaVersion === 'number' && parsed.schemaVersion > ENCOUNTER_SCHEMA_VERSION
				? { error: `Saved with schema version ${parsed.schemaVersion}; this app supports up to ${ENCOUNTER_SCHEMA_VERSION}.` }
				: { error: 'The saved data has an unknown schema version.' }
		}
		return { entries: parsed.encounters }
	}

	read(): EncounterReadResult {
		const raw = this.readRaw()
		if ('error' in raw) return { encounters: [], skipped: 0, error: raw.error }
		const encounters = raw.entries.filter(isEncounter)
		return { encounters, skipped: raw.entries.length - encounters.length, error: null }
	}

	list(): Encounter[] {
		return this.read().encounters
	}

	get(id: string): Encounter | undefined {
		return this.list().find((encounter) => encounter.id === id)
	}

	private rewrite(change: (encounters: Encounter[]) => Encounter[]): void {
		const raw = this.readRaw()
		if ('error' in raw) throw new EncounterStorageError(`Saved encounters could not be read, so nothing was saved: ${raw.error}`)
		const kept = raw.entries.filter((entry) => !isEncounter(entry))
		const next = change(raw.entries.filter(isEncounter))
		try {
			this.storage!.setItem(ENCOUNTER_STORAGE_KEY, JSON.stringify({ schemaVersion: ENCOUNTER_SCHEMA_VERSION, encounters: [...next, ...kept] }))
		} catch {
			throw new EncounterStorageError('The encounter could not be saved: browser storage is full or not available.')
		}
	}

	/** Creates (id null) or replaces the encounter; returns the stored one. */
	save(id: string | null, input: EncounterInput, now: Date = new Date()): Encounter {
		const stamp = now.toISOString()
		let saved: Encounter | undefined
		this.rewrite((encounters) => {
			const existing = id === null ? undefined : encounters.find((encounter) => encounter.id === id)
			saved = { ...input, id: existing?.id ?? crypto.randomUUID(), createdAt: existing?.createdAt ?? stamp, updatedAt: stamp }
			if (!isEncounter(saved)) throw new EncounterStorageError('The encounter could not be saved: it is not valid.')
			return existing ? encounters.map((encounter) => (encounter.id === existing.id ? saved! : encounter)) : [...encounters, saved]
		})
		return saved!
	}

	delete(id: string): void {
		this.rewrite((encounters) => encounters.filter((encounter) => encounter.id !== id))
	}

	/** The way out of an unreadable key: removes everything stored under it. */
	clearAll(): void {
		try {
			this.storage?.removeItem(ENCOUNTER_STORAGE_KEY)
		} catch {
			throw new EncounterStorageError('Browser storage is not available.')
		}
	}
}
