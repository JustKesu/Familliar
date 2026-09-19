import { describe, expect, it } from 'vitest'
import type { CharacterClass } from '../storage/character'
import { type ClassHitDie, computeHitDicePool, hitDiceKey, spentHitDiceWithinMaxima } from './hitDice'

const classData: ClassHitDie[] = [
	{ className: 'Fighter', classSource: 'XPHB', faces: 10 },
	{ className: 'Bard', classSource: 'XPHB', faces: 8 },
]

describe('computeHitDicePool', () => {
	it('Fighter 5: one d10 per level', () => {
		const classes: CharacterClass[] = [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 5 }]
		expect(computeHitDicePool(classes, classData)).toEqual({
			status: 'known',
			value: [{ className: 'Fighter', classSource: 'XPHB', faces: 10, count: 5 }],
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
				{ className: 'Fighter', classSource: 'XPHB', faces: 10, count: 3 },
				{ className: 'Bard', classSource: 'XPHB', faces: 8, count: 2 },
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

describe('spentHitDiceWithinMaxima', () => {
	const fighter3: CharacterClass[] = [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 3 }]
	const multiclass: CharacterClass[] = [...fighter3, { className: 'Bard', classSource: 'XPHB', subclass: null, level: 2 }]

	it('clamps each class to its own level and leaves a count that fits', () => {
		expect(spentHitDiceWithinMaxima({ 'Fighter|XPHB': 5, 'Bard|XPHB': 1 }, multiclass)).toEqual({ 'Fighter|XPHB': 3, 'Bard|XPHB': 1 })
	})

	it('drops a key the character has no class for, and an emptied record altogether', () => {
		expect(spentHitDiceWithinMaxima({ 'Bard|XPHB': 2 }, fighter3)).toBeUndefined()
	})

	it('passes undefined through', () => {
		expect(spentHitDiceWithinMaxima(undefined, fighter3)).toBeUndefined()
	})

	it('keys the same way as the rest of the app', () => {
		expect(hitDiceKey('Fighter', 'XPHB')).toBe('Fighter|XPHB')
	})
})
