import {
	evaluateClassOptionalFeatureGroups,
	type ClassOptionalFeatureContextBase,
	type ClassOptionalFeatureGroup,
} from './optionalFeatureData'
import { hasPactOfTheChain } from '../beasts/beastData'
import { itemInvocationGrants } from '../inventory/customItemGrants'
import { compareText } from '../text/compareText'
import {
	choiceNames,
	type CharacterFamiliar,
	type CharacterFightingStyle,
	type CharacterInventoryItem,
	type CharacterOptionalFeatureChoice,
	type CharacterOptionalFeaturePick,
} from '../storage/character'

/** D345: the class option kinds a level up may replace one of (F-20a). */
export const SWAPPABLE_CLASS_OPTION_TYPES: readonly string[] = ['EI', 'MM']

/** D345 (F-20b): the subclass option kinds — Rune Knight runes and Battle Master maneuvers. */
export const SWAPPABLE_SUBCLASS_OPTION_TYPES: readonly string[] = ['RN', 'MV:B']

/** D345 (F-20b): only the Fighter's own style is replaceable; Paladin and Ranger styles are not. */
export const SWAPPABLE_STYLE_CLASS = 'Fighter'

/** D382: how many copies of `name` the picks hold. */
export function copiesOf(choices: readonly { name: string }[] | undefined, name: string): number {
	return (choices ?? []).filter((choice) => choice.name === name).length
}

/** D382: the names in `before` missing from `after`, one entry per lost copy. */
export function lostCopies(before: readonly string[], after: readonly string[]): string[] {
	const left = [...after]
	return before.filter((name) => {
		const index = left.indexOf(name)
		if (index === -1) return true
		left.splice(index, 1)
		return false
	})
}

/** D382: drops the last copy of `name`; a copy new to this walk sits after the held ones, so it goes first. */
export function withoutOneCopy<T extends { name: string }>(choices: readonly T[], name: string): T[] {
	const index = choices.findLastIndex((choice) => choice.name === name)
	return index === -1 ? [...choices] : [...choices.slice(0, index), ...choices.slice(index + 1)]
}

/** D382: "Lessons of the First Ones (x2)" — the shown name of a pick held more than once. */
export function withCopies(name: string, copies: number): string {
	return copies > 1 ? `${name} (x${copies})` : name
}

/** D382: each name once, sorted, a repeated one with its count. */
export function countedNames(names: readonly string[]): string[] {
	return [...new Set(names)].sort(compareText).map((name) => withCopies(name, names.filter((other) => other === name).length))
}

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
	const now = value.find((entry) => entry.featureType === featureType)?.choices ?? []
	const heldChoices = held.find((entry) => entry.featureType === featureType)?.choices ?? []
	// D382: a repeated invocation is swapped one copy at a time — the held copy the value no longer carries goes.
	return heldChoices.findLast((choice) => copiesOf(now, choice.name) < copiesOf(heldChoices, choice.name)) ?? null
}

/** D345 rule 3: the chosen options that would stop qualifying without `name` — non-empty means it cannot be swapped out. */
export function swapBlockedBy(
	group: ClassOptionalFeatureGroup,
	value: CharacterOptionalFeatureChoice[],
	base: ClassOptionalFeatureContextBase,
	name: string,
): string[] {
	const without = value.map((entry) => (entry.featureType === group.featureType ? { ...entry, choices: withoutOneCopy(entry.choices, name) } : entry))
	const before = new Set(evaluateClassOptionalFeatureGroups([group], value, base)[0].invalidChosen.map((invalid) => invalid.name))
	return evaluateClassOptionalFeatureGroups([group], without, base)[0]
		.invalidChosen.map((invalid) => invalid.name)
		.filter((invalid) => !before.has(invalid))
}

/** D345 rule 4: drops `name` together with its own sub-choices (Pact of the Tome's spells). */
export function swapOut(value: CharacterOptionalFeatureChoice[], featureType: string, name: string): CharacterOptionalFeatureChoice[] {
	return value.map((entry) => {
		if (entry.featureType !== featureType) return entry
		// D382: one copy of a repeated invocation; its sub-choices go only with the last copy.
		const updated: CharacterOptionalFeatureChoice = { ...entry, choices: withoutOneCopy(entry.choices, name) }
		const stillHeld = updated.choices.some((choice) => choice.name === name)
		const keptPicks = (entry.spellChoices ?? []).filter((pick) => stillHeld || pick.optionName.toLowerCase() !== name.toLowerCase())
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
		// D382: counted per copy, so a second copy taken in this walk is fresh even though its name is held.
		const unmatched = [...heldNames]
		const kept: CharacterOptionalFeaturePick[] = []
		const allFresh: CharacterOptionalFeaturePick[] = []
		for (const choice of entry.choices) {
			const index = unmatched.indexOf(choice.name)
			if (index === -1) allFresh.push(choice)
			else {
				unmatched.splice(index, 1)
				kept.push(choice)
			}
		}
		const fresh = allFresh.slice(0, Math.max(0, count - heldNames.length))
		const keptNames = [...choiceNames(fresh), ...heldNames].map((name) => name.toLowerCase())
		const spellChoices = [
			...(entry.spellChoices ?? []).filter((pick) => keptNames.includes(pick.optionName.toLowerCase()) && pick.optionName.toLowerCase() !== dropped.name.toLowerCase()),
			...(heldEntry.spellChoices ?? []).filter((pick) => pick.optionName.toLowerCase() === dropped.name.toLowerCase()),
		]
		const restored: CharacterOptionalFeatureChoice = { ...entry, choices: [...kept, dropped, ...fresh] }
		if (spellChoices.length > 0) restored.spellChoices = spellChoices
		else delete restored.spellChoices
		return restored
	})
}

