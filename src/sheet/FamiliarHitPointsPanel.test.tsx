// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FamiliarHitPointsPanel } from './FamiliarHitPointsPanel'

afterEach(cleanup)

const hp = (current: number, temporary = 0) => ({ current, max: 21, temporary })

function panel(hitPoints: ReturnType<typeof hp> | null, onEdit = vi.fn()) {
	const view = render(<FamiliarHitPointsPanel hitPoints={hitPoints} unresolved="No stat block." onEdit={onEdit} />)
	return { ...view, onEdit }
}

const isDisabled = (name: string) => (screen.getByRole('button', { name }) as HTMLButtonElement).disabled

async function amount(user: ReturnType<typeof userEvent.setup>, value: string) {
	await user.type(screen.getByRole('spinbutton', { name: 'Amount' }), value)
}

describe('FamiliarHitPointsPanel', () => {
	it('shows current / max and the temp pile, "—" when there is none', () => {
		const { container } = panel(hp(16))
		expect(container.querySelector('.familiar-hp__value')!.textContent).toBe('16 / 21')
		expect(container.querySelector('.familiar-hp__temp')!.textContent).toBe('—')
		cleanup()
		const withTemp = panel(hp(16, 4))
		expect(withTemp.container.querySelector('.familiar-hp__temp')!.textContent).toBe('4')
	})

	it('keeps Heal, Damage and Temp disabled while the amount is empty or not a positive number', async () => {
		const user = userEvent.setup()
		panel(hp(16))
		for (const name of ['Heal', 'Damage', 'Temp']) expect(isDisabled(name)).toBe(true)
		await amount(user, '0')
		for (const name of ['Heal', 'Damage', 'Temp']) expect(isDisabled(name)).toBe(true)
		await user.clear(screen.getByRole('spinbutton', { name: 'Amount' }))
		await amount(user, '3')
		for (const name of ['Heal', 'Damage', 'Temp']) expect(isDisabled(name)).toBe(false)
	})

	it('damage takes temporary hit points first', async () => {
		const user = userEvent.setup()
		const { onEdit } = panel(hp(16, 4))
		await amount(user, '6')
		await user.click(screen.getByRole('button', { name: 'Damage' }))
		expect(onEdit).toHaveBeenCalledWith({ currentHp: 14, temporaryHitPoints: 0 })
		expect((screen.getByRole('spinbutton', { name: 'Amount' }) as HTMLInputElement).value).toBe('')
	})

	it('healing never goes above the maximum and never restores temp', async () => {
		const user = userEvent.setup()
		const { onEdit } = panel(hp(19, 4))
		await amount(user, '100')
		await user.click(screen.getByRole('button', { name: 'Heal' }))
		expect(onEdit).toHaveBeenCalledWith({ currentHp: 21, temporaryHitPoints: 4 })
	})

	it('temp does not stack: the higher value wins', async () => {
		const user = userEvent.setup()
		const { onEdit } = panel(hp(16, 4))
		await amount(user, '2')
		await user.click(screen.getByRole('button', { name: 'Temp' }))
		expect(onEdit).toHaveBeenLastCalledWith({ currentHp: 16, temporaryHitPoints: 4 })
		await amount(user, '9')
		await user.click(screen.getByRole('button', { name: 'Temp' }))
		expect(onEdit).toHaveBeenLastCalledWith({ currentHp: 16, temporaryHitPoints: 9 })
	})

	it('writes nothing until a button is clicked (D116)', async () => {
		const user = userEvent.setup()
		const { onEdit } = panel(hp(16))
		await amount(user, '5')
		expect(onEdit).not.toHaveBeenCalled()
	})

	it('at 0 HP says the familiar disappears; Resummon clears both piles', async () => {
		const user = userEvent.setup()
		const { container, onEdit } = panel(hp(0))
		expect(container.textContent).toContain('At 0 HP the familiar disappears. Resummon it when you cast Find Familiar again.')
		expect(container.textContent).toContain('Restores full HP — use when you cast Find Familiar again.')
		await user.click(screen.getByRole('button', { name: 'Resummon' }))
		expect(onEdit).toHaveBeenCalledWith({})
		cleanup()
		expect(panel(hp(1)).container.textContent).not.toContain('disappears')
	})

	it('D43: with no stat block nothing is editable and the reason is shown', () => {
		const { container } = panel(null)
		expect(container.textContent).toContain('No stat block.')
		expect(screen.queryByRole('button')).toBeNull()
	})

	it('without a writer there are no controls to press', () => {
		render(<FamiliarHitPointsPanel hitPoints={hp(16)} unresolved="" />)
		expect(isDisabled('Heal')).toBe(true)
		expect(screen.queryByRole('button', { name: 'Resummon' })).toBeNull()
	})
})
