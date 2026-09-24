// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { HitPointsCard, HitPointsPanel, type HitPointProps } from './HitPoints'
import { known, unknown, type Calculated } from '../calculation/types'

afterEach(cleanup)

function maxOf(value: number): Calculated<number> {
	return known(value, [
		{ source: 'level 1 (d10 maximum)', amount: 10 },
		{ source: 'constitution modifier (+2) × 1 level', amount: 2 },
	])
}

/** The card and its drawer panel side by side, as the sheet shows them once the drawer is open. */
function renderHp(overrides: Partial<HitPointProps & { onOpen: () => void; hitDice: ReactNode; deathSaveRoll: string | null }> = {}) {
	const { onOpen, hitDice = null, deathSaveRoll = null, ...rest } = overrides
	const props: HitPointProps = {
		currentHp: undefined,
		maxHitPoints: maxOf(12),
		maxHpOverride: undefined,
		temporaryHitPoints: undefined,
		deathSaves: undefined,
		...rest,
	}
	return render(
		<>
			<HitPointsCard {...props} onOpen={onOpen} />
			<div className="test-drawer">
				<HitPointsPanel {...props} hitDice={hitDice} deathSaveRoll={deathSaveRoll} />
			</div>
		</>,
	)
}

function card(container: HTMLElement): HTMLElement {
	return container.querySelector('.sheet__hit-points') as HTMLElement
}

describe('HP card (R4c)', () => {
	it('shows current / max in the card and temporary hit points as their own figure', () => {
		const { container } = renderHp({ currentHp: 44, maxHitPoints: maxOf(44), temporaryHitPoints: 8 })
		expect(container.querySelector('.sheet__hit-points-value')!.textContent).toBe('44 / 44')
		expect(container.querySelector('.sheet__temporary-hit-points')!.textContent).toBe('8')
	})

	it('shows "—" for no temporary hit points and for a current HP that is not set', () => {
		const { container } = renderHp({ temporaryHitPoints: 0 })
		expect(container.querySelector('.sheet__hit-points-value')!.textContent).toBe('— / 12')
		expect(container.querySelector('.sheet__temporary-hit-points')!.textContent).toBe('—')
	})

	it('opens the Hit Points drawer from its label, and leaves the label plain without a drawer', async () => {
		const onOpen = vi.fn()
		renderHp({ onOpen })
		await userEvent.setup().click(screen.getByRole('button', { name: 'Hit points details' }))
		expect(onOpen).toHaveBeenCalledTimes(1)

		cleanup()
		renderHp()
		expect(screen.queryByRole('button', { name: 'Hit points details' })).toBeNull()
	})

	it('holds heal, amount and damage in the card and nothing else editable', () => {
		const { container } = renderHp({ currentHp: 10, onEditHitPoints: vi.fn() })
		const group = within(card(container)).getByRole('group', { name: 'Damage and healing' })
		expect(within(group).getAllByRole('button').map((button) => button.textContent)).toEqual(['Heal', 'Damage'])
		expect(within(card(container)).getByLabelText('Amount')).toBeTruthy()
		expect(within(card(container)).queryByLabelText('Current HP')).toBeNull()
		expect(within(card(container)).queryByRole('button', { name: 'Gain temporary HP' })).toBeNull()
	})

	it('has no inputs, no damage panel and no death saves on a read-only sheet', () => {
		renderHp({ currentHp: 0 })
		for (const label of ['Current HP', 'Max HP override', 'Temporary HP', 'Amount']) expect(screen.queryByLabelText(label)).toBeNull()
		expect(screen.queryByRole('group', { name: 'Damage and healing' })).toBeNull()
		expect(screen.queryByRole('group', { name: 'Death saving throws' })).toBeNull()
	})
})

