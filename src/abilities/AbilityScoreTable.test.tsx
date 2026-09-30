// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { AbilityScoreTable } from './AbilityScoreTable'

afterEach(cleanup)

function row(name: string): string[] {
	const header = screen.getByRole('rowheader', { name })
	return within(header.closest('tr')!).getAllByRole('cell').map((cell) => cell.textContent ?? '')
}

describe('AbilityScoreTable (W12)', () => {
	it('adds the background bonus into Total and derives the Modifier; ASI / Feats shows — without feats', () => {
		render(
			<AbilityScoreTable
				base={{ strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: null }}
				background={{ strength: 2, wisdom: 1 }}
			/>,
		)
		expect(row('Base')).toEqual(['15', '14', '13', '12', '10', '—'])
		expect(row('Background')).toEqual(['+2', '—', '—', '—', '+1', '—'])
		expect(row('ASI / Feats')).toEqual(['—', '—', '—', '—', '—', '—'])
		expect(row('Total')).toEqual(['17', '14', '13', '12', '11', '—'])
		expect(row('Modifier')).toEqual(['+3', '+2', '+1', '+1', '+0', '—'])
	})

	it('has no Override or Other modifier row (D9)', () => {
		render(<AbilityScoreTable base={{ strength: 8, dexterity: 8, constitution: 8, intelligence: 8, wisdom: 8, charisma: 8 }} background={undefined} />)
		expect(screen.getAllByRole('rowheader').map((h) => h.textContent)).toEqual(['Base', 'Background', 'ASI / Feats', 'Total', 'Modifier'])
		expect(row('Modifier')).toEqual(['−1', '−1', '−1', '−1', '−1', '−1'])
	})
})
