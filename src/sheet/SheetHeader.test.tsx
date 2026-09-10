// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SheetHeader } from './SheetHeader'
import { known, unknown, type Calculated } from '../calculation/types'
import type { ArmourClassValue } from '../calculation/armourClass'
import type { SpeedValue } from '../calculation/speciesTraits'

afterEach(cleanup)

const ac: Calculated<ArmourClassValue> = known({ value: 16, incomplete: [], stealthDisadvantage: [], armourNotSet: [] }, [
	{ source: 'base armour', amount: 14 },
	{ source: 'Dexterity', amount: 2 },
])
const speed: Calculated<SpeedValue> = known<SpeedValue>({ walk: 30 }, [{ source: 'Elf', amount: 30 }])
const initiative: Calculated<number> = known(2, [{ source: 'Dexterity', amount: 2 }])
const proficiencyBonus: Calculated<number> = known(3, [{ source: 'level 5', amount: 3 }])

function renderHeader(overrides: Partial<Parameters<typeof SheetHeader>[0]> = {}) {
	return render(
		<SheetHeader
			name="Aria"
			armourClass={ac}
			armourClassLoading={false}
			acFormulaKeysError={null}
			initiative={initiative}
			speed={speed}
			proficiencyBonus={proficiencyBonus}
			currentHp={undefined}
			maxHp={undefined}
			{...overrides}
		/>,
	)
}

describe('SheetHeader', () => {
	it('shows the six values with their labels', () => {
		const { container } = renderHeader({ currentHp: 15, maxHp: 22 })
		expect(screen.getByRole('heading', { level: 1, name: 'Aria' })).toBeTruthy()
		expect(container.querySelector('.sheet__armour-class-value')!.textContent).toBe('16')
		expect(container.querySelector('.sheet__initiative')!.textContent).toContain('+2')
		expect(container.querySelector('.sheet__speed')!.textContent).toContain('30 ft.')
		expect(container.querySelector('.sheet__proficiency-bonus')!.textContent).toContain('+3')
		expect(container.querySelector('.sheet__hit-points-value')!.textContent).toBe('15 / 22')
	})

	it('keeps each derived value’s breakdown-on-demand, collapsed by default', async () => {
		const { container } = renderHeader()
		const acBreakdown = container.querySelector('.sheet__armour-class details')!
		expect(acBreakdown.hasAttribute('open')).toBe(false)
		await userEvent.setup().click(within(acBreakdown as HTMLElement).getByText('Breakdown'))
		expect(acBreakdown.hasAttribute('open')).toBe(true)
		expect(acBreakdown.textContent).toContain('Dexterity: +2')
	})

	it('shows a loading state for Armour Class while the item list is still loading', () => {
		const { container } = renderHeader({ armourClassLoading: true })
		expect(container.querySelector('.sheet__armour-class')!.textContent).toContain('Loading…')
		expect(container.querySelector('.sheet__armour-class-value')).toBeNull()
	})

	it('renders an unresolved calculation plainly, never as a number', () => {
		const { container } = renderHeader({ initiative: unknown('No Dexterity modifier.') })
		expect(container.querySelector('.sheet__initiative')!.textContent).toContain('unresolved — No Dexterity modifier.')
	})

	it('shows "—" for a hit-point field that is not set, distinct from 0', () => {
		const { container } = renderHeader({ currentHp: 0, maxHp: undefined })
		expect(container.querySelector('.sheet__hit-points-value')!.textContent).toBe('0 / —')
	})

	it('has no hit-point inputs on a read-only sheet', () => {
		renderHeader({ currentHp: 10, maxHp: 10 })
		expect(screen.queryByLabelText('Current HP')).toBeNull()
		expect(screen.queryByLabelText('Max HP')).toBeNull()
	})

	it('commits an edited current HP on blur, carrying the unchanged max through', () => {
		const onEditHitPoints = vi.fn()
		renderHeader({ currentHp: 12, maxHp: 20, onEditHitPoints })
		const field = screen.getByLabelText('Current HP')
		fireEvent.change(field, { target: { value: '7' } })
		fireEvent.blur(field)
		expect(onEditHitPoints).toHaveBeenLastCalledWith(7, 20)
	})

	it('clears a hit-point field back to unset when emptied', () => {
		const onEditHitPoints = vi.fn()
		renderHeader({ currentHp: 12, maxHp: 20, onEditHitPoints })
		const field = screen.getByLabelText('Max HP')
		fireEvent.change(field, { target: { value: '' } })
		fireEvent.blur(field)
		expect(onEditHitPoints).toHaveBeenLastCalledWith(12, undefined)
	})

	it('never commits a negative hit-point value', () => {
		const onEditHitPoints = vi.fn()
		renderHeader({ currentHp: 5, maxHp: 20, onEditHitPoints })
		const field = screen.getByLabelText('Current HP')
		fireEvent.change(field, { target: { value: '-3' } })
		fireEvent.blur(field)
		expect(onEditHitPoints).toHaveBeenLastCalledWith(0, 20)
	})
})
