// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OptionalFeaturePicker } from './OptionalFeaturePicker'

/*
 * Component test for the general optionalfeatureProgression picker,
 * following the jsdom/testing-library pattern established for pickers (D8).
 * The data loader is stubbed — data/ is never read into context or loaded in
 * tests directly.
 */

function maneuverOptions(count: number) {
	return Array.from({ length: count }, (_, i) => ({
		name: `Maneuver ${i + 1}`,
		source: 'XPHB',
		entries: [`Description of maneuver ${i + 1}.`],
	}))
}

const BATTLE_MASTER_OPTIONS = maneuverOptions(23)
const FIGHTING_STYLE_OPTIONS = Array.from({ length: 10 }, (_, i) => ({
	name: `Fighting Style ${i + 1}`,
	source: 'XPHB',
	entries: [`Description of fighting style ${i + 1}.`],
}))

vi.mock('./optionalFeatureData', async () => {
	const actual = await vi.importActual<typeof import('./optionalFeatureData')>('./optionalFeatureData')
	return {
		...actual,
		loadOptionalFeatureChoicesFor: vi.fn(
			async (className: string, _classSource: string, subclassName: string, _subclassSource: string, level: number) => {
				if (className === 'Fighter' && subclassName === 'Battle Master') {
					if (level < 3) return null
					const count = level >= 15 ? 9 : level >= 10 ? 7 : level >= 7 ? 5 : 3
					return { featureType: 'MV:B', count, options: BATTLE_MASTER_OPTIONS }
				}
				if (className === 'Bard' && subclassName === 'College of Swords') {
					if (level < 3) return null
					return { featureType: 'FS:B', count: 1, options: FIGHTING_STYLE_OPTIONS }
				}
				if (className === 'Fighter' && subclassName === 'Champion') {
					return null
				}
				return null
			},
		),
	}
})

afterEach(cleanup)

describe('OptionalFeaturePicker', () => {
	it('a level 3 Battle Master gets 3 picks from 23 maneuvers', async () => {
		render(
			<OptionalFeaturePicker
				className="Fighter"
				classSource="XPHB"
				subclassName="Battle Master"
				subclassSource="XPHB"
				level={3}
				value={[]}
				onChange={() => {}}
			/>,
		)

		expect(await screen.findByText('Maneuver 1')).toBeTruthy()
		expect(screen.getByText('Maneuver 23')).toBeTruthy()
		expect(screen.getAllByRole('checkbox')).toHaveLength(23)
		expect(screen.getByText('Choose 3 more options.')).toBeTruthy()
	})

	it('the count rises at a higher level', async () => {
		render(
			<OptionalFeaturePicker
				className="Fighter"
				classSource="XPHB"
				subclassName="Battle Master"
				subclassSource="XPHB"
				level={7}
				value={['Maneuver 1', 'Maneuver 2', 'Maneuver 3']}
				onChange={() => {}}
			/>,
		)

		expect(await screen.findByText('Choose 2 more options.')).toBeTruthy()
	})

	it('a subclass with no progression renders nothing', async () => {
		const { container } = render(
			<OptionalFeaturePicker
				className="Fighter"
				classSource="XPHB"
				subclassName="Champion"
				subclassSource="XPHB"
				level={10}
				value={[]}
				onChange={() => {}}
			/>,
		)

		await waitFor(() => {
			expect(container.textContent).not.toMatch(/Loading/)
		})
		expect(container.firstChild).toBeNull()
	})

	it('College of Swords is offered 10 fighting styles', async () => {
		render(
			<OptionalFeaturePicker
				className="Bard"
				classSource="XPHB"
				subclassName="College of Swords"
				subclassSource="XGE"
				level={3}
				value={[]}
				onChange={() => {}}
			/>,
		)

		await screen.findByText('Fighting Style 1')
		expect(screen.getAllByRole('checkbox')).toHaveLength(10)
	})

	it('cannot exceed the count', async () => {
		const user = userEvent.setup()
		const onChange = vi.fn()
		render(
			<OptionalFeaturePicker
				className="Fighter"
				classSource="XPHB"
				subclassName="Battle Master"
				subclassSource="XPHB"
				level={3}
				value={['Maneuver 1', 'Maneuver 2', 'Maneuver 3']}
				onChange={onChange}
			/>,
		)

		await screen.findByText('All options chosen.')
		const fourth = screen.getByRole('checkbox', { name: 'Maneuver 4' }) as HTMLInputElement
		expect(fourth.disabled).toBe(true)
		await user.click(fourth)
		expect(onChange).not.toHaveBeenCalled()
	})

	it('renders whatever value it is given', async () => {
		render(
			<OptionalFeaturePicker
				className="Fighter"
				classSource="XPHB"
				subclassName="Battle Master"
				subclassSource="XPHB"
				level={3}
				value={['Maneuver 5', 'Maneuver 9']}
				onChange={() => {}}
			/>,
		)

		await waitFor(() => {
			const five = screen.getByRole('checkbox', { name: 'Maneuver 5' }) as HTMLInputElement
			expect(five.checked).toBe(true)
		})
		const nine = screen.getByRole('checkbox', { name: 'Maneuver 9' }) as HTMLInputElement
		const one = screen.getByRole('checkbox', { name: 'Maneuver 1' }) as HTMLInputElement
		expect(nine.checked).toBe(true)
		expect(one.checked).toBe(false)
	})
})
