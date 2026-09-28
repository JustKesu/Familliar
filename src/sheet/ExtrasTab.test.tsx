// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExtrasTab } from './ExtrasTab'
import type { Beast, FamiliarFormOption } from '../beasts/beastData'
import type { CharacterClass, CharacterWildShapeForms } from '../storage/character'

afterEach(cleanup)

function beast(overrides: Partial<Beast> = {}): Beast {
	return {
		name: 'Owl',
		source: 'XMM',
		size: ['T'],
		type: 'beast',
		cr: '0',
		crNumber: 0,
		ac: [11],
		hp: { average: 1, formula: '1d4 - 1' },
		speed: { walk: 5, fly: 60 },
		str: 3,
		dex: 13,
		con: 8,
		int: 2,
		wis: 12,
		cha: 7,
		senses: ['Darkvision 120 ft.'],
		passive: 15,
		action: [{ name: 'Talons', entries: ['{@atkr m} {@hit 3}, reach 5 ft. {@h} 1 Slashing damage.'] }],
		...overrides,
	}
}

const OWL = beast()
const IMP = beast({ name: 'Imp', size: ['T'], type: { type: 'fiend', tags: ['devil'] }, cr: '1', crNumber: 1, ac: [13], hp: { average: 21 }, speed: { walk: 20, fly: 40 }, senses: ['Darkvision 120 ft.'], pactOfTheChain: true })
const WOLF = beast({ name: 'Wolf', size: ['M'], cr: '1/2', crNumber: 0.5, ac: [13], hp: { average: 11 }, speed: { walk: 40 }, senses: undefined })
const CAT = beast({ name: 'Cat', cr: '0', speed: { walk: 40, climb: 30 }, senses: ['Darkvision 60 ft.'] })

const DRUID: CharacterClass = { className: 'Druid', classSource: 'XPHB', subclass: null, level: 4 }
const FORMS = (...names: string[]): CharacterWildShapeForms[] => [{ className: 'Druid', classSource: 'XPHB', forms: names.map((name) => ({ name, source: 'XMM' })) }]

type Props = Parameters<typeof ExtrasTab>[0]
function tab(props: Partial<Props> = {}) {
	const familiarForms: FamiliarFormOption[] = [
		{ beast: OWL, origin: 'spell' },
		{ beast: IMP, origin: 'pact-of-the-chain' },
	]
	return render(
		<ExtrasTab
			familiar={null}
			familiarForms={familiarForms}
			wildShapeForms={[]}
			classes={[DRUID]}
			beasts={[OWL, IMP, WOLF, CAT]}
			beastsError={null}
			beastsLoading={false}
			onOpenBeast={vi.fn()}
			{...props}
		/>,
	)
}

const rows = (container: HTMLElement) => [...container.querySelectorAll('.extras-tab__item')]
const cells = (row: Element) => [...row.querySelectorAll('.extras-tab__cell')].map((cell) => cell.textContent)

