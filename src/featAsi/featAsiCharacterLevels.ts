import { type Calculated, known, unknown } from '../calculation/types'
import { type Character, isConsistentLevelOrder } from '../storage/character'
import { featAsiGrantsFor, type FeatAsiGrantKind } from './featAsiData'

export interface FeatAsiCharacterLevelGrant {
	characterLevel: number
	className: string
	classSource: string
	classLevel: number
	kind: FeatAsiGrantKind
}

/**
 * D328: each class's ASI / Epic Boon grants (keyed by class level) placed at the character level that took
 * that class level. FeatAsiChoice.level stays the character level, so this is the bridge between the two.
 */
export function featAsiCharacterLevels(character: Pick<Character, 'classes' | 'levelOrder'>, parsedClassFeatures: unknown): Calculated<FeatAsiCharacterLevelGrant[]> {
	const { classes, levelOrder } = character
	if (classes.length <= 1) {
		return known(
			classes.flatMap(({ className, classSource, level }) =>
				featAsiGrantsFor(parsedClassFeatures, className, classSource, level).map((grant) => ({ characterLevel: grant.level, className, classSource, classLevel: grant.level, kind: grant.kind })),
			),
			[],
		)
	}
	if (!levelOrder || !isConsistentLevelOrder(levelOrder, classes)) {
		return unknown('Cannot tell at which character level each class level was taken (no level history).')
	}
	const reached = new Map<string, number>()
	const result: FeatAsiCharacterLevelGrant[] = []
	levelOrder.forEach(({ className, classSource }, index) => {
		const key = `${className}|${classSource}`
		const classLevel = (reached.get(key) ?? 0) + 1
		reached.set(key, classLevel)
		for (const grant of featAsiGrantsFor(parsedClassFeatures, className, classSource, classLevel)) {
			if (grant.level === classLevel) result.push({ characterLevel: index + 1, className, classSource, classLevel, kind: grant.kind })
		}
	})
	return known(result, [])
}
