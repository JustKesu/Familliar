// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { ClassFeatureChoicePicker } from './ClassFeatureChoicePicker'
import { areClassFeatureChoicesComplete, type ClassFeatureChoice } from './classFeatureChoiceData'
import type { CharacterClassFeatureChoice } from '../storage/character'

/*
 * Component test for the D21 class-feature choice picker (D8). The loader is
 * stubbed; data/ is never read here.
 */

const DIVINE_ORDER: ClassFeatureChoice = {
	featureName: 'Divine Order',
	className: 'Cleric',
	classSource: 'XPHB',
	grantedAtLevel: 1,
	count: 1,
	options: [
		{ uid: 'Protector|Cleric|XPHB|1|XPHB', name: 'Protector', entries: ['You gain Heavy armor training.'], found: true },
		{ uid: 'Thaumaturge|Cleric|XPHB|1|XPHB', name: 'Thaumaturge', entries: ['You know one extra cantrip.'], found: true },
	],
}

const PRIMAL_ORDER: ClassFeatureChoice = {
	featureName: 'Primal Order',
	className: 'Druid',
	classSource: 'XPHB',
	grantedAtLevel: 1,
	count: 1,
	options: [
		{ uid: 'Magician|Druid|XPHB|1', name: 'Magician', entries: ['You know one extra cantrip.'], found: true },
		{ uid: 'Warden|Druid|XPHB|1', name: 'Warden', entries: ['You gain Medium armor training.'], found: true },
	],
}

/** An option whose ref target has no text — the D43 branch. */
const BROKEN_CHOICE: ClassFeatureChoice = {
	featureName: 'Broken Order',
	className: 'Broken',
	classSource: 'XPHB',
	grantedAtLevel: 1,
	count: 1,
	options: [{ uid: 'Nowhere|Broken|XPHB|1|XPHB', name: 'Nowhere', entries: [], found: false }],
}

const ELEMENTAL_FURY: ClassFeatureChoice = {
	featureName: 'Elemental Fury',
	className: 'Druid',
	classSource: 'XPHB',
	grantedAtLevel: 7,
	count: 1,
	options: [
		{ uid: 'Potent Spellcasting|Druid|XPHB|7', name: 'Potent Spellcasting', entries: ['Add your Wisdom modifier.'], found: true },
		{ uid: 'Primal Strike|Druid|XPHB|7', name: 'Primal Strike', entries: ['Your attacks deal extra damage.'], found: true },
	],
}

vi.mock('./classFeatureChoiceData', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./classFeatureChoiceData')>()
	return {
		...actual,
		loadClassFeatureChoices: vi.fn(async (className: string, _classSource: string, level: number) => {
			if (className === 'Cleric') return [DIVINE_ORDER]
			if (className === 'Druid') return level >= 7 ? [PRIMAL_ORDER, ELEMENTAL_FURY] : [PRIMAL_ORDER]
			if (className === 'Broken') return [BROKEN_CHOICE]
			return []
		}),
	}
})

vi.mock('../featureResolver', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../featureResolver')>()
	return { ...actual, loadResolverData: vi.fn(async () => ({ classFeatures: [], subclassFeatures: [], optionalFeatures: [], feats: [] })) }
})

afterEach(cleanup)

function Harness({ className, level, initial = [] }: { className: string; level: number; initial?: CharacterClassFeatureChoice[] }) {
	const [value, setValue] = useState<CharacterClassFeatureChoice[]>(initial)
	return <ClassFeatureChoicePicker className={className} classSource="XPHB" level={level} value={value} onChange={setValue} />
}

