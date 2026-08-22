// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WildShapeFormPicker } from './WildShapeFormPicker'
import { loadBeasts, type Beast } from './beastData'

vi.mock('./beastData', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./beastData')>()
	return { ...actual, loadBeasts: vi.fn(async () => []) }
})

afterEach(cleanup)

function beast(overrides: Partial<Beast> = {}): Beast {
	return {
		name: 'Wolf',
		source: 'XMM',
		size: ['M'],
		type: 'beast',
		cr: '1/4',
		crNumber: 0.25,
		ac: [13],
		hp: { average: 11, formula: '2d8 + 2' },
		speed: { walk: 40 },
		str: 14,
		dex: 15,
		con: 12,
		int: 3,
		wis: 12,
		cha: 6,
		action: [{ name: 'Bite', entries: ['{@atkr m} {@hit 4}, reach 5 ft. {@h} 7 Piercing damage.'] }],
		...overrides,
	}
}

const POOL: Beast[] = [
	beast({ name: 'Rat', cr: '0', crNumber: 0 }),
	beast({ name: 'Spider', cr: '0', crNumber: 0 }),
	beast({ name: 'Wolf' }),
	beast({ name: 'Riding Horse', cr: '1/4', crNumber: 0.25 }),
	beast({ name: 'Badger', cr: '1/4', crNumber: 0.25 }),
	beast({ name: 'Owl', cr: '0', crNumber: 0, speed: { walk: 5, fly: 60 } }),
	beast({ name: 'Brown Bear', cr: '1', crNumber: 1 }),
]

beforeEach(() => {
	vi.mocked(loadBeasts).mockReset().mockResolvedValue(POOL)
})

function renderPicker(props: Partial<Parameters<typeof WildShapeFormPicker>[0]> = {}) {
	const onChange = vi.fn()
	const result = render(
		<WildShapeFormPicker
			className="Druid"
			classSource="XPHB"
			level={2}
			subclassName={null}
			value={[]}
			onChange={onChange}
			{...props}
		/>,
	)
	return { ...result, onChange }
}

