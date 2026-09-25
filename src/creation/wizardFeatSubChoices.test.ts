import { describe, expect, it, vi } from 'vitest'
import type { FeatEffectEntry } from '../calculation/featEffects'
import { featInstances } from '../featAsi/featInstances'
import { missingFeatSubChoices } from '../sheet/featSubChoices'
import type { Character } from '../storage/character'
import type { CharacterStore } from '../storage/characterStore'
import { emptyWizardData, initialControllerState, isStepComplete, saveCharacter, wizardDataFromCharacter, wizardReducer, type WizardStep } from './wizardState'

/* Task A3 (D179): a feat's own sub-choices never block the wizard, and Edit Character completes them. */

const skilled: FeatEffectEntry = { name: 'Skilled', source: 'XPHB', skillToolLanguageProficiencies: [{ choose: [{ from: ['anySkill', 'anyTool'], count: 3 }] }] }
const originFeat = { name: 'Magic Initiate; Cleric', source: 'XPHB' }
const acolyte = { name: 'Acolyte', source: 'XPHB', abilityBonus: { wisdom: 2, intelligence: 1 }, abilityBonusDistribution: null }
const saveOnly = { levelUpSteps: new Set<WizardStep>(['review']) }

describe('feat sub-choices in the wizard (task A3)', () => {
	it('an unmade proficiency pick never blocks Next, and neither does an unmade origin Magic Initiate', () => {
		const fighter = { className: 'Fighter', classSource: 'XPHB', level: 4 }
		const featStep = { ...emptyWizardData(), classChoice: fighter, featAsiChoices: [{ level: 4, kind: 'feat' as const, name: 'Skilled', source: 'XPHB' }] }
		expect(isStepComplete('featAsi', featStep, { featAsiEligibleLevelCount: 1 })).toBe(true)

		const backgroundStep = { ...emptyWizardData(), backgroundChoice: acolyte, backgroundToolProficiency: "Calligrapher's Supplies" }
		expect(isStepComplete('background', backgroundStep)).toBe(true)
	})

	it("changing the background clears its origin feat's sub-choices; a new ability split on the same background keeps them", () => {
		let state = wizardReducer(initialControllerState(), { type: 'setBackgroundChoice', choice: acolyte })
		state = wizardReducer(state, { type: 'setGrantedFeat', feat: { origin: 'background', ...originFeat, chosenAbility: 'wisdom' } })
		state = wizardReducer(state, { type: 'setBackgroundChoice', choice: { ...acolyte, abilityBonus: { wisdom: 1, intelligence: 1, charisma: 1 } } })
		expect(state.data.grantedFeats).toEqual([{ origin: 'background', ...originFeat, chosenAbility: 'wisdom' }])
		state = wizardReducer(state, { type: 'setBackgroundChoice', choice: { ...acolyte, name: 'Sage' } })
		expect(state.data.grantedFeats).toEqual([])
	})

	it('Edit Character: left-open choices seed in, and completing them clears "Choices not made yet"', () => {
		const character: Character = {
			id: 'c1',
			name: 'Aria',
			classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 4 }],
			background: { name: 'Acolyte', source: 'XPHB', skillProficiencies: ['insight', 'religion'], toolProficiency: "Calligrapher's Supplies" },
			featAsiChoices: [{ level: 4, kind: 'feat', name: 'Skilled', source: 'XPHB' }],
		}
		const before = featInstances(character, originFeat)
		expect(before.map((instance) => missingFeatSubChoices(instance, [skilled]))).toEqual([['ability', 'spells'], ['skills or tools']])

		const seeded = wizardDataFromCharacter(character, { subclasses: [], spellLevels: [] })
		let state = wizardReducer(initialControllerState(), { type: 'seed', data: seeded })
		state = wizardReducer(state, {
			type: 'setGrantedFeat',
			feat: {
				origin: 'background',
				...originFeat,
				chosenAbility: 'wisdom',
				magicInitiate: { className: 'Cleric', classSource: 'XPHB', cantrips: [{ name: 'Guidance', source: 'XPHB' }, { name: 'Thaumaturgy', source: 'XPHB' }], spell: { name: 'Bless', source: 'XPHB' } },
			},
		})
		state = wizardReducer(state, {
			type: 'setFeatAsiChoices',
			choices: [{ level: 4, kind: 'feat', name: 'Skilled', source: 'XPHB', proficiencies: { skills: ['arcana', 'history'], tools: ["Smith's Tools"] } }],
		})

		const store = { update: vi.fn((_id: string, input: Omit<Character, 'id'>) => ({ id: 'c1', ...input })) } as unknown as CharacterStore
		saveCharacter(store, state.data, ['insight', 'religion'], saveOnly, undefined, character)
		const saved = { id: 'c1', ...vi.mocked(store.update).mock.calls[0][1] } as Character
		expect(featInstances(saved, originFeat).map((instance) => missingFeatSubChoices(instance, [skilled]))).toEqual([[], []])
	})
})
