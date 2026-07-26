import type { Character, CharacterClass } from './character'
import { CURRENT_SCHEMA_VERSION } from './character'
import type { StoredCharacter } from './wireFormat'

/*
 * Structural validation for data coming from outside the app's own control:
 * localStorage contents (could be hand-edited, or written by a future/older
 * version of the app) and imported files (could be anything). Every
 * rejection returns a human-readable reason instead of throwing, so callers
 * can decide how many problems to report and with what context (see
 * characterStore.ts).
 */

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0
}

export function describeClassError(value: unknown, index: number): string | null {
	if (!isRecord(value)) return `classes[${index}] is not an object`
	if (!isNonEmptyString(value['className'])) {
		return `classes[${index}].className is missing or not a string`
	}
	if (!isNonEmptyString(value['classSource'])) {
		return `classes[${index}].classSource is missing or not a string`
	}
	const subclass = value['subclass']
	if (subclass !== null && typeof subclass !== 'string') {
		return `classes[${index}].subclass must be a string or null`
	}
	const level = value['level']
	if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > 20) {
		return `classes[${index}].level must be a whole number from 1 to 20`
	}
	return null
}

function toCharacterClass(value: Record<string, unknown>): CharacterClass {
	return {
		className: value['className'] as string,
		classSource: value['classSource'] as string,
		subclass: (value['subclass'] as string | null | undefined) ?? null,
		level: value['level'] as number,
	}
}

/** Validates the Character-shaped fields only (id, name, classes) — no version. */
export function describeCharacterError(value: unknown, index: number): string | null {
	if (!isRecord(value)) return `[${index}] is not an object`
	if (!isNonEmptyString(value['id'])) return `[${index}].id is missing or not a string`
	if (!isNonEmptyString(value['name'])) return `[${index}].name is missing or not a string`
	const classes = value['classes']
	if (!Array.isArray(classes)) return `[${index}].classes is missing or not an array`
	for (let i = 0; i < classes.length; i++) {
		const classError = describeClassError(classes[i], i)
		if (classError) return `[${index}].${classError}`
	}
	return null
}

/** Validates the full wire record, including the version tag. */
export function describeStoredCharacterError(value: unknown, index: number): string | null {
	if (!isRecord(value)) return `[${index}] is not an object`
	if (typeof value['schemaVersion'] !== 'number') {
		return `[${index}].schemaVersion is missing or not a number`
	}
	return describeCharacterError(value, index)
}

export function toCharacter(value: Record<string, unknown>): Character {
	return {
		id: value['id'] as string,
		name: value['name'] as string,
		classes: (value['classes'] as unknown[]).map((entry) => toCharacterClass(entry as Record<string, unknown>)),
	}
}

export function toStoredCharacter(value: Record<string, unknown>): StoredCharacter {
	return {
		...toCharacter(value),
		schemaVersion: value['schemaVersion'] as number,
	}
}

export function isSupportedVersion(version: number): boolean {
	return version === CURRENT_SCHEMA_VERSION
}
