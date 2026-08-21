// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { ClassOptionalFeaturePicker } from './ClassOptionalFeaturePicker'
import type { ClassOptionalFeatureGroup } from './optionalFeatureData'
import type { CharacterOptionalFeatureChoice } from '../storage/character'

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
		{ name: 'Pact of the Tome', source: 'XPHB', entries: ['Your patron gives you a grimoire.'] },
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

/*
 * Pact of the Tome's real slots (scripts/investigate-pact-of-the-tome.js), with
 * tiny candidate pools so the counts are what the test exercises, not the list
 * length. Only the loaders are stubbed — the count enforcement under test is
 * the picker's own.
 */
vi.mock('../spells/optionalFeatureSpellChoiceData', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../spells/optionalFeatureSpellChoiceData')>()
	return {
		...actual,
		loadOptionalFeatureSpellChoiceShape: vi.fn(async (optionName: string) =>
			optionName === 'Pact of the Tome'
				? { cantripSlot: { levels: [0], filter: { kind: 'any' as const }, count: 3 }, spellSlot: { levels: [1], filter: { kind: 'ritual' as const }, count: 2 } }
				: { cantripSlot: null, spellSlot: null },
		),
		loadOptionalFeatureSlotCandidates: vi.fn(async (slot: { levels: number[] }) =>
			slot.levels.includes(0)
				? [
						{ name: 'Eldritch Blast', source: 'XPHB' },
						{ name: 'Prestidigitation', source: 'XPHB' },
						{ name: 'Mage Hand', source: 'XPHB' },
						{ name: 'Minor Illusion', source: 'XPHB' },
					]
				: [
						{ name: 'Alarm', source: 'XPHB' },
						{ name: 'Comprehend Languages', source: 'XPHB' },
						{ name: 'Detect Magic', source: 'XPHB' },
					],
		),
	}
})

afterEach(cleanup)

