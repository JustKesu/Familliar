// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HitPointsPicker } from './HitPointsPicker'
import { computeMaxHitPoints } from '../calculation/maxHitPoints'
import type { Character, CharacterHitPointLevel } from '../storage/character'

/*
 * Component test for the hit points wizard step (build order step 8, slice
 * 8b). Data loaders are stubbed, same as every other picker (D8) — a Fighter
 * with a d10, no bonus features, and no feats, unless a test says otherwise.
 */

vi.mock('../sheet/sheetData', () => ({
	loadHitDiceClassData: vi.fn(async () => [{ className: 'Fighter', classSource: 'XPHB', faces: 10 }]),
	loadFeatEffectEntries: vi.fn(async () => []),
}))
vi.mock('../sheet/grantedClassFeatures', () => ({
	loadGrantedClassFeatures: vi.fn(async () => []),
}))
vi.mock('../sheet/speciesTraitNames', () => ({
	loadSpeciesTraitNames: vi.fn(async () => []),
}))

afterEach(cleanup)

function fighter(level: number): Character {
	return { id: '', name: 'Aria', classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level }] }
}

describe('HitPointsPicker', () => {
	it('shows level 1 as a read-only maximum and one choice row for every level from 2 up', async () => {
		render(<HitPointsPicker character={fighter(3)} value={[]} onChange={() => {}} />)

		expect(await screen.findByText('Level 1')).toBeTruthy()
		expect(screen.getByText('10 (maximum)')).toBeTruthy()
		expect(screen.getByText('Level 2')).toBeTruthy()
		expect(screen.getByText('Level 3')).toBeTruthy()
		expect(screen.queryByText('Level 4')).toBeNull()
	})

	it('choosing the average records the PHB fixed value and marks it as an average', async () => {
		const user = userEvent.setup()
		const onChange = vi.fn()
		render(<HitPointsPicker character={fighter(2)} value={[]} onChange={onChange} />)

		await user.click(await screen.findByLabelText('Average (6)'))
		expect(onChange).toHaveBeenCalledWith([{ level: 2, kind: 'average', dieResult: 6 }])
	})

	it('rolling records a result from the class die and marks it as a roll', async () => {
		const user = userEvent.setup()
		const onChange = vi.fn()
		const random = vi.spyOn(Math, 'random').mockReturnValue(0.5) // floor(0.5 * 10) + 1 = 6
		render(<HitPointsPicker character={fighter(2)} value={[]} onChange={onChange} />)

		await user.click(await screen.findByLabelText('Roll (d10)'))
		expect(onChange).toHaveBeenCalledWith([{ level: 2, kind: 'roll', dieResult: 6 }])
		random.mockRestore()
	})

	it('rerolling replaces the previous roll for that level only', async () => {
		const user = userEvent.setup()
		const onChange = vi.fn()
		const random = vi.spyOn(Math, 'random').mockReturnValue(0.9) // floor(0.9 * 10) + 1 = 10
		const value: CharacterHitPointLevel[] = [
			{ level: 2, kind: 'roll', dieResult: 4 },
			{ level: 3, kind: 'average', dieResult: 6 },
		]
		render(<HitPointsPicker character={fighter(3)} value={value} onChange={onChange} />)

		await user.click(await screen.findByRole('button', { name: 'Reroll' }))
		expect(onChange).toHaveBeenCalledWith([
			{ level: 3, kind: 'average', dieResult: 6 },
			{ level: 2, kind: 'roll', dieResult: 10 },
		])
		random.mockRestore()
	})

	it('choosing manual entry starts at 0, and typing a value records it', async () => {
		const user = userEvent.setup()
		const onChangeInitial = vi.fn()
		render(<HitPointsPicker character={fighter(2)} value={[]} onChange={onChangeInitial} />)
		await user.click(await screen.findByLabelText('Enter manually'))
		expect(onChangeInitial).toHaveBeenCalledWith([{ level: 2, kind: 'manual', dieResult: 0 }])

		cleanup()
		const onChangeEdit = vi.fn()
		render(<HitPointsPicker character={fighter(2)} value={[{ level: 2, kind: 'manual', dieResult: 0 }]} onChange={onChangeEdit} />)
		const input = (await screen.findByLabelText('Level 2 manual result')) as HTMLInputElement
		fireEvent.change(input, { target: { value: '7' } })
		expect(onChangeEdit).toHaveBeenCalledWith([{ level: 2, kind: 'manual', dieResult: 7 }])
	})

	it('the apply-average-to-all control sets every level from 2 up in one click, overwriting any prior choice', async () => {
		const user = userEvent.setup()
		const onChange = vi.fn()
		const value: CharacterHitPointLevel[] = [{ level: 2, kind: 'roll', dieResult: 9 }]
		render(<HitPointsPicker character={fighter(4)} value={value} onChange={onChange} />)

		await user.click(await screen.findByRole('button', { name: /Use the average \(6\) for every level/ }))
		expect(onChange).toHaveBeenCalledWith([
			{ level: 2, kind: 'average', dieResult: 6 },
			{ level: 3, kind: 'average', dieResult: 6 },
			{ level: 4, kind: 'average', dieResult: 6 },
		])
	})

	/* Task instructions: the running total must come from computeMaxHitPoints itself, never a second sum written here. */
	it('shows the same running total computeMaxHitPoints would compute for the same character and choices', async () => {
		const classData = [{ className: 'Fighter', classSource: 'XPHB', faces: 10 }]
		const value: CharacterHitPointLevel[] = [
			{ level: 2, kind: 'average', dieResult: 6 },
			{ level: 3, kind: 'roll', dieResult: 8 },
		]
		const character = { ...fighter(3), abilityScores: { method: 'standardArray' as const, scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 } } }
		const expected = computeMaxHitPoints({ ...character, hitPointLevels: value }, classData, [], [])
		expect(expected.status).toBe('known')
		const expectedTotal = expected.status === 'known' ? expected.value : NaN

		render(<HitPointsPicker character={character} value={value} onChange={() => {}} />)
		expect(await screen.findByText(String(expectedTotal))).toBeTruthy()
	})
})
