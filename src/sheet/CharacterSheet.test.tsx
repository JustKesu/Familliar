// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CharacterSheet } from './CharacterSheet'
import { computeAbilityScore } from '../calculation/abilityScores'
import type { ClassHitDie } from '../calculation/hitDice'
import { computeSavingThrow } from '../calculation/savingThrows'
import type { ClassSavingThrowProficiencies } from '../calculation/savingThrows'
import { computeSkill } from '../calculation/skills'
import type { SpeciesTraitsData } from '../calculation/speciesTraits'
import type { Character } from '../storage/character'

/*
 * Data loaders are stubbed rather than hitting fetch/data on disk — this
 * project's data/ is never read into context or loaded in tests directly
 * (same pattern as CharacterWizard.test.tsx).
 */

const CLASS_DATA: ClassSavingThrowProficiencies[] = [
	{ className: 'Fighter', classSource: 'XPHB', abilities: ['str', 'con'] },
	{ className: 'Rogue', classSource: 'XPHB', abilities: ['dex', 'int'] },
	{ className: 'Bard', classSource: 'XPHB', abilities: ['dex', 'cha'] },
]

const HIT_DICE_DATA: ClassHitDie[] = [
	{ className: 'Fighter', classSource: 'XPHB', faces: 10 },
	{ className: 'Rogue', classSource: 'XPHB', faces: 8 },
	{ className: 'Bard', classSource: 'XPHB', faces: 8 },
]

const SPECIES_DATA: SpeciesTraitsData[] = [
	{ name: 'Elf', source: 'XPHB', speed: 30, size: ['M'], darkvision: 60 },
	{ name: 'Human', source: 'XPHB', speed: 30, size: ['S', 'M'], darkvision: 0 },
]

vi.mock('./sheetData', () => ({
	loadSavingThrowClassData: vi.fn(async () => CLASS_DATA),
	loadFeatEffectEntries: vi.fn(async () => []),
	loadHitDiceClassData: vi.fn(async () => HIT_DICE_DATA),
	loadSpeciesTraitsData: vi.fn(async () => SPECIES_DATA),
	loadFeatTextEntries: vi.fn(async () => []),
}))

vi.mock('../featureResolver', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../featureResolver')>()
	return {
		...actual,
		loadResolverData: vi.fn(async () => ({ classFeatures: [], subclassFeatures: [], optionalFeatures: [], feats: [] })),
	}
})

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

	it('Rogue with expertise shows the expertise mark and doubled proficiency bonus on the chosen skill', async () => {
		const rogue: Character = {
			id: 'c3',
			name: 'Vex',
			classes: [{ className: 'Rogue', classSource: 'XPHB', subclass: null, level: 5 }],
			classSkills: ['stealth', 'deception'],
			expertiseSkills: ['stealth'],
			abilityScores: {
				method: 'standardArray',
				scores: { strength: 8, dexterity: 16, constitution: 12, intelligence: 13, wisdom: 10, charisma: 14 },
			},
		}
		const { container } = render(<CharacterSheet character={rogue} />)
		await screen.findByRole('heading', { name: 'Vex' })

		const expected = computeSkill('stealth', rogue)
		expect(expected.status).toBe('known')
		if (expected.status !== 'known') return

		const skillsSection = container.querySelector('.sheet__skills')
		const item = Array.from(skillsSection!.querySelectorAll('li')).find((li) => li.textContent?.includes('Stealth:'))
		expect(item?.textContent).toContain('★')
		expect(item?.textContent).toContain(expected.value.modifier >= 0 ? `+${expected.value.modifier}` : `${expected.value.modifier}`)
	})

	it('Bard with Jack of All Trades shows half proficiency on a skill with no other proficiency source', async () => {
		const bard: Character = {
			id: 'c4',
			name: 'Lyric',
			classes: [{ className: 'Bard', classSource: 'XPHB', subclass: null, level: 2 }],
			abilityScores: {
				method: 'standardArray',
				scores: { strength: 10, dexterity: 12, constitution: 12, intelligence: 13, wisdom: 8, charisma: 15 },
			},
		}
		const { container } = render(<CharacterSheet character={bard} />)
		await screen.findByRole('heading', { name: 'Lyric' })

		const skillsSection = container.querySelector('.sheet__skills')
		const item = Array.from(skillsSection!.querySelectorAll('li')).find((li) => li.textContent?.includes('Arcana:'))
		expect(item?.textContent).toContain('◐')
	})

	it('a skill with two proficiency sources counts the bonus once and names both sources in the breakdown', async () => {
		const twoSources: Character = {
			id: 'c5',
			name: 'Sable',
			classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 3 }],
			classSkills: ['perception'],
			speciesSkills: ['perception'],
			abilityScores: {
				method: 'standardArray',
				scores: { strength: 14, dexterity: 12, constitution: 13, intelligence: 10, wisdom: 15, charisma: 8 },
			},
		}
		const user = userEvent.setup()
		const { container } = render(<CharacterSheet character={twoSources} />)
		await screen.findByRole('heading', { name: 'Sable' })

		const skillsSection = container.querySelector('.sheet__skills')
		const item = Array.from(skillsSection!.querySelectorAll('li')).find((li) => li.textContent?.includes('Perception:'))
		expect(item?.textContent).toContain('●')

		const breakdownSummary = item!.querySelector('summary')!
		await user.click(breakdownSummary)
		expect(item!.textContent).toContain('class')
		expect(item!.textContent).toContain('species')

		const expected = computeSkill('perception', twoSources)
		expect(expected.status).toBe('known')
		if (expected.status === 'known') {
			expect(expected.breakdown.filter((c) => c.source.startsWith('proficiency'))).toHaveLength(1)
		}
	})

	it('a character with Alert shows a "not computed" note on initiative, not a number', async () => {
		const alertCharacter: Character = {
			id: 'c6',
			name: 'Watchful',
			classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 4 }],
			abilityScores: {
				method: 'standardArray',
				scores: { strength: 14, dexterity: 12, constitution: 13, intelligence: 10, wisdom: 10, charisma: 8 },
			},
			featAsiChoices: [{ level: 4, kind: 'feat', name: 'Alert', source: 'XPHB' }],
		}
		const user = userEvent.setup()
		const { container } = render(<CharacterSheet character={alertCharacter} />)
		await screen.findByRole('heading', { name: 'Watchful' })

		const initiativeSection = container.querySelector('.sheet__initiative')!
		await user.click(initiativeSection.querySelector('summary')!)
		expect(initiativeSection.textContent).toContain('not computed')
	})

	it('a species with an unresolved size choice shows "unresolved", never Medium', async () => {
		const undecidedSize: Character = {
			id: 'c7',
			name: 'Undecided',
			classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 1 }],
			species: { name: 'Human', source: 'XPHB' },
			abilityScores: {
				method: 'standardArray',
				scores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
			},
		}
		const { container } = render(<CharacterSheet character={undecidedSize} />)
		await screen.findByRole('heading', { name: 'Undecided' })

		const traitsSection = container.querySelector('.sheet__traits')!
		const sizeItem = Array.from(traitsSection.querySelectorAll('li')).find((li) => li.textContent?.includes('Size:'))
		expect(sizeItem?.textContent).toContain('unresolved')
		expect(sizeItem?.textContent).not.toContain('Medium')
	})
})
