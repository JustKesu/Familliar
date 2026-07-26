/*
 * Every failure the storage layer can raise. Callers (the UI) catch these
 * and show `message` to the player rather than letting anything fail
 * silently — see CLAUDE.md task instructions and PHASE1.md section D.
 */

export class StorageError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'StorageError'
	}
}

/** localStorage is disabled, blocked, or otherwise unreachable. */
export class StorageUnavailableError extends StorageError {
	constructor(message = 'Local storage is not available in this browser, so characters cannot be saved.') {
		super(message)
		this.name = 'StorageUnavailableError'
	}
}

/** A write was rejected because localStorage is full. */
export class StorageFullError extends StorageError {
	constructor(message = 'Local storage is full — this change was not saved. Free up space (e.g. export and delete an old character) and try again.') {
		super(message)
		this.name = 'StorageFullError'
	}
}

/** Saved data exists but is not valid JSON, or is not shaped like a character list. */
export class CorruptDataError extends StorageError {
	constructor(message: string) {
		super(message)
		this.name = 'CorruptDataError'
	}
}

/** Saved or imported data declares a schema version this build does not understand. */
export class UnknownSchemaVersionError extends StorageError {
	constructor(version: unknown) {
		super(
			`This data uses schema version ${JSON.stringify(version)}, which this version of the app does not understand.`,
		)
		this.name = 'UnknownSchemaVersionError'
	}
}

/** An imported file failed validation. The store is left unchanged. */
export class ImportValidationError extends StorageError {
	constructor(message: string) {
		super(message)
		this.name = 'ImportValidationError'
	}
}

/** A rename/delete/export referenced an id that is not in the store. */
export class CharacterNotFoundError extends StorageError {
	constructor(id: string) {
		super(`No character with id "${id}" was found.`)
		this.name = 'CharacterNotFoundError'
	}
}
