import { describe, expect, it } from 'vitest'
import { offersSpellChoice, optionalFeatureSpellChoiceShape, requiredSpellChoiceCounts } from './optionalFeatureSpellChoiceData'

/*
 * Fixtures are the real shapes scripts/investigate-pact-of-the-tome.js read out
 * of optional-features.json, verbatim. data/ is never opened here.
 */

const pactOfTheTome = {
	name: 'Pact of the Tome',
	source: 'XPHB',
	featureType: ['EI'],
	additionalSpells: [
		{
			ability: 'cha',
			known: { _: [{ choose: 'level=0', count: 3 }] },
			prepared: { _: [{ choose: 'level=1|components & miscellaneous=ritual', count: 2 }] },
		},
	],
}

/** A literal-grant invocation: derived by optionalFeatureSpells.ts, never offered as a choice. */
const maskOfManyFaces = {
	name: 'Mask of Many Faces',
	source: 'XPHB',
	featureType: ['EI'],
	additionalSpells: [{ innate: { _: ['disguise self|xphb'] } }],
}

/** An invocation with no additionalSpells at all. */
const agonizingBlast = { name: 'Agonizing Blast', source: 'XPHB', featureType: ['EI'] }

const optionalFeatures = [pactOfTheTome, maskOfManyFaces, agonizingBlast]

describe('optionalFeatureSpellChoiceShape', () => {
	it('reads Pact of the Tome’s two slots, with the counts the DATA states', () => {
		const shape = optionalFeatureSpellChoiceShape(optionalFeatures, 'Pact of the Tome', 'EI')
		expect(shape.cantripSlot).toEqual({ levels: [0], filter: { kind: 'any' }, count: 3 })
		expect(shape.spellSlot).toEqual({ levels: [1], filter: { kind: 'ritual' }, count: 2 })
	})

	it('the cantrip slot carries NO class filter — any cantrip from any class list qualifies', () => {
		const shape = optionalFeatureSpellChoiceShape(optionalFeatures, 'Pact of the Tome', 'EI')
		expect(shape.cantripSlot?.filter.kind).toBe('any')
	})

	/*
	 * featSpellChoiceData.ts's own node parser forces a ritual slot's count to
	 * null, because Ritual Caster's count comes from proficiency bonus instead.
	 * Pact of the Tome states count: 2 outright, so that special case must not
	 * leak into this module.
	 */
	it('honours an explicit count on a ritual slot rather than treating it as level-derived', () => {
		expect(optionalFeatureSpellChoiceShape(optionalFeatures, 'Pact of the Tome', 'EI').spellSlot?.count).toBe(2)
	})

	it('an option that grants literal spells offers no choice', () => {
		const shape = optionalFeatureSpellChoiceShape(optionalFeatures, 'Mask of Many Faces', 'EI')
		expect(shape).toEqual({ cantripSlot: null, spellSlot: null })
		expect(offersSpellChoice(shape)).toBe(false)
	})

	it('an option with no additionalSpells, and an unknown option, both offer nothing', () => {
		expect(offersSpellChoice(optionalFeatureSpellChoiceShape(optionalFeatures, 'Agonizing Blast', 'EI'))).toBe(false)
		expect(offersSpellChoice(optionalFeatureSpellChoiceShape(optionalFeatures, 'Not An Option', 'EI'))).toBe(false)
	})

	it('is scoped by featureType — the same name under another progression does not match', () => {
		expect(offersSpellChoice(optionalFeatureSpellChoiceShape(optionalFeatures, 'Pact of the Tome', 'MV:B'))).toBe(false)
	})

	it('throws a named error when the data is not the array it must be', () => {
		expect(() => optionalFeatureSpellChoiceShape({}, 'Pact of the Tome', 'EI')).toThrow(/optional-features\.json/)
	})
})

describe('requiredSpellChoiceCounts', () => {
	it('reports each slot’s own count, zero for an absent slot', () => {
		expect(requiredSpellChoiceCounts(optionalFeatureSpellChoiceShape(optionalFeatures, 'Pact of the Tome', 'EI'))).toEqual({ cantrips: 3, spells: 2 })
		expect(requiredSpellChoiceCounts(optionalFeatureSpellChoiceShape(optionalFeatures, 'Mask of Many Faces', 'EI'))).toEqual({ cantrips: 0, spells: 0 })
	})
})
