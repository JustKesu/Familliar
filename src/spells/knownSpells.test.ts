import { describe, expect, it } from 'vitest'
import {
	CLASS_SPELL_PICKER_KEY,
	collectKnownSpells,
	featSpellPickerKey,
	knownSpellNote,
	knownSpellReason,
	optionalFeatureSpellPickerKey,
	SUBCLASS_SPELL_CHOICE_PICKER_KEY,
	type KnownSpellInputs,
} from './knownSpells'

const EMPTY: KnownSpellInputs = {
	classSpellPicks: [],
	subclassName: null,
	subclassAlwaysPrepared: [],
	subclassSpellChoicePicks: [],
	featGrantedSpells: [],
	optionalFeatureGrantedSpells: [],
}

function inputs(overrides: Partial<KnownSpellInputs>): KnownSpellInputs {
	return { ...EMPTY, ...overrides }
}

const mistyStep = { name: 'Misty Step', source: 'XPHB' }

describe('collectKnownSpells', () => {
	it('labels a subclass always-prepared grant with the subclass, and leaves it unowned by any picker', () => {
		const known = collectKnownSpells(inputs({ subclassName: 'Archfey Patron', subclassAlwaysPrepared: [mistyStep] }))

		expect(known).toEqual([{ name: 'Misty Step', source: 'XPHB', label: 'Archfey Patron, always prepared', pickerKey: null }])
	})

	it('ignores subclass grants until a subclass is chosen', () => {
		expect(collectKnownSpells(inputs({ subclassAlwaysPrepared: [mistyStep], subclassSpellChoicePicks: [mistyStep] }))).toEqual([])
	})

	it('names the step a class spell pick came from, and keys it to the class spell picker', () => {
		const known = collectKnownSpells(inputs({ classSpellPicks: [{ name: 'Magic Missile', source: 'XPHB' }] }))

		expect(known[0].label).toBe('the Spells step')
		expect(known[0].pickerKey).toBe(CLASS_SPELL_PICKER_KEY)
	})

	it('names the granting feat and option, keyed to the control that can undo them', () => {
		const known = collectKnownSpells(
			inputs({
				featGrantedSpells: [{ ...mistyStep, featName: 'Fey-Touched' }],
				optionalFeatureGrantedSpells: [{ name: 'Mage Hand', source: 'XPHB', optionName: 'Pact of the Tome' }],
			}),
		)

		expect(known[0]).toEqual({ name: 'Misty Step', source: 'XPHB', label: 'the Fey-Touched feat', pickerKey: featSpellPickerKey('Fey-Touched') })
		expect(known[1]).toEqual({ name: 'Mage Hand', source: 'XPHB', label: 'Pact of the Tome', pickerKey: optionalFeatureSpellPickerKey('Pact of the Tome') })
	})

	it('keeps every source of the same spell (D44 spirit), but not the same source twice', () => {
		const known = collectKnownSpells(
			inputs({
				classSpellPicks: [mistyStep, { name: 'misty step', source: 'xphb' }],
				subclassName: 'Archfey Patron',
				subclassAlwaysPrepared: [mistyStep],
			}),
		)

		expect(known.map((entry) => entry.label)).toEqual(['the Spells step', 'Archfey Patron, always prepared'])
	})
})

describe('knownSpellReason', () => {
	const known = collectKnownSpells(
		inputs({
			classSpellPicks: [{ name: 'Prestidigitation', source: 'XPHB' }],
			subclassName: 'Archfey Patron',
			subclassAlwaysPrepared: [mistyStep],
			subclassSpellChoicePicks: [{ name: 'Alarm', source: 'XPHB' }],
		}),
	)

	it('reports the subclass for a spell granted by it', () => {
		expect(knownSpellReason(known, mistyStep, optionalFeatureSpellPickerKey('Pact of the Tome'))).toBe('Archfey Patron, always prepared')
	})

	it('matches regardless of name case or source case', () => {
		expect(knownSpellReason(known, { name: 'misty step', source: 'xphb' }, CLASS_SPELL_PICKER_KEY)).toBe('Archfey Patron, always prepared')
	})

	it('reports nothing for a spell the character does not have', () => {
		expect(knownSpellReason(known, { name: 'Fireball', source: 'XPHB' }, CLASS_SPELL_PICKER_KEY)).toBeNull()
	})

	it("never reports a picker's own pick back to it, so unselecting stays possible", () => {
		expect(knownSpellReason(known, { name: 'Prestidigitation', source: 'XPHB' }, CLASS_SPELL_PICKER_KEY)).toBeNull()
		expect(knownSpellReason(known, { name: 'Alarm', source: 'XPHB' }, SUBCLASS_SPELL_CHOICE_PICKER_KEY)).toBeNull()
	})

	it('still reports that pick to every OTHER picker', () => {
		expect(knownSpellReason(known, { name: 'Prestidigitation', source: 'XPHB' }, SUBCLASS_SPELL_CHOICE_PICKER_KEY)).toBe('the Spells step')
	})

	it('joins two sources rather than picking one', () => {
		const both = collectKnownSpells(inputs({ classSpellPicks: [mistyStep], subclassName: 'Archfey Patron', subclassAlwaysPrepared: [mistyStep] }))

		expect(knownSpellReason(both, mistyStep, featSpellPickerKey('Fey-Touched'))).toBe('the Spells step; Archfey Patron, always prepared')
	})

	it('separates two different feats, so one feat cannot hide behind another', () => {
		const known = collectKnownSpells(inputs({ featGrantedSpells: [{ ...mistyStep, featName: 'Fey-Touched' }] }))

		expect(knownSpellReason(known, mistyStep, featSpellPickerKey('Fey-Touched'))).toBeNull()
		expect(knownSpellReason(known, mistyStep, featSpellPickerKey('Magic Initiate'))).toBe('the Fey-Touched feat')
	})
})

describe('knownSpellNote', () => {
	it('is the one wording every picker shows', () => {
		expect(knownSpellNote('Archfey Patron, always prepared')).toBe('(already have it from Archfey Patron, always prepared)')
	})
})
