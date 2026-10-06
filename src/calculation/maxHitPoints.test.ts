import { describe, expect, it } from 'vitest'
import type { Character, CharacterHitPointLevel } from '../storage/character'
import { type ClassHitDie } from './hitDice'
import { computeMaxHitPoints, currentHpAfterMaxHpChange, fixedAverage, HIT_POINT_BONUS_RULES, maxHitPointsDelta } from './maxHitPoints'
import { known, unknown } from './types'

const classData: ClassHitDie[] = [
	{ className: 'Fighter', classSource: 'XPHB', faces: 10 },
	{ className: 'Sorcerer', classSource: 'XPHB', faces: 6 },
	{ className: 'Wizard', classSource: 'XPHB', faces: 6 },
	{ className: 'Warlock', classSource: 'XPHB', faces: 8 },
]

function character(overrides: Partial<Character> = {}): Character {
	return {
		id: 'c1',
		name: 'Aria',
		classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 5 }],
		abilityScores: {
			method: 'standardArray',
			scores: { strength: 10, dexterity: 10, constitution: 14, intelligence: 10, wisdom: 10, charisma: 10 },
		},
		...overrides,
	}
}

function total(result: ReturnType<typeof computeMaxHitPoints>): number {
	if (result.status !== 'known') throw new Error(`expected known, got ${result.reason}`)
	return result.value
}

function sources(result: ReturnType<typeof computeMaxHitPoints>): string[] {
	if (result.status !== 'known') throw new Error(`expected known, got ${result.reason}`)
	return result.breakdown.map((contribution) => contribution.source)
}

function notes(result: ReturnType<typeof computeMaxHitPoints>): string[] {
	if (result.status !== 'known') throw new Error(`expected known, got ${result.reason}`)
	return result.breakdown.flatMap((contribution) => (contribution.note === undefined ? [] : [contribution.note]))
}

describe('fixedAverage', () => {
	it('is the PHB value for each die size', () => {
		expect([6, 8, 10, 12].map(fixedAverage)).toEqual([4, 5, 6, 7])
	})
})

describe('computeMaxHitPoints — no stored contributions', () => {
	it('falls back to level 1 maximum and the fixed average thereafter', () => {
		// Fighter 5, CON 14: 10 + 4×6 average + 5×2 = 44.
		expect(total(computeMaxHitPoints(character(), classData))).toBe(10 + 6 * 4 + 2 * 5)
	})

	it('says in the breakdown that those are defaults, not recorded choices', () => {
		expect(notes(computeMaxHitPoints(character(), classData))).toContain(
			'no choices recorded — level 1 uses the die maximum and every level after it the fixed average',
		)
	})

	it('names one line per level, then Constitution', () => {
		expect(sources(computeMaxHitPoints(character(), classData))).toEqual([
			'per-level hit points',
			'level 1 (d10 maximum)',
			'level 2 (d10 average)',
			'level 3 (d10 average)',
			'level 4 (d10 average)',
			'level 5 (d10 average)',
			'constitution modifier (+2) × 5 levels',
		])
	})

	it('a level-1 character is the die maximum plus one Constitution modifier', () => {
		const level1 = character({ classes: [{ className: 'Wizard', classSource: 'XPHB', subclass: null, level: 1 }] })
		expect(total(computeMaxHitPoints(level1, classData))).toBe(6 + 2)
		expect(sources(computeMaxHitPoints(level1, classData))).toContain('constitution modifier (+2) × 1 level')
	})
})

describe('computeMaxHitPoints — Constitution', () => {
	it('a Constitution increase corrects every earlier level at once', () => {
		const before = computeMaxHitPoints(character(), classData)
		const after = computeMaxHitPoints(
			character({
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 10, dexterity: 10, constitution: 16, intelligence: 10, wisdom: 10, charisma: 10 },
				},
			}),
			classData,
		)
		// +1 modifier over 5 levels, not +1 once — the whole point of storing per level.
		expect(total(after) - total(before)).toBe(5)
	})

	it('a negative modifier subtracts once per level', () => {
		const frail = character({
			abilityScores: {
				method: 'standardArray',
				scores: { strength: 10, dexterity: 10, constitution: 8, intelligence: 10, wisdom: 10, charisma: 10 },
			},
		})
		expect(total(computeMaxHitPoints(frail, classData))).toBe(10 + 6 * 4 - 5)
		expect(sources(computeMaxHitPoints(frail, classData))).toContain('constitution modifier (-1) × 5 levels')
	})
})

