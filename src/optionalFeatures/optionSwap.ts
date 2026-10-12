import {
	evaluateClassOptionalFeatureGroups,
	type ClassOptionalFeatureContextBase,
	type ClassOptionalFeatureGroup,
} from './optionalFeatureData'
import { choiceNames, type CharacterOptionalFeatureChoice, type CharacterOptionalFeaturePick } from '../storage/character'

/** D345: the class option kinds a level up may replace one of (F-20a). */
export const SWAPPABLE_CLASS_OPTION_TYPES: readonly string[] = ['EI', 'MM']

/** D345 (F-20b): the subclass option kinds — Rune Knight runes and Battle Master maneuvers. */
export const SWAPPABLE_SUBCLASS_OPTION_TYPES: readonly string[] = ['RN', 'MV:B']

/** D345 (F-20b): only the Fighter's own style is replaceable; Paladin and Ranger styles are not. */
export const SWAPPABLE_STYLE_CLASS = 'Fighter'

export function holdsSwappableSubclassOption(stored: readonly CharacterOptionalFeatureChoice[] | undefined, featureType: string): boolean {
	return SWAPPABLE_SUBCLASS_OPTION_TYPES.includes(featureType) && (stored ?? []).some((entry) => entry.featureType === featureType && entry.choices.length > 0)
}

/** The held name the walk dropped from a name-list pick (maneuvers, runes, the style), or null. */
export function droppedName(value: readonly string[], held: readonly string[]): string | null {
	return held.find((name) => !value.includes(name)) ?? null
}

/** Puts the dropped name back and trims whatever replaced it beyond the level's own count. */
export function undoNameSwap(value: readonly string[], held: readonly string[], count: number): string[] {
	const kept = value.filter((name) => held.includes(name))
	const fresh = value.filter((name) => !held.includes(name)).slice(0, Math.max(0, count - held.length))
	return [...kept, ...held.filter((name) => !value.includes(name)), ...fresh]
}

export function holdsSwappableOption(stored: readonly CharacterOptionalFeatureChoice[] | undefined, featureType: string): boolean {
	return SWAPPABLE_CLASS_OPTION_TYPES.includes(featureType) && (stored ?? []).some((entry) => entry.featureType === featureType && entry.choices.length > 0)
}

/** The held pick this walk has swapped out, or null. Held picks never leave the value otherwise (D110), so the missing one is the swap. */
export function swappedOut(
	value: readonly CharacterOptionalFeatureChoice[],
	held: readonly CharacterOptionalFeatureChoice[],
	featureType: string,
): CharacterOptionalFeaturePick | null {
	const now = choiceNames(value.find((entry) => entry.featureType === featureType)?.choices)
	return held.find((entry) => entry.featureType === featureType)?.choices.find((choice) => !now.includes(choice.name)) ?? null
}

/** D345 rule 3: the chosen options that would stop qualifying without `name` — non-empty means it cannot be swapped out. */
export function swapBlockedBy(
	group: ClassOptionalFeatureGroup,
	value: CharacterOptionalFeatureChoice[],
	base: ClassOptionalFeatureContextBase,
	name: string,
): string[] {
	const without = value.map((entry) => (entry.featureType === group.featureType ? { ...entry, choices: entry.choices.filter((choice) => choice.name !== name) } : entry))
	const before = new Set(evaluateClassOptionalFeatureGroups([group], value, base)[0].invalidChosen.map((invalid) => invalid.name))
	return evaluateClassOptionalFeatureGroups([group], without, base)[0]
		.invalidChosen.map((invalid) => invalid.name)
		.filter((invalid) => !before.has(invalid))
}

/** D345 rule 4: drops `name` together with its own sub-choices (Pact of the Tome's spells). */
export function swapOut(value: CharacterOptionalFeatureChoice[], featureType: string, name: string): CharacterOptionalFeatureChoice[] {
	return value.map((entry) => {
		if (entry.featureType !== featureType) return entry
		const updated: CharacterOptionalFeatureChoice = { ...entry, choices: entry.choices.filter((choice) => choice.name !== name) }
		const keptPicks = (entry.spellChoices ?? []).filter((pick) => pick.optionName.toLowerCase() !== name.toLowerCase())
		if (keptPicks.length > 0) updated.spellChoices = keptPicks
		else delete updated.spellChoices
		return updated
	})
}

/** Puts the swapped-out pick back exactly as held, sub-choices included, and drops whatever replaced it beyond the level's own count. */
export function undoSwap(
	value: CharacterOptionalFeatureChoice[],
	held: readonly CharacterOptionalFeatureChoice[],
	featureType: string,
	count: number,
): CharacterOptionalFeatureChoice[] {
	const heldEntry = held.find((entry) => entry.featureType === featureType)
	const dropped = swappedOut(value, held, featureType)
	if (!heldEntry || !dropped) return value
	return value.map((entry) => {
		if (entry.featureType !== featureType) return entry
		const heldNames = choiceNames(heldEntry.choices)
		const fresh = entry.choices.filter((choice) => !heldNames.includes(choice.name)).slice(0, Math.max(0, count - heldNames.length))
		const freshNames = choiceNames(fresh)
		const spellChoices = [
			...(entry.spellChoices ?? []).filter((pick) => freshNames.includes(pick.optionName) || heldNames.includes(pick.optionName)),
			...(heldEntry.spellChoices ?? []).filter((pick) => pick.optionName === dropped.name),
		]
		const restored: CharacterOptionalFeatureChoice = { ...entry, choices: [...entry.choices.filter((choice) => heldNames.includes(choice.name)), dropped, ...fresh] }
		if (spellChoices.length > 0) restored.spellChoices = spellChoices
		else delete restored.spellChoices
		return restored
	})
}

/**
 * D345 rule 5: at save, the first new pick of a featureType that lost a held pick takes that pick's level stamp
 * (none for a creation pick), so Remove level keeps removing by stamp. Returns the picks with the stamps settled
 * for that one; every other new pick is left for the caller to stamp.
 */
export function inheritSwapStamp(
	choices: readonly CharacterOptionalFeaturePick[],
	stored: readonly CharacterOptionalFeaturePick[] | undefined,
): { choices: CharacterOptionalFeaturePick[]; replacement: string | null } {
	const names = choiceNames(choices)
	const storedNames = choiceNames(stored)
	const dropped = (stored ?? []).find((choice) => !names.includes(choice.name))
	const replacement = dropped ? choices.find((choice) => !storedNames.includes(choice.name)) : undefined
	if (!dropped || !replacement) return { choices: [...choices], replacement: null }
	return {
		choices: choices.map((choice) => {
			if (choice !== replacement) return choice
			const inherited = { ...choice, level: dropped.level }
			if (inherited.level === undefined) delete inherited.level
			return inherited
		}),
		replacement: replacement.name,
	}
}
