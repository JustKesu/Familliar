// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactNode } from 'react'
import { DamageRollButton, RollButton } from './RollButton'
import { RollModeContext } from './RollUi'
import type { RollMode } from './roll'

afterEach(cleanup)

function sequence(values: number[]): () => number {
	let i = 0
	return () => values[i++]!
}

/** Stands in for the sheet's switch: holds the mode and shows it, so a test can see it return to Normal. */
function WithMode({ initial, children }: { initial: RollMode; children: ReactNode }): ReactNode {
	const [mode, setMode] = useState<RollMode>(initial)
	return (
		<RollModeContext.Provider value={{ mode, setMode }}>
			<output data-testid="mode">{mode}</output>
			{children}
		</RollModeContext.Provider>
	)
}

// 0.4 → 9 and 0.65 → 14 on a d20.
describe('RollButton (d20 check, mode from the sheet-wide switch, D165)', () => {
	it('renders no select and no inline result', async () => {
		const user = userEvent.setup()
		const { container } = render(<RollButton modifier={5} label="Athletics check" random={() => 0.65} />)
		await user.click(screen.getByRole('button', { name: 'Roll Athletics check' }))
		expect(container.querySelector('select')).toBeNull()
		expect(container.querySelector('.dice-roll__result')).toBeNull()
	})

	it('rolls one die by default and reports it', async () => {
		const user = userEvent.setup()
		const reports: unknown[] = []
		render(<RollButton modifier={5} label="Athletics check" random={() => 0.65} onRoll={(report) => reports.push(report)} />)
		await user.click(screen.getByRole('button', { name: 'Roll Athletics check' }))
		expect(reports).toEqual([{ label: 'Athletics check', text: '14 + 5 = 19', detail: { dice: [14], keptIndex: 0, modifier: 5, total: 19 } }])
	})

	it('rolls both dice and keeps the higher one with advantage, then puts the switch back to normal', async () => {
		const user = userEvent.setup()
		const reports: unknown[] = []
		render(
			<WithMode initial="advantage">
				<RollButton modifier={5} label="Athletics check" random={sequence([0.4, 0.65])} onRoll={(report) => reports.push(report)} />
			</WithMode>,
		)
		await user.click(screen.getByRole('button', { name: 'Roll Athletics check' }))
		expect(reports).toEqual([{ label: 'Athletics check', text: '9, 14 (kept 14) + 5 = 19', detail: { dice: [9, 14], keptIndex: 1, modifier: 5, total: 19 } }])
		expect(screen.getByTestId('mode').textContent).toBe('normal')
	})

	it('keeps the lower one with disadvantage and prints a negative modifier with a minus sign', async () => {
		const user = userEvent.setup()
		const reports: { text: string }[] = []
		render(
			<WithMode initial="disadvantage">
				<RollButton modifier={-1} label="Athletics check" random={sequence([0.65, 0.4])} onRoll={(report) => reports.push(report)} />
			</WithMode>,
		)
		await user.click(screen.getByRole('button', { name: 'Roll Athletics check' }))
		expect(reports[0]!.text).toBe('14, 9 (kept 9) − 1 = 8')
	})
})

describe('DamageRollButton', () => {
	it('sums every die, ignores the switch and leaves it alone', async () => {
		const user = userEvent.setup()
		const reports: unknown[] = []
		const { container } = render(
			<WithMode initial="advantage">
				<DamageRollButton count={2} sides={6} modifier={2} label="Greatsword damage" random={sequence([0.6, 0.2])} onRoll={(report) => reports.push(report)} />
			</WithMode>,
		)
		await user.click(screen.getByRole('button', { name: 'Roll Greatsword damage' }))
		expect(container.querySelector('select')).toBeNull()
		expect(reports).toEqual([{ label: 'Greatsword damage', text: '4, 2 + 2 = 8', detail: { dice: [4, 2], keptIndex: null, modifier: 2, total: 8 } }])
		expect(screen.getByTestId('mode').textContent).toBe('advantage')
	})
})
