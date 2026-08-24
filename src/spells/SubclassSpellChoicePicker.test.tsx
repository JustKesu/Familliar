// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SubclassSpellChoicePicker } from './SubclassSpellChoicePicker'
import { collectKnownSpells } from './knownSpells'
import type { SubclassSpellChoiceOffer } from './subclassSpellChoiceData'
import type { CharacterSubclassSpellChoicePick } from '../storage/character'

/*
 * Component test for the subclass filter-choice spell picker (build order
 * step 6, slice d6b). The offers loader is stubbed — data/ is never read
 * into context or loaded in tests directly (CLAUDE.md); the pure-logic
 * shape/offering behaviour is covered separately in
 * subclassSpellChoiceData.test.ts.
 */

const evokerLevel3Offers: SubclassSpellChoiceOffer[] = [
	{
		slot: { grantedAtLevel: 3, slotIndex: 0, levels: [0, 1, 2], filter: { kind: 'class', classes: [{ className: 'Wizard', classSource: 'XPHB' }], schools: ['V'] } },
		candidates: [
			{ name: 'Fire Bolt', source: 'XPHB' },
			{ name: 'Burning Hands', source: 'XPHB' },
		],
	},
	{
		slot: { grantedAtLevel: 3, slotIndex: 1, levels: [0, 1, 2], filter: { kind: 'class', classes: [{ className: 'Wizard', classSource: 'XPHB' }], schools: ['V'] } },
		candidates: [
			{ name: 'Fire Bolt', source: 'XPHB' },
			{ name: 'Burning Hands', source: 'XPHB' },
		],
	},
]

const loreLevel6Offers: SubclassSpellChoiceOffer[] = [
	{
		slot: {
			grantedAtLevel: 6,
			slotIndex: 0,
			levels: [0, 1, 2, 3],
			filter: {
				kind: 'class',
				classes: [
					{ className: 'Cleric', classSource: 'XPHB' },
					{ className: 'Druid', classSource: 'XPHB' },
					{ className: 'Wizard', classSource: 'XPHB' },
				],
			},
		},
		candidates: [
			{ name: 'Guidance', source: 'XPHB' },
			{ name: 'Healing Word', source: 'XPHB' },
		],
	},
	{
		slot: {
			grantedAtLevel: 6,
			slotIndex: 1,
			levels: [0, 1, 2, 3],
			filter: {
				kind: 'class',
				classes: [
					{ className: 'Cleric', classSource: 'XPHB' },
					{ className: 'Druid', classSource: 'XPHB' },
					{ className: 'Wizard', classSource: 'XPHB' },
				],
			},
		},
		candidates: [
			{ name: 'Guidance', source: 'XPHB' },
			{ name: 'Healing Word', source: 'XPHB' },
		],
	},
]

const loadSubclassSpellChoiceOffers = vi.fn(
	async (subclassName: string, _subclassSource: string, _className: string, _classSource: string, classLevel: number): Promise<SubclassSpellChoiceOffer[]> => {
		if (subclassName === 'Evoker') return classLevel >= 3 ? evokerLevel3Offers : []
		if (subclassName === 'College of Lore') return classLevel >= 6 ? loreLevel6Offers : []
		return []
	},
)

vi.mock('./subclassSpellChoiceData', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./subclassSpellChoiceData')>()
	return { ...actual, loadSubclassSpellChoiceOffers: (...args: Parameters<typeof loadSubclassSpellChoiceOffers>) => loadSubclassSpellChoiceOffers(...args) }
})

afterEach(cleanup)

function Wrapper({ subclassName, classLevel, initial }: { subclassName: string; classLevel: number; initial?: CharacterSubclassSpellChoicePick[] }) {
	return (
		<SubclassSpellChoicePicker
			subclassName={subclassName}
			subclassSource="XPHB"
			className={subclassName === 'College of Lore' ? 'Bard' : 'Wizard'}
			classSource="XPHB"
			classLevel={classLevel}
			value={initial ?? []}
			onChange={() => {}}
		/>
	)
}