describe('computeMaxHitPoints — stored contributions', () => {
	const rolled: CharacterHitPointLevel[] = [
		{ level: 1, dieResult: 10, kind: 'maximum' },
		{ level: 2, dieResult: 3, kind: 'roll' },
		{ level: 3, dieResult: 9, kind: 'roll' },
		{ level: 4, dieResult: 6, kind: 'average' },
		{ level: 5, dieResult: 8, kind: 'manual' },
	]

	it('uses each stored result and drops the defaults note', () => {
		const result = computeMaxHitPoints(character({ hitPointLevels: rolled }), classData)
		expect(total(result)).toBe(10 + 3 + 9 + 6 + 8 + 10)
		expect(notes(result)).toEqual([])
		expect(sources(result)).toEqual([
			'level 1 (d10 maximum)',
			'level 2 (roll)',
			'level 3 (roll)',
			'level 4 (average)',
			'level 5 (manual)',
			'constitution modifier (+2) × 5 levels',
		])
	})

	it('level 1 is the die maximum even when a smaller roll is stored for it', () => {
		const cheated = [{ level: 1, dieResult: 1, kind: 'roll' as const }, ...rolled.slice(1)]
		expect(total(computeMaxHitPoints(character({ hitPointLevels: cheated }), classData))).toBe(10 + 3 + 9 + 6 + 8 + 10)
	})

	it('a level with no stored entry falls back to the average and says so (D43)', () => {
		const partial = rolled.slice(0, 3)
		const result = computeMaxHitPoints(character({ hitPointLevels: partial }), classData)
		expect(sources(result)).toContain('level 4 (d10 average, no choice recorded)')
		expect(total(result)).toBe(10 + 3 + 9 + 6 + 6 + 10)
	})

	it('reports a result the die cannot roll, and still counts it (D43)', () => {
		const impossible: CharacterHitPointLevel[] = [
			{ level: 1, dieResult: 10, kind: 'maximum' },
			{ level: 2, dieResult: 40, kind: 'roll' },
		]
		const result = computeMaxHitPoints(character({ classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 2 }], hitPointLevels: impossible }), classData)
		expect(notes(result)).toEqual(['recorded as 40, which a d10 cannot roll — counted as stored'])
		expect(total(result)).toBe(10 + 40 + 4)
	})

	it('reports a stored level above the character’s own, and does not count it (D43)', () => {
		const result = computeMaxHitPoints(character({ classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 2 }], hitPointLevels: rolled }), classData)
		expect(notes(result)).toEqual([
			'recorded but above your level (2) — not counted',
			'recorded but above your level (2) — not counted',
			'recorded but above your level (2) — not counted',
		])
		expect(total(result)).toBe(10 + 3 + 4)
	})
})

