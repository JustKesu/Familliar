// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SheetHeader } from './SheetHeader'
import { RollModeContext } from '../dice/RollUi'
import type { RollMode } from '../dice/roll'
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

function headerElement(overrides: Partial<Parameters<typeof SheetHeader>[0]> = {}) {
	return (
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
			deathSaves={undefined}
			concentratingOn={null}
			{...overrides}
		/>
	)
}

function renderHeader(overrides: Partial<Parameters<typeof SheetHeader>[0]> = {}) {
	return render(headerElement(overrides))
}

describe('SheetHeader initiative roll (step 9 slice 9c2)', () => {
	/** The header only reports a roll (D165): the toast and the history live in CharacterSheet. */
	function renderReporting(overrides: Partial<Parameters<typeof SheetHeader>[0]> = {}, mode: RollMode = 'normal') {
		const texts: string[] = []
		const view = render(
			<RollModeContext.Provider value={{ mode, setMode: () => {} }}>
				{headerElement({ onRoll: (report) => texts.push(report.text), ...overrides })}
			</RollModeContext.Provider>,
		)
		return { ...view, texts }
	}

	it('rolls a d20 plus the printed initiative without changing it', async () => {
		const user = userEvent.setup()
		const { container, texts } = renderReporting()
		expect(container.querySelector('.sheet__initiative .dice-roll__result')).toBeNull()

		await user.click(screen.getByRole('button', { name: 'Roll initiative' }))
		const match = texts[0]!.match(/^(\d+) \+ 2 = (\d+)$/)
		expect(match).not.toBeNull()
		const die = Number(match![1])
		expect(die).toBeGreaterThanOrEqual(1)
		expect(die).toBeLessThanOrEqual(20)
		expect(Number(match![2])).toBe(die + 2)
		expect(container.querySelector('.sheet__initiative')!.textContent).toContain('+2')
	})

	it('rolls two d20s with disadvantage and keeps the lower, without changing the initiative', async () => {
		const user = userEvent.setup()
		const { container, texts } = renderReporting({}, 'disadvantage')

		await user.click(screen.getByRole('button', { name: 'Roll initiative' }))
		const match = texts[0]!.match(/^(\d+), (\d+) \(kept (\d+)\) \+ 2 = (\d+)$/)
		expect(match).not.toBeNull()
		expect(Number(match![3])).toBe(Math.min(Number(match![1]), Number(match![2])))
		expect(Number(match![4])).toBe(Number(match![3]) + 2)
		expect(container.querySelector('.sheet__initiative')!.textContent).toContain('+2')
	})

	it('offers no roll on an unresolved initiative', () => {
		const { container } = renderHeader({ initiative: unknown('No Dexterity modifier.') })
		expect(container.querySelector('.sheet__initiative .roll-value')).toBeNull()
	})
})

