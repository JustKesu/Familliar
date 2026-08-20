// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ClassOptionalFeaturePicker } from './ClassOptionalFeaturePicker'
import type { ClassOptionalFeatureGroup, OptionalFeatureSelection } from './optionalFeatureData'

/*
 * Component test for the CLASS-level optionalfeatureProgression picker
 * (D8/D19). The loader is stubbed; the prerequisite evaluation underneath is
 * the real one, since re-evaluating on every change is the behaviour under
 * test. data/ is never read here.
 */

const INVOCATION_GROUP: ClassOptionalFeatureGroup = {
	featureType: 'EI',
	name: 'Eldritch Invocations',
	count: 2,
	options: [
		{ name: 'Pact of the Blade', source: 'XPHB', entries: ['You can create a pact weapon.'] },
		{
			name: 'Eldritch Smite',
			source: 'XPHB',
			entries: ['You can expend a spell slot to deal extra damage.'],
			prerequisite: [{ level: { level: 5, class: { name: 'Warlock', source: 'XPHB' } }, optionalfeature: ['pact of the blade|xphb'] }],
		},
		{
			name: 'Bond of the Talisman',
			source: 'TCE',
			entries: ['You can teleport to the wearer of your talisman.'],
			prerequisite: [{ level: { level: 12, class: { name: 'Warlock', source: 'XPHB' } }, pact: 'Talisman' }],
		},
		{
			name: 'Agonizing Blast',
			source: 'XPHB',
			entries: ['Add your Charisma modifier to the damage.'],
			prerequisite: [
				{ spell: [{ choose: 'level=0|class=Warlock', entry: 'a Warlock Cantrip That Deals Damage', entrySummary: 'Warlock Cantrip That Deals Damage' }] },
			],
		},
	],
}

const METAMAGIC_GROUP: ClassOptionalFeatureGroup = {
	featureType: 'MM',
	name: 'Metamagic',
	count: 1,
	options: [
		{ name: 'Careful Spell', source: 'XPHB', entries: ['You can protect allies from your spell.'] },
		{ name: 'Distant Spell', source: 'XPHB', entries: ['You can double the range of a spell.'] },
	],
}

vi.mock('./optionalFeatureData', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./optionalFeatureData')>()
	return {
		...actual,
		loadClassOptionalFeatureGroups: vi.fn(async (className: string) => {
			if (className === 'Warlock') return [INVOCATION_GROUP]
			if (className === 'Sorlock') return [INVOCATION_GROUP, METAMAGIC_GROUP]
			return []
		}),
	}
})

vi.mock('../featureResolver', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../featureResolver')>()
	return { ...actual, loadResolverData: vi.fn(async () => ({ classFeatures: [], subclassFeatures: [], optionalFeatures: [], feats: [] })) }
})

afterEach(cleanup)

function renderPicker(
	overrides: Partial<Parameters<typeof ClassOptionalFeaturePicker>[0]> = {},
	onChange: (selection: OptionalFeatureSelection[]) => void = () => {},
) {
	return render(
		<ClassOptionalFeaturePicker
			className="Warlock"
			classSource="XPHB"
			subclassName={null}
			level={5}
			knownSpellNames={[]}
			damagingCantripNames={null}
			hasFightingStyleFeature={false}
			value={[]}
			onChange={onChange}
			{...overrides}
		/>,
	)
}

function checkbox(name: string): HTMLInputElement {
	return screen.getByRole('checkbox', { name }) as HTMLInputElement
}