describe('ClassFeatureChoicePicker', () => {
	it('offers each option with its own text (D13)', async () => {
		render(<Harness className="Cleric" level={1} />)
		await screen.findByText('Protector')
		expect(screen.getByText('You gain Heavy armor training.')).toBeTruthy()
		expect(screen.getByText('You know one extra cantrip.')).toBeTruthy()
	})

	it('records the pick with the feature, option and granted level (D22)', async () => {
		const onChange = vi.fn()
		render(<ClassFeatureChoicePicker className="Cleric" classSource="XPHB" level={1} value={[]} onChange={onChange} />)
		await screen.findByText('Thaumaturge')
		await userEvent.click(screen.getByRole('radio', { name: /Thaumaturge/ }))
		expect(onChange).toHaveBeenCalledWith([
			{ className: 'Cleric', classSource: 'XPHB', featureName: 'Divine Order', grantedAtLevel: 1, optionName: 'Thaumaturge' },
		])
	})

	it('replaces the pick for the same feature rather than accumulating', async () => {
		render(<Harness className="Cleric" level={1} />)
		await screen.findByText('Protector')
		await userEvent.click(screen.getByRole('radio', { name: /Protector/ }))
		await userEvent.click(screen.getByRole('radio', { name: /Thaumaturge/ }))
		await waitFor(() => expect(screen.getByText('Thaumaturge chosen.')).toBeTruthy())
		expect((screen.getByRole('radio', { name: /Protector/ }) as HTMLInputElement).checked).toBe(false)
	})

	/*
	 * The order-of-use failure this project has shipped twice (d5b-1's sheet fix,
	 * then the Pact of the Tome picker): a callback that rebuilds the stored
	 * object from a subset of its fields drops whatever another control already
	 * wrote. Here that means picking for the SECOND feature must not erase the
	 * first feature's pick, in either order.
	 */
	it('keeps every other feature’s pick when one feature is chosen (order-of-use regression)', async () => {
		render(<Harness className="Druid" level={7} />)
		await screen.findByText('Magician')

		await userEvent.click(screen.getByRole('radio', { name: /Magician/ }))
		await userEvent.click(screen.getByRole('radio', { name: /Primal Strike/ }))
		await waitFor(() => expect(screen.getByText('Primal Strike chosen.')).toBeTruthy())
		expect(screen.getByText('Magician chosen.')).toBeTruthy()

		// And in the opposite order — changing the EARLIER feature must not drop the later one.
		await userEvent.click(screen.getByRole('radio', { name: /Warden/ }))
		await waitFor(() => expect(screen.getByText('Warden chosen.')).toBeTruthy())
		expect(screen.getByText('Primal Strike chosen.')).toBeTruthy()
	})

	it('renders nothing for a class with no such choice', async () => {
		const { container } = render(<Harness className="Fighter" level={5} />)
		await waitFor(() => expect(container.querySelector('.class-feature-choice-picker')).toBeNull())
		expect(container.textContent).not.toContain('Loading')
	})

	it('does not offer a feature above the character’s level', async () => {
		render(<Harness className="Druid" level={6} />)
		await screen.findByText('Magician')
		expect(screen.queryByText('Potent Spellcasting')).toBeNull()
	})

	it('states the gap for an option whose text is missing rather than rendering blank (D43)', async () => {
		const { container } = render(<Harness className="Broken" level={1} />)
		await screen.findByText('Nowhere')
		expect(container.textContent).toContain('se nepodařilo dohledat')
		// Still offered — a missing description never removes the option itself.
		expect(screen.getByRole('radio', { name: /Nowhere/ })).toBeTruthy()
	})
})

describe('areClassFeatureChoicesComplete', () => {
	it('is false while a granted choice is unmade', () => {
		expect(areClassFeatureChoicesComplete([DIVINE_ORDER], [])).toBe(false)
	})

	it('is true once every granted choice has its count filled', () => {
		expect(
			areClassFeatureChoicesComplete(
				[DIVINE_ORDER],
				[{ className: 'Cleric', classSource: 'XPHB', featureName: 'Divine Order', grantedAtLevel: 1, optionName: 'Protector' }],
			),
		).toBe(true)
	})

	it('is false when only one of two granted choices is made', () => {
		expect(
			areClassFeatureChoicesComplete(
				[PRIMAL_ORDER, ELEMENTAL_FURY],
				[{ className: 'Druid', classSource: 'XPHB', featureName: 'Primal Order', grantedAtLevel: 1, optionName: 'Magician' }],
			),
		).toBe(false)
	})

	it('is vacuously true for a class with no such choice', () => {
		expect(areClassFeatureChoicesComplete([], [])).toBe(true)
	})
})
