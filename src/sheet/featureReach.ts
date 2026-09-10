/*
 * The class/subclass/level test a class-features.json or subclass-features.json
 * entry must pass to count as "reached" by a character at its current levels.
 *
 * Extracted from featureNamesFor (weaponAttackData.ts) so the full class/subclass
 * feature resolver (grantedClassFeatures.ts) tests membership the SAME way rather
 * than re-deriving the className/classSource/subclassShortName/subclassSource
 * join a second time (D87). Pure — classes.json is passed in, never fetched (D38).
 */

import type { Character } from '../storage/character'
import { resolveSubclassShortName } from './armourClassData'

/** The fields buildFeatureReachTest inspects; a class feature has no `subclassShortName`, a subclass feature carries both. */
export interface ReachableFeature {
	className: string
	classSource: string
	level: number
	subclassShortName?: string
	subclassSource?: string
}

/**
 * A predicate over class-features.json / subclass-features.json entries: true
 * when some class the character has reaches that feature at its current level.
 * A subclass feature also needs the character's stored subclass NAME to resolve
 * (via classes.json) to the shortName + source the feature is filed under; an
 * unresolvable subclass matches nothing rather than guessing.
 */
export function buildFeatureReachTest(character: Character, parsedClasses: unknown): (feature: ReachableFeature) => boolean {
	const reaches = character.classes.map((characterClass) => ({
		characterClass,
		subclass: characterClass.subclass
			? resolveSubclassShortName(parsedClasses, characterClass.className, characterClass.classSource, characterClass.subclass)
			: null,
	}))

	return (feature) =>
		reaches.some(({ characterClass, subclass }) => {
			if (feature.className !== characterClass.className || feature.classSource !== characterClass.classSource) return false
			if (feature.level > characterClass.level) return false
			if (feature.subclassShortName === undefined) return true
			return subclass !== null && feature.subclassShortName === subclass.shortName && feature.subclassSource === subclass.source
		})
}
