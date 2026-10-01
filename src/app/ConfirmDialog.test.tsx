// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from './ConfirmDialog'

afterEach(cleanup)

function renderDialog(onSafe = vi.fn()): { onSafe: ReturnType<typeof vi.fn>; drawerEsc: ReturnType<typeof vi.fn> } {
	const drawerEsc = vi.fn()
	// Drawer.tsx listens on document the same way.
	document.addEventListener('keydown', (event) => event.key === 'Escape' && drawerEsc())
	render(
		<>
			<button type="button">Background</button>
			<ConfirmDialog title="Remove level 2?" body="Choices made at this level will be lost." safeLabel="Keep level" destructiveLabel="Remove level" onSafe={onSafe} onDestructive={() => {}} />
		</>,
	)
	return { onSafe, drawerEsc }
}

describe('ConfirmDialog (F-1)', () => {
	it('Esc takes the safe choice and never reaches a drawer listening on document', () => {
		const { onSafe, drawerEsc } = renderDialog()
		fireEvent.keyDown(document.body, { key: 'Escape' })
		expect(onSafe).toHaveBeenCalledTimes(1)
		expect(drawerEsc).not.toHaveBeenCalled()
	})

	it('a click on its text keeps focus inside, Tab cycles its buttons, and the background is inert', async () => {
		const user = userEvent.setup()
		const { onSafe } = renderDialog()
		const dialog = screen.getByRole('alertdialog')
		await user.click(screen.getByText('Choices made at this level will be lost.'))
		expect(dialog.contains(document.activeElement)).toBe(true)
		await user.tab()
		expect(dialog.contains(document.activeElement)).toBe(true)
		await user.tab()
		await user.tab()
		expect(dialog.contains(document.activeElement)).toBe(true)
		expect(screen.getByText('Background').closest('[inert]')).not.toBeNull()
		await user.keyboard('{Escape}')
		expect(onSafe).toHaveBeenCalledTimes(1)
	})
})
