import { describe, expect, it } from 'vitest'
import { extractBaseClasses } from './classData'

describe('extractBaseClasses', () => {
	it('keeps entries with entryType "class"', () => {
		const parsed = [{ entryType: 'class', name: 'Fighter', source: 'XPHB', hd: { number: 1, faces: 10 } }]
		expect(extractBaseClasses(parsed)).toEqual([
			{ name: 'Fighter', source: 'XPHB', hd: { number: 1, faces: 10 } },
		])
	})

	it('excludes entries with entryType "subclass"', () => {
		const parsed = [
			{ entryType: 'class', name: 'Artificer', source: 'EFA', hd: { number: 1, faces: 8 } },
			{ entryType: 'subclass', name: 'Alchemist', source: 'TCE', className: 'Artificer', classSource: 'EFA' },
		]
		const result = extractBaseClasses(parsed)
		expect(result).toHaveLength(1)
		expect(result[0].name).toBe('Artificer')
	})

	it('does not surface fields beyond name, source and hd', () => {
		const parsed = [
			{
				entryType: 'class',
				name: 'Wizard',
				source: 'XPHB',
				hd: { number: 1, faces: 6 },
				spellcastingAbility: 'int',
				startingEquipment: { irrelevant: true },
			},
		]
		expect(extractBaseClasses(parsed)).toEqual([{ name: 'Wizard', source: 'XPHB', hd: { number: 1, faces: 6 } }])
	})

	it('ignores malformed entries missing required fields', () => {
		const parsed = [
			{ entryType: 'class', name: 'Fighter' },
			{ entryType: 'class', source: 'XPHB' },
			{ name: 'Fighter', source: 'XPHB', hd: { number: 1, faces: 10 } },
		]
		expect(extractBaseClasses(parsed)).toEqual([])
	})

	it('throws when the top level is not an array', () => {
		expect(() => extractBaseClasses({ not: 'an array' })).toThrow(/top-level array/)
	})

	it('returns an empty array for an empty input', () => {
		expect(extractBaseClasses([])).toEqual([])
	})
})
