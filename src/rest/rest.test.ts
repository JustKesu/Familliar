import { describe, expect, it } from 'vitest'
import { afterLongRest, afterShortRest, type RestingResource } from './rest'
import type { CharacterPlayState } from '../storage/character'

const RESOURCES: RestingResource[] = [
	{ name: 'Rage', shortRest: 'one' },
	{ name: 'Focus Point', shortRest: 'all' },
	{ name: 'Sorcery Point', shortRest: null },
]

const PLAY: CharacterPlayState = {
	temporaryHitPoints: 7,
	resourceUses: { Rage: 3, 'Focus Point': 4, 'Sorcery Point': 5 },
	spentSpellSlots: { ordinary: { 1: 2, 3: 1 }, pact: 2 },
	spentHitDice: { 'Barbarian|XPHB': 2 },
}

describe('a Short Rest (slice 9b5)', () => {
	it('gives back one use of a one-use pool and empties an all-use one, leaving a long-rest-only pool alone', () => {
		const rest = afterShortRest(11, PLAY, RESOURCES, null)
		expect(rest.resourceUses).toEqual({ Rage: 2, 'Sorcery Point': 5 })
	})

	it('empties a single-use resource whose recharge sentence names a Short Rest, and only that one', () => {
		const resources: RestingResource[] = [...RESOURCES, { name: 'Stroke of Luck', shortRest: 'all' }, { name: 'Divine Intervention', shortRest: null }]
		const rest = afterShortRest(11, { resourceUses: { 'Stroke of Luck': 1, 'Divine Intervention': 1 } }, resources, null)
		expect(rest.resourceUses).toEqual({ 'Divine Intervention': 1 })
	})

	it('leaves a spent count no resource in the list claims alone', () => {
		const rest = afterShortRest(11, { resourceUses: { 'Superiority Die': 3 } }, RESOURCES, null)
		expect(rest.resourceUses).toEqual({ 'Superiority Die': 3 })
	})

	it('restores Pact Magic slots and never the ordinary ones (D11)', () => {
		const rest = afterShortRest(11, PLAY, RESOURCES, 'all')
		expect(rest.spentSpellSlots).toEqual({ ordinary: { 1: 2, 3: 1 }, pact: 0 })
	})

	it('leaves both slot pools alone where nothing recovers Pact Magic', () => {
		expect(afterShortRest(11, PLAY, RESOURCES, null).spentSpellSlots).toEqual({ ordinary: { 1: 2, 3: 1 }, pact: 2 })
	})

	it('passes the hit points and the hit dice through untouched — 9c spends the dice, a rest does not', () => {
		const rest = afterShortRest(11, PLAY, RESOURCES, 'all')
		expect(rest.currentHp).toBe(11)
		expect(rest.spentHitDice).toEqual({ 'Barbarian|XPHB': 2 })
	})
})

describe('a Long Rest (slice 9b5)', () => {
	it('clears every pool, including resources no Short Rest touches and every spent hit die', () => {
		const rest = afterLongRest(11, PLAY, 44)
		expect(rest.resourceUses).toEqual({})
		expect(rest.spentSpellSlots).toEqual({})
		expect(rest.spentHitDice).toEqual({})
	})

	it('heals to the maximum', () => {
		expect(afterLongRest(11, PLAY, 44).currentHp).toBe(44)
	})

	it('never pulls a current above a lowered maximum down (D110)', () => {
		expect(afterLongRest(50, PLAY, 44).currentHp).toBe(50)
	})

	it('leaves the hit points alone when they are not set, or when the maximum cannot be computed (D43)', () => {
		expect(afterLongRest(undefined, PLAY, 44).currentHp).toBeUndefined()
		expect(afterLongRest(11, PLAY, null).currentHp).toBe(11)
	})

	it('reports no temporary hit points at all — neither rest is allowed to move them (D110)', () => {
		expect(afterLongRest(11, PLAY, 44)).not.toHaveProperty('temporaryHitPoints')
		expect(afterShortRest(11, PLAY, RESOURCES, 'all')).not.toHaveProperty('temporaryHitPoints')
	})
})