describe('SheetHeader', () => {
	it('shows the six values with their labels', () => {
		const { container } = renderHeader({ currentHp: 15, maxHitPoints: maxOf(22) })
		expect(screen.getByRole('heading', { level: 1, name: 'Aria' })).toBeTruthy()
		expect(container.querySelector('.sheet__armour-class-value')!.textContent).toBe('16')
		expect(container.querySelector('.sheet__initiative')!.textContent).toContain('+2')
		expect(container.querySelector('.sheet__speed .sheet__card-value')!.textContent).toBe('30 ft')
		expect(container.querySelector('.sheet__proficiency-bonus')!.textContent).toContain('+3')
		expect(container.querySelector('.sheet__hit-points-value')!.textContent).toBe('15 / 22')
	})

	it('R4b (D166): each card label asks for its breakdown, and no card carries an inline one', async () => {
		const onOpenBreakdown = vi.fn()
		const { container } = renderHeader({ onOpenBreakdown })
		for (const cls of ['.sheet__proficiency-bonus', '.sheet__speed', '.sheet__initiative', '.sheet__armour-class']) {
			expect(container.querySelector(`${cls} details`)).toBeNull()
		}
		const user = userEvent.setup()
		for (const [name, stat] of [
			['Proficiency bonus breakdown', 'proficiency'],
			['Speed breakdown', 'speed'],
			['Initiative breakdown', 'initiative'],
			['Armour Class breakdown', 'armour'],
		] as const) {
			await user.click(screen.getByRole('button', { name }))
			expect(onOpenBreakdown).toHaveBeenLastCalledWith(stat)
		}
	})

	it('leaves the card labels plain text when there is no drawer to open', () => {
		renderHeader()
		expect(screen.queryByRole('button', { name: 'Speed breakdown' })).toBeNull()
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

	it('has no hit-point inputs and no damage or death-save panel on a read-only sheet', () => {
		renderHeader({ currentHp: 0 })
		expect(screen.queryByLabelText('Current HP')).toBeNull()
		expect(screen.queryByLabelText('Max HP override')).toBeNull()
		expect(screen.queryByLabelText('Temporary HP')).toBeNull()
		expect(screen.queryByRole('group', { name: 'Damage and healing' })).toBeNull()
		expect(screen.queryByRole('group', { name: 'Death saving throws' })).toBeNull()
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

/* Slice 9a2 (D111). */
describe('SheetHeader death saving throws', () => {
	/** A death save panel on a dying character, with the app's d20 pinned to `roll`. */
	function renderDying(overrides: Partial<Parameters<typeof SheetHeader>[0]> = {}, roll?: number) {
		if (roll !== undefined) vi.spyOn(Math, 'random').mockReturnValue((roll - 1) / 20)
		const onEditHitPoints = vi.fn()
		renderHeader({ currentHp: 0, maxHitPoints: maxOf(44), onEditHitPoints, ...overrides })
		return onEditHitPoints
	}

	function panel(): HTMLElement {
		return screen.getByRole('group', { name: 'Death saving throws' })
	}

	/** D117: the rolled number lives in the header, outside the panel, so a natural 20 does not take it away. */
	function rolledText(): string {
		return document.querySelector('.sheet__death-save-roll')?.textContent ?? ''
	}

	afterEach(() => vi.restoreAllMocks())

	it('is hidden above 0 hit points and shown at exactly 0', () => {
		renderHeader({ currentHp: 1, maxHitPoints: maxOf(44), onEditHitPoints: vi.fn() })
		expect(screen.queryByRole('group', { name: 'Death saving throws' })).toBeNull()

		cleanup()
		renderDying()
		expect(panel().textContent).toContain('Successes: 0 / 3')
		expect(panel().textContent).toContain('Failures: 0 / 3')
	})

	/* "Not set" is not 0 (D43): there is nothing to be dying from. */
	it('is hidden while current HP is not set', () => {
		renderHeader({ currentHp: undefined, maxHitPoints: maxOf(44), onEditHitPoints: vi.fn() })
		expect(screen.queryByRole('group', { name: 'Death saving throws' })).toBeNull()
	})

	it('adds one success or one failure per manual click', () => {
		const onEditHitPoints = renderDying({ deathSaves: { successes: 1, failures: 1 } })

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
		const onEditHitPoints = renderDying({ deathSaves: { successes: 2, failures: 2 } })
		fireEvent.click(screen.getByRole('button', { name: 'Failure' }))
		expect(onEditHitPoints).toHaveBeenLastCalledWith(expect.objectContaining({ deathSaves: { successes: 2, failures: 3 } }))
	})

	it.each([
		[14, { successes: 1, failures: 0 }, 'a success'],
		[10, { successes: 1, failures: 0 }, 'a success'],
		[9, { successes: 0, failures: 1 }, 'a failure'],
		[2, { successes: 0, failures: 1 }, 'a failure'],
		[1, { successes: 0, failures: 2 }, 'two failures'],
	])('applies the outcome for a rolled %i and shows the number', (roll, expected, message) => {
		const onEditHitPoints = renderDying({}, roll)
		fireEvent.click(screen.getByRole('button', { name: 'Roll death save' }))
		expect(onEditHitPoints).toHaveBeenLastCalledWith(expect.objectContaining({ currentHp: 0, deathSaves: expected }))
		expect(rolledText()).toContain(`Rolled ${roll} — ${message}`)
	})

	it('hands back one hit point and drops the progress on a natural 20', () => {
		const onEditHitPoints = renderDying({ deathSaves: { successes: 1, failures: 2 } }, 20)
		fireEvent.click(screen.getByRole('button', { name: 'Roll death save' }))
		expect(onEditHitPoints).toHaveBeenLastCalledWith({
			currentHp: 1,
			maxHpOverride: undefined,
			temporaryHitPoints: undefined,
			deathSaves: undefined,
		})
	})

	/* D117: the roll joins the sheet-wide history and is shown outside the panel, which a natural 20 unmounts. */
	describe('the rolled number (D117)', () => {
		it('reports every rolled death save to the roll history, outcome included', () => {
			const onRoll = vi.fn()
			renderDying({ onRoll }, 14)
			fireEvent.click(screen.getByRole('button', { name: 'Roll death save' }))
			expect(onRoll).toHaveBeenCalledTimes(1)
			expect(onRoll).toHaveBeenLastCalledWith({ label: 'death save', text: 'Rolled 14 — a success.' })
		})

		it('logs a natural 1 as one entry that says it counted as two failures', () => {
			const onRoll = vi.fn()
			renderDying({ onRoll }, 1)
			fireEvent.click(screen.getByRole('button', { name: 'Roll death save' }))
			expect(onRoll).toHaveBeenLastCalledWith({ label: 'death save', text: 'Rolled 1 — two failures.' })
			expect(rolledText()).toContain('Rolled 1 — two failures.')
		})

		it('logs a natural 20 and keeps the number on screen after the panel is gone', () => {
			const onRoll = vi.fn()
			vi.spyOn(Math, 'random').mockReturnValue(0.99)
			const { rerender } = renderHeader({ currentHp: 0, maxHitPoints: maxOf(44), onEditHitPoints: vi.fn(), onRoll })
			fireEvent.click(screen.getByRole('button', { name: 'Roll death save' }))
			expect(onRoll).toHaveBeenLastCalledWith({ label: 'death save', text: 'Rolled 20 — back up on 1 hit point.' })

			// The store's write comes back as 1 current HP, which unmounts the panel.
			rerender(headerElement({ currentHp: 1, maxHitPoints: maxOf(44), onEditHitPoints: vi.fn(), onRoll }))
			expect(screen.queryByRole('group', { name: 'Death saving throws' })).toBeNull()
			expect(rolledText()).toContain('Rolled 20 — back up on 1 hit point.')
		})

		it('reports a hand-clicked natural 20 or natural 1 the same way, and a plain Success not at all', () => {
			const onRoll = vi.fn()
			renderDying({ onRoll })

			fireEvent.click(screen.getByRole('button', { name: 'Natural 1' }))
			expect(onRoll).toHaveBeenLastCalledWith({ label: 'death save', text: 'Rolled 1 — two failures.' })

			fireEvent.click(screen.getByRole('button', { name: 'Success' }))
			expect(onRoll).toHaveBeenCalledTimes(1)
		})

		it('shows nothing before the first roll', () => {
			renderDying()
			expect(document.querySelector('.sheet__death-save-roll')).toBeNull()
		})
	})

	it('stops at three successes, saying the character is stabilized', () => {
		renderDying({ deathSaves: { successes: 3, failures: 1 } })
		expect(panel().textContent).toContain('Stabilized')
		for (const name of ['Roll death save', 'Success', 'Failure']) {
			expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
		}
	})

	/* The panel stays visible: a vanished panel would read as a bug rather than as the character's death. */
	it('stops at three failures, saying the character died, and stays on screen', () => {
		renderDying({ deathSaves: { successes: 1, failures: 3 } })
		expect(panel().textContent).toContain('This character has died.')
		for (const name of ['Roll death save', 'Success', 'Failure']) {
			expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
		}
	})

	it('drops the progress when the damage panel heals the character above 0', () => {
		const onEditHitPoints = renderDying({ deathSaves: { successes: 2, failures: 1 } })
		fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '7' } })
		fireEvent.click(screen.getByRole('button', { name: 'Heal' }))
		expect(onEditHitPoints).toHaveBeenLastCalledWith({
			currentHp: 7,
			maxHpOverride: undefined,
			temporaryHitPoints: 0,
			deathSaves: undefined,
		})
	})

	it('keeps the progress through a write that leaves the character at 0', () => {
		const onEditHitPoints = renderDying({ deathSaves: { successes: 2, failures: 1 }, temporaryHitPoints: undefined })
		fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '5' } })
		fireEvent.click(screen.getByRole('button', { name: 'Damage' }))
		expect(onEditHitPoints).toHaveBeenLastCalledWith(expect.objectContaining({ currentHp: 0, deathSaves: { successes: 2, failures: 1 } }))
	})
})

