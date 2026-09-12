import { describe, expect, it, vi } from 'vitest'
import type { Character } from '../storage/character'
import type { CharacterStore } from '../storage/characterStore'
import {
	emptyWizardData,
	initialControllerState,
	isReadyToSave,
	isStepComplete,
	saveCharacter,
	visibleSteps,
	wizardDataFromCharacter,
	wizardReducer,
	type WizardControllerState,
	type WizardData,
} from './wizardState'

function completeData(): WizardData {
	return {
		name: 'Aria',
		classChoice: { className: 'Fighter', classSource: 'XPHB', level: 1 },
		speciesChoice: { name: 'Elf', source: 'XPHB' },
		backgroundChoice: {
			name: 'Soldier',
			source: 'XPHB',
			abilityBonus: { strength: 2, constitution: 1 },
			abilityBonusDistribution: { mode: 'twoOne', plusTwo: 'strength', plusOne: 'constitution' },
		},
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
		speciesSpellcastingAbility: null,
		expertiseSkills: [],
		masteries: ['Longsword'],
		fightingStyle: 'Archery',
		subclass: { name: 'Battle Master', source: 'XPHB', featureType: 'MV:B' },
		optionalFeatureChoices: ['Precision Attack'],
		classOptionalFeatureChoices: [],
		featAsiChoices: [],
		spellChoices: [],
		subclassSpellChoices: [],
		classFeatureChoices: [],
		wildShapeForms: [],
		hitPointLevels: [],
		startingEquipment: { classOptionKey: 'A', backgroundOptionKey: 'B', categoryPicks: {} },
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

	it('blocks the class step while a granted D21 class-feature choice is unmade', () => {
		const data = { ...emptyWizardData(), name: 'Aria', classChoice: { className: 'Cleric', classSource: 'XPHB', level: 1 } }
		expect(isStepComplete('class', data, { classFeatureChoicesComplete: false })).toBe(false)
		expect(isStepComplete('class', data, { classFeatureChoicesComplete: true })).toBe(true)
	})

	/* Step 6b slice 3 — the Beast Shapes table says the Druid KNOWS four forms at level 2, so the count is exact. */
	it('blocks the class step until the Druid has exactly the granted number of Wild Shape forms', () => {
		const data = { ...emptyWizardData(), name: 'Rowan', classChoice: { className: 'Druid', classSource: 'XPHB', level: 2 } }
		expect(isStepComplete('class', data, { wildShapeFormCount: 4 })).toBe(false)

		const two = { ...data, wildShapeForms: [{ name: 'Wolf', source: 'XMM' }, { name: 'Rat', source: 'XMM' }] }
		expect(isStepComplete('class', two, { wildShapeFormCount: 4 })).toBe(false)

		const four = {
			...data,
			wildShapeForms: [
				{ name: 'Wolf', source: 'XMM' },
				{ name: 'Rat', source: 'XMM' },
				{ name: 'Spider', source: 'XMM' },
				{ name: 'Riding Horse', source: 'XMM' },
			],
		}
		expect(isStepComplete('class', four, { wildShapeFormCount: 4 })).toBe(true)
	})

	it('does not ask a non-Druid for Wild Shape forms', () => {
		const data = { ...emptyWizardData(), name: 'Aria', classChoice: { className: 'Fighter', classSource: 'XPHB', level: 8 } }
		expect(isStepComplete('class', data)).toBe(true)
	})

	it('blocks species, background, languages and abilities until their own picker reports a choice', () => {
		const data = emptyWizardData()
		expect(isStepComplete('species', data)).toBe(false)
		expect(isStepComplete('background', data)).toBe(false)
		expect(isStepComplete('languages', data)).toBe(false)
		expect(isStepComplete('abilities', data)).toBe(false)
	})

	/* D89 follow-up: gated the same way as speciesVariantChoiceComplete/speciesSkillsComplete — a condition, not a WizardData field, since the choice/list itself comes from species.json. */
	it('blocks the species step on speciesSpellcastingAbilityComplete alone, once a species is picked', () => {
		const data = { ...emptyWizardData(), speciesChoice: { name: 'Aarakocra', source: 'XPHB' }, speciesSkills: ['perception'] }
		expect(isStepComplete('species', data, { speciesSkillsComplete: true, speciesSpellcastingAbilityComplete: false })).toBe(false)
		expect(isStepComplete('species', data, { speciesSkillsComplete: true, speciesSpellcastingAbilityComplete: true })).toBe(true)
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
		const data: WizardData = {
			...emptyWizardData(),
			backgroundChoice: {
				name: 'Soldier',
				source: 'XPHB',
				abilityBonus: { strength: 2, constitution: 1 },
				abilityBonusDistribution: { mode: 'twoOne', plusTwo: 'strength', plusOne: 'constitution' },
			},
		}
		expect(isStepComplete('background', data)).toBe(false)
		expect(isStepComplete('background', { ...data, backgroundToolProficiency: 'Dice Set' })).toBe(true)
	})

	it('remembers a background whose ability bonus is not yet distributed, without completing the step', () => {
		// The picker stores the background (and any partial distribution) the moment it is
		// picked; abilityBonus stays {} until the distribution is a complete +2/+1 or +1/+1/+1.
		const partial: WizardData = {
			...emptyWizardData(),
			backgroundChoice: {
				name: 'Soldier',
				source: 'XPHB',
				abilityBonus: {},
				abilityBonusDistribution: { mode: 'twoOne', plusTwo: 'strength', plusOne: null },
			},
			backgroundToolProficiency: 'Dice Set',
		}
		expect(isStepComplete('background', partial)).toBe(false)

		const finished: WizardData = {
			...partial,
			backgroundChoice: {
				name: 'Soldier',
				source: 'XPHB',
				abilityBonus: { strength: 2, constitution: 1 },
				abilityBonusDistribution: { mode: 'twoOne', plusTwo: 'strength', plusOne: 'constitution' },
			},
		}
		expect(isStepComplete('background', finished)).toBe(true)
	})

	it('the review step is always complete on its own', () => {
		expect(isStepComplete('review', emptyWizardData())).toBe(true)
	})

	it('equipment step needs an option from both the class and the background, and every category pick made', () => {
		const nothing = emptyWizardData()
		expect(isStepComplete('equipment', nothing)).toBe(false)

		const classOnly = { ...nothing, startingEquipment: { ...nothing.startingEquipment, classOptionKey: 'A' } }
		expect(isStepComplete('equipment', classOnly)).toBe(false)

		const both = { ...classOnly, startingEquipment: { ...classOnly.startingEquipment, backgroundOptionKey: 'B' } }
		expect(isStepComplete('equipment', both)).toBe(true)
		expect(isStepComplete('equipment', both, { startingEquipmentCategoryPicksComplete: false })).toBe(false)
	})

	it('blocks the featAsi step when a chosen feat needs an ability choice but has none yet', () => {
		const data = { ...emptyWizardData(), featAsiChoices: [{ level: 4, kind: 'feat' as const, name: 'Athlete', source: 'XPHB' }] }
		const requiring = new Set(['Athlete|XPHB'])
		expect(isStepComplete('featAsi', data, { featAsiEligibleLevelCount: 1, featsRequiringAbilityChoice: requiring })).toBe(false)
		expect(
			isStepComplete(
				'featAsi',
				{ ...data, featAsiChoices: [{ level: 4, kind: 'feat' as const, name: 'Athlete', source: 'XPHB', chosenAbility: 'strength' as const }] },
				{ featAsiEligibleLevelCount: 1, featsRequiringAbilityChoice: requiring },
			),
		).toBe(true)
	})

	it('does not require an ability choice for a fixed-bonus feat (not in featsRequiringAbilityChoice)', () => {
		const data = { ...emptyWizardData(), featAsiChoices: [{ level: 4, kind: 'feat' as const, name: 'Tough', source: 'XPHB' }] }
		expect(
			isStepComplete('featAsi', data, { featAsiEligibleLevelCount: 1, featsRequiringAbilityChoice: new Set(['Athlete|XPHB']) }),
		).toBe(true)
	})

	it('blocks the featAsi step for a filter-choice feat (slice d5b-1) until its cantrip picks reach the feat\'s own required count', () => {
		const data = { ...emptyWizardData(), featAsiChoices: [{ level: 4, kind: 'feat' as const, name: 'Blessed Warrior', source: 'XPHB' }] }
		expect(isStepComplete('featAsi', data, { featAsiEligibleLevelCount: 1 })).toBe(false)

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
		expect(isStepComplete('featAsi', complete, { featAsiEligibleLevelCount: 1 })).toBe(true)
	})

	/* Build order step 8, slice 8b. Level 1 is never asked for (D92); every level from 2 up needs its own recorded entry. */
	describe('hitPoints', () => {
		it('is complete for a level-1 character with no recorded levels', () => {
			const data = { ...emptyWizardData(), classChoice: { className: 'Fighter', classSource: 'XPHB', level: 1 } }
			expect(isStepComplete('hitPoints', data)).toBe(true)
		})

		it('blocks the step until every level from 2 up has a recorded choice', () => {
			const data = { ...emptyWizardData(), classChoice: { className: 'Fighter', classSource: 'XPHB', level: 3 } }
			expect(isStepComplete('hitPoints', data)).toBe(false)

			const partial = { ...data, hitPointLevels: [{ level: 2, kind: 'average' as const, dieResult: 6 }] }
			expect(isStepComplete('hitPoints', partial)).toBe(false)

			const complete = {
				...data,
				hitPointLevels: [
					{ level: 2, kind: 'average' as const, dieResult: 6 },
					{ level: 3, kind: 'roll' as const, dieResult: 8 },
				],
			}
			expect(isStepComplete('hitPoints', complete)).toBe(true)
		})

		it('does not let a level above the character\'s own stand in for a missing one', () => {
			const data = {
				...emptyWizardData(),
				classChoice: { className: 'Fighter', classSource: 'XPHB', level: 2 },
				hitPointLevels: [{ level: 5, kind: 'manual' as const, dieResult: 10 }],
			}
			expect(isStepComplete('hitPoints', data)).toBe(false)
		})

		/* Build order step 8, slice 8d5: a level-up walk asks about only the level being gained. */
		it('during a level-up walk, needs only the level being gained, not every level below it', () => {
			const data = {
				...emptyWizardData(),
				classChoice: { className: 'Fighter', classSource: 'XPHB', level: 10 },
				hitPointLevels: [],
			}
			expect(isStepComplete('hitPoints', data, { levelUpTargetLevel: 10 })).toBe(false)

			const withLowerLevelsOnly = { ...data, hitPointLevels: [{ level: 9, kind: 'average' as const, dieResult: 6 }] }
			expect(isStepComplete('hitPoints', withLowerLevelsOnly, { levelUpTargetLevel: 10 })).toBe(false)

			const withTargetLevel = { ...data, hitPointLevels: [{ level: 10, kind: 'roll' as const, dieResult: 8 }] }
			expect(isStepComplete('hitPoints', withTargetLevel, { levelUpTargetLevel: 10 })).toBe(true)
		})
	})
})

