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
		]),
		loadClassPrereqInfo: vi.fn(async () => ({ armorProficiencies: [], weaponProficiencies: [], hasSpellcasting: false })),
		loadHasFightingStyleFeature: vi.fn(async () => false),
		loadSpeciesPrereqInfo: vi.fn(async () => null),
	}
})

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
})
