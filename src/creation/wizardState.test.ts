import { describe, expect, it, vi } from 'vitest'
import type { CharacterStore } from '../storage/characterStore'
import {
	emptyWizardData,
	initialControllerState,
	isReadyToSave,
	isStepComplete,
	saveCharacter,
	wizardReducer,
	type WizardControllerState,
	type WizardData,
} from './wizardState'

function completeData(): WizardData {
	return {
		name: 'Aria',
		classChoice: { className: 'Fighter', classSource: 'XPHB', level: 1 },
		speciesChoice: { name: 'Elf', source: 'XPHB' },
		backgroundChoice: { name: 'Soldier', source: 'XPHB', abilityBonus: { strength: 2, constitution: 1 } },
		backgroundToolProficiency: 'Dice Set',
		languageChoice: [
			{ name: 'Draconic', source: 'XPHB' },
			{ name: 'Dwarvish', source: 'XPHB' },
		],
		abilityScores: {
			method: 'standardArray',
			scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 },
		},
		classSkills: ['athletics', 'intimidation'],
		speciesSkills: ['perception'],
		expertiseSkills: [],
		masteries: ['Longsword'],
		fightingStyle: 'Archery',
		subclass: { name: 'Battle Master', source: 'XPHB', featureType: 'MV:B' },
		optionalFeatureChoices: ['Precision Attack'],
		featAsiChoices: [],
		spellChoices: [],
		subclassSpellChoices: [],
	}
}

describe('isStepComplete', () => {
	it('blocks the class step without a name', () => {
		const data = { ...emptyWizardData(), classChoice: { className: 'Fighter', classSource: 'XPHB', level: 1 } }
		expect(isStepComplete('class', data)).toBe(false)
	})

	it('blocks the class step without a class choice', () => {
		const data = { ...emptyWizardData(), name: 'Aria' }
		expect(isStepComplete('class', data)).toBe(false)
	})

	it('allows the class step once both name and class are set', () => {
		const data = { ...emptyWizardData(), name: 'Aria', classChoice: { className: 'Fighter', classSource: 'XPHB', level: 1 } }
		expect(isStepComplete('class', data)).toBe(true)
	})

	it('blocks species, background, languages and abilities until their own picker reports a choice', () => {
		const data = emptyWizardData()
		expect(isStepComplete('species', data)).toBe(false)
		expect(isStepComplete('background', data)).toBe(false)
		expect(isStepComplete('languages', data)).toBe(false)
		expect(isStepComplete('abilities', data)).toBe(false)
	})

	it('blocks the languages step until exactly two are chosen, allows it at exactly two', () => {
		const data = emptyWizardData()
		expect(isStepComplete('languages', { ...data, languageChoice: [{ name: 'Draconic', source: 'XPHB' }] })).toBe(
			false,
		)
		expect(
			isStepComplete('languages', {
				...data,
				languageChoice: [
					{ name: 'Draconic', source: 'XPHB' },
					{ name: 'Dwarvish', source: 'XPHB' },
				],
			}),
		).toBe(true)
	})

	it('blocks the background step until its tool proficiency is set, even with a background chosen', () => {
		const data = {
			...emptyWizardData(),
			backgroundChoice: { name: 'Soldier', source: 'XPHB', abilityBonus: { strength: 2, constitution: 1 } },
		}
		expect(isStepComplete('background', data)).toBe(false)
		expect(isStepComplete('background', { ...data, backgroundToolProficiency: 'Dice Set' })).toBe(true)
	})

	it('the review step is always complete on its own', () => {
		expect(isStepComplete('review', emptyWizardData())).toBe(true)
	})

	it('blocks the featAsi step when a chosen feat needs an ability choice but has none yet', () => {
		const data = { ...emptyWizardData(), featAsiChoices: [{ level: 4, kind: 'feat' as const, name: 'Athlete', source: 'XPHB' }] }
		const requiring = new Set(['Athlete|XPHB'])
		expect(isStepComplete('featAsi', data, null, 1, requiring)).toBe(false)
		expect(
			isStepComplete(
				'featAsi',
				{ ...data, featAsiChoices: [{ level: 4, kind: 'feat' as const, name: 'Athlete', source: 'XPHB', chosenAbility: 'strength' as const }] },
				null,
				1,
				requiring,
			),
		).toBe(true)
	})

	it('does not require an ability choice for a fixed-bonus feat (not in featsRequiringAbilityChoice)', () => {
		const data = { ...emptyWizardData(), featAsiChoices: [{ level: 4, kind: 'feat' as const, name: 'Tough', source: 'XPHB' }] }
		expect(isStepComplete('featAsi', data, null, 1, new Set(['Athlete|XPHB']))).toBe(true)
	})

	it('blocks the featAsi step for a filter-choice feat (slice d5b-1) until its cantrip picks reach the feat\'s own required count', () => {
		const data = { ...emptyWizardData(), featAsiChoices: [{ level: 4, kind: 'feat' as const, name: 'Blessed Warrior', source: 'XPHB' }] }
		expect(isStepComplete('featAsi', data, null, 1)).toBe(false)

		const complete = {
			...data,
			featAsiChoices: [
				{
					level: 4,
					kind: 'feat' as const,
					name: 'Blessed Warrior',
					source: 'XPHB',
					filterChoiceSpells: {
						cantrips: [
							{ name: 'Guidance', source: 'XPHB' },
							{ name: 'Sacred Flame', source: 'XPHB' },
						],
						spells: [],
					},
				},
			],
		}
		expect(isStepComplete('featAsi', complete, null, 1)).toBe(true)
	})
})

