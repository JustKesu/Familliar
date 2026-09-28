import { describe, expect, it } from 'vitest'
import type { FeatEntry } from '../featAsi/featAsiData'
import { featOffers } from './ManageFeatsPanel'

const ctx = {
	characterLevel: 4,
	abilityScores: {},
	hasFightingStyleFeature: false,
	hasSpellcasting: false,
	armorProficiencies: [],
	weaponProficiencies: [],
	speciesName: null,
	speciesRaceTags: [],
	speciesSize: null,
}

const tough: FeatEntry = { name: 'Tough', source: 'XPHB', category: 'O' }
const adept: FeatEntry = { name: 'Elemental Adept', source: 'XPHB', category: 'G', repeatable: true }
const afterTough: FeatEntry = { name: 'Follow-up', source: 'TEST', category: 'G', prerequisite: [{ feat: ['tough|xphb'] }] }

describe('featOffers (R13a)', () => {
	it('leaves out a held non-repeatable feat and keeps a held repeatable one', () => {
		const offers = featOffers([tough, adept], [tough, adept], ctx)
		expect(offers.map((offer) => offer.feat.name)).toEqual(['Elemental Adept'])
	})

	it('counts a manually added feat toward another feat’s prerequisite', () => {
		expect(featOffers([afterTough], [], ctx)[0].result).toEqual({ eligible: false, reasons: ['Requires the feat "tough".'] })
		expect(featOffers([afterTough], [{ name: 'Tough', source: 'XPHB' }], ctx)[0].result.eligible).toBe(true)
	})
})