describe('WildShapeFormPicker', () => {
	it('renders nothing for a class without Wild Shape, and fetches nothing', async () => {
		const { container } = renderPicker({ className: 'Fighter', level: 20 })
		expect(container.textContent).toBe('')
		expect(vi.mocked(loadBeasts)).not.toHaveBeenCalled()
	})

	it('renders nothing for a Druid below level 2', () => {
		const { container } = renderPicker({ level: 1 })
		expect(container.textContent).toBe('')
	})

	it('offers only the legal forms at level 2 and says what the limits are', async () => {
		renderPicker()
		await screen.findByRole('heading', { name: 'Wild Shape forms' })

		expect(screen.getByText(/Choose 4 Beast forms/)).toBeTruthy()
		expect(screen.getByText(/Maximum Challenge Rating 1\/4/)).toBeTruthy()
		expect(screen.getByText(/no form with a Fly Speed yet/)).toBeTruthy()

		const labels = screen.getAllByRole('checkbox').map((box) => box.closest('label')?.textContent ?? '')
		expect(labels.some((text) => text.includes('Wolf'))).toBe(true)
		expect(labels.some((text) => text.includes('Owl'))).toBe(false) // has a Fly Speed
		expect(labels.some((text) => text.includes('Brown Bear'))).toBe(false) // CR 1
	})

	it('offers flying forms and the wider CR band at level 8', async () => {
		renderPicker({ level: 8 })
		await screen.findByRole('heading', { name: 'Wild Shape forms' })

		expect(screen.getByText(/Choose 8 Beast forms/)).toBeTruthy()
		expect(screen.getByText(/a form with a Fly Speed is allowed/)).toBeTruthy()
		const labels = screen.getAllByRole('checkbox').map((box) => box.closest('label')?.textContent ?? '')
		expect(labels.some((text) => text.includes('Owl'))).toBe(true)
		expect(labels.some((text) => text.includes('Brown Bear'))).toBe(true)
	})

	it("widens the pool for Circle of the Moon and says so", async () => {
		renderPicker({ level: 3, subclassName: 'Circle of the Moon' })
		await screen.findByRole('heading', { name: 'Wild Shape forms' })

		expect(screen.getByText(/Maximum Challenge Rating 1 \(Circle of the Moon\)/)).toBeTruthy()
		const labels = screen.getAllByRole('checkbox').map((box) => box.closest('label')?.textContent ?? '')
		expect(labels.some((text) => text.includes('Brown Bear'))).toBe(true)
	})

	it('shows each offered beast through the shared stat block, with markup resolved', async () => {
		const { container } = renderPicker()
		await screen.findByRole('heading', { name: 'Wild Shape forms' })

		expect(container.querySelectorAll('details.beast').length).toBeGreaterThan(0)
		expect(container.textContent).toContain('Melee Attack Roll:')
		expect(container.textContent).not.toContain('{@')
	})

	it('reports a pick upward', async () => {
		const user = userEvent.setup()
		const { onChange } = renderPicker()
		await screen.findByRole('heading', { name: 'Wild Shape forms' })

		const wolf = screen.getAllByRole('checkbox').find((box) => box.closest('label')?.textContent?.includes('Wolf'))!
		await user.click(wolf)
		expect(onChange).toHaveBeenCalledWith([{ name: 'Wolf', source: 'XMM' }])
	})

	/*
	 * The order-of-use bug this project has shipped three times: a write
	 * callback that rebuilds the list from the control being used instead of
	 * spreading what is already recorded. Picking in either order must keep
	 * both picks.
	 */
	it('keeps an earlier pick when a second one is made, in either order', async () => {
		const user = userEvent.setup()
		const { onChange, rerender } = renderPicker({ value: [{ name: 'Rat', source: 'XMM' }] })
		await screen.findByRole('heading', { name: 'Wild Shape forms' })

		const wolf = screen.getAllByRole('checkbox').find((box) => box.closest('label')?.textContent?.includes('Wolf'))!
		await user.click(wolf)
		expect(onChange).toHaveBeenCalledWith([
			{ name: 'Rat', source: 'XMM' },
			{ name: 'Wolf', source: 'XMM' },
		])

		onChange.mockClear()
		rerender(
			<WildShapeFormPicker
				className="Druid"
				classSource="XPHB"
				level={2}
				subclassName={null}
				value={[{ name: 'Wolf', source: 'XMM' }]}
				onChange={onChange}
			/>,
		)
		const rat = screen.getAllByRole('checkbox').find((box) => box.closest('label')?.textContent?.includes('Rat'))!
		await user.click(rat)
		expect(onChange).toHaveBeenCalledWith([
			{ name: 'Wolf', source: 'XMM' },
			{ name: 'Rat', source: 'XMM' },
		])
	})

	it('removes a pick when it is unchecked, leaving the others', async () => {
		const user = userEvent.setup()
		const { onChange } = renderPicker({
			value: [
				{ name: 'Rat', source: 'XMM' },
				{ name: 'Wolf', source: 'XMM' },
			],
		})
		await screen.findByRole('heading', { name: 'Wild Shape forms' })

		const wolf = screen.getAllByRole('checkbox').find((box) => box.closest('label')?.textContent?.includes('Wolf'))!
		await user.click(wolf)
		expect(onChange).toHaveBeenCalledWith([{ name: 'Rat', source: 'XMM' }])
	})

	/* Counts enforced: a fifth pick at level 2 must not be offerable. */
	it('disables the forms not yet chosen once the limit is full, leaving chosen ones swappable', async () => {
		const user = userEvent.setup()
		const { onChange } = renderPicker({
			level: 2,
			value: [
				{ name: 'Rat', source: 'XMM' },
				{ name: 'Spider', source: 'XMM' },
				{ name: 'Wolf', source: 'XMM' },
				{ name: 'Riding Horse', source: 'XMM' },
			],
		})
		await screen.findByRole('heading', { name: 'Wild Shape forms' })
		await waitFor(() => expect(screen.getByText(/chosen 4/)).toBeTruthy())

		const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
		const badger = boxes.find((box) => box.closest('label')?.textContent?.includes('Badger'))!
		expect(badger.disabled).toBe(true)
		expect(boxes.filter((box) => box.checked).every((box) => !box.disabled)).toBe(true)

		// Unchecking one frees a slot rather than being blocked by the limit.
		const wolf = boxes.find((box) => box.closest('label')?.textContent?.includes('Wolf'))!
		await user.click(wolf)
		expect(onChange).toHaveBeenCalledWith([
			{ name: 'Rat', source: 'XMM' },
			{ name: 'Spider', source: 'XMM' },
			{ name: 'Riding Horse', source: 'XMM' },
		])
	})

	it('shows fewer choices left as picks accumulate', async () => {
		renderPicker({ value: [{ name: 'Rat', source: 'XMM' }] })
		await screen.findByRole('heading', { name: 'Wild Shape forms' })
		expect(screen.getByText(/chosen 1/)).toBeTruthy()
	})
})
