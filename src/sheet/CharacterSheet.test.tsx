// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CharacterSheet } from './CharacterSheet'
import { computeAbilityScore } from '../calculation/abilityScores'
import type { ClassHitDie } from '../calculation/hitDice'
import { computeSavingThrow, computeSavingThrows } from '../calculation/savingThrows'
import type { ClassSavingThrowProficiencies } from '../calculation/savingThrows'
import { computeSkill } from '../calculation/skills'
import type { ClassSpellcastingAbility } from '../calculation/spellcasting'
import type { ClassSpellSlotsData } from '../calculation/spellSlots'
import type { SpeciesTraitsData } from '../calculation/speciesTraits'
import { loadSpellcastingAbilityClassData, loadSubclassSource } from './sheetData'
import { loadSpellSlotsClassData } from '../spells/spellSlotsClassData'
import { loadSpellDetails, type SpellDetail } from '../spells/spellDetailData'
import { loadSubclassAlwaysPreparedSpells, type AlwaysPreparedSpell } from '../spells/subclassPreparedSpells'
import { loadSubclassChosenSpells } from '../spells/subclassSpellChoiceData'
import { loadFeatGrantedSpells, type FeatGrantedSpell } from '../spells/featSpells'
import { loadOptionalFeatureGrantedSpells, type OptionalFeatureGrantedSpell } from '../spells/optionalFeatureSpells'
import type { Character } from '../storage/character'
import { loadGrantedSenses, type GrantedSense } from './grantedSenses'
import { loadResolverData } from '../featureResolver'
import { loadBeasts, type Beast } from '../beasts/beastData'

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

vi.mock('../calculation/savingThrows', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../calculation/savingThrows')>()
	return { ...actual, computeSavingThrows: vi.fn(actual.computeSavingThrows) }
})

vi.mock('./sheetData', () => ({
	loadSavingThrowClassData: vi.fn(async () => CLASS_DATA),
	loadFeatEffectEntries: vi.fn(async () => []),
	loadHitDiceClassData: vi.fn(async () => HIT_DICE_DATA),
	loadSpeciesTraitsData: vi.fn(async () => SPECIES_DATA),
	loadFeatTextEntries: vi.fn(async () => []),
	loadSpellcastingAbilityClassData: vi.fn(async () => []),
	loadSubclassSource: vi.fn(async () => null),
}))

vi.mock('../spells/spellSlotsClassData', () => ({
	loadSpellSlotsClassData: vi.fn(async () => []),
}))

vi.mock('../spells/spellDetailData', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../spells/spellDetailData')>()
	return { ...actual, loadSpellDetails: vi.fn(async () => []) }
})

vi.mock('../spells/subclassPreparedSpells', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../spells/subclassPreparedSpells')>()
	return { ...actual, loadSubclassAlwaysPreparedSpells: vi.fn(async () => []) }
})

vi.mock('../spells/subclassSpellChoiceData', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../spells/subclassSpellChoiceData')>()
	return { ...actual, loadSubclassChosenSpells: vi.fn(async () => []) }
})

vi.mock('../spells/featSpells', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../spells/featSpells')>()
	return { ...actual, loadFeatGrantedSpells: vi.fn(async () => []) }
})

vi.mock('../spells/optionalFeatureSpells', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../spells/optionalFeatureSpells')>()
	return { ...actual, loadOptionalFeatureGrantedSpells: vi.fn(async () => []) }
})

vi.mock('./grantedSenses', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./grantedSenses')>()
	return { ...actual, loadGrantedSenses: vi.fn(async () => []) }
})

/* Only the fetch is stubbed — findFamiliarBeasts and hasFindFamiliar stay real, so the section is proved against the actual filter. */
vi.mock('../beasts/beastData', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../beasts/beastData')>()
	return { ...actual, loadBeasts: vi.fn(async () => []) }
})