describe('computeMaxHitPoints — the bonus table', () => {
	it('has exactly the three per-level sources the investigation found', () => {
		expect(Object.keys(HIT_POINT_BONUS_RULES).sort()).toEqual(['Draconic Resilience', 'Dwarven Toughness', 'Tough'])
	})

	it('Tough: +2 per character level', () => {
		const base = total(computeMaxHitPoints(character(), classData))
		const result = computeMaxHitPoints(character(), classData, ['Tough'])
		expect(total(result) - base).toBe(10)
		expect(sources(result)).toContain('Tough (+2 per character level)')
	})

	it('Dwarven Toughness: +1 per character level', () => {
		const base = total(computeMaxHitPoints(character(), classData))
		const result = computeMaxHitPoints(character(), classData, ['Darkvision', 'Dwarven Resilience', 'Dwarven Toughness', 'Stonecunning'])
		expect(total(result) - base).toBe(5)
		expect(sources(result)).toContain('Dwarven Toughness (+1 per character level)')
	})

	it('Draconic Resilience: +1 per SORCERER level (3 at level 3, then +1 each level)', () => {
		const sorcerer = character({ classes: [{ className: 'Sorcerer', classSource: 'XPHB', subclass: 'Draconic', level: 4 }] })
		const base = total(computeMaxHitPoints(sorcerer, classData))
		const result = computeMaxHitPoints(sorcerer, classData, ['Draconic Resilience'])
		expect(total(result) - base).toBe(4)
		expect(sources(result)).toContain('Draconic Resilience (+1 per Sorcerer level)')
	})

	it('Draconic Resilience at Sorcerer 3 adds exactly +3', () => {
		const sorcerer = character({ classes: [{ className: 'Sorcerer', classSource: 'XPHB', subclass: 'Draconic', level: 3 }] })
		const base = total(computeMaxHitPoints(sorcerer, classData))
		expect(total(computeMaxHitPoints(sorcerer, classData, ['Draconic Resilience'])) - base).toBe(3)
	})

	it('Draconic Resilience on a character with no Sorcerer levels is reported, not applied (D43)', () => {
		const base = total(computeMaxHitPoints(character(), classData))
		const result = computeMaxHitPoints(character(), classData, ['Draconic Resilience'])
		expect(total(result)).toBe(base)
		expect(notes(result)).toContain('not counted — you have no levels in the class its Sorcerer level counts')
	})

	it('stacks all three, each on its own line', () => {
		const sorcerer = character({ classes: [{ className: 'Sorcerer', classSource: 'XPHB', subclass: 'Draconic', level: 5 }] })
		const base = total(computeMaxHitPoints(sorcerer, classData))
		const result = computeMaxHitPoints(sorcerer, classData, ['Tough', 'Dwarven Toughness', 'Draconic Resilience'])
		expect(total(result) - base).toBe(10 + 5 + 5)
		expect(sources(result).filter((source) => !source.startsWith('level ') && source !== 'per-level hit points')).toEqual([
			'constitution modifier (+2) × 5 levels',
			'Tough (+2 per character level)',
			'Dwarven Toughness (+1 per character level)',
			'Draconic Resilience (+1 per Sorcerer level)',
		])
	})

	it('ignores every feature name that is not in the table', () => {
		const base = total(computeMaxHitPoints(character(), classData))
		expect(total(computeMaxHitPoints(character(), classData, ['Second Wind', 'Action Surge', 'Arcane Ward']))).toBe(base)
	})
})

describe('computeMaxHitPoints — the manual override', () => {
	it('wins over everything computed', () => {
		const result = computeMaxHitPoints(character({ maxHpOverride: 99, hitPointLevels: [{ level: 1, dieResult: 10, kind: 'maximum' }] }), classData, ['Tough'])
		expect(total(result)).toBe(99)
	})

	it('says plainly in the breakdown that it replaced the computed value', () => {
		const result = computeMaxHitPoints(character({ maxHpOverride: 99 }), classData)
		expect(sources(result)).toEqual(['manual maximum', 'computed maximum'])
		expect(notes(result)).toEqual(['not used — the manual maximum replaces it'])
	})

	it('applies even when nothing else could be computed at all', () => {
		expect(total(computeMaxHitPoints(character({ classes: [], maxHpOverride: 7 }), classData))).toBe(7)
	})

	it('0 is a real override, not "unset"', () => {
		expect(total(computeMaxHitPoints(character({ maxHpOverride: 0 }), classData))).toBe(0)
	})
})

describe('computeMaxHitPoints — D43 unresolved states', () => {
	it('no classes yet', () => {
		expect(computeMaxHitPoints(character({ classes: [] }), classData).status).toBe('unknown')
	})

	it('a class missing from the hit die data', () => {
		const unknownClass = character({ classes: [{ className: 'Made Up', classSource: 'XPHB', subclass: null, level: 3 }] })
		expect(computeMaxHitPoints(unknownClass, classData).status).toBe('unknown')
	})

	it('no ability scores set', () => {
		const { abilityScores: _dropped, ...rest } = character()
		expect(computeMaxHitPoints(rest, classData).status).toBe('unknown')
	})

})

