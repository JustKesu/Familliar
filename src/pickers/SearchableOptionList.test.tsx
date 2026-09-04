// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { SearchableOptionList, type SearchableOption } from './SearchableOptionList'

/*
 * Behaviour of the shared picker control (D8: it never owns the selection).
 * The pickers that use it (MasteryPicker, BackgroundPicker) have their own
 * integration tests; this file exercises the control in isolation.
 */

afterEach(cleanup)

const WEAPONS = [
	{ key: 'club', name: 'Club' },
	{ key: 'rapier', name: 'Rapier' },
	{ key: 'greatsword', name: 'Greatsword' },
	{ key: 'flail', name: 'Fläil' }, // diacritic on purpose
]

function renderCount({ chosen, required }: { chosen: number; required: number }): string {
	return chosen < required ? `Choose ${required - chosen} more (${chosen}/${required}).` : `All ${required} chosen.`
}

/** A parent that owns the selection, so the control is driven exactly as in the wizard. */
function Harness({
	required = 2,
	initial = [],
	disabledKeys = {},
	mountKey = 0,
	pinSelected,
}: {
	required?: number
	initial?: string[]
	disabledKeys?: Record<string, string>
	mountKey?: number
	pinSelected?: boolean
}) {
	const [picked, setPicked] = useState<string[]>(initial)
	const options: SearchableOption[] = WEAPONS.map((weapon) => ({
		key: weapon.key,
		name: weapon.name,
		label: `${weapon.name} weapon`,
		detail: `${weapon.name} rule text`,
		selected: picked.includes(weapon.key),
		disabled: weapon.key in disabledKeys || (!picked.includes(weapon.key) && picked.length >= required),
		disabledReason: disabledKeys[weapon.key],
	}))
	return (
		<SearchableOptionList
			key={mountKey}
			legend="Weapons"
			name="weapon"
			inputType="checkbox"
			options={options}
			required={required}
			renderCount={renderCount}
			onToggle={(key) =>
				setPicked((current) =>
					current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
				)
			}
			pinSelected={pinSelected}
		/>
	)
}

async function openList(user: ReturnType<typeof userEvent.setup>): Promise<void> {
	const toggle = screen.getByRole('button', { name: /Weapons/ })
	if (toggle.getAttribute('aria-expanded') === 'false') await user.click(toggle)
}

