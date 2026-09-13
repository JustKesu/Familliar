// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { CharacterWizard } from '../creation/CharacterWizard'
import { WIZARD_STEPS, type WizardStep } from '../creation/wizardState'
import type { LevelGain, LevelGains } from './levelGains'
import type { Character } from '../storage/character'
import type { CharacterStore } from '../storage/characterStore'

/* D108: the class step of a level up shows what the new level adds and never reopens a pick an earlier level made. */

vi.mock('../subclass/subclassData', () => ({
	loadSubclassLevelFor: vi.fn(async () => 3),
	loadSubclassesFor: vi.fn(async () => [
		{ name: 'Champion', source: 'XPHB', entries: ['Simple, brutal effectiveness.'], featureType: null },
		{ name: 'Battle Master', source: 'XPHB', entries: ['Maneuvers and superiority dice.'], featureType: 'MV:B' },
	]),
}))

vi.mock('../spells/spellDetailData', async (importOriginal) => ({
	...(await importOriginal<typeof import('../spells/spellDetailData')>()),
	loadSpellDetails: vi.fn(async () => []),
}))

vi.mock('../classSkills/classSkillData', () => ({
	loadClassSkillChoice: vi.fn(async () => ({ count: 2, options: ['athletics', 'intimidation', 'perception'] })),
}))

vi.mock('../masteries/masteryData', () => ({
	MASTERY_DESCRIPTIONS: {},
	loadMasteryCountFor: vi.fn(async (_className: string, _classSource: string, level: number) => (level >= 4 ? 2 : 1)),
	loadMasteryWeaponsFor: vi.fn(async () => [
		{ name: 'Longsword', source: 'XPHB', masteryFull: 'Sap' },
		{ name: 'Greatsword', source: 'XPHB', masteryFull: 'Graze' },
	]),
}))

vi.mock('../fightingStyle/fightingStyleData', () => ({
	loadFightingStyleGrantLevel: vi.fn(async () => 1),
	fightingStyleOptions: vi.fn(async () => [
		{ name: 'Archery', source: 'XPHB', entries: ['+2 to ranged attack rolls.'] },
		{ name: 'Defense', source: 'XPHB', entries: ['+1 AC while wearing armor.'] },
	]),
}))

vi.mock('../optionalFeatures/optionalFeatureData', async (importOriginal) => ({
	...(await importOriginal<typeof import('../optionalFeatures/optionalFeatureData')>()),
	loadOptionalFeatureChoicesFor: vi.fn(async (_className: string, _classSource: string, subclassName: string) =>
		subclassName === 'Battle Master'
			? {
					featureType: 'MV:B',
					count: 3,
					options: [
						{ name: 'Trip Attack', source: 'XPHB', entries: ['Knock them down.'] },
						{ name: 'Riposte', source: 'XPHB', entries: ['Strike back.'] },
						{ name: 'Parry', source: 'XPHB', entries: ['Reduce the damage.'] },
					],
				}
			: null,
	),
	loadClassOptionalFeatureGroups: vi.fn(async () => []),
}))

afterEach(cleanup)

const battleMaster: Character = {
	id: 'c1',
	name: 'Aria',
	classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Battle Master', level: 3 }],
	classSkills: ['athletics', 'perception'],
	fightingStyle: 'Defense',
	masteries: [{ name: 'Longsword' }],
	optionalFeatureChoices: [{ featureType: 'MV:B', choices: [{ name: 'Trip Attack' }, { name: 'Riposte', level: 3 }] }],
}

function gain(status: LevelGain['status']): LevelGain {
	return { status, count: status === 'adds' ? 1 : 0, parts: status === 'adds' ? [{ name: 'Weapon Mastery', count: 1 }] : [] }
}

/** Fighter 3 → 4 as levelGainsFor answers it: one more weapon mastery on the class step, no subclass and no fighting style. */
const fighterFour: LevelGains = {
	level: 4,
	unresolved: null,
	newFeatures: [],
	steps: Object.fromEntries(
		WIZARD_STEPS.map((step: WizardStep) => [step, gain(step === 'class' || step === 'featAsi' || step === 'hitPoints' ? 'adds' : 'none')]),
	) as Record<WizardStep, LevelGain>,
}

function renderWizard(levelUp?: LevelGains) {
	const store = { create: vi.fn(), update: vi.fn() } as unknown as CharacterStore
	render(<CharacterWizard store={store} character={battleMaster} levelUp={levelUp} onSaved={() => {}} onCancel={() => {}} />)
}

describe('the class step during a level up', () => {
	it('shows the subclass, fighting style and class skill pickers when editing, so their absence below is the fix and not the mocks', async () => {
		renderWizard()
		// A picker whose count is already met starts collapsed, so its inputs are only in the DOM, not the accessibility tree.
		expect(await screen.findByRole('radio', { name: /Battle Master/, hidden: true })).toBeTruthy()
		expect(await screen.findByLabelText('Archery')).toBeTruthy()
		expect(await screen.findByRole('checkbox', { name: /intimidation/i, hidden: true })).toBeTruthy()
	})

	it('hides the subclass, fighting style and class skills the character already has at a level that grants none of them', async () => {
		renderWizard(fighterFour)
		expect(await screen.findByText('Level up: Fighter 3 → 4')).toBeTruthy()
		// The maneuver picker loads after the seed, as the subclass and fighting-style pickers would.
		await screen.findByRole('checkbox', { name: /Parry/ })

		expect(screen.queryByRole('radio', { name: /Battle Master/, hidden: true })).toBeNull()
		expect(screen.queryByRole('radio', { name: /Champion/, hidden: true })).toBeNull()
		expect(screen.queryByLabelText('Archery')).toBeNull()
		expect(screen.queryByLabelText('Defense')).toBeNull()
		expect(screen.queryByRole('checkbox', { name: /intimidation/i, hidden: true })).toBeNull()
	})

	it('keeps earlier masteries and maneuvers checked and locked, leaving only the new picks open', async () => {
		renderWizard(fighterFour)

		const longsword = (await screen.findByRole('checkbox', { name: /Longsword/ })) as HTMLInputElement
		expect(longsword.checked && longsword.disabled).toBe(true)
		expect((screen.getByRole('checkbox', { name: /Greatsword/ }) as HTMLInputElement).disabled).toBe(false)

		for (const held of [/Trip Attack/, /Riposte/]) {
			const option = (await screen.findByRole('checkbox', { name: held })) as HTMLInputElement
			expect(option.checked && option.disabled).toBe(true)
		}
		expect((screen.getByRole('checkbox', { name: /Parry/ }) as HTMLInputElement).disabled).toBe(false)
	})
})
