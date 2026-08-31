import { ABILITIES, type Ability, type AbilityScoreMethod, type AbilityScores, type CharacterAbilityScores, type RolledSet } from '../abilities/abilityScores'
import type {
	AbilityBonusMap,
	AbilityIncreaseMap,
	Character,
	CharacterBackground,
	CharacterClass,
	CharacterClassFeatureChoice,
	CharacterFamiliar,
	CharacterInventoryItem,
	CharacterWildShapeForms,
	CharacterLanguage,
	CharacterOptionalFeatureChoice,
	CharacterSpecies,
	CharacterSpellChoice,
	CharacterSubclassSpellChoice,
	EquippedSlot,
	FeatAsiChoice,
	FilterChoiceSpellsChoice,
	LanguageGrantSource,
	MagicInitiateChoice,
	WeaponAttackAbility,
} from './character'
import { CURRENT_SCHEMA_VERSION } from './character'
import { canMigrateToCurrent } from './migrations'
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
	if (!isNonEmptyString(value['toolProficiency'])) {
		return `background.toolProficiency is missing or not a string`
	}
	return null
}

function toCharacterBackground(value: Record<string, unknown>): CharacterBackground {
	const skillProficiencies = value['skillProficiencies'] as [string, string]
	return {
		name: value['name'] as string,
		source: value['source'] as string,
		skillProficiencies,
		toolProficiency: value['toolProficiency'] as string,
	}
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

/** Validates an optional `speciesSkills` field. Returns null if the field is absent (it's optional). */
export function describeSpeciesSkillsError(value: unknown): string | null {
	if (value === undefined) return null
	if (!Array.isArray(value) || !value.every((skill) => isNonEmptyString(skill))) {
		return `speciesSkills must be an array of strings`
	}
	return null
}

/** Validates an optional `expertiseSkills` field. Returns null if the field is absent (it's optional). */
export function describeExpertiseSkillsError(value: unknown): string | null {
	if (value === undefined) return null
	if (!Array.isArray(value) || !value.every((skill) => isNonEmptyString(skill))) {
		return `expertiseSkills must be an array of strings`
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

/** Validates an optional `optionalFeatureChoices` field. Returns null if the field is absent (it's optional). */
export function describeOptionalFeatureChoicesError(value: unknown): string | null {
	if (value === undefined) return null
	if (!Array.isArray(value)) return `optionalFeatureChoices must be an array`
	for (let i = 0; i < value.length; i++) {
		const entry: unknown = value[i]
		if (!isRecord(entry)) return `optionalFeatureChoices[${i}] is not an object`
		if (!isNonEmptyString(entry['featureType'])) {
			return `optionalFeatureChoices[${i}].featureType is missing or not a string`
		}
		const choices = entry['choices']
		if (!Array.isArray(choices) || !choices.every((choice) => isNonEmptyString(choice))) {
			return `optionalFeatureChoices[${i}].choices must be an array of strings`
		}
		const spellChoicesError = describeOptionalFeatureSpellChoicesError(entry['spellChoices'], i)
		if (spellChoicesError) return spellChoicesError
	}
	return null
}

/** Validates an optional `spellChoices` field on one optional-feature choice (Pact of the Tome, step 6a). Returns null if absent. */
function describeOptionalFeatureSpellChoicesError(value: unknown, index: number): string | null {
	if (value === undefined) return null
	const label = `optionalFeatureChoices[${index}].spellChoices`
	if (!Array.isArray(value)) return `${label} must be an array`
	for (let i = 0; i < value.length; i++) {
		const entry: unknown = value[i]
		if (!isRecord(entry)) return `${label}[${i}] is not an object`
		if (!isNonEmptyString(entry['optionName'])) return `${label}[${i}].optionName is missing or not a string`
		for (const key of ['cantrips', 'spells'] as const) {
			const picks = entry[key]
			if (!Array.isArray(picks)) return `${label}[${i}].${key} must be an array`
			for (let j = 0; j < picks.length; j++) {
				const error = describeSpellRefError(picks[j], `${label}[${i}].${key}[${j}]`)
				if (error) return error
			}
		}
	}
	return null
}

function toCharacterOptionalFeatureChoices(value: unknown[]): CharacterOptionalFeatureChoice[] {
	return value.map((entry) => {
		const record = entry as Record<string, unknown>
		const spellChoices = record['spellChoices'] as CharacterOptionalFeatureChoice['spellChoices']
		return {
			featureType: record['featureType'] as string,
			choices: record['choices'] as string[],
			...(spellChoices === undefined ? {} : { spellChoices }),
		}
	})
}

/**
 * Validates one FeatAsiChoice's `increases` map: exactly one ability at +2,
 * or exactly two different abilities at +1 each (D20) — a different shape
 * than the background's abilityBonus (which also allows 3 abilities at +1).
 */
function describeAbilityIncreaseMapError(value: unknown): string | null {
	if (!isRecord(value)) return `increases is not an object`
	const entries = Object.entries(value)
	for (const [ability, amount] of entries) {
		if (!ABILITIES.includes(ability as (typeof ABILITIES)[number])) {
			return `increases has an unrecognised ability key "${ability}"`
		}
		if (amount !== 1 && amount !== 2) return `increases.${ability} must be 1 or 2`
	}
	if (entries.length === 1) {
		if (entries[0][1] !== 2) return `increases with 1 ability must be +2`
		return null
	}
	if (entries.length === 2) {
		if (!entries.every(([, amount]) => amount === 1)) return `increases with 2 abilities must be +1 each`
		return null
	}
	return `increases must have exactly 1 ability (+2) or 2 (+1/+1), got ${entries.length}`
}

function toAbilityIncreaseMap(value: Record<string, unknown>): AbilityIncreaseMap {
	return Object.fromEntries(Object.entries(value)) as AbilityIncreaseMap
}

/** Validates an optional `featAsiChoices` field. Returns null if the field is absent (it's optional). */
export function describeFeatAsiChoicesError(value: unknown): string | null {
	if (value === undefined) return null
	if (!Array.isArray(value)) return `featAsiChoices must be an array`
	for (let i = 0; i < value.length; i++) {
		const entry: unknown = value[i]
		if (!isRecord(entry)) return `featAsiChoices[${i}] is not an object`
		if (typeof entry['level'] !== 'number' || !Number.isInteger(entry['level']) || entry['level'] < 1 || entry['level'] > 20) {
			return `featAsiChoices[${i}].level must be a whole number from 1 to 20`
		}
		const kind = entry['kind']
		if (kind === 'asi') {
			const error = describeAbilityIncreaseMapError(entry['increases'])
			if (error) return `featAsiChoices[${i}].${error}`
		} else if (kind === 'feat') {
			if (!isNonEmptyString(entry['name'])) return `featAsiChoices[${i}].name is missing or not a string`
			if (!isNonEmptyString(entry['source'])) return `featAsiChoices[${i}].source is missing or not a string`
			const chosenAbility = entry['chosenAbility']
			if (chosenAbility !== undefined && !ABILITIES.includes(chosenAbility as (typeof ABILITIES)[number])) {
				return `featAsiChoices[${i}].chosenAbility must be a valid ability`
			}
			const magicInitiateError = describeMagicInitiateError(entry['magicInitiate'])
			if (magicInitiateError) return `featAsiChoices[${i}].${magicInitiateError}`
			const filterChoiceSpellsError = describeFilterChoiceSpellsError(entry['filterChoiceSpells'])
			if (filterChoiceSpellsError) return `featAsiChoices[${i}].${filterChoiceSpellsError}`
		} else {
			return `featAsiChoices[${i}].kind must be "asi" or "feat"`
		}
	}
	return null
}

/** Validates the spell-ref shape (`{name, source}`) shared by magicInitiate.cantrips and .spell. */
function describeSpellRefError(value: unknown, label: string): string | null {
	if (!isRecord(value)) return `${label} is not an object`
	if (!isNonEmptyString(value['name'])) return `${label}.name is missing or not a string`
	if (!isNonEmptyString(value['source'])) return `${label}.source is missing or not a string`
	return null
}

/** Validates an optional `magicInitiate` field on a feat choice (base Magic Initiate only, slice d5b-2). Returns null if absent. */
function describeMagicInitiateError(value: unknown): string | null {
	if (value === undefined) return null
	if (!isRecord(value)) return `magicInitiate is not an object`
	if (!isNonEmptyString(value['className'])) return `magicInitiate.className is missing or not a string`
	if (!isNonEmptyString(value['classSource'])) return `magicInitiate.classSource is missing or not a string`
	const cantrips = value['cantrips']
	if (!Array.isArray(cantrips)) return `magicInitiate.cantrips must be an array`
	for (let i = 0; i < cantrips.length; i++) {
		const error = describeSpellRefError(cantrips[i], `magicInitiate.cantrips[${i}]`)
		if (error) return error
	}
	const spell = value['spell']
	if (spell !== null) {
		const error = describeSpellRefError(spell, `magicInitiate.spell`)
		if (error) return error
	}
	return null
}

/** Validates an optional `filterChoiceSpells` field on a feat choice (the 8 generic filter-choice feats, slice d5b-1). Returns null if absent. */
function describeFilterChoiceSpellsError(value: unknown): string | null {
	if (value === undefined) return null
	if (!isRecord(value)) return `filterChoiceSpells is not an object`
	const cantrips = value['cantrips']
	if (!Array.isArray(cantrips)) return `filterChoiceSpells.cantrips must be an array`
	for (let i = 0; i < cantrips.length; i++) {
		const error = describeSpellRefError(cantrips[i], `filterChoiceSpells.cantrips[${i}]`)
		if (error) return error
	}
	const spells = value['spells']
	if (!Array.isArray(spells)) return `filterChoiceSpells.spells must be an array`
	for (let i = 0; i < spells.length; i++) {
		const error = describeSpellRefError(spells[i], `filterChoiceSpells.spells[${i}]`)
		if (error) return error
	}
	return null
}

function toFilterChoiceSpellsChoice(value: Record<string, unknown>): FilterChoiceSpellsChoice {
	const cantrips = value['cantrips'] as Record<string, unknown>[]
	const spells = value['spells'] as Record<string, unknown>[]
	return {
		cantrips: cantrips.map((c) => ({ name: c['name'] as string, source: c['source'] as string })),
		spells: spells.map((s) => ({ name: s['name'] as string, source: s['source'] as string })),
	}
}

function toMagicInitiateChoice(value: Record<string, unknown>): MagicInitiateChoice {
	const cantrips = value['cantrips'] as Record<string, unknown>[]
	const spell = value['spell'] as Record<string, unknown> | null
	return {
		className: value['className'] as string,
		classSource: value['classSource'] as string,
		cantrips: cantrips.map((c) => ({ name: c['name'] as string, source: c['source'] as string })),
		spell: spell ? { name: spell['name'] as string, source: spell['source'] as string } : null,
	}
}

/** Validates an optional `spellChoices` field. Returns null if the field is absent (it's optional). */
export function describeSpellChoicesError(value: unknown): string | null {
	if (value === undefined) return null
	if (!Array.isArray(value)) return `spellChoices must be an array`
	for (let i = 0; i < value.length; i++) {
		const entry: unknown = value[i]
		if (!isRecord(entry)) return `spellChoices[${i}] is not an object`
		if (!isNonEmptyString(entry['className'])) return `spellChoices[${i}].className is missing or not a string`
		if (!isNonEmptyString(entry['classSource'])) return `spellChoices[${i}].classSource is missing or not a string`
		const spells = entry['spells']
		if (!Array.isArray(spells)) return `spellChoices[${i}].spells must be an array`
		for (let j = 0; j < spells.length; j++) {
			const spell: unknown = spells[j]
			if (!isRecord(spell)) return `spellChoices[${i}].spells[${j}] is not an object`
			if (!isNonEmptyString(spell['name'])) return `spellChoices[${i}].spells[${j}].name is missing or not a string`
			if (!isNonEmptyString(spell['source'])) return `spellChoices[${i}].spells[${j}].source is missing or not a string`
		}
	}
	return null
}

/** Validates an optional `subclassSpellChoices` field (build order step 6, slice d6b). Returns null if the field is absent (it's optional). */
export function describeSubclassSpellChoicesError(value: unknown): string | null {
	if (value === undefined) return null
	if (!Array.isArray(value)) return `subclassSpellChoices must be an array`
	for (let i = 0; i < value.length; i++) {
		const entry: unknown = value[i]
		if (!isRecord(entry)) return `subclassSpellChoices[${i}] is not an object`
		if (!isNonEmptyString(entry['subclassName'])) return `subclassSpellChoices[${i}].subclassName is missing or not a string`
		if (!isNonEmptyString(entry['subclassSource'])) return `subclassSpellChoices[${i}].subclassSource is missing or not a string`
		if (!isNonEmptyString(entry['className'])) return `subclassSpellChoices[${i}].className is missing or not a string`
		if (!isNonEmptyString(entry['classSource'])) return `subclassSpellChoices[${i}].classSource is missing or not a string`
		const picks = entry['picks']
		if (!Array.isArray(picks)) return `subclassSpellChoices[${i}].picks must be an array`
		for (let j = 0; j < picks.length; j++) {
			const pick: unknown = picks[j]
			if (!isRecord(pick)) return `subclassSpellChoices[${i}].picks[${j}] is not an object`
			if (typeof pick['grantedAtLevel'] !== 'number' || !Number.isInteger(pick['grantedAtLevel']) || pick['grantedAtLevel'] < 1 || pick['grantedAtLevel'] > 20) {
				return `subclassSpellChoices[${i}].picks[${j}].grantedAtLevel must be a whole number from 1 to 20`
			}
			if (typeof pick['slotIndex'] !== 'number' || !Number.isInteger(pick['slotIndex']) || pick['slotIndex'] < 0) {
				return `subclassSpellChoices[${i}].picks[${j}].slotIndex must be a non-negative whole number`
			}
			if (!isNonEmptyString(pick['name'])) return `subclassSpellChoices[${i}].picks[${j}].name is missing or not a string`
			if (!isNonEmptyString(pick['source'])) return `subclassSpellChoices[${i}].picks[${j}].source is missing or not a string`
		}
	}
	return null
}

/** Validates an optional `classFeatureChoices` field (D21 class-feature choices). Returns null if the field is absent (it's optional). */
export function describeClassFeatureChoicesError(value: unknown): string | null {
	if (value === undefined) return null
	if (!Array.isArray(value)) return `classFeatureChoices must be an array`
	for (let i = 0; i < value.length; i++) {
		const entry: unknown = value[i]
		if (!isRecord(entry)) return `classFeatureChoices[${i}] is not an object`
		if (!isNonEmptyString(entry['className'])) return `classFeatureChoices[${i}].className is missing or not a string`
		if (!isNonEmptyString(entry['classSource'])) return `classFeatureChoices[${i}].classSource is missing or not a string`
		if (!isNonEmptyString(entry['featureName'])) return `classFeatureChoices[${i}].featureName is missing or not a string`
		if (
			typeof entry['grantedAtLevel'] !== 'number' ||
			!Number.isInteger(entry['grantedAtLevel']) ||
			entry['grantedAtLevel'] < 1 ||
			entry['grantedAtLevel'] > 20
		) {
			return `classFeatureChoices[${i}].grantedAtLevel must be a whole number from 1 to 20`
		}
		if (!isNonEmptyString(entry['optionName'])) return `classFeatureChoices[${i}].optionName is missing or not a string`
	}
	return null
}

/**
 * Validates an optional `wildShapeForms` field (step 6b slice 3). Returns
 * null if the field is absent (it's optional). No level is checked because
 * none is stored — see CharacterWildShapeForms for why.
 */
export function describeWildShapeFormsError(value: unknown): string | null {
	if (value === undefined) return null
	if (!Array.isArray(value)) return `wildShapeForms must be an array`
	for (let i = 0; i < value.length; i++) {
		const entry: unknown = value[i]
		if (!isRecord(entry)) return `wildShapeForms[${i}] is not an object`
		if (!isNonEmptyString(entry['className'])) return `wildShapeForms[${i}].className is missing or not a string`
		if (!isNonEmptyString(entry['classSource'])) return `wildShapeForms[${i}].classSource is missing or not a string`
		const forms: unknown = entry['forms']
		if (!Array.isArray(forms)) return `wildShapeForms[${i}].forms must be an array`
		for (let j = 0; j < forms.length; j++) {
			const form: unknown = forms[j]
			if (!isRecord(form)) return `wildShapeForms[${i}].forms[${j}] is not an object`
			if (!isNonEmptyString(form['name'])) return `wildShapeForms[${i}].forms[${j}].name is missing or not a string`
			if (!isNonEmptyString(form['source'])) return `wildShapeForms[${i}].forms[${j}].source is missing or not a string`
		}
	}
	return null
}

/**
 * Validates an optional `familiar` field. Returns null if the field is absent
 * — which is not "invalid", it is the ordinary state of having no familiar
 * summoned. Whether the named creature is a form this character may actually
 * take is not checked here: that needs beasts.json, which the storage layer
 * does not load (same limit as describeAbilityBonusError's).
 */
export function describeFamiliarError(value: unknown): string | null {
	if (value === undefined) return null
	if (!isRecord(value)) return `familiar is not an object`
	if (!isNonEmptyString(value['name'])) return `familiar.name is missing or not a string`
	if (!isNonEmptyString(value['source'])) return `familiar.source is missing or not a string`
	return null
}

function toCharacterFamiliar(value: Record<string, unknown>): CharacterFamiliar {
	return { name: value['name'] as string, source: value['source'] as string }
}

/**
 * Validates an optional `inventory` field (build order step 7, slice a1).
 * Returns null if the field is absent — an absent or empty inventory is the
 * ordinary state of owning nothing, not a fault. Whether the named item
 * exists in items.json is NOT checked here: that needs the data file, which
 * the storage layer does not load (same limit as describeFamiliarError's) —
 * an unresolvable stored item is surfaced on the sheet instead (D43).
 *
 * Slice b's `equipped` flag is checked for shape, and "at most one suit of
 * armour" is checked because 'worn' means armour and nothing else. The
 * matching "at most one shield" rule is NOT checkable here: 'held' covers
 * shields and weapons alike, and telling them apart needs items.json.
 *
 * Slice c's `attackAbility` is likewise checked for shape only — whether the
 * row is a Finesse weapon at all is again an items.json question.
 */
export function describeInventoryError(value: unknown): string | null {
	if (value === undefined) return null
	if (!Array.isArray(value)) return `inventory must be an array`
	for (let i = 0; i < value.length; i++) {
		const entry: unknown = value[i]
		if (!isRecord(entry)) return `inventory[${i}] is not an object`
		if (!isNonEmptyString(entry['name'])) return `inventory[${i}].name is missing or not a string`
		if (!isNonEmptyString(entry['source'])) return `inventory[${i}].source is missing or not a string`
		const quantity = entry['quantity']
		if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) {
			return `inventory[${i}].quantity must be a whole number of at least 1`
		}
		const equipped = entry['equipped']
		if (equipped !== undefined && equipped !== 'worn' && equipped !== 'held') {
			return `inventory[${i}].equipped must be "worn" or "held" when present`
		}
		const attackAbility = entry['attackAbility']
		if (attackAbility !== undefined && attackAbility !== 'strength' && attackAbility !== 'dexterity') {
			return `inventory[${i}].attackAbility must be "strength" or "dexterity" when present`
		}
	}
	const worn = value.filter((entry) => (entry as Record<string, unknown>)['equipped'] === 'worn')
	if (worn.length > 1) {
		return `inventory may not have more than one worn item (found ${worn.length})`
	}
	return null
}

/**
 * Validates an optional `currencyCopper` field (build order step 7, slice a1)
 * — a single non-negative whole number of copper pieces. Returns null if the
 * field is absent (absent means zero).
 */
export function describeCurrencyError(value: unknown): string | null {
	if (value === undefined) return null
	if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
		return `currencyCopper must be a non-negative whole number`
	}
	return null
}

function toCharacterInventory(value: unknown[]): CharacterInventoryItem[] {
	return value.map((entry) => {
		const record = entry as Record<string, unknown>
		const equipped = record['equipped']
		const attackAbility = record['attackAbility']
		return {
			name: record['name'] as string,
			source: record['source'] as string,
			quantity: record['quantity'] as number,
			...(equipped !== undefined ? { equipped: equipped as EquippedSlot } : {}),
			...(attackAbility !== undefined ? { attackAbility: attackAbility as WeaponAttackAbility } : {}),
		}
	})
}

function toCharacterWildShapeForms(value: unknown[]): CharacterWildShapeForms[] {
	return value.map((entry) => {
		const record = entry as Record<string, unknown>
		return {
			className: record['className'] as string,
			classSource: record['classSource'] as string,
			forms: (record['forms'] as Record<string, unknown>[]).map((form) => ({
				name: form['name'] as string,
				source: form['source'] as string,
			})),
		}
	})
}

function toCharacterClassFeatureChoices(value: unknown[]): CharacterClassFeatureChoice[] {
	return value.map((entry) => {
		const record = entry as Record<string, unknown>
		return {
			className: record['className'] as string,
			classSource: record['classSource'] as string,
			featureName: record['featureName'] as string,
			grantedAtLevel: record['grantedAtLevel'] as number,
			optionName: record['optionName'] as string,
		}
	})
}

function toCharacterSubclassSpellChoices(value: unknown[]): CharacterSubclassSpellChoice[] {
	return value.map((entry) => {
		const record = entry as Record<string, unknown>
		const picks = record['picks'] as Record<string, unknown>[]
		return {
			subclassName: record['subclassName'] as string,
			subclassSource: record['subclassSource'] as string,
			className: record['className'] as string,
			classSource: record['classSource'] as string,
			picks: picks.map((pick) => ({
				grantedAtLevel: pick['grantedAtLevel'] as number,
				slotIndex: pick['slotIndex'] as number,
				name: pick['name'] as string,
				source: pick['source'] as string,
			})),
		}
	})
}

function toCharacterSpellChoices(value: unknown[]): CharacterSpellChoice[] {
	return value.map((entry) => {
		const record = entry as Record<string, unknown>
		const spells = record['spells'] as Record<string, unknown>[]
		return {
			className: record['className'] as string,
			classSource: record['classSource'] as string,
			spells: spells.map((spell) => ({ name: spell['name'] as string, source: spell['source'] as string })),
		}
	})
}

function toCharacterFeatAsiChoices(value: unknown[]): FeatAsiChoice[] {
	return value.map((entry) => {
		const record = entry as Record<string, unknown>
		const level = record['level'] as number
		if (record['kind'] === 'asi') {
			return { level, kind: 'asi', increases: toAbilityIncreaseMap(record['increases'] as Record<string, unknown>) }
		}
		const chosenAbility = record['chosenAbility']
		const magicInitiate = record['magicInitiate']
		const filterChoiceSpells = record['filterChoiceSpells']
		return {
			level,
			kind: 'feat',
			name: record['name'] as string,
			source: record['source'] as string,
			...(typeof chosenAbility === 'string' ? { chosenAbility: chosenAbility as Ability } : {}),
			...(isRecord(magicInitiate) ? { magicInitiate: toMagicInitiateChoice(magicInitiate) } : {}),
			...(isRecord(filterChoiceSpells) ? { filterChoiceSpells: toFilterChoiceSpellsChoice(filterChoiceSpells) } : {}),
		}
	})
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
	const speciesSkillsError = describeSpeciesSkillsError(value['speciesSkills'])
	if (speciesSkillsError) return `[${index}].${speciesSkillsError}`
	const expertiseSkillsError = describeExpertiseSkillsError(value['expertiseSkills'])
	if (expertiseSkillsError) return `[${index}].${expertiseSkillsError}`
	const masteriesError = describeMasteriesError(value['masteries'])
	if (masteriesError) return `[${index}].${masteriesError}`
	const fightingStyleError = describeFightingStyleError(value['fightingStyle'])
	if (fightingStyleError) return `[${index}].${fightingStyleError}`
	const optionalFeatureChoicesError = describeOptionalFeatureChoicesError(value['optionalFeatureChoices'])
	if (optionalFeatureChoicesError) return `[${index}].${optionalFeatureChoicesError}`
	const featAsiChoicesError = describeFeatAsiChoicesError(value['featAsiChoices'])
	if (featAsiChoicesError) return `[${index}].${featAsiChoicesError}`
	const spellChoicesError = describeSpellChoicesError(value['spellChoices'])
	if (spellChoicesError) return `[${index}].${spellChoicesError}`
	const subclassSpellChoicesError = describeSubclassSpellChoicesError(value['subclassSpellChoices'])
	if (subclassSpellChoicesError) return `[${index}].${subclassSpellChoicesError}`
	const classFeatureChoicesError = describeClassFeatureChoicesError(value['classFeatureChoices'])
	if (classFeatureChoicesError) return `[${index}].${classFeatureChoicesError}`
	const wildShapeFormsError = describeWildShapeFormsError(value['wildShapeForms'])
	if (wildShapeFormsError) return `[${index}].${wildShapeFormsError}`
	const familiarError = describeFamiliarError(value['familiar'])
	if (familiarError) return `[${index}].${familiarError}`
	const inventoryError = describeInventoryError(value['inventory'])
	if (inventoryError) return `[${index}].${inventoryError}`
	const currencyError = describeCurrencyError(value['currencyCopper'])
	if (currencyError) return `[${index}].${currencyError}`
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
	const speciesSkills = value['speciesSkills']
	const expertiseSkills = value['expertiseSkills']
	const masteries = value['masteries']
	const fightingStyle = value['fightingStyle']
	const optionalFeatureChoices = value['optionalFeatureChoices']
	const featAsiChoices = value['featAsiChoices']
	const spellChoices = value['spellChoices']
	const subclassSpellChoices = value['subclassSpellChoices']
	const classFeatureChoices = value['classFeatureChoices']
	const wildShapeForms = value['wildShapeForms']
	const familiar = value['familiar']
	const inventory = value['inventory']
	const currencyCopper = value['currencyCopper']
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
		...(Array.isArray(speciesSkills) ? { speciesSkills: speciesSkills as string[] } : {}),
		...(Array.isArray(expertiseSkills) ? { expertiseSkills: expertiseSkills as string[] } : {}),
		...(Array.isArray(masteries) ? { masteries: masteries as string[] } : {}),
		...(fightingStyle !== undefined ? { fightingStyle: fightingStyle as string | null } : {}),
		...(Array.isArray(optionalFeatureChoices)
			? { optionalFeatureChoices: toCharacterOptionalFeatureChoices(optionalFeatureChoices) }
			: {}),
		...(Array.isArray(featAsiChoices) ? { featAsiChoices: toCharacterFeatAsiChoices(featAsiChoices) } : {}),
		...(Array.isArray(spellChoices) ? { spellChoices: toCharacterSpellChoices(spellChoices) } : {}),
		...(Array.isArray(subclassSpellChoices) ? { subclassSpellChoices: toCharacterSubclassSpellChoices(subclassSpellChoices) } : {}),
		...(Array.isArray(classFeatureChoices) ? { classFeatureChoices: toCharacterClassFeatureChoices(classFeatureChoices) } : {}),
		...(Array.isArray(wildShapeForms) ? { wildShapeForms: toCharacterWildShapeForms(wildShapeForms) } : {}),
		...(isRecord(familiar) ? { familiar: toCharacterFamiliar(familiar) } : {}),
		...(Array.isArray(inventory) ? { inventory: toCharacterInventory(inventory) } : {}),
		...(typeof currencyCopper === 'number' ? { currencyCopper } : {}),
	}
}

export function toStoredCharacter(value: Record<string, unknown>): StoredCharacter {
	return {
		...toCharacter(value),
		schemaVersion: value['schemaVersion'] as number,
	}
}

/**
 * True for the current version and for every older one a migration chain
 * reaches (D69). A version from a future release, or one older than the chain
 * goes back, is still rejected outright rather than guessed at.
 */
export function isSupportedVersion(version: number): boolean {
	return version === CURRENT_SCHEMA_VERSION || canMigrateToCurrent(version)
}