describe('visibleSteps — hitPoints', () => {
	it('hides the step at level 1 or with no class chosen yet', () => {
		expect(visibleSteps({ characterLevel: 1 })).not.toContain('hitPoints')
		expect(visibleSteps({ characterLevel: null })).not.toContain('hitPoints')
		expect(visibleSteps({})).not.toContain('hitPoints')
	})

	it('shows the step from level 2 up, directly after featAsi', () => {
		const steps = visibleSteps({ characterLevel: 5, featAsiEligibleLevelCount: 1 })
		expect(steps).toContain('hitPoints')
		expect(steps.indexOf('hitPoints')).toBe(steps.indexOf('featAsi') + 1)
		expect(steps.indexOf('hitPoints')).toBe(steps.indexOf('equipment') - 1)
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

	/* The legal pool depends on class, level AND subclass — Circle of the Moon raises the CR cap. */
	it('clears the Wild Shape forms when the class or the subclass changes', () => {
		const picked: WizardControllerState = {
			step: 'class',
			data: { ...emptyWizardData(), wildShapeForms: [{ name: 'Wolf', source: 'XMM' }] },
		}

		const afterClass = wizardReducer(picked, {
			type: 'setClassChoice',
			choice: { className: 'Druid', classSource: 'XPHB', level: 4 },
		})
		expect(afterClass.data.wildShapeForms).toEqual([])

		const afterSubclass = wizardReducer(picked, {
			type: 'setSubclass',
			subclass: { name: 'Circle of the Moon', source: 'XPHB', featureType: null },
		})
		expect(afterSubclass.data.wildShapeForms).toEqual([])
	})

	/* Build order step 8, slice 8b. */
	it('setHitPointLevels records the picks', () => {
		const state: WizardControllerState = { step: 'hitPoints', data: emptyWizardData() }
		const recorded = wizardReducer(state, { type: 'setHitPointLevels', levels: [{ level: 2, kind: 'roll', dieResult: 5 }] })
		expect(recorded.data.hitPointLevels).toEqual([{ level: 2, kind: 'roll', dieResult: 5 }])
	})

	/* A stored die result belongs to that class's own hit die (D11) — a different class invalidates it. */
	it('setClassChoice clears previously recorded hit point levels', () => {
		const picked: WizardControllerState = {
			step: 'hitPoints',
			data: { ...emptyWizardData(), hitPointLevels: [{ level: 2, kind: 'average', dieResult: 6 }] },
		}
		const afterClass = wizardReducer(picked, {
			type: 'setClassChoice',
			choice: { className: 'Wizard', classSource: 'XPHB', level: 4 },
		})
		expect(afterClass.data.hitPointLevels).toEqual([])
	})

	/* Step 7 slice a2: each side's option belongs to the class or the background that offered it, and only that side is recomputed. */
	it('clears the class half of the starting equipment when the class changes, and leaves the background half alone', () => {
		const picked: WizardControllerState = {
			step: 'equipment',
			data: {
				...emptyWizardData(),
				startingEquipment: {
					classOptionKey: 'A',
					backgroundOptionKey: 'B',
					categoryPicks: {
						'class:A:2': { name: 'Lute', source: 'XPHB' },
						'background:B:0': { name: 'Dice Set', source: 'XPHB' },
					},
				},
			},
		}

		const afterClass = wizardReducer(picked, {
			type: 'setClassChoice',
			choice: { className: 'Wizard', classSource: 'XPHB', level: 1 },
		})
		expect(afterClass.data.startingEquipment).toEqual({
			classOptionKey: null,
			backgroundOptionKey: 'B',
			categoryPicks: { 'background:B:0': { name: 'Dice Set', source: 'XPHB' } },
		})
	})

	it('clears the background half of the starting equipment only when the background identity changes', () => {
		const base: WizardControllerState = {
			step: 'equipment',
			data: {
				...emptyWizardData(),
				backgroundChoice: { name: 'Soldier', source: 'XPHB', abilityBonus: {}, abilityBonusDistribution: null },
				startingEquipment: {
					classOptionKey: 'A',
					backgroundOptionKey: 'B',
					categoryPicks: { 'background:B:0': { name: 'Dice Set', source: 'XPHB' } },
				},
			},
		}

		const sameBackground = wizardReducer(base, {
			type: 'setBackgroundChoice',
			choice: {
				name: 'Soldier',
				source: 'XPHB',
				abilityBonus: { strength: 2, dexterity: 1 },
				abilityBonusDistribution: { mode: 'twoOne', plusTwo: 'strength', plusOne: 'dexterity' },
			},
		})
		expect(sameBackground.data.startingEquipment.backgroundOptionKey).toBe('B')

		const otherBackground = wizardReducer(base, {
			type: 'setBackgroundChoice',
			choice: { name: 'Sage', source: 'XPHB', abilityBonus: {}, abilityBonusDistribution: null },
		})
		expect(otherBackground.data.startingEquipment).toEqual({
			classOptionKey: 'A',
			backgroundOptionKey: null,
			categoryPicks: {},
		})
	})

	it('setBackgroundChoice clears tool proficiency only when the background identity changes, not its distribution', () => {
		const base: WizardControllerState = {
			step: 'background',
			data: {
				...emptyWizardData(),
				backgroundChoice: { name: 'Soldier', source: 'XPHB', abilityBonus: {}, abilityBonusDistribution: null },
				backgroundToolProficiency: "Smith's Tools",
				expertiseSkills: ['athletics'],
			},
		}

		const sameBackground = wizardReducer(base, {
			type: 'setBackgroundChoice',
			choice: {
				name: 'Soldier',
				source: 'XPHB',
				abilityBonus: { strength: 2, dexterity: 1 },
				abilityBonusDistribution: { mode: 'twoOne', plusTwo: 'strength', plusOne: 'dexterity' },
			},
		})
		expect(sameBackground.data.backgroundToolProficiency).toBe("Smith's Tools")
		expect(sameBackground.data.expertiseSkills).toEqual(['athletics'])

		const otherBackground = wizardReducer(base, {
			type: 'setBackgroundChoice',
			choice: { name: 'Sage', source: 'XPHB', abilityBonus: {}, abilityBonusDistribution: null },
		})
		expect(otherBackground.data.backgroundToolProficiency).toBeNull()
		expect(otherBackground.data.expertiseSkills).toEqual([])
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
		expect(store.create).toHaveBeenCalledWith({
			name: 'Aria',
			classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Battle Master', level: 1 }],
			abilityScores: completeData().abilityScores,
			species: { name: 'Elf', source: 'XPHB' },
			background: { name: 'Soldier', source: 'XPHB', skillProficiencies: ['athletics', 'intimidation'], toolProficiency: 'Dice Set' },
			abilityBonus: { strength: 2, constitution: 1 },
			languages: [
				{ name: 'Common', source: 'XPHB', grantedBy: 'automatic' },
				{ name: 'Draconic', source: 'XPHB', grantedBy: 'creation' },
				{ name: 'Dwarvish', source: 'XPHB', grantedBy: 'creation' },
			],
			classSkills: ['athletics', 'intimidation'],
			masteries: [{ name: 'Longsword' }],
			fightingStyle: 'Archery',
			optionalFeatureChoices: [{ featureType: 'MV:B', choices: [{ name: 'Precision Attack' }] }],
			speciesSkills: ['perception'],
			expertiseSkills: [],
			featAsiChoices: [],
			spellChoices: undefined,
			subclassSpellChoices: undefined,
			classFeatureChoices: undefined,
			wildShapeForms: undefined,
			inventory: undefined,
			currencyCopper: undefined,
			speciesSpellcastingAbility: undefined,
			hitPointLevels: undefined,
		})
	})

	it('passes the D21 class-feature choices straight through to the store', () => {
		const store = fakeStore()
		const choice = { className: 'Fighter', classSource: 'XPHB', featureName: 'Divine Order', grantedAtLevel: 1, optionName: 'Thaumaturge' }
		saveCharacter(store, { ...completeData(), classFeatureChoices: [choice] }, ['athletics', 'intimidation'])
		expect(vi.mocked(store.create).mock.calls[0][0].classFeatureChoices).toEqual([choice])
	})

	/*
	 * Step 6b slice 3. Tagged with the class (D11) and deliberately WITHOUT a
	 * level: the forms are swappable on a Long Rest, so D22's "record the level
	 * it was chosen at" would claim a provenance the rules do not give.
	 */
	it('tags the Wild Shape forms with their class and stores no level', () => {
		const store = fakeStore()
		const forms = [
			{ name: 'Wolf', source: 'XMM' },
			{ name: 'Rat', source: 'XMM' },
			{ name: 'Spider', source: 'XMM' },
			{ name: 'Riding Horse', source: 'XMM' },
		]
		const druid = {
			...completeData(),
			classChoice: { className: 'Druid', classSource: 'XPHB', level: 2 },
			subclass: null,
			optionalFeatureChoices: [],
			wildShapeForms: forms,
		}
		saveCharacter(store, druid, ['athletics', 'intimidation'], { wildShapeFormCount: 4 })

		const stored = vi.mocked(store.create).mock.calls[0][0].wildShapeForms
		expect(stored).toEqual([{ className: 'Druid', classSource: 'XPHB', forms }])
		for (const entry of stored as { forms: Record<string, unknown>[] }[]) {
			for (const form of entry.forms) expect(Object.keys(form).sort()).toEqual(['name', 'source'])
		}
	})

	it('omits Wild Shape forms entirely when none were chosen', () => {
		const store = fakeStore()
		saveCharacter(store, completeData(), ['athletics', 'intimidation'])
		expect(vi.mocked(store.create).mock.calls[0][0].wildShapeForms).toBeUndefined()
	})

	it('omits background when the background skill proficiencies were not supplied', () => {
		const store = fakeStore()
		saveCharacter(store, completeData())

		expect(store.create).toHaveBeenCalledWith({
			name: 'Aria',
			classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Battle Master', level: 1 }],
			abilityScores: completeData().abilityScores,
			species: { name: 'Elf', source: 'XPHB' },
			background: undefined,
			abilityBonus: { strength: 2, constitution: 1 },
			languages: [
				{ name: 'Common', source: 'XPHB', grantedBy: 'automatic' },
				{ name: 'Draconic', source: 'XPHB', grantedBy: 'creation' },
				{ name: 'Dwarvish', source: 'XPHB', grantedBy: 'creation' },
			],
			classSkills: ['athletics', 'intimidation'],
			masteries: [{ name: 'Longsword' }],
			fightingStyle: 'Archery',
			optionalFeatureChoices: [{ featureType: 'MV:B', choices: [{ name: 'Precision Attack' }] }],
			speciesSkills: ['perception'],
			expertiseSkills: [],
			featAsiChoices: [],
			spellChoices: undefined,
			subclassSpellChoices: undefined,
			classFeatureChoices: undefined,
			wildShapeForms: undefined,
			inventory: undefined,
			currencyCopper: undefined,
			speciesSpellcastingAbility: undefined,
			hitPointLevels: undefined,
		})
	})

	it('omits optionalFeatureChoices when the subclass has no optionalfeatureProgression', () => {
		const store = fakeStore()
		saveCharacter(
			store,
			{ ...completeData(), subclass: { name: 'Champion', source: 'XPHB', featureType: null } },
			['athletics', 'intimidation'],
		)

		expect(store.create).toHaveBeenCalledWith({
			name: 'Aria',
			classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Champion', level: 1 }],
			abilityScores: completeData().abilityScores,
			species: { name: 'Elf', source: 'XPHB' },
			background: { name: 'Soldier', source: 'XPHB', skillProficiencies: ['athletics', 'intimidation'], toolProficiency: 'Dice Set' },
			abilityBonus: { strength: 2, constitution: 1 },
			languages: [
				{ name: 'Common', source: 'XPHB', grantedBy: 'automatic' },
				{ name: 'Draconic', source: 'XPHB', grantedBy: 'creation' },
				{ name: 'Dwarvish', source: 'XPHB', grantedBy: 'creation' },
			],
			classSkills: ['athletics', 'intimidation'],
			masteries: [{ name: 'Longsword' }],
			fightingStyle: 'Archery',
			optionalFeatureChoices: undefined,
			speciesSkills: ['perception'],
			expertiseSkills: [],
			featAsiChoices: [],
			spellChoices: undefined,
			subclassSpellChoices: undefined,
			classFeatureChoices: undefined,
			wildShapeForms: undefined,
			inventory: undefined,
			currencyCopper: undefined,
			speciesSpellcastingAbility: undefined,
			hitPointLevels: undefined,
		})
	})

	it('forwards the chosen expertise skills and validates readiness against expertiseRequiredCount', () => {
		const store = fakeStore()
		expect(() => saveCharacter(store, completeData(), ['athletics', 'intimidation'], { expertiseRequiredCount: 2 })).toThrow()

		saveCharacter(
			store,
			{ ...completeData(), expertiseSkills: ['stealth', 'perception'] },
			['athletics', 'intimidation'],
			{ expertiseRequiredCount: 2 },
		)

		expect(store.create).toHaveBeenLastCalledWith({
			name: 'Aria',
			classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Battle Master', level: 1 }],
			abilityScores: completeData().abilityScores,
			species: { name: 'Elf', source: 'XPHB' },
			background: { name: 'Soldier', source: 'XPHB', skillProficiencies: ['athletics', 'intimidation'], toolProficiency: 'Dice Set' },
			abilityBonus: { strength: 2, constitution: 1 },
			languages: [
				{ name: 'Common', source: 'XPHB', grantedBy: 'automatic' },
				{ name: 'Draconic', source: 'XPHB', grantedBy: 'creation' },
				{ name: 'Dwarvish', source: 'XPHB', grantedBy: 'creation' },
			],
			classSkills: ['athletics', 'intimidation'],
			masteries: [{ name: 'Longsword' }],
			fightingStyle: 'Archery',
			optionalFeatureChoices: [{ featureType: 'MV:B', choices: [{ name: 'Precision Attack' }] }],
			speciesSkills: ['perception'],
			// A creation pick carries no level, exactly as masteries does (D98 following D97).
			expertiseSkills: [{ name: 'stealth' }, { name: 'perception' }],
			featAsiChoices: [],
			spellChoices: undefined,
			subclassSpellChoices: undefined,
			classFeatureChoices: undefined,
			wildShapeForms: undefined,
			inventory: undefined,
			currencyCopper: undefined,
			speciesSpellcastingAbility: undefined,
			hitPointLevels: undefined,
		})
	})

	/* Build order step 8, slice 8b — already exactly Character.hitPointLevels' own shape, so it passes straight through. */
	it('passes recorded hit point levels through to the store, and omits them entirely when none were recorded', () => {
		const store = fakeStore()
		const levels = [{ level: 2, kind: 'average' as const, dieResult: 6 }]
		saveCharacter(store, { ...completeData(), hitPointLevels: levels }, ['athletics', 'intimidation'])
		expect(vi.mocked(store.create).mock.calls[0][0].hitPointLevels).toEqual(levels)

		saveCharacter(store, completeData(), ['athletics', 'intimidation'])
		expect(vi.mocked(store.create).mock.calls[1][0].hitPointLevels).toBeUndefined()
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

/*
 * Build order step 8, slice 8d1 — the wizard run over an existing character.
 * The one thing every test here is really guarding is D97/D98/D99's recorded
 * levels: a round trip through name-based pickers must not quietly drop them.
 */
describe('editing an existing character', () => {
	function editStore(): CharacterStore {
		return {
			create: vi.fn(() => ({ id: 'x', name: 'Aria', classes: [] })),
			update: vi.fn((id: string) => ({ id, name: 'Aria', classes: [] })),
		} as unknown as CharacterStore
	}

	/** A level-5 Fighter carrying a recorded level on every choice that has one. */
	function storedCharacter(): Character {
		return {
			id: 'char-1',
			name: 'Aria',
			classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Battle Master', level: 5 }],
			abilityScores: {
				method: 'standardArray',
				scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 },
			},
			species: { name: 'Elf', source: 'XPHB' },
			background: { name: 'Soldier', source: 'XPHB', skillProficiencies: ['athletics', 'intimidation'], toolProficiency: 'Dice Set' },
			abilityBonus: { strength: 2, constitution: 1 },
			languages: [
				{ name: 'Common', source: 'XPHB', grantedBy: 'automatic' },
				{ name: 'Draconic', source: 'XPHB', grantedBy: 'creation' },
				{ name: 'Dwarvish', source: 'XPHB', grantedBy: 'creation' },
			],
			classSkills: ['acrobatics', 'survival'],
			masteries: [{ name: 'Longsword', level: 4 }, { name: 'Greataxe' }],
			expertiseSkills: [{ name: 'acrobatics', level: 3 }],
			fightingStyle: 'Archery',
			optionalFeatureChoices: [
				{ featureType: 'MV:B', choices: [{ name: 'Precision Attack', level: 3 }, { name: 'Riposte' }] },
				{ featureType: 'EI', choices: [{ name: 'Agonizing Blast', level: 2 }] },
			],
			speciesSkills: ['perception'],
			featAsiChoices: [{ level: 4, kind: 'asi', increases: { strength: 2 } }],
			spellChoices: [{ className: 'Fighter', classSource: 'XPHB', spells: [{ name: 'Fire Bolt', source: 'XPHB' }] }],
			hitPointLevels: [
				{ level: 2, kind: 'average', dieResult: 6 },
				{ level: 3, kind: 'roll', dieResult: 4 },
				{ level: 4, kind: 'average', dieResult: 6 },
				{ level: 5, kind: 'manual', dieResult: 10 },
			],
			inventory: [{ name: 'Longsword', source: 'XPHB', quantity: 1 }],
			currencyCopper: 500,
			currentHp: 30,
			familiar: { name: 'Owl', source: 'XMM' },
		}
	}

	const lookups = {
		subclasses: [{ name: 'Battle Master', source: 'XPHB', featureType: 'MV:B' }],
		spellLevels: [{ name: 'Fire Bolt', source: 'XPHB', level: 0 }],
	}

	/** What the round trip needs so every visible step counts as complete: one ASI grant at level 4, and a level-5 character (so the hit-points step appears). */
	const editConditions = { featAsiEligibleLevelCount: 1, characterLevel: 5, editingExistingCharacter: true }

	it('seeds the wizard from a stored character', () => {
		const data = wizardDataFromCharacter(storedCharacter(), lookups)

		expect(data.classChoice).toEqual({ className: 'Fighter', classSource: 'XPHB', level: 5 })
		expect(data.subclass).toEqual({ name: 'Battle Master', source: 'XPHB', featureType: 'MV:B' })
		// Bare names in the wizard; Common is left out, since saveCharacter adds it back.
		expect(data.masteries).toEqual(['Longsword', 'Greataxe'])
		expect(data.expertiseSkills).toEqual(['acrobatics'])
		expect(data.optionalFeatureChoices).toEqual(['Precision Attack', 'Riposte'])
		expect(data.classOptionalFeatureChoices).toEqual([{ featureType: 'EI', choices: [{ name: 'Agonizing Blast', level: 2 }] }])
		expect(data.languageChoice).toEqual([
			{ name: 'Draconic', source: 'XPHB' },
			{ name: 'Dwarvish', source: 'XPHB' },
		])
		// The level is not stored on a spell pick; the wizard's own counts need it, so it is read back from the spell data.
		expect(data.spellChoices).toEqual([{ name: 'Fire Bolt', source: 'XPHB', level: 0 }])
		expect(data.backgroundChoice).toEqual({
			name: 'Soldier',
			source: 'XPHB',
			abilityBonus: { strength: 2, constitution: 1 },
			abilityBonusDistribution: { mode: 'twoOne', plusTwo: 'strength', plusOne: 'constitution' },
		})
		expect(data.hitPointLevels).toEqual(storedCharacter().hitPointLevels)
	})

	it('round-trips a character through seed and save unchanged, keeping every recorded level', () => {
		const store = editStore()
		const character = storedCharacter()
		const data = wizardDataFromCharacter(character, lookups)

		saveCharacter(store, data, ['athletics', 'intimidation'], editConditions, undefined, character)

		expect(store.create).not.toHaveBeenCalled()
		expect(store.update).toHaveBeenCalledTimes(1)
		const [id, input] = vi.mocked(store.update).mock.calls[0]
		expect(id).toBe('char-1')
		const { id: _id, ...expected } = character
		expect(input).toEqual(expected)
	})

	it('keeps the level of a pick that was already there and records none for one added during the edit', () => {
		const store = editStore()
		const character = storedCharacter()
		const data = wizardDataFromCharacter(character, lookups)

		saveCharacter(
			store,
			{ ...data, masteries: [...data.masteries, 'Rapier'], optionalFeatureChoices: [...data.optionalFeatureChoices, 'Trip Attack'] },
			['athletics', 'intimidation'],
			editConditions,
			undefined,
			character,
		)

		const input = vi.mocked(store.update).mock.calls[0][1]
		expect(input.masteries).toEqual([{ name: 'Longsword', level: 4 }, { name: 'Greataxe' }, { name: 'Rapier' }])
		expect(input.optionalFeatureChoices).toContainEqual({
			featureType: 'MV:B',
			choices: [{ name: 'Precision Attack', level: 3 }, { name: 'Riposte' }, { name: 'Trip Attack' }],
		})
	})

	it('refuses a level below the character’s own', () => {
		const store = editStore()
		const character = storedCharacter()
		const data = wizardDataFromCharacter(character, lookups)
		const lowered = { ...data, classChoice: { className: 'Fighter', classSource: 'XPHB', level: 4 } }

		expect(() => saveCharacter(store, lowered, ['athletics', 'intimidation'], { ...editConditions, characterLevel: 4 }, undefined, character)).toThrow(
			/cannot be lowered/i,
		)
		expect(store.update).not.toHaveBeenCalled()
	})

	/* The equipment step is not part of an edit, so the character keeps what it carries and its play state survives the replacement write. */
	it('carries the inventory, money and play state through an edit', () => {
		const store = editStore()
		const character = storedCharacter()
		const data = wizardDataFromCharacter(character, lookups)

		saveCharacter(store, data, ['athletics', 'intimidation'], editConditions, { inventory: [], currencyCopper: 0 }, character)

		const input = vi.mocked(store.update).mock.calls[0][1]
		expect(input.inventory).toEqual([{ name: 'Longsword', source: 'XPHB', quantity: 1 }])
		expect(input.currencyCopper).toBe(500)
		expect(input.currentHp).toBe(30)
		expect(input.familiar).toEqual({ name: 'Owl', source: 'XMM' })
	})

	it('hides the equipment step while editing and keeps it while creating', () => {
		expect(visibleSteps({ editingExistingCharacter: true })).not.toContain('equipment')
		expect(visibleSteps({})).toContain('equipment')
	})
})

describe('wizardReducer setClassChoice', () => {
	function fighterState(): WizardControllerState {
		return {
			step: 'class',
			data: {
				...completeData(),
				classChoice: { className: 'Fighter', classSource: 'XPHB', level: 5 },
				hitPointLevels: [{ level: 2, kind: 'average', dieResult: 6 }],
			},
		}
	}

	/* D100: raising the level keeps everything — wiping here would destroy the levels recorded on each choice. */
	it('keeps every choice when only the level changed', () => {
		const state = fighterState()
		const next = wizardReducer(state, { type: 'setClassChoice', choice: { className: 'Fighter', classSource: 'XPHB', level: 6 } })

		expect(next.data.classChoice?.level).toBe(6)
		expect(next.data.classSkills).toEqual(state.data.classSkills)
		expect(next.data.masteries).toEqual(state.data.masteries)
		expect(next.data.subclass).toEqual(state.data.subclass)
		expect(next.data.optionalFeatureChoices).toEqual(state.data.optionalFeatureChoices)
		expect(next.data.hitPointLevels).toEqual(state.data.hitPointLevels)
		expect(next.data.startingEquipment).toEqual(state.data.startingEquipment)
	})

	it('clears the class’s own choices when the class itself changed', () => {
		const next = wizardReducer(fighterState(), { type: 'setClassChoice', choice: { className: 'Wizard', classSource: 'XPHB', level: 5 } })

		expect(next.data.classChoice?.className).toBe('Wizard')
		expect(next.data.classSkills).toEqual([])
		expect(next.data.masteries).toEqual([])
		expect(next.data.subclass).toBeNull()
		expect(next.data.optionalFeatureChoices).toEqual([])
		expect(next.data.hitPointLevels).toEqual([])
		expect(next.data.startingEquipment.classOptionKey).toBeNull()
	})
})