describe('SearchableOptionList', () => {
	it('shows the required/chosen count in the player’s words, and updates it on toggle', async () => {
		const user = userEvent.setup()
		render(<Harness required={2} />)

		expect(screen.getByRole('button', { name: /Choose 2 more \(0\/2\)\./ })).toBeTruthy()

		await user.click(screen.getByRole('checkbox', { name: /Club/ }))
		expect(screen.getByRole('button', { name: /Choose 1 more \(1\/2\)\./ })).toBeTruthy()

		await user.click(screen.getByRole('checkbox', { name: /Rapier/ }))
		expect(screen.getByRole('button', { name: /All 2 chosen\./ })).toBeTruthy()
	})

	it('filters by name as the player types, case- and diacritic-insensitively', async () => {
		const user = userEvent.setup()
		render(<Harness />)
		await openList(user)

		await user.type(screen.getByLabelText('Search Weapons'), 'RAP')
		expect(screen.getByRole('checkbox', { name: /Rapier/ })).toBeTruthy()
		expect(screen.queryByRole('checkbox', { name: /Greatsword/ })).toBeNull()

		await user.clear(screen.getByLabelText('Search Weapons'))
		await user.type(screen.getByLabelText('Search Weapons'), 'flail')
		expect(screen.getByRole('checkbox', { name: /Fläil/ })).toBeTruthy()
	})

	it('never hides a selected option, even when it does not match the search', async () => {
		const user = userEvent.setup()
		render(<Harness initial={['club']} />)
		await openList(user)

		await user.type(screen.getByLabelText('Search Weapons'), 'rapier')

		const club = screen.getByRole('checkbox', { name: /Club/ }) as HTMLInputElement
		expect(club.checked).toBe(true)
		expect(screen.getByText('Selected')).toBeTruthy() // pinned section header

		// and it can still be removed — after which, no longer selected and no
		// longer matching "rapier", it correctly drops out of the filtered view.
		await user.click(club)
		expect(screen.queryByRole('checkbox', { name: /Club/ })).toBeNull()
		expect(screen.queryByText('Selected')).toBeNull()
	})

	it('pinSelected=false hides a selected option once it no longer matches the search (a browse-and-toggle list, not a fixed set of picks)', async () => {
		const user = userEvent.setup()
		render(<Harness initial={['club']} pinSelected={false} />)
		await openList(user)

		await user.type(screen.getByLabelText('Search Weapons'), 'rapier')

		expect(screen.queryByRole('checkbox', { name: /Club/ })).toBeNull()
		expect(screen.queryByText('Selected')).toBeNull()
	})

	it('clears the search text when the panel is closed and reopened', async () => {
		const user = userEvent.setup()
		render(<Harness />)
		await openList(user)

		await user.type(screen.getByLabelText('Search Weapons'), 'rapier')
		expect(screen.queryByRole('checkbox', { name: /Greatsword/ })).toBeNull()

		await user.click(screen.getByRole('button', { name: /Weapons/ })) // close
		await user.click(screen.getByRole('button', { name: /Weapons/ })) // reopen

		expect((screen.getByLabelText('Search Weapons') as HTMLInputElement).value).toBe('')
		expect(screen.getByRole('checkbox', { name: /Greatsword/ })).toBeTruthy()
	})

	it('keeps a disabled option’s reason visible, including while a search is active (D71)', async () => {
		const user = userEvent.setup()
		render(<Harness disabledKeys={{ rapier: 'Already granted by Rogue' }} />)
		await openList(user)

		expect(screen.getByText('Already granted by Rogue')).toBeTruthy()
		const rapier = screen.getByRole('checkbox', { name: /Rapier/ }) as HTMLInputElement
		expect(rapier.disabled).toBe(true)

		await user.type(screen.getByLabelText('Search Weapons'), 'rapier')
		expect(screen.getByText('Already granted by Rogue')).toBeTruthy()
	})

	it('a selection survives a search, and survives the control unmounting and remounting', async () => {
		const user = userEvent.setup()
		const { rerender } = render(<Harness mountKey={0} />)
		await openList(user)

		await user.click(screen.getByRole('checkbox', { name: /Greatsword/ }))
		await user.type(screen.getByLabelText('Search Weapons'), 'club')
		// still selected though filtered out of the "club" results
		expect((screen.getByRole('checkbox', { name: /Greatsword/ }) as HTMLInputElement).checked).toBe(true)

		// remount (as navigating away and back does): selection is held by the parent
		rerender(<Harness mountKey={1} />)
		await openList(user)
		expect((screen.getByRole('checkbox', { name: /Greatsword/ }) as HTMLInputElement).checked).toBe(true)
	})

	it('defaults open while the requirement is unmet', () => {
		render(<Harness required={1} initial={[]} />)
		expect(screen.getByRole('button', { name: /Weapons/ }).getAttribute('aria-expanded')).toBe('true')
	})

	it('defaults collapsed once the requirement is already met', () => {
		render(<Harness required={1} initial={['club']} />)
		expect(screen.getByRole('button', { name: /Weapons/ }).getAttribute('aria-expanded')).toBe('false')
	})

	it('collapsing hides the options from the page', async () => {
		const user = userEvent.setup()
		render(<Harness required={2} />)

		expect(screen.getByRole('checkbox', { name: /Club/ })).toBeTruthy()
		await user.click(screen.getByRole('button', { name: /Weapons/ }))
		expect(screen.queryByRole('checkbox', { name: /Club/ })).toBeNull()
	})

	it('reports a toggle upward and does not change its own displayed selection (D8)', async () => {
		const user = userEvent.setup()
		const onToggle = vi.fn()
		const options: SearchableOption[] = [
			{ key: 'club', name: 'Club', selected: false },
			{ key: 'rapier', name: 'Rapier', selected: true },
		]
		render(
			<SearchableOptionList
				legend="Weapons"
				name="w"
				inputType="checkbox"
				options={options}
				required={2}
				renderCount={renderCount}
				onToggle={onToggle}
				defaultOpen
			/>,
		)

		await user.click(screen.getByRole('checkbox', { name: 'Club' }))
		expect(onToggle).toHaveBeenCalledWith('club')
		// The parent never fed a new value back, so the control still shows the original.
		expect((screen.getByRole('checkbox', { name: 'Club' }) as HTMLInputElement).checked).toBe(false)
		expect(options[0].selected).toBe(false)
	})
})
