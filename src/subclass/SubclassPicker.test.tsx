// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SubclassPicker } from './SubclassPicker'

/*
 * Component test for the subclass picker, following the jsdom/testing-
 * library pattern established for pickers (D8). The data loaders are
 * stubbed — data/ is never read into context or loaded in tests directly.
 */

vi.mock('./subclassData', async () => {
	const actual = await vi.importActual<typeof import('./subclassData')>('./subclassData')
	return {
		...actual,
		loadSubclassLevelFor: vi.fn(async (className: string) => (className === 'Fighter' ? 3 : null)),
		loadSubclassesFor: vi.fn(async () => [
			{ name: 'Champion', source: 'XPHB', entries: ['Simple, brutal effectiveness.'] },
			{ name: 'Battle Master', source: 'XPHB', entries: ['Maneuvers and superiority dice.'] },
		]),
	}
})

afterEach(cleanup)

describe('SubclassPicker', () => {
	it('offers a level 3 Fighter subclasses', async () => {
		render(<SubclassPicker className="Fighter" classSource="XPHB" level={3} value={null} onChange={() => {}} />)

		expect(await screen.findByText('Champion')).toBeTruthy()
		expect(screen.getByText('Battle Master')).toBeTruthy()
	})

	it('renders nothing for a level 1 Fighter', async () => {
		const { container } = render(
			<SubclassPicker className="Fighter" classSource="XPHB" level={1} value={null} onChange={() => {}} />,
		)

		await waitFor(() => {
			expect(container.textContent).not.toMatch(/Loading/)
		})
		expect(container.firstChild).toBeNull()
	})

	it('renders whatever value it is given', async () => {
		render(
			<SubclassPicker className="Fighter" classSource="XPHB" level={3} value="Champion" onChange={() => {}} />,
		)

		// A subclass is already chosen, so the list starts collapsed; open it to reach the options.
		await userEvent.setup().click(await screen.findByRole('button', { name: /subclass/i }))
		const champion = (await screen.findByRole('radio', { name: /Champion/ })) as HTMLInputElement
		expect(champion.checked).toBe(true)
		const battleMaster = screen.getByRole('radio', { name: /Battle Master/ }) as HTMLInputElement
		expect(battleMaster.checked).toBe(false)
	})

	it('choosing replaces the previous choice', async () => {
		const user = userEvent.setup()
		const onChange = vi.fn()
		render(
			<SubclassPicker className="Fighter" classSource="XPHB" level={3} value="Champion" onChange={onChange} />,
		)

		await user.click(await screen.findByRole('button', { name: /subclass/i }))
		const battleMaster = await screen.findByRole('radio', { name: /Battle Master/ })
		await user.click(battleMaster)

		expect(onChange).toHaveBeenCalledWith('Battle Master')
	})

	it('search filters the subclass list, but never hides the one already chosen', async () => {
		const user = userEvent.setup()
		render(
			<SubclassPicker className="Fighter" classSource="XPHB" level={3} value="Champion" onChange={() => {}} />,
		)

		await user.click(await screen.findByRole('button', { name: /subclass/i }))
		await user.type(screen.getByLabelText('Search Subclass'), 'Battle')

		expect(screen.getByRole('radio', { name: /Battle Master/ })).toBeTruthy()
		// Champion is chosen and does not match "Battle" — still shown, pinned.
		const champion = screen.getByRole('radio', { name: /Champion/ }) as HTMLInputElement
		expect(champion.checked).toBe(true)
	})
})
