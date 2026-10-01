// @vitest-environment jsdom
import { useState } from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StartingEquipmentPicker } from './StartingEquipmentPicker'
import { emptyStartingEquipmentChoice, type StartingEquipmentChoice, type StartingEquipmentOffer } from './startingEquipmentData'

const classOffer: StartingEquipmentOffer = {
	options: [
		{
			key: 'A',
			label: 'Option A',
			elements: [
				{ kind: 'items', label: 'Dagger', items: [{ name: 'Dagger', source: 'XPHB', quantity: 1 }] },
				{
					kind: 'items',
					label: "Entertainer's Pack",
					items: [
						{ name: 'Costume', source: 'XPHB', quantity: 3 },
						{ name: 'Candle', source: 'XPHB', quantity: 5 },
					],
				},
				{ kind: 'coins', copper: 1500, label: '15 gp' },
			],
		},
		{ key: 'B', label: 'Option B', elements: [{ kind: 'category', categories: ['instrumentMusical'], label: 'a musical instrument (your choice)' }] },
	],
}

const backgroundOffer: StartingEquipmentOffer = {
	options: [{ key: 'A', label: 'Option A', elements: [{ kind: 'coins', copper: 5000, label: '50 gp' }] }],
}

const categoryItems = {
	toolArtisan: [],
	setGaming: [],
	focusHoly: [],
	focusDruidic: [],
	instrumentMusical: [
		{ name: 'Flute', source: 'XPHB' },
		{ name: 'Lute', source: 'XPHB' },
	],
}

function renderPicker(initial: StartingEquipmentChoice = emptyStartingEquipmentChoice()) {
	const onChange = vi.fn()
	function Harness() {
		const [value, setValue] = useState(initial)
		return (
			<StartingEquipmentPicker
				className="Fighter"
				backgroundName="Farmer"
				classOffer={classOffer}
				backgroundOffer={backgroundOffer}
				classOfferError={null}
				backgroundOfferError={null}
				categoryItems={categoryItems}
				value={value}
				onChange={(choice) => {
					onChange(choice)
					setValue(choice)
				}}
			/>
		)
	}
	render(<Harness />)
	return onChange
}

afterEach(cleanup)

describe('StartingEquipmentPicker', () => {
	it('choosing a card reports the option key, and the button reads Chosen', async () => {
		const user = userEvent.setup()
		const onChange = renderPicker()
		await user.click(screen.getByRole('button', { name: 'Choose class option A' }))
		expect(onChange).toHaveBeenLastCalledWith({ classOptionKey: 'A', backgroundOptionKey: null, categoryPicks: {} })
		expect(screen.getByRole('button', { name: 'Choose class option A' }).getAttribute('aria-pressed')).toBe('true')
		expect(screen.getByRole('button', { name: 'Choose class option B' }).getAttribute('aria-pressed')).toBe('false')
	})

	it('a click anywhere on the card chooses it', async () => {
		const user = userEvent.setup()
		const onChange = renderPicker()
		await user.click(within(screen.getByRole('group', { name: 'Background option A' })).getByText('50 gp'))
		expect(onChange).toHaveBeenLastCalledWith({ classOptionKey: null, backgroundOptionKey: 'A', categoryPicks: {} })
	})

	it('switching option drops the category picks of the old option; choosing the same option again keeps them', async () => {
		const user = userEvent.setup()
		const onChange = renderPicker()
		await user.click(screen.getByRole('button', { name: 'Choose class option B' }))
		await user.click(screen.getByRole('button', { name: 'Choose Flute' }))
		expect(onChange).toHaveBeenLastCalledWith({
			classOptionKey: 'B',
			backgroundOptionKey: null,
			categoryPicks: { 'class:B:0': { name: 'Flute', source: 'XPHB' } },
		})

		const calls = onChange.mock.calls.length
		await user.click(screen.getByRole('button', { name: 'Choose class option B' }))
		expect(onChange).toHaveBeenCalledTimes(calls)

		await user.click(screen.getByRole('button', { name: 'Choose class option A' }))
		expect(onChange).toHaveBeenLastCalledWith({ classOptionKey: 'A', backgroundOptionKey: null, categoryPicks: {} })
	})

	it('the category pick list appears under the cards only for the chosen option', async () => {
		const user = userEvent.setup()
		renderPicker()
		expect(screen.queryByRole('button', { name: 'Choose Flute' })).toBeNull()
		await user.click(screen.getByRole('button', { name: 'Choose class option B' }))
		expect(screen.getByRole('button', { name: 'Choose Flute' })).toBeTruthy()
		await user.click(screen.getByRole('button', { name: 'Choose class option A' }))
		expect(screen.queryByRole('button', { name: 'Choose Flute' })).toBeNull()
	})

	it('a pack row expands to its contents and collapses again, without choosing the option', async () => {
		const user = userEvent.setup()
		const onChange = renderPicker()
		const toggle = screen.getByRole('button', { name: "Entertainer's Pack contents" })
		expect(toggle.getAttribute('aria-expanded')).toBe('false')
		expect(screen.queryByText('Costume ×3')).toBeNull()

		await user.click(toggle)
		expect(toggle.getAttribute('aria-expanded')).toBe('true')
		expect(screen.getByText('Costume ×3')).toBeTruthy()
		expect(screen.getByText('Candle ×5')).toBeTruthy()
		expect(onChange).not.toHaveBeenCalled()

		await user.click(toggle)
		expect(screen.queryByText('Costume ×3')).toBeNull()
	})

	it('shows the start table with quantities and the money in its header once both options are taken', async () => {
		const user = userEvent.setup()
		renderPicker()
		expect(screen.queryByText('You will start with')).toBeNull()
		await user.click(screen.getByRole('button', { name: 'Choose class option A' }))
		await user.click(screen.getByRole('button', { name: 'Choose background option A' }))
		expect(screen.getByText('You will start with')).toBeTruthy()
		expect(screen.getByText('65 gp · 0 sp · 0 cp')).toBeTruthy()
		const table = screen.getByRole('table')
		expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Name', 'Qty'])
		expect(within(table).getAllByRole('row').map((row) => row.textContent)).toEqual(['NameQty', 'Candle5', 'Costume3', 'Dagger1'])
	})
})
