import { ABILITIES, type AbilityScoreMethod, type AbilityScores, type CharacterAbilityScores, type RolledSet } from '../abilities/abilityScores'
import type {
	AbilityBonusMap,
	Character,
	CharacterBackground,
	CharacterClass,
	CharacterLanguage,
	CharacterSpecies,
	LanguageGrantSource,
} from './character'
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

/** Validates an optional `background` field. Returns null if the field is absent (it's optional). */
export function describeBackgroundError(value: unknown): string | null {
	if (value === undefined) return null
	if (!isRecord(value)) return `background is not an object`
	if (!isNonEmptyString(value['name'])) return `background.name is missing or not a string`
	if (!isNonEmptyString(value['source'])) return `background.source is missing or not a string`
	const skillProficiencies = value['skillProficiencies']
	if (
		!Array.isArray(skillProficiencies) ||
		skillProficiencies.length !== 2 ||
		!skillProficiencies.every((skill) => isNonEmptyString(skill))
	) {
		return `background.skillProficiencies must be an array of exactly 2 strings`
	}
	return null
}

function toCharacterBackground(value: Record<string, unknown>): CharacterBackground {
	const skillProficiencies = value['skillProficiencies'] as [string, string]
	return { name: value['name'] as string, source: value['source'] as string, skillProficiencies }
}

const LANGUAGE_GRANT_SOURCES: readonly LanguageGrantSource[] = ['automatic', 'creation']

/** Validates an optional `languages` field. Returns null if the field is absent (it's optional). */
export function describeLanguagesError(value: unknown): string | null {
	if (value === undefined) return null
	if (!Array.isArray(value)) return `languages is not an array`
	for (let i = 0; i < value.length; i++) {
		const entry: unknown = value[i]
		if (!isRecord(entry)) return `languages[${i}] is not an object`
		if (!isNonEmptyString(entry['name'])) return `languages[${i}].name is missing or not a string`
		if (!isNonEmptyString(entry['source'])) return `languages[${i}].source is missing or not a string`
		const grantedBy = entry['grantedBy']
		if (typeof grantedBy !== 'string' || !LANGUAGE_GRANT_SOURCES.includes(grantedBy as LanguageGrantSource)) {
			return `languages[${i}].grantedBy must be one of ${LANGUAGE_GRANT_SOURCES.join(', ')}`
		}
	}
	return null
}

function toCharacterLanguages(value: unknown[]): CharacterLanguage[] {
	return value.map((entry) => {
		const record = entry as Record<string, unknown>
		return {
			name: record['name'] as string,
			source: record['source'] as string,
			grantedBy: record['grantedBy'] as LanguageGrantSource,
		}
	})
}

/**
 * Validates an optional `abilityBonus` field. Returns null if absent. Only
 * checks the distribution is structurally one of the two legal shapes
 * (+2/+1 on two different abilities, or +1 on exactly three) — it cannot
 * check the abilities are the ones a specific background offers, since
 * that would require loading backgrounds.json into the storage layer.
 */
export function describeAbilityBonusError(value: unknown): string | null {
	if (value === undefined) return null
	if (!isRecord(value)) return `abilityBonus is not an object`

	const entries = Object.entries(value)
	for (const [ability, amount] of entries) {
		if (!ABILITIES.includes(ability as (typeof ABILITIES)[number])) {
			return `abilityBonus has an unrecognised ability key "${ability}"`
		}
		if (amount !== 1 && amount !== 2) {
			return `abilityBonus.${ability} must be 1 or 2`
		}
	}

	if (entries.length === 2) {
		const amounts = entries.map(([, amount]) => amount).sort()
		if (JSON.stringify(amounts) !== JSON.stringify([1, 2])) {
			return `abilityBonus with 2 abilities must be one +2 and one +1`
		}
		return null
	}
	if (entries.length === 3) {
		if (!entries.every(([, amount]) => amount === 1)) {
			return `abilityBonus with 3 abilities must be +1 to each`
		}
		return null
	}
	return `abilityBonus must have exactly 2 abilities (+2/+1) or 3 (+1/+1/+1), got ${entries.length}`
}

function toAbilityBonusMap(value: Record<string, unknown>): AbilityBonusMap {
	return Object.fromEntries(Object.entries(value)) as AbilityBonusMap
}

/** Validates an optional `classSkills` field. Returns null if the field is absent (it's optional). */
export function describeClassSkillsError(value: unknown): string | null {
	if (value === undefined) return null
	if (!Array.isArray(value) || !value.every((skill) => isNonEmptyString(skill))) {
		return `classSkills must be an array of strings`
	}
	return null
}

/** Validates an optional `masteries` field. Returns null if the field is absent (it's optional). */
export function describeMasteriesError(value: unknown): string | null {
	if (value === undefined) return null
	if (!Array.isArray(value) || !value.every((weapon) => isNonEmptyString(weapon))) {
		return `masteries must be an array of strings`
	}
	return null
}

/** Validates an optional `fightingStyle` field. Returns null if the field is absent (it's optional). */
export function describeFightingStyleError(value: unknown): string | null {
	if (value === undefined || value === null) return null
	if (typeof value !== 'string' || value.trim().length === 0) {
		return `fightingStyle must be a string or null`
	}
	return null
}

/** Validates the Character-shaped fields only (id, name, classes, abilityScores, species, background, abilityBonus) — no version. */
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
	const backgroundError = describeBackgroundError(value['background'])
	if (backgroundError) return `[${index}].${backgroundError}`
	const abilityBonusError = describeAbilityBonusError(value['abilityBonus'])
	if (abilityBonusError) return `[${index}].${abilityBonusError}`
	const languagesError = describeLanguagesError(value['languages'])
	if (languagesError) return `[${index}].${languagesError}`
	const classSkillsError = describeClassSkillsError(value['classSkills'])
	if (classSkillsError) return `[${index}].${classSkillsError}`
	const masteriesError = describeMasteriesError(value['masteries'])
	if (masteriesError) return `[${index}].${masteriesError}`
	const fightingStyleError = describeFightingStyleError(value['fightingStyle'])
	if (fightingStyleError) return `[${index}].${fightingStyleError}`
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
	const background = value['background']
	const abilityBonus = value['abilityBonus']
	const languages = value['languages']
	const classSkills = value['classSkills']
	const masteries = value['masteries']
	const fightingStyle = value['fightingStyle']
	return {
		id: value['id'] as string,
		name: value['name'] as string,
		classes: (value['classes'] as unknown[]).map((entry) => toCharacterClass(entry as Record<string, unknown>)),
		...(isRecord(abilityScores) ? { abilityScores: toAbilityScores(abilityScores) } : {}),
		...(isRecord(species) ? { species: toCharacterSpecies(species) } : {}),
		...(isRecord(background) ? { background: toCharacterBackground(background) } : {}),
		...(isRecord(abilityBonus) ? { abilityBonus: toAbilityBonusMap(abilityBonus) } : {}),
		...(Array.isArray(languages) ? { languages: toCharacterLanguages(languages) } : {}),
		...(Array.isArray(classSkills) ? { classSkills: classSkills as string[] } : {}),
		...(Array.isArray(masteries) ? { masteries: masteries as string[] } : {}),
		...(fightingStyle !== undefined ? { fightingStyle: fightingStyle as string | null } : {}),
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