describe('ClassOptionalFeaturePicker', () => {
	it('a class that grants nothing renders nothing', async () => {
		const { container } = renderPicker({ className: 'Fighter' })
		await waitFor(() => {
			expect(container.textContent).not.toMatch(/Loading/)
		})
		expect(container.firstChild).toBeNull()
	})

	it('renders one group per granted featureType, each with its own count', async () => {
		renderPicker({ className: 'Sorlock' })
		expect(await screen.findByRole('heading', { name: 'Eldritch Invocations' })).toBeTruthy()
		expect(screen.getByRole('heading', { name: 'Metamagic' })).toBeTruthy()
		expect(screen.getByText('Choose 2 more options.')).toBeTruthy()
		expect(screen.getByText('Choose 1 more option.')).toBeTruthy()
	})

	it('counts the two groups independently — filling one does not close the other', async () => {
		renderPicker({ className: 'Sorlock', value: [{ featureType: 'MM', choices: ['Careful Spell'] }] })
		expect(await screen.findByText('All options chosen.')).toBeTruthy()
		expect(screen.getByText('Choose 2 more options.')).toBeTruthy()
		expect(checkbox('Pact of the Blade').disabled).toBe(false)
		expect(checkbox('Distant Spell').disabled).toBe(true)
	})

	it('an ineligible option stays visible and disabled, with its reasons (D19)', async () => {
		renderPicker()
		await screen.findByText('Pact of the Blade')

		const smite = checkbox('Eldritch Smite')
		expect(smite.disabled).toBe(true)
		expect(screen.getByText('Requires the pact of the blade option.')).toBeTruthy()
	})

	it('a Talisman invocation is shown, never hidden, and says the data has no such boon', async () => {
		renderPicker()
		await screen.findByText('Bond of the Talisman')
		expect(checkbox('Bond of the Talisman').disabled).toBe(true)
		expect(screen.getByText(/this app's data does not offer/)).toBeTruthy()
	})

	it('re-evaluates as the player selects: taking Pact of the Blade unlocks Eldritch Smite', async () => {
		const user = userEvent.setup()
		const onChange = vi.fn()
		const { rerender } = renderPicker({}, onChange)
		await screen.findByText('Pact of the Blade')
		expect(checkbox('Eldritch Smite').disabled).toBe(true)

		await user.click(checkbox('Pact of the Blade'))
		expect(onChange).toHaveBeenCalledWith([{ featureType: 'EI', choices: ['Pact of the Blade'] }])

		// The caller owns the value (D8), so the unlock is verified by feeding its report back in.
		rerender(
			<ClassOptionalFeaturePicker
				className="Warlock"
				classSource="XPHB"
				subclassName={null}
				level={5}
				knownSpellNames={[]}
				damagingCantripNames={null}
				hasFightingStyleFeature={false}
				value={[{ featureType: 'EI', choices: ['Pact of the Blade'] }]}
				onChange={onChange}
			/>,
		)
		expect(checkbox('Eldritch Smite').disabled).toBe(false)
	})

	it('Agonizing Blast unlocks once the character knows a damaging cantrip', async () => {
		renderPicker({ damagingCantripNames: [] })
		await screen.findByText('Agonizing Blast')
		expect(checkbox('Agonizing Blast').disabled).toBe(true)

		cleanup()
		renderPicker({ damagingCantripNames: ['Eldritch Blast'], knownSpellNames: ['Eldritch Blast'] })
		await screen.findByText('Agonizing Blast')
		expect(checkbox('Agonizing Blast').disabled).toBe(false)
	})

	it('the removal case: a chosen option that stops qualifying stays checked and is warned about, not dropped', async () => {
		renderPicker({ value: [{ featureType: 'EI', choices: ['Eldritch Smite'] }] })
		await screen.findByText('Eldritch Smite')

		const smite = checkbox('Eldritch Smite')
		expect(smite.checked).toBe(true)
		expect(smite.disabled).toBe(false)
		expect(screen.getByText(/Eldritch Smite no longer qualifies/)).toBeTruthy()
	})

	it('cannot exceed a group’s own count', async () => {
		const user = userEvent.setup()
		const onChange = vi.fn()
		// Metamagic's count is 1 and both its options are unconditionally eligible, so a
		// refused click here is the COUNT refusing it, not a prerequisite.
		renderPicker({ className: 'Sorlock', value: [{ featureType: 'MM', choices: ['Careful Spell'] }] }, onChange)
		await screen.findByText('All options chosen.')

		const distant = checkbox('Distant Spell')
		expect(distant.disabled).toBe(true)
		await user.click(distant)
		expect(onChange).not.toHaveBeenCalled()
	})

	it('deselecting the last pick of a group drops that group’s entry entirely', async () => {
		const user = userEvent.setup()
		const onChange = vi.fn()
		renderPicker({ value: [{ featureType: 'EI', choices: ['Pact of the Blade'] }] }, onChange)
		await screen.findByText('Pact of the Blade')

		await user.click(checkbox('Pact of the Blade'))
		expect(onChange).toHaveBeenCalledWith([])
	})
})
