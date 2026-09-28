// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ManageExtrasPanel } from './ManageExtrasPanel'
import { wildShapeLimits } from '../beasts/wildShapeData'
import type { Beast, FamiliarFormOption } from '../beasts/beastData'
import type { CharacterWildShapeForms } from '../storage/character'

afterEach(cleanup)

function beast(name: string, overrides: Partial<Beast> = {}): Beast {
	return {
		name,
		source: 'XMM',
		size: ['S'],
		type: 'beast',
		cr: '1/4',
		crNumber: 0.25,
		ac: [12],
		hp: { average: 9 },
		speed: { walk: 30 },
		str: 10,
		dex: 12,
		con: 10,
		int: 2,
		wis: 10,
		cha: 4,
		action: [{ name: 'Bite', entries: ['{@atkr m} {@hit 3}, reach 5 ft. {@h} 4 Piercing damage.'] }],
		...overrides,
	}
}

const OWL = beast('Owl', { size: ['T'], cr: '0', crNumber: 0, speed: { walk: 5, fly: 60 } })
const CAT = beast('Cat', { size: ['T'], cr: '0', crNumber: 0 })
const IMP = beast('Imp', { type: { type: 'fiend', tags: ['devil'] }, cr: '1', crNumber: 1, pactOfTheChain: true })
// Level 2 Druid: 4 forms, CR 1/4, no fly — Owl (flies) is not offered; five plain candidates.
const GROUND = ['Badger', 'Boar', 'Cat', 'Dog', 'Eel'].map((name) => beast(name, name === 'Cat' ? { size: ['T'], cr: '0', crNumber: 0 } : {}))
const POOL = [OWL, IMP, ...GROUND]

const FAMILIAR_FORMS: FamiliarFormOption[] = [
	{ beast: OWL, origin: 'spell' },
	{ beast: CAT, origin: 'spell' },
	{ beast: IMP, origin: 'pact-of-the-chain' },
]
const WILD_SHAPE = { className: 'Druid', classSource: 'XPHB', limits: wildShapeLimits('Druid', 2)! }
const forms = (...names: string[]): CharacterWildShapeForms[] => [{ className: 'Druid', classSource: 'XPHB', forms: names.map((name) => ({ name, source: 'XMM' })) }]

type Props = Parameters<typeof ManageExtrasPanel>[0]
function panel(props: Partial<Props> = {}) {
	return render(
		<ManageExtrasPanel
			familiar={null}
			familiarAvailable
			familiarForms={FAMILIAR_FORMS}
			wildShape={null}
			wildShapeForms={[]}
			beasts={POOL}
			beastsError={null}
			beastsLoading={false}
			onChooseFamiliar={vi.fn()}
			onEditWildShapeForms={vi.fn()}
			{...props}
		/>,
	)
}

const add = () => screen.getByRole('region', { name: 'Add an Extra' })
const current = () => screen.getByRole('region', { name: 'Current Extras' })

describe('ManageExtrasPanel — categories', () => {
	it('offers only the categories the character has', () => {
		panel()
		expect(within(screen.getByRole('combobox', { name: 'Category' })).getAllByRole('option').map((option) => option.textContent)).toEqual(['Familiar'])
		cleanup()
		panel({ familiarAvailable: false, wildShape: WILD_SHAPE })
		expect(within(screen.getByRole('combobox', { name: 'Category' })).getAllByRole('option').map((option) => option.textContent)).toEqual(['Wild Shape'])
		cleanup()
		panel({ wildShape: WILD_SHAPE })
		expect(within(screen.getByRole('combobox', { name: 'Category' })).getAllByRole('option').map((option) => option.textContent)).toEqual(['Familiar', 'Wild Shape'])
	})

	it('leaves out a category whose edit callback is missing, and the whole Add section when none is left', () => {
		panel({ wildShape: WILD_SHAPE, onEditWildShapeForms: undefined })
		expect(within(screen.getByRole('combobox', { name: 'Category' })).getAllByRole('option').map((option) => option.textContent)).toEqual(['Familiar'])
		cleanup()
		panel({ onChooseFamiliar: undefined })
		expect(screen.queryByRole('region', { name: 'Add an Extra' })).toBeNull()
	})
})

