// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FeatAsiPicker } from './FeatAsiPicker'
import { loadFeatAsiGrants } from './featAsiData'
import type { FeatAsiChoice } from '../storage/character'

/*
 * Component test for the feat/ASI picker, following the jsdom/testing-
 * library pattern established for pickers (D8). Data loaders are stubbed —
 * data/ is never read into context or loaded in tests directly.
 */

vi.mock('./featAsiData', async () => {
	const actual = await vi.importActual<typeof import('./featAsiData')>('./featAsiData')
	return {
		...actual,
		loadFeatAsiGrants: vi.fn(async (className: string, _classSource: string, level: number) => {
			// Fighter's real class-features.json grants at 4/6/8/12/14/16 (confirmed, scripts/investigate-feat-asi-eligibility.js) — includes the bonus level 6 the flat task-brief list omitted.
			const table: Record<string, number[]> = { Fighter: [4, 6, 8, 12, 14, 16], Wizard: [4, 8, 12, 16] }
			return (table[className] ?? []).filter((l) => l <= level).map((l) => ({ level: l, kind: 'asi' as const }))
		}),
		loadFeats: vi.fn(async () => [
			{ name: 'Tough', source: 'XPHB', category: 'G' },
			{ name: 'Actor', source: 'XPHB', category: 'G', prerequisite: [{ level: 4, ability: [{ cha: 13 }] }] },
			{ name: 'Athlete', source: 'XPHB', category: 'G', ability: [{ choose: { from: ['str', 'dex'] } }] },
			{ name: 'Magic Initiate', source: 'XPHB', category: 'G' },
		]),
		loadClassPrereqInfo: vi.fn(async () => ({ armorProficiencies: [], weaponProficiencies: [], hasSpellcasting: false })),
		loadHasFightingStyleFeature: vi.fn(async () => false),
		loadSpeciesPrereqInfo: vi.fn(async () => null),
	}
})

/** Small, distinct per-class spell lists so a test can tell which list is being offered. */
vi.mock('../spells/classSpellListData', () => ({
	loadClassSpellList: vi.fn(async (className: string, _classSource: string) => {
		const lists: Record<string, { name: string; level: number }[]> = {
			Cleric: [
				{ name: 'Guidance', level: 0 },
				{ name: 'Sacred Flame', level: 0 },
				{ name: 'Bless', level: 1 },
			],
			Wizard: [
				{ name: 'Fire Bolt', level: 0 },
				{ name: 'Mage Hand', level: 0 },
				{ name: 'Prestidigitation', level: 0 },
				{ name: 'Ray of Sickness', level: 1 },
			],
			Druid: [
				{ name: 'Druidcraft', level: 0 },
				{ name: 'Produce Flame', level: 0 },
				{ name: 'Entangle', level: 1 },
			],
		}
		return (lists[className] ?? []).map((s) => ({ ...s, source: 'XPHB', ritual: false, concentration: false, viaVariant: false }))
	}),
}))

afterEach(cleanup)

const fullScores = { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 }

