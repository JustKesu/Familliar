// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MasteryPicker } from './MasteryPicker'

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

		const rapier = (await screen.findByRole('checkbox', { name: /Rapier/ })) as HTMLInputElement
		expect(rapier.disabled).toBe(true)
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
			const battleaxe = screen.getByRole('checkbox', { name: /Battleaxe/ }) as HTMLInputElement
			expect(battleaxe.checked).toBe(true)
		})
		const greatsword = screen.getByRole('checkbox', { name: /Greatsword/ }) as HTMLInputElement
		expect(greatsword.checked).toBe(false)
	})
})