describe('ManageExtrasPanel — Familiar', () => {
	it('ADD summons a form, filtering by name with the local search', async () => {
		const user = userEvent.setup()
		const onChooseFamiliar = vi.fn()
		panel({ onChooseFamiliar })
		expect(within(add()).getAllByRole('listitem')).toHaveLength(3)
		await user.type(screen.getByRole('searchbox', { name: 'Search creatures' }), 'owl')
		expect(within(add()).getAllByRole('listitem')).toHaveLength(1)
		await user.click(within(add()).getByRole('button', { name: 'Add Owl' }))
		expect(onChooseFamiliar).toHaveBeenCalledWith({ name: 'Owl', source: 'XMM' })
	})

	it('the button reads REPLACE once a familiar exists, and the current form shows "Current" instead of a button', async () => {
		const user = userEvent.setup()
		const onChooseFamiliar = vi.fn()
		panel({ familiar: { name: 'Owl', source: 'XMM' }, onChooseFamiliar })
		expect(within(add()).queryByRole('button', { name: 'Add Cat' })).toBeNull()
		expect(within(add()).queryByRole('button', { name: 'Replace Owl' })).toBeNull()
		expect(within(add()).getByText('Current')).toBeTruthy()
		await user.click(within(add()).getByRole('button', { name: 'Replace Cat' }))
		expect(onChooseFamiliar).toHaveBeenCalledWith({ name: 'Cat', source: 'XMM' })
	})

	it('labels the Pact of the Chain forms, and only those', () => {
		panel()
		expect(within(add()).getByRole('button', { name: 'Add Imp' }).closest('li')!.textContent).toContain('Pact of the Chain')
		expect(within(add()).getByRole('button', { name: 'Add Owl' }).closest('li')!.textContent).not.toContain('Pact of the Chain')
	})

	it('shows "Size Type · CR x" and opens the stat block with ▸', async () => {
		const user = userEvent.setup()
		panel()
		const row = within(add()).getByRole('button', { name: 'Add Owl' }).closest('li')!
		expect(row.querySelector('.manage-spells__meta')!.textContent).toBe('Tiny Beast · CR 0')
		expect(within(row).queryByRole('heading', { name: 'Actions' })).toBeNull()
		await user.click(within(row).getByRole('button', { name: 'Owl stat block' }))
		expect(within(row).getByRole('heading', { name: 'Actions' })).toBeTruthy()
		expect(row.textContent).not.toContain('{@')
	})

	it('Current Extras lists the familiar and DELETE clears it with null', async () => {
		const user = userEvent.setup()
		const onChooseFamiliar = vi.fn()
		panel({ familiar: { name: 'Owl', source: 'XMM' }, onChooseFamiliar })
		expect(within(current()).getByRole('heading', { name: 'Familiar' })).toBeTruthy()
		await user.click(within(current()).getByRole('button', { name: 'Delete Owl' }))
		expect(onChooseFamiliar).toHaveBeenCalledWith(null)
	})

	it('says "No extras yet." in Current Extras when there is nothing', () => {
		panel()
		expect(current().textContent).toContain('No extras yet.')
	})
})

