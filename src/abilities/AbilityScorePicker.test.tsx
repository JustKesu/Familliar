// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AbilityScorePicker } from './AbilityScorePicker'

afterEach(() => {
	cleanup()
	vi.restoreAllMocks()
})

function inputValue(label: string): string {
	return (screen.getByLabelText(label) as HTMLInputElement).value
}

describe('AbilityScorePicker — Manual / Rolled (W15)', () => {
	it('assigning a result to an ability that holds another swaps them, and Reroll clears assigned columns only', async () => {
		// Dice cycle 1..6: sets [1,2,3,4]=9, [5,6,1,2]=13, [3,4,5,6]=15, ...
		let call = 0
		vi.spyOn(Math, 'random').mockImplementation(() => (call++ % 6) / 6)
		const onChange = vi.fn()
		const user = userEvent.setup()
		render(<AbilityScorePicker value={null} onChange={onChange} />)

		await user.click(screen.getByRole('button', { name: 'Manual / Rolled' }))
		await user.click(screen.getByRole('button', { name: 'Roll' }))
		expect(screen.getAllByRole('listitem')).toHaveLength(6)

		await user.selectOptions(screen.getByLabelText('Assign result 1'), 'strength')
		await user.selectOptions(screen.getByLabelText('Assign result 2'), 'dexterity')
		expect([inputValue('Strength'), inputValue('Dexterity')]).toEqual(['9', '13'])

		await user.selectOptions(screen.getByLabelText('Assign result 2'), 'strength')
		expect([inputValue('Strength'), inputValue('Dexterity')]).toEqual(['13', '9'])
		expect((screen.getByLabelText('Assign result 1') as HTMLSelectElement).value).toBe('dexterity')

		await user.type(screen.getByLabelText('Wisdom'), '12')
		await user.click(screen.getByRole('button', { name: 'Reroll' }))
		expect([inputValue('Strength'), inputValue('Dexterity'), inputValue('Wisdom')]).toEqual(['', '', '12'])
		expect(onChange).toHaveBeenLastCalledWith(null)
	})

	it('reports the scores only once all six typed values are 3–18', async () => {
		const onChange = vi.fn()
		const user = userEvent.setup()
		render(<AbilityScorePicker value={null} onChange={onChange} />)
		await user.click(screen.getByRole('button', { name: 'Manual / Rolled' }))
		for (const label of ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom']) await user.type(screen.getByLabelText(label), '10')
		await user.type(screen.getByLabelText('Charisma'), '19')
		expect(onChange).toHaveBeenLastCalledWith(null)
		await user.clear(screen.getByLabelText('Charisma'))
		await user.type(screen.getByLabelText('Charisma'), '18')
		expect(onChange).toHaveBeenLastCalledWith({
			method: 'roll',
			scores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 18 },
		})
	})
})

describe('AbilityScorePicker — Standard Array (W14)', () => {
	it('starts empty and swaps a value already held by another ability', async () => {
		const user = userEvent.setup()
		render(<AbilityScorePicker value={null} onChange={vi.fn()} />)
		expect(inputValue('Strength')).toBe('')
		await user.selectOptions(screen.getByLabelText('Strength'), '15')
		await user.selectOptions(screen.getByLabelText('Dexterity'), '15')
		expect([inputValue('Strength'), inputValue('Dexterity')]).toEqual(['', '15'])
	})
})
