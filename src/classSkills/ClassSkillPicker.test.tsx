// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ClassSkillPicker } from './ClassSkillPicker'

/*
 * Component test for the class skill picker, following the jsdom/testing-
 * library pattern established for pickers (D8). The data loader is
 * stubbed — data/ is never read into context or loaded in tests directly.
 * No jest-dom dependency, matching CharacterWizard.test.tsx: assertions
 * read plain DOM/element properties instead of custom matchers.
 */

vi.mock('./classSkillData', async () => {
	const actual = await vi.importActual<typeof import('./classSkillData')>('./classSkillData')
	return {
		...actual,
		loadClassSkillChoice: vi.fn(async (className: string) => {
			if (className === 'Bard') {
				return { count: 3, options: [...actual.ALL_SKILLS] }
			}
			return {
				count: 2,
				options: ['animal handling', 'athletics', 'intimidation', 'nature', 'perception', 'survival'],
			}
		}),
	}
})

afterEach(cleanup)

describe('ClassSkillPicker', () => {
	it("shows the class's options and pick count", async () => {
		render(<ClassSkillPicker className="Barbarian" classSource="XPHB" value={[]} onChange={() => {}} />)

		expect(await screen.findByText('Athletics')).toBeTruthy()
		expect(screen.getByText('Survival')).toBeTruthy()
		expect(screen.getByText(/Choose 2 more skills/)).toBeTruthy()
	})

	it('returns the full 18-skill list for an "any" class', async () => {
		render(<ClassSkillPicker className="Bard" classSource="XPHB" value={[]} onChange={() => {}} />)

		expect(await screen.findByText('Acrobatics')).toBeTruthy()
		expect(screen.getByText('Stealth')).toBeTruthy()
		expect(screen.getByText(/Choose 3 more skills/)).toBeTruthy()
	})

	it('cannot select more skills than the class allows', async () => {
		const user = userEvent.setup()
		const onChange = vi.fn()
		render(
			<ClassSkillPicker
				className="Barbarian"
				classSource="XPHB"
				value={['athletics', 'survival']}
				onChange={onChange}
			/>,
		)

		await screen.findByText('Athletics')
		expect(screen.getByText('All 2 skills chosen.')).toBeTruthy()

		const nature = screen.getByRole('checkbox', { name: /Nature/ }) as HTMLInputElement
		expect(nature.disabled).toBe(true)
		await user.click(nature)
		expect(onChange).not.toHaveBeenCalled()
	})

	it('shows a disabled skill but does not let it be selected', async () => {
		const user = userEvent.setup()
		const onChange = vi.fn()
		render(
			<ClassSkillPicker
				className="Barbarian"
				classSource="XPHB"
				value={[]}
				onChange={onChange}
				disabledSkills={[{ skill: 'athletics', source: 'Soldier background' }]}
			/>,
		)

		await screen.findByText('Athletics')
		expect(screen.getByText(/already granted by Soldier background/)).toBeTruthy()

		const athletics = screen.getByRole('checkbox', { name: /Athletics/ }) as HTMLInputElement
		expect(athletics.disabled).toBe(true)
		await user.click(athletics)
		expect(onChange).not.toHaveBeenCalled()
	})

	it('renders whatever value it is given', async () => {
		render(
			<ClassSkillPicker
				className="Barbarian"
				classSource="XPHB"
				value={['athletics']}
				onChange={() => {}}
			/>,
		)

		await waitFor(() => {
			const athletics = screen.getByRole('checkbox', { name: /Athletics/ }) as HTMLInputElement
			expect(athletics.checked).toBe(true)
		})
		const nature = screen.getByRole('checkbox', { name: /Nature/ }) as HTMLInputElement
		expect(nature.checked).toBe(false)
	})
})
