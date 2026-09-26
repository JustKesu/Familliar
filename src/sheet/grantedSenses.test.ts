import { describe, expect, it } from 'vitest'
import type { Character } from '../storage/character'
import { extractClassFeatureGrantedSenses, extractFeatGrantedSenses, extractOptionalFeatureGrantedSenses } from './grantedSenses'

describe('extractClassFeatureGrantedSenses (D195)', () => {
	const sub = (className: string, name: string, source: string) => ({ entryType: 'subclass', className, classSource: 'XPHB', name, source })
	const classesData = [sub('Sorcerer', 'Shadow Sorcery', 'RHW'), sub('Ranger', 'Gloom Stalker', 'XPHB'), sub('Cleric', 'Twilight Domain', 'TCE')]
	const withClass = (className: string, level: number, subclass?: string): Character => ({ id: '1', name: 'T', classes: [{ className, classSource: 'XPHB', level, subclass: subclass ?? null }] })

	it('Feral Senses arrives at Ranger 18, not 17', () => {
		expect(extractClassFeatureGrantedSenses(withClass('Ranger', 17), classesData)).toEqual([])
		expect(extractClassFeatureGrantedSenses(withClass('Ranger', 18), classesData)).toEqual([{ senseType: 'blindsight', range: 30, origin: 'classFeature', name: 'Feral Senses' }])
	})

	it('Eyes of the Dark grants darkvision and blindsight at once', () => {
		expect(extractClassFeatureGrantedSenses(withClass('Sorcerer', 3, 'Shadow Sorcery'), classesData)).toEqual([
			{ senseType: 'darkvision', range: 120, origin: 'classFeature', name: 'Eyes of the Dark' },
			{ senseType: 'blindsight', range: 10, origin: 'classFeature', name: 'Eyes of the Dark' },
		])
	})

	it('Umbral Sight is additive', () => {
		expect(extractClassFeatureGrantedSenses(withClass('Ranger', 3, 'Gloom Stalker'), classesData)).toEqual([
			{ senseType: 'darkvision', range: 60, additive: true, origin: 'classFeature', name: 'Umbral Sight' },
		])
	})

	it('a same-named subclass of another source grants nothing (D194)', () => {
		expect(extractClassFeatureGrantedSenses(withClass('Cleric', 3, 'Twilight Domain'), [{ ...classesData[2], source: 'XYZ' }])).toEqual([])
	})
})

/*
 * Fixtures mirror the real shapes scripts/investigate-senses.js found (D46):
 * every carrying entry's `senses` is `[{ <senseType>: <range> }]`. data/ is
 * never opened here.
 */

const stoneRune = { name: 'Stone Rune', source: 'TCE', featureType: ['RN'], senses: [{ darkvision: 120 }] }
const witchSight = { name: 'Witch Sight', source: 'XPHB', featureType: ['EI'], senses: [{ truesight: 30 }] }
/** Real dead-data entry: every featureType code is `FS:*`, which per D12 resolves against feats.json instead — never reachable via optionsForFeatureType, so it can never appear in a stored pick either. */
const blindFightingOption = { name: 'Blind Fighting', source: 'TCE', featureType: ['FS:F', 'FS:P', 'FS:R'], senses: [{ blindsight: 10 }] }
const noSenses = { name: 'Agonizing Blast', source: 'XPHB', featureType: ['EI'] }

const optionalFeatures = [stoneRune, witchSight, blindFightingOption, noSenses]

