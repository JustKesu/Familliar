import { describe, expect, it } from 'vitest'
import { extractSelectableLanguages } from './languageData'

describe('extractSelectableLanguages', () => {
	it('keeps only standard-type entries', () => {
		const parsed = [
			{ name: 'Draconic', source: 'XPHB', type: 'standard' },
			{ name: 'Abyssal', source: 'XPHB', type: 'rare' },
		]
		expect(extractSelectableLanguages(parsed)).toEqual([{ name: 'Draconic', source: 'XPHB' }])
	})

	it('excludes Common — it is granted automatically, not chosen', () => {
		const parsed = [
			{ name: 'Common', source: 'XPHB', type: 'standard' },
			{ name: 'Dwarvish', source: 'XPHB', type: 'standard' },
		]
		expect(extractSelectableLanguages(parsed)).toEqual([{ name: 'Dwarvish', source: 'XPHB' }])
	})

	it('ignores malformed entries missing required fields', () => {
		const parsed = [{ name: 'No Source', type: 'standard' }, { source: 'XPHB', type: 'standard' }]
		expect(extractSelectableLanguages(parsed)).toEqual([])
	})

	it('throws when the top level is not an array', () => {
		expect(() => extractSelectableLanguages({ not: 'an array' })).toThrow(/top-level array/)
	})

	it('matches the real data shape: 10 standard entries including Common, 9 selectable after exclusion', () => {
		const parsed = [
			{ name: 'Common', source: 'XPHB', type: 'standard' },
			{ name: 'Common Sign Language', source: 'XPHB', type: 'standard' },
			{ name: 'Draconic', source: 'XPHB', type: 'standard' },
			{ name: 'Dwarvish', source: 'XPHB', type: 'standard' },
			{ name: 'Elvish', source: 'XPHB', type: 'standard' },
			{ name: 'Giant', source: 'XPHB', type: 'standard' },
			{ name: 'Gnomish', source: 'XPHB', type: 'standard' },
			{ name: 'Goblin', source: 'XPHB', type: 'standard' },
			{ name: 'Halfling', source: 'XPHB', type: 'standard' },
			{ name: 'Orc', source: 'XPHB', type: 'standard' },
			{ name: 'Abyssal', source: 'XPHB', type: 'rare' },
			{ name: 'Celestial', source: 'XPHB', type: 'rare' },
		]
		expect(extractSelectableLanguages(parsed)).toHaveLength(9)
	})
})
