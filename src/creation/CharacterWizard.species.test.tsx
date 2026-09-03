// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CharacterWizard } from './CharacterWizard'
import type { CharacterStore } from '../storage/characterStore'

/*
 * The species step's own gates (D81/D82): the species list offers species, not
 * variants, and the step does not complete until every choice the species
 * carries — its variant and its skill proficiencies — has been made.
 *
 * A separate file from CharacterWizard.test.tsx because it needs a species
 * fixture with families in it, where that file's suite deliberately walks
 * through a species that carries no choice at all. Only the class panel's
 * loaders and the species ones are stubbed; later steps are never reached.
 */

vi.mock('../classes/classData', () => ({
	loadBaseClasses: vi.fn(async () => [{ name: 'Fighter', source: 'XPHB', hd: { number: 1, faces: 10 } }]),
}))

/**
 * The real grouping runs over a raw species.json-shaped fixture, so what these
 * tests exercise is the code the app runs, not a hand-grouped list. The four
 * cases are cut from what scripts/investigate-species-families.js found: a
 * name-prefixed family whose parent also carries an unresolved choice (Elf), a
 * field-linked one (Genasi), a prose-only one (Goliath — no unresolved choice
 * anywhere, so only the family itself forces the pick), and a species with no
 * family at all (Dwarf).
 */
vi.mock('../species/speciesData', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../species/speciesData')>()
	const raw = [
		{ name: 'Elf', source: 'XPHB', entries: [{ name: 'Elven Lineage', entries: ['Drow, High Elf or Wood Elf.'] }] },
		{ name: 'Elf; Drow Lineage', source: 'XPHB' },
		{ name: 'Elf; High Elf Lineage', source: 'XPHB' },
		{ name: 'Elf; Wood Elf Lineage', source: 'XPHB' },
		{ name: 'Genasi', source: 'MPMM', entries: [{ name: 'Darkvision', entries: ['60 feet.'] }] },
		{ name: 'Air', source: 'MPMM', raceName: 'Genasi', raceSource: 'MPMM' },
		{ name: 'Earth', source: 'MPMM', raceName: 'Genasi', raceSource: 'MPMM' },
		{ name: 'Goliath', source: 'XPHB', entries: [{ name: 'Giant Ancestry', entries: ['Cloud Giant or Fire Giant.'] }] },
		{ name: 'Goliath; Cloud Giant Ancestry', source: 'XPHB' },
		{ name: 'Goliath; Fire Giant Ancestry', source: 'XPHB' },
		{ name: 'Dwarf', source: 'XPHB' },
	]
	return { ...actual, loadSpeciesOptions: vi.fn(async () => actual.extractSpeciesOptions(raw)) }
})

/** Only Elf offers a skill choice here; the lineage records carry the same choice their parent does, as the real data does. */
vi.mock('../speciesSkills/speciesSkillData', () => ({
	loadSpeciesSkillProficiencies: vi.fn(async (speciesName: string) => {
		if (speciesName.startsWith('Elf')) return { kind: 'choice', count: 1, options: ['insight', 'perception', 'survival'] }
		return null
	}),
}))

vi.mock('../classSkills/classSkillData', async (importOriginal) => ({
	...(await importOriginal<typeof import('../classSkills/classSkillData')>()),
	loadClassSkillChoice: vi.fn(async () => ({ count: 2, options: ['athletics', 'intimidation'] })),
}))

vi.mock('../masteries/masteryData', () => ({
	MASTERY_DESCRIPTIONS: {},
	loadMasteryCountFor: vi.fn(async () => 0),
	loadMasteryWeaponsFor: vi.fn(async () => []),
}))

vi.mock('../fightingStyle/fightingStyleData', () => ({
	loadFightingStyleGrantLevel: vi.fn(async () => null),
	fightingStyleOptions: vi.fn(async () => []),
}))

vi.mock('../subclass/subclassData', () => ({
	loadSubclassLevelFor: vi.fn(async () => 3),
	loadSubclassesFor: vi.fn(async () => []),
}))

vi.mock('../expertise/expertiseData', async (importOriginal) => ({
	...(await importOriginal<typeof import('../expertise/expertiseData')>()),
	loadExpertiseEligibility: vi.fn(async () => null),
}))

vi.mock('../featAsi/featAsiData', async (importOriginal) => ({
	...(await importOriginal<typeof import('../featAsi/featAsiData')>()),
	loadFeatAsiGrants: vi.fn(async () => []),
	loadFeats: vi.fn(async () => []),
	loadClassPrereqInfo: vi.fn(async () => ({ armorProficiencies: [], weaponProficiencies: [], hasSpellcasting: false })),
	loadHasFightingStyleFeature: vi.fn(async () => false),
	loadSpeciesPrereqInfo: vi.fn(async () => null),
}))

afterEach(cleanup)

function renderWizard() {
	const store = { create: vi.fn(() => ({ id: 'x', name: 'Aria', classes: [] })) } as unknown as CharacterStore
	render(<CharacterWizard store={store} onSaved={vi.fn()} onCancel={vi.fn()} />)
}

