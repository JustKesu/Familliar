import { describe, expect, it } from 'vitest'
import { emptyWizardData, isStepComplete, wizardReducer, type WizardControllerState } from '../creation/wizardState'
import type { FeatEntry } from './featAsiData'
import { speciesGrantsOriginFeat, speciesOriginFeatComplete, speciesOriginFeatProblem, type SpeciesOriginFeatLoad } from './speciesOriginFeat'

const SPECIES = [
	{ name: 'Human', source: 'XPHB', feats: [{ anyFromCategory: { category: ['O'], count: 1 } }] },
	{ name: 'Variant', source: 'TEST', feats: [{ anyFromCategory: { category: ['G'], count: 1 } }] },
	{ name: 'Dwarf', source: 'XPHB' },
]
const ORIGIN_FEATS = [
	{ name: 'Alert', source: 'XPHB', category: 'O' },
	{ name: 'Skilled', source: 'XPHB', category: 'O', repeatable: true },
	{ name: 'Tough', source: 'XPHB', category: 'O' },
] as FeatEntry[]
const [alert, skilled] = ORIGIN_FEATS
const ready = (grants: boolean): SpeciesOriginFeatLoad => ({ status: 'ready', key: 'Human|XPHB', grants, originFeats: ORIGIN_FEATS })

describe('D271: which species grant an origin feat', () => {
	it('is exactly the single anyFromCategory O, count 1', () => {
		expect(speciesGrantsOriginFeat(SPECIES, { name: 'Human', source: 'XPHB' })).toBe(true)
		expect(speciesGrantsOriginFeat(SPECIES, { name: 'Variant', source: 'TEST' })).toBe(false)
		expect(speciesGrantsOriginFeat(SPECIES, { name: 'Dwarf', source: 'XPHB' })).toBe(false)
		expect(speciesGrantsOriginFeat(SPECIES, null)).toBe(false)
	})
})

describe('D273: the background feat blocks only a non-repeatable feat of the same name', () => {
	it('names the background', () => {
		expect(speciesOriginFeatProblem(alert, { name: 'Alert', source: 'XPHB' })).toBe('Alert is already taken (Background) — choose another feat.')
		expect(speciesOriginFeatProblem(skilled, { name: 'Skilled', source: 'XPHB' })).toBeNull()
		expect(speciesOriginFeatProblem(alert, { name: 'Tough', source: 'XPHB' })).toBeNull()
		expect(speciesOriginFeatProblem(alert, null)).toBeNull()
	})
})

describe('D274: the Background step gate', () => {
	const human = { origin: 'species' as const, name: 'Alert', source: 'XPHB' }

	it('stays shut while loading, opens after a failed load, and needs nothing for a species without the grant', () => {
		expect(speciesOriginFeatComplete({ status: 'loading' }, undefined, null)).toBe(false)
		expect(speciesOriginFeatComplete({ status: 'error', message: 'x' }, undefined, null)).toBe(true)
		expect(speciesOriginFeatComplete(ready(false), undefined, null)).toBe(true)
	})

	it('needs a chosen feat that the background does not already grant; sub-choices never count', () => {
		expect(speciesOriginFeatComplete(ready(true), undefined, null)).toBe(false)
		expect(speciesOriginFeatComplete(ready(true), human, { name: 'Tough', source: 'XPHB' })).toBe(true)
		expect(speciesOriginFeatComplete(ready(true), human, { name: 'Alert', source: 'XPHB' })).toBe(false)
		expect(speciesOriginFeatComplete(ready(true), { origin: 'species', name: 'Skilled', source: 'XPHB' }, { name: 'Skilled', source: 'XPHB' })).toBe(true)
		expect(speciesOriginFeatComplete(ready(true), { origin: 'species', name: 'Gone', source: 'XPHB' }, null)).toBe(false)
	})

	it('blocks the Background step through its condition', () => {
		const data = {
			...emptyWizardData(),
			backgroundChoice: { name: 'Farmer', source: 'XPHB', abilityBonus: { constitution: 2, strength: 1 }, abilityBonusDistribution: { mode: 'twoOne' as const, plusTwo: 'constitution' as const, plusOne: 'strength' as const } },
			backgroundToolProficiency: "Carpenter's Tools",
		}
		expect(isStepComplete('background', data, { speciesOriginFeatComplete: false })).toBe(false)
		expect(isStepComplete('background', data, { speciesOriginFeatComplete: true })).toBe(true)
	})

	it('drops the stored species feat when the species changes, and keeps it for the same species', () => {
		const state: WizardControllerState = {
			step: 'species',
			data: { ...emptyWizardData(), speciesChoice: { name: 'Human', source: 'XPHB' }, grantedFeats: [human, { origin: 'background', name: 'Tough', source: 'XPHB' }] },
		}
		const same = wizardReducer(state, { type: 'setSpeciesChoice', choice: { name: 'Human', source: 'XPHB' } })
		expect(same.data.grantedFeats).toEqual(state.data.grantedFeats)
		const dwarf = wizardReducer(state, { type: 'setSpeciesChoice', choice: { name: 'Dwarf', source: 'XPHB' } })
		expect(dwarf.data.grantedFeats).toEqual([{ origin: 'background', name: 'Tough', source: 'XPHB' }])
	})
})