describe('Hit Points drawer panel', () => {
	it('carries the computed maximum’s breakdown, open (slice 8a)', () => {
		const { container } = renderHp({ currentHp: 12 })
		const breakdown = container.querySelector('.sheet__max-hit-points details')!
		expect(breakdown.hasAttribute('open')).toBe(true)
		expect(breakdown.textContent).toContain('level 1 (d10 maximum): +10')
	})

	it('shows an unresolvable maximum as "—" with the reason, never as a number', () => {
		const { container } = renderHp({ currentHp: 4, maxHitPoints: unknown('Character has no classes yet.') })
		expect(container.querySelector('.sheet__hit-points-value')!.textContent).toBe('4 / —')
		expect(container.querySelector('.sheet__max-hit-points')!.textContent).toContain('unresolved — Character has no classes yet.')
	})

	it('commits an edited current HP on blur, carrying the unchanged override through', () => {
		const onEditHitPoints = vi.fn()
		renderHp({ currentHp: 12, maxHpOverride: 20, onEditHitPoints })
		const field = screen.getByLabelText('Current HP')
		fireEvent.change(field, { target: { value: '7' } })
		fireEvent.blur(field)
		expect(onEditHitPoints).toHaveBeenLastCalledWith({ currentHp: 7, maxHpOverride: 20, temporaryHitPoints: undefined })
	})

	it('clears the max override back to unset when emptied, so the computed maximum stands again', () => {
		const onEditHitPoints = vi.fn()
		renderHp({ currentHp: 12, maxHpOverride: 20, onEditHitPoints })
		const field = screen.getByLabelText('Max HP override')
		fireEvent.change(field, { target: { value: '' } })
		fireEvent.blur(field)
		expect(onEditHitPoints).toHaveBeenLastCalledWith({ currentHp: 12, maxHpOverride: undefined, temporaryHitPoints: undefined })
	})

	it('never commits a negative hit-point value', () => {
		const onEditHitPoints = vi.fn()
		renderHp({ currentHp: 5, maxHpOverride: 20, onEditHitPoints })
		const field = screen.getByLabelText('Current HP')
		fireEvent.change(field, { target: { value: '-3' } })
		fireEvent.blur(field)
		expect(onEditHitPoints).toHaveBeenLastCalledWith({ currentHp: 0, maxHpOverride: 20, temporaryHitPoints: undefined })
	})

	it('places the hit dice slot in its own section', () => {
		const { container } = renderHp({ hitDice: <div className="test-hit-dice">3 / 5 d10</div> })
		expect(container.querySelector('.test-drawer .test-hit-dice')!.textContent).toBe('3 / 5 d10')
	})
})

/* Slice 9a1 (D110). */
describe('damage, healing and temporary hit points', () => {
	function act(label: string, amount: string): void {
		fireEvent.change(screen.getByLabelText('Amount'), { target: { value: amount } })
		fireEvent.click(screen.getByRole('button', { name: label }))
	}

	function gain(amount: string): void {
		fireEvent.change(screen.getByLabelText('Temporary HP to gain'), { target: { value: amount } })
		fireEvent.click(screen.getByRole('button', { name: 'Gain temporary HP' }))
	}

	it('takes damage off temporary hit points first, then off current', () => {
		const onEditHitPoints = vi.fn()
		renderHp({ currentHp: 30, maxHitPoints: maxOf(44), temporaryHitPoints: 8, onEditHitPoints })
		act('Damage', '12')
		expect(onEditHitPoints).toHaveBeenLastCalledWith({ currentHp: 26, maxHpOverride: undefined, temporaryHitPoints: 0 })
	})

	it('stops damage at 0 current hit points', () => {
		const onEditHitPoints = vi.fn()
		renderHp({ currentHp: 4, maxHitPoints: maxOf(44), onEditHitPoints })
		act('Damage', '20')
		expect(onEditHitPoints).toHaveBeenLastCalledWith({ currentHp: 0, maxHpOverride: undefined, temporaryHitPoints: 0 })
	})

	it('clamps healing at the computed maximum, which carries any override', () => {
		const onEditHitPoints = vi.fn()
		renderHp({ currentHp: 40, maxHitPoints: maxOf(44), maxHpOverride: 44, onEditHitPoints })
		act('Heal', '20')
		expect(onEditHitPoints).toHaveBeenLastCalledWith({ currentHp: 44, maxHpOverride: 44, temporaryHitPoints: 0 })
	})

	it('leaves temporary hit points alone when healing', () => {
		const onEditHitPoints = vi.fn()
		renderHp({ currentHp: 10, maxHitPoints: maxOf(44), temporaryHitPoints: 6, onEditHitPoints })
		act('Heal', '5')
		expect(onEditHitPoints).toHaveBeenLastCalledWith({ currentHp: 15, maxHpOverride: undefined, temporaryHitPoints: 6 })
	})

	it('replaces temporary hit points with a higher grant and keeps the higher one against a lower grant', () => {
		const onEditHitPoints = vi.fn()
		renderHp({ currentHp: 30, maxHitPoints: maxOf(44), temporaryHitPoints: 5, onEditHitPoints })
		gain('8')
		expect(onEditHitPoints).toHaveBeenLastCalledWith({ currentHp: 30, maxHpOverride: undefined, temporaryHitPoints: 8 })

		cleanup()
		renderHp({ currentHp: 30, maxHitPoints: maxOf(44), temporaryHitPoints: 8, onEditHitPoints })
		gain('5')
		expect(onEditHitPoints).toHaveBeenLastCalledWith({ currentHp: 30, maxHpOverride: undefined, temporaryHitPoints: 8 })
	})

	it('keeps direct entry of the temporary pile in the drawer', () => {
		const onEditHitPoints = vi.fn()
		renderHp({ currentHp: 30, maxHitPoints: maxOf(44), temporaryHitPoints: 8, onEditHitPoints })
		const field = screen.getByLabelText('Temporary HP')
		fireEvent.change(field, { target: { value: '3' } })
		fireEvent.blur(field)
		expect(onEditHitPoints).toHaveBeenLastCalledWith({ currentHp: 30, maxHpOverride: undefined, temporaryHitPoints: 3 })
	})

	it('offers no action at all while current HP is not set, and says why (D43)', () => {
		const { container } = renderHp({ currentHp: undefined, maxHitPoints: maxOf(44), onEditHitPoints: vi.fn() })
		fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '5' } })
		fireEvent.change(screen.getByLabelText('Temporary HP to gain'), { target: { value: '5' } })
		for (const name of ['Damage', 'Heal', 'Gain temporary HP']) {
			expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
		}
		expect(container.querySelector('.test-drawer')!.textContent).toContain('Set current HP first')
	})

	it('withholds healing, and says why, when the maximum cannot be computed (D43)', () => {
		const { container } = renderHp({ currentHp: 10, maxHitPoints: unknown('Character has no classes yet.'), onEditHitPoints: vi.fn() })
		fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '5' } })
		expect((screen.getByRole('button', { name: 'Heal' }) as HTMLButtonElement).disabled).toBe(true)
		expect((screen.getByRole('button', { name: 'Damage' }) as HTMLButtonElement).disabled).toBe(false)
		expect(container.querySelector('.test-drawer .sheet__damage-healing-note')!.textContent).toContain('Character has no classes yet.')
	})
})

