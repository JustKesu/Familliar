// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CharacterSheet } from './CharacterSheet'
import { computeAbilityScore } from '../calculation/abilityScores'
import { computeSavingThrow } from '../calculation/savingThrows'
import type { ClassSavingThrowProficiencies } from '../calculation/savingThrows'
import type { Character } from '../storage/character'

/*
 * Data loaders are stubbed rather than hitting fetch/data on disk — this
 * project's data/ is never read into context or loaded in tests directly
 * (same pattern as CharacterWizard.test.tsx).
 */

const CLASS_DATA: ClassSavingThrowProficiencies[] = [{ className: 'Fighter', classSource: 'XPHB', abilities: ['str', 'con'] }]

vi.mock('./sheetData', () => ({
	loadSavingThrowClassData: vi.fn(async () => CLASS_DATA),
	loadFeatEffectEntries: vi.fn(async () => []),
}))

afterEach(cleanup)

const character: Character = {
	id: 'c1',
	name: 'Aria',
	classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Champion', level: 5 }],
	species: { name: 'Elf', source: 'XPHB' },
	background: { name: 'Soldier', source: 'XPHB', skillProficiencies: ['athletics', 'intimidation'], toolProficiency: 'Gaming Set' },
	abilityScores: {
		method: 'standardArray',
		scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 8 },
	},
}

describe('CharacterSheet', () => {
	it('renders the header from the stored character', async () => {
		render(<CharacterSheet character={character} />)
		expect(await screen.findByRole('heading', { name: 'Aria' })).toBeTruthy()
		expect(screen.getByText(/Fighter 5 \(Champion\)/)).toBeTruthy()
		expect(screen.getByText('Elf')).toBeTruthy()
		expect(screen.getByText('Soldier')).toBeTruthy()
	})

	it('ability scores and modifiers match the calculation layer', async () => {
		render(<CharacterSheet character={character} />)
		await screen.findByRole('heading', { name: 'Aria' })

		const expected = computeAbilityScore('strength', character)
		expect(expected.status).toBe('known')
		if (expected.status === 'known') {
			expect(screen.getByText(`${expected.value.score} (+${expected.value.modifier})`)).toBeTruthy()
		}
	})

	it('saving throws match the calculation layer and mark proficiency', async () => {
		const { container } = render(<CharacterSheet character={character} />)
		await screen.findByRole('heading', { name: 'Aria' })

		const savesSection = container.querySelector('.sheet__saving-throws')
		expect(savesSection).not.toBeNull()

		const strengthSave = computeSavingThrow('strength', character, CLASS_DATA)
		expect(strengthSave.status).toBe('known')
		if (strengthSave.status === 'known') {
			const item = Array.from(savesSection!.querySelectorAll('li')).find((li) => li.textContent?.includes('Strength:'))
			expect(item?.textContent).toContain('●')
			expect(item?.textContent).toContain(`+${strengthSave.value}`)
		}

		// Dexterity: Fighter is not proficient (only str/con above).
		const dexItem = Array.from(savesSection!.querySelectorAll('li')).find((li) => li.textContent?.includes('Dexterity:'))
		expect(dexItem?.textContent).toContain('○')
	})

	it('breakdown starts collapsed and shows contributions once opened', async () => {
		const user = userEvent.setup()
		render(<CharacterSheet character={character} />)
		await screen.findByRole('heading', { name: 'Aria' })

		const details = screen.getAllByText('Breakdown')[0].closest('details')
		expect(details).not.toBeNull()
		expect(details?.hasAttribute('open')).toBe(false)

		await user.click(screen.getAllByText('Breakdown')[0])
		expect(details?.hasAttribute('open')).toBe(true)
		expect(details?.textContent).toContain('base')
	})

	it('shows a missing ability score as unresolved without crashing the rest of the sheet', async () => {
		const incomplete: Character = { id: 'c2', name: 'Bran', classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 3 }] }
		render(<CharacterSheet character={incomplete} />)

		expect(await screen.findByRole('heading', { name: 'Bran' })).toBeTruthy()
		expect(screen.getAllByText(/unresolved/)[0]).toBeTruthy()
		// The rest of the sheet still renders — proficiency bonus only needs classes.
		expect(screen.getByText('Proficiency bonus')).toBeTruthy()
	})
})
