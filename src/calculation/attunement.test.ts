import { describe, expect, it } from 'vitest'
import type { Character, CharacterInventoryItem } from '../storage/character'
import { attunedItems, BASE_ATTUNEMENT_LIMIT, computeAttunementLimit, countAttuned, describeAttunementRefusal, isAttuned } from './attunement'

function characterWith(classes: { className: string; level: number }[]): Character {
	return {
		id: 'c1',
		name: 'Rowan',
		classes: classes.map((entry) => ({ className: entry.className, classSource: entry.className === 'Artificer' ? 'EFA' : 'XPHB', subclass: null, level: entry.level })),
	}
}

function row(name: string, attuned?: true): CharacterInventoryItem {
	return { name, source: 'XDMG', quantity: 1, ...(attuned ? { attuned } : {}) }
}

describe('attunement state', () => {
	it('reports which rows are attuned, and counts them', () => {
		const inventory = [row('Cloak of Protection', true), row('Torch'), row('Ring of Protection', true)]
		expect(inventory.map(isAttuned)).toEqual([true, false, true])
		expect(attunedItems(inventory).map((item) => item.name)).toEqual(['Cloak of Protection', 'Ring of Protection'])
		expect(countAttuned(inventory)).toBe(2)
	})

	it('counts a row once however many copies it holds — the flag is on the row', () => {
		expect(countAttuned([{ name: 'Ring of Protection', source: 'XDMG', quantity: 3, attuned: true }])).toBe(1)
	})
})

describe('computeAttunementLimit', () => {
	it('is three for a character with no Artificer levels, and says so in the breakdown', () => {
		const result = computeAttunementLimit(characterWith([{ className: 'Fighter', level: 20 }]))
		expect(result.status).toBe('known')
		if (result.status !== 'known') return
		expect(result.value).toBe(BASE_ATTUNEMENT_LIMIT)
		expect(result.breakdown).toEqual([{ source: 'the attunement rule (three magic items)', amount: 3 }])
	})

	it('is still three for an Artificer 9 — the first increase lands at 10', () => {
		const result = computeAttunementLimit(characterWith([{ className: 'Artificer', level: 9 }]))
		expect(result.status === 'known' && result.value).toBe(3)
	})

	it('is four at Artificer 10, five at 14 and six at 18', () => {
		expect(computeAttunementLimit(characterWith([{ className: 'Artificer', level: 10 }]))).toMatchObject({ value: 4 })
		expect(computeAttunementLimit(characterWith([{ className: 'Artificer', level: 14 }]))).toMatchObject({ value: 5 })
		expect(computeAttunementLimit(characterWith([{ className: 'Artificer', level: 18 }]))).toMatchObject({ value: 6 })
	})

	it('names the feature that raised it, and lists the ones it replaced as notes (D60)', () => {
		const result = computeAttunementLimit(characterWith([{ className: 'Artificer', level: 18 }]))
		expect(result.status).toBe('known')
		if (result.status !== 'known') return
		expect(result.breakdown[0]).toEqual({ source: 'the attunement rule (three magic items)', amount: 3 })
		expect(result.breakdown[1]).toEqual({ source: 'Magic Item Master (Artificer 18)', amount: 3 })
		const replaced = result.breakdown.slice(2)
		expect(replaced.map((entry) => entry.source)).toEqual(['Magic Item Adept (Artificer 10)', 'Magic Item Savant (Artificer 14)'])
		for (const entry of replaced) {
			expect(entry.amount).toBe(0)
			expect(entry.note).toContain('not applied')
		}
	})

	it('counts Artificer levels only in a multiclass', () => {
		// Fighter 6 / Artificer 10 is an Artificer 10 for this rule — total level 16 does not enter it.
		expect(computeAttunementLimit(characterWith([{ className: 'Fighter', level: 6 }, { className: 'Artificer', level: 10 }]))).toMatchObject({ value: 4 })
		// The same 16 levels the other way round: an Artificer 6 has no increase at all.
		expect(computeAttunementLimit(characterWith([{ className: 'Fighter', level: 10 }, { className: 'Artificer', level: 6 }]))).toMatchObject({ value: 3 })
	})
})

describe('describeAttunementRefusal', () => {
	it('allows another item below the limit', () => {
		expect(describeAttunementRefusal([row('A', true), row('B', true)], 3)).toBeNull()
	})

	it('refuses the fourth at the limit, naming the limit', () => {
		const refusal = describeAttunementRefusal([row('A', true), row('B', true), row('C', true)], 3)
		expect(refusal).toContain('at most 3 magic items')
		expect(refusal).toContain('3 already are')
	})

	it('lets an Artificer 10 take a fourth and refuses the fifth', () => {
		const artificer = characterWith([{ className: 'Artificer', level: 10 }])
		const limit = computeAttunementLimit(artificer)
		expect(limit.status).toBe('known')
		if (limit.status !== 'known') return

		const three = [row('A', true), row('B', true), row('C', true)]
		expect(describeAttunementRefusal(three, limit.value)).toBeNull()
		expect(describeAttunementRefusal([...three, row('D', true)], limit.value)).toContain('at most 4 magic items')
	})
})
