import { describe, expect, it } from 'vitest'
import { combineSenseEntries } from './SensesList'

describe('combineSenseEntries', () => {
	it('one granted sense from a feat becomes one row with the feat provenance', () => {
		expect(combineSenseEntries([{ senseType: 'truesight', range: 60, origin: 'feat', name: 'Boon of Truesight' }])).toEqual([
			{ senseType: 'truesight', range: 60, featOrigins: ['Boon of Truesight'], optionalFeatureOrigins: [] },
		])
	})

	it('one granted sense from an optional feature becomes one row with the invocation provenance', () => {
		expect(combineSenseEntries([{ senseType: 'darkvision', range: 120, origin: 'optionalFeature', name: 'Stone Rune' }])).toEqual([
			{ senseType: 'darkvision', range: 120, featOrigins: [], optionalFeatureOrigins: ['Stone Rune'] },
		])
	})

	it('the same sense type from a feat AND an optional feature merges into one row, both named, larger range kept', () => {
		const result = combineSenseEntries([
			{ senseType: 'blindsight', range: 10, origin: 'feat', name: 'Skulker' },
			{ senseType: 'blindsight', range: 30, origin: 'optionalFeature', name: 'Some Invocation' },
		])
		expect(result).toEqual([{ senseType: 'blindsight', range: 30, featOrigins: ['Skulker'], optionalFeatureOrigins: ['Some Invocation'] }])
	})

	it('two different sense types stay two separate rows', () => {
		const result = combineSenseEntries([
			{ senseType: 'truesight', range: 60, origin: 'feat', name: 'Boon of Truesight' },
			{ senseType: 'darkvision', range: 120, origin: 'optionalFeature', name: 'Stone Rune' },
		])
		expect(result.map((r) => r.senseType).sort()).toEqual(['darkvision', 'truesight'])
	})

	it('sense type matching is case-insensitive so a data-casing quirk cannot produce two rows for the same sense', () => {
		const result = combineSenseEntries([
			{ senseType: 'blindsight', range: 10, origin: 'feat', name: 'Skulker' },
			{ senseType: 'Blindsight', range: 10, origin: 'feat', name: 'Blind Fighting' },
		])
		expect(result).toHaveLength(1)
		expect(result[0].featOrigins.sort()).toEqual(['Blind Fighting', 'Skulker'])
	})

	it('an empty list yields an empty list', () => {
		expect(combineSenseEntries([])).toEqual([])
	})
})
