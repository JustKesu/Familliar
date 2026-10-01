import { describe, expect, it, vi } from 'vitest'
import { featsRequiringAbilityChoice } from '../featAsi/featAsiData'
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
	reachableSteps,
	type ClassPickRequirements,
	type WizardControllerState,
	type WizardData,
} from './wizardState'

const ELEMENTAL_FURY = { className: 'Druid', classSource: 'XPHB', featureName: 'Elemental Fury', grantedAtLevel: 7, optionName: 'Potent Spellcasting' }

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
		featureLanguages: [],
		toolChoices: [],
		subclassSkills: [],
		speciesExtraSkill: null,
		abilityScores: {
			method: 'standardArray',
			scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 },
		},
		classSkills: ['athletics', 'intimidation'],
		speciesSkills: ['perception'],
		speciesSize: null,
		speciesSpellcastingAbility: null,
		expertiseSkills: [],
		masteries: ['Longsword'],
		fightingStyle: 'Archery',
		subclass: { name: 'Battle Master', source: 'XPHB', featureType: 'MV:B' },
		optionalFeatureChoices: ['Precision Attack'],
		classOptionalFeatureChoices: [],
		featAsiChoices: [],
		grantedFeats: [],
		backgroundOriginFeatOverride: null,
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

	/* W-3: SPEC — "no choice may be skipped". Each missing pick on its own keeps the step incomplete. */
	describe('class pick requirements', () => {
		const fighter3 = { ...emptyWizardData(), name: 'Aria', classChoice: { className: 'Fighter', classSource: 'XPHB', level: 3 } }
		const required: ClassPickRequirements = { subclass: true, fightingStyle: true, masteryCount: 2, optionalFeatureCount: 0, skillCount: 2, classFeatureNames: [] }
		const done = {
			...fighter3,
			subclass: { name: 'Champion', source: 'XPHB', featureType: null },
			fightingStyle: 'Defense',
			masteries: ['Longsword', 'Greatsword'],
			classSkills: ['athletics', 'perception'],
		}

		it('needs exactly the class skill count', () => {
			expect(isStepComplete('class', { ...done, classSkills: ['athletics'] }, { classPickRequirements: required })).toBe(false)
			expect(isStepComplete('class', { ...done, classSkills: [] }, { classPickRequirements: required })).toBe(false)
			expect(isStepComplete('class', done, { classPickRequirements: required })).toBe(true)
		})

		it('does not ask a level up that already holds its class skills (skillCount null)', () => {
			expect(isStepComplete('class', { ...done, classSkills: ['athletics'] }, { classPickRequirements: { ...required, skillCount: null }, levelUpTargetLevel: 4 })).toBe(true)
		})

		it('is complete only when the subclass, the fighting style and every mastery are chosen', () => {
			expect(isStepComplete('class', done, { classPickRequirements: required })).toBe(true)
			expect(isStepComplete('class', { ...done, subclass: null }, { classPickRequirements: required })).toBe(false)
			expect(isStepComplete('class', { ...done, fightingStyle: null }, { classPickRequirements: required })).toBe(false)
			expect(isStepComplete('class', { ...done, masteries: ['Longsword'] }, { classPickRequirements: required })).toBe(false)
		})

		it('asks for nothing a class does not grant at this level', () => {
			const level1 = { ...fighter3, classChoice: { className: 'Fighter', classSource: 'XPHB', level: 1 }, fightingStyle: 'Defense', masteries: ['Longsword', 'Greatsword'], classSkills: ['athletics', 'perception'] }
			expect(isStepComplete('class', level1, { classPickRequirements: { ...required, subclass: false } })).toBe(true)
		})

		it('D251: refuses a pick the level does not grant, so it can never be saved', () => {
			const paladin1 = { ...done, subclass: null, classChoice: { className: 'Paladin', classSource: 'XPHB', level: 1 } }
			const level1: ClassPickRequirements = { ...required, subclass: false, fightingStyle: false }
			expect(isStepComplete('class', paladin1, { classPickRequirements: level1 })).toBe(false)
			expect(isStepComplete('class', { ...paladin1, fightingStyle: null }, { classPickRequirements: level1 })).toBe(true)
			expect(isStepComplete('class', { ...done, fightingStyle: null }, { classPickRequirements: { ...level1, fightingStyle: false } })).toBe(false)
			const elementalFury = { ...paladin1, fightingStyle: null, classFeatureChoices: [ELEMENTAL_FURY] }
			expect(isStepComplete('class', elementalFury, { classPickRequirements: { ...level1, classFeatureNames: ['Primal Order'] } })).toBe(false)
		})

		it('F-1: a requirement whose loader failed (null) is neither demanded nor forbidden', () => {
			const unknown: ClassPickRequirements = { subclass: null, fightingStyle: null, masteryCount: null, optionalFeatureCount: null, skillCount: 2, classFeatureNames: null }
			expect(isStepComplete('class', done, { classPickRequirements: unknown })).toBe(true)
			expect(isStepComplete('class', { ...done, subclass: null, fightingStyle: null, masteries: [] }, { classPickRequirements: unknown })).toBe(true)
			expect(isStepComplete('class', { ...done, classSkills: [] }, { classPickRequirements: unknown })).toBe(false)
		})

		it('needs the exact count of subclass options, such as Battle Master maneuvers', () => {
			const master = { ...done, subclass: { name: 'Battle Master', source: 'XPHB', featureType: 'MV:B' } }
			const needs = { ...required, optionalFeatureCount: 3 }
			expect(isStepComplete('class', { ...master, optionalFeatureChoices: ['A', 'B'] }, { classPickRequirements: needs })).toBe(false)
			expect(isStepComplete('class', { ...master, optionalFeatureChoices: ['A', 'B', 'C'] }, { classPickRequirements: needs })).toBe(true)
		})

		it('stays incomplete while the requirements are still loading (null) and skips the check when none are supplied', () => {
			expect(isStepComplete('class', done, { classPickRequirements: null })).toBe(false)
			expect(isStepComplete('class', fighter3)).toBe(true)
		})

		it('counts held level-up picks as chosen, because they are already in the data', () => {
			// Fighter 3 → 4: the seeded character already holds subclass, style, masteries and class skills.
			const seeded = wizardDataFromCharacter(
				{
					id: 'f',
					name: 'Aria',
					classes: [{ className: 'Fighter', classSource: 'XPHB', level: 4, subclass: 'Champion' }],
					classSkills: ['athletics', 'perception'],
					fightingStyle: 'Defense',
					masteries: [{ name: 'Longsword', level: 1 }, { name: 'Greatsword', level: 1 }],
				} as Character,
				{ subclasses: [{ name: 'Champion', source: 'XPHB', featureType: null }], spellLevels: [] },
			)
			// CharacterWizard maps held class skills to skillCount null (D108 hides the picker).
			const levelUp = { ...required, skillCount: null }
			expect(isStepComplete('class', seeded, { classPickRequirements: levelUp, levelUpTargetLevel: 4 })).toBe(true)
			expect(isStepComplete('class', { ...seeded, classSkills: [] }, { classPickRequirements: levelUp, levelUpTargetLevel: 4 })).toBe(true)
			expect(isStepComplete('class', { ...seeded, masteries: ['Longsword'] }, { classPickRequirements: levelUp, levelUpTargetLevel: 4 })).toBe(false)
		})
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

	it.each([
		['Watchers', 'RHW'],
		['Mark of Storm', 'EFA'],
	])('D204: blocks the featAsi step for %s until its spellcasting ability is chosen', (name, source) => {
		const requiring = featsRequiringAbilityChoice([{ name, source, category: 'DG', additionalSpells: [{ ability: { choose: ['int', 'wis', 'cha'] } }] }])
		const conditions = { featAsiEligibleLevelCount: 1, featsRequiringAbilityChoice: requiring }
		const choice = { level: 4, kind: 'feat' as const, name, source }
		expect(isStepComplete('featAsi', { ...emptyWizardData(), featAsiChoices: [choice] }, conditions)).toBe(false)
		expect(isStepComplete('featAsi', { ...emptyWizardData(), featAsiChoices: [{ ...choice, chosenAbility: 'wisdom' as const }] }, conditions)).toBe(true)
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

		/* W20: a recorded value must also be valid for its method and the class's hit die. */
		it('with the hit die known, accepts only the fixed average, or a whole number 1..faces for roll and manual', () => {
			const base = { ...emptyWizardData(), classChoice: { className: 'Fighter', classSource: 'XPHB', level: 2 } }
			const gate = (kind: 'average' | 'roll' | 'manual', dieResult: number, hitDieFaces: number | null = 10) =>
				isStepComplete('hitPoints', { ...base, hitPointLevels: [{ level: 2, kind, dieResult }] }, { hitDieFaces })

			expect(gate('average', 6)).toBe(true)
			expect(gate('average', 5)).toBe(false)
			for (const kind of ['roll', 'manual'] as const) {
				expect(gate(kind, 1)).toBe(true)
				expect(gate(kind, 10)).toBe(true)
				expect(gate(kind, 0)).toBe(false)
				expect(gate(kind, 11)).toBe(false)
				expect(gate(kind, -1)).toBe(false)
				expect(gate(kind, 2.5)).toBe(false)
			}
			// Hit die not loaded yet: still refuses what no die could allow.
			expect(gate('manual', 0, null)).toBe(false)
			expect(gate('manual', 11, null)).toBe(true)
		})

		it('during a level-up walk, the target level is checked the same way', () => {
			const data = { ...emptyWizardData(), classChoice: { className: 'Fighter', classSource: 'XPHB', level: 4 }, hitPointLevels: [{ level: 4, kind: 'manual' as const, dieResult: 0 }] }
			expect(isStepComplete('hitPoints', data, { levelUpTargetLevel: 4, hitDieFaces: 10 })).toBe(false)
			expect(isStepComplete('hitPoints', { ...data, hitPointLevels: [{ level: 4, kind: 'manual' as const, dieResult: 7 }] }, { levelUpTargetLevel: 4, hitDieFaces: 10 })).toBe(true)
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

	it('goTo jumps back to any earlier step and keeps every choice, even past an incomplete one (W9, D252)', () => {
		// Species became incomplete while the player stood on a later step.
		const state: WizardControllerState = { step: 'abilities', data: { ...completeData(), speciesChoice: null } }
		for (const step of ['class', 'species', 'background', 'languages'] as const) {
			const result = wizardReducer(state, { type: 'goTo', step })
			expect(result.step).toBe(step)
			expect(result.data).toBe(state.data)
		}
		expect(wizardReducer(state, { type: 'goTo', step: 'equipment' })).toBe(state)
		expect(reachableSteps('abilities', state.data)).toEqual(['class', 'species', 'background', 'languages', 'abilities'])
	})

	it('goTo jumps forward while every step before the target is complete (W9)', () => {
		const state: WizardControllerState = { step: 'class', data: completeData() }
		expect(wizardReducer(state, { type: 'goTo', step: 'review' }).step).toBe('review')
	})

	it('goTo refuses a step past an incomplete one (W9)', () => {
		const state: WizardControllerState = { step: 'class', data: { ...completeData(), speciesChoice: null } }
		expect(wizardReducer(state, { type: 'goTo', step: 'species' }).step).toBe('species')
		expect(wizardReducer(state, { type: 'goTo', step: 'background' })).toBe(state)
		expect(wizardReducer(state, { type: 'goTo', step: 'review' })).toBe(state)
	})
})

describe('pruneClassPicks (D251)', () => {
	const known: ClassPickRequirements = { subclass: true, fightingStyle: true, masteryCount: 3, optionalFeatureCount: 3, skillCount: 2, classFeatureNames: [] }
	const battleMaster3 = (): WizardControllerState => ({
		step: 'class',
		data: {
			...completeData(),
			classChoice: { className: 'Fighter', classSource: 'XPHB', level: 3 },
			optionalFeatureChoices: ['Trip Attack', 'Riposte', 'Parry'],
			spellChoices: [{ name: 'Shield', source: 'XPHB', level: 1 }],
		},
	})

	it('a Fighter 3 Battle Master lowered to level 1 loses the subclass, its maneuvers and what hangs on the subclass', () => {
		let state = wizardReducer(battleMaster3(), { type: 'setClassChoice', choice: { className: 'Fighter', classSource: 'XPHB', level: 1 } })
		expect(state.data.subclass).not.toBeNull()
		state = wizardReducer(state, { type: 'pruneClassPicks', requirements: { ...known, subclass: false, optionalFeatureCount: 0 } })
		expect(state.data.subclass).toBeNull()
		expect(state.data.optionalFeatureChoices).toEqual([])
		expect(state.data.spellChoices).toEqual([])
		expect(state.data.fightingStyle).toBe('Archery')
		expect(state.data.masteries).toEqual(['Longsword'])
		expect(isStepComplete('class', state.data, { classPickRequirements: { ...known, subclass: false, optionalFeatureCount: 0, masteryCount: 1 } })).toBe(true)
	})

	it('a Paladin lowered below level 2 loses the fighting style; a Druid below 2 its Wild Shape forms, below 7 Elemental Fury', () => {
		const paladin: WizardControllerState = { step: 'class', data: { ...completeData(), subclass: null, optionalFeatureChoices: [], classChoice: { className: 'Paladin', classSource: 'XPHB', level: 1 } } }
		expect(wizardReducer(paladin, { type: 'pruneClassPicks', requirements: { ...known, subclass: false, fightingStyle: false, optionalFeatureCount: 0 } }).data.fightingStyle).toBeNull()

		const druid: WizardControllerState = {
			step: 'class',
			data: {
				...completeData(),
				subclass: null,
				fightingStyle: null,
				optionalFeatureChoices: [],
				classChoice: { className: 'Druid', classSource: 'XPHB', level: 1 },
				wildShapeForms: [{ name: 'Wolf', source: 'XMM' }],
				classFeatureChoices: [{ ...ELEMENTAL_FURY, featureName: 'Primal Order', grantedAtLevel: 1, optionName: 'Magician' }, ELEMENTAL_FURY],
			},
		}
		const pruned = wizardReducer(druid, { type: 'pruneClassPicks', requirements: { ...known, subclass: false, fightingStyle: false, optionalFeatureCount: 0, classFeatureNames: ['Primal Order'] } })
		expect(pruned.data.wildShapeForms).toEqual([])
		expect(pruned.data.classFeatureChoices.map((choice) => choice.featureName)).toEqual(['Primal Order'])
	})

	it('leaves picks whose picker stays, prunes nothing for unknown requirements, and returns the same state when nothing changes', () => {
		const state = battleMaster3()
		expect(wizardReducer(state, { type: 'pruneClassPicks', requirements: known })).toBe(state)
		const unknown: ClassPickRequirements = { subclass: null, fightingStyle: null, masteryCount: null, optionalFeatureCount: null, skillCount: null, classFeatureNames: null }
		expect(wizardReducer(state, { type: 'pruneClassPicks', requirements: unknown })).toBe(state)
	})

	it('D256: drops ASI levels and Proficiencies-step picks above the chosen level', () => {
		const fighter8: WizardControllerState = {
			step: 'class',
			data: {
				...completeData(),
				subclass: null,
				optionalFeatureChoices: [],
				classChoice: { className: 'Fighter', classSource: 'XPHB', level: 4 },
				featAsiChoices: [
					{ level: 4, kind: 'feat', name: 'Tough', source: 'XPHB' },
					{ level: 6, kind: 'feat', name: 'Alert', source: 'XPHB' },
					{ level: 8, kind: 'asi', increases: { strength: 2 } },
				],
			},
		}
		expect(wizardReducer(fighter8, { type: 'pruneClassPicks', requirements: { ...known, subclass: false, optionalFeatureCount: 0 } }).data.featAsiChoices).toEqual([
			{ level: 4, kind: 'feat', name: 'Tough', source: 'XPHB' },
		])

		const ranger: WizardControllerState = {
			step: 'class',
			data: {
				...completeData(),
				subclass: null,
				fightingStyle: null,
				optionalFeatureChoices: [],
				classChoice: { className: 'Ranger', classSource: 'XPHB', level: 1 },
				featureLanguages: [{ name: 'Elvish', source: 'XPHB', grantedBy: 'deftExplorer' }],
			},
		}
		expect(wizardReducer(ranger, { type: 'pruneClassPicks', requirements: { ...known, subclass: false, fightingStyle: false, optionalFeatureCount: 0 } }).data.featureLanguages).toEqual([])
	})

	it('D256: drops Class options picks of a progression the level no longer grants', () => {
		const state: WizardControllerState = {
			step: 'class',
			data: { ...completeData(), classOptionalFeatureChoices: [{ featureType: 'EI', choices: [{ name: 'Agonizing Blast' }] }] },
		}
		expect(wizardReducer(state, { type: 'pruneClassOptionalFeatures', featureTypes: ['EI'] })).toBe(state)
		expect(wizardReducer(state, { type: 'pruneClassOptionalFeatures', featureTypes: [] }).data.classOptionalFeatureChoices).toEqual([])
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

	/* D107: currentHp defaults to the caller-resolved maximum on creation, and stays absent when none is given. */
	describe('currentHp (D107)', () => {
		it('defaults currentHp to the given maximum for a freshly created character', () => {
			const store = fakeStore()
			saveCharacter(store, completeData(), ['athletics', 'intimidation'], {}, undefined, undefined, undefined, 25)

			expect(vi.mocked(store.create).mock.calls[0][0].currentHp).toBe(25)
		})

		it('leaves currentHp absent when no default is given (caller could not resolve maxHp)', () => {
			const store = fakeStore()
			saveCharacter(store, completeData(), ['athletics', 'intimidation'])

			expect(vi.mocked(store.create).mock.calls[0][0].currentHp).toBeUndefined()
		})
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
			createdAtLevel: 1,
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
			createdAtLevel: 1,
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
			createdAtLevel: 1,
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
			createdAtLevel: 1,
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

	/* Build order step 8, slice 8e: the floor for removing a level. */
	it('records the created-at level on creation, and an update keeps the character’s own, including none', () => {
		const store = { ...fakeStore(), update: vi.fn(() => ({ id: 'e1', name: 'Aria', classes: [] })) } as unknown as CharacterStore
		const data = completeData()
		saveCharacter(store, data, ['athletics', 'intimidation'])
		expect(vi.mocked(store.create).mock.calls[0][0].createdAtLevel).toBe(data.classChoice?.level)

		const existing = { id: 'e1', name: 'Aria', classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Battle Master', level: 1 }] }
		saveCharacter(store, data, ['athletics', 'intimidation'], {}, undefined, { ...existing, createdAtLevel: 1 })
		expect(vi.mocked(store.update).mock.calls[0][1].createdAtLevel).toBe(1)
		saveCharacter(store, data, ['athletics', 'intimidation'], {}, undefined, existing)
		expect(vi.mocked(store.update).mock.calls[1][1].createdAtLevel).toBeUndefined()
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
describe('class-feature languages (D172)', () => {
	const rogue = { className: 'Rogue', classSource: 'XPHB', level: 1 }
	const abyssal = { name: 'Abyssal', source: 'XPHB', grantedBy: 'thievesCant' as const }

	it("a Rogue's languages step needs the Thieves' Cant pick; a Fighter's does not", () => {
		const data = { ...completeData(), classChoice: rogue }
		expect(isStepComplete('languages', data)).toBe(false)
		expect(isStepComplete('languages', { ...data, featureLanguages: [abyssal] })).toBe(true)
		expect(isStepComplete('languages', completeData())).toBe(true)
	})

	it('a level-up walk asks only for the feature picks, not the creation ones', () => {
		const pick = (name: string) => ({ name, source: 'XPHB', grantedBy: 'deftExplorer' as const })
		const data = { ...completeData(), classChoice: { className: 'Ranger', classSource: 'XPHB', level: 2 }, languageChoice: [] }
		expect(isStepComplete('languages', data, { levelUpTargetLevel: 2 })).toBe(false)
		expect(isStepComplete('languages', { ...data, featureLanguages: [pick('Giant'), pick('Orc')] }, { levelUpTargetLevel: 2 })).toBe(true)
	})

	it('changing the class away from Rogue drops the pick; changing only the level keeps it', () => {
		const state: WizardControllerState = { step: 'class', data: { ...completeData(), classChoice: rogue, featureLanguages: [abyssal] } }
		expect(wizardReducer(state, { type: 'setClassChoice', choice: { ...rogue, level: 3 } }).data.featureLanguages).toEqual([abyssal])
		expect(wizardReducer(state, { type: 'setClassChoice', choice: { className: 'Fighter', classSource: 'XPHB', level: 1 } }).data.featureLanguages).toEqual([])
	})

	it('saves the pick after Common and the creation picks, and reopening shows it', () => {
		const store = { create: vi.fn(() => ({ id: 'x', name: 'Aria', classes: [] })) } as unknown as CharacterStore
		saveCharacter(store, { ...completeData(), classChoice: rogue, featureLanguages: [abyssal] }, ['athletics', 'intimidation'])
		const saved = vi.mocked(store.create).mock.calls[0][0]
		expect(saved.languages?.map((language) => language.grantedBy)).toEqual(['automatic', 'creation', 'creation', 'thievesCant'])
		const reopened = wizardDataFromCharacter({ id: 'x', ...saved } as Character, { subclasses: [], spellLevels: [] })
		expect(reopened.featureLanguages).toEqual([abyssal])
		expect(reopened.languageChoice.map((language) => language.name)).toEqual(['Draconic', 'Dwarvish'])
	})

	it('a pick whose feature no longer applies is not saved', () => {
		const store = { create: vi.fn(() => ({ id: 'x', name: 'Aria', classes: [] })) } as unknown as CharacterStore
		saveCharacter(store, { ...completeData(), featureLanguages: [abyssal] }, ['athletics', 'intimidation'])
		expect(vi.mocked(store.create).mock.calls[0][0].languages?.map((language) => language.name)).toEqual(['Common', 'Draconic', 'Dwarvish'])
	})
})

describe('class tool picks (D174)', () => {
	const bard = { className: 'Bard', classSource: 'XPHB', level: 1 }
	const pick = (grantedBy: 'bard' | 'monk' | 'battleMaster', name: string) => ({ grantedBy, name })
	const lute = pick('bard', 'Lute')

	it('a Bard needs all three instruments; a Fighter needs none', () => {
		const data = { ...completeData(), classChoice: bard }
		const bardPicks = [lute, pick('bard', 'Flute'), pick('bard', 'Drum')]
		expect(isStepComplete('languages', data)).toBe(false)
		expect(isStepComplete('languages', { ...data, toolChoices: bardPicks.slice(0, 2) })).toBe(false)
		expect(isStepComplete('languages', { ...data, toolChoices: bardPicks })).toBe(true)
		expect(isStepComplete('languages', completeData())).toBe(true)
	})

	it('a Monk needs one pick', () => {
		const data = { ...completeData(), classChoice: { className: 'Monk', classSource: 'XPHB', level: 1 } }
		expect(isStepComplete('languages', data)).toBe(false)
		expect(isStepComplete('languages', { ...data, toolChoices: [pick('monk', "Smith's Tools")] })).toBe(true)
	})

	it('a level-up walk asks for Battle Master at 3 only, and not for a creation grant', () => {
		const fighter = { ...completeData(), subclass: { name: 'Battle Master', source: 'XPHB', featureType: null } }
		const l3 = { ...fighter, classChoice: { className: 'Fighter', classSource: 'XPHB', level: 3 } }
		expect(isStepComplete('languages', l3, { levelUpTargetLevel: 3 })).toBe(false)
		// D177: Student of War's skill is owed too.
		expect(isStepComplete('languages', { ...l3, toolChoices: [pick('battleMaster', "Smith's Tools")] }, { levelUpTargetLevel: 3 })).toBe(false)
		expect(
			isStepComplete('languages', { ...l3, toolChoices: [pick('battleMaster', "Smith's Tools")], subclassSkills: [{ grantedBy: 'battleMaster', name: 'history' }] }, { levelUpTargetLevel: 3 }),
		).toBe(true)
		expect(isStepComplete('languages', { ...l3, subclass: { name: 'Champion', source: 'XPHB', featureType: null } }, { levelUpTargetLevel: 3 })).toBe(true)
		// A Bard levelling to 2 is not owed the creation instruments again.
		const bard2 = { ...completeData(), classChoice: { ...bard, level: 2 } }
		expect(isStepComplete('languages', bard2, { levelUpTargetLevel: 2 })).toBe(true)
	})

	it('a Battle Master grant is not owed at level 2', () => {
		const data = { ...completeData(), classChoice: { className: 'Fighter', classSource: 'XPHB', level: 2 } }
		expect(isStepComplete('languages', data)).toBe(true)
	})

	it('changing the class drops the picks; changing only the level keeps them', () => {
		const state: WizardControllerState = { step: 'class', data: { ...completeData(), classChoice: bard, toolChoices: [lute] } }
		expect(wizardReducer(state, { type: 'setClassChoice', choice: { ...bard, level: 3 } }).data.toolChoices).toEqual([lute])
		expect(wizardReducer(state, { type: 'setClassChoice', choice: { className: 'Fighter', classSource: 'XPHB', level: 1 } }).data.toolChoices).toEqual([])
	})

	it('saves the picks of a held grant only, and reopening shows them', () => {
		const store = { create: vi.fn(() => ({ id: 'x', name: 'Aria', classes: [] })) } as unknown as CharacterStore
		const picks = [lute, pick('bard', 'Flute'), pick('bard', 'Drum')]
		saveCharacter(store, { ...completeData(), classChoice: bard, toolChoices: [...picks, pick('monk', 'Viol')] }, ['athletics', 'intimidation'])
		const saved = vi.mocked(store.create).mock.calls[0][0]
		expect(saved.toolChoices).toEqual(picks)
		expect(wizardDataFromCharacter({ id: 'x', ...saved } as Character, { subclasses: [], spellLevels: [] }).toolChoices).toEqual(picks)
	})

	it('a character saved before the field existed reopens with no picks', () => {
		const old: Character = { id: 'x', name: 'Aria', classes: [{ className: 'Bard', classSource: 'XPHB', subclass: null, level: 1 }] }
		expect(wizardDataFromCharacter(old, { subclasses: [], spellLevels: [] }).toolChoices).toEqual([])
	})
})

describe('species size choice (D175)', () => {
	it('blocks the species step only while the conditions say the size is unchosen', () => {
		const data = completeData()
		expect(isStepComplete('species', data, { speciesSizeComplete: false })).toBe(false)
		expect(isStepComplete('species', data, { speciesSizeComplete: true })).toBe(true)
		expect(isStepComplete('species', data)).toBe(true)
	})

	it('changing the species clears the size', () => {
		const state: WizardControllerState = { step: 'species', data: { ...completeData(), speciesSize: 'S' } }
		expect(wizardReducer(state, { type: 'setSpeciesSize', size: 'M' }).data.speciesSize).toBe('M')
		expect(wizardReducer(state, { type: 'setSpeciesChoice', choice: { name: 'Human', source: 'XPHB' } }).data.speciesSize).toBeNull()
	})

	it('saves the size and reopening shows it; an old character has none', () => {
		const store = { create: vi.fn(() => ({ id: 'x', name: 'Aria', classes: [] })) } as unknown as CharacterStore
		saveCharacter(store, { ...completeData(), speciesSize: 'S' }, ['athletics', 'intimidation'])
		const saved = vi.mocked(store.create).mock.calls[0][0]
		expect(saved.speciesSize).toBe('S')
		expect(wizardDataFromCharacter({ id: 'x', ...saved } as Character, { subclasses: [], spellLevels: [] }).speciesSize).toBe('S')
		expect(wizardDataFromCharacter({ id: 'x', name: 'Old', classes: [] }, { subclasses: [], spellLevels: [] }).speciesSize).toBeNull()
	})
})

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
			toolChoices: [{ grantedBy: 'battleMaster', name: "Smith's Tools" }],
			subclassSkills: [{ grantedBy: 'battleMaster', name: 'history' }],
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
			/cannot change its level/i,
		)
		expect(store.update).not.toHaveBeenCalled()
	})

	/* D105: editing is not how a character gains a level — that is Level up's job, and only Level up records the level on new picks. */
	it('refuses a level above the character’s own', () => {
		const store = editStore()
		const character = storedCharacter()
		const data = wizardDataFromCharacter(character, lookups)
		const raised = {
			...data,
			classChoice: { className: 'Fighter', classSource: 'XPHB', level: 6 },
			hitPointLevels: [...data.hitPointLevels, { level: 6, kind: 'average' as const, dieResult: 6 }],
		}

		expect(() => saveCharacter(store, raised, ['athletics', 'intimidation'], { ...editConditions, characterLevel: 6 }, undefined, character)).toThrow(
			/cannot change its level/i,
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

	/* Slice 9d2: `update` replaces every field, and the wizard never shows the sheet's free text, so an edit must hand it back or silently erase it. */
	it('carries the sheet\'s appearance, backstory and notes through an edit', () => {
		const store = editStore()
		const character = { ...storedCharacter(), appearance: 'Tall\nGreen eyes', backstory: '- Orphan', notes: 'Owes Cato 5 gp' }
		const data = wizardDataFromCharacter(character, lookups)

		saveCharacter(store, data, ['athletics', 'intimidation'], editConditions, { inventory: [], currencyCopper: 0 }, character)

		const input = vi.mocked(store.update).mock.calls[0][1]
		expect(input.appearance).toBe('Tall\nGreen eyes')
		expect(input.backstory).toBe('- Orphan')
		expect(input.notes).toBe('Owes Cato 5 gp')
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