/* Rework R2: header, number strip and status row as three sibling blocks. */
describe('SheetHeader layout blocks', () => {
	it('puts name, identity and roll history in the header, the five values in the strip, and defenses and concentration in the status row', () => {
		const { container } = renderHeader({
			identity: <p className="test-identity">Elf · Fighter 5 · Level 5</p>,
			abilities: <ul className="test-abilities" />,
			defenses: <section className="test-defenses" />,
			concentratingOn: 'Bless',
			onDropConcentration: vi.fn(),
			onEditHitPoints: vi.fn(),
			currentHp: 0,
		})
		const header = container.querySelector('.sheet__persistent-header')!
		const strip = container.querySelector('.sheet__strip')!
		const status = container.querySelector('.sheet__status-row')!
		expect([header.parentElement, strip.parentElement, status.parentElement]).toEqual([container, container, container])
		expect(header.nextElementSibling).toBe(strip)
		expect(strip.nextElementSibling).toBe(status)

		expect(header.querySelector('.sheet__header-main h1')!.textContent).toBe('Aria')
		expect(header.querySelector('.sheet__header-main .test-identity')).toBeTruthy()
		expect(header.querySelector('.sheet__roll-history')).toBeNull()

		expect(strip.firstElementChild!.matches('.test-abilities')).toBe(true)
		for (const cls of ['.sheet__proficiency-bonus', '.sheet__speed', '.sheet__initiative', '.sheet__armour-class', '.sheet__hit-points']) {
			expect(strip.querySelector(`:scope > ${cls}`)).toBeTruthy()
		}
		// The HP block keeps its fields, the damage panel and, at 0, the death saves.
		const hitPoints = strip.querySelector('.sheet__hit-points')!
		expect(within(hitPoints as HTMLElement).getByRole('group', { name: 'Damage and healing' })).toBeTruthy()
		expect(within(hitPoints as HTMLElement).getByRole('group', { name: 'Death saving throws' })).toBeTruthy()

		expect(status.querySelector(':scope > .test-defenses')).toBeTruthy()
		expect(status.querySelector(':scope > .sheet__concentration')!.textContent).toContain('Concentrating: Bless')
		expect(status.querySelector(':scope > .sheet__status-conditions')!.childElementCount).toBe(0)
	})

	it('shows the first letter of the name in the portrait frame', () => {
		const { container } = renderHeader({ name: 'aria' })
		expect(container.querySelector('.sheet__portrait')!.textContent).toBe('A')
	})

	/* Rework R3 (D147): the hit dice line is a caller-built slot, placed under the max HP breakdown. Absent renders nothing. */
	it('places the hitDice slot inside the HP block when given, and renders nothing when absent', () => {
		const { container, rerender } = renderHeader()
		expect(container.querySelector('.sheet__hit-points .test-hit-dice')).toBeNull()

		rerender(headerElement({ hitDice: <div className="test-hit-dice">3 / 5 d10</div> }))
		const hitPoints = container.querySelector('.sheet__hit-points')!
		expect(hitPoints.querySelector('.test-hit-dice')!.textContent).toBe('3 / 5 d10')
	})
})