/* Slice 9a2 (D111), in the HP card since R4c. */
describe('death saving throws', () => {
	function renderDying(overrides: Partial<HitPointProps> = {}, roll?: number) {
		if (roll !== undefined) vi.spyOn(Math, 'random').mockReturnValue((roll - 1) / 20)
		const onEditHitPoints = vi.fn()
		const view = renderHp({ currentHp: 0, maxHitPoints: maxOf(44), onEditHitPoints, ...overrides })
		return { ...view, onEditHitPoints }
	}

	function marks(name: RegExp): string {
		return screen.getByRole('img', { name }).getAttribute('aria-label') ?? ''
	}

	afterEach(() => vi.restoreAllMocks())

	it('replaces the HIT POINTS block in the card at exactly 0, and gives it back above 0', () => {
		const { container } = renderDying({ deathSaves: { successes: 2, failures: 1 } })
		const cardElement = card(container)
		expect(cardElement.querySelector('.sheet__hit-points-value')).toBeNull()
		expect(within(cardElement).getByRole('group', { name: 'Death saving throws' })).toBeTruthy()
		expect(marks(/^Successes/)).toBe('Successes: 2 / 3')
		expect(marks(/^Failures/)).toBe('Failures: 1 / 3')
		expect(cardElement.querySelector('.sheet__death-save-successes')!.textContent).toBe('●●○')
		// Healing stays reachable while dying.
		expect(within(cardElement).getByRole('group', { name: 'Damage and healing' })).toBeTruthy()

		cleanup()
		const above = renderHp({ currentHp: 1, maxHitPoints: maxOf(44), onEditHitPoints: vi.fn() })
		expect(screen.queryByRole('group', { name: 'Death saving throws' })).toBeNull()
		expect(above.container.querySelector('.sheet__hit-points-value')!.textContent).toBe('1 / 44')
	})

	/* "Not set" is not 0 (D43): there is nothing to be dying from. */
	it('is hidden while current HP is not set', () => {
		renderHp({ currentHp: undefined, maxHitPoints: maxOf(44), onEditHitPoints: vi.fn() })
		expect(screen.queryByRole('group', { name: 'Death saving throws' })).toBeNull()
	})

	it('adds one success or one failure per manual click in the drawer', () => {
		const { onEditHitPoints } = renderDying({ deathSaves: { successes: 1, failures: 1 } })

		fireEvent.click(screen.getByRole('button', { name: 'Success' }))
		expect(onEditHitPoints).toHaveBeenLastCalledWith({
			currentHp: 0,
			maxHpOverride: undefined,
			temporaryHitPoints: undefined,
			deathSaves: { successes: 2, failures: 1 },
		})

		fireEvent.click(screen.getByRole('button', { name: 'Failure' }))
		expect(onEditHitPoints).toHaveBeenLastCalledWith({
			currentHp: 0,
			maxHpOverride: undefined,
			temporaryHitPoints: undefined,
			deathSaves: { successes: 1, failures: 2 },
		})
	})

	it('never takes a manual count past three', () => {
		const { onEditHitPoints } = renderDying({ deathSaves: { successes: 2, failures: 2 } })
		fireEvent.click(screen.getByRole('button', { name: 'Failure' }))
		expect(onEditHitPoints).toHaveBeenLastCalledWith(expect.objectContaining({ deathSaves: { successes: 2, failures: 3 } }))
	})

	it.each([
		[14, { successes: 1, failures: 0 }],
		[10, { successes: 1, failures: 0 }],
		[9, { successes: 0, failures: 1 }],
		[2, { successes: 0, failures: 1 }],
		[1, { successes: 0, failures: 2 }],
	])('applies the outcome for a rolled %i from the card and reports the number', (roll, expected) => {
		const onDeathSaveRolled = vi.fn()
		const { onEditHitPoints } = renderDying({ onDeathSaveRolled }, roll)
		fireEvent.click(screen.getByRole('button', { name: 'Roll death save' }))
		expect(onEditHitPoints).toHaveBeenLastCalledWith(expect.objectContaining({ currentHp: 0, deathSaves: expected }))
		expect(onDeathSaveRolled).toHaveBeenLastCalledWith(expect.objectContaining({ roll, progress: expected }))
	})

	it('hands back one hit point and drops the progress on a natural 20', () => {
		const { onEditHitPoints } = renderDying({ deathSaves: { successes: 1, failures: 2 } }, 20)
		fireEvent.click(screen.getByRole('button', { name: 'Roll death save' }))
		expect(onEditHitPoints).toHaveBeenLastCalledWith({
			currentHp: 1,
			maxHpOverride: undefined,
			temporaryHitPoints: undefined,
			deathSaves: undefined,
		})
	})

	it('reports a hand-clicked natural 1 as a roll, and a plain Success not at all', () => {
		const onDeathSaveRolled = vi.fn()
		renderDying({ onDeathSaveRolled })
		fireEvent.click(screen.getByRole('button', { name: 'Natural 1' }))
		expect(onDeathSaveRolled).toHaveBeenLastCalledWith(expect.objectContaining({ roll: 1, outcome: 'twoFailures' }))
		fireEvent.click(screen.getByRole('button', { name: 'Success' }))
		expect(onDeathSaveRolled).toHaveBeenCalledTimes(1)
	})

	it('shows the rolled number in the drawer, even with the death save section gone', () => {
		renderHp({ currentHp: 1, maxHitPoints: maxOf(44), onEditHitPoints: vi.fn(), deathSaveRoll: 'Rolled 20 — back up on 1 hit point.' })
		expect(document.querySelector('.sheet__death-save-roll')!.textContent).toBe('Rolled 20 — back up on 1 hit point.')
	})

	it('stops at three successes: STABLE in the card, the explanation in the drawer', () => {
		const { container } = renderDying({ deathSaves: { successes: 3, failures: 1 } })
		expect(card(container).querySelector('.sheet__death-save-word')!.textContent).toBe('Stable')
		expect(screen.queryByRole('button', { name: 'Roll death save' })).toBeNull()
		expect(container.querySelector('.test-drawer')!.textContent).toContain('Stabilized')
		for (const name of ['Success', 'Failure', 'Natural 20', 'Natural 1']) {
			expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
		}
	})

	/* The display stays: a vanished panel would read as a bug rather than as the character's death. */
	it('stops at three failures: DEAD in the card, the explanation in the drawer', () => {
		const { container } = renderDying({ deathSaves: { successes: 1, failures: 3 } })
		expect(card(container).querySelector('.sheet__death-save-word')!.textContent).toBe('Dead')
		expect(screen.queryByRole('button', { name: 'Roll death save' })).toBeNull()
		expect(container.querySelector('.test-drawer')!.textContent).toContain('This character has died.')
		for (const name of ['Success', 'Failure']) {
			expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
		}
	})

	it('drops the progress when the card heals the character above 0', () => {
		const { onEditHitPoints } = renderDying({ deathSaves: { successes: 2, failures: 1 } })
		fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '7' } })
		fireEvent.click(screen.getByRole('button', { name: 'Heal' }))
		expect(onEditHitPoints).toHaveBeenLastCalledWith({
			currentHp: 7,
			maxHpOverride: undefined,
			temporaryHitPoints: 0,
			deathSaves: undefined,
		})
	})

	it('keeps the progress and adds one failure when damage lands at 0 (D169)', () => {
		const { onEditHitPoints } = renderDying({ deathSaves: { successes: 2, failures: 1 }, temporaryHitPoints: undefined })
		fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '5' } })
		fireEvent.click(screen.getByRole('button', { name: 'Damage' }))
		expect(onEditHitPoints).toHaveBeenLastCalledWith(expect.objectContaining({ currentHp: 0, deathSaves: { successes: 2, failures: 2 } }))
	})
})
