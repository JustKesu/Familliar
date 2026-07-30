import { describe, expect, it } from 'vitest'
import type { CharacterClass } from '../storage/character'
import { type ClassHitDie, computeHitDicePool } from './hitDice'

const classData: ClassHitDie[] = [
	{ className: 'Fighter', classSource: 'XPHB', faces: 10 },
	{ className: 'Bard', classSource: 'XPHB', faces: 8 },
]

describe('computeHitDicePool', () => {
	it('Fighter 5: one d10 per level', () => {
		const classes: CharacterClass[] = [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 5 }]
		expect(computeHitDicePool(classes, classData)).toEqual({
			status: 'known',
			value: [{ className: 'Fighter', faces: 10, count: 5 }],
			breakdown: [{ source: 'Fighter', amount: 5 }],
		})
	})

	it('multiclass: one entry per class, each with its own die (D11)', () => {
		const classes: CharacterClass[] = [
			{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 3 },
			{ className: 'Bard', classSource: 'XPHB', subclass: null, level: 2 },
		]
		expect(computeHitDicePool(classes, classData)).toEqual({
			status: 'known',
			value: [
				{ className: 'Fighter', faces: 10, count: 3 },
				{ className: 'Bard', faces: 8, count: 2 },
			],
			breakdown: [
				{ source: 'Fighter', amount: 3 },
				{ source: 'Bard', amount: 2 },
			],
		})
	})

	it('returns unknown with no classes', () => {
		expect(computeHitDicePool([], classData).status).toBe('unknown')
	})

	it('returns unknown when a class is not in the supplied data (D43)', () => {
		const classes: CharacterClass[] = [{ className: 'Made Up Class', classSource: 'XPHB', subclass: null, level: 1 }]
		expect(computeHitDicePool(classes, classData).status).toBe('unknown')
	})
})