describe('FeatAsiPicker', () => {
	it('renders nothing when the class has no grant by that level', async () => {
		const { container } = render(
			<FeatAsiPicker
				className="Wizard"
				classSource="XPHB"
				level={2}
				finalAbilityScores={fullScores}
				speciesName={null}
				speciesSource={null}
				value={[]}
				onChange={() => {}}
			/>,
		)

		await waitFor(() => expect(loadFeatAsiGrants).toHaveBeenCalled())
		expect(container.querySelector('.feat-asi-picker__level')).toBeNull()
	})

	it('shows one panel per level the class has granted by then — Fighter 12 sees four, not the generic three, because Fighter also gets one at level 6', async () => {
		render(
			<FeatAsiPicker
				className="Fighter"
				classSource="XPHB"
				level={12}
				finalAbilityScores={fullScores}
				speciesName={null}
				speciesSource={null}
				value={[]}
				onChange={() => {}}
			/>,
		)

		const legends = await screen.findAllByRole('group')
		expect(legends).toHaveLength(4)
		expect(screen.getByText('Level 4')).toBeTruthy()
		expect(screen.getByText('Level 6')).toBeTruthy()
		expect(screen.getByText('Level 8')).toBeTruthy()
		expect(screen.getByText('Level 12')).toBeTruthy()
	})

	it('a feat with an unmet prerequisite is shown but disabled, with the reason visible', async () => {
		const value: FeatAsiChoice[] = [{ level: 4, kind: 'feat', name: '', source: '' }]
		render(
			<FeatAsiPicker
				className="Fighter"
				classSource="XPHB"
				level={4}
				finalAbilityScores={fullScores}
				speciesName={null}
				speciesSource={null}
				value={value}
				onChange={() => {}}
			/>,
		)

		const actorRadio = (await screen.findByLabelText('Actor')) as HTMLInputElement
		expect(actorRadio.disabled).toBe(true)
		expect(screen.getByText('Requires Charisma 13+.')).toBeTruthy()

		const toughRadio = (await screen.findByLabelText('Tough')) as HTMLInputElement
		expect(toughRadio.disabled).toBe(false)
	})

	it('choosing an eligible feat reports it upward', async () => {
		const user = userEvent.setup()
		const onChange = vi.fn()
		const value: FeatAsiChoice[] = [{ level: 4, kind: 'feat', name: '', source: '' }]
		render(
			<FeatAsiPicker
				className="Fighter"
				classSource="XPHB"
				level={4}
				finalAbilityScores={fullScores}
				speciesName={null}
				speciesSource={null}
				value={value}
				onChange={onChange}
			/>,
		)

		await user.click(await screen.findByLabelText('Tough'))
		expect(onChange).toHaveBeenCalledWith([{ level: 4, kind: 'feat', name: 'Tough', source: 'XPHB' }])
	})

	it('a half-feat shows an ability select once chosen; a fixed-bonus feat shows none', async () => {
		const user = userEvent.setup()
		const value: FeatAsiChoice[] = [{ level: 4, kind: 'feat', name: '', source: '' }]
		const { rerender } = render(
			<FeatAsiPicker
				className="Fighter"
				classSource="XPHB"
				level={4}
				finalAbilityScores={fullScores}
				speciesName={null}
				speciesSource={null}
				value={value}
				onChange={() => {}}
			/>,
		)

		expect(screen.queryByLabelText('Ability')).toBeNull()

		await user.click(await screen.findByLabelText('Tough'))
		rerender(
			<FeatAsiPicker
				className="Fighter"
				classSource="XPHB"
				level={4}
				finalAbilityScores={fullScores}
				speciesName={null}
				speciesSource={null}
				value={[{ level: 4, kind: 'feat', name: 'Tough', source: 'XPHB' }]}
				onChange={() => {}}
			/>,
		)
		expect(screen.queryByLabelText('Ability')).toBeNull()

		await user.click(await screen.findByLabelText('Athlete'))
		rerender(
			<FeatAsiPicker
				className="Fighter"
				classSource="XPHB"
				level={4}
				finalAbilityScores={fullScores}
				speciesName={null}
				speciesSource={null}
				value={[{ level: 4, kind: 'feat', name: 'Athlete', source: 'XPHB' }]}
				onChange={() => {}}
			/>,
		)
		expect(await screen.findByLabelText('Ability')).toBeTruthy()
	})

	it('choosing the ability for a half-feat reports chosenAbility upward, and the choice holds across a re-render (navigation)', async () => {
		const user = userEvent.setup()
		const onChange = vi.fn()
		const { rerender } = render(
			<FeatAsiPicker
				className="Fighter"
				classSource="XPHB"
				level={4}
				finalAbilityScores={fullScores}
				speciesName={null}
				speciesSource={null}
				value={[{ level: 4, kind: 'feat', name: 'Athlete', source: 'XPHB' }]}
				onChange={onChange}
			/>,
		)

		const abilitySelect = (await screen.findByLabelText('Ability')) as HTMLSelectElement
		await user.selectOptions(abilitySelect, 'strength')
		expect(onChange).toHaveBeenCalledWith([{ level: 4, kind: 'feat', name: 'Athlete', source: 'XPHB', chosenAbility: 'strength' }])

		// Re-render with the reported value, as the wizard would after navigating back and forward.
		rerender(
			<FeatAsiPicker
				className="Fighter"
				classSource="XPHB"
				level={4}
				finalAbilityScores={fullScores}
				speciesName={null}
				speciesSource={null}
				value={[{ level: 4, kind: 'feat', name: 'Athlete', source: 'XPHB', chosenAbility: 'strength' }]}
				onChange={() => {}}
			/>,
		)
		const select = (await screen.findByLabelText('Ability')) as HTMLSelectElement
		expect(select.value).toBe('strength')
	})

	it('choosing a different feat clears a previously chosen ability', async () => {
		const user = userEvent.setup()
		const onChange = vi.fn()
		render(
			<FeatAsiPicker
				className="Fighter"
				classSource="XPHB"
				level={4}
				finalAbilityScores={fullScores}
				speciesName={null}
				speciesSource={null}
				value={[{ level: 4, kind: 'feat', name: 'Athlete', source: 'XPHB', chosenAbility: 'strength' }]}
				onChange={onChange}
			/>,
		)

		await user.click(await screen.findByLabelText('Tough'))
		expect(onChange).toHaveBeenCalledWith([{ level: 4, kind: 'feat', name: 'Tough', source: 'XPHB' }])
	})

	it('the level-20 cap disables an ability that would exceed it under +2', async () => {
		const value: FeatAsiChoice[] = [{ level: 4, kind: 'asi', increases: {} }]
		render(
			<FeatAsiPicker
				className="Fighter"
				classSource="XPHB"
				level={4}
				finalAbilityScores={{ ...fullScores, strength: 19 }}
				speciesName={null}
				speciesSource={null}
				value={value}
				onChange={() => {}}
			/>,
		)

		const select = await screen.findByRole('combobox')
		const strengthOption = Array.from(select.querySelectorAll('option')).find((o) => o.textContent?.startsWith('Strength')) as HTMLOptionElement
		expect(strengthOption.disabled).toBe(true)
		const dexOption = Array.from(select.querySelectorAll('option')).find((o) => o.textContent?.startsWith('Dexterity')) as HTMLOptionElement
		expect(dexOption.disabled).toBe(false)
	})

	it('choosing +2 to an ability reports the increase upward', async () => {
		const user = userEvent.setup()
		const onChange = vi.fn()
		const value: FeatAsiChoice[] = [{ level: 4, kind: 'asi', increases: {} }]
		render(
			<FeatAsiPicker
				className="Fighter"
				classSource="XPHB"
				level={4}
				finalAbilityScores={fullScores}
				speciesName={null}
				speciesSource={null}
				value={value}
				onChange={onChange}
			/>,
		)

		const select = await screen.findByRole('combobox')
		await user.selectOptions(select, 'strength')
		expect(onChange).toHaveBeenCalledWith([{ level: 4, kind: 'asi', increases: { strength: 2 } }])
	})

	describe('Magic Initiate (slice d5b-2)', () => {
		it('choosing Wizard offers only Wizard cantrips/level-1 spells, and picks persist once counts are met', async () => {
			const user = userEvent.setup()
			const onChange = vi.fn()
			const value: FeatAsiChoice[] = [{ level: 4, kind: 'feat', name: 'Magic Initiate', source: 'XPHB' }]
			const { rerender } = render(
				<FeatAsiPicker
					className="Fighter"
					classSource="XPHB"
					level={4}
					finalAbilityScores={fullScores}
					speciesName={null}
					speciesSource={null}
					value={value}
					onChange={onChange}
				/>,
			)

			// Controlled component (mirrors AsiSubPicker/FeatSubPicker): the picker only shows the class's spells
			// once the wizard feeds the selection back as `value`, same as every other pick in this component.
			await user.click(await screen.findByRole('radio', { name: 'Wizard' }))
			const afterClassPick = onChange.mock.calls.at(-1)![0] as FeatAsiChoice[]
			expect(afterClassPick[0]).toMatchObject({ magicInitiate: { className: 'Wizard', classSource: 'XPHB', cantrips: [], spell: null } })
			rerender(
				<FeatAsiPicker
					className="Fighter"
					classSource="XPHB"
					level={4}
					finalAbilityScores={fullScores}
					speciesName={null}
					speciesSource={null}
					value={afterClassPick}
					onChange={onChange}
				/>,
			)

			expect(await screen.findByLabelText('Fire Bolt')).toBeTruthy()
			expect(screen.getByLabelText('Mage Hand')).toBeTruthy()
			expect(screen.getByLabelText('Ray of Sickness')).toBeTruthy()
			expect(screen.queryByLabelText('Guidance')).toBeNull()
			expect(screen.queryByLabelText('Druidcraft')).toBeNull()

			await user.click(screen.getByLabelText('Fire Bolt'))
			let latest = onChange.mock.calls.at(-1)![0] as FeatAsiChoice[]
			rerender(
				<FeatAsiPicker
					className="Fighter"
					classSource="XPHB"
					level={4}
					finalAbilityScores={fullScores}
					speciesName={null}
					speciesSource={null}
					value={latest}
					onChange={onChange}
				/>,
			)
			await user.click(screen.getByLabelText('Mage Hand'))
			latest = onChange.mock.calls.at(-1)![0] as FeatAsiChoice[]
			rerender(
				<FeatAsiPicker
					className="Fighter"
					classSource="XPHB"
					level={4}
					finalAbilityScores={fullScores}
					speciesName={null}
					speciesSource={null}
					value={latest}
					onChange={onChange}
				/>,
			)
			await user.click(screen.getByLabelText('Ray of Sickness'))
			latest = onChange.mock.calls.at(-1)![0] as FeatAsiChoice[]

			expect(latest[0]).toMatchObject({
				name: 'Magic Initiate',
				magicInitiate: {
					className: 'Wizard',
					classSource: 'XPHB',
					cantrips: [
						{ name: 'Fire Bolt', source: 'XPHB' },
						{ name: 'Mage Hand', source: 'XPHB' },
					],
					spell: { name: 'Ray of Sickness', source: 'XPHB' },
				},
			})

			rerender(
				<FeatAsiPicker
					className="Fighter"
					classSource="XPHB"
					level={4}
					finalAbilityScores={fullScores}
					speciesName={null}
					speciesSource={null}
					value={latest}
					onChange={onChange}
				/>,
			)
			// A third cantrip is disabled — exactly 2, no over-picking.
			const thirdCantrip = (await screen.findByLabelText('Prestidigitation')) as HTMLInputElement
			expect(thirdCantrip.disabled).toBe(true)
		})

		it('choosing a different class list clears the previous list\'s picks', async () => {
			const user = userEvent.setup()
			const onChange = vi.fn()
			const value: FeatAsiChoice[] = [
				{
					level: 4,
					kind: 'feat',
					name: 'Magic Initiate',
					source: 'XPHB',
					magicInitiate: {
						className: 'Cleric',
						classSource: 'XPHB',
						cantrips: [
							{ name: 'Guidance', source: 'XPHB' },
							{ name: 'Sacred Flame', source: 'XPHB' },
						],
						spell: { name: 'Bless', source: 'XPHB' },
					},
				},
			]
			render(
				<FeatAsiPicker
					className="Fighter"
					classSource="XPHB"
					level={4}
					finalAbilityScores={fullScores}
					speciesName={null}
					speciesSource={null}
					value={value}
					onChange={onChange}
				/>,
			)

			await user.click(await screen.findByRole('radio', { name: 'Druid' }))
			expect(onChange).toHaveBeenCalledWith([
				{
					level: 4,
					kind: 'feat',
					name: 'Magic Initiate',
					source: 'XPHB',
					magicInitiate: { className: 'Druid', classSource: 'XPHB', cantrips: [], spell: null },
				},
			])
		})

		it('stores the chosen spellcasting ability', async () => {
			const user = userEvent.setup()
			const onChange = vi.fn()
			const value: FeatAsiChoice[] = [
				{
					level: 4,
					kind: 'feat',
					name: 'Magic Initiate',
					source: 'XPHB',
					magicInitiate: { className: 'Wizard', classSource: 'XPHB', cantrips: [], spell: null },
				},
			]
			render(
				<FeatAsiPicker
					className="Fighter"
					classSource="XPHB"
					level={4}
					finalAbilityScores={fullScores}
					speciesName={null}
					speciesSource={null}
					value={value}
					onChange={onChange}
				/>,
			)

			const abilitySelect = (await screen.findByLabelText('Ability')) as HTMLSelectElement
			await user.selectOptions(abilitySelect, 'intelligence')
			const lastCall = onChange.mock.calls.at(-1)![0] as FeatAsiChoice[]
			expect(lastCall[0]).toMatchObject({ chosenAbility: 'intelligence' })
		})
	})
})