describe('ExtrasTab', () => {
	it('lists the familiar first with AC, average hit points, speed and CR + senses in Notes', () => {
		const { container } = tab({ familiar: { name: 'Owl', source: 'XMM' }, wildShapeForms: FORMS('Wolf') })
		expect(rows(container)).toHaveLength(2)
		expect(rows(container)[0].textContent).toContain('Owl')
		expect(rows(container)[0].textContent).toContain('Tiny Beast')
		expect(cells(rows(container)[0])).toEqual(['11', '1', '5 ft., fly 60 ft.'])
		expect(rows(container)[0].querySelector('.extras-tab__notes')!.textContent).toBe('CR 0, Darkvision 120 ft.')
		expect(rows(container)[1].textContent).toContain('Wolf')
	})

	it('shows "Uses your HP" for a Wild Shape form, not the beast\'s own number (2024)', () => {
		const { container } = tab({ wildShapeForms: FORMS('Wolf', 'Cat') })
		expect(rows(container).map(cells)).toEqual([
			['13', 'Uses your HP', '40 ft.'],
			['11', 'Uses your HP', '40 ft., climb 30 ft.'],
		])
		expect(rows(container)[1].querySelector('.extras-tab__notes')!.textContent).toBe('CR 0, Darkvision 60 ft.')
		expect(rows(container)[0].querySelector('.extras-tab__notes')!.textContent).toBe('CR 1/2')
	})

	it('puts "Pact of the Chain" in Notes for an invocation-only familiar form', () => {
		const { container } = tab({ familiar: { name: 'Imp', source: 'XMM' } })
		expect(rows(container)[0].querySelector('.extras-tab__notes')!.textContent).toBe('CR 1, Darkvision 120 ft., Pact of the Chain')
	})

	it('filters the rows with the pills and says so when nothing is left', async () => {
		const user = userEvent.setup()
		const { container } = tab({ familiar: { name: 'Owl', source: 'XMM' }, wildShapeForms: FORMS('Wolf') })
		await user.click(screen.getByRole('button', { name: 'Wild Shape' }))
		expect(rows(container)).toHaveLength(1)
		expect(rows(container)[0].textContent).toContain('Wolf')
		await user.click(screen.getByRole('button', { name: 'Familiar' }))
		expect(rows(container)[0].textContent).toContain('Owl')
		await user.click(screen.getByRole('button', { name: 'All' }))
		expect(rows(container)).toHaveLength(2)

		cleanup()
		const onlyFamiliar = tab({ familiar: { name: 'Owl', source: 'XMM' } })
		await user.click(screen.getByRole('button', { name: 'Wild Shape' }))
		expect(onlyFamiliar.container.textContent).toContain('No extras match.')
	})

	it('says "No extras yet." when there is nothing at all', () => {
		const { container } = tab()
		expect(container.textContent).toContain('No extras yet.')
		expect(container.textContent).not.toContain('No extras match.')
	})

	it('shows the Manage Extras button only when the sheet passes the callback', async () => {
		const user = userEvent.setup()
		const onManageExtras = vi.fn()
		tab()
		expect(screen.queryByRole('button', { name: 'Manage Extras' })).toBeNull()
		cleanup()
		tab({ onManageExtras })
		await user.click(screen.getByRole('button', { name: 'Manage Extras' }))
		expect(onManageExtras).toHaveBeenCalledTimes(1)
	})

	it('opens a creature from its name', async () => {
		const user = userEvent.setup()
		const onOpenBeast = vi.fn()
		tab({ wildShapeForms: FORMS('Wolf'), onOpenBeast })
		await user.click(screen.getByRole('button', { name: 'Wolf' }))
		expect(onOpenBeast).toHaveBeenCalledWith(WOLF)
	})

	it('D43: a familiar that is not a legal form is named with the reason; a missing stat block likewise', () => {
		const { container } = tab({ familiar: { name: 'Wolf', source: 'XMM' }, wildShapeForms: FORMS('Dire Corgi') })
		expect(container.textContent).toContain('"Wolf" (XMM) is not a form this familiar can take.')
		expect(container.textContent).toContain('No stat block found for "Dire Corgi" (XMM).')
		expect(screen.queryByRole('button', { name: 'Wolf' })).toBeNull()
	})

	it('while beasts.json loads, or after it failed, a row does not blame its own name; the error shows once above the table', () => {
		const loading = tab({ familiar: { name: 'Owl', source: 'XMM' }, familiarForms: [], beasts: [], beastsLoading: true })
		expect(loading.container.textContent).not.toContain('is not a form')
		cleanup()
		const failed = tab({ wildShapeForms: FORMS('Wolf'), beasts: [], beastsError: 'HTTP 500' })
		expect(failed.container.textContent).toContain('Could not load the Beast stat blocks: HTTP 500')
		expect(failed.container.textContent).not.toContain('No stat block found')
		expect(within(failed.container).getAllByText(/Wolf/)).toHaveLength(1)
	})

	it('shows the Wild Shape count notice (D106) and the "cannot tell" case', () => {
		const over = tab({ wildShapeForms: FORMS('A', 'B', 'C', 'D', 'E', 'F', 'G'), classes: [{ ...DRUID, level: 2 }] })
		expect(over.container.querySelector('.sheet__wild-shape-count-over')!.textContent).toBe('Druid Wild Shape forms: 7 known, 4 allowed.')
		cleanup()
		const gone = tab({ wildShapeForms: FORMS('Wolf'), classes: [] })
		expect(gone.container.querySelector('.sheet__wild-shape-count-unknown')!.textContent).toContain('that class is no longer on this character')
	})
})
