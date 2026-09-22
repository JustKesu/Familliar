// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Drawer, DrawerRow, DrawerSection } from './Drawer'

/* R4 (D163). The panels are tested where they render (CharacterSheet.test.tsx); this covers the shell and its two blocks. */

afterEach(cleanup)

describe('Drawer (D146/D163)', () => {
	it('names itself by its title and closes on × and on Esc', async () => {
		const user = userEvent.setup()
		const onClose = vi.fn()
		render(
			<Drawer title="Senses" onClose={onClose}>
				<p>panel</p>
			</Drawer>,
		)

		expect(screen.getByRole('dialog', { name: 'Senses' })).toBeTruthy()

		await user.click(screen.getByRole('button', { name: 'Close' }))
		await user.keyboard('{Escape}')
		expect(onClose).toHaveBeenCalledTimes(2)
	})

	it('stops listening for Esc once it is gone', async () => {
		const user = userEvent.setup()
		const onClose = vi.fn()
		const { unmount } = render(
			<Drawer title="Senses" onClose={onClose}>
				<p>panel</p>
			</Drawer>,
		)

		unmount()
		await user.keyboard('{Escape}')
		expect(onClose).not.toHaveBeenCalled()
	})

	it('opens a section by default and collapses it on click; a row starts collapsed and expands', async () => {
		const user = userEvent.setup()
		render(
			<Drawer title="Senses" onClose={vi.fn()}>
				<DrawerSection title="Passive Perception">
					<p>section body</p>
				</DrawerSection>
				<DrawerRow label="Elf">
					<p>row body</p>
				</DrawerRow>
			</Drawer>,
		)

		const section = screen.getByText('Passive Perception').closest('details')!
		const row = screen.getByText('Elf').closest('details')!
		expect(section.hasAttribute('open')).toBe(true)
		expect(row.hasAttribute('open')).toBe(false)

		await user.click(screen.getByText('Passive Perception'))
		await user.click(screen.getByText('Elf'))
		expect(section.hasAttribute('open')).toBe(false)
		expect(row.hasAttribute('open')).toBe(true)
	})
})
