import { describe, expect, it } from 'vitest'
import { CLASS_FEATURE_LANGUAGE_GRANTS, featureLanguageOptions, featureLanguageSlotCount, otherFeatureLanguageNames } from './classFeatureLanguages'

const LANGUAGES = ['Abyssal', 'Druidic', 'Elvish', "Thieves' Cant"].map((name) => ({ name }))

describe('featureLanguageOptions (D173)', () => {
	it('never offers Druidic or Thieves’ Cant, nor a language taken elsewhere', () => {
		expect(featureLanguageOptions(LANGUAGES, new Set(['elvish'])).map((l) => l.name)).toEqual(['Abyssal'])
	})

	it('keeps an already stored secret pick in its own slot', () => {
		expect(featureLanguageOptions(LANGUAGES, new Set(['druidic']), 'Druidic').map((l) => l.name)).toEqual(['Abyssal', 'Druidic', 'Elvish'])
	})
})

describe('featureLanguageSlotCount (D392)', () => {
	const grant = (name: string) => CLASS_FEATURE_LANGUAGE_GRANTS.find((candidate) => candidate.featureName === name)!

	it('Hellborn: one slot while Abyssal or Infernal is unknown, none once both are', () => {
		expect(featureLanguageSlotCount(grant('Hellborn'), ['Common'])).toBe(1)
		expect(featureLanguageSlotCount(grant('Hellborn'), ['infernal'])).toBe(1)
		expect(featureLanguageSlotCount(grant('Hellborn'), ['Infernal', 'Abyssal'])).toBe(0)
	})

	it('a grant without a list keeps its count', () => {
		expect(featureLanguageSlotCount(grant('Deft Explorer'), ['Elvish'])).toBe(2)
	})

	it('otherFeatureLanguageNames lists picks of other grants, so Hellborn owes no slot beside a Mastermind Abyssal', () => {
		const picks = [
			{ name: 'Abyssal', source: 'XPHB', grantedBy: 'mastermind' },
			{ name: 'Infernal', source: 'XPHB', grantedBy: 'hellborn' },
		] as const
		const others = otherFeatureLanguageNames(picks, 'hellborn')
		expect(others).toEqual(['Abyssal'])
		expect(featureLanguageSlotCount(grant('Hellborn'), ['Infernal', ...others])).toBe(0)
	})
})
