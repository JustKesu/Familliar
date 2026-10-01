// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { emptyWizardData, isStepComplete, wizardReducer, type WizardControllerState } from '../creation/wizardState'
import type { FeatEntry } from './featAsiData'
import { grantedFeatsOf, pickedFeats } from './featAsiLevels'
import { speciesGrantsOriginFeat, speciesOriginFeatComplete, speciesOriginFeatProblem, speciesOriginFeatTaker, useSpeciesOriginFeat, type SpeciesOriginFeatLoad } from './speciesOriginFeat'

vi.mock('../dataLoader/dataLoader', () => ({ loadDataFile: vi.fn(async () => SPECIES) }))
vi.mock('./featAsiData', async (importOriginal) => ({
	...(await importOriginal<typeof import('./featAsiData')>()),
	loadFeats: vi.fn(async () => {
		throw new Error('feats.json failed')
	}),
}))

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
const ready = (grants: boolean): SpeciesOriginFeatLoad => ({ status: 'ready', grants, originFeats: ORIGIN_FEATS })
const background = (name: string) => grantedFeatsOf({ name, source: 'XPHB' }, [], [])

describe('D271: which species grant an origin feat', () => {
	it('is exactly the single anyFromCategory O, count 1', () => {
		expect(speciesGrantsOriginFeat(SPECIES, { name: 'Human', source: 'XPHB' })).toBe(true)
		expect(speciesGrantsOriginFeat(SPECIES, { name: 'Variant', source: 'TEST' })).toBe(false)
		expect(speciesGrantsOriginFeat(SPECIES, { name: 'Dwarf', source: 'XPHB' })).toBe(false)
		expect(speciesGrantsOriginFeat(SPECIES, null)).toBe(false)
	})
})

describe('useSpeciesOriginFeat (finding 3)', () => {
	it('a feats.json failure hits only the granting species, and never carries over to the next species', async () => {
		const { result, rerender } = renderHook(({ species }) => useSpeciesOriginFeat(species), { initialProps: { species: { name: 'Human', source: 'XPHB' } } })
		await waitFor(() => expect(result.current).toEqual({ status: 'error', message: 'feats.json failed' }))
		rerender({ species: { name: 'Dwarf', source: 'XPHB' } })
		expect(result.current).toEqual({ status: 'loading' })
		await waitFor(() => expect(result.current).toEqual({ status: 'ready', grants: false, originFeats: [] }))
	})
})

describe('D273: a feat held elsewhere blocks only a non-repeatable feat of the same name', () => {
	it('names the background', () => {
		expect(speciesOriginFeatProblem(alert, background('Alert'))).toEqual({ text: 'Alert is already taken (Background) — choose another feat.', blocking: true })
		expect(speciesOriginFeatProblem(skilled, background('Skilled'))).toBeNull()
		expect(speciesOriginFeatProblem(alert, background('Tough'))).toBeNull()
		expect(speciesOriginFeatProblem(alert, [])).toBeNull()
	})

	it('names manual and ASI-level holders; an item only warns (finding 5)', () => {
		const manual = grantedFeatsOf(null, [{ name: 'Alert', source: 'XPHB' }], [])
		expect(speciesOriginFeatProblem(alert, manual)).toEqual({ text: 'Alert is already taken (Added manually) — choose another feat.', blocking: true })
		const asi = pickedFeats([{ level: 4, kind: 'feat', name: 'Alert', source: 'XPHB' }], () => true)
		expect(speciesOriginFeatTaker(alert, asi)?.origin).toBe('level 4')
		const item = grantedFeatsOf(null, [], [{ name: 'Alert', source: 'XPHB', itemName: 'Ring' }])
		expect(speciesOriginFeatTaker(alert, item)?.origin).toBe('From item (Ring)')
		expect(speciesOriginFeatProblem(alert, item)).toEqual({ text: 'Alert is also granted by Ring — you may keep it or choose another feat.', blocking: false })
		expect(speciesOriginFeatComplete(ready(true), { origin: 'species', name: 'Alert', source: 'XPHB' }, item)).toBe(true)
		expect(speciesOriginFeatComplete(ready(true), { origin: 'species', name: 'Alert', source: 'XPHB' }, manual)).toBe(false)
	})
})

describe('D274: the Background step gate', () => {
	const human = { origin: 'species' as const, name: 'Alert', source: 'XPHB' }

	it('stays shut while loading, opens after a failed load, and needs nothing for a species without the grant', () => {
		expect(speciesOriginFeatComplete({ status: 'loading' }, undefined, [])).toBe(false)
		expect(speciesOriginFeatComplete({ status: 'error', message: 'x' }, undefined, [])).toBe(true)
		expect(speciesOriginFeatComplete(ready(false), undefined, [])).toBe(true)
	})

	it('needs a chosen feat that the background does not already grant; sub-choices never count', () => {
		expect(speciesOriginFeatComplete(ready(true), undefined, [])).toBe(false)
		expect(speciesOriginFeatComplete(ready(true), human, background('Tough'))).toBe(true)
		expect(speciesOriginFeatComplete(ready(true), human, background('Alert'))).toBe(false)
		expect(speciesOriginFeatComplete(ready(true), { origin: 'species', name: 'Skilled', source: 'XPHB' }, background('Skilled'))).toBe(true)
		expect(speciesOriginFeatComplete(ready(true), { origin: 'species', name: 'Gone', source: 'XPHB' }, [])).toBe(false)
	})

	it('stays shut for a granting species while the background feat links are unknown (finding 5)', () => {
		expect(speciesOriginFeatComplete(ready(true), human, [], false)).toBe(false)
		expect(speciesOriginFeatComplete(ready(false), undefined, [], false)).toBe(true)
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
