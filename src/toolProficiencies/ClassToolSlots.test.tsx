// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ClassToolSlots } from './ClassToolSlots'
import { classToolGrantsFor } from './classToolChoices'

vi.mock('./toolProficiencyData', () => ({
	loadToolCategoryOptions: vi.fn(async (category: string) =>
		category === 'anyArtisansTool' ? ["Carpenter's Tools", "Smith's Tools", "Tinker's Tools"] : ['Drum', 'Lute'],
	),
}))

afterEach(cleanup)

const grants = (className: string, classSource = 'XPHB') => classToolGrantsFor([{ className, classSource, subclass: null, level: 1 }])
const options = (slot: HTMLElement) => within(slot).getAllByRole('option').map((option) => option.textContent)

describe('ClassToolSlots (D174)', () => {
	it("a Monk's single slot lists artisan's tools and musical instruments together, minus what is known", async () => {
		render(<ClassToolSlots grants={grants('Monk')} value={[]} known={["Smith's Tools"]} onChange={vi.fn()} />)
		expect(options(await screen.findByRole('combobox', { name: /Monk tool/ }))).toEqual(['— not chosen —', "Carpenter's Tools", 'Drum', 'Lute', "Tinker's Tools"])
	})

	it("an Artificer's slot never offers the Tinker's Tools the class already has", async () => {
		render(<ClassToolSlots grants={grants('Artificer', 'EFA')} value={[]} known={[]} onChange={vi.fn()} />)
		expect(options(await screen.findByRole('combobox', { name: /Artificer tool/ }))).toEqual(['— not chosen —', "Carpenter's Tools", "Smith's Tools"])
	})

	it('offers no slots for a class without a grant, and a Bard slot does not offer artisan tools', async () => {
		const { container } = render(<ClassToolSlots grants={grants('Fighter')} value={[]} known={[]} onChange={vi.fn()} />)
		expect(container.textContent).toBe('')
		cleanup()
		render(<ClassToolSlots grants={grants('Bard')} value={[]} known={[]} onChange={vi.fn()} />)
		expect(options(await screen.findByRole('combobox', { name: /Bard tool 1/ }))).toEqual(['— not chosen —', 'Drum', 'Lute'])
	})

	it('chooses into the right slot and leaves other grants’ picks alone', async () => {
		const user = userEvent.setup()
		const onChange = vi.fn()
		render(<ClassToolSlots grants={grants('Bard')} value={[{ grantedBy: 'monk', name: 'Viol' }]} known={[]} onChange={onChange} />)
		await user.selectOptions(await screen.findByRole('combobox', { name: /Bard tool 2/ }), 'Lute')
		expect(onChange).toHaveBeenLastCalledWith([{ grantedBy: 'monk', name: 'Viol' }, { grantedBy: 'bard', name: 'Lute' }])
	})
})