describe('SubclassSpellChoicePicker', () => {
	it('an Evoker at the grant level: only the offered Evocation spells appear, one select per slot', async () => {
		render(<Wrapper subclassName="Evoker" classLevel={3} />)

		expect(await screen.findByText('0 of 2 Evoker spells chosen.')).toBeTruthy()
		const selects = screen.getAllByRole('combobox')
		expect(selects).toHaveLength(2)
		for (const select of selects) {
			expect(select.textContent).toContain('Fire Bolt')
			expect(select.textContent).toContain('Burning Hands')
		}
	})

	it('picks persist through onChange, and the count updates', async () => {
		const user = userEvent.setup()
		function Controlled() {
			const [value, setValue] = useState<CharacterSubclassSpellChoicePick[]>([])
			return (
				<SubclassSpellChoicePicker
					subclassName="Evoker"
					subclassSource="XPHB"
					className="Wizard"
					classSource="XPHB"
					classLevel={3}
					value={value}
					onChange={setValue}
				/>
			)
		}
		render(<Controlled />)

		const selects = await screen.findAllByRole('combobox')
		await user.selectOptions(selects[0], 'Fire Bolt|XPHB')
		expect(await screen.findByText('1 of 2 Evoker spells chosen.')).toBeTruthy()

		await user.selectOptions(selects[1], 'Burning Hands|XPHB')
		expect(await screen.findByText('2 of 2 Evoker spells chosen.')).toBeTruthy()
	})

	it('switching a slot to a different spell clears the old pick, not adds a second one', async () => {
		const user = userEvent.setup()
		function Controlled() {
			const [value, setValue] = useState<CharacterSubclassSpellChoicePick[]>([{ grantedAtLevel: 3, slotIndex: 0, name: 'Fire Bolt', source: 'XPHB' }])
			return (
				<SubclassSpellChoicePicker
					subclassName="Evoker"
					subclassSource="XPHB"
					className="Wizard"
					classSource="XPHB"
					classLevel={3}
					value={value}
					onChange={setValue}
				/>
			)
		}
		render(<Controlled />)

		const selects = await screen.findAllByRole('combobox')
		expect((selects[0] as HTMLSelectElement).value).toBe('Fire Bolt|XPHB')

		await user.selectOptions(selects[0], 'Burning Hands|XPHB')
		expect(await screen.findByText('1 of 2 Evoker spells chosen.')).toBeTruthy()
		expect((selects[0] as HTMLSelectElement).value).toBe('Burning Hands|XPHB')
	})

	it('a spell the character already has is offered but not selectable, with the source named', async () => {
		render(
			<SubclassSpellChoicePicker
				subclassName="Evoker"
				subclassSource="XPHB"
				className="Wizard"
				classSource="XPHB"
				classLevel={3}
				value={[]}
				onChange={() => {}}
				alreadyKnown={collectKnownSpells({
					classSpellPicks: [{ name: 'Fire Bolt', source: 'XPHB' }],
					subclassName: 'Evoker',
					subclassAlwaysPrepared: [],
					subclassSpellChoicePicks: [],
					featGrantedSpells: [],
					optionalFeatureGrantedSpells: [],
				})}
			/>,
		)

		const fireBolt = (await screen.findAllByRole('option', { name: /Fire Bolt/ }))[0] as HTMLOptionElement
		expect(fireBolt.disabled).toBe(true)
		expect(fireBolt.textContent).toContain('the Spells step')
		expect((screen.getAllByRole('option', { name: /Burning Hands/ })[0] as HTMLOptionElement).disabled).toBe(false)
	})

	it("does not disable a slot's own current pick", async () => {
		const picks: CharacterSubclassSpellChoicePick[] = [{ grantedAtLevel: 3, slotIndex: 0, name: 'Fire Bolt', source: 'XPHB' }]
		render(
			<SubclassSpellChoicePicker
				subclassName="Evoker"
				subclassSource="XPHB"
				className="Wizard"
				classSource="XPHB"
				classLevel={3}
				value={picks}
				onChange={() => {}}
				alreadyKnown={collectKnownSpells({
					classSpellPicks: [],
					subclassName: 'Evoker',
					subclassAlwaysPrepared: [],
					subclassSpellChoicePicks: picks,
					featGrantedSpells: [],
					optionalFeatureGrantedSpells: [],
				})}
			/>,
		)

		for (const option of await screen.findAllByRole('option', { name: /Fire Bolt/ })) {
			expect((option as HTMLOptionElement).disabled).toBe(false)
		}
	})

	it('College of Lore below level 6: renders nothing (not shown yet)', async () => {
		const { container } = render(<Wrapper subclassName="College of Lore" classLevel={5} />)
		await Promise.resolve()
		expect(container.textContent).toBe('')
	})

	it('College of Lore at level 6: the other-class-list spells are offered, 2 slots', async () => {
		render(<Wrapper subclassName="College of Lore" classLevel={6} />)

		expect(await screen.findByText('0 of 2 College of Lore spells chosen.')).toBeTruthy()
		const selects = screen.getAllByRole('combobox')
		expect(selects).toHaveLength(2)
	})
})