function renderPicker(
	overrides: Partial<Parameters<typeof ClassOptionalFeaturePicker>[0]> = {},
	onChange: (selection: CharacterOptionalFeatureChoice[]) => void = () => {},
) {
	return render(
		<ClassOptionalFeaturePicker
			className="Warlock"
			classSource="XPHB"
			subclassName={null}
			level={5}
			knownSpellNames={[]}
			damagingCantripNames={null}
			damagingAttackCantripNames={null}
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
				damagingAttackCantripNames={null}
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

/*
 * Pact of the Tome's spell sub-picker (build order step 6a). Uses a controlled
 * harness rather than a bare mock, because what matters here is what SURVIVES
 * across several interactions — the d5b-1 bug was invisible to a single-call
 * assertion.
 */
function ControlledPicker({ initial, onValue }: { initial: CharacterOptionalFeatureChoice[]; onValue: (v: CharacterOptionalFeatureChoice[]) => void }) {
	const [value, setValue] = useState<CharacterOptionalFeatureChoice[]>(initial)
	return (
		<ClassOptionalFeaturePicker
			className="Warlock"
			classSource="XPHB"
			subclassName={null}
			level={5}
			knownSpellNames={[]}
			damagingCantripNames={null}
			damagingAttackCantripNames={null}
			hasFightingStyleFeature={false}
			value={value}
			onChange={(next) => {
				setValue(next)
				onValue(next)
			}}
		/>
	)
}

function tomePicks(value: CharacterOptionalFeatureChoice[]) {
	return value.find((entry) => entry.featureType === 'EI')?.spellChoices?.find((p) => p.optionName === 'Pact of the Tome')
}

describe('ClassOptionalFeaturePicker — Pact of the Tome spell sub-picker', () => {
	it('shows nothing until the option is taken, then offers both slots with their own counts', async () => {
		renderPicker()
		await screen.findByText('Pact of the Tome')
		expect(screen.queryByText('0 of 3 cantrips chosen.')).toBeNull()

		cleanup()
		render(<ControlledPicker initial={[{ featureType: 'EI', choices: ['Pact of the Tome'] }]} onValue={() => {}} />)
		expect(await screen.findByText('0 of 3 cantrips chosen.')).toBeTruthy()
		expect(screen.getByText('0 of 2 spells chosen.')).toBeTruthy()
		// The cantrip slot is unfiltered and the ritual slot is not — different candidate lists.
		expect(screen.getByRole('checkbox', { name: 'Eldritch Blast' })).toBeTruthy()
		expect(screen.getByRole('checkbox', { name: 'Alarm' })).toBeTruthy()
	})

	it('an option that grants literal spells gets no sub-picker', async () => {
		render(<ControlledPicker initial={[{ featureType: 'EI', choices: ['Pact of the Blade'] }]} onValue={() => {}} />)
		await screen.findByText('Pact of the Blade')
		await waitFor(() => expect(screen.queryByText(/cantrips chosen\./)).toBeNull())
	})

	it('enforces each slot’s count independently', async () => {
		const user = userEvent.setup()
		render(<ControlledPicker initial={[{ featureType: 'EI', choices: ['Pact of the Tome'] }]} onValue={() => {}} />)
		await screen.findByText('0 of 3 cantrips chosen.')

		await user.click(checkbox('Eldritch Blast'))
		await user.click(checkbox('Prestidigitation'))
		await user.click(checkbox('Mage Hand'))
		expect(screen.getByText('3 of 3 cantrips chosen.')).toBeTruthy()
		// Cantrip cap reached; the ritual slot is untouched by it.
		expect(checkbox('Minor Illusion').disabled).toBe(true)
		expect(checkbox('Alarm').disabled).toBe(false)

		await user.click(checkbox('Alarm'))
		await user.click(checkbox('Comprehend Languages'))
		expect(screen.getByText('2 of 2 spells chosen.')).toBeTruthy()
		expect(checkbox('Detect Magic').disabled).toBe(true)
		expect(screen.getByText('3 of 3 cantrips chosen.')).toBeTruthy()
	})

	/*
	 * The d5b-1 bug, guarded: there, a picker's OTHER callback rebuilt the stored
	 * choice from a subset of its fields and silently dropped spell picks already
	 * recorded. Spells are picked FIRST here, then the other control is used.
	 */
	it('picking the spells FIRST and then toggling another option keeps the spells', async () => {
		const user = userEvent.setup()
		let latest: CharacterOptionalFeatureChoice[] = []
		render(<ControlledPicker initial={[{ featureType: 'EI', choices: ['Pact of the Tome'] }]} onValue={(v) => (latest = v)} />)
		await screen.findByText('0 of 3 cantrips chosen.')

		await user.click(checkbox('Eldritch Blast'))
		await user.click(checkbox('Alarm'))
		expect(tomePicks(latest)?.cantrips.map((c) => c.name)).toEqual(['Eldritch Blast'])
		expect(tomePicks(latest)?.spells.map((s) => s.name)).toEqual(['Alarm'])

		// Now the OTHER control — taking a second, unrelated invocation.
		await user.click(checkbox('Pact of the Blade'))
		expect(latest.find((e) => e.featureType === 'EI')?.choices).toEqual(['Pact of the Tome', 'Pact of the Blade'])
		expect(tomePicks(latest)?.cantrips.map((c) => c.name)).toEqual(['Eldritch Blast'])
		expect(tomePicks(latest)?.spells.map((s) => s.name)).toEqual(['Alarm'])

		// And the reverse order within the sub-picker: writing one slot must not clear the other.
		await user.click(checkbox('Prestidigitation'))
		expect(tomePicks(latest)?.spells.map((s) => s.name)).toEqual(['Alarm'])
		expect(tomePicks(latest)?.cantrips.map((c) => c.name)).toEqual(['Eldritch Blast', 'Prestidigitation'])
	})

	it('deselecting Pact of the Tome drops its picks but leaves another option’s entry intact', async () => {
		const user = userEvent.setup()
		let latest: CharacterOptionalFeatureChoice[] = []
		render(
			<ControlledPicker
				initial={[
					{
						featureType: 'EI',
						choices: ['Pact of the Tome', 'Pact of the Blade'],
						spellChoices: [{ optionName: 'Pact of the Tome', cantrips: [{ name: 'Eldritch Blast', source: 'XPHB' }], spells: [] }],
					},
				]}
				onValue={(v) => (latest = v)}
			/>,
		)
		await screen.findByText('Pact of the Tome')

		await user.click(checkbox('Pact of the Tome'))
		expect(latest.find((e) => e.featureType === 'EI')?.choices).toEqual(['Pact of the Blade'])
		expect(latest.find((e) => e.featureType === 'EI')?.spellChoices).toBeUndefined()
	})
})
