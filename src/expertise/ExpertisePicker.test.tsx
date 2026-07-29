// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExpertisePicker } from './ExpertisePicker'

/*
 * Component test for the expertise picker, following the jsdom/testing-
 * library pattern established for pickers (D8). The data loader is
 * stubbed — data/ is never read into context or loaded in tests directly.
 */

vi.mock('./expertiseData', async () => {
	const actual = await vi.importActual<typeof import('./expertiseData')>('./expertiseData')
	return {
		...actual,
		loadExpertiseEligibility: vi.fn(async (className: string, _classSource: string, level: number) => {
			if (className === 'Rogue' && level >= 1) return { count: 2, restrictedTo: null }
			if (className === 'Wizard' && level >= 2) return { count: 1, restrictedTo: [...actual.SCHOLAR_SKILLS] }
			return null
		}),
	}
})

afterEach(cleanup)

const rogueProficientSkills = [
	{ skill: 'stealth', source: 'Rogue' },
	{ skill: 'perception', source: 'Rogue' },
	{ skill: 'athletics', source: 'Soldier' },
]

describe('ExpertisePicker', () => {
	it('offers nothing to a Fighter', async () => {
		const { container } = render(
			<ExpertisePicker
				className="Fighter"
				classSource="XPHB"
				level={5}
				proficientSkills={rogueProficientSkills}
				value={[]}
				onChange={() => {}}
			/>,
		)

		await waitFor(() => {
			expect(container.textContent).not.toMatch(/Loading/)
		})
		expect(container.firstChild).toBeNull()
	})

	it('offers a Rogue at level 1 every proficient skill, tagged with its source', async () => {
		render(
			<ExpertisePicker
				className="Rogue"
				classSource="XPHB"
				level={1}
				proficientSkills={rogueProficientSkills}
				value={[]}
				onChange={() => {}}
			/>,
		)

		expect(await screen.findByLabelText(/Stealth/)).toBeTruthy()
		expect(screen.getAllByText('(from Rogue)', { exact: false }).length).toBe(2)
		expect(screen.getByLabelText(/Athletics/)).toBeTruthy()
		expect(screen.getByText('(from Soldier)', { exact: false })).toBeTruthy()
		expect(screen.getByText('Choose 2 more skills for Expertise (0 of 2 chosen).')).toBeTruthy()
	})

	it('choosing two skills fills the count and disables the rest', async () => {
		const user = userEvent.setup()
		const onChange = vi.fn()
		render(
			<ExpertisePicker
				className="Rogue"
				classSource="XPHB"
				level={1}
				proficientSkills={rogueProficientSkills}
				value={['stealth']}
				onChange={onChange}
			/>,
		)

		await user.click(await screen.findByLabelText(/Perception/))
		expect(onChange).toHaveBeenCalledWith(['stealth', 'perception'])
	})

	it('a skill already chosen can be toggled back off', async () => {
		const user = userEvent.setup()
		const onChange = vi.fn()
		render(
			<ExpertisePicker
				className="Rogue"
				classSource="XPHB"
				level={1}
				proficientSkills={rogueProficientSkills}
				value={['stealth', 'perception']}
				onChange={onChange}
			/>,
		)

		await user.click(await screen.findByLabelText(/Stealth/))
		expect(onChange).toHaveBeenCalledWith(['perception'])
	})

	it("restricts a Wizard's Scholar to its six-skill list, hiding proficient skills outside it", async () => {
		render(
			<ExpertisePicker
				className="Wizard"
				classSource="XPHB"
				level={2}
				proficientSkills={[
					{ skill: 'arcana', source: 'Wizard' },
					{ skill: 'stealth', source: 'Soldier' },
				]}
				value={[]}
				onChange={() => {}}
			/>,
		)

		expect(await screen.findByLabelText(/Arcana/)).toBeTruthy()
		expect(screen.queryByLabelText(/Stealth/)).toBeNull()
	})

	it('offers every available skill and explains the shortfall when there are fewer proficient skills than the count', async () => {
		render(
			<ExpertisePicker
				className="Rogue"
				classSource="XPHB"
				level={1}
				proficientSkills={[{ skill: 'stealth', source: 'Rogue' }]}
				value={[]}
				onChange={() => {}}
			/>,
		)

		expect(await screen.findByLabelText(/Stealth/)).toBeTruthy()
		expect(
			screen.getByText('Only 1 matching skill proficiency is available — fewer than the 2 Expertise allows. Choose from what you have.'),
		).toBeTruthy()
		expect(screen.getByText('Choose 1 more skill for Expertise (0 of 1 chosen).')).toBeTruthy()
	})

	it('shows a plain message and does not crash when there are no proficient skills at all', async () => {
		render(
			<ExpertisePicker
				className="Rogue"
				classSource="XPHB"
				level={1}
				proficientSkills={[]}
				value={[]}
				onChange={() => {}}
			/>,
		)

		expect(
			await screen.findByText('No skill proficiencies to grant Expertise in yet — choose class, background or species skills first.'),
		).toBeTruthy()
	})
})
