import { describe, expect, it } from 'vitest'
import { HANDS_AVAILABLE, makeRoomForHands, type HeldThing } from './hands'

const shortsword = (index: number): HeldThing => ({ index, name: 'Shortsword', hands: 1 })
const shield = (index: number): HeldThing => ({ index, name: 'Shield', hands: 1 })
const greatsword = (index: number): HeldThing => ({ index, name: 'Greatsword', hands: 2 })

describe('makeRoomForHands', () => {
	it('has two hands and no more', () => {
		expect(HANDS_AVAILABLE).toBe(2)
	})

	/* Dual wielding: the case a limit on the NUMBER of weapons would have broken. */
	it('lets a second one-handed weapon be taken up alongside the first', () => {
		const result = makeRoomForHands([shortsword(0)], shortsword(1))
		expect(result.displaced).toEqual([])
		expect(result.message).toBeNull()
	})

	it('a two-handed weapon displaces a held shield, and says so', () => {
		const result = makeRoomForHands([shield(0)], greatsword(1))
		expect(result.displaced.map((thing) => thing.index)).toEqual([0])
		expect(result.message).toBe('Unequipped Shield — Greatsword needs both hands.')
	})

	it('a shield displaces a held two-handed weapon, and says so', () => {
		const result = makeRoomForHands([greatsword(0)], shield(1))
		expect(result.displaced.map((thing) => thing.index)).toEqual([0])
		expect(result.message).toBe('Unequipped Greatsword — Shield needs a free hand.')
	})

	it('a two-handed weapon displaces another two-handed weapon', () => {
		const result = makeRoomForHands([greatsword(0)], { index: 1, name: 'Greataxe', hands: 2 })
		expect(result.displaced.map((thing) => thing.name)).toEqual(['Greatsword'])
		expect(result.message).toBe('Unequipped Greatsword — Greataxe needs both hands.')
	})

	/* Inventory order is the only record of age this app keeps, so the earliest row goes first. */
	it('puts down the oldest things first, and only as many as it has to', () => {
		const result = makeRoomForHands([shortsword(0), shield(1)], greatsword(2))
		expect(result.displaced.map((thing) => thing.index)).toEqual([0, 1])
		expect(result.message).toBe('Unequipped Shortsword, Shield — Greatsword needs both hands.')

		const oneEnough = makeRoomForHands([shortsword(0), shield(1)], shortsword(2))
		expect(oneEnough.displaced.map((thing) => thing.index)).toEqual([0])
	})

	it('takes something up with empty hands without displacing anything', () => {
		expect(makeRoomForHands([], greatsword(0))).toEqual({ displaced: [], message: null })
	})
})
