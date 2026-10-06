import { describe, expect, it } from 'vitest'
import { featAsiCharacterLevels } from './featAsiCharacterLevels'
import { RESOLVER } from '../levelUp/levelGains.fixtures'
import type { Character } from '../storage/character'

const W = { className: 'Warlock', classSource: 'XPHB' }
const S = { className: 'Sorcerer', classSource: 'XPHB' }
const warlockSorcerer = (levelOrder?: (typeof W)[]): Pick<Character, 'classes' | 'levelOrder'> => ({
	classes: [
		{ ...W, subclass: null, level: 6 },
		{ ...S, subclass: null, level: 3 },
	],
	...(levelOrder ? { levelOrder } : {}),
})
const levels = (character: Pick<Character, 'classes' | 'levelOrder'>) => {
	const result = featAsiCharacterLevels(character, RESOLVER.classFeatures)
	if (result.status !== 'known') throw new Error(result.reason)
	return result.value.map(({ characterLevel, className, classLevel, kind }) => [characterLevel, className, classLevel, kind])
}

describe('featAsiCharacterLevels (D328)', () => {
	it('Warlock 6 then Sorcerer 3: the Warlock ASI at character level 4, nothing from Sorcerer', () => {
		expect(levels(warlockSorcerer([W, W, W, W, W, W, S, S, S]))).toEqual([[4, 'Warlock', 4, 'asi']])
	})

	it('Warlock 3, Sorcerer 3, Warlock 3: the Warlock ASI at character level 7', () => {
		expect(levels(warlockSorcerer([W, W, W, S, S, S, W, W, W]))).toEqual([[7, 'Warlock', 4, 'asi']])
	})

	it('a single-class Fighter 6 needs no level history: 4 and 6', () => {
		expect(levels({ classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 6 }] })).toEqual([
			[4, 'Fighter', 4, 'asi'],
			[6, 'Fighter', 6, 'asi'],
		])
	})

	it('more than one class without a level history is unknown', () => {
		expect(featAsiCharacterLevels(warlockSorcerer(), RESOLVER.classFeatures)).toEqual({
			status: 'unknown',
			reason: 'Cannot tell at which character level each class level was taken (no level history).',
		})
	})
})
