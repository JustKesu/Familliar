// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MasteryPicker } from './MasteryPicker'
import { chooseButton, isChosen, queryChooseButton } from '../pickers/choiceTestHelpers'
import { loadMasteryWeaponsFor } from './masteryData'

/*
 * Component test for the weapon mastery picker, following the jsdom/testing-
 * library pattern established for pickers (D8). The data loaders are
 * stubbed — data/ is never read into context or loaded in tests directly.
 */

vi.mock('./masteryData', async () => {
	const actual = await vi.importActual<typeof import('./masteryData')>('./masteryData')
	return {
		...actual,
		loadMasteryCountFor: vi.fn(async (className: string, _classSource: string, level: number) => {
			if (className === 'Fighter') return level < 4 ? 3 : 4
			if (className === 'Barbarian') return 2
			return null
		}),
		loadMasteryWeaponsFor: vi.fn(async () => [
			{ name: 'Battleaxe', source: 'XPHB', masteryFull: 'Topple' },
			{ name: 'Greatsword', source: 'XPHB', masteryFull: 'Graze' },
			{ name: 'Rapier', source: 'XPHB', masteryFull: 'Vex' },
		]),
	}
})

afterEach(cleanup)

describe('MasteryPicker', () => {
	it('offers a Fighter at level 1 a count of 3', async () => {
		render(<MasteryPicker className="Fighter" classSource="XPHB" level={1} value={[]} onChange={() => {}} />)

		expect(await screen.findByText('Battleaxe', { exact: false })).toBeTruthy()
		expect(screen.getByText(/Choose 3 more/)).toBeTruthy()
	})

	it('offers a Fighter at level 4 a count of 4', async () => {
		render(<MasteryPicker className="Fighter" classSource="XPHB" level={4} value={[]} onChange={() => {}} />)

		expect(await screen.findByText(/Choose 4 more/)).toBeTruthy()
	})

	it('renders nothing for a class with no mastery', async () => {
		const { container } = render(
			<MasteryPicker className="Wizard" classSource="XPHB" level={5} value={[]} onChange={() => {}} />,
		)

		await waitFor(() => {
			expect(container.textContent).not.toMatch(/Loading/)
		})
		expect(container.firstChild).toBeNull()
	})

	it('cannot exceed the count', async () => {
		const user = userEvent.setup()
		const onChange = vi.fn()
		render(
			<MasteryPicker
				className="Barbarian"
				classSource="XPHB"
				level={1}
				value={['Battleaxe', 'Greatsword']}
				onChange={onChange}
			/>,
		)

		// The list collapses once the required count is met; open it to reach the options.
		await user.click(await screen.findByRole('button', { name: /weapon master/i }))
		const rapier = (await screen.findByRole('button', { name: 'Choose Rapier' })) as HTMLButtonElement
		expect(rapier.disabled).toBe(true)
		expect(screen.getByText(/2 \/ 2 · FULL/)).toBeTruthy()
		await user.click(rapier)
		expect(onChange).not.toHaveBeenCalled()
	})

	it('renders whatever value it is given', async () => {
		render(
			<MasteryPicker
				className="Fighter"
				classSource="XPHB"
				level={1}
				value={['Battleaxe']}
				onChange={() => {}}
			/>,
		)

		await waitFor(() => {
			expect(isChosen(chooseButton('Battleaxe'))).toBe(true)
		})
		expect(isChosen(chooseButton('Greatsword'))).toBe(false)
	})

	it('forwards the character’s feats to the weapon loader (Part 3)', async () => {
		const feats = [{ name: 'Martial Weapon Training', source: 'XPHB' }]
		render(<MasteryPicker className="Fighter" classSource="XPHB" level={1} value={[]} onChange={() => {}} feats={feats} />)

		await screen.findByText('Battleaxe', { exact: false })
		expect(loadMasteryWeaponsFor).toHaveBeenCalledWith('Fighter', 'XPHB', feats)
	})

	it('search filters the weapon list, but never hides a weapon already picked', async () => {
		const user = userEvent.setup()
		render(
			<MasteryPicker
				className="Fighter"
				classSource="XPHB"
				level={1}
				value={['Battleaxe']}
				onChange={() => {}}
			/>,
		)

		await user.type(await screen.findByLabelText('Search Weapon masteries'), 'rapier')

		expect(chooseButton('Rapier')).toBeTruthy()
		expect(queryChooseButton('Greatsword')).toBeNull()
		// Battleaxe is picked and does not match "rapier" — still shown, pinned.
		expect(isChosen(chooseButton('Battleaxe'))).toBe(true)
	})

	it('keeps a pick from an earlier level checked and unremovable during a level up (D108), while the new slot stays open', async () => {
		const user = userEvent.setup()
		const onChange = vi.fn()
		render(
			<MasteryPicker className="Fighter" classSource="XPHB" level={4} value={['Battleaxe']} onChange={onChange} lockedValues={['Battleaxe']} />,
		)

		const battleaxe = (await screen.findByRole('button', { name: 'Choose Battleaxe' })) as HTMLButtonElement
		expect(isChosen(battleaxe)).toBe(true)
		expect(battleaxe.disabled).toBe(true)
		expect(screen.getByText('(chosen at an earlier level)')).toBeTruthy()
		await user.click(battleaxe)
		expect(onChange).not.toHaveBeenCalled()

		await user.click(chooseButton('Rapier'))
		expect(onChange).toHaveBeenCalledWith(['Battleaxe', 'Rapier'])
	})
})