describe('SheetHeader rest buttons (slice 9b5)', () => {
	it('applies each rest on the click, with no dialog in between', () => {
		const onShortRest = vi.fn()
		const onLongRest = vi.fn()
		renderHeader({ currentHp: 12, maxHitPoints: maxOf(22), onShortRest, onLongRest })

		fireEvent.click(screen.getByRole('button', { name: 'Short Rest' }))
		expect(onShortRest).toHaveBeenCalledTimes(1)

		fireEvent.click(screen.getByRole('button', { name: 'Long Rest' }))
		expect(onLongRest).toHaveBeenCalledTimes(1)
	})

	/* Rework R2: moved from the hit-point block to the right of the header row. */
	it('sits in the header row, not in the hit-point block', () => {
		const { container } = renderHeader({ currentHp: 12, maxHitPoints: maxOf(22), onShortRest: vi.fn(), onLongRest: vi.fn(), onEditHitPoints: vi.fn() })
		const rest = container.querySelector('.sheet__rest')!
		expect(rest.parentElement!.matches('.sheet__persistent-header > .sheet__header-row')).toBe(true)
		expect(container.querySelector('.sheet__hit-points .sheet__rest')).toBeNull()
		expect(container.querySelector('.sheet__strip .sheet__rest')).toBeNull()
	})

	it('leaves the buttons out of a read-only sheet', () => {
		renderHeader({ currentHp: 12, maxHitPoints: maxOf(22) })
		expect(screen.queryByRole('button', { name: 'Short Rest' })).toBeNull()
		expect(screen.queryByRole('button', { name: 'Long Rest' })).toBeNull()
	})
})