describe('isReadyToSave', () => {
	it('is false until every picker step is complete', () => {
		expect(isReadyToSave(emptyWizardData())).toBe(false)
		expect(isReadyToSave(completeData())).toBe(true)
	})
})

describe('wizardReducer navigation', () => {
	it('next is blocked while the current step is incomplete', () => {
		const state = initialControllerState()
		const result = wizardReducer(state, { type: 'next' })
		expect(result.step).toBe('class')
		expect(result).toBe(state)
	})

	it('next advances once the current step is complete', () => {
		let state: WizardControllerState = initialControllerState()
		state = wizardReducer(state, { type: 'setName', name: 'Aria' })
		state = wizardReducer(
			state,
			{ type: 'setClassChoice', choice: { className: 'Fighter', classSource: 'XPHB', level: 1 } },
		)
		state = wizardReducer(state, { type: 'next' })
		expect(state.step).toBe('species')
	})

	it('back preserves everything already chosen on earlier steps', () => {
		let state: WizardControllerState = initialControllerState()
		state = wizardReducer(state, { type: 'setName', name: 'Aria' })
		state = wizardReducer(
			state,
			{ type: 'setClassChoice', choice: { className: 'Fighter', classSource: 'XPHB', level: 1 } },
		)
		state = wizardReducer(state, { type: 'next' })
		state = wizardReducer(state, { type: 'setSpeciesChoice', choice: { name: 'Elf', source: 'XPHB' } })
		state = wizardReducer(state, { type: 'back' })

		expect(state.step).toBe('class')
		expect(state.data.name).toBe('Aria')
		expect(state.data.classChoice).toEqual({ className: 'Fighter', classSource: 'XPHB', level: 1 })
		expect(state.data.speciesChoice).toEqual({ name: 'Elf', source: 'XPHB' })
	})

	it('back on the first step is a no-op', () => {
		const state = initialControllerState()
		const result = wizardReducer(state, { type: 'back' })
		expect(result).toBe(state)
	})

	it('next on the last step is a no-op', () => {
		let state: WizardControllerState = { step: 'review', data: completeData() }
		const result = wizardReducer(state, { type: 'next' })
		expect(result).toBe(state)
	})
})

