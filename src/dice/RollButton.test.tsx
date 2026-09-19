// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DamageRollButton, RollButton } from './RollButton'

afterEach(cleanup)

function sequence(values: number[]): () => number {
	let i = 0
	return () => values[i++]!
}

function result(container: HTMLElement): string | undefined {
	return container.querySelector('.dice-roll__result')?.textContent?.trim()
}

// 0.4 → 9 and 0.65 → 14 on a d20.
describe('RollButton (d20 check with advantage and disadvantage, step 9 slice 9c3a)', () => {
	it('defaults to normal and shows one die', async () => {
		const user = userEvent.setup()
		const { container } = render(<RollButton modifier={5} label="Athletics check" random={() => 0.65} />)
		expect((screen.getByRole('combobox', { name: 'Roll mode for Athletics check' }) as HTMLSelectElement).value).toBe('normal')
		await user.click(screen.getByRole('button', { name: 'Roll Athletics check' }))
		expect(result(container)).toBe('14 + 5 = 19')
	})

	it('shows both dice and the higher one kept with advantage', async () => {
		const user = userEvent.setup()
		const { container } = render(<RollButton modifier={5} label="Athletics check" random={sequence([0.4, 0.65])} />)
		await user.selectOptions(screen.getByRole('combobox'), 'advantage')
		await user.click(screen.getByRole('button', { name: 'Roll Athletics check' }))
		expect(result(container)).toBe('9, 14 (kept 14) + 5 = 19')
	})

	it('shows both dice and the lower one kept with disadvantage', async () => {
		const user = userEvent.setup()
		const { container } = render(<RollButton modifier={5} label="Athletics check" random={sequence([0.65, 0.4])} />)
		await user.selectOptions(screen.getByRole('combobox'), 'disadvantage')
		await user.click(screen.getByRole('button', { name: 'Roll Athletics check' }))
		expect(result(container)).toBe('14, 9 (kept 9) + 5 = 14')
	})

	it('prints a negative modifier with a minus sign in every mode', async () => {
		const user = userEvent.setup()
		const { container } = render(<RollButton modifier={-1} label="Athletics check" random={sequence([0.4, 0.65])} />)
		await user.selectOptions(screen.getByRole('combobox'), 'advantage')
		await user.click(screen.getByRole('button', { name: 'Roll Athletics check' }))
		expect(result(container)).toBe('9, 14 (kept 14) − 1 = 13')
	})

	it('does not roll when a mode is picked', async () => {
		const user = userEvent.setup()
		const { container } = render(<RollButton modifier={5} label="Athletics check" random={() => 0.65} />)
		await user.selectOptions(screen.getByRole('combobox'), 'advantage')
		expect(result(container)).toBeUndefined()
	})

	it('leaves a showing result alone when the mode changes, until the next click', async () => {
		const user = userEvent.setup()
		const { container } = render(<RollButton modifier={5} label="Athletics check" random={sequence([0.65, 0.4, 0.65])} />)
		await user.click(screen.getByRole('button', { name: 'Roll Athletics check' }))
		expect(result(container)).toBe('14 + 5 = 19')

		await user.selectOptions(screen.getByRole('combobox'), 'advantage')
		expect(result(container)).toBe('14 + 5 = 19')

		await user.click(screen.getByRole('button', { name: 'Roll Athletics check' }))
		expect(result(container)).toBe('9, 14 (kept 14) + 5 = 19')
	})

	it('keeps the chosen mode for the next roll', async () => {
		const user = userEvent.setup()
		const { container } = render(<RollButton modifier={0} label="Athletics check" random={sequence([0.4, 0.65, 0.65, 0.4])} />)
		await user.selectOptions(screen.getByRole('combobox'), 'advantage')
		await user.click(screen.getByRole('button', { name: 'Roll Athletics check' }))
		await user.click(screen.getByRole('button', { name: 'Roll Athletics check' }))
		expect(result(container)).toBe('14, 9 (kept 14) + 0 = 14')
	})
})

describe('DamageRollButton', () => {
	it('sums every die and has no advantage or disadvantage control', async () => {
		const user = userEvent.setup()
		const { container } = render(<DamageRollButton count={2} sides={6} modifier={2} label="Greatsword damage" random={sequence([0.6, 0.2])} />)
		expect(screen.queryByRole('combobox')).toBeNull()
		expect(container.querySelector('select')).toBeNull()
		await user.click(screen.getByRole('button', { name: 'Roll Greatsword damage' }))
		expect(result(container)).toBe('4, 2 + 2 = 8')
	})
})