vi.mock('../optionalFeatures/optionalFeatureData', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../optionalFeatures/optionalFeatureData')>()
	return {
		...actual,
		loadChosenClassOptionalFeatures: vi.fn(
			async (classes: { className: string }[], selection: { featureType: string; choices: string[] }[]) => {
				const chosen = classes.some((c) => c.className === 'Warlock') ? (selection.find((s) => s.featureType === 'EI')?.choices ?? []) : []
				if (chosen.length === 0) return []
				return [
					{
						featureType: 'EI',
						name: 'Eldritch Invocations',
						options: chosen.map((name) => ({ name, source: 'XPHB', entries: [`${name} does something useful.`] })),
					},
				]
			},
		),
	}
})

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
			expect(item?.textContent).toContain(`+${strengthSave.value.modifier}`)
		}

		// Dexterity: Fighter is not proficient (only str/con above).
		const dexItem = Array.from(savesSection!.querySelectorAll('li')).find((li) => li.textContent?.includes('Dexterity:'))
		expect(dexItem?.textContent).toContain('○')
	})

	it('D60: a save whose breakdown carries a note but no proficiency source still shows the "none" mark, not a proficiency dot inferred from breakdown length', async () => {
		vi.mocked(computeSavingThrows).mockImplementationOnce((char, classData, feats) => {
			const real = computeSavingThrow('dexterity', char, classData, feats)
			if (real.status !== 'known') throw new Error('fixture expects a known dexterity save')
			return {
				strength: computeSavingThrow('strength', char, classData, feats),
				dexterity: {
					status: 'known',
					value: real.value,
					breakdown: [...real.breakdown, { source: 'feat (Test Note Feat)', amount: 0, note: 'effect not computed (D55/D58 style)' }],
				},
				constitution: computeSavingThrow('constitution', char, classData, feats),
				intelligence: computeSavingThrow('intelligence', char, classData, feats),
				wisdom: computeSavingThrow('wisdom', char, classData, feats),
				charisma: computeSavingThrow('charisma', char, classData, feats),
			}
		})

		const { container } = render(<CharacterSheet character={character} />)
		await screen.findByRole('heading', { name: 'Aria' })

		const savesSection = container.querySelector('.sheet__saving-throws')!
		const dexItem = Array.from(savesSection.querySelectorAll('li')).find((li) => li.textContent?.includes('Dexterity:'))
		expect(dexItem?.textContent).toContain('○')
		expect(dexItem?.textContent).not.toContain('●')
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

	function spellDetail(overrides: Partial<SpellDetail> & { name: string; source: string; level: number }): SpellDetail {
		return {
			ritual: false,
			concentration: false,
			time: [{ number: 1, unit: 'action' }],
			range: { type: 'point', distance: { type: 'feet', amount: 30 } },
			components: { v: true, s: true },
			duration: [{ type: 'instant' }],
			entries: ['A test spell description.'],
			entriesHigherLevel: [],
			scalingLevelDice: [],
			damageInflict: [],
			...overrides,
		}
	}

	// Build order step 6a slice 2 — the display half. A picker that stores a
	// choice the sheet never renders has happened repeatedly here (d5b-1, d6b).
	describe('class-level optional features', () => {
		const warlock: Character = {
			id: 'w1',
			name: 'Kesu',
			classes: [{ className: 'Warlock', classSource: 'XPHB', subclass: null, level: 5 }],
			optionalFeatureChoices: [{ featureType: 'EI', choices: ['Agonizing Blast', 'Devil’s Sight'] }],
		}

		it('renders each chosen invocation by name, under the progression’s own heading', async () => {
			render(<CharacterSheet character={warlock} />)
			await screen.findByRole('heading', { name: 'Kesu' })

			expect(await screen.findByRole('heading', { name: 'Eldritch Invocations' })).toBeTruthy()
			expect(screen.getByText('Agonizing Blast')).toBeTruthy()
			expect(screen.getByText('Devil’s Sight')).toBeTruthy()
		})

		it('the text is collapsed behind a details element and expands on click', async () => {
			const user = userEvent.setup()
			const { container } = render(<CharacterSheet character={warlock} />)
			await screen.findByRole('heading', { name: 'Eldritch Invocations' })

			const details = container.querySelector('.sheet__class-optional-features details') as HTMLDetailsElement
			expect(details.open).toBe(false)
			await user.click(screen.getByText('Agonizing Blast'))
			expect(details.open).toBe(true)
			expect(screen.getByText(/Agonizing Blast does something useful/)).toBeTruthy()
		})

		it('a character with no class-level picks renders no heading at all', async () => {
			const { container } = render(<CharacterSheet character={character} />)
			await screen.findByRole('heading', { name: 'Aria' })
			expect(container.querySelector('.sheet__class-optional-features')).toBeNull()
		})
	})

	/*
	 * Build order step 6a, final piece (closes 6a): senses granted by a chosen
	 * optional feature (an invocation) and by a chosen feat. Asserted end to
	 * end for the same reason the invocation-spell tests above are — a stored
	 * pick that never reaches the sheet has happened more than once in this
	 * project.
	 */
	describe('granted senses (step 6a, final piece)', () => {
		afterEach(() => {
			vi.mocked(loadGrantedSenses).mockReset().mockResolvedValue([])
		})

		it('a sense granted by a chosen invocation renders under a "Senses" section, named "from invocation (...)"', async () => {
			const granted: GrantedSense[] = [{ senseType: 'truesight', range: 30, origin: 'optionalFeature', name: 'Devil’s Sight' }]
			vi.mocked(loadGrantedSenses).mockResolvedValue(granted)

			const warlock: Character = {
				id: 'w2',
				name: 'Sighted Warlock',
				classes: [{ className: 'Warlock', classSource: 'XPHB', subclass: null, level: 5 }],
				optionalFeatureChoices: [{ featureType: 'EI', choices: ['Devil’s Sight'] }],
			}

			const { container } = render(<CharacterSheet character={warlock} />)
			await screen.findByRole('heading', { name: 'Sighted Warlock' })

			const sensesSection = container.querySelector('.sheet__senses')!
			expect(sensesSection).toBeTruthy()
			await waitFor(() => expect(sensesSection.textContent).toContain('Truesight'))
			expect(sensesSection.textContent).toContain('30 ft.')
			expect(sensesSection.textContent).toContain('from invocation (Devil’s Sight)')

			// The loader is stubbed above, so assert the sheet actually hands it the character (and thus its
			// stored picks) — otherwise a mis-wired argument would still render green here.
			expect(vi.mocked(loadGrantedSenses)).toHaveBeenCalledWith(expect.objectContaining({ optionalFeatureChoices: warlock.optionalFeatureChoices }))
		})

		it('a sense granted by a chosen feat renders "from feat (...)"', async () => {
			const granted: GrantedSense[] = [{ senseType: 'blindsight', range: 10, origin: 'feat', name: 'Skulker' }]
			vi.mocked(loadGrantedSenses).mockResolvedValue(granted)

			const rogue: Character = {
				id: 'r1',
				name: 'Sneaky Rogue',
				classes: [{ className: 'Rogue', classSource: 'XPHB', subclass: null, level: 4 }],
				featAsiChoices: [{ level: 4, kind: 'feat', name: 'Skulker', source: 'XPHB' }],
			}

			const { container } = render(<CharacterSheet character={rogue} />)
			await screen.findByRole('heading', { name: 'Sneaky Rogue' })

			const sensesSection = container.querySelector('.sheet__senses')!
			await waitFor(() => expect(sensesSection.textContent).toContain('Blindsight'))
			expect(sensesSection.textContent).toContain('from feat (Skulker)')
		})

		it('a character with no granted senses shows no "Senses" section at all — no empty heading', async () => {
			const { container } = render(<CharacterSheet character={character} />)
			await screen.findByRole('heading', { name: 'Aria' })
			expect(container.querySelector('.sheet__senses')).toBeNull()
		})

		/*
		 * A granted darkvision reconciles with the species value instead of
		 * standing alone as its own Senses row (this task) — senses of the same
		 * type don't stack, and showing two separate darkvision figures left the
		 * player to work out which one applies.
		 */
		it('a granted darkvision larger than the species value updates the traits row and drops out of Senses', async () => {
			const granted: GrantedSense[] = [{ senseType: 'darkvision', range: 120, origin: 'optionalFeature', name: 'Stone Rune' }]
			vi.mocked(loadGrantedSenses).mockResolvedValue(granted)

			// `character` (Aria) is an Elf, species darkvision 60 (SPECIES_DATA above).
			const { container } = render(<CharacterSheet character={character} />)
			await screen.findByRole('heading', { name: 'Aria' })

			const traitsSection = container.querySelector('.sheet__traits')!
			const darkvisionItem = await waitFor(() => {
				const item = Array.from(traitsSection.querySelectorAll('li')).find((li) => li.textContent?.includes('Darkvision:'))
				expect(item?.textContent).toContain('120 ft.')
				return item!
			})
			expect(darkvisionItem.textContent).not.toContain('60 ft.')

			await userEvent.setup().click(darkvisionItem.querySelector('summary')!)
			expect(darkvisionItem.textContent).toContain('Elf')
			expect(darkvisionItem.textContent).toContain('from invocation (Stone Rune)')

			// Darkvision never gets its own row in Senses — it belongs to the traits value now.
			expect(container.querySelector('.sheet__senses')).toBeNull()
		})

		it('a granted darkvision smaller than the species value leaves the traits row at the species figure', async () => {
			const granted: GrantedSense[] = [{ senseType: 'darkvision', range: 30, origin: 'feat', name: 'Some Feat' }]
			vi.mocked(loadGrantedSenses).mockResolvedValue(granted)

			const { container } = render(<CharacterSheet character={character} />)
			await screen.findByRole('heading', { name: 'Aria' })

			const traitsSection = container.querySelector('.sheet__traits')!
			await waitFor(() => {
				const item = Array.from(traitsSection.querySelectorAll('li')).find((li) => li.textContent?.includes('Darkvision:'))
				expect(item?.textContent).toContain('60 ft.')
			})
		})

		it('a granted truesight/blindsight still renders in Senses and never touches the darkvision traits row', async () => {
			const granted: GrantedSense[] = [{ senseType: 'truesight', range: 30, origin: 'optionalFeature', name: 'Witch Sight' }]
			vi.mocked(loadGrantedSenses).mockResolvedValue(granted)

			const { container } = render(<CharacterSheet character={character} />)
			await screen.findByRole('heading', { name: 'Aria' })

			const sensesSection = await waitFor(() => {
				const section = container.querySelector('.sheet__senses')
				expect(section).toBeTruthy()
				return section!
			})
			expect(sensesSection.textContent).toContain('Truesight')
			expect(sensesSection.textContent).not.toContain('Darkvision')

			const traitsSection = container.querySelector('.sheet__traits')!
			const darkvisionItem = Array.from(traitsSection.querySelectorAll('li')).find((li) => li.textContent?.includes('Darkvision:'))
			expect(darkvisionItem?.textContent).toContain('60 ft.')
		})
	})

	/*
	 * D21 class-feature choices. Only loadResolverData is stubbed — the join
	 * (chosenClassFeatureChoicesFrom) and the ref resolution underneath both run
	 * for real, so a mis-wired lookup fails here rather than passing on a stub.
	 * Asserted end to end for the same reason the sections above are: a stored
	 * pick that never reaches the sheet has shipped twice in this project.
	 */
	describe('class feature choices (D21)', () => {
		const CLERIC_FEATURES = [
			{
				name: 'Divine Order',
				className: 'Cleric',
				classSource: 'XPHB',
				level: 1,
				source: 'XPHB',
				id: 'cf|divine order|cleric|xphb|1|xphb',
				entries: [
					{
						type: 'options',
						count: 1,
						entries: [
							{ type: 'refClassFeature', classFeature: 'Protector|Cleric|XPHB|1|XPHB' },
							{ type: 'refClassFeature', classFeature: 'Thaumaturge|Cleric|XPHB|1|XPHB' },
						],
					},
				],
			},
			{
				name: 'Protector',
				className: 'Cleric',
				classSource: 'XPHB',
				level: 1,
				source: 'XPHB',
				id: 'cf|protector|cleric|xphb|1|xphb',
				entries: ['You gain Heavy armor training.'],
			},
			{
				name: 'Thaumaturge',
				className: 'Cleric',
				classSource: 'XPHB',
				level: 1,
				source: 'XPHB',
				id: 'cf|thaumaturge|cleric|xphb|1|xphb',
				entries: ['You know one extra cantrip from the Cleric spell list.'],
			},
		]

		afterEach(() => {
			vi.mocked(loadResolverData).mockReset().mockResolvedValue({ classFeatures: [], subclassFeatures: [], optionalFeatures: [], feats: [] })
		})

		it('a Cleric with Thaumaturge chosen renders it, naming the feature and its level', async () => {
			vi.mocked(loadResolverData).mockResolvedValue({
				classFeatures: CLERIC_FEATURES,
				subclassFeatures: [],
				optionalFeatures: [],
				feats: [],
			})

			const cleric: Character = {
				id: 'cl1',
				name: 'Ordered Cleric',
				classes: [{ className: 'Cleric', classSource: 'XPHB', subclass: null, level: 1 }],
				classFeatureChoices: [
					{ className: 'Cleric', classSource: 'XPHB', featureName: 'Divine Order', grantedAtLevel: 1, optionName: 'Thaumaturge' },
				],
			}

			const { container } = render(<CharacterSheet character={cleric} />)
			await screen.findByRole('heading', { name: 'Ordered Cleric' })

			const section = await waitFor(() => {
				const found = container.querySelector('.sheet__class-feature-choices')
				expect(found).toBeTruthy()
				return found!
			})
			expect(section.textContent).toContain('Thaumaturge')
			expect(section.textContent).toContain('Divine Order')
			expect(section.textContent).toContain('level 1')
			// The chosen option's own text, resolved through the ref — not just its name.
			expect(section.textContent).toContain('You know one extra cantrip from the Cleric spell list.')
			// The option NOT chosen must not appear.
			expect(section.textContent).not.toContain('Heavy armor training')
		})

		it('renders no section at all for a character that made no such choice', async () => {
			const { container } = render(<CharacterSheet character={character} />)
			await screen.findByRole('heading', { name: 'Aria' })
			expect(container.querySelector('.sheet__class-feature-choices')).toBeNull()
		})
	})

	describe('spellcasting sections (build order step 6 slice d4)', () => {
		afterEach(() => {
			vi.mocked(loadSpellcastingAbilityClassData).mockReset().mockResolvedValue([])
			vi.mocked(loadSpellSlotsClassData).mockReset().mockResolvedValue([])
			vi.mocked(loadSpellDetails).mockReset().mockResolvedValue([])
			vi.mocked(loadSubclassSource).mockReset().mockResolvedValue(null)
			vi.mocked(loadSubclassAlwaysPreparedSpells).mockReset().mockResolvedValue([])
			vi.mocked(loadFeatGrantedSpells).mockReset().mockResolvedValue([])
			vi.mocked(loadOptionalFeatureGrantedSpells).mockReset().mockResolvedValue([])
		})

		it('a full caster (Wizard) shows spell attack/DC with a breakdown, slots per level, and chosen spells grouped by level with detail on expand', async () => {
			const spellcastingAbility: ClassSpellcastingAbility[] = [{ className: 'Wizard', classSource: 'XPHB', ability: 'int' }]
			const spellSlots: ClassSpellSlotsData[] = [
				{
					className: 'Wizard',
					classSource: 'XPHB',
					casterProgression: 'full',
					spellSlotsByLevel: [[2], [3], [4, 2], [4, 3], [4, 3, 2]],
					pactSlotsByLevel: null,
				},
			]
			const details: SpellDetail[] = [
				spellDetail({ name: 'Prestidigitation', source: 'XPHB', level: 0, entries: ['Cantrip flavor text.'] }),
				spellDetail({ name: 'Fireball', source: 'XPHB', level: 3, entries: ['A bright streak flashes.'] }),
			]
			vi.mocked(loadSpellcastingAbilityClassData).mockResolvedValue(spellcastingAbility)
			vi.mocked(loadSpellSlotsClassData).mockResolvedValue(spellSlots)
			vi.mocked(loadSpellDetails).mockResolvedValue(details)

			const wizard: Character = {
				id: 'w1',
				name: 'Elminster',
				classes: [{ className: 'Wizard', classSource: 'XPHB', subclass: null, level: 5 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 8, dexterity: 12, constitution: 13, intelligence: 16, wisdom: 12, charisma: 10 },
				},
				spellChoices: [
					{
						className: 'Wizard',
						classSource: 'XPHB',
						spells: [
							{ name: 'Prestidigitation', source: 'XPHB' },
							{ name: 'Fireball', source: 'XPHB' },
						],
					},
				],
			}

			const user = userEvent.setup()
			const { container } = render(<CharacterSheet character={wizard} />)
			await screen.findByRole('heading', { name: 'Elminster' })

			const attackSection = container.querySelector('.sheet__spell-attacks')!
			expect(attackSection.textContent).toContain('Wizard (Intelligence)')
			expect(attackSection.textContent).toContain('Spell attack bonus')
			expect(attackSection.textContent).toContain('Spell save DC')
			await user.click(attackSection.querySelector('summary')!)
			expect(attackSection.textContent).toContain('proficiency bonus')

			const slotsSection = container.querySelector('.sheet__spell-slots')!
			expect(slotsSection.textContent).toContain('Level 1: 4')
			expect(slotsSection.textContent).toContain('Level 2: 3')
			expect(slotsSection.textContent).toContain('Level 3: 2')

			const spellsSection = container.querySelector('.sheet__spells')!
			expect(spellsSection.textContent).toContain('Cantrip')
			expect(spellsSection.textContent).toContain('Prestidigitation')
			expect(spellsSection.textContent).toContain('Level 3')
			expect(spellsSection.textContent).toContain('Fireball')

			const fireballSummary = Array.from(spellsSection.querySelectorAll('summary')).find((s) => s.textContent?.includes('Fireball'))!
			await user.click(fireballSummary)
			expect(fireballSummary.closest('details')!.textContent).toContain('Casting Time')
			expect(fireballSummary.closest('details')!.textContent).toContain('A bright streak flashes.')
		})

		it('shows "At Higher Levels" text on expand when the spell has it, and omits the line when it does not (step 6 follow-up)', async () => {
			const spellcastingAbility: ClassSpellcastingAbility[] = [{ className: 'Cleric', classSource: 'XPHB', ability: 'wis' }]
			const spellSlots: ClassSpellSlotsData[] = [
				{
					className: 'Cleric',
					classSource: 'XPHB',
					casterProgression: 'full',
					spellSlotsByLevel: [[2]],
					pactSlotsByLevel: null,
				},
			]
			const details: SpellDetail[] = [
				spellDetail({
					name: 'Healing Word',
					source: 'XPHB',
					level: 1,
					entries: ['A creature of your choice regains hit points.'],
					entriesHigherLevel: [
						{ type: 'entries', name: 'Using a Higher-Level Spell Slot', entries: ['The healing increases by 2d4 for each spell slot level above 1.'] },
					],
				}),
				spellDetail({ name: 'Guidance', source: 'XPHB', level: 0, entries: ['You touch one willing creature.'], entriesHigherLevel: [] }),
			]
			vi.mocked(loadSpellcastingAbilityClassData).mockResolvedValue(spellcastingAbility)
			vi.mocked(loadSpellSlotsClassData).mockResolvedValue(spellSlots)
			vi.mocked(loadSpellDetails).mockResolvedValue(details)

			const cleric: Character = {
				id: 'c1',
				name: 'Aramil',
				classes: [{ className: 'Cleric', classSource: 'XPHB', subclass: null, level: 1 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 16, charisma: 10 },
				},
				spellChoices: [
					{
						className: 'Cleric',
						classSource: 'XPHB',
						spells: [
							{ name: 'Healing Word', source: 'XPHB' },
							{ name: 'Guidance', source: 'XPHB' },
						],
					},
				],
			}

			const user = userEvent.setup()
			const { container } = render(<CharacterSheet character={cleric} />)
			await screen.findByRole('heading', { name: 'Aramil' })

			const spellsSection = container.querySelector('.sheet__spells')!

			const healingWordSummary = Array.from(spellsSection.querySelectorAll('summary')).find((s) => s.textContent?.includes('Healing Word'))!
			await user.click(healingWordSummary)
			const healingWordDetails = healingWordSummary.closest('details')!
			expect(healingWordDetails.textContent).toContain('At Higher Levels')
			expect(healingWordDetails.textContent).toContain('The healing increases by 2d4 for each spell slot level above 1.')

			const guidanceSummary = Array.from(spellsSection.querySelectorAll('summary')).find((s) => s.textContent?.includes('Guidance'))!
			await user.click(guidanceSummary)
			expect(guidanceSummary.closest('details')!.textContent).not.toContain('At Higher Levels')
			expect(guidanceSummary.closest('details')!.textContent).not.toContain('Cantrip scaling')
			expect(healingWordDetails.textContent).not.toContain('Cantrip scaling')
		})

		it('shows cantrip character-level scaling on expand (single and two-dice), and omits it for a non-scaling cantrip (step 6 follow-up)', async () => {
			const spellcastingAbility: ClassSpellcastingAbility[] = [{ className: 'Wizard', classSource: 'XPHB', ability: 'int' }]
			const spellSlots: ClassSpellSlotsData[] = [
				{
					className: 'Wizard',
					classSource: 'XPHB',
					casterProgression: 'full',
					spellSlotsByLevel: [[2]],
					pactSlotsByLevel: null,
				},
			]
			const details: SpellDetail[] = [
				spellDetail({
					name: 'Fire Bolt',
					source: 'XPHB',
					level: 0,
					entries: ['You hurl a mote of fire.'],
					scalingLevelDice: [{ label: 'Fire damage', scaling: { '1': '1d10', '5': '2d10', '11': '3d10', '17': '4d10' } }],
				}),
				spellDetail({
					name: 'Booming Blade',
					source: 'XPHB',
					level: 0,
					entries: ['You brandish your weapon.'],
					scalingLevelDice: [
						{ label: 'thunder damage on moving', scaling: { '1': '1d8', '5': '2d8', '11': '3d8', '17': '4d8' } },
						{ label: 'thunder damage on hit', scaling: { '5': '1d8', '11': '2d8', '17': '3d8' } },
					],
				}),
				spellDetail({ name: 'Mage Hand', source: 'XPHB', level: 0, entries: ['A spectral hand appears.'], scalingLevelDice: [] }),
			]
			vi.mocked(loadSpellcastingAbilityClassData).mockResolvedValue(spellcastingAbility)
			vi.mocked(loadSpellSlotsClassData).mockResolvedValue(spellSlots)
			vi.mocked(loadSpellDetails).mockResolvedValue(details)

			const wizard: Character = {
				id: 'w2',
				name: 'Tenser',
				classes: [{ className: 'Wizard', classSource: 'XPHB', subclass: null, level: 1 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 8, dexterity: 12, constitution: 13, intelligence: 16, wisdom: 12, charisma: 10 },
				},
				spellChoices: [
					{
						className: 'Wizard',
						classSource: 'XPHB',
						spells: [
							{ name: 'Fire Bolt', source: 'XPHB' },
							{ name: 'Booming Blade', source: 'XPHB' },
							{ name: 'Mage Hand', source: 'XPHB' },
						],
					},
				],
			}

			const user = userEvent.setup()
			const { container } = render(<CharacterSheet character={wizard} />)
			await screen.findByRole('heading', { name: 'Tenser' })

			const spellsSection = container.querySelector('.sheet__spells')!

			const fireBoltSummary = Array.from(spellsSection.querySelectorAll('summary')).find((s) => s.textContent?.includes('Fire Bolt'))!
			await user.click(fireBoltSummary)
			const fireBoltDetails = fireBoltSummary.closest('details')!
			expect(fireBoltDetails.textContent).toContain('Cantrip scaling')
			expect(fireBoltDetails.textContent).toContain('Fire damage: 1d10 (1-4), 2d10 (5-10), 3d10 (11-16), 4d10 (17+)')

			const boomingBladeSummary = Array.from(spellsSection.querySelectorAll('summary')).find((s) => s.textContent?.includes('Booming Blade'))!
			await user.click(boomingBladeSummary)
			const boomingBladeDetails = boomingBladeSummary.closest('details')!
			expect(boomingBladeDetails.textContent).toContain('thunder damage on moving: 1d8 (1-4), 2d8 (5-10), 3d8 (11-16), 4d8 (17+)')
			expect(boomingBladeDetails.textContent).toContain('thunder damage on hit: 1d8 (5-10), 2d8 (11-16), 3d8 (17+)')

			const mageHandSummary = Array.from(spellsSection.querySelectorAll('summary')).find((s) => s.textContent?.includes('Mage Hand'))!
			await user.click(mageHandSummary)
			expect(mageHandSummary.closest('details')!.textContent).not.toContain('Cantrip scaling')
		})

		it('an Eldritch Knight renders a Wizard-list spell chosen during creation (step 6 EK/AT `expanded` wiring)', async () => {
			const spellcastingAbility: ClassSpellcastingAbility[] = [
				{ className: 'Fighter', classSource: 'XPHB', ability: null, subclasses: [{ subclassName: 'Eldritch Knight', ability: 'int' }] },
			]
			const spellSlots: ClassSpellSlotsData[] = [
				{
					className: 'Fighter',
					classSource: 'XPHB',
					casterProgression: null,
					spellSlotsByLevel: null,
					pactSlotsByLevel: null,
					subclasses: [{ subclassName: 'Eldritch Knight', casterProgression: '1/3', spellSlotsByLevel: [[0], [0], [2]] }],
				},
			]
			const details: SpellDetail[] = [spellDetail({ name: 'Magic Missile', source: 'XPHB', level: 1, entries: ['Three glowing darts of force.'] })]
			vi.mocked(loadSpellcastingAbilityClassData).mockResolvedValue(spellcastingAbility)
			vi.mocked(loadSpellSlotsClassData).mockResolvedValue(spellSlots)
			vi.mocked(loadSpellDetails).mockResolvedValue(details)

			const eldritchKnight: Character = {
				id: 'ek1',
				name: 'Steelmind',
				classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Eldritch Knight', level: 3 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 },
				},
				// Tagged with Fighter (the character's own class), same as saveCharacter does — the spell itself is drawn from Wizard's list.
				spellChoices: [{ className: 'Fighter', classSource: 'XPHB', spells: [{ name: 'Magic Missile', source: 'XPHB' }] }],
			}

			const { container } = render(<CharacterSheet character={eldritchKnight} />)
			await screen.findByRole('heading', { name: 'Steelmind' })

			const spellsSection = container.querySelector('.sheet__spells')!
			expect(spellsSection.textContent).toContain('Magic Missile')
		})

		it('a Divine Soul Sorcerer renders a Cleric-list spell chosen during creation (step 6 Divine Soul `expanded` pool-widening)', async () => {
			const spellcastingAbility: ClassSpellcastingAbility[] = [{ className: 'Sorcerer', classSource: 'XPHB', ability: 'cha' }]
			const spellSlots: ClassSpellSlotsData[] = [
				{ className: 'Sorcerer', classSource: 'XPHB', casterProgression: 'full', spellSlotsByLevel: [[2], [3], [4, 2]], pactSlotsByLevel: null },
			]
			const details: SpellDetail[] = [spellDetail({ name: 'Cure Wounds', source: 'XPHB', level: 1, entries: ['A creature regains hit points.'] })]
			vi.mocked(loadSpellcastingAbilityClassData).mockResolvedValue(spellcastingAbility)
			vi.mocked(loadSpellSlotsClassData).mockResolvedValue(spellSlots)
			vi.mocked(loadSpellDetails).mockResolvedValue(details)

			const divineSoul: Character = {
				id: 'ds1',
				name: 'Seraphina',
				classes: [{ className: 'Sorcerer', classSource: 'XPHB', subclass: 'Divine Soul', level: 3 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 8, dexterity: 12, constitution: 13, intelligence: 10, wisdom: 10, charisma: 16 },
				},
				// Tagged with Sorcerer (the character's own class), same as saveCharacter does — the spell itself is drawn from Cleric's list via `expanded`.
				spellChoices: [{ className: 'Sorcerer', classSource: 'XPHB', spells: [{ name: 'Cure Wounds', source: 'XPHB' }] }],
			}

			const { container } = render(<CharacterSheet character={divineSoul} />)
			await screen.findByRole('heading', { name: 'Seraphina' })

			const spellsSection = container.querySelector('.sheet__spells')!
			expect(spellsSection.textContent).toContain('Cure Wounds')
		})

		it('a duplicate subclass grant (reported bug repro: Bless showing twice for Divine Soul) shows once on the sheet — defensive dedup at the point the sheet assembles alwaysPrepared+chosen (this task)', async () => {
			const spellcastingAbility: ClassSpellcastingAbility[] = [{ className: 'Sorcerer', classSource: 'XPHB', ability: 'cha' }]
			const spellSlots: ClassSpellSlotsData[] = [
				{ className: 'Sorcerer', classSource: 'XPHB', casterProgression: 'full', spellSlotsByLevel: [[2], [3], [4, 2]], pactSlotsByLevel: null },
			]
			const details: SpellDetail[] = [spellDetail({ name: 'Bless', source: 'XPHB', level: 1, entries: ['A creature is blessed.'] })]
			vi.mocked(loadSpellcastingAbilityClassData).mockResolvedValue(spellcastingAbility)
			vi.mocked(loadSpellSlotsClassData).mockResolvedValue(spellSlots)
			vi.mocked(loadSpellDetails).mockResolvedValue(details)
			vi.mocked(loadSubclassSource).mockResolvedValue('XGE')
			// Simulates what a broken extraction would return — the same spell via two grant paths — to prove the sheet's own defensive dedup (CharacterSheet.tsx) collapses it even if the source of the array were ever buggy again.
			const duplicateAlwaysPrepared: AlwaysPreparedSpell[] = [
				{ name: 'Bless', source: 'XPHB', level: 1, grantedAtLevel: 1, ritual: false, concentration: true, origin: 'subclass' },
				{ name: 'Bless', source: 'XPHB', level: 1, grantedAtLevel: 1, ritual: false, concentration: true, origin: 'subclass' },
			]
			vi.mocked(loadSubclassAlwaysPreparedSpells).mockResolvedValue(duplicateAlwaysPrepared)

			const divineSoul: Character = {
				id: 'ds2',
				name: 'DupeCheck',
				classes: [{ className: 'Sorcerer', classSource: 'XPHB', subclass: 'Divine Soul', level: 3 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 8, dexterity: 12, constitution: 13, intelligence: 10, wisdom: 10, charisma: 16 },
				},
			}

			const { container } = render(<CharacterSheet character={divineSoul} />)
			await screen.findByRole('heading', { name: 'DupeCheck' })

			const spellsSection = container.querySelector('.sheet__spells')!
			const blessRows = Array.from(spellsSection.querySelectorAll('summary')).filter((s) => s.textContent?.includes('Bless'))
			expect(blessRows).toHaveLength(1)
		})

		it('a spell that is BOTH a player pick (spellChoices) AND subclass-granted (always-prepared) shows once, with both provenances joined (D44 spirit — already correct, regression guard for this task)', async () => {
			const spellcastingAbility: ClassSpellcastingAbility[] = [{ className: 'Sorcerer', classSource: 'XPHB', ability: 'cha' }]
			const spellSlots: ClassSpellSlotsData[] = [
				{ className: 'Sorcerer', classSource: 'XPHB', casterProgression: 'full', spellSlotsByLevel: [[2], [3], [4, 2]], pactSlotsByLevel: null },
			]
			const details: SpellDetail[] = [spellDetail({ name: 'Bless', source: 'XPHB', level: 1, entries: ['A creature is blessed.'] })]
			vi.mocked(loadSpellcastingAbilityClassData).mockResolvedValue(spellcastingAbility)
			vi.mocked(loadSpellSlotsClassData).mockResolvedValue(spellSlots)
			vi.mocked(loadSpellDetails).mockResolvedValue(details)
			vi.mocked(loadSubclassSource).mockResolvedValue('XGE')
			const alwaysPrepared: AlwaysPreparedSpell[] = [{ name: 'Bless', source: 'XPHB', level: 1, grantedAtLevel: 1, ritual: false, concentration: true, origin: 'subclass' }]
			vi.mocked(loadSubclassAlwaysPreparedSpells).mockResolvedValue(alwaysPrepared)

			const divineSoul: Character = {
				id: 'ds3',
				name: 'BothSources',
				classes: [{ className: 'Sorcerer', classSource: 'XPHB', subclass: 'Divine Soul', level: 3 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 8, dexterity: 12, constitution: 13, intelligence: 10, wisdom: 10, charisma: 16 },
				},
				spellChoices: [{ className: 'Sorcerer', classSource: 'XPHB', spells: [{ name: 'Bless', source: 'XPHB' }] }],
			}

			const { container } = render(<CharacterSheet character={divineSoul} />)
			await screen.findByRole('heading', { name: 'BothSources' })

			const spellsSection = container.querySelector('.sheet__spells')!
			const blessRows = Array.from(spellsSection.querySelectorAll('summary')).filter((s) => s.textContent?.includes('Bless'))
			expect(blessRows).toHaveLength(1)
			expect(blessRows[0].textContent).toContain('player pick')
			expect(blessRows[0].textContent).toContain('always prepared (Divine Soul)')
		})

		it("a Wizard with Mark of Detection renders the mark's `expanded` pool-widening spell chosen during creation (D46, step 6), as a normal player pick", async () => {
			const spellcastingAbility: ClassSpellcastingAbility[] = [{ className: 'Wizard', classSource: 'XPHB', ability: 'int' }]
			const spellSlots: ClassSpellSlotsData[] = [
				{ className: 'Wizard', classSource: 'XPHB', casterProgression: 'full', spellSlotsByLevel: [[2], [3], [4, 2]], pactSlotsByLevel: null },
			]
			const details: SpellDetail[] = [spellDetail({ name: 'Detect Evil and Good', source: 'XPHB', level: 1, entries: ['You sense the presence of fiends, celestials, and undead.'] })]
			vi.mocked(loadSpellcastingAbilityClassData).mockResolvedValue(spellcastingAbility)
			vi.mocked(loadSpellSlotsClassData).mockResolvedValue(spellSlots)
			vi.mocked(loadSpellDetails).mockResolvedValue(details)

			const wizardWithMark: Character = {
				id: 'w1',
				name: 'Marked Wizard',
				classes: [{ className: 'Wizard', classSource: 'XPHB', subclass: null, level: 3 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 8, dexterity: 12, constitution: 13, intelligence: 16, wisdom: 10, charisma: 10 },
				},
				featAsiChoices: [{ level: 4, kind: 'feat', name: 'Mark of Detection', source: 'EFA', chosenAbility: 'intelligence' }],
				// Tagged with Wizard (the character's own class), same as saveCharacter does — the spell itself is drawn from the mark's `expanded` table, not Wizard's own list.
				spellChoices: [{ className: 'Wizard', classSource: 'XPHB', spells: [{ name: 'Detect Evil and Good', source: 'XPHB' }] }],
			}

			const { container } = render(<CharacterSheet character={wizardWithMark} />)
			await screen.findByRole('heading', { name: 'Marked Wizard' })

			const spellsSection = container.querySelector('.sheet__spells')!
			expect(spellsSection.textContent).toContain('Detect Evil and Good')
		})

		it('a Warlock shows Pact Magic slots separately from any ordinary slot list', async () => {
			const spellcastingAbility: ClassSpellcastingAbility[] = [{ className: 'Warlock', classSource: 'XPHB', ability: 'cha' }]
			const spellSlots: ClassSpellSlotsData[] = [
				{
					className: 'Warlock',
					classSource: 'XPHB',
					casterProgression: 'pact',
					spellSlotsByLevel: null,
					pactSlotsByLevel: [
						{ count: 1, slotLevel: 1 },
						{ count: 2, slotLevel: 1 },
						{ count: 2, slotLevel: 2 },
					],
				},
			]
			vi.mocked(loadSpellcastingAbilityClassData).mockResolvedValue(spellcastingAbility)
			vi.mocked(loadSpellSlotsClassData).mockResolvedValue(spellSlots)

			const warlock: Character = {
				id: 'wl1',
				name: 'Pactbound',
				classes: [{ className: 'Warlock', classSource: 'XPHB', subclass: null, level: 3 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 8, dexterity: 12, constitution: 13, intelligence: 10, wisdom: 10, charisma: 16 },
				},
			}

			const { container } = render(<CharacterSheet character={warlock} />)
			await screen.findByRole('heading', { name: 'Pactbound' })

			const slotsSection = container.querySelector('.sheet__spell-slots')!
			expect(slotsSection.textContent).toContain('Pact Magic')
			expect(slotsSection.textContent).toContain('2 slots (level 2)')
			expect(slotsSection.textContent).not.toMatch(/Level \d+: \d+/) // no ordinary 1-9 list alongside it
		})

		it('a subclass caster (Cleric domain) shows the always-prepared subclass spells marked with their source, alongside any chosen spells', async () => {
			const spellcastingAbility: ClassSpellcastingAbility[] = [{ className: 'Cleric', classSource: 'XPHB', ability: 'wis' }]
			const spellSlots: ClassSpellSlotsData[] = [
				{
					className: 'Cleric',
					classSource: 'XPHB',
					casterProgression: 'full',
					spellSlotsByLevel: [[2], [3], [4, 2]],
					pactSlotsByLevel: null,
				},
			]
			const alwaysPrepared: AlwaysPreparedSpell[] = [
				{ name: 'Cure Wounds', source: 'XPHB', level: 1, grantedAtLevel: 3, ritual: false, concentration: false, origin: 'subclass' },
			]
			const details: SpellDetail[] = [
				spellDetail({ name: 'Cure Wounds', source: 'XPHB', level: 1, entries: ['A creature you touch regains hit points.'] }),
				spellDetail({ name: 'Guidance', source: 'XPHB', level: 0, entries: ['You touch one willing creature.'] }),
			]
			vi.mocked(loadSpellcastingAbilityClassData).mockResolvedValue(spellcastingAbility)
			vi.mocked(loadSpellSlotsClassData).mockResolvedValue(spellSlots)
			vi.mocked(loadSpellDetails).mockResolvedValue(details)
			vi.mocked(loadSubclassSource).mockResolvedValue('XPHB')
			vi.mocked(loadSubclassAlwaysPreparedSpells).mockResolvedValue(alwaysPrepared)

			const cleric: Character = {
				id: 'cl1',
				name: 'Domain Priest',
				classes: [{ className: 'Cleric', classSource: 'XPHB', subclass: 'Life Domain', level: 3 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 10, dexterity: 10, constitution: 13, intelligence: 10, wisdom: 16, charisma: 10 },
				},
				spellChoices: [{ className: 'Cleric', classSource: 'XPHB', spells: [{ name: 'Guidance', source: 'XPHB' }] }],
			}

			const { container } = render(<CharacterSheet character={cleric} />)
			await screen.findByRole('heading', { name: 'Domain Priest' })

			const spellsSection = container.querySelector('.sheet__spells')!
			await waitFor(() => expect(spellsSection.textContent).toContain('Cure Wounds'))

			const cureWoundsSummary = Array.from(spellsSection.querySelectorAll('summary')).find((s) => s.textContent?.includes('Cure Wounds'))!
			expect(cureWoundsSummary.textContent).toContain('always prepared (Life Domain)')

			const guidanceSummary = Array.from(spellsSection.querySelectorAll('summary')).find((s) => s.textContent?.includes('Guidance'))!
			expect(guidanceSummary.textContent).toContain('player pick')
			expect(guidanceSummary.textContent).not.toContain('always prepared')
		})

		it('a Hexblade Warlock shows its pact-slot-rank-keyed patron spell on the sheet, at the level the resolver granted it (D46 follow-up)', async () => {
			const spellcastingAbility: ClassSpellcastingAbility[] = [{ className: 'Warlock', classSource: 'XPHB', ability: 'cha' }]
			const spellSlots: ClassSpellSlotsData[] = [
				{
					className: 'Warlock',
					classSource: 'XPHB',
					casterProgression: 'pact',
					spellSlotsByLevel: null,
					pactSlotsByLevel: [
						{ count: 1, slotLevel: 1 },
						{ count: 2, slotLevel: 1 },
						{ count: 2, slotLevel: 2 },
					],
				},
			]
			const alwaysPrepared: AlwaysPreparedSpell[] = [
				{ name: 'Shield', source: 'XPHB', level: 1, grantedAtLevel: 1, ritual: false, concentration: false, origin: 'subclass' },
			]
			const details: SpellDetail[] = [spellDetail({ name: 'Shield', source: 'XPHB', level: 1, entries: ['An invisible barrier of magical force appears.'] })]
			vi.mocked(loadSpellcastingAbilityClassData).mockResolvedValue(spellcastingAbility)
			vi.mocked(loadSpellSlotsClassData).mockResolvedValue(spellSlots)
			vi.mocked(loadSpellDetails).mockResolvedValue(details)
			vi.mocked(loadSubclassSource).mockResolvedValue('XGE')
			vi.mocked(loadSubclassAlwaysPreparedSpells).mockResolvedValue(alwaysPrepared)

			const warlock: Character = {
				id: 'wl2',
				name: 'Blade Pact',
				classes: [{ className: 'Warlock', classSource: 'XPHB', subclass: 'The Hexblade', level: 3 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 10, dexterity: 10, constitution: 13, intelligence: 10, wisdom: 10, charisma: 16 },
				},
			}

			const { container } = render(<CharacterSheet character={warlock} />)
			await screen.findByRole('heading', { name: 'Blade Pact' })

			await waitFor(() => expect(container.querySelector('.sheet__spells')?.textContent).toContain('Shield'))
			const spellsSection = container.querySelector('.sheet__spells')!

			const shieldSummary = Array.from(spellsSection.querySelectorAll('summary')).find((s) => s.textContent?.includes('Shield'))!
			expect(shieldSummary.textContent).toContain('always prepared (The Hexblade)')

			// The Warlock's own pactSlotsByLevel table (from the already-loaded spellSlotsClassData) must reach the resolver, not be silently dropped.
			expect(loadSubclassAlwaysPreparedSpells).toHaveBeenCalledWith('The Hexblade', 'XGE', 'Warlock', 'XPHB', 3, spellSlots[0].pactSlotsByLevel)
		})

		it('a subclass spell-choice pick (Evoker, slice d6b) shows on the sheet marked "always prepared (Evoker)"', async () => {
			const spellcastingAbility: ClassSpellcastingAbility[] = [{ className: 'Wizard', classSource: 'XPHB', ability: 'int' }]
			const spellSlots: ClassSpellSlotsData[] = [
				{ className: 'Wizard', classSource: 'XPHB', casterProgression: 'full', spellSlotsByLevel: [[2], [3]], pactSlotsByLevel: null },
			]
			const details: SpellDetail[] = [spellDetail({ name: 'Fire Bolt', source: 'XPHB', level: 0, entries: ['You hurl a mote of fire.'] })]
			vi.mocked(loadSpellcastingAbilityClassData).mockResolvedValue(spellcastingAbility)
			vi.mocked(loadSpellSlotsClassData).mockResolvedValue(spellSlots)
			vi.mocked(loadSpellDetails).mockResolvedValue(details)
			vi.mocked(loadSubclassSource).mockResolvedValue('XPHB')
			vi.mocked(loadSubclassChosenSpells).mockResolvedValue([
				{ name: 'Fire Bolt', source: 'XPHB', level: 0, grantedAtLevel: 3, ritual: false, concentration: false, origin: 'subclass' },
			])

			const wizard: Character = {
				id: 'wz1',
				name: 'Evocation Wizard',
				classes: [{ className: 'Wizard', classSource: 'XPHB', subclass: 'Evoker', level: 3 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 10, dexterity: 10, constitution: 13, intelligence: 16, wisdom: 10, charisma: 10 },
				},
				subclassSpellChoices: [
					{
						subclassName: 'Evoker',
						subclassSource: 'XPHB',
						className: 'Wizard',
						classSource: 'XPHB',
						picks: [{ grantedAtLevel: 3, slotIndex: 0, name: 'Fire Bolt', source: 'XPHB' }],
					},
				],
			}

			const { container } = render(<CharacterSheet character={wizard} />)
			await screen.findByRole('heading', { name: 'Evocation Wizard' })

			const spellsSection = container.querySelector('.sheet__spells')!
			await waitFor(() => expect(spellsSection.textContent).toContain('Fire Bolt'))

			const fireBoltSummary = Array.from(spellsSection.querySelectorAll('summary')).find((s) => s.textContent?.includes('Fire Bolt'))!
			expect(fireBoltSummary.textContent).toContain('always prepared (Evoker)')
		})

		/*
		 * Build order step 6a final slice. The picker has stored these choices since
		 * slice 2 and the sheet has shown their TEXT since then, but the spells they
		 * grant reached nothing — the same "stored but never displayed" gap the
		 * d5b-1 and d6b sheet fixes closed, so the display path is asserted here
		 * rather than assumed to work once the extractor exists.
		 */
		it('a spell granted by a chosen invocation shows on the sheet marked "from invocation (...)"', async () => {
			const spellcastingAbility: ClassSpellcastingAbility[] = [{ className: 'Warlock', classSource: 'XPHB', ability: 'cha' }]
			const spellSlots: ClassSpellSlotsData[] = [
				{ className: 'Warlock', classSource: 'XPHB', casterProgression: 'pact', spellSlotsByLevel: null, pactSlotsByLevel: [{ count: 1, slotLevel: 1 }] },
			]
			const details: SpellDetail[] = [spellDetail({ name: 'Disguise Self', source: 'XPHB', level: 1, entries: ['You change your appearance.'] })]
			const granted: OptionalFeatureGrantedSpell[] = [
				{
					name: 'Disguise Self',
					source: 'XPHB',
					level: 1,
					ritual: false,
					concentration: false,
					origin: 'optionalFeature',
					optionName: 'Mask of Many Faces',
				},
			]
			vi.mocked(loadSpellcastingAbilityClassData).mockResolvedValue(spellcastingAbility)
			vi.mocked(loadSpellSlotsClassData).mockResolvedValue(spellSlots)
			vi.mocked(loadSpellDetails).mockResolvedValue(details)
			vi.mocked(loadOptionalFeatureGrantedSpells).mockResolvedValue(granted)

			const warlock: Character = {
				id: 'wl1',
				name: 'Invocation Warlock',
				classes: [{ className: 'Warlock', classSource: 'XPHB', subclass: null, level: 2 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 10, dexterity: 10, constitution: 13, intelligence: 10, wisdom: 10, charisma: 16 },
				},
				optionalFeatureChoices: [{ featureType: 'EI', choices: ['Mask of Many Faces'] }],
			}

			const { container } = render(<CharacterSheet character={warlock} />)
			await screen.findByRole('heading', { name: 'Invocation Warlock' })

			const spellsSection = container.querySelector('.sheet__spells')!
			await waitFor(() => expect(spellsSection.textContent).toContain('Disguise Self'))

			const summary = Array.from(spellsSection.querySelectorAll('summary')).find((s) => s.textContent?.includes('Disguise Self'))!
			expect(summary.textContent).toContain('from invocation (Mask of Many Faces)')
			// The grant is ADDITIONAL: it must never read as one of the player's own picks, which are what the spell picker counts.
			expect(summary.textContent).not.toContain('player pick')
			// The loader is stubbed above, so assert the sheet actually hands it the stored picks — otherwise a
			// mis-wired argument would still render green here.
			expect(vi.mocked(loadOptionalFeatureGrantedSpells)).toHaveBeenCalledWith(
				expect.objectContaining({ optionalFeatureChoices: [{ featureType: 'EI', choices: ['Mask of Many Faces'] }] }),
			)
		})

		/*
		 * Pact of the Tome (step 6a): the player picked the individual spells, so
		 * the sheet reads the stored picks rather than deriving anything. Asserted
		 * end to end because a picker whose choice never renders has happened
		 * twice in this project (the d5b-1 and d6b sheet fixes).
		 */
		it('spells picked for Pact of the Tome render, named as coming from that invocation', async () => {
			const spellcastingAbility: ClassSpellcastingAbility[] = [{ className: 'Warlock', classSource: 'XPHB', ability: 'cha' }]
			const spellSlots: ClassSpellSlotsData[] = [
				{ className: 'Warlock', classSource: 'XPHB', casterProgression: 'pact', spellSlotsByLevel: null, pactSlotsByLevel: [{ count: 1, slotLevel: 1 }] },
			]
			const details: SpellDetail[] = [
				spellDetail({ name: 'Mage Hand', source: 'XPHB', level: 0, entries: ['A spectral hand appears.'] }),
				spellDetail({ name: 'Alarm', source: 'XPHB', level: 1, entries: ['You set an alarm.'] }),
			]
			const granted: OptionalFeatureGrantedSpell[] = [
				{ name: 'Mage Hand', source: 'XPHB', level: 0, ritual: false, concentration: false, origin: 'optionalFeature', optionName: 'Pact of the Tome' },
				{ name: 'Alarm', source: 'XPHB', level: 1, ritual: true, concentration: false, origin: 'optionalFeature', optionName: 'Pact of the Tome' },
			]
			vi.mocked(loadSpellcastingAbilityClassData).mockResolvedValue(spellcastingAbility)
			vi.mocked(loadSpellSlotsClassData).mockResolvedValue(spellSlots)
			vi.mocked(loadSpellDetails).mockResolvedValue(details)
			vi.mocked(loadOptionalFeatureGrantedSpells).mockResolvedValue(granted)

			const tomePicks = [
				{
					optionName: 'Pact of the Tome',
					cantrips: [{ name: 'Mage Hand', source: 'XPHB' }],
					spells: [{ name: 'Alarm', source: 'XPHB' }],
				},
			]
			const warlock: Character = {
				id: 'wl3',
				name: 'Tome Warlock',
				classes: [{ className: 'Warlock', classSource: 'XPHB', subclass: null, level: 3 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 10, dexterity: 10, constitution: 13, intelligence: 10, wisdom: 10, charisma: 16 },
				},
				optionalFeatureChoices: [{ featureType: 'EI', choices: ['Pact of the Tome'], spellChoices: tomePicks }],
			}

			const { container } = render(<CharacterSheet character={warlock} />)
			await screen.findByRole('heading', { name: 'Tome Warlock' })

			const spellsSection = container.querySelector('.sheet__spells')!
			await waitFor(() => expect(spellsSection.textContent).toContain('Mage Hand'))

			const summaries = Array.from(spellsSection.querySelectorAll('summary'))
			const mageHand = summaries.find((s) => s.textContent?.includes('Mage Hand'))!
			const alarm = summaries.find((s) => s.textContent?.includes('Alarm'))!
			expect(mageHand.textContent).toContain('from invocation (Pact of the Tome)')
			expect(alarm.textContent).toContain('from invocation (Pact of the Tome)')
			// A picked spell is still a GRANT, never one of the player's own counted picks.
			expect(mageHand.textContent).not.toContain('player pick')
			// The stored picks must actually reach the loader, or the stub would hide a mis-wiring.
			expect(vi.mocked(loadOptionalFeatureGrantedSpells)).toHaveBeenCalledWith(
				expect.objectContaining({
					optionalFeatureChoices: expect.arrayContaining([expect.objectContaining({ spellChoices: tomePicks })]),
				}),
			)
		})

		it('a spell granted by TWO invocations shows once, with both options named', async () => {
			const spellcastingAbility: ClassSpellcastingAbility[] = [{ className: 'Warlock', classSource: 'XPHB', ability: 'cha' }]
			const spellSlots: ClassSpellSlotsData[] = [
				{ className: 'Warlock', classSource: 'XPHB', casterProgression: 'pact', spellSlotsByLevel: null, pactSlotsByLevel: [{ count: 2, slotLevel: 2 }] },
			]
			const details: SpellDetail[] = [spellDetail({ name: 'Invisibility', source: 'XPHB', level: 2, entries: ['You vanish.'] })]
			// The real pair: One with Shadows and Shroud of Shadow both grant Invisibility.
			const granted: OptionalFeatureGrantedSpell[] = [
				{ name: 'Invisibility', source: 'XPHB', level: 2, ritual: false, concentration: true, origin: 'optionalFeature', optionName: 'One with Shadows' },
				{ name: 'Invisibility', source: 'XPHB', level: 2, ritual: false, concentration: true, origin: 'optionalFeature', optionName: 'Shroud of Shadow' },
			]
			vi.mocked(loadSpellcastingAbilityClassData).mockResolvedValue(spellcastingAbility)
			vi.mocked(loadSpellSlotsClassData).mockResolvedValue(spellSlots)
			vi.mocked(loadSpellDetails).mockResolvedValue(details)
			vi.mocked(loadOptionalFeatureGrantedSpells).mockResolvedValue(granted)

			const warlock: Character = {
				id: 'wl2',
				name: 'Shadow Warlock',
				classes: [{ className: 'Warlock', classSource: 'XPHB', subclass: null, level: 5 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 10, dexterity: 10, constitution: 13, intelligence: 10, wisdom: 10, charisma: 16 },
				},
				optionalFeatureChoices: [{ featureType: 'EI', choices: ['One with Shadows', 'Shroud of Shadow'] }],
			}

			const { container } = render(<CharacterSheet character={warlock} />)
			await screen.findByRole('heading', { name: 'Shadow Warlock' })

			const spellsSection = container.querySelector('.sheet__spells')!
			await waitFor(() => expect(spellsSection.textContent).toContain('Invisibility'))

			const rows = Array.from(spellsSection.querySelectorAll('summary')).filter((s) => s.textContent?.includes('Invisibility'))
			expect(rows).toHaveLength(1)
			expect(rows[0].textContent).toContain('from invocation (One with Shadows)')
			expect(rows[0].textContent).toContain('from invocation (Shroud of Shadow)')
		})

		it('a base Magic Initiate pick shows on the sheet marked "from feat (Magic Initiate)" (slice d5b-2)', async () => {
			const spellcastingAbility: ClassSpellcastingAbility[] = [{ className: 'Cleric', classSource: 'XPHB', ability: 'wis' }]
			const spellSlots: ClassSpellSlotsData[] = [{ className: 'Cleric', classSource: 'XPHB', casterProgression: 'full', spellSlotsByLevel: [[2]], pactSlotsByLevel: null }]
			const details: SpellDetail[] = [spellDetail({ name: 'Fire Bolt', source: 'XPHB', level: 0, entries: ['You hurl a mote of fire.'] })]
			const featGrantedSpells: FeatGrantedSpell[] = [
				{ name: 'Fire Bolt', source: 'XPHB', level: 0, ritual: false, concentration: false, origin: 'feat', featName: 'Magic Initiate', ability: 'int' },
			]
			vi.mocked(loadSpellcastingAbilityClassData).mockResolvedValue(spellcastingAbility)
			vi.mocked(loadSpellSlotsClassData).mockResolvedValue(spellSlots)
			vi.mocked(loadSpellDetails).mockResolvedValue(details)
			vi.mocked(loadFeatGrantedSpells).mockResolvedValue(featGrantedSpells)

			const cleric: Character = {
				id: 'cl2',
				name: 'Magic Initiate Cleric',
				classes: [{ className: 'Cleric', classSource: 'XPHB', subclass: null, level: 4 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 10, dexterity: 10, constitution: 13, intelligence: 14, wisdom: 16, charisma: 10 },
				},
				featAsiChoices: [
					{
						level: 4,
						kind: 'feat',
						name: 'Magic Initiate',
						source: 'XPHB',
						chosenAbility: 'intelligence',
						magicInitiate: {
							className: 'Wizard',
							classSource: 'XPHB',
							cantrips: [{ name: 'Fire Bolt', source: 'XPHB' }],
							spell: null,
						},
					},
				],
			}

			const { container } = render(<CharacterSheet character={cleric} />)
			await screen.findByRole('heading', { name: 'Magic Initiate Cleric' })

			const spellsSection = container.querySelector('.sheet__spells')!
			await waitFor(() => expect(spellsSection.textContent).toContain('Fire Bolt'))
			const fireBoltSummary = Array.from(spellsSection.querySelectorAll('summary')).find((s) => s.textContent?.includes('Fire Bolt'))!
			expect(fireBoltSummary.textContent).toContain('from feat (Magic Initiate)')
		})

		it('a non-caster (Fighter) shows no spellcasting sections at all', async () => {
			const { container } = render(<CharacterSheet character={character} />)
			await screen.findByRole('heading', { name: 'Aria' })

			expect(container.querySelector('.sheet__spell-attacks')).toBeNull()
			expect(container.querySelector('.sheet__spell-slots')).toBeNull()
			expect(container.querySelector('.sheet__spells')).toBeNull()
		})

		it('a non-caster (Fighter) with Magic Initiate shows the Spells list AND a feat spellcasting entry (attack/DC), with no slots section', async () => {
			const details: SpellDetail[] = [
				spellDetail({ name: 'Fire Bolt', source: 'XPHB', level: 0, entries: ['You hurl a mote of fire.'] }),
				spellDetail({ name: 'Mage Hand', source: 'XPHB', level: 0, entries: ['A spectral hand appears.'] }),
				spellDetail({ name: 'Shield', source: 'XPHB', level: 1, entries: ['An invisible barrier of magical force.'] }),
			]
			const featGrantedSpells: FeatGrantedSpell[] = [
				{ name: 'Fire Bolt', source: 'XPHB', level: 0, ritual: false, concentration: false, origin: 'feat', featName: 'Magic Initiate', ability: 'int' },
				{ name: 'Mage Hand', source: 'XPHB', level: 0, ritual: false, concentration: false, origin: 'feat', featName: 'Magic Initiate', ability: 'int' },
				{ name: 'Shield', source: 'XPHB', level: 1, ritual: false, concentration: false, origin: 'feat', featName: 'Magic Initiate', ability: 'int' },
			]
			vi.mocked(loadSpellDetails).mockResolvedValue(details)
			vi.mocked(loadFeatGrantedSpells).mockResolvedValue(featGrantedSpells)

			const fighter: Character = {
				id: 'f1',
				name: 'Magic Initiate Fighter',
				classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 4 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 16, dexterity: 12, constitution: 14, intelligence: 12, wisdom: 10, charisma: 8 },
				},
				featAsiChoices: [
					{
						level: 4,
						kind: 'feat',
						name: 'Magic Initiate',
						source: 'XPHB',
						chosenAbility: 'intelligence',
						magicInitiate: {
							className: 'Wizard',
							classSource: 'XPHB',
							cantrips: [
								{ name: 'Fire Bolt', source: 'XPHB' },
								{ name: 'Mage Hand', source: 'XPHB' },
							],
							spell: { name: 'Shield', source: 'XPHB' },
						},
					},
				],
			}

			const { container } = render(<CharacterSheet character={fighter} />)
			await screen.findByRole('heading', { name: 'Magic Initiate Fighter' })

			const attackSection = container.querySelector('.sheet__spell-attacks')!
			expect(attackSection).not.toBeNull()
			expect(attackSection.textContent).toContain('Magic Initiate (Intelligence)')
			expect(attackSection.textContent).toContain('Spell attack bonus')
			expect(attackSection.textContent).toContain('+3')
			expect(attackSection.textContent).toContain('Spell save DC')
			expect(attackSection.textContent).toContain('11')
			expect(container.querySelector('.sheet__spell-slots')).toBeNull()

			const spellsSection = container.querySelector('.sheet__spells')
			expect(spellsSection).not.toBeNull()
			await waitFor(() => expect(spellsSection!.textContent).toContain('Fire Bolt'))
			expect(spellsSection!.textContent).toContain('Mage Hand')
			expect(spellsSection!.textContent).toContain('Shield')

			const fireBoltSummary = Array.from(spellsSection!.querySelectorAll('summary')).find((s) => s.textContent?.includes('Fire Bolt'))!
			expect(fireBoltSummary.textContent).toContain('from feat (Magic Initiate)')
		})

		it('a non-caster with a fixed-ability feat spell (Fey Teleportation) shows it in the Spells list and a feat spellcasting entry', async () => {
			const details: SpellDetail[] = [spellDetail({ name: 'Misty Step', source: 'XPHB', level: 2, entries: ['Briefly surrounded by silvery mist.'] })]
			const featGrantedSpells: FeatGrantedSpell[] = [
				{ name: 'Misty Step', source: 'XPHB', level: 2, ritual: false, concentration: false, origin: 'feat', featName: 'Fey Teleportation', ability: 'int' },
			]
			vi.mocked(loadSpellDetails).mockResolvedValue(details)
			vi.mocked(loadFeatGrantedSpells).mockResolvedValue(featGrantedSpells)

			const fighter: Character = {
				id: 'f2',
				name: 'Fey Touched Fighter',
				classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 4 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 16, dexterity: 12, constitution: 14, intelligence: 12, wisdom: 10, charisma: 8 },
				},
				featAsiChoices: [{ level: 4, kind: 'feat', name: 'Fey Teleportation', source: 'XPHB' }],
			}

			const { container } = render(<CharacterSheet character={fighter} />)
			await screen.findByRole('heading', { name: 'Fey Touched Fighter' })

			const attackSection = container.querySelector('.sheet__spell-attacks')!
			expect(attackSection).not.toBeNull()
			expect(attackSection.textContent).toContain('Fey Teleportation (Intelligence)')
			expect(attackSection.textContent).toContain('+3')
			expect(attackSection.textContent).toContain('11')
			expect(container.querySelector('.sheet__spell-slots')).toBeNull()

			const spellsSection = container.querySelector('.sheet__spells')
			expect(spellsSection).not.toBeNull()
			await waitFor(() => expect(spellsSection!.textContent).toContain('Misty Step'))
			const summary = Array.from(spellsSection!.querySelectorAll('summary')).find((s) => s.textContent?.includes('Misty Step'))!
			expect(summary.textContent).toContain('from feat (Fey Teleportation)')
		})

		it('a non-caster with Drow High Magic (fixed-only feat) shows its spells in the Spells list', async () => {
			const details: SpellDetail[] = [
				spellDetail({ name: 'Detect Magic', source: 'XPHB', level: 1, entries: ['You sense the presence of magic.'] }),
				spellDetail({ name: 'Levitate', source: 'XPHB', level: 2, entries: ['One creature or object rises.'] }),
				spellDetail({ name: 'Dispel Magic', source: 'XPHB', level: 3, entries: ['Any spell effect ends.'] }),
			]
			const featGrantedSpells: FeatGrantedSpell[] = [
				{ name: 'Detect Magic', source: 'XPHB', level: 1, ritual: false, concentration: true, origin: 'feat', featName: 'Drow High Magic', ability: 'cha' },
				{ name: 'Levitate', source: 'XPHB', level: 2, ritual: false, concentration: true, origin: 'feat', featName: 'Drow High Magic', ability: 'cha' },
				{ name: 'Dispel Magic', source: 'XPHB', level: 3, ritual: false, concentration: false, origin: 'feat', featName: 'Drow High Magic', ability: 'cha' },
			]
			vi.mocked(loadSpellDetails).mockResolvedValue(details)
			vi.mocked(loadFeatGrantedSpells).mockResolvedValue(featGrantedSpells)

			const fighter: Character = {
				id: 'f2b',
				name: 'Drow Fighter',
				classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 5 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 16, dexterity: 12, constitution: 14, intelligence: 12, wisdom: 10, charisma: 8 },
				},
				featAsiChoices: [{ level: 4, kind: 'feat', name: 'Drow High Magic', source: 'XPHB' }],
			}

			const { container } = render(<CharacterSheet character={fighter} />)
			await screen.findByRole('heading', { name: 'Drow Fighter' })

			const spellsSection = container.querySelector('.sheet__spells')
			expect(spellsSection).not.toBeNull()
			await waitFor(() => expect(spellsSection!.textContent).toContain('Detect Magic'))
			expect(spellsSection!.textContent).toContain('Levitate')
			expect(spellsSection!.textContent).toContain('Dispel Magic')
			const summary = Array.from(spellsSection!.querySelectorAll('summary')).find((s) => s.textContent?.includes('Detect Magic'))!
			expect(summary.textContent).toContain('from feat (Drow High Magic)')
		})

		it('a non-caster with Fey-Touched shows BOTH the fixed Misty Step AND the player-chosen filter-choice spell (slice d5b-1)', async () => {
			const details: SpellDetail[] = [
				spellDetail({ name: 'Misty Step', source: 'XPHB', level: 2, entries: ['Briefly surrounded by silvery mist.'] }),
				spellDetail({ name: 'Identify', source: 'XPHB', level: 1, entries: ['You choose one object.'] }),
			]
			const featGrantedSpells: FeatGrantedSpell[] = [
				{ name: 'Misty Step', source: 'XPHB', level: 2, ritual: false, concentration: false, origin: 'feat', featName: 'Fey-Touched', ability: 'wis' },
				{ name: 'Identify', source: 'XPHB', level: 1, ritual: false, concentration: false, origin: 'feat', featName: 'Fey-Touched', ability: 'wis' },
			]
			vi.mocked(loadSpellDetails).mockResolvedValue(details)
			vi.mocked(loadFeatGrantedSpells).mockResolvedValue(featGrantedSpells)

			const fighter: Character = {
				id: 'f4',
				name: 'Fey-Touched Fighter',
				classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 4 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 16, dexterity: 12, constitution: 14, intelligence: 12, wisdom: 10, charisma: 8 },
				},
				featAsiChoices: [
					{
						level: 4,
						kind: 'feat',
						name: 'Fey-Touched',
						source: 'XPHB',
						chosenAbility: 'wisdom',
						filterChoiceSpells: { cantrips: [], spells: [{ name: 'Identify', source: 'XPHB' }] },
					},
				],
			}

			const { container } = render(<CharacterSheet character={fighter} />)
			await screen.findByRole('heading', { name: 'Fey-Touched Fighter' })

			const spellsSection = container.querySelector('.sheet__spells')
			expect(spellsSection).not.toBeNull()
			await waitFor(() => expect(spellsSection!.textContent).toContain('Misty Step'))
			expect(spellsSection!.textContent).toContain('Identify')

			const mistyStepSummary = Array.from(spellsSection!.querySelectorAll('summary')).find((s) => s.textContent?.includes('Misty Step'))!
			expect(mistyStepSummary.textContent).toContain('from feat (Fey-Touched)')
			const identifySummary = Array.from(spellsSection!.querySelectorAll('summary')).find((s) => s.textContent?.includes('Identify'))!
			expect(identifySummary.textContent).toContain('from feat (Fey-Touched)')
		})

		it('a non-caster with Ritual Caster shows the player-chosen ritual spells (slice d5b-1)', async () => {
			const details: SpellDetail[] = [
				spellDetail({ name: 'Alarm', source: 'XPHB', level: 1, entries: ['You set an alarm against intrusion.'] }),
				spellDetail({ name: 'Comprehend Languages', source: 'XPHB', level: 1, entries: ['You understand any language.'] }),
			]
			const featGrantedSpells: FeatGrantedSpell[] = [
				{ name: 'Alarm', source: 'XPHB', level: 1, ritual: true, concentration: false, origin: 'feat', featName: 'Ritual Caster', ability: 'int' },
				{ name: 'Comprehend Languages', source: 'XPHB', level: 1, ritual: true, concentration: false, origin: 'feat', featName: 'Ritual Caster', ability: 'int' },
			]
			vi.mocked(loadSpellDetails).mockResolvedValue(details)
			vi.mocked(loadFeatGrantedSpells).mockResolvedValue(featGrantedSpells)

			const fighter: Character = {
				id: 'f5',
				name: 'Ritual Fighter',
				classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 4 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 16, dexterity: 12, constitution: 14, intelligence: 12, wisdom: 10, charisma: 8 },
				},
				featAsiChoices: [
					{
						level: 4,
						kind: 'feat',
						name: 'Ritual Caster',
						source: 'XPHB',
						chosenAbility: 'intelligence',
						filterChoiceSpells: {
							cantrips: [],
							spells: [
								{ name: 'Alarm', source: 'XPHB' },
								{ name: 'Comprehend Languages', source: 'XPHB' },
							],
						},
					},
				],
			}

			const { container } = render(<CharacterSheet character={fighter} />)
			await screen.findByRole('heading', { name: 'Ritual Fighter' })

			const spellsSection = container.querySelector('.sheet__spells')
			expect(spellsSection).not.toBeNull()
			await waitFor(() => expect(spellsSection!.textContent).toContain('Alarm'))
			expect(spellsSection!.textContent).toContain('Comprehend Languages')

			const alarmSummary = Array.from(spellsSection!.querySelectorAll('summary')).find((s) => s.textContent?.includes('Alarm'))!
			expect(alarmSummary.textContent).toContain('from feat (Ritual Caster)')
			const clSummary = Array.from(spellsSection!.querySelectorAll('summary')).find((s) => s.textContent?.includes('Comprehend Languages'))!
			expect(clSummary.textContent).toContain('from feat (Ritual Caster)')
		})

		it("a non-caster (Fighter) with a Mark feat shows the mark's FIXED spell plus its own feat spellcasting entry, no slots — `expanded` never applies with no Spellcasting/Pact Magic feature to widen (D46)", async () => {
			const details: SpellDetail[] = [spellDetail({ name: 'Detect Magic', source: 'XPHB', level: 1, entries: ['You sense the presence of magic.'] })]
			const featGrantedSpells: FeatGrantedSpell[] = [
				{ name: 'Detect Magic', source: 'XPHB', level: 1, ritual: false, concentration: true, origin: 'feat', featName: 'Mark of Detection', ability: 'int' },
			]
			vi.mocked(loadSpellDetails).mockResolvedValue(details)
			vi.mocked(loadFeatGrantedSpells).mockResolvedValue(featGrantedSpells)

			const fighter: Character = {
				id: 'f4',
				name: 'Marked Fighter',
				classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 4 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 16, dexterity: 12, constitution: 14, intelligence: 12, wisdom: 10, charisma: 8 },
				},
				featAsiChoices: [{ level: 4, kind: 'feat', name: 'Mark of Detection', source: 'EFA', chosenAbility: 'intelligence' }],
			}

			const { container } = render(<CharacterSheet character={fighter} />)
			await screen.findByRole('heading', { name: 'Marked Fighter' })

			const attackSection = container.querySelector('.sheet__spell-attacks')!
			expect(attackSection).not.toBeNull()
			expect(attackSection.textContent).toContain('Mark of Detection (Intelligence)')
			expect(attackSection.textContent).toContain('+3')
			expect(attackSection.textContent).toContain('11')
			expect(container.querySelector('.sheet__spell-slots')).toBeNull()

			const spellsSection = container.querySelector('.sheet__spells')
			expect(spellsSection).not.toBeNull()
			await waitFor(() => expect(spellsSection!.textContent).toContain('Detect Magic'))
			const summary = Array.from(spellsSection!.querySelectorAll('summary')).find((s) => s.textContent?.includes('Detect Magic'))!
			expect(summary.textContent).toContain('from feat (Mark of Detection)')
		})

		it('a non-caster with no spell-granting feat shows no Spells section', async () => {
			const fighter: Character = {
				id: 'f3',
				name: 'Plain Fighter',
				classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 4 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 16, dexterity: 12, constitution: 14, intelligence: 12, wisdom: 10, charisma: 8 },
				},
				featAsiChoices: [{ level: 4, kind: 'feat', name: 'Tough', source: 'XPHB' }],
			}

			const { container } = render(<CharacterSheet character={fighter} />)
			await screen.findByRole('heading', { name: 'Plain Fighter' })

			expect(container.querySelector('.sheet__spells')).toBeNull()
		})

		it('a two-casting-class character shows two spell attack/DC entries, one per class (D11)', async () => {
			const spellcastingAbility: ClassSpellcastingAbility[] = [
				{ className: 'Wizard', classSource: 'XPHB', ability: 'int' },
				{ className: 'Cleric', classSource: 'XPHB', ability: 'wis' },
			]
			const spellSlots: ClassSpellSlotsData[] = [
				{ className: 'Wizard', classSource: 'XPHB', casterProgression: 'full', spellSlotsByLevel: [[2]], pactSlotsByLevel: null },
				{ className: 'Cleric', classSource: 'XPHB', casterProgression: 'full', spellSlotsByLevel: [[2]], pactSlotsByLevel: null },
			]
			vi.mocked(loadSpellcastingAbilityClassData).mockResolvedValue(spellcastingAbility)
			vi.mocked(loadSpellSlotsClassData).mockResolvedValue(spellSlots)

			const multiclass: Character = {
				id: 'mc1',
				name: 'Theurge',
				classes: [
					{ className: 'Wizard', classSource: 'XPHB', subclass: null, level: 1 },
					{ className: 'Cleric', classSource: 'XPHB', subclass: null, level: 1 },
				],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 8, dexterity: 12, constitution: 13, intelligence: 15, wisdom: 15, charisma: 8 },
				},
			}

			const { container } = render(<CharacterSheet character={multiclass} />)
			await screen.findByRole('heading', { name: 'Theurge' })

			const attackSection = container.querySelector('.sheet__spell-attacks')!
			expect(attackSection.textContent).toContain('Wizard (Intelligence)')
			expect(attackSection.textContent).toContain('Cleric (Wisdom)')
			expect(attackSection.querySelectorAll(':scope > ul > li')).toHaveLength(2)
		})
	})

	// Build order step 6b slice 2 — the familiar's possible forms. The spell can
	// reach a character down several paths the sheet already merges, so the
	// section keys off the COMBINED list, not off Character.spellChoices.
	describe('Find Familiar beast forms (step 6b slice 2)', () => {
		const FAMILIAR_POOL: Beast[] = [
			{
				name: 'Owl',
				source: 'XMM',
				size: ['T'],
				type: 'beast',
				cr: '0',
				crNumber: 0,
				ac: [11],
				hp: { average: 1, formula: '1d4 - 1' },
				speed: { walk: 5, fly: 60 },
				str: 3,
				dex: 13,
				con: 8,
				int: 2,
				wis: 12,
				cha: 7,
				action: [{ name: 'Talons', entries: ['{@atkr m} {@hit 3}, reach 5 ft. {@h} 1 Slashing damage.'] }],
			},
			{
				name: 'Wolf',
				source: 'XMM',
				size: ['M'],
				type: 'beast',
				cr: '1/2',
				crNumber: 0.5,
				ac: [13],
				hp: { average: 11, formula: '2d8 + 2' },
				speed: { walk: 40 },
				str: 14,
				dex: 15,
				con: 12,
				int: 3,
				wis: 12,
				cha: 6,
				action: [{ name: 'Bite', entries: ['{@atkr m} {@hit 4}, reach 5 ft. {@h} 7 Piercing damage.'] }],
			},
		]

		beforeEach(() => {
			vi.mocked(loadBeasts).mockReset().mockResolvedValue(FAMILIAR_POOL)
			vi.mocked(loadSpellDetails).mockReset().mockResolvedValue([])
			vi.mocked(loadSubclassSource).mockReset().mockResolvedValue(null)
			vi.mocked(loadSubclassAlwaysPreparedSpells).mockReset().mockResolvedValue([])
			vi.mocked(loadFeatGrantedSpells).mockReset().mockResolvedValue([])
			vi.mocked(loadOptionalFeatureGrantedSpells).mockReset().mockResolvedValue([])
			vi.mocked(loadSubclassChosenSpells).mockReset().mockResolvedValue([])
		})

		const wizard: Character = {
			id: 'ff1',
			name: 'Conjurer',
			classes: [{ className: 'Wizard', classSource: 'XPHB', subclass: null, level: 3 }],
			abilityScores: {
				method: 'standardArray',
				scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 15, wisdom: 12, charisma: 10 },
			},
			spellChoices: [{ className: 'Wizard', classSource: 'XPHB', spells: [{ name: 'Find Familiar', source: 'XPHB' }] }],
		}

		it('lists the CR 0 forms for a character who has the spell', async () => {
			const { container } = render(<CharacterSheet character={wizard} />)
			await screen.findByRole('heading', { name: 'Conjurer' })

			await waitFor(() => expect(container.querySelector('.sheet__familiar-forms')).toBeTruthy())
			const section = container.querySelector('.sheet__familiar-forms')!
			expect(section.textContent).toContain('Owl')
			// The pool is capped at CR 0 by the spell's own text — Wolf is CR 1/2.
			expect(section.textContent).not.toContain('Wolf')
		})

		it('shows the section when the spell arrives from a feat rather than a class pick', async () => {
			const featGranted: FeatGrantedSpell[] = [
				{ featName: 'Magic Initiate (Wizard)', name: 'Find Familiar', source: 'XPHB', level: 1, ritual: true, concentration: false, origin: 'feat' },
			]
			vi.mocked(loadFeatGrantedSpells).mockResolvedValue(featGranted)

			const fighter: Character = {
				id: 'ff2',
				name: 'Dabbler',
				classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 4 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 },
				},
			}

			const { container } = render(<CharacterSheet character={fighter} />)
			await screen.findByRole('heading', { name: 'Dabbler' })

			await waitFor(() => expect(container.querySelector('.sheet__familiar-forms')).toBeTruthy())
			expect(container.querySelector('.sheet__familiar-forms')!.textContent).toContain('Owl')
		})

		it('renders no section at all — and fetches nothing — for a character without the spell', async () => {
			const { container } = render(<CharacterSheet character={character} />)
			await screen.findByRole('heading', { name: 'Aria' })

			expect(container.querySelector('.sheet__familiar-forms')).toBeNull()
			expect(screen.queryByRole('heading', { name: 'Familiar forms' })).toBeNull()
			expect(vi.mocked(loadBeasts)).not.toHaveBeenCalled()
		})

		it('renders the Druid\'s known Wild Shape forms, and nothing for a character with none', async () => {
			const druid: Character = {
				id: 'ws1',
				name: 'Shifter',
				classes: [{ className: 'Druid', classSource: 'XPHB', subclass: 'Circle of the Moon', level: 6 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 10, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 15, charisma: 8 },
				},
				wildShapeForms: [{ className: 'Druid', classSource: 'XPHB', forms: [{ name: 'Wolf', source: 'XMM' }] }],
			}

			const { container } = render(<CharacterSheet character={druid} />)
			await screen.findByRole('heading', { name: 'Shifter' })

			await waitFor(() => expect(container.querySelector('.sheet__wild-shape-forms')).toBeTruthy())
			const section = container.querySelector('.sheet__wild-shape-forms')!
			expect(screen.getByRole('heading', { name: 'Wild Shape forms' })).toBeTruthy()
			expect(section.textContent).toContain('Wolf')
			expect(section.textContent).toContain('11 (2d8 + 2)') // the form's own hit points
			expect(section.textContent).toContain('13') // its AC
			expect(section.textContent).not.toContain('{@')

			cleanup()
			const { container: without } = render(<CharacterSheet character={character} />)
			await screen.findByRole('heading', { name: 'Aria' })
			expect(without.querySelector('.sheet__wild-shape-forms')).toBeNull()
		})

		it('states the gap when a stored form has no stat block (D43)', async () => {
			const druid: Character = {
				id: 'ws2',
				name: 'Lost Shifter',
				classes: [{ className: 'Druid', classSource: 'XPHB', subclass: null, level: 2 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 10, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 15, charisma: 8 },
				},
				wildShapeForms: [{ className: 'Druid', classSource: 'XPHB', forms: [{ name: 'Dire Corgi', source: 'XMM' }] }],
			}

			const { container } = render(<CharacterSheet character={druid} />)
			await screen.findByRole('heading', { name: 'Lost Shifter' })

			await waitFor(() => expect(container.querySelector('.sheet__wild-shape-forms')).toBeTruthy())
			expect(container.querySelector('.sheet__wild-shape-forms')!.textContent).toContain('Dire Corgi')
		})

		it('renders each form as a collapsed stat block with its markup resolved', async () => {
			const { container } = render(<CharacterSheet character={wizard} />)
			await screen.findByRole('heading', { name: 'Conjurer' })
			await waitFor(() => expect(container.querySelector('.sheet__familiar-forms')).toBeTruthy())

			const section = container.querySelector('.sheet__familiar-forms')!
			const details = section.querySelector('details')!
			expect(details.hasAttribute('open')).toBe(false)
			expect(details.querySelector('summary')!.textContent).toContain('Owl — Tiny Beast, CR 0')
			expect(section.textContent).toContain('Melee Attack Roll:')
			expect(section.textContent).not.toContain('{@')
		})
	})
})
