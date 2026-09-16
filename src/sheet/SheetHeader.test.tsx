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
/** Slice 8a: the maximum arrives computed, like the five values above it. */
function maxOf(value: number): Calculated<number> {
	return known(value, [
		{ source: 'level 1 (d10 maximum)', amount: 10 },
		{ source: 'constitution modifier (+2) × 1 level', amount: 2 },
	])
}

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
			maxHitPoints={maxOf(12)}
			maxHpOverride={undefined}
			temporaryHitPoints={undefined}
			{...overrides}
		/>,
	)
}

describe('SheetHeader', () => {
	it('shows the six values with their labels', () => {
		const { container } = renderHeader({ currentHp: 15, maxHitPoints: maxOf(22) })
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

	it('shows "—" for a current HP that is not set, distinct from 0', () => {
		const { container } = renderHeader({ currentHp: 0 })
		expect(container.querySelector('.sheet__hit-points-value')!.textContent).toBe('0 / 12')
	})

	it('has no hit-point inputs and no damage panel on a read-only sheet', () => {
		renderHeader({ currentHp: 10 })
		expect(screen.queryByLabelText('Current HP')).toBeNull()
		expect(screen.queryByLabelText('Max HP override')).toBeNull()
		expect(screen.queryByLabelText('Temporary HP')).toBeNull()
		expect(screen.queryByRole('group', { name: 'Damage and healing' })).toBeNull()
	})

	it('carries the computed maximum’s own breakdown, collapsed by default (slice 8a)', async () => {
		const { container } = renderHeader({ currentHp: 12 })
		const breakdown = container.querySelector('.sheet__max-hit-points details')!
		expect(breakdown.hasAttribute('open')).toBe(false)
		await userEvent.setup().click(within(breakdown as HTMLElement).getByText('Breakdown'))
		expect(breakdown.textContent).toContain('level 1 (d10 maximum): +10')
	})

	it('shows an unresolvable maximum as "—" with the reason, never as a number', () => {
		const { container } = renderHeader({ currentHp: 4, maxHitPoints: unknown('Character has no classes yet.') })
		expect(container.querySelector('.sheet__hit-points-value')!.textContent).toBe('4 / —')
		expect(container.querySelector('.sheet__max-hit-points')!.textContent).toContain('unresolved — Character has no classes yet.')
	})

	it('commits an edited current HP on blur, carrying the unchanged override through', () => {
		const onEditHitPoints = vi.fn()
		renderHeader({ currentHp: 12, maxHpOverride: 20, onEditHitPoints })
		const field = screen.getByLabelText('Current HP')
		fireEvent.change(field, { target: { value: '7' } })
		fireEvent.blur(field)
		expect(onEditHitPoints).toHaveBeenLastCalledWith({ currentHp: 7, maxHpOverride: 20, temporaryHitPoints: undefined })
	})

	it('clears the max override back to unset when emptied, so the computed maximum stands again', () => {
		const onEditHitPoints = vi.fn()
		renderHeader({ currentHp: 12, maxHpOverride: 20, onEditHitPoints })
		const field = screen.getByLabelText('Max HP override')
		fireEvent.change(field, { target: { value: '' } })
		fireEvent.blur(field)
		expect(onEditHitPoints).toHaveBeenLastCalledWith({ currentHp: 12, maxHpOverride: undefined, temporaryHitPoints: undefined })
	})

	it('never commits a negative hit-point value', () => {
		const onEditHitPoints = vi.fn()
		renderHeader({ currentHp: 5, maxHpOverride: 20, onEditHitPoints })
		const field = screen.getByLabelText('Current HP')
		fireEvent.change(field, { target: { value: '-3' } })
		fireEvent.blur(field)
		expect(onEditHitPoints).toHaveBeenLastCalledWith({ currentHp: 0, maxHpOverride: 20, temporaryHitPoints: undefined })
	})
})

/* Slice 9a1 (D110). */
describe('SheetHeader temporary hit points and the damage/healing panel', () => {
	/** The panel's amount field plus one of its three buttons, as a player uses them. */
	function act(label: string, amount: string): void {
		fireEvent.change(screen.getByLabelText('Amount'), { target: { value: amount } })
		fireEvent.click(screen.getByRole('button', { name: label }))
	}

	it('shows temporary hit points as a separate figure, never folded into the pair', () => {
		const { container } = renderHeader({ currentHp: 44, maxHitPoints: maxOf(44), temporaryHitPoints: 8 })
		expect(container.querySelector('.sheet__hit-points-value')!.textContent).toBe('44 / 44 + 8 temporary')
	})

	it('says nothing about temporary hit points when there are none', () => {
		const { container } = renderHeader({ currentHp: 44, maxHitPoints: maxOf(44), temporaryHitPoints: 0 })
		expect(container.querySelector('.sheet__hit-points-value')!.textContent).toBe('44 / 44')
		expect(container.querySelector('.sheet__temporary-hit-points')).toBeNull()
	})

	it('takes damage off temporary hit points first, then off current', () => {
		const onEditHitPoints = vi.fn()
		renderHeader({ currentHp: 30, maxHitPoints: maxOf(44), temporaryHitPoints: 8, onEditHitPoints })
		act('Damage', '12')
		expect(onEditHitPoints).toHaveBeenLastCalledWith({ currentHp: 26, maxHpOverride: undefined, temporaryHitPoints: 0 })
	})

	it('stops damage at 0 current hit points', () => {
		const onEditHitPoints = vi.fn()
		renderHeader({ currentHp: 4, maxHitPoints: maxOf(44), onEditHitPoints })
		act('Damage', '20')
		expect(onEditHitPoints).toHaveBeenLastCalledWith({ currentHp: 0, maxHpOverride: undefined, temporaryHitPoints: 0 })
	})

	it('clamps healing at the computed maximum, which carries any override', () => {
		const onEditHitPoints = vi.fn()
		renderHeader({ currentHp: 40, maxHitPoints: maxOf(44), maxHpOverride: 44, onEditHitPoints })
		act('Heal', '20')
		expect(onEditHitPoints).toHaveBeenLastCalledWith({ currentHp: 44, maxHpOverride: 44, temporaryHitPoints: 0 })
	})

	it('leaves temporary hit points alone when healing', () => {
		const onEditHitPoints = vi.fn()
		renderHeader({ currentHp: 10, maxHitPoints: maxOf(44), temporaryHitPoints: 6, onEditHitPoints })
		act('Heal', '5')
		expect(onEditHitPoints).toHaveBeenLastCalledWith({ currentHp: 15, maxHpOverride: undefined, temporaryHitPoints: 6 })
	})

	it('replaces temporary hit points with a higher grant and keeps the higher one against a lower grant', () => {
		const onEditHitPoints = vi.fn()
		renderHeader({ currentHp: 30, maxHitPoints: maxOf(44), temporaryHitPoints: 5, onEditHitPoints })
		act('Gain temporary HP', '8')
		expect(onEditHitPoints).toHaveBeenLastCalledWith({ currentHp: 30, maxHpOverride: undefined, temporaryHitPoints: 8 })

		cleanup()
		renderHeader({ currentHp: 30, maxHitPoints: maxOf(44), temporaryHitPoints: 8, onEditHitPoints })
		act('Gain temporary HP', '5')
		expect(onEditHitPoints).toHaveBeenLastCalledWith({ currentHp: 30, maxHpOverride: undefined, temporaryHitPoints: 8 })
	})

	it('keeps direct entry alongside the panel, including for the temporary pile', () => {
		const onEditHitPoints = vi.fn()
		renderHeader({ currentHp: 30, maxHitPoints: maxOf(44), temporaryHitPoints: 8, onEditHitPoints })
		const field = screen.getByLabelText('Temporary HP')
		fireEvent.change(field, { target: { value: '3' } })
		fireEvent.blur(field)
		expect(onEditHitPoints).toHaveBeenLastCalledWith({ currentHp: 30, maxHpOverride: undefined, temporaryHitPoints: 3 })
	})

	it('offers no action at all while current HP is not set, and says why (D43)', () => {
		renderHeader({ currentHp: undefined, maxHitPoints: maxOf(44), onEditHitPoints: vi.fn() })
		fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '5' } })
		for (const name of ['Damage', 'Heal', 'Gain temporary HP']) {
			expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
		}
		expect(screen.getByRole('group', { name: 'Damage and healing' }).textContent).toContain('Set current HP first')
	})

	it('withholds healing, and says why, when the maximum cannot be computed (D43)', () => {
		renderHeader({ currentHp: 10, maxHitPoints: unknown('Character has no classes yet.'), onEditHitPoints: vi.fn() })
		fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '5' } })
		expect((screen.getByRole('button', { name: 'Heal' }) as HTMLButtonElement).disabled).toBe(true)
		expect((screen.getByRole('button', { name: 'Damage' }) as HTMLButtonElement).disabled).toBe(false)
		expect(screen.getByRole('group', { name: 'Damage and healing' }).textContent).toContain('Character has no classes yet.')
	})
})
