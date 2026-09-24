/*
 * Build order step 8, slice 8d2: what does level N add?
 *
 * Every existing answer in this app is CUMULATIVE — "what does the character
 * have up to level N". The per-level answer is the difference between two such
 * calls, one at N and one at N-1, so no hand-written table of levels exists
 * here and none is needed (D101). Pure (D38): classes.json and the four
 * resolver files are passed in, nothing is fetched.
 *
 * No UI shape crosses this boundary: the result is counts, names and levels.
 * Mapping a step's answer onto the wizard's own visibility rules is slice 8d3's
 * job, and this module must stay testable without one.
 *
 * The D46 survey run before writing this
 * (scripts/investigate-closure-level-drift.js) asked whether
 * grantedClassFeaturesFrom's transitive closure can reach a feature whose own
 * `level` differs from the level of the feature that seeded it. It can: 45 of
 * 338 plain-text ref edges cross levels, every one of them DOWNWARD (a level-3
 * subclass wrapper such as Cleric's Order Domain pulling in its own level-1
 * features); none reaches upward. So "features new at level N" is NOT the
 * closure filtered to `level === N` — that would drop those 45 — and the
 * difference of two whole closures, keyed by feature id, is what this module
 * takes.
 *
 * A subclass is stripped from the N-1 side whenever the class chooses its
 * subclass at a level above N-1 (subclassLevelFor). Without that, a level-1
 * subclass feature of a subclass first taken at 3 would count as already held
 * at level 2, and every choice that subclass carries would silently vanish
 * from the level-3 answer.
 */

import { wildShapeLimits } from '../beasts/wildShapeData'
import { computeSpellCounts } from '../calculation/spellCounts'
import { classFeatureChoicesFrom } from '../classFeatureChoices/classFeatureChoiceData'
import { WIZARD_STEPS, type WizardStep } from '../creation/wizardState'
import { loadDataFile } from '../dataLoader/dataLoader'
import { expertiseEligibilityFor } from '../expertise/expertiseData'
import { featAsiGrantsFor } from '../featAsi/featAsiData'
import { loadResolverData, type ResolverData } from '../featureResolver'
import { classFeatureLanguageGrantsFor } from '../languages/classFeatureLanguages'
import { grantsFightingStyleAt } from '../fightingStyle/fightingStyleData'
import { masteryCountFor } from '../masteries/masteryData'
import { classOptionalFeatureGrantsFor, optionalFeatureChoicesFor } from '../optionalFeatures/optionalFeatureData'
import { grantedClassFeaturesFrom } from '../sheet/grantedClassFeatures'
import { extractSpellCountClassData } from '../spells/spellCountClassData'
import { subclassSpellChoiceShape, unlockedSubclassSpellChoiceSlots } from '../spells/subclassSpellChoiceData'
import type { Character } from '../storage/character'
import { subclassLevelFor } from '../subclass/subclassData'

/**
 * 'adds'    — the step collects something new at this level; `count` says how much.
 * 'none'    — the step exists at this level but its cumulative total is unchanged.
 * 'never'   — the step can never add anything after character creation.
 * 'unknown' — D43: the data needed could not be read. Never collapsed into 'none'.
 */
export type LevelGainStatus = 'adds' | 'none' | 'never' | 'unknown'

/** One contributor to a step's count, named as the data names it. */
export interface LevelGainPart {
	name: string
	count: number
}

export interface LevelGain {
	status: LevelGainStatus
	/** How many new picks the step asks for at this level. 0 for every status but 'adds'. */
	count: number
	/** What made up `count` — empty unless status is 'adds'. */
	parts: LevelGainPart[]
	/** Why the answer is 'never' or 'unknown'. Absent for 'adds' and 'none'. */
	reason?: string
}

/** A class or subclass feature the character gains at this level. No wizard step collects these; they are what the level grants outright. */
export interface NewFeature {
	id: string
	name: string
	/** The feature's own `level` field, which is NOT always the level it arrives at — see the module comment. */
	level: number
	kind: 'class' | 'subclass'
}

