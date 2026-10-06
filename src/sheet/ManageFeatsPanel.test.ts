import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import type { ProficiencyItem } from '../calculation/proficiencies'
import type { FeatEntry } from '../featAsi/featAsiData'
import type { Character } from '../storage/character'
import { addableFeatOffers, heldToolsOf, prerequisiteClassProficiencies } from './ManageFeatsPanel'

const CLASSES: unknown = JSON.parse(readFileSync(join(__dirname, '..', '..', 'data', 'classes.json'), 'utf8'))

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

const classEntry = (className: string, level: number, subclass: string | null = null) => ({ className, classSource: 'XPHB', subclass, level })

describe('heldToolsOf (F-9 finding 3)', () => {
	it('excludes the tools of the FIRST class’s subclass (levelOrder), not classes[0]’s', () => {
		const character: Character = {
			id: '1',
			name: 'Test',
			classes: [classEntry('Artificer', 3, 'Alchemist'), classEntry('Fighter', 3, 'Battle Master')],
			levelOrder: [
				{ className: 'Fighter', classSource: 'XPHB' },
				{ className: 'Artificer', classSource: 'XPHB' },
			],
		}
		const tools: ProficiencyItem[] = [
			{ key: 'alchemist', label: 'Alchemist’s Supplies', sources: [{ kind: 'subclass', name: 'Alchemist' }] },
			{ key: 'battle', label: 'Smith’s Tools', sources: [{ kind: 'subclass', name: 'Battle Master' }] },
		]
		expect(heldToolsOf(character, tools)).toEqual(['Alchemist’s Supplies'])
	})
})

describe('prerequisiteClassProficiencies (F-9 finding 9, D321)', () => {
	const heavilyArmored: FeatEntry = { name: 'Heavily Armored', source: 'XPHB', category: 'G', prerequisite: [{ level: 4, proficiency: [{ armor: 'medium' }] }] }
	const eligible = (character: Character) =>
		addableFeatOffers([heavilyArmored], [], { ...ctx, ...prerequisiteClassProficiencies(character, CLASSES) })[0].result.eligible

	it('Wizard 1 / Fighter 1 (Wizard first) gets medium armor only through the Fighter multiclass grant', () => {
		const character: Character = {
			id: '1',
			name: 'Test',
			classes: [classEntry('Wizard', 1), classEntry('Fighter', 1)],
			levelOrder: [
				{ className: 'Wizard', classSource: 'XPHB' },
				{ className: 'Fighter', classSource: 'XPHB' },
			],
		}
		expect(eligible(character)).toBe(true)
	})

	it('Wizard 1 alone has no medium armor', () => {
		const character: Character = { id: '1', name: 'Test', classes: [classEntry('Wizard', 1)], levelOrder: [{ className: 'Wizard', classSource: 'XPHB' }] }
		expect(eligible(character)).toBe(false)
	})
})

describe('addableFeatOffers (R13a)', () => {
	it('leaves out a held non-repeatable feat and keeps a held repeatable one', () => {
		const offers = addableFeatOffers([tough, adept], [tough, adept], ctx)
		expect(offers.map((offer) => offer.feat.name)).toEqual(['Elemental Adept'])
	})

	it('counts a manually added feat toward another feat’s prerequisite', () => {
		expect(addableFeatOffers([afterTough], [], ctx)[0].result).toEqual({ eligible: false, reasons: ['Requires the feat "tough".'] })
		expect(addableFeatOffers([afterTough], [{ name: 'Tough', source: 'XPHB' }], ctx)[0].result.eligible).toBe(true)
	})

	it('D255: a held feat also takes the same name from another book', () => {
		const alertPhb: FeatEntry = { name: 'Alert', source: 'PHB', category: 'G' }
		const alertXphb: FeatEntry = { name: 'Alert', source: 'XPHB', category: 'O' }
		expect(addableFeatOffers([alertPhb, alertXphb, tough], [{ name: 'Alert', source: 'XPHB' }], ctx).map((offer) => offer.feat.name)).toEqual(['Tough'])
	})
})