describe('computeMaxHitPoints — more than one class (M4, D323)', () => {
	const WARLOCK = { className: 'Warlock', classSource: 'XPHB' }
	const SORCERER = { className: 'Sorcerer', classSource: 'XPHB' }
	const classes = [
		{ ...WARLOCK, subclass: null, level: 6 },
		{ ...SORCERER, subclass: null, level: 3 },
	]
	const inOrder = [...Array.from({ length: 6 }, () => WARLOCK), SORCERER, SORCERER, SORCERER]
	const multi = (overrides: Partial<Character> = {}): Character => character({ classes, levelOrder: inOrder, ...overrides })

	it('Warlock 6 then Sorcerer 3: level 1 d8 maximum, 2-6 d8 average, 7-9 d6 average, CON × 9', () => {
		const result = computeMaxHitPoints(multi(), classData)
		expect(total(result)).toBe(8 + 5 * 5 + 3 * 4 + 9 * 2)
		expect(sources(result)).toEqual([
			'per-level hit points',
			'level 1 (Warlock d8 maximum)',
			...[2, 3, 4, 5, 6].map((level) => `level ${level} (Warlock d8 average)`),
			...[7, 8, 9].map((level) => `level ${level} (Sorcerer d6 average)`),
			'constitution modifier (+2) × 9 levels',
		])
	})

	it('an interleaved history uses the d6 for a Sorcerer level 2', () => {
		const interleaved = [WARLOCK, SORCERER, WARLOCK, WARLOCK, WARLOCK, WARLOCK, WARLOCK, SORCERER, SORCERER]
		const result = computeMaxHitPoints(multi({ levelOrder: interleaved }), classData)
		expect(sources(result)).toContain('level 2 (Sorcerer d6 average)')
		expect(sources(result)).toContain('level 7 (Warlock d8 average)')
	})

	it('a stored roll on a Sorcerer level above 6 is checked against the d6 (D43)', () => {
		const result = computeMaxHitPoints(multi({ hitPointLevels: [{ level: 8, kind: 'roll', dieResult: 7 }] }), classData)
		expect(sources(result)).toContain('level 8 (Sorcerer roll)')
		expect(notes(result)).toEqual(['recorded as 7, which a d6 cannot roll — counted as stored'])
	})

	it('without a level history the maximum is unknown, with the manual-maximum hint', () => {
		const { levelOrder: _dropped, ...noHistory } = multi()
		expect(computeMaxHitPoints(noHistory, classData)).toEqual(unknown('Cannot tell which class each level came from (no level history). Set a manual maximum.'))
	})

	it('the manual override still wins without a level history', () => {
		const { levelOrder: _dropped, ...noHistory } = multi({ maxHpOverride: 50 })
		expect(total(computeMaxHitPoints(noHistory, classData))).toBe(50)
	})

	it('Draconic Resilience counts Sorcerer levels only', () => {
		const base = total(computeMaxHitPoints(multi(), classData))
		expect(total(computeMaxHitPoints(multi(), classData, ['Draconic Resilience'])) - base).toBe(3)
	})
})

describe('maxHitPointsDelta (D107)', () => {
	it('is the difference between two known maximums', () => {
		expect(maxHitPointsDelta(known(20, []), known(28, []))).toBe(8)
		expect(maxHitPointsDelta(known(28, []), known(20, []))).toBe(-8)
	})

	it('is undefined when either side is unknown', () => {
		expect(maxHitPointsDelta(unknown('no classes'), known(28, []))).toBeUndefined()
		expect(maxHitPointsDelta(known(20, []), unknown('no classes'))).toBeUndefined()
	})
})

describe('currentHpAfterMaxHpChange (D107)', () => {
	it('a level up raises currentHp by exactly the maxHp increase, not up to the new max', () => {
		// Below max before (20 of 20) and stays below max after (28 of 28 - 8... ): the amount added is the delta, never the new max.
		expect(currentHpAfterMaxHpChange(12, known(20, []), known(28, []))).toBe(20)
	})

	it('a level removal lowers currentHp by exactly the maxHp decrease', () => {
		expect(currentHpAfterMaxHpChange(20, known(28, []), known(20, []))).toBe(12)
	})

	it('leaves currentHp unset when it was never set, even with a known delta', () => {
		expect(currentHpAfterMaxHpChange(undefined, known(20, []), known(28, []))).toBeUndefined()
	})

	it('leaves currentHp as it was when the delta cannot be resolved', () => {
		expect(currentHpAfterMaxHpChange(12, known(20, []), unknown('no classes'))).toBeUndefined()
	})
})
