// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SpeciesPicker } from './SpeciesPicker'

/*
 * What the picker shows for a species already stored on a character (D81):
 * storage holds ONE `{ name, source }` and is never rewritten, so the species
 * and its choice are both derived from that one value. The real grouping runs
 * over a species.json-shaped fixture, so these render the code the app runs.
 */

vi.mock('./speciesData', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./speciesData')>()
	const raw = [
		{ name: 'Elf', source: 'XPHB', entries: [{ name: 'Elven Lineage', entries: ['Drow, High Elf or Wood Elf.'] }] },
		{ name: 'Elf; Drow Lineage', source: 'XPHB' },
		{ name: 'Elf; Wood Elf Lineage', source: 'XPHB' },
		{ name: 'Genasi', source: 'MPMM' },
		{ name: 'Air', source: 'MPMM', raceName: 'Genasi', raceSource: 'MPMM' },
		{ name: 'Water', source: 'MPMM', raceName: 'Genasi', raceSource: 'MPMM' },
		{ name: 'Dwarf', source: 'XPHB' },
	]
	return { ...actual, loadSpeciesOptions: vi.fn(async () => actual.extractSpeciesOptions(raw)) }
})

afterEach(cleanup)

function selectValue(label: string): string {
	return (screen.getByLabelText(label) as HTMLSelectElement).value
}

describe('SpeciesPicker — a species already stored on the character', () => {
	it('shows a stored variant as its species plus its choice', async () => {
		render(<SpeciesPicker value={{ name: 'Elf; Drow Lineage', source: 'XPHB' }} onChange={vi.fn()} />)
		await screen.findByLabelText('Species')

		expect(selectValue('Species')).toBe('Elf|XPHB')
		expect(selectValue('Elven Lineage')).toBe('Elf; Drow Lineage|XPHB')
	})

	it('resolves a Genasi subrace, which stores only "Air", back through its parent', async () => {
		render(<SpeciesPicker value={{ name: 'Air', source: 'MPMM' }} onChange={vi.fn()} />)
		await screen.findByLabelText('Species')

		expect(selectValue('Species')).toBe('Genasi|MPMM')
		expect(selectValue('Lineage')).toBe('Air|MPMM')
	})

	it('renders a character stored on a bare species as incomplete, naming the choice, instead of guessing one', async () => {
		render(<SpeciesPicker value={{ name: 'Elf', source: 'XPHB' }} onChange={vi.fn()} />)
		await screen.findByLabelText('Species')

		expect(selectValue('Species')).toBe('Elf|XPHB')
		expect(selectValue('Elven Lineage')).toBe('')
		expect(screen.getByText('Choose your Elven Lineage to continue.')).toBeTruthy()
	})

	it('says so when the stored species is not in the data at all, rather than showing nothing chosen', async () => {
		render(<SpeciesPicker value={{ name: 'Made Up', source: 'XPHB' }} onChange={vi.fn()} />)

		expect(await screen.findByText(/isn’t in the species list/)).toBeTruthy()
	})

	it('reports the species itself while its choice is outstanding, so the pick is not lost', async () => {
		const user = userEvent.setup()
		const onChange = vi.fn()
		render(<SpeciesPicker value={null} onChange={onChange} />)

		await user.selectOptions(await screen.findByLabelText('Species'), 'Elf (XPHB)')

		expect(onChange).toHaveBeenCalledWith({ name: 'Elf', source: 'XPHB' })
	})
})