export interface LevelGains {
	level: number
	/**
	 * Non-null when the whole question cannot be answered (no class, more than
	 * one class, a level that is not a character level, a class missing from
	 * classes.json). Every step then carries 'unknown' with this same reason and
	 * `newFeatures` is empty — never a zero that reads like "adds nothing".
	 */
	unresolved: string | null
	newFeatures: NewFeature[]
	steps: Record<WizardStep, LevelGain>
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function adds(parts: LevelGainPart[]): LevelGain {
	const kept = parts.filter((part) => part.count > 0)
	const count = kept.reduce((total, part) => total + part.count, 0)
	return count > 0 ? { status: 'adds', count, parts: kept } : { status: 'none', count: 0, parts: [] }
}

function never(reason: string): LevelGain {
	return { status: 'never', count: 0, parts: [], reason }
}

function unknownGain(reason: string): LevelGain {
	return { status: 'unknown', count: 0, parts: [], reason }
}

function everyStep(gain: LevelGain): Record<WizardStep, LevelGain> {
	return Object.fromEntries(WIZARD_STEPS.map((step) => [step, gain])) as Record<WizardStep, LevelGain>
}

interface ClassEntryFields {
	subclassTitle: string | null
}

function findClassEntry(parsedClasses: unknown[], className: string, classSource: string): ClassEntryFields | null {
	const entry = parsedClasses.find(
		(candidate) => isRecord(candidate) && candidate['entryType'] === 'class' && candidate['name'] === className && candidate['source'] === classSource,
	)
	if (!isRecord(entry)) return null
	return { subclassTitle: typeof entry['subclassTitle'] === 'string' ? entry['subclassTitle'] : null }
}

/** The stored subclass NAME resolved back to its classes.json entry — storage keeps no source, and every count below needs one. */
function findSubclassSource(parsedClasses: unknown[], className: string, classSource: string, subclassName: string): string | null {
	const entry = parsedClasses.find(
		(candidate) =>
			isRecord(candidate) &&
			candidate['entryType'] === 'subclass' &&
			candidate['className'] === className &&
			candidate['classSource'] === classSource &&
			typeof candidate['name'] === 'string' &&
			candidate['name'].toLowerCase() === subclassName.toLowerCase(),
	)
	if (!isRecord(entry)) return null
	return typeof entry['source'] === 'string' ? entry['source'] : null
}

/**
 * The character as it stood at `level`: the class level replaced, and the
 * subclass present only once the class actually chooses one. Everything else is
 * carried unchanged — a choice already recorded is a fact about the character,
 * not a guess about a level.
 */
function characterAtLevel(character: Character, level: number, subclassGrantLevel: number | null): Character {
	const characterClass = character.classes[0]
	const keepSubclass = subclassGrantLevel === null || level >= subclassGrantLevel
	return {
		...character,
		classes: [{ ...characterClass, level, subclass: keepSubclass ? characterClass.subclass : null }],
	}
}

/** The subclass in force at `level`, or null before the class chooses one. */
function subclassAtLevel(
	character: Character,
	level: number,
	subclassGrantLevel: number | null,
	subclassSource: string | null,
): { name: string; source: string } | null {
	const name = character.classes[0].subclass
	if (!name || subclassSource === null) return null
	if (subclassGrantLevel !== null && level < subclassGrantLevel) return null
	return { name, source: subclassSource }
}

/**
 * What the wizard's every step collects at `level` that it did not already
 * collect at `level - 1`, plus the features the level grants outright.
 *
 * `parsedClasses` is classes.json; `resolverData` carries class-features.json,
 * subclass-features.json, optional-features.json and feats.json.
 */
export function levelGainsFor(character: Character, level: number, parsedClasses: unknown, resolverData: ResolverData): LevelGains {
	if (!Array.isArray(parsedClasses)) throw new Error('classes.json: expected a top-level array.')

	const blocked = unresolvedReason(character, level, parsedClasses)
	if (blocked !== null) {
		return { level, unresolved: blocked, newFeatures: [], steps: everyStep(unknownGain(blocked)) }
	}

	const characterClass = character.classes[0]
	const { className, classSource } = characterClass
	const previous = level - 1
	const classEntry = findClassEntry(parsedClasses, className, classSource)
	const subclassGrantLevel = subclassLevelFor(parsedClasses, resolverData.classFeatures, className, classSource)
	const subclassSource = characterClass.subclass ? findSubclassSource(parsedClasses, className, classSource, characterClass.subclass) : null
	const subclassUnreadable = characterClass.subclass !== null && subclassSource === null

	const now = characterAtLevel(character, level, subclassGrantLevel)
	const before = characterAtLevel(character, previous, subclassGrantLevel)

	return {
		level,
		unresolved: null,
		newFeatures: newFeaturesBetween(before, now, parsedClasses, resolverData),
		steps: {
			class: classStepGain(
				character,
				level,
				previous,
				parsedClasses,
				resolverData,
				{ subclassGrantLevel, subclassSource, subclassUnreadable },
				classEntry?.subclassTitle ?? null,
			),
			species: never('A species, its variant, its skills and its spellcasting ability are all chosen at creation; nothing in species.json is keyed to character level.'),
			background: never('A background, its ability-bonus distribution and its tool proficiency are all chosen at creation.'),
			expertise: expertiseStepGain(resolverData, className, classSource, level, previous),
			// D172: the creation picks never grow; a class feature's free picks (Deft Explorer at Ranger 2) arrive with its level.
			languages: adds(
				classFeatureLanguageGrantsFor([{ className, classSource, level }]).flatMap((grant) =>
					grant.choice && grant.level === level ? [{ name: grant.featureName, count: grant.choice.count }] : [],
				),
			),
			abilities: never('Ability scores are set at creation. A later level raises them only through the featAsi step, never through this one.'),
			spells: spellsStepGain(before, now, parsedClasses, level, previous, {
				subclassGrantLevel,
				subclassSource,
				subclassUnreadable,
				className,
				classSource,
			}),
			classOptionalFeatures: classOptionalFeaturesStepGain(parsedClasses, className, classSource, level, previous),
			featAsi: featAsiStepGain(resolverData, className, classSource, level),
			hitPoints: hitPointsStepGain(level),
			equipment: never('Starting equipment is a one-time grant taken at creation (D100); the inventory after that is play state the sheet edits.'),
			review: never('The review step collects nothing at any level — it is where the save happens.'),
		},
	}
}

function unresolvedReason(character: Character, level: number, parsedClasses: unknown[]): string | null {
	if (!Number.isInteger(level) || level < 1) return `Level ${level} is not a character level.`
	if (character.classes.length === 0) return 'This character has no class.'
	// D11/build order step 10: nothing here can tell which class a new level belongs to, and guessing would answer the wrong class's question.
	if (character.classes.length > 1) {
		return `Multiclass characters are build order step 10: this character has ${character.classes.length} classes and nothing records which one the new level belongs to.`
	}
	const { className, classSource } = character.classes[0]
	if (findClassEntry(parsedClasses, className, classSource) === null) {
		return `No entry for class "${className}" (${classSource}) in classes.json.`
	}
	return null
}

function newFeaturesBetween(before: Character, now: Character, parsedClasses: unknown, resolverData: ResolverData): NewFeature[] {
	const held = new Set(grantedClassFeaturesFrom(before, parsedClasses, resolverData).map((feature) => feature.id))
	return grantedClassFeaturesFrom(now, parsedClasses, resolverData)
		.filter((feature) => !held.has(feature.id))
		.map(({ id, name, level, kind }) => ({ id, name, level, kind }))
}

/** Where in the class's own progression a subclass sits, and whether the stored one could be read at all. */
interface SubclassContext {
	subclassGrantLevel: number | null
	subclassSource: string | null
	subclassUnreadable: boolean
}

/**
 * The class step carries six different collections (D13, D21, D97): the
 * subclass itself, a fighting style, weapon masteries, the subclass's own
 * optionalfeatureProgression picks, the D21 class-feature choices, and a
 * Druid's Wild Shape forms. Class SKILLS are not among them — the class grants
 * its skill proficiencies once, at level 1.
 */
function classStepGain(
	character: Character,
	level: number,
	previous: number,
	parsedClasses: unknown[],
	resolverData: ResolverData,
	context: SubclassContext,
	subclassTitle: string | null,
): LevelGain {
	const { className, classSource } = character.classes[0]

	if (context.subclassGrantLevel === null) {
		return unknownGain(`Cannot tell at which level "${className}" (${classSource}) chooses a subclass: no subclassTitle on the class, or no class feature of that name.`)
	}
	if (context.subclassUnreadable) {
		return unknownGain(`Subclass "${character.classes[0].subclass}" is not in classes.json, so nothing it grants at level ${level} can be counted.`)
	}

	const parts: LevelGainPart[] = []

	if (context.subclassGrantLevel === level) parts.push({ name: subclassTitle ?? 'Subclass', count: 1 })

	if (grantsFightingStyleAt(resolverData.classFeatures, className, classSource) === level) {
		parts.push({ name: 'Fighting Style', count: 1 })
	}

	// masteryCountFor is null both for a class without Weapon Mastery and for a level below the grant — both are "no picks", and the class itself was found above.
	const masteryNow = masteryCountFor(parsedClasses, className, classSource, level) ?? 0
	const masteryBefore = masteryCountFor(parsedClasses, className, classSource, previous) ?? 0
	parts.push({ name: 'Weapon Mastery', count: masteryNow - masteryBefore })

	const subclassName = character.classes[0].subclass
	const formsNow = wildShapeLimits(className, level, subclassName)?.knownForms ?? 0
	const formsBefore = wildShapeLimits(className, previous, subclassName)?.knownForms ?? 0
	parts.push({ name: 'Wild Shape', count: formsNow - formsBefore })

	for (const choice of classFeatureChoicesFrom(resolverData.classFeatures, resolverData, className, classSource, level)) {
		if (choice.grantedAtLevel === level) parts.push({ name: choice.featureName, count: choice.count })
	}

	parts.push(subclassOptionalFeaturePart(character, level, previous, parsedClasses, resolverData, context))

	return adds(parts)
}

/** The subclass's OWN optionalfeatureProgression (Battle Master maneuvers, Rune Knight runes) — the class's own progressions are the classOptionalFeatures step instead. */
function subclassOptionalFeaturePart(
	character: Character,
	level: number,
	previous: number,
	parsedClasses: unknown[],
	resolverData: ResolverData,
	context: SubclassContext,
): LevelGainPart {
	const { className, classSource } = character.classes[0]
	const countAt = (at: number): number => {
		const subclass = subclassAtLevel(character, at, context.subclassGrantLevel, context.subclassSource)
		if (!subclass) return 0
		return (
			optionalFeatureChoicesFor(
				parsedClasses,
				resolverData.optionalFeatures,
				resolverData.feats,
				className,
				classSource,
				subclass.name,
				subclass.source,
				at,
			)?.count ?? 0
		)
	}
	return { name: character.classes[0].subclass ?? 'Subclass options', count: countAt(level) - countAt(previous) }
}

function expertiseStepGain(resolverData: ResolverData, className: string, classSource: string, level: number, previous: number): LevelGain {
	const countAt = (at: number): number => expertiseEligibilityFor(resolverData.classFeatures, className, classSource, at)?.count ?? 0
	return adds([{ name: 'Expertise', count: countAt(level) - countAt(previous) }])
}

interface SpellsContext extends SubclassContext {
	className: string
	classSource: string
}

function spellsStepGain(
	before: Character,
	now: Character,
	parsedClasses: unknown,
	level: number,
	previous: number,
	context: SpellsContext,
): LevelGain {
	if (context.subclassUnreadable) {
		return unknownGain(`Subclass "${now.classes[0].subclass}" is not in classes.json, so its spell choices at level ${level} cannot be counted.`)
	}

	const classData = extractSpellCountClassData(parsedClasses)
	const countsNow = computeSpellCounts(now, classData)
	const countsBefore = computeSpellCounts(before, classData)
	if (countsNow.status === 'unknown') return unknownGain(countsNow.reason)
	if (countsBefore.status === 'unknown') return unknownGain(countsBefore.reason)

	const sum = (entries: { cantripCount: number; leveledSpellCount: number }[], field: 'cantripCount' | 'leveledSpellCount'): number =>
		entries.reduce((total, entry) => total + entry[field], 0)

	const parts: LevelGainPart[] = [
		{ name: 'Cantrips', count: sum(countsNow.value, 'cantripCount') - sum(countsBefore.value, 'cantripCount') },
		{ name: 'Leveled spells', count: sum(countsNow.value, 'leveledSpellCount') - sum(countsBefore.value, 'leveledSpellCount') },
	]

	const subclass = subclassAtLevel(now, level, context.subclassGrantLevel, context.subclassSource)
	if (subclass) {
		const shape = subclassSpellChoiceShape(parsedClasses, subclass.name, subclass.source, context.className, context.classSource)
		const slotsNow = unlockedSubclassSpellChoiceSlots(shape, level).length
		// The same shape read at the earlier level, but only where the subclass was already held.
		const heldBefore = subclassAtLevel(before, previous, context.subclassGrantLevel, context.subclassSource) !== null
		const slotsBefore = heldBefore ? unlockedSubclassSpellChoiceSlots(shape, previous).length : 0
		parts.push({ name: `${subclass.name} spell choices`, count: slotsNow - slotsBefore })
	}

	return adds(parts)
}

function classOptionalFeaturesStepGain(parsedClasses: unknown[], className: string, classSource: string, level: number, previous: number): LevelGain {
	const grantsBefore = classOptionalFeatureGrantsFor(parsedClasses, className, classSource, previous)
	return adds(
		classOptionalFeatureGrantsFor(parsedClasses, className, classSource, level).map((grant) => ({
			name: grant.name ?? grant.featureType,
			count: grant.count - (grantsBefore.find((earlier) => earlier.featureType === grant.featureType)?.count ?? 0),
		})),
	)
}

/** D16/D19: which levels grant an ASI-or-feat choice is per-class, so the grants at exactly this level are read from the data rather than tested against 4/8/12/16/19. */
function featAsiStepGain(resolverData: ResolverData, className: string, classSource: string, level: number): LevelGain {
	return adds(
		featAsiGrantsFor(resolverData.classFeatures, className, classSource, level)
			.filter((grant) => grant.level === level)
			.map((grant) => ({ name: grant.kind === 'epicBoon' ? 'Epic Boon' : 'Ability Score Improvement', count: 1 })),
	)
}

/** D92: level 1 is always the hit die maximum and is never asked for; every level from 2 up needs exactly one recorded roll-or-average. */
function hitPointsStepGain(level: number): LevelGain {
	return adds([{ name: 'Hit points', count: level >= 2 ? 1 : 0 }])
}

/** Fetches classes.json and the four resolver files and returns levelGainsFor's result. */
export async function loadLevelGainsFor(character: Character, level: number): Promise<LevelGains> {
	const [classes, resolverData] = await Promise.all([loadDataFile('data/classes.json'), loadResolverData()])
	return levelGainsFor(character, level, classes, resolverData)
}
