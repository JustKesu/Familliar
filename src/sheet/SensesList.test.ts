import { describe, expect, it } from 'vitest'
import { combineSenseEntries } from './SensesList'

describe('combineSenseEntries', () => {
	it('one granted sense from a feat becomes one row with the feat provenance', () => {
		expect(combineSenseEntries([{ senseType: 'truesight', range: 60, origin: 'feat', name: 'Boon of Truesight' }])).toEqual([
			{ senseType: 'truesight', range: 60, featOrigins: ['Boon of Truesight'], optionalFeatureOrigins: [], classFeatureOrigins: [], itemOrigins: [], withheldItemOrigins: [] },
		])
	})

	it('one granted sense from an optional feature becomes one row with the invocation provenance', () => {
		expect(combineSenseEntries([{ senseType: 'darkvision', range: 120, origin: 'optionalFeature', name: 'Stone Rune' }])).toEqual([
			{ senseType: 'darkvision', range: 120, featOrigins: [], optionalFeatureOrigins: ['Stone Rune'], classFeatureOrigins: [], itemOrigins: [], withheldItemOrigins: [] },
		])
	})

	it('the same sense type from a feat AND an optional feature merges into one row, both named, larger range kept', () => {
		const result = combineSenseEntries([
			{ senseType: 'blindsight', range: 10, origin: 'feat', name: 'Skulker' },
			{ senseType: 'blindsight', range: 30, origin: 'optionalFeature', name: 'Some Invocation' },
		])
		expect(result).toEqual([{ senseType: 'blindsight', range: 30, featOrigins: ['Skulker'], optionalFeatureOrigins: ['Some Invocation'], classFeatureOrigins: [], itemOrigins: [], withheldItemOrigins: [] }])
	})

	it('a class feature sense keeps its own origin list (D195)', () => {
		const result = combineSenseEntries([
			{ senseType: 'blindsight', range: 10, origin: 'classFeature', name: 'Eyes of the Dark' },
			{ senseType: 'blindsight', range: 30, origin: 'classFeature', name: 'Feral Senses' },
		])
		expect(result).toEqual([{ senseType: 'blindsight', range: 30, featOrigins: [], optionalFeatureOrigins: [], classFeatureOrigins: ['Eyes of the Dark', 'Feral Senses'], itemOrigins: [], withheldItemOrigins: [] }])
	})

	it('an item sense merges with a feat’s truesight: one row, larger range, both origins named (R14a2)', () => {
		const result = combineSenseEntries([
			{ senseType: 'truesight', range: 30, origin: 'item', name: 'Lens' },
			{ senseType: 'truesight', range: 60, origin: 'feat', name: 'Boon of Truesight' },
		])
		expect(result).toEqual([{ senseType: 'truesight', range: 60, featOrigins: ['Boon of Truesight'], optionalFeatureOrigins: [], classFeatureOrigins: [], itemOrigins: ['Lens'], withheldItemOrigins: [] }])
	})

	it('an unattuned item sense is named with its reason and does not set the range (D76)', () => {
		const reason = 'requires attunement and you are not attuned to it'
		expect(combineSenseEntries([{ senseType: 'truesight', range: 120, origin: 'item', name: 'Lens', withheldReason: reason }])).toEqual([
			{ senseType: 'truesight', range: 0, featOrigins: [], optionalFeatureOrigins: [], classFeatureOrigins: [], itemOrigins: [], withheldItemOrigins: [{ name: 'Lens', reason }] },
		])
		const withFeat = combineSenseEntries([
			{ senseType: 'truesight', range: 120, origin: 'item', name: 'Lens', withheldReason: reason },
			{ senseType: 'truesight', range: 30, origin: 'feat', name: 'Boon of Truesight' },
		])
		expect(withFeat[0].range).toBe(30)
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
