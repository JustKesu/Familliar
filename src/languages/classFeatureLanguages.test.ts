import { describe, expect, it } from 'vitest'
import { featureLanguageOptions } from './classFeatureLanguages'

const LANGUAGES = ['Abyssal', 'Druidic', 'Elvish', "Thieves' Cant"].map((name) => ({ name }))

describe('featureLanguageOptions (D173)', () => {
	it('never offers Druidic or Thieves’ Cant, nor a language taken elsewhere', () => {
		expect(featureLanguageOptions(LANGUAGES, new Set(['elvish'])).map((l) => l.name)).toEqual(['Abyssal'])
	})

	it('keeps an already stored secret pick in its own slot', () => {
		expect(featureLanguageOptions(LANGUAGES, new Set(['druidic']), 'Druidic').map((l) => l.name)).toEqual(['Abyssal', 'Druidic', 'Elvish'])
	})
})