describe('saveCharacter', () => {
	function fakeStore(): CharacterStore {
		return { create: vi.fn(() => ({ id: 'x', name: 'Aria', classes: [] })) } as unknown as CharacterStore
	}

	it('refuses to save before every picker step is complete', () => {
		const store = fakeStore()
		expect(() => saveCharacter(store, emptyWizardData())).toThrow()
		expect(store.create).not.toHaveBeenCalled()
	})

	it('writes exactly once, with the assembled character, once every step is complete', () => {
		const store = fakeStore()
		saveCharacter(store, completeData(), ['athletics', 'intimidation'])

		expect(store.create).toHaveBeenCalledTimes(1)
		expect(store.create).toHaveBeenCalledWith(
			'Aria',
			[{ className: 'Fighter', classSource: 'XPHB', subclass: 'Battle Master', level: 1 }],
			completeData().abilityScores,
			{ name: 'Elf', source: 'XPHB' },
			{ name: 'Soldier', source: 'XPHB', skillProficiencies: ['athletics', 'intimidation'], toolProficiency: 'Dice Set' },
			{ strength: 2, constitution: 1 },
			[
				{ name: 'Common', source: 'XPHB', grantedBy: 'automatic' },
				{ name: 'Draconic', source: 'XPHB', grantedBy: 'creation' },
				{ name: 'Dwarvish', source: 'XPHB', grantedBy: 'creation' },
			],
			['athletics', 'intimidation'],
			['Longsword'],
			'Archery',
			[{ featureType: 'MV:B', choices: ['Precision Attack'] }],
			['perception'],
			[],
			[],
			undefined,
			undefined,
		)
	})

	it('omits background when the background skill proficiencies were not supplied', () => {
		const store = fakeStore()
		saveCharacter(store, completeData())

		expect(store.create).toHaveBeenCalledWith(
			'Aria',
			[{ className: 'Fighter', classSource: 'XPHB', subclass: 'Battle Master', level: 1 }],
			completeData().abilityScores,
			{ name: 'Elf', source: 'XPHB' },
			undefined,
			{ strength: 2, constitution: 1 },
			[
				{ name: 'Common', source: 'XPHB', grantedBy: 'automatic' },
				{ name: 'Draconic', source: 'XPHB', grantedBy: 'creation' },
				{ name: 'Dwarvish', source: 'XPHB', grantedBy: 'creation' },
			],
			['athletics', 'intimidation'],
			['Longsword'],
			'Archery',
			[{ featureType: 'MV:B', choices: ['Precision Attack'] }],
			['perception'],
			[],
			[],
			undefined,
			undefined,
		)
	})

	it('omits optionalFeatureChoices when the subclass has no optionalfeatureProgression', () => {
		const store = fakeStore()
		saveCharacter(
			store,
			{ ...completeData(), subclass: { name: 'Champion', source: 'XPHB', featureType: null } },
			['athletics', 'intimidation'],
		)

		expect(store.create).toHaveBeenCalledWith(
			'Aria',
			[{ className: 'Fighter', classSource: 'XPHB', subclass: 'Champion', level: 1 }],
			completeData().abilityScores,
			{ name: 'Elf', source: 'XPHB' },
			{ name: 'Soldier', source: 'XPHB', skillProficiencies: ['athletics', 'intimidation'], toolProficiency: 'Dice Set' },
			{ strength: 2, constitution: 1 },
			[
				{ name: 'Common', source: 'XPHB', grantedBy: 'automatic' },
				{ name: 'Draconic', source: 'XPHB', grantedBy: 'creation' },
				{ name: 'Dwarvish', source: 'XPHB', grantedBy: 'creation' },
			],
			['athletics', 'intimidation'],
			['Longsword'],
			'Archery',
			undefined,
			['perception'],
			[],
			[],
			undefined,
			undefined,
		)
	})

	it('forwards the chosen expertise skills and validates readiness against expertiseRequiredCount', () => {
		const store = fakeStore()
		expect(() => saveCharacter(store, completeData(), ['athletics', 'intimidation'], 2)).toThrow()

		saveCharacter(
			store,
			{ ...completeData(), expertiseSkills: ['stealth', 'perception'] },
			['athletics', 'intimidation'],
			2,
		)

		expect(store.create).toHaveBeenLastCalledWith(
			'Aria',
			[{ className: 'Fighter', classSource: 'XPHB', subclass: 'Battle Master', level: 1 }],
			completeData().abilityScores,
			{ name: 'Elf', source: 'XPHB' },
			{ name: 'Soldier', source: 'XPHB', skillProficiencies: ['athletics', 'intimidation'], toolProficiency: 'Dice Set' },
			{ strength: 2, constitution: 1 },
			[
				{ name: 'Common', source: 'XPHB', grantedBy: 'automatic' },
				{ name: 'Draconic', source: 'XPHB', grantedBy: 'creation' },
				{ name: 'Dwarvish', source: 'XPHB', grantedBy: 'creation' },
			],
			['athletics', 'intimidation'],
			['Longsword'],
			'Archery',
			[{ featureType: 'MV:B', choices: ['Precision Attack'] }],
			['perception'],
			['stealth', 'perception'],
			[],
			undefined,
			undefined,
		)
	})

	it('never touches storage while merely navigating steps and editing choices', () => {
		const store = fakeStore()
		let state: WizardControllerState = initialControllerState()
		state = wizardReducer(state, { type: 'setName', name: 'Aria' })
		state = wizardReducer(
			state,
			{ type: 'setClassChoice', choice: { className: 'Fighter', classSource: 'XPHB', level: 1 } },
		)
		state = wizardReducer(state, { type: 'next' })
		state = wizardReducer(state, { type: 'setSpeciesChoice', choice: { name: 'Elf', source: 'XPHB' } })
		state = wizardReducer(state, { type: 'next' })
		state = wizardReducer(state, { type: 'back' })
		state = wizardReducer(state, { type: 'next' })

		expect(store.create).not.toHaveBeenCalled()
		// only calling saveCharacter explicitly writes anything
		void state
	})
})
