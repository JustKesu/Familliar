// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
	it('shows the values with their labels', () => {
		const { container } = renderHeader()
		expect(screen.getByRole('heading', { level: 1, name: 'Aria' })).toBeTruthy()
		expect(container.querySelector('.sheet__armour-class-value')!.textContent).toBe('16')
		expect(container.querySelector('.sheet__initiative')!.textContent).toContain('+2')
		expect(container.querySelector('.sheet__speed .sheet__card-value')!.textContent).toBe('30 ft')
		expect(container.querySelector('.sheet__proficiency-bonus')!.textContent).toContain('+3')
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
})

/* Rework R2: header, number strip and status row as three sibling blocks. */
describe('SheetHeader layout blocks', () => {
	it('puts name and identity in the header, the values and the HP card in the strip, and three cards in the status row', () => {
		const { container } = renderHeader({
			identity: <p className="test-identity">Elf · Fighter 5 · Level 5</p>,
			abilities: <ul className="test-abilities" />,
			hitPoints: <section className="test-hit-points" />,
			defenses: <section className="test-defenses" />,
			concentratingOn: 'Bless',
			onDropConcentration: vi.fn(),
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
		// R4c: the HP card closes the strip.
		expect(strip.lastElementChild!.matches('.test-hit-points')).toBe(true)
		for (const cls of ['.sheet__proficiency-bonus', '.sheet__speed', '.sheet__initiative', '.sheet__armour-class']) {
			expect(strip.querySelector(`:scope > ${cls}`)).toBeTruthy()
		}

		expect([...status.children].map((child) => child.className)).toEqual([
			'test-defenses',
			'sheet__status-card sheet__status-conditions',
			'sheet__status-card sheet__concentration',
		])
		expect(status.querySelector('.sheet__concentration')!.textContent).toContain('Bless')
	})

	/* R4c: death saves live in the HP card, which the header only places. */
	it('has no death saves of its own', () => {
		renderHeader()
		expect(screen.queryByRole('group', { name: 'Death saving throws' })).toBeNull()
		expect(screen.queryByRole('button', { name: 'Roll death save' })).toBeNull()
	})

	it('shows the first letter of the name in the portrait frame', () => {
		const { container } = renderHeader({ name: 'aria' })
		expect(container.querySelector('.sheet__portrait')!.textContent).toBe('A')
	})
})

/* R4c: the status row. */
describe('SheetHeader status row', () => {
	it('shows Conditions as a disabled placeholder', () => {
		renderHeader()
		const add = screen.getByRole('button', { name: '+ Add condition' }) as HTMLButtonElement
		expect(add.disabled).toBe(true)
		expect(add.title).toBe('Coming later')
	})

	it('shows "—" for no concentration, and the spell with a drop control otherwise', () => {
		const { container, rerender } = renderHeader({ onDropConcentration: vi.fn() })
		expect(container.querySelector('.sheet__concentration .sheet__status-text')!.textContent).toBe('—')
		expect(screen.queryByRole('button', { name: 'Drop concentration' })).toBeNull()

		const onDropConcentration = vi.fn()
		rerender(headerElement({ concentratingOn: 'Bless', onDropConcentration }))
		expect(container.querySelector('.sheet__concentration .sheet__status-text')!.textContent).toBe('Bless')
		fireEvent.click(screen.getByRole('button', { name: 'Drop concentration' }))
		expect(onDropConcentration).toHaveBeenCalledTimes(1)
	})

	it('renders a long concentration spell name in full, with the name as its title', () => {
		const name = "Mordenkainen's Magnificent Mansion"
		const { container } = renderHeader({ concentratingOn: name, onDropConcentration: vi.fn() })
		const text = container.querySelector<HTMLElement>('.sheet__concentration .sheet__status-text')!
		expect(text.textContent).toBe(name)
		expect(text.title).toBe(name)
		expect(text.style.textOverflow).toBe('')
	})
})

describe('SheetHeader rest buttons (slice 9b5)', () => {
	it('applies each rest on the click, with no dialog in between', () => {
		const onShortRest = vi.fn()
		const onLongRest = vi.fn()
		renderHeader({ onShortRest, onLongRest })

		fireEvent.click(screen.getByRole('button', { name: 'Short Rest' }))
		expect(onShortRest).toHaveBeenCalledTimes(1)

		fireEvent.click(screen.getByRole('button', { name: 'Long Rest' }))
		expect(onLongRest).toHaveBeenCalledTimes(1)
	})

	/* Rework R2: moved from the hit-point block to the right of the header row. */
	it('sits in the header row, not in the strip', () => {
		const { container } = renderHeader({ onShortRest: vi.fn(), onLongRest: vi.fn() })
		const rest = container.querySelector('.sheet__rest')!
		expect(rest.parentElement!.matches('.sheet__persistent-header > .sheet__header-row')).toBe(true)
		expect(container.querySelector('.sheet__strip .sheet__rest')).toBeNull()
	})

	it('leaves the buttons out of a read-only sheet', () => {
		renderHeader()
		expect(screen.queryByRole('button', { name: 'Short Rest' })).toBeNull()
		expect(screen.queryByRole('button', { name: 'Long Rest' })).toBeNull()
	})
})
