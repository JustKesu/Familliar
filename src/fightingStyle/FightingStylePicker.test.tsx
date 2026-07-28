// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FightingStylePicker } from './FightingStylePicker'

/*
 * Component test for the fighting style picker, following the jsdom/testing-
 * library pattern established for pickers (D8). The data loaders are
 * stubbed — data/ is never read into context or loaded in tests directly.
 */

vi.mock('./fightingStyleData', async () => {
	const actual = await vi.importActual<typeof import('./fightingStyleData')>('./fightingStyleData')
	return {
		...actual,
		loadFightingStyleGrantLevel: vi.fn(async (className: string) => {
			if (className === 'Fighter') return 1
			if (className === 'Paladin') return 2
			return null
		}),
		fightingStyleOptions: vi.fn(async () => [
			{ name: 'Dueling', source: 'XPHB', entries: ['+2 damage with one-handed melee weapons.'] },
			{ name: 'Archery', source: 'XPHB', entries: ['+2 to attack rolls with ranged weapons.'] },
		]),
	}
})

afterEach(cleanup)

describe('FightingStylePicker', () => {
	it('offers a choice to a Fighter at level 1', async () => {
		render(
			<FightingStylePicker className="Fighter" classSource="XPHB" level={1} value={null} onChange={() => {}} />,
		)

		expect(await screen.findByText('Dueling')).toBeTruthy()
		expect(screen.getByText('Archery')).toBeTruthy()
	})

	it('offers nothing to a Wizard', async () => {
		const { container } = render(
			<FightingStylePicker className="Wizard" classSource="XPHB" level={5} value={null} onChange={() => {}} />,
		)

		await waitFor(() => {
			expect(container.textContent).not.toMatch(/Loading/)
		})
		expect(container.firstChild).toBeNull()
	})

	it('offers nothing to a Paladin at level 1 but a choice at level 2', async () => {
		const { container, rerender } = render(
			<FightingStylePicker className="Paladin" classSource="XPHB" level={1} value={null} onChange={() => {}} />,
		)

		await waitFor(() => {
			expect(container.textContent).not.toMatch(/Loading/)
		})
		expect(container.firstChild).toBeNull()

		rerender(
			<FightingStylePicker className="Paladin" classSource="XPHB" level={2} value={null} onChange={() => {}} />,
		)

		expect(await screen.findByText('Dueling')).toBeTruthy()
	})

	it('choosing a style replaces the previous choice rather than adding to it', async () => {
		const user = userEvent.setup()
		const onChange = vi.fn()
		render(
			<FightingStylePicker
				className="Fighter"
				classSource="XPHB"
				level={1}
				value="Dueling"
				onChange={onChange}
			/>,
		)

		const archery = await screen.findByRole('radio', { name: /Archery/ })
		await user.click(archery)

		expect(onChange).toHaveBeenCalledTimes(1)
		expect(onChange).toHaveBeenCalledWith('Archery')
	})

	it('renders whatever value it is given', async () => {
		render(
			<FightingStylePicker
				className="Fighter"
				classSource="XPHB"
				level={1}
				value="Archery"
				onChange={() => {}}
			/>,
		)

		await waitFor(() => {
			const archery = screen.getByRole('radio', { name: /Archery/ }) as HTMLInputElement
			expect(archery.checked).toBe(true)
		})
		const dueling = screen.getByRole('radio', { name: /Dueling/ }) as HTMLInputElement
		expect(dueling.checked).toBe(false)
	})
})