describe('extractOptionalFeatureGrantedSenses', () => {
	it('resolves a granted sense, carrying the option name as provenance', () => {
		expect(extractOptionalFeatureGrantedSenses(optionalFeatures, [{ featureType: 'RN', choices: [{ name: 'Stone Rune' }] }])).toEqual([
			{ senseType: 'darkvision', range: 120, origin: 'optionalFeature', name: 'Stone Rune' },
		])
	})

	it('a chosen invocation resolves the same way as a chosen rune', () => {
		expect(extractOptionalFeatureGrantedSenses(optionalFeatures, [{ featureType: 'EI', choices: [{ name: 'Witch Sight' }] }])).toEqual([
			{ senseType: 'truesight', range: 30, origin: 'optionalFeature', name: 'Witch Sight' },
		])
	})

	/* D99: a level on the pick is provenance the sense calculation must ignore entirely. */
	it('an invocation grants the same sense whether or not the pick records a level', () => {
		const withoutLevel = extractOptionalFeatureGrantedSenses(optionalFeatures, [{ featureType: 'EI', choices: [{ name: 'Witch Sight' }] }])
		const withLevel = extractOptionalFeatureGrantedSenses(optionalFeatures, [{ featureType: 'EI', choices: [{ name: 'Witch Sight', level: 7 }] }])
		expect(withLevel).toEqual(withoutLevel)
		expect(withLevel).toHaveLength(1)
	})

	it('an option chosen under a DIFFERENT featureType is not matched', () => {
		expect(extractOptionalFeatureGrantedSenses(optionalFeatures, [{ featureType: 'MV:B', choices: [{ name: 'Stone Rune' }] }])).toEqual([])
	})

	it('an option with no `senses` field, an unknown option, and an empty selection all yield nothing', () => {
		expect(extractOptionalFeatureGrantedSenses(optionalFeatures, [{ featureType: 'EI', choices: [{ name: 'Agonizing Blast' }] }])).toEqual([])
		expect(extractOptionalFeatureGrantedSenses(optionalFeatures, [{ featureType: 'EI', choices: [{ name: 'Not An Option' }] }])).toEqual([])
		expect(extractOptionalFeatureGrantedSenses(optionalFeatures, [])).toEqual([])
	})

	it('throws a named error when the data file is not the array it must be', () => {
		expect(() => extractOptionalFeatureGrantedSenses({}, [])).toThrow(/optional-features\.json/)
	})
})

const blindFightingFeat = { name: 'Blind Fighting', source: 'XPHB', senses: [{ blindsight: 10 }] }
const boonOfTruesight = { name: 'Boon of Truesight', source: 'XPHB', senses: [{ truesight: 60 }] }
const skulker = { name: 'Skulker', source: 'XPHB', senses: [{ blindsight: 10 }] }
const alert = { name: 'Alert', source: 'XPHB' }

const feats = [blindFightingFeat, boonOfTruesight, skulker, alert]

function characterWithFeats(featChoices: { name: string; source: string }[]): Character {
	return {
		id: 'test',
		name: 'Test Character',
		classes: [],
		featAsiChoices: featChoices.map((f, i) => ({ level: (i + 1) * 4, kind: 'feat' as const, name: f.name, source: f.source })),
	}
}

describe('extractFeatGrantedSenses', () => {
	it('resolves a taken feat’s granted sense, carrying the feat name as provenance', () => {
		const result = extractFeatGrantedSenses(feats, characterWithFeats([{ name: 'Boon of Truesight', source: 'XPHB' }]), null)
		expect(result).toEqual([{ senseType: 'truesight', range: 60, origin: 'feat', name: 'Boon of Truesight' }])
	})

	it('the SAME feat name matches its own feats.json entry, distinct from the (unreachable) optional-features.json entry of the same name', () => {
		const result = extractFeatGrantedSenses(feats, characterWithFeats([{ name: 'Blind Fighting', source: 'XPHB' }]), null)
		expect(result).toEqual([{ senseType: 'blindsight', range: 10, origin: 'feat', name: 'Blind Fighting' }])
	})

	it('a feat with no `senses` field and no feats taken both yield nothing', () => {
		expect(extractFeatGrantedSenses(feats, characterWithFeats([{ name: 'Alert', source: 'XPHB' }]), null)).toEqual([])
		expect(extractFeatGrantedSenses(feats, characterWithFeats([]), null)).toEqual([])
	})

	it('more than one taken feat with a granted sense returns both', () => {
		const result = extractFeatGrantedSenses(feats, characterWithFeats([{ name: 'Boon of Truesight', source: 'XPHB' }, { name: 'Skulker', source: 'XPHB' }]), null)
		expect(result.map((s) => s.name).sort()).toEqual(['Boon of Truesight', 'Skulker'])
	})

	it("includes the background's origin feat (D156)", () => {
		expect(extractFeatGrantedSenses(feats, characterWithFeats([]), { name: 'Skulker', source: 'XPHB' })).toEqual([
			expect.objectContaining({ origin: 'feat', name: 'Skulker' }),
		])
	})

	it('throws a named error when feats.json is not the array it must be', () => {
		expect(() => extractFeatGrantedSenses({}, characterWithFeats([]), null)).toThrow(/feats\.json/)
	})
})