describe('ManageExtrasPanel — Wild Shape', () => {
	async function wildShapePanel(props: Partial<Props> = {}) {
		const user = userEvent.setup()
		panel({ familiarAvailable: false, wildShape: WILD_SHAPE, ...props })
		return user
	}

	it('shows the counter, the hint and only the forms under the level\'s limits', async () => {
		await wildShapePanel()
		expect(within(add()).getByText('Known forms: 0 / 4')).toBeTruthy()
		expect(add().textContent).toContain('Maximum Challenge Rating 1/4; no form with a Fly Speed yet.')
		expect(within(add()).queryByRole('button', { name: 'Add Owl' })).toBeNull() // flies
		expect(within(add()).queryByRole('button', { name: 'Add Imp' })).toBeNull() // not a Beast
		expect(within(add()).getAllByRole('listitem')).toHaveLength(5)
	})

	it('ADD creates the class entry when there is none', async () => {
		const onEditWildShapeForms = vi.fn()
		const user = await wildShapePanel({ onEditWildShapeForms })
		await user.click(within(add()).getByRole('button', { name: 'Add Badger' }))
		expect(onEditWildShapeForms).toHaveBeenCalledWith(forms('Badger'))
	})

	it('ADD spreads the picks already made and leaves other classes\' entries alone', async () => {
		const onEditWildShapeForms = vi.fn()
		const stored: CharacterWildShapeForms[] = [{ className: 'Ranger', classSource: 'XPHB', forms: [{ name: 'Elk', source: 'XMM' }] }, ...forms('Badger')]
		const user = await wildShapePanel({ onEditWildShapeForms, wildShapeForms: stored })
		await user.click(within(add()).getByRole('button', { name: 'Add Boar' }))
		expect(onEditWildShapeForms).toHaveBeenCalledWith([stored[0], { className: 'Druid', classSource: 'XPHB', forms: [{ name: 'Badger', source: 'XMM' }, { name: 'Boar', source: 'XMM' }] }])
	})

	it('a known form shows "Known" instead of a button', async () => {
		await wildShapePanel({ wildShapeForms: forms('Badger') })
		expect(within(add()).queryByRole('button', { name: 'Add Badger' })).toBeNull()
		expect(within(add()).getByText('Known')).toBeTruthy()
	})

	it('at the limit the counter is marked full and every remaining ADD is disabled', async () => {
		await wildShapePanel({ wildShapeForms: forms('Badger', 'Boar', 'Cat', 'Dog') })
		expect(add().querySelector('.manage-spells__counter--full')!.textContent).toBe('Known forms: 4 / 4')
		expect((within(add()).getByRole('button', { name: 'Add Eel' }) as HTMLButtonElement).disabled).toBe(true)
	})

	it('DELETE removes one form, which frees ADD again', async () => {
		const onEditWildShapeForms = vi.fn()
		const user = await wildShapePanel({ wildShapeForms: forms('Badger', 'Boar', 'Cat', 'Dog'), onEditWildShapeForms })
		await user.click(within(current()).getByRole('button', { name: 'Delete Boar' }))
		expect(onEditWildShapeForms).toHaveBeenCalledWith(forms('Badger', 'Cat', 'Dog'))

		cleanup()
		panel({ familiarAvailable: false, wildShape: WILD_SHAPE, wildShapeForms: forms('Badger', 'Cat', 'Dog') })
		expect(add().querySelector('.manage-spells__counter--full')).toBeNull()
		expect((within(add()).getByRole('button', { name: 'Add Eel' }) as HTMLButtonElement).disabled).toBe(false)
	})

	it('lists the forms under a Wild Shape heading in Current Extras, after the familiar', () => {
		panel({ wildShape: WILD_SHAPE, familiar: { name: 'Owl', source: 'XMM' }, wildShapeForms: forms('Badger') })
		expect(within(current()).getAllByRole('heading', { level: 4 }).filter((heading) => heading.className.includes('manage-spells__level')).map((heading) => heading.textContent)).toEqual(['Familiar', 'Wild Shape'])
	})

	it('states the load error and no creatures while the file is unavailable', () => {
		panel({ familiarAvailable: false, wildShape: WILD_SHAPE, beasts: [], beastsError: 'HTTP 500' })
		expect(add().textContent).toContain('Could not load the Beast stat blocks: HTTP 500')
		expect(add().textContent).not.toContain('No creatures match.')
	})
})
