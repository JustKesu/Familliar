// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LanguagePicker, type LanguageChoice } from './LanguagePicker'

vi.mock('./languageData', async () => {
	const actual = await vi.importActual<typeof import('./languageData')>('./languageData')
	return {
		...actual,
		loadLanguages: vi.fn(async () => [
			{ name: 'Draconic', source: 'XPHB' },
			{ name: 'Dwarvish', source: 'XPHB' },
			{ name: 'Elvish', source: 'XPHB' },
		]),
	}
})

afterEach(cleanup)

/** Wraps the picker with its own state, mirroring how the wizard owns `value` in real use. */
function Harness({ initial }: { initial: LanguageChoice }) {
	const [value, setValue] = useState(initial)
	return <LanguagePicker value={value} onChange={setValue} />
}

function checkbox(labelText: string): HTMLInputElement {
	return screen.getByLabelText(labelText) as HTMLInputElement
}

describe('LanguagePicker', () => {
	it('lets the player pick up to the limit, then disables the rest', async () => {
		const user = userEvent.setup()
		render(<Harness initial={[]} />)

		await user.click(await screen.findByLabelText('Draconic (XPHB)'))
		await user.click(screen.getByLabelText('Dwarvish (XPHB)'))

		expect(checkbox('Draconic (XPHB)').checked).toBe(true)
		expect(checkbox('Dwarvish (XPHB)').checked).toBe(true)
		expect(checkbox('Elvish (XPHB)').disabled).toBe(true)
	})

	it('re-enables a third option once one of the two is deselected', async () => {
		const user = userEvent.setup()
		render(<Harness initial={[]} />)

		await user.click(await screen.findByLabelText('Draconic (XPHB)'))
		await user.click(screen.getByLabelText('Dwarvish (XPHB)'))
		expect(checkbox('Elvish (XPHB)').disabled).toBe(true)

		await user.click(screen.getByLabelText('Draconic (XPHB)'))
		expect(checkbox('Elvish (XPHB)').disabled).toBe(false)
	})

	it('does not offer Common as a selectable checkbox', async () => {
		render(<Harness initial={[]} />)
		await screen.findByLabelText('Draconic (XPHB)')
		expect(screen.queryByRole('checkbox', { name: /Common/ })).toBeNull()
	})
})
