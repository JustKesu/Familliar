import { ABILITIES, type AbilityScoreMethod, type AbilityScores, type CharacterAbilityScores, type RolledSet } from '../abilities/abilityScores'
import type { Character, CharacterClass, CharacterSpecies } from './character'
import { CURRENT_SCHEMA_VERSION } from './character'
import type { StoredCharacter } from './wireFormat'

const ABILITY_SCORE_METHODS: readonly AbilityScoreMethod[] = ['standardArray', 'pointBuy', 'roll']

/** Loose sanity bound on a raw ability score value — 5e scores run 1-30. */
function isValidScoreValue(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 30
}

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

function describeRolledSetError(value: unknown, index: number): string | null {
	if (!isRecord(value)) return `rolledSets[${index}] is not an object`
	const dice = value['dice']
	if (!Array.isArray(dice) || dice.length !== 4 || !dice.every((d) => typeof d === 'number' && Number.isInteger(d) && d >= 1 && d <= 6)) {
		return `rolledSets[${index}].dice must be four integers from 1 to 6`
	}
	if (!isValidScoreValue(value['total'])) return `rolledSets[${index}].total is missing or not a valid score`
	return null
}

function toRolledSet(value: Record<string, unknown>): RolledSet {
	const dice = value['dice'] as number[]
	return { dice: [dice[0], dice[1], dice[2], dice[3]], total: value['total'] as number }
}

/** Validates an optional `abilityScores` field. Returns null if the field is absent (it's optional). */
export function describeAbilityScoresError(value: unknown): string | null {
	if (value === undefined) return null
	if (!isRecord(value)) return `abilityScores is not an object`

	const method = value['method']
	if (typeof method !== 'string' || !ABILITY_SCORE_METHODS.includes(method as AbilityScoreMethod)) {
		return `abilityScores.method must be one of ${ABILITY_SCORE_METHODS.join(', ')}`
	}

	const scores = value['scores']
	if (!isRecord(scores)) return `abilityScores.scores is missing or not an object`
	for (const ability of ABILITIES) {
		if (!isValidScoreValue(scores[ability])) {
			return `abilityScores.scores.${ability} is missing or not a valid score`
		}
	}

	const rolledSets = value['rolledSets']
	if (rolledSets !== undefined) {
		if (!Array.isArray(rolledSets)) return `abilityScores.rolledSets must be an array`
		for (let i = 0; i < rolledSets.length; i++) {
			const error = describeRolledSetError(rolledSets[i], i)
			if (error) return `abilityScores.${error}`
		}
	}

	return null
}

function toAbilityScores(value: Record<string, unknown>): CharacterAbilityScores {
	const scoresValue = value['scores'] as Record<string, unknown>
	const scores = Object.fromEntries(ABILITIES.map((ability) => [ability, scoresValue[ability] as number])) as AbilityScores
	const rolledSets = value['rolledSets']
	return {
		method: value['method'] as AbilityScoreMethod,
		scores,
		...(Array.isArray(rolledSets) ? { rolledSets: rolledSets.map((r) => toRolledSet(r as Record<string, unknown>)) } : {}),
	}
}

/** Validates an optional `species` field. Returns null if the field is absent (it's optional). */
export function describeSpeciesError(value: unknown): string | null {
	if (value === undefined) return null
	if (!isRecord(value)) return `species is not an object`
	if (!isNonEmptyString(value['name'])) return `species.name is missing or not a string`
	if (!isNonEmptyString(value['source'])) return `species.source is missing or not a string`
	return null
}

function toCharacterSpecies(value: Record<string, unknown>): CharacterSpecies {
	return { name: value['name'] as string, source: value['source'] as string }
}

/** Validates the Character-shaped fields only (id, name, classes, abilityScores, species) — no version. */
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
	const abilityScoresError = describeAbilityScoresError(value['abilityScores'])
	if (abilityScoresError) return `[${index}].${abilityScoresError}`
	const speciesError = describeSpeciesError(value['species'])
	if (speciesError) return `[${index}].${speciesError}`
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
	const abilityScores = value['abilityScores']
	const species = value['species']
	return {
		id: value['id'] as string,
		name: value['name'] as string,
		classes: (value['classes'] as unknown[]).map((entry) => toCharacterClass(entry as Record<string, unknown>)),
		...(isRecord(abilityScores) ? { abilityScores: toAbilityScores(abilityScores) } : {}),
		...(isRecord(species) ? { species: toCharacterSpecies(species) } : {}),
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