async function reachSpeciesStep(user: ReturnType<typeof userEvent.setup>) {
	await user.type(screen.getByLabelText('Character name'), 'Aria')
	await user.selectOptions(await screen.findByLabelText('Class'), 'Fighter')
	await user.click(screen.getByRole('button', { name: 'Next' }))
	await screen.findByLabelText('Species')
}

function nextButton(): HTMLButtonElement {
	return screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement
}

function speciesOptionTexts(): string[] {
	return [...(screen.getByLabelText('Species') as HTMLSelectElement).options].map((option) => option.textContent ?? '')
}

describe('CharacterWizard — the species list offers species, not variants', () => {
	it('lists a name-prefixed family once and offers its lineage as a second choice', async () => {
		const user = userEvent.setup()
		renderWizard()
		await reachSpeciesStep(user)

		expect(speciesOptionTexts()).not.toContain('Elf; Drow Lineage (XPHB)')
		expect(speciesOptionTexts().filter((text) => text.startsWith('Elf'))).toEqual(['Elf (XPHB)'])

		await user.selectOptions(screen.getByLabelText('Species'), 'Elf (XPHB)')

		const lineage = (await screen.findByLabelText('Elven Lineage')) as HTMLSelectElement
		expect([...lineage.options].map((option) => option.textContent)).toEqual([
			'Choose Elven Lineage…',
			'Drow',
			'High Elf',
			'Wood Elf',
		])
	})

	it('lists a field-linked family (Genasi, whose variants store only "Air") once, with its elements as the choice', async () => {
		const user = userEvent.setup()
		renderWizard()
		await reachSpeciesStep(user)

		expect(speciesOptionTexts()).toContain('Genasi (MPMM)')
		expect(speciesOptionTexts()).not.toContain('Genasi; Air (MPMM)')

		await user.selectOptions(screen.getByLabelText('Species'), 'Genasi (MPMM)')

		const lineage = (await screen.findByLabelText('Lineage')) as HTMLSelectElement
		expect([...lineage.options].map((option) => option.textContent)).toEqual(['Choose Lineage…', 'Air', 'Earth'])
	})

	it('offers the choice for a prose-only family too, where no field is left unresolved', async () => {
		const user = userEvent.setup()
		renderWizard()
		await reachSpeciesStep(user)

		await user.selectOptions(screen.getByLabelText('Species'), 'Goliath (XPHB)')

		const ancestry = (await screen.findByLabelText('Giant Ancestry')) as HTMLSelectElement
		expect([...ancestry.options].map((option) => option.textContent)).toEqual([
			'Choose Giant Ancestry…',
			'Cloud Giant',
			'Fire Giant',
		])
	})

	it('shows no second choice for a species that has no family, and completes on the species alone', async () => {
		const user = userEvent.setup()
		renderWizard()
		await reachSpeciesStep(user)

		await user.selectOptions(screen.getByLabelText('Species'), 'Dwarf (XPHB)')

		expect(screen.queryByLabelText(/Lineage|Ancestry/)).toBeNull()
		expect(nextButton().disabled).toBe(false)
	})
})

describe('CharacterWizard — the species step waits for every species choice', () => {
	it('refuses to advance until the lineage is chosen, naming what is missing', async () => {
		const user = userEvent.setup()
		renderWizard()
		await reachSpeciesStep(user)

		await user.selectOptions(screen.getByLabelText('Species'), 'Goliath (XPHB)')
		expect(nextButton().disabled).toBe(true)
		expect(screen.getByText('Choose your Giant Ancestry to continue.')).toBeTruthy()

		await user.selectOptions(await screen.findByLabelText('Giant Ancestry'), 'Fire Giant')
		expect(nextButton().disabled).toBe(false)
	})

	it('refuses to advance until the species skill is chosen', async () => {
		const user = userEvent.setup()
		renderWizard()
		await reachSpeciesStep(user)

		await user.selectOptions(screen.getByLabelText('Species'), 'Elf (XPHB)')
		await user.selectOptions(await screen.findByLabelText('Elven Lineage'), 'Drow')

		// The lineage is settled, so only the skill is outstanding.
		expect(await screen.findByLabelText('Perception')).toBeTruthy()
		expect(nextButton().disabled).toBe(true)

		await user.click(screen.getByLabelText('Perception'))
		expect(nextButton().disabled).toBe(false)
	})

	it('keeps the skill picker back until the lineage is settled, since the lineage carries its own skills', async () => {
		const user = userEvent.setup()
		renderWizard()
		await reachSpeciesStep(user)

		await user.selectOptions(screen.getByLabelText('Species'), 'Elf (XPHB)')
		await screen.findByLabelText('Elven Lineage')

		expect(screen.queryByLabelText('Perception')).toBeNull()
	})

	it('remembers the species while the lineage is still outstanding, and clearing the lineage keeps the species', async () => {
		const user = userEvent.setup()
		renderWizard()
		await reachSpeciesStep(user)

		await user.selectOptions(screen.getByLabelText('Species'), 'Genasi (MPMM)')
		await user.selectOptions(await screen.findByLabelText('Lineage'), 'Air')
		expect(nextButton().disabled).toBe(false)

		await user.selectOptions(screen.getByLabelText('Lineage'), '')

		expect((screen.getByLabelText('Species') as HTMLSelectElement).value).toBe('Genasi|MPMM')
		expect(nextButton().disabled).toBe(true)
	})
})
