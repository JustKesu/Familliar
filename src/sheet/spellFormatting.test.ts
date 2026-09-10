import { describe, expect, it } from 'vitest'
import type { SpellRange } from '../spells/spellDetailData'
import { formatRange } from './spellFormatting'

describe('formatRange', () => {
	it('pluralizes a foot distance as "feet", not "foots"', () => {
		expect(formatRange({ type: 'point', distance: { type: 'feet', amount: 60 } })).toBe('60 feet')
	})

	it('keeps the singular "foot" at a distance of one', () => {
		expect(formatRange({ type: 'point', distance: { type: 'feet', amount: 1 } })).toBe('1 foot')
	})

	it('pluralizes miles with a plain -s', () => {
		expect(formatRange({ type: 'point', distance: { type: 'miles', amount: 2 } })).toBe('2 miles')
		expect(formatRange({ type: 'point', distance: { type: 'miles', amount: 1 } })).toBe('1 mile')
	})

	it('labels the special point-distance types', () => {
		expect(formatRange({ type: 'point', distance: { type: 'self' } })).toBe('Self')
		expect(formatRange({ type: 'point', distance: { type: 'touch' } })).toBe('Touch')
	})

	it('uses the attributive singular for an area shape ("30-foot cone")', () => {
		const cone: SpellRange = { type: 'cone', distance: { type: 'feet', amount: 30 } }
		expect(formatRange(cone)).toBe('30-foot cone')
	})

	it('returns "Unknown" when the range is absent', () => {
		expect(formatRange(undefined)).toBe('Unknown')
	})
})
