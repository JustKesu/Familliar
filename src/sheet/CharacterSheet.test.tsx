// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
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
import { loadFeatGrantedSpells, type FeatGrantedSpell } from '../spells/featSpells'
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

vi.mock('../spells/featSpells', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../spells/featSpells')>()
	return { ...actual, loadFeatGrantedSpells: vi.fn(async () => []) }
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
			...overrides,
		}
	}

	describe('spellcasting sections (build order step 6 slice d4)', () => {
		afterEach(() => {
			vi.mocked(loadSpellcastingAbilityClassData).mockReset().mockResolvedValue([])
			vi.mocked(loadSpellSlotsClassData).mockReset().mockResolvedValue([])
			vi.mocked(loadSpellDetails).mockReset().mockResolvedValue([])
			vi.mocked(loadSubclassSource).mockReset().mockResolvedValue(null)
			vi.mocked(loadSubclassAlwaysPreparedSpells).mockReset().mockResolvedValue([])
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
})
