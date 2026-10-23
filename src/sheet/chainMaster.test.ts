import { describe, expect, it } from 'vitest'
import type { Beast } from '../beasts/beastData'
import { applyChainMaster, chainMasterSaveDc, holdsChainMaster, rewriteChainMasterText } from './chainMaster'
import { applyFamiliarBonuses, NO_FAMILIAR_BONUSES } from './familiarItemBonuses'

const BITE = '{@atkr m} {@hit 4}, reach 5 ft. {@h}4 ({@damage 1d4 + 2}) Piercing damage.'
const STING = '{@actSave con} {@dc 12}, one creature. {@actSaveFail} Poisoned.'
const MIMICRY = 'with a successful {@dc 10} Wisdom ({@skill Insight|XPHB}) check.'

const pseudodragon = {
	name: 'Pseudodragon',
	source: 'XMM',
	ac: [14],
	speed: { walk: 15, fly: 60 },
	trait: [{ name: 'Mimicry', entries: [MIMICRY] }],
	action: [
		{ name: 'Bite', entries: [BITE] },
		{ name: 'Sting', entries: [STING] },
	],
} as unknown as Beast

describe('Investment of the Chain Master (D380)', () => {
	it('is held from class picks or a custom item', () => {
		const pick = { featureType: 'EI', choices: [{ name: 'Investment of the Chain Master', source: 'XPHB' }] }
		expect(holdsChainMaster({ optionalFeatureChoices: [pick] } as never)).toBe(true)
		expect(holdsChainMaster({ optionalFeatureChoices: [] })).toBe(false)
	})

	it('rewrites B/P/S damage only in attack text, and only save DCs', () => {
		expect(rewriteChainMasterText(BITE, { damage: 'radiant', saveDc: null })).toContain('Radiant damage')
		expect(rewriteChainMasterText('Piercing damage from a fall.', { damage: 'radiant', saveDc: null })).toBe('Piercing damage from a fall.')
		expect(rewriteChainMasterText(STING, { saveDc: 15 })).toContain('{@actSave con} {@dc 15}')
		expect(rewriteChainMasterText(MIMICRY, { saveDc: 15 })).toBe(MIMICRY)
	})

	it('adds 40 ft. unless the form is already as fast, and never edits the data', () => {
		expect(applyChainMaster(pseudodragon, { form: 'aquatic', saveDc: null }).speed).toEqual({ walk: 15, fly: 60, swim: 40 })
		expect(applyChainMaster(pseudodragon, { form: 'aerial', saveDc: null }).speed).toEqual({ walk: 15, fly: 60 })
		applyChainMaster(pseudodragon, { form: 'aquatic', damage: 'necrotic', saveDc: 15 })
		expect(pseudodragon.speed).toEqual({ walk: 15, fly: 60 })
		expect(pseudodragon.action![0].entries).toEqual([BITE])
	})

	it('item bonuses still apply on top', () => {
		const beast = applyFamiliarBonuses(applyChainMaster(pseudodragon, { damage: 'necrotic', saveDc: 15 }), { ...NO_FAMILIAR_BONUSES, ac: 1, damage: 1 })
		expect(beast.ac).toEqual([15])
		expect(beast.action![0].entries).toEqual(['{@atkr m} {@hit 4}, reach 5 ft. {@h}5 ({@damage 1d4 + 3}) Necrotic damage.'])
	})

	it('save DC: the Warlock’s, else the highest, else none', () => {
		expect(chainMasterSaveDc([{ className: 'Wizard', spellSaveDC: 16 }, { className: 'Warlock', spellSaveDC: 14 }])).toBe(14)
		expect(chainMasterSaveDc([{ spellSaveDC: 12 }, { className: 'Wizard', spellSaveDC: 16 }])).toBe(16)
		expect(chainMasterSaveDc([])).toBeNull()
	})
})
