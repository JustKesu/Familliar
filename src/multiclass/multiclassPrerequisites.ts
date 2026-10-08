import { ABILITIES, type Ability } from '../abilities/abilityScores'
import { ABILITY_ABBREVIATIONS } from '../calculation/abilityAbbreviations'
import { loadDataFile } from '../dataLoader/dataLoader'
import { loadBaseClasses } from '../classes/classData'
import { loadFeats } from '../featAsi/featAsiData'
import { abilityScoresBelowLevel } from '../featAsi/featAsiLevels'
import { MAX_CHARACTER_LEVEL } from '../levelUp/levelUpSteps'
import type { Character } from '../storage/character'

interface ClassRef {
	className: string
	classSource: string
}

/** XPHB "Multiclassing > Prerequisites": a 13 in the primary ability of the new class and of every class held. */
export const MULTICLASS_MINIMUM_SCORE = 13

const ABILITY_NAMES: Record<Ability, string> = {
	strength: 'Strength',
	dexterity: 'Dexterity',
	constitution: 'Constitution',
	intelligence: 'Intelligence',
	wisdom: 'Wisdom',
	charisma: 'Charisma',
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** D330 (DATA.md): primaryAbility is an OR of objects, each the AND of its `true` keys. Null when the class has none. */
export function primaryAbilityOf(parsedClasses: unknown, target: ClassRef): Ability[][] | null {
	if (!Array.isArray(parsedClasses)) return null
	const entry = parsedClasses.find((candidate) => isRecord(candidate) && candidate['entryType'] === 'class' && candidate['name'] === target.className && candidate['source'] === target.classSource)
	const primary = isRecord(entry) ? entry['primaryAbility'] : undefined
	if (!Array.isArray(primary) || primary.length === 0) return null
	const alternatives = primary.map((option) => (isRecord(option) ? ABILITIES.filter((ability) => option[ABILITY_ABBREVIATIONS[ability]] === true) : []))
	return alternatives.every((all) => all.length > 0) ? alternatives : null
}

const meetsAll = (all: Ability[], scores: Partial<Record<Ability, number>>): boolean => all.every((ability) => (scores[ability] ?? 0) >= MULTICLASS_MINIMUM_SCORE)

const neededText = (alternatives: Ability[][]): string =>
	alternatives.map((all) => all.map((ability) => `${ABILITY_NAMES[ability]} ${MULTICLASS_MINIMUM_SCORE}`).join(' and ')).join(' or ')

/** Why one class's prerequisite is not met by `scores`, or null when it is. */
function unmetFor(target: ClassRef, held: boolean, parsedClasses: unknown, scores: Partial<Record<Ability, number>>): string | null {
	const alternatives = primaryAbilityOf(parsedClasses, target)
	const owner = held ? `${target.className}, a class you already have` : target.className
	if (alternatives === null) return `Cannot tell the multiclass prerequisite of ${owner}: no primary ability in classes.json.`
	if (alternatives.some((all) => meetsAll(all, scores))) return null
	const needed = neededText(alternatives)
	const named = [...new Set(alternatives.flat())]
	const have = (ability: Ability): string => (scores[ability] === undefined ? 'no score' : String(scores[ability]))
	const youHave = named.length === 1 ? have(named[0]) : named.map((ability) => `${ABILITY_NAMES[ability]} ${have(ability)}`).join(', ')
	return `Needs ${needed} (${owner}). You have ${youHave}.`
}

/**
 * D330: why `character` cannot enter `target`, or null. The new class first, then every class held, each reason
 * on its own sentence. Scores are base + background + species + feats/ASI; items never count (as D253).
 */
export function unmetMulticlassPrerequisite(character: Character, target: ClassRef, parsedClasses: unknown, scores: Partial<Record<Ability, number>>): string | null {
	const reasons = [unmetFor(target, false, parsedClasses, scores), ...character.classes.map((held) => unmetFor(held, true, parsedClasses, scores))].filter(
		(reason): reason is string => reason !== null,
	)
	return reasons.length > 0 ? reasons.join(' ') : null
}

/**
 * D333: a held class of a multiclass Edit whose prerequisite `scores` fall below — a note, never a block. Null when it
 * is met or classes.json names no primary ability.
 */
export function heldClassPrerequisiteNote(target: ClassRef, parsedClasses: unknown, scores: Partial<Record<Ability, number>>): string | null {
	const alternatives = primaryAbilityOf(parsedClasses, target)
	if (alternatives === null || alternatives.some((all) => meetsAll(all, scores))) return null
	return `Below the multiclass prerequisite of ${target.className} (${neededText(alternatives)}). Rules check this only when entering a class.`
}

/** The scores the prerequisite reads: every ASI/feat taken, no items. */
export function multiclassPrerequisiteScores(character: Character, feats: Parameters<typeof abilityScoresBelowLevel>[1]): Partial<Record<Ability, number>> {
	return abilityScoresBelowLevel(character, feats, MAX_CHARACTER_LEVEL + 1)
}

export interface NewClassOption extends ClassRef {
	/** Why the class cannot be entered, or null. */
	unmet: string | null
}

/** D330: the classes the creation picker offers that the character does not hold, each with its prerequisite verdict. */
export async function loadNewClassOptions(character: Character): Promise<NewClassOption[]> {
	const [baseClasses, parsedClasses, feats] = await Promise.all([loadBaseClasses(), loadDataFile('data/classes.json'), loadFeats()])
	const scores = multiclassPrerequisiteScores(character, feats)
	return baseClasses
		.filter((option) => !character.classes.some((held) => held.className === option.name && held.classSource === option.source))
		.map((option) => {
			const target = { className: option.name, classSource: option.source }
			return { ...target, unmet: unmetMulticlassPrerequisite(character, target, parsedClasses, scores) }
		})
}

/** The same verdict for one class, for a level-up route typed or reloaded directly. */
export async function loadUnmetMulticlassPrerequisite(character: Character, target: ClassRef): Promise<string | null> {
	const [parsedClasses, feats] = await Promise.all([loadDataFile('data/classes.json'), loadFeats()])
	return unmetMulticlassPrerequisite(character, target, parsedClasses, multiclassPrerequisiteScores(character, feats))
}