/** D346 rule 3: the style the Fighter's own feature granted; an untagged pre-58 style is never offered for a swap. */
export function swappableFightingStyle(
	styles: readonly CharacterFightingStyle[] | undefined,
	owner: { className: string; classSource: string } | undefined,
): CharacterFightingStyle | undefined {
	if (owner?.className !== SWAPPABLE_STYLE_CLASS) return undefined
	return (styles ?? []).find((style) => style.className === owner.className && style.classSource === owner.classSource)
}

/**
 * D348: a familiar outlives Pact of the Chain only while the invocation is still held (a pick or a granting item).
 * The familiar goes whatever its form: without the boon the Find Familiar spell may be gone too, and no familiar is
 * always a valid state the Extras tab can refill. Keeping the swap restores the boon, so the familiar stays.
 */
export function familiarAfterOptionChange(
	familiar: CharacterFamiliar | undefined,
	before: readonly CharacterOptionalFeatureChoice[] | undefined,
	after: readonly CharacterOptionalFeatureChoice[] | undefined,
	inventory: readonly CharacterInventoryItem[] | undefined,
): CharacterFamiliar | undefined {
	if (!familiar || !hasPactOfTheChain([...(before ?? [])])) return familiar
	return hasPactOfTheChain([...(after ?? []), { choices: itemInvocationGrants(inventory) }]) ? familiar : undefined
}

/**
 * D347: the picks of `groups` that held their prerequisites in `before` and stop holding them once the selection and
 * the class levels are those of `after`, removed until nothing more falls (Thirsting Blade below Warlock 5, or after
 * Pact of the Blade went). A pick already failing before is left alone — the context may not answer everything.
 * Removed options take their own spell sub-choices with them (D345 rule 4).
 */
export function cascadePrerequisiteLoss(
	groups: ClassOptionalFeatureGroup[],
	before: { selection: CharacterOptionalFeatureChoice[]; base: ClassOptionalFeatureContextBase },
	after: { selection: CharacterOptionalFeatureChoice[]; base: ClassOptionalFeatureContextBase },
): { selection: CharacterOptionalFeatureChoice[]; removed: { featureType: string; name: string; spells: string[] }[] } {
	const key = (featureType: string, name: string): string => `${featureType}|${name.toLowerCase()}`
	const validBefore = new Set(
		evaluateClassOptionalFeatureGroups(groups, before.selection, before.base).flatMap((group) => {
			const invalid = new Set(group.invalidChosen.map((entry) => entry.name.toLowerCase()))
			return group.chosen.filter((name) => !invalid.has(name.toLowerCase())).map((name) => key(group.featureType, name))
		}),
	)
	let selection = after.selection
	const removed: { featureType: string; name: string; spells: string[] }[] = []
	for (;;) {
		const falling = evaluateClassOptionalFeatureGroups(groups, selection, after.base).flatMap((group) =>
			group.invalidChosen.filter((entry) => validBefore.has(key(group.featureType, entry.name))).map((entry) => key(group.featureType, entry.name)),
		)
		if (falling.length === 0) return { selection, removed }
		selection = selection.flatMap((entry) => {
			const choices = entry.choices.filter((choice) => {
				if (!falling.includes(key(entry.featureType, choice.name))) return true
				const spells = (entry.spellChoices ?? [])
					.filter((pick) => pick.optionName.toLowerCase() === choice.name.toLowerCase())
					.flatMap((pick) => [...pick.cantrips, ...pick.spells].map((spell) => spell.name))
				removed.push({ featureType: entry.featureType, name: choice.name, spells })
				return false
			})
			if (choices.length === entry.choices.length) return [entry]
			const spellChoices = (entry.spellChoices ?? []).filter((pick) => !falling.includes(key(entry.featureType, pick.optionName)))
			const updated: CharacterOptionalFeatureChoice = { ...entry, choices }
			if (spellChoices.length > 0) updated.spellChoices = spellChoices
			else delete updated.spellChoices
			return choices.length === 0 && spellChoices.length === 0 ? [] : [updated]
		})
	}
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
	// D382: per copy — the held copy swapped out is the last of its name (withoutOneCopy), the replacement the first copy beyond what was held.
	const droppedName = lostCopies(storedNames, names)[0]
	const dropped = droppedName === undefined ? undefined : (stored ?? []).findLast((choice) => choice.name === droppedName)
	const unmatched = [...storedNames]
	const replacement = dropped
		? choices.find((choice) => {
				const index = unmatched.indexOf(choice.name)
				if (index === -1) return true
				unmatched.splice(index, 1)
				return false
			})
		: undefined
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
