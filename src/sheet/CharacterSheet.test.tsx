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
import type { Character, CharacterFamiliar } from '../storage/character'
import { loadAcFormulaKeys } from './armourClassData'
import { loadDamageResponseData } from './damageResponseData'
import { loadGrantedSenses, type GrantedSense } from './grantedSenses'
import { loadResolverData } from '../featureResolver'
import { loadBeasts, type Beast } from '../beasts/beastData'
import { loadChosenClassFeatureChoices } from '../classFeatureChoices/classFeatureChoiceData'
import { loadChosenClassOptionalFeatures } from '../optionalFeatures/optionalFeatureData'

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

/* Only the fetch is stubbed — familiarFormOptions and hasFindFamiliar stay real, so the section is proved against the actual filters. */
vi.mock('../beasts/beastData', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../beasts/beastData')>()
	return { ...actual, loadBeasts: vi.fn(async () => []) }
})

/* Only the items.json fetch is stubbed — itemKey/extractItemRefs and the section's own rendering run for real. */
vi.mock('../inventory/inventoryData', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../inventory/inventoryData')>()
	return {
		...actual,
		loadItemRefs: vi.fn(async () => [
			{ name: 'Backpack', source: 'XPHB' },
			{ name: 'Chain Mail', source: 'XPHB', typeCode: 'HA', armor: true, ac: 16, strength: '13', stealth: true },
			{ name: 'Leather Armor', source: 'XPHB', typeCode: 'LA', armor: true, ac: 11 },
			{
				name: 'Longsword',
				source: 'XPHB',
				typeCode: 'M',
				weapon: true,
				weaponCategory: 'martial',
				dmg1: '1d8',
				dmg2: '1d10',
				dmgTypeFull: 'slashing',
				propertyFull: ['Versatile'],
				masteryFull: ['Sap'],
			},
			{
				name: 'Rapier',
				source: 'XPHB',
				typeCode: 'M',
				weapon: true,
				weaponCategory: 'martial',
				dmg1: '1d8',
				dmgTypeFull: 'piercing',
				propertyFull: ['Finesse'],
				masteryFull: ['Vex'],
			},
			{ name: 'Shield', source: 'XPHB', typeCode: 'S', ac: 2 },
			/* Slice g: plain description text, no markup in it at all. */
			{ name: 'Torch', source: 'XPHB', entries: ['A torch sheds bright light in a 20-foot radius while it burns.'] },
			/* Slice e. Two carry a bonus of their own without attunement, one carries a bonus behind attunement. */
			{ name: 'Glamoured Studded Leather', source: 'XDMG', typeCode: 'LA', ac: 12, bonusAc: 1 },
			{
				name: 'Dagger of Venom',
				source: 'XDMG',
				typeCode: 'M',
				weaponCategory: 'martial',
				dmg1: '1d4',
				dmgTypeFull: 'piercing',
				bonusWeapon: 1,
			},
			{
				name: 'Sword of Sharpness',
				source: 'XDMG',
				typeCode: 'M',
				weaponCategory: 'martial',
				dmg1: '1d8',
				dmgTypeFull: 'slashing',
				bonusWeapon: 3,
				requiresAttunement: true,
			},
			/* Four attunement items, one of them with a restriction sentence — enough to reach the limit of three (slice d). */
			{ name: 'Amulet of Health', source: 'XDMG', requiresAttunement: true },
			/* Slice h: the flat bonuses these three carry in the real data. */
			{
				name: 'Cloak of Protection',
				source: 'XDMG',
				requiresAttunement: true,
				bonusAc: 1,
				bonusSavingThrow: 1,
				/* Slice g: description text carrying a markup tag, as the real entry does. */
				entries: ['You gain a +1 bonus to {@variantrule Armor Class|XPHB} and saving throws while you wear this cloak.'],
			},
			{ name: 'Ring of Protection', source: 'XDMG', typeCode: 'RG', requiresAttunement: true, bonusAc: 1, bonusSavingThrow: 1 },
			{ name: 'Ring of Spell Storing', source: 'XDMG', requiresAttunement: true },
			{ name: 'Wand of the War Mage, +1', source: 'XDMG', requiresAttunement: true, attunementCondition: 'by a spellcaster', bonusSpellAttack: 1 },
			{ name: 'Ioun Stone, Mastery', source: 'XDMG', requiresAttunement: true, bonusProficiencyBonus: 1 },
			/* Slice f. One resistance behind attunement, one that needs none, and one immunity. */
			{ name: 'Ring of Fire Resistance', source: 'XDMG', requiresAttunement: true, resist: ['fire'] },
			{ name: 'Acid Absorbing Tattoo', source: 'XDMG', resist: ['acid'] },
			{ name: 'Periapt of Proof against Poison', source: 'XDMG', requiresAttunement: true, immune: ['poison'] },
			/* Slice f-fix. A consumable's resistance never applies from being carried. */
			{ name: 'Potion of Fire Resistance', source: 'XPHB', typeCode: 'P', resist: ['fire'] },
		]),
	}
})

/* Only the four data-file fetches are stubbed — buildItemGrants and the collapsing/precedence rules run for real. */
vi.mock('./damageResponseData', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./damageResponseData')>()
	return { ...actual, loadDamageResponseData: vi.fn(async () => ({ speciesGrants: [], featGrants: [], featureGrants: [] })) }
})

/* Only the three feature/spell fetches behind formula detection are stubbed — buildEquippedGear and hasMageArmor run for real. */
vi.mock('./armourClassData', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./armourClassData')>()
	return { ...actual, loadAcFormulaKeys: vi.fn(async () => []) }
})

/* Only the four data-file fetches are stubbed — buildHeldWeapons and the attack arithmetic run for real. */
vi.mock('./weaponAttackData', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./weaponAttackData')>()
	return {
		...actual,
		loadWeaponAttackData: vi.fn(async () => ({
			grants: [{ kind: 'category' as const, category: 'martial' }],
			martialArtsDie: null,
			featureNames: ['Extra Attack'],
		})),
	}
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

/* Wrapping the real function rather than replacing it — the D21 tests below deliberately run the real join over stubbed resolver data. */
vi.mock('../classFeatureChoices/classFeatureChoiceData', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../classFeatureChoices/classFeatureChoiceData')>()
	return { ...actual, loadChosenClassFeatureChoices: vi.fn(actual.loadChosenClassFeatureChoices) }
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

	/*
	 * Inventory and money (build order step 7, slice a1). Asserted end to end
	 * for the same reason the sections above are: a stored pick that never
	 * reaches the sheet — or an edit the sheet never reports — has shipped more
	 * than once in this project. loadItemRefs is stubbed with a 3-item list
	 * (mock near the top of this file); the section's own rendering, resolution
	 * note and edit callbacks all run for real.
	 */
	describe('inventory and money (step 7 slice a1)', () => {
		const owner: Character = {
			...character,
			id: 'inv1',
			inventory: [
				{ name: 'Longsword', source: 'XPHB', quantity: 1 },
				{ name: 'Torch', source: 'XPHB', quantity: 5 },
			],
			currencyCopper: 1234,
		}

		it('shows a plain line and no error when the character owns nothing', async () => {
			const { container } = render(<CharacterSheet character={character} />)
			await screen.findByRole('heading', { name: 'Aria' })

			const section = container.querySelector('.sheet__inventory')!
			expect(section).toBeTruthy()
			await waitFor(() => expect(section.textContent).toContain('Nothing carried yet.'))
			expect(section.querySelector('.error')).toBeNull()
		})

		it('lists carried items with their quantities', async () => {
			const { container } = render(<CharacterSheet character={owner} />)
			await screen.findByRole('heading', { name: 'Aria' })

			const list = await waitFor(() => container.querySelector('.sheet__inventory-list')!)
			const rows = Array.from(list.querySelectorAll('li')).map((li) => li.textContent)
			expect(rows.some((text) => text?.includes('Longsword'))).toBe(true)
			expect(rows.some((text) => text?.includes('Torch') && text.includes('5'))).toBe(true)
		})

		it('shows a stored item whose data is not in the list with its name and a visible note (D43)', async () => {
			const stale: Character = {
				...character,
				id: 'inv2',
				inventory: [{ name: 'Mystery Blade', source: 'HOMEBREW', quantity: 1 }],
			}
			const { container } = render(<CharacterSheet character={stale} />)
			await screen.findByRole('heading', { name: 'Aria' })

			const section = container.querySelector('.sheet__inventory')!
			await waitFor(() => expect(section.textContent).toContain('Mystery Blade'))
			expect(section.textContent).toContain('Item data not found for "Mystery Blade" (HOMEBREW).')
		})

		it('shows money as gp/sp/cp, and reports an edit as a new copper total', async () => {
			const user = userEvent.setup()
			const onEditCurrency = vi.fn()
			render(<CharacterSheet character={owner} onEditCurrency={onEditCurrency} />)
			await screen.findByRole('heading', { name: 'Aria' })

			// 1234 cp is 12 gp 3 sp 4 cp — never 1 pp, however large the total.
			const gold = (await screen.findByLabelText('Gold')) as HTMLInputElement
			expect(gold.value).toBe('12')
			expect((screen.getByLabelText('Silver') as HTMLInputElement).value).toBe('3')
			expect((screen.getByLabelText('Copper') as HTMLInputElement).value).toBe('4')

			await user.clear(gold)
			await user.type(gold, '20')
			await user.tab() // commit on blur, not per keystroke
			// 20 gp + 3 sp + 4 cp = 2034 cp
			expect(onEditCurrency).toHaveBeenLastCalledWith(2034)
		})

		it('adds typed platinum to the stored copper total and never displays platinum', async () => {
			const user = userEvent.setup()
			const onEditCurrency = vi.fn()
			const { container } = render(<CharacterSheet character={owner} onEditCurrency={onEditCurrency} />)
			await screen.findByRole('heading', { name: 'Aria' })

			const platinum = (await screen.findByLabelText('Add platinum')) as HTMLInputElement
			expect(platinum.value).toBe('') // entry only — it has no stored value to show back
			await user.type(platinum, '3')
			await user.tab()
			// 1234 cp + 3 pp = 4234 cp, which reads as 42 gp 3 sp 4 cp
			expect(onEditCurrency).toHaveBeenLastCalledWith(4234)
			// There is no platinum FIELD to hold a value, only the add-box above.
			expect(screen.queryByLabelText('Platinum')).toBeNull()
			expect(container.querySelector('.sheet__currency')!.textContent).not.toMatch(/\d+\s*pp/)
		})

		it('reads a large pile in gold, with no platinum in the breakdown', async () => {
			const { container } = render(<CharacterSheet character={{ ...owner, id: 'inv-rich', currencyCopper: 9000 }} />)
			await screen.findByRole('heading', { name: 'Aria' })

			const money = container.querySelector('.sheet__currency')!.textContent
			expect(money).toContain('90 gp')
			expect(money).not.toMatch(/\d+\s*pp/)
		})

		it('adds an item from the searchable list at quantity 1', async () => {
			const user = userEvent.setup()
			const onEditInventory = vi.fn()
			const { container } = render(<CharacterSheet character={character} onEditInventory={onEditInventory} />)
			await screen.findByRole('heading', { name: 'Aria' })

			const section = container.querySelector('.sheet__inventory')!
			await waitFor(() => expect(section.querySelector('.option-list__toggle')).toBeTruthy())
			await user.click(section.querySelector('.option-list__toggle') as HTMLElement)
			await user.click(screen.getByRole('checkbox', { name: 'Torch (XPHB)' }))

			expect(onEditInventory).toHaveBeenCalledWith([{ name: 'Torch', source: 'XPHB', quantity: 1 }])
		})

		it('changes a quantity on commit, and floors it at 1', async () => {
			const user = userEvent.setup()
			const onEditInventory = vi.fn()
			const five: Character = { ...character, id: 'inv3', inventory: [{ name: 'Longsword', source: 'XPHB', quantity: 5 }] }
			render(<CharacterSheet character={five} onEditInventory={onEditInventory} />)
			await screen.findByRole('heading', { name: 'Aria' })

			const qty = (await screen.findByLabelText('Quantity of Longsword')) as HTMLInputElement
			await user.clear(qty)
			await user.type(qty, '3')
			await user.tab()
			expect(onEditInventory).toHaveBeenLastCalledWith([{ name: 'Longsword', source: 'XPHB', quantity: 3 }])

			// Typing 0 commits as 1, never 0 — removing is the Remove button's job.
			await user.clear(qty)
			await user.type(qty, '0')
			await user.tab()
			expect(onEditInventory).toHaveBeenLastCalledWith([{ name: 'Longsword', source: 'XPHB', quantity: 1 }])
			expect(qty.value).toBe('1')
		})

		it('removes an item as its own action', async () => {
			const user = userEvent.setup()
			const onEditInventory = vi.fn()
			const one: Character = { ...character, id: 'inv4', inventory: [{ name: 'Longsword', source: 'XPHB', quantity: 2 }] }
			const { container } = render(<CharacterSheet character={one} onEditInventory={onEditInventory} />)
			await screen.findByRole('heading', { name: 'Aria' })

			const section = container.querySelector('.sheet__inventory')!
			await waitFor(() => expect(section.querySelector('.sheet__inventory-list')).toBeTruthy())
			await user.click(screen.getByRole('button', { name: 'Remove' }))
			expect(onEditInventory).toHaveBeenCalledWith([])
		})
	})

	/*
	 * Equipped gear and Armour Class (build order step 7, slice b). Same
	 * end-to-end reason as the block above: the AC the player reads is the
	 * product of the stored equipped flag, the item data and the formula
	 * choice, and any one of the three can drop out silently.
	 */
	describe('equipped gear and Armour Class (step 7 slice b)', () => {
		function acSection(container: HTMLElement): HTMLElement {
			return container.querySelector('.sheet__armour-class') as HTMLElement
		}

		async function renderSheet(subject: Character, onEditInventory?: (inventory: Character['inventory'] & object) => void) {
			const rendered = render(<CharacterSheet character={subject} onEditInventory={onEditInventory} />)
			await screen.findByRole('heading', { name: 'Aria' })
			await waitFor(() => expect(acSection(rendered.container).querySelector('.sheet__armour-class-value')).toBeTruthy())
			return rendered
		}

		it('is 10 + Dex with nothing equipped, and the breakdown says no armour is equipped', async () => {
			const { container } = await renderSheet(character)
			// DEX 14 = +2.
			expect(acSection(container).querySelector('.sheet__armour-class-value')!.textContent).toBe('12')
			expect(acSection(container).textContent).toContain('no armour equipped')
		})

		it('armour the character owns but is not wearing changes nothing, and is named as the reason', async () => {
			const owns: Character = { ...character, id: 'ac-owns', inventory: [{ name: 'Chain Mail', source: 'XPHB', quantity: 1 }] }
			const { container } = await renderSheet(owns)
			expect(acSection(container).querySelector('.sheet__armour-class-value')!.textContent).toBe('12')
			expect(acSection(container).textContent).toContain('Chain Mail is carried but not worn')
		})

		it('worn chain mail and a held shield give 18, with the Stealth penalty shown but not computed', async () => {
			const armoured: Character = {
				...character,
				id: 'ac-armoured',
				inventory: [
					{ name: 'Chain Mail', source: 'XPHB', quantity: 1, equipped: 'worn' },
					{ name: 'Shield', source: 'XPHB', quantity: 1, equipped: 'held' },
				],
			}
			const { container } = await renderSheet(armoured)
			expect(acSection(container).querySelector('.sheet__armour-class-value')!.textContent).toBe('18')
			expect(acSection(container).textContent).toContain('Disadvantage on Stealth checks (Chain Mail)')
		})

		it('equipping reports the item as worn, and equipping a second suit says what it displaced', async () => {
			const user = userEvent.setup()
			const onEditInventory = vi.fn()
			const twoSuits: Character = {
				...character,
				id: 'ac-two-suits',
				inventory: [
					{ name: 'Chain Mail', source: 'XPHB', quantity: 1, equipped: 'worn' },
					{ name: 'Leather Armor', source: 'XPHB', quantity: 1 },
				],
			}
			const { container } = await renderSheet(twoSuits, onEditInventory)

			await user.click(screen.getByRole('button', { name: 'Equip Leather Armor' }))
			expect(onEditInventory).toHaveBeenCalledWith([
				{ name: 'Chain Mail', source: 'XPHB', quantity: 1 },
				{ name: 'Leather Armor', source: 'XPHB', quantity: 1, equipped: 'worn' },
			])
			expect(container.querySelector('.sheet__equip-notice')!.textContent).toBe(
				'Unequipped Chain Mail — only one suit of armour can be worn at a time.',
			)
		})

		it('offers the control only for gear that can be worn or held', async () => {
			const mixed: Character = {
				...character,
				id: 'ac-mixed',
				inventory: [
					{ name: 'Shield', source: 'XPHB', quantity: 1 },
					{ name: 'Torch', source: 'XPHB', quantity: 1 },
				],
			}
			await renderSheet(mixed, vi.fn())
			expect(screen.getByRole('button', { name: 'Equip Shield' })).toBeTruthy()
			expect(screen.queryByRole('button', { name: 'Equip Torch' })).toBeNull()
		})

		it('unequipping drops the flag rather than removing the item', async () => {
			const user = userEvent.setup()
			const onEditInventory = vi.fn()
			const worn: Character = { ...character, id: 'ac-unequip', inventory: [{ name: 'Chain Mail', source: 'XPHB', quantity: 1, equipped: 'worn' }] }
			await renderSheet(worn, onEditInventory)

			await user.click(screen.getByRole('button', { name: 'Unequip Chain Mail' }))
			expect(onEditInventory).toHaveBeenCalledWith([{ name: 'Chain Mail', source: 'XPHB', quantity: 1 }])
		})

		it('an equipped item the item data does not know leaves the AC marked incomplete (D43)', async () => {
			const stale: Character = { ...character, id: 'ac-stale', inventory: [{ name: 'Mystery Plate', source: 'HOMEBREW', quantity: 1, equipped: 'worn' }] }
			const { container } = await renderSheet(stale)
			expect(acSection(container).textContent).toContain('Incomplete')
			expect(acSection(container).textContent).toContain('Mystery Plate (HOMEBREW)')
		})

		it("a Barbarian's Unarmored Defense wins over the plain unarmoured number, with the loser still shown", async () => {
			vi.mocked(loadAcFormulaKeys).mockResolvedValueOnce(['barbarian-unarmored-defense'])
			const barbarian: Character = {
				...character,
				id: 'ac-barbarian',
				classes: [{ className: 'Barbarian', classSource: 'XPHB', subclass: null, level: 3 }],
			}
			const { container } = await renderSheet(barbarian)
			// DEX 14 (+2) + CON 13 (+1) + 10 = 13, against 12 unarmoured.
			await waitFor(() => expect(acSection(container).querySelector('.sheet__armour-class-value')!.textContent).toBe('13'))
			expect(acSection(container).textContent).toContain('Unarmored Defense (Barbarian) base')
			expect(acSection(container).textContent).toContain('considered (10 + Dex = 12)')
		})

		it('heavy armour worn without the Strength it requires costs 10 feet of speed, with the reason in the speed breakdown', async () => {
			const weak: Character = {
				...character,
				id: 'ac-weak',
				abilityScores: { ...character.abilityScores!, scores: { ...character.abilityScores!.scores, strength: 10 } },
				inventory: [{ name: 'Chain Mail', source: 'XPHB', quantity: 1, equipped: 'worn' }],
			}
			const { container } = await renderSheet(weak)
			const speedItem = Array.from(container.querySelectorAll('.sheet__traits li')).find((li) => li.textContent?.startsWith('Speed'))!
			await waitFor(() => expect(speedItem.textContent).toContain('20 ft.'))
			expect(speedItem.textContent).toContain('Chain Mail (Strength 13 required, you have 10)')
		})
	})

	/*
	 * Weapon attacks (build order step 7, slice c). Same end-to-end reason as
	 * the two blocks above: an attack line is the product of the stored
	 * equipped flag, the item data, the proficiency grants and the player's
	 * Finesse pick, and the tests of each piece alone never caught a section
	 * that failed to render.
	 */
	describe('weapon attacks (step 7 slice c)', () => {
		function attacksSection(container: HTMLElement): HTMLElement {
			return container.querySelector('.sheet__attacks') as HTMLElement
		}

		function attackRow(container: HTMLElement, name: string): HTMLElement {
			const row = Array.from(attacksSection(container).querySelectorAll('li')).find((li) => li.querySelector('.sheet__attack-name')?.textContent === name)
			if (!row) throw new Error(`no attack row for ${name}`)
			return row
		}

		async function renderSheet(subject: Character, onEditInventory?: (inventory: Character['inventory'] & object) => void) {
			const rendered = render(<CharacterSheet character={subject} onEditInventory={onEditInventory} />)
			await screen.findByRole('heading', { name: 'Aria' })
			await waitFor(() => expect(attacksSection(rendered.container).querySelector('.sheet__attack-list')).toBeTruthy())
			return rendered
		}

		const holding = (...names: string[]): Character['inventory'] => names.map((name) => ({ name, source: 'XPHB', quantity: 1, equipped: 'held' as const }))

		it('lists a held longsword with its to-hit, both damage figures, mastery and properties', async () => {
			const { container } = await renderSheet({ ...character, id: 'atk-longsword', inventory: holding('Longsword') })
			const row = attackRow(container, 'Longsword')
			// STR 15 (+2) + PB 3 at level 5.
			expect(row.textContent).toContain('+5')
			expect(row.querySelector('.sheet__attack-damage')!.textContent).toBe('1d8 + 2 slashing')
			expect(row.querySelector('.sheet__attack-versatile')!.textContent).toBe(' (two-handed 1d10 + 2 slashing)')
			expect(row.textContent).toContain('Mastery: Sap')
			expect(row.textContent).toContain('Properties: Versatile')
		})

		it('shows the unarmed strike every character has, and the attacks-per-action count from the feature table', async () => {
			const { container } = await renderSheet(character)
			expect(attackRow(container, 'Unarmed Strike').querySelector('.sheet__attack-damage')!.textContent).toBe('1 + 2 bludgeoning')
			// The stub grants "Extra Attack"; the count belongs to the character's turn, not to a weapon row.
			expect(attacksSection(container).querySelector('.sheet__attacks-per-action')!.textContent).toContain('2')
		})

		it('an item that is held but not a weapon does not become an attack', async () => {
			const { container } = await renderSheet({ ...character, id: 'atk-shield', inventory: holding('Shield') })
			expect(Array.from(attacksSection(container).querySelectorAll('.sheet__attack-name')).map((node) => node.textContent)).toEqual(['Unarmed Strike'])
		})

		it('switching a Finesse weapon’s ability writes the pick to the inventory row and changes the number', async () => {
			const user = userEvent.setup()
			const onEditInventory = vi.fn()
			const nimble: Character = {
				...character,
				id: 'atk-finesse',
				abilityScores: { ...character.abilityScores!, scores: { ...character.abilityScores!.scores, strength: 10, dexterity: 18 } },
				inventory: holding('Rapier'),
			}
			const { container } = await renderSheet(nimble, onEditInventory)

			// DEX 18 (+4) beats STR 10 (+0): the default is Dexterity, for +7 at PB 3.
			expect(attackRow(container, 'Rapier').textContent).toContain('+7')
			expect((screen.getByLabelText('Attack ability for Rapier') as HTMLSelectElement).value).toBe('dexterity')

			await user.selectOptions(screen.getByLabelText('Attack ability for Rapier'), 'strength')
			expect(onEditInventory).toHaveBeenCalledWith([{ name: 'Rapier', source: 'XPHB', quantity: 1, equipped: 'held', attackAbility: 'strength' }])
		})

		it('renders a stored Finesse pick that overrides the default', async () => {
			const stored: Character = {
				...character,
				id: 'atk-finesse-stored',
				abilityScores: { ...character.abilityScores!, scores: { ...character.abilityScores!.scores, strength: 10, dexterity: 18 } },
				inventory: [{ name: 'Rapier', source: 'XPHB', quantity: 1, equipped: 'held', attackAbility: 'strength' }],
			}
			const { container } = await renderSheet(stored, vi.fn())
			// STR 10 (+0) + PB 3.
			expect(attackRow(container, 'Rapier').textContent).toContain('+3')
			expect((screen.getByLabelText('Attack ability for Rapier') as HTMLSelectElement).value).toBe('strength')
		})

		it('names a held weapon the item data does not know instead of dropping it (D43)', async () => {
			const stale: Character = { ...character, id: 'atk-stale', inventory: holding('Sword of Nothing') }
			const { container } = await renderSheet(stale)
			const row = attackRow(container, 'Sword of Nothing')
			expect(row.textContent).toContain('was not found in the item data')
			expect(attackRow(container, 'Unarmed Strike')).toBeTruthy()
		})
	})

	/*
	 * Attunement (build order step 7, slice d). Same end-to-end reason as the
	 * blocks above: the count, the requirement text and the refusal are three
	 * separate paths from stored state to the screen.
	 */
	describe('attunement (step 7 slice d)', () => {
		function inventorySection(container: HTMLElement): HTMLElement {
			return container.querySelector('.sheet__inventory') as HTMLElement
		}

		function inventoryRow(container: HTMLElement, name: string): HTMLElement {
			const row = Array.from(inventorySection(container).querySelectorAll('li')).find((li) => li.textContent?.includes(name))
			if (!row) throw new Error(`no inventory row for ${name}`)
			return row
		}

		async function renderSheet(subject: Character, onEditInventory?: (inventory: Character['inventory'] & object) => void) {
			const rendered = render(<CharacterSheet character={subject} onEditInventory={onEditInventory} />)
			await screen.findByRole('heading', { name: 'Aria' })
			await waitFor(() => expect(inventorySection(rendered.container).querySelector('.sheet__attunement-count')).toBeTruthy())
			return rendered
		}

		const carrying = (...names: string[]): NonNullable<Character['inventory']> => names.map((name) => ({ name, source: 'XDMG', quantity: 1 }))

		it('shows the count without opening anything, and the breakdown says where the limit came from', async () => {
			const owner: Character = {
				...character,
				id: 'att-count',
				inventory: [{ name: 'Cloak of Protection', source: 'XDMG', quantity: 1, attuned: true }, ...carrying('Ring of Protection')],
			}
			const { container } = await renderSheet(owner)
			expect(inventorySection(container).querySelector('.sheet__attunement-count')!.textContent).toContain('1 of 3 attuned')
			expect(inventorySection(container).querySelector('.sheet__attunement details')!.textContent).toContain('the attunement rule (three magic items)')
		})

		it('marks an attuned row so it is recognisable at a glance', async () => {
			const owner: Character = { ...character, id: 'att-mark', inventory: [{ name: 'Cloak of Protection', source: 'XDMG', quantity: 1, attuned: true }] }
			const { container } = await renderSheet(owner)
			expect(inventoryRow(container, 'Cloak of Protection').querySelector('.sheet__inventory-attuned')!.textContent).toContain('attuned')
		})

		it('shows the requirement, with a restriction sentence reaching the row unchanged (D21)', async () => {
			const owner: Character = { ...character, id: 'att-text', inventory: carrying('Wand of the War Mage, +1', 'Amulet of Health') }
			const { container } = await renderSheet(owner)
			expect(inventoryRow(container, 'Wand of the War Mage, +1').querySelector('.sheet__attunement-requirement')!.textContent).toContain(
				'Requires attunement by a spellcaster',
			)
			// A requirement with no condition says only that there is one — nothing is invented to fill the gap.
			expect(inventoryRow(container, 'Amulet of Health').querySelector('.sheet__attunement-requirement')!.textContent!.trim()).toBe('Requires attunement')
		})

		it('attunes and un-attunes, writing the flag to the row', async () => {
			const user = userEvent.setup()
			const onEditInventory = vi.fn()
			const owner: Character = { ...character, id: 'att-toggle', inventory: carrying('Cloak of Protection') }
			await renderSheet(owner, onEditInventory)

			await user.click(screen.getByRole('button', { name: 'Attune to Cloak of Protection' }))
			expect(onEditInventory).toHaveBeenCalledWith([{ name: 'Cloak of Protection', source: 'XDMG', quantity: 1, attuned: true }])

			const attuned: Character = { ...owner, id: 'att-toggle-2', inventory: [{ name: 'Cloak of Protection', source: 'XDMG', quantity: 1, attuned: true }] }
			const second = vi.fn()
			cleanup()
			await renderSheet(attuned, second)
			await user.click(screen.getByRole('button', { name: 'End attunement to Cloak of Protection' }))
			expect(second).toHaveBeenCalledWith([{ name: 'Cloak of Protection', source: 'XDMG', quantity: 1 }])
		})

		it('offers no control at all for an item that does not require attunement', async () => {
			const owner: Character = { ...character, id: 'att-none', inventory: [{ name: 'Torch', source: 'XPHB', quantity: 1 }] }
			await renderSheet(owner, vi.fn())
			expect(screen.queryByRole('button', { name: 'Attune to Torch' })).toBeNull()
		})

		it('refuses a fourth attunement with a message naming the limit, and changes nothing', async () => {
			const user = userEvent.setup()
			const onEditInventory = vi.fn()
			const full: Character = {
				...character,
				id: 'att-limit',
				inventory: [
					{ name: 'Amulet of Health', source: 'XDMG', quantity: 1, attuned: true },
					{ name: 'Cloak of Protection', source: 'XDMG', quantity: 1, attuned: true },
					{ name: 'Ring of Protection', source: 'XDMG', quantity: 1, attuned: true },
					{ name: 'Wand of the War Mage, +1', source: 'XDMG', quantity: 1 },
				],
			}
			const { container } = await renderSheet(full, onEditInventory)

			await user.click(screen.getByRole('button', { name: 'Attune to Wand of the War Mage, +1' }))
			expect(onEditInventory).not.toHaveBeenCalled()
			expect(inventorySection(container).querySelector('.sheet__attune-notice')!.textContent).toBe(
				'Cannot attune to Wand of the War Mage, +1: you can be attuned to at most 3 magic items at once, and 3 already are.',
			)
		})

		it('an Artificer 10 is allowed a fourth, and refused a fifth', async () => {
			const user = userEvent.setup()
			const onEditInventory = vi.fn()
			const artificer: Character = {
				...character,
				id: 'att-artificer',
				classes: [{ className: 'Artificer', classSource: 'EFA', subclass: null, level: 10 }],
				inventory: [
					{ name: 'Amulet of Health', source: 'XDMG', quantity: 1, attuned: true },
					{ name: 'Cloak of Protection', source: 'XDMG', quantity: 1, attuned: true },
					{ name: 'Ring of Protection', source: 'XDMG', quantity: 1, attuned: true },
					{ name: 'Wand of the War Mage, +1', source: 'XDMG', quantity: 1 },
				],
			}
			const { container } = await renderSheet(artificer, onEditInventory)
			expect(inventorySection(container).querySelector('.sheet__attunement-count')!.textContent).toContain('3 of 4 attuned')

			await user.click(screen.getByRole('button', { name: 'Attune to Wand of the War Mage, +1' }))
			expect(onEditInventory).toHaveBeenLastCalledWith([
				{ name: 'Amulet of Health', source: 'XDMG', quantity: 1, attuned: true },
				{ name: 'Cloak of Protection', source: 'XDMG', quantity: 1, attuned: true },
				{ name: 'Ring of Protection', source: 'XDMG', quantity: 1, attuned: true },
				{ name: 'Wand of the War Mage, +1', source: 'XDMG', quantity: 1, attuned: true },
			])

			// The same character with the fourth already attuned: a fifth is refused, naming the raised limit.
			cleanup()
			const fifth: Character = {
				...artificer,
				id: 'att-artificer-2',
				inventory: [
					...artificer.inventory!.slice(0, 3),
					{ name: 'Wand of the War Mage, +1', source: 'XDMG', quantity: 1, attuned: true },
					{ name: 'Ring of Spell Storing', source: 'XDMG', quantity: 1 },
				],
			}
			const { container: second } = await renderSheet(fifth, vi.fn())
			expect(inventorySection(second).querySelector('.sheet__attunement-count')!.textContent).toContain('4 of 4 attuned')

			await user.click(screen.getByRole('button', { name: 'Attune to Ring of Spell Storing' }))
			expect(inventorySection(second).querySelector('.sheet__attune-notice')!.textContent).toContain('at most 4 magic items at once')
		})

		it('keeps the control on an attuned row whose item data is missing, so the attunement can be ended (D43)', async () => {
			const stale: Character = { ...character, id: 'att-stale', inventory: [{ name: 'Mystery Ring', source: 'HOMEBREW', quantity: 1, attuned: true }] }
			const { container } = await renderSheet(stale, vi.fn())
			expect(inventoryRow(container, 'Mystery Ring').textContent).toContain('Item data not found for "Mystery Ring" (HOMEBREW).')
			expect(screen.getByRole('button', { name: 'End attunement to Mystery Ring' })).toBeTruthy()
		})

		it('putting an attuned item down leaves it attuned', async () => {
			const user = userEvent.setup()
			const onEditInventory = vi.fn()
			const worn: Character = {
				...character,
				id: 'att-unequip',
				inventory: [{ name: 'Chain Mail', source: 'XPHB', quantity: 1, equipped: 'worn', attuned: true }],
			}
			await renderSheet(worn, onEditInventory)
			await user.click(screen.getByRole('button', { name: 'Unequip Chain Mail' }))
			expect(onEditInventory).toHaveBeenCalledWith([{ name: 'Chain Mail', source: 'XPHB', quantity: 1, attuned: true }])
		})
	})

	/*
	 * Magic bonuses on items (build order step 7, slice e). End to end for the
	 * same reason as the three blocks above: the number the player reads is the
	 * product of the item data, the stored bonus and the attunement flag, and
	 * the name has to come out the same in all three sections.
	 */
	describe('magic bonuses on items (step 7 slice e)', () => {
		function acSection(container: HTMLElement): HTMLElement {
			return container.querySelector('.sheet__armour-class') as HTMLElement
		}

		function inventorySection(container: HTMLElement): HTMLElement {
			return container.querySelector('.sheet__inventory') as HTMLElement
		}

		function inventoryRow(container: HTMLElement, name: string): HTMLElement {
			const row = Array.from(inventorySection(container).querySelectorAll('li')).find((li) => li.textContent?.includes(name))
			if (!row) throw new Error(`no inventory row for ${name}`)
			return row
		}

		function attackNamed(container: HTMLElement, name: string): HTMLElement {
			const row = Array.from(container.querySelectorAll('.sheet__attack-list li')).find(
				(li) => li.querySelector('.sheet__attack-name')?.textContent === name,
			)
			if (!row) throw new Error(`no attack line named ${name}`)
			return row as HTMLElement
		}

		async function renderSheet(subject: Character, onEditInventory?: (inventory: Character['inventory'] & object) => void) {
			const rendered = render(<CharacterSheet character={subject} onEditInventory={onEditInventory} />)
			await screen.findByRole('heading', { name: 'Aria' })
			await waitFor(() => expect(acSection(rendered.container).querySelector('.sheet__armour-class-value')).toBeTruthy())
			return rendered
		}

		it('an armour bonus carried by the data reaches Armour Class as its own line', async () => {
			const worn: Character = {
				...character,
				id: 'mb-armour',
				inventory: [{ name: 'Glamoured Studded Leather', source: 'XDMG', quantity: 1, equipped: 'worn' }],
			}
			const { container } = await renderSheet(worn)
			// 12 base + Dex 2 + 1 magic.
			expect(acSection(container).querySelector('.sheet__armour-class-value')!.textContent).toBe('15')
			expect(acSection(container).textContent).toContain("magic bonus (Glamoured Studded Leather's own)")
			expect(acSection(container).textContent).toContain('Glamoured Studded Leather +1')
		})

		it('a weapon bonus carried by the data reaches both the attack roll and the damage roll', async () => {
			const held: Character = { ...character, id: 'mb-weapon', inventory: [{ name: 'Dagger of Venom', source: 'XDMG', quantity: 1, equipped: 'held' }] }
			const { container } = await renderSheet(held)
			const row = attackNamed(container, 'Dagger of Venom +1')
			// STR +2, PB +3, magic +1.
			expect(row.textContent).toContain('+6')
			expect(row.querySelector('.sheet__attack-damage')!.textContent).toBe('1d4 + 3 piercing')
		})

		it('a bonus the player sets applies to a plain weapon and shows in its name everywhere', async () => {
			const held: Character = {
				...character,
				id: 'mb-player',
				inventory: [{ name: 'Longsword', source: 'XPHB', quantity: 1, equipped: 'held', magicBonus: 2 }],
			}
			const { container } = await renderSheet(held)
			const row = attackNamed(container, 'Longsword +2')
			// STR +2, PB +3, magic +2.
			expect(row.textContent).toContain('+7')
			expect(row.querySelector('.sheet__attack-damage')!.textContent).toBe('1d8 + 4 slashing')
			expect(inventoryRow(container, 'Longsword +2')).toBeTruthy()
		})

		it('a bonus the player sets replaces the item’s own instead of adding to it', async () => {
			const held: Character = {
				...character,
				id: 'mb-replace',
				inventory: [{ name: 'Dagger of Venom', source: 'XDMG', quantity: 1, equipped: 'held', magicBonus: 1 }],
			}
			const { container } = await renderSheet(held)
			const row = attackNamed(container, 'Dagger of Venom +1')
			expect(row.textContent).toContain('+6')
			expect(row.textContent).toContain("considered (+1) — not applied: replaced by the +1 set on this item")
		})

		it('withholds an unattuned item’s bonus and applies it once attuned (D76)', async () => {
			const unattuned: Character = {
				...character,
				id: 'mb-unattuned',
				inventory: [{ name: 'Sword of Sharpness', source: 'XDMG', quantity: 1, equipped: 'held' }],
			}
			const { container } = await renderSheet(unattuned)
			const withheld = attackNamed(container, 'Sword of Sharpness +3')
			expect(withheld.textContent).toContain('+5')
			expect(withheld.textContent).toContain('requires attunement and you are not attuned to it')
			expect(withheld.querySelector('.sheet__attack-damage')!.textContent).toBe('1d8 + 2 slashing')

			cleanup()
			const attuned: Character = { ...unattuned, id: 'mb-attuned', inventory: [{ ...unattuned.inventory![0], attuned: true }] }
			const { container: second } = await renderSheet(attuned)
			const applied = attackNamed(second, 'Sword of Sharpness +3')
			expect(applied.textContent).toContain('+8')
			expect(applied.querySelector('.sheet__attack-damage')!.textContent).toBe('1d8 + 5 slashing')
		})

		it('keeps two otherwise-identical items on separate rows and separate attack lines', async () => {
			const both: Character = {
				...character,
				id: 'mb-two-rows',
				inventory: [
					{ name: 'Longsword', source: 'XPHB', quantity: 1, equipped: 'held', magicBonus: 1 },
					{ name: 'Longsword', source: 'XPHB', quantity: 1, equipped: 'held' },
				],
			}
			const { container } = await renderSheet(both)
			expect(inventorySection(container).querySelectorAll('.sheet__inventory-list li').length).toBe(2)
			expect(attackNamed(container, 'Longsword +1').textContent).toContain('+6')
			expect(attackNamed(container, 'Longsword').textContent).toContain('+5')
		})

		it('offers the control only on gear, and writes the pick to the inventory row', async () => {
			const user = userEvent.setup()
			const onEditInventory = vi.fn()
			const mixed: Character = {
				...character,
				id: 'mb-control',
				inventory: [
					{ name: 'Longsword', source: 'XPHB', quantity: 1 },
					{ name: 'Backpack', source: 'XPHB', quantity: 1 },
				],
			}
			await renderSheet(mixed, onEditInventory)
			expect(screen.queryByLabelText('Magic bonus for Backpack')).toBeNull()

			await user.selectOptions(screen.getByLabelText('Magic bonus for Longsword'), '3')
			expect(onEditInventory).toHaveBeenCalledWith([
				{ name: 'Longsword', source: 'XPHB', quantity: 1, magicBonus: 3 },
				{ name: 'Backpack', source: 'XPHB', quantity: 1 },
			])
		})

		it('renders an unresolvable row that carries a bonus, named, with the problem stated (D43)', async () => {
			const stale: Character = {
				...character,
				id: 'mb-stale',
				inventory: [{ name: 'Mystery Blade', source: 'HOMEBREW', quantity: 1, equipped: 'held', magicBonus: 2 }],
			}
			const { container } = await renderSheet(stale, vi.fn())
			expect(inventoryRow(container, 'Mystery Blade +2').textContent).toContain('Item data not found for "Mystery Blade" (HOMEBREW).')
			expect(attackNamed(container, 'Mystery Blade +2').textContent).toContain('was not found in the item data')
		})
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

	describe('damage resistances and immunities (step 7 slice f)', () => {
		function section(container: HTMLElement): HTMLElement {
			return container.querySelector('.sheet__damage-responses') as HTMLElement
		}

		function lines(container: HTMLElement): string[] {
			return Array.from(section(container).querySelectorAll('.sheet__damage-response-list li')).map((li) => li.textContent ?? '')
		}

		function conditionalLines(container: HTMLElement): string[] {
			return Array.from(section(container).querySelectorAll('.sheet__damage-response-conditional li')).map((li) => li.textContent ?? '')
		}

		async function renderSheet(subject: Character) {
			const rendered = render(<CharacterSheet character={subject} />)
			await screen.findByRole('heading', { name: 'Aria' })
			await waitFor(() => expect(section(rendered.container).querySelector('.sheet__damage-response-summary')).toBeTruthy())
			return rendered
		}

		beforeEach(() => {
			vi.mocked(loadDamageResponseData).mockReset().mockResolvedValue({ speciesGrants: [], featGrants: [], featureGrants: [] })
		})

		it('shows a species-granted resistance with its source', async () => {
			vi.mocked(loadDamageResponseData).mockResolvedValue({
				speciesGrants: [{ kind: 'resistance', sourceName: 'Dwarf', damageTypes: ['poison'] }],
				featGrants: [],
				featureGrants: [],
			})
			const { container } = await renderSheet(character)

			expect(lines(container).some((text) => text.includes('Poison') && text.includes('resistance') && text.includes('Dwarf'))).toBe(true)
		})

		it('withholds an item resistance while unattuned and grants it once attuned', async () => {
			const carrying: Character = { ...character, id: 'dr-ring', inventory: [{ name: 'Ring of Fire Resistance', source: 'XDMG', quantity: 1 }] }
			const { container, unmount } = await renderSheet(carrying)

			expect(lines(container).some((text) => text.includes('Fire'))).toBe(false)
			expect(section(container).textContent).toContain('requires attunement and you are not attuned to it')
			unmount()

			const attuned: Character = { ...carrying, id: 'dr-ring-attuned', inventory: [{ name: 'Ring of Fire Resistance', source: 'XDMG', quantity: 1, attuned: true }] }
			const second = await renderSheet(attuned)

			expect(lines(second.container).some((text) => text.includes('Fire') && text.includes('Ring of Fire Resistance'))).toBe(true)
		})

		it('reads a carried Potion of Fire Resistance as a candidate, never as a resistance (slice f-fix)', async () => {
			const carrying: Character = { ...character, id: 'dr-potion', inventory: [{ name: 'Potion of Fire Resistance', source: 'XPHB', quantity: 1 }] }
			const { container } = await renderSheet(carrying)

			expect(lines(container).some((text) => text.includes('Fire'))).toBe(false)
			expect(section(container).textContent).toContain('Potion of Fire Resistance')
			expect(section(container).textContent).toContain('using items arrives in step 9')
		})

		it('shows a conditional resistance with its condition and never in the unconditional list', async () => {
			vi.mocked(loadDamageResponseData).mockResolvedValue({
				speciesGrants: [],
				featGrants: [],
				featureGrants: [
					{ kind: 'resistance', sourceName: 'Rage (Barbarian)', damageTypes: ['slashing'], condition: 'while your Rage is active' },
				],
			})
			const { container } = await renderSheet(character)

			expect(lines(container).some((text) => text.includes('Slashing'))).toBe(false)
			expect(conditionalLines(container).some((text) => text.includes('Slashing') && text.includes('while your Rage is active'))).toBe(true)
			expect(section(container).textContent).toContain('0 applying now')
		})

		it('collapses two sources of the same resistance into one line naming both', async () => {
			const carrying: Character = { ...character, id: 'dr-two', inventory: [{ name: 'Acid Absorbing Tattoo', source: 'XDMG', quantity: 1 }] }
			vi.mocked(loadDamageResponseData).mockResolvedValue({
				speciesGrants: [{ kind: 'resistance', sourceName: 'Copper Dragonborn', damageTypes: ['acid'] }],
				featGrants: [],
				featureGrants: [],
			})
			const { container } = await renderSheet(carrying)

			const acid = lines(container).filter((text) => text.includes('Acid'))
			expect(acid).toHaveLength(1)
			expect(acid[0]).toContain('Acid Absorbing Tattoo')
			expect(acid[0]).toContain('Copper Dragonborn')
		})

		it('shows an immunity superseding a resistance to the same damage type, both named', async () => {
			vi.mocked(loadDamageResponseData).mockResolvedValue({
				speciesGrants: [],
				featGrants: [],
				featureGrants: [
					{ kind: 'resistance', sourceName: 'Soul of the Forge (Cleric)', damageTypes: ['fire'] },
					{ kind: 'immunity', sourceName: 'Saint of Forge and Fire (Cleric)', damageTypes: ['fire'] },
				],
			})
			const { container } = await renderSheet(character)

			const fire = lines(container).filter((text) => text.includes('Fire'))
			expect(fire).toHaveLength(2)
			expect(fire.some((text) => text.includes('immunity') && !text.includes('superseded'))).toBe(true)
			expect(fire.some((text) => text.includes('resistance') && text.includes('superseded by immunity to Fire'))).toBe(true)
			// Only the immunity counts towards what actually applies.
			expect(section(container).textContent).toContain('1 applying now')
		})

		it('renders a source it cannot resolve, named, with the problem stated (D43)', async () => {
			const carrying: Character = { ...character, id: 'dr-missing', inventory: [{ name: 'Homebrew Cloak', source: 'HB', quantity: 1 }] }
			const { container } = await renderSheet(carrying)

			expect(section(container).textContent).toContain('Homebrew Cloak')
			expect(section(container).textContent).toContain('not found in the item data')
		})

		it('says plainly when there is nothing at all', async () => {
			const { container } = await renderSheet(character)

			expect(section(container).textContent).toContain('No damage resistances, immunities or vulnerabilities.')
		})

		it('keeps the breakdown details outside a paragraph, so the section adds no invalid nesting', async () => {
			const { container } = await renderSheet(character)

			expect(section(container).querySelector('p details')).toBeNull()
			expect(section(container).querySelector('.sheet__damage-response-summary details')).toBeTruthy()
		})
	})

	describe('flat bonuses from worn magic items (step 7 slice h)', () => {
		function acSection(container: HTMLElement): HTMLElement {
			return container.querySelector('.sheet__armour-class') as HTMLElement
		}

		function saveNamed(container: HTMLElement, ability: string): HTMLElement {
			const row = Array.from(container.querySelectorAll('.sheet__saving-throws li')).find((li) => li.textContent?.includes(`${ability}:`))
			if (!row) throw new Error(`no saving throw row for ${ability}`)
			return row as HTMLElement
		}

		async function renderSheet(subject: Character) {
			const rendered = render(<CharacterSheet character={subject} />)
			await screen.findByRole('heading', { name: subject.name })
			await waitFor(() => expect(acSection(rendered.container).querySelector('.sheet__armour-class-value')).toBeTruthy())
			return rendered
		}

		afterEach(() => {
			vi.mocked(loadSpellcastingAbilityClassData).mockReset().mockResolvedValue([])
		})

		it('an attuned Cloak of Protection reaches Armour Class AND every saving throw, each as its own line', async () => {
			const owner: Character = { ...character, id: 'fb-cloak', inventory: [{ name: 'Cloak of Protection', source: 'XDMG', quantity: 1, attuned: true }] }
			const { container } = await renderSheet(owner)

			// Unarmoured 10 + Dex 2, plus the cloak.
			expect(acSection(container).querySelector('.sheet__armour-class-value')!.textContent).toBe('13')
			expect(acSection(container).textContent).toContain('Cloak of Protection')
			// DEX save: +2 modifier, no proficiency, plus the cloak.
			expect(saveNamed(container, 'Dexterity').textContent).toContain('+3')
			expect(saveNamed(container, 'Dexterity').textContent).toContain('Cloak of Protection')
		})

		it('the same cloak carried unattuned reaches neither, and both places say why (D76)', async () => {
			const owner: Character = { ...character, id: 'fb-carried', inventory: [{ name: 'Cloak of Protection', source: 'XDMG', quantity: 1 }] }
			const { container } = await renderSheet(owner)

			expect(acSection(container).querySelector('.sheet__armour-class-value')!.textContent).toBe('12')
			expect(acSection(container).textContent).toContain('considered (+1) — not applied: requires attunement and you are not attuned to it')
			expect(saveNamed(container, 'Dexterity').textContent).toContain('+2')
			expect(saveNamed(container, 'Dexterity').textContent).toContain('considered (+1) — not applied:')
		})

		it('two attuned bonus-carrying items each get their own breakdown line', async () => {
			const owner: Character = {
				...character,
				id: 'fb-two',
				inventory: [
					{ name: 'Cloak of Protection', source: 'XDMG', quantity: 1, attuned: true },
					{ name: 'Ring of Protection', source: 'XDMG', quantity: 1, attuned: true },
				],
			}
			const { container } = await renderSheet(owner)

			expect(acSection(container).querySelector('.sheet__armour-class-value')!.textContent).toBe('14')
			const dexSave = saveNamed(container, 'Dexterity')
			expect(dexSave.textContent).toContain('+4')
			expect(dexSave.textContent).toContain('Cloak of Protection')
			expect(dexSave.textContent).toContain('Ring of Protection')
		})

		it('a spell attack bonus and a spell save DC bonus each reach their own value', async () => {
			vi.mocked(loadSpellcastingAbilityClassData).mockResolvedValue([{ className: 'Wizard', classSource: 'XPHB', ability: 'int' }])
			const wizard: Character = {
				id: 'fb-wizard',
				name: 'Elminster',
				classes: [{ className: 'Wizard', classSource: 'XPHB', subclass: null, level: 5 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 8, dexterity: 12, constitution: 13, intelligence: 16, wisdom: 12, charisma: 10 },
				},
				inventory: [{ name: 'Wand of the War Mage, +1', source: 'XDMG', quantity: 1, attuned: true }],
			}
			const { container } = await renderSheet(wizard)

			// INT +3, PB +3, wand +1. The wand carries bonusSpellAttack only, so the DC keeps 8 + 3 + 3.
			const attackSection = container.querySelector('.sheet__spell-attacks')!
			expect(attackSection.textContent).toContain('+7')
			expect(attackSection.textContent).toContain('14')
			expect(attackSection.textContent).toContain('Wand of the War Mage, +1')
		})

		it('an attuned Ioun Stone of Mastery is shown against the proficiency bonus but never changes it', async () => {
			const owner: Character = { ...character, id: 'fb-ioun', inventory: [{ name: 'Ioun Stone, Mastery', source: 'XDMG', quantity: 1, attuned: true }] }
			const { container } = await renderSheet(owner)

			const section = container.querySelector('.sheet__proficiency-bonus')!
			expect(section.textContent).toContain('+3')
			expect(section.textContent).toContain('Ioun Stone, Mastery')
			expect(section.textContent).toContain('would have to be re-routed')
		})

		it('an attuned row the item data does not know is named against the values it might have touched (D43)', async () => {
			const owner: Character = { ...character, id: 'fb-missing', inventory: [{ name: 'Amulet of Nothing', source: 'HB', quantity: 1, attuned: true }] }
			const { container } = await renderSheet(owner)

			expect(acSection(container).textContent).toContain('Amulet of Nothing')
			expect(acSection(container).textContent).toContain('attuned but not found in the item data (HB)')
			expect(saveNamed(container, 'Wisdom').textContent).toContain('attuned but not found in the item data (HB)')
			// The numbers still stand on everything that did resolve (D43).
			expect(acSection(container).querySelector('.sheet__armour-class-value')!.textContent).toBe('12')
		})
	})

	/*
	 * Item descriptions (build order step 7, slice g). The point of the slice is
	 * that the player can READ what an item does, so every test here asserts on
	 * the text that reaches the DOM, not on a prop being passed along.
	 */
	describe('item descriptions (step 7 slice g)', () => {
		async function renderSheet(subject: Character) {
			const rendered = render(<CharacterSheet character={subject} />)
			await screen.findByRole('heading', { name: 'Aria' })
			await waitFor(() => expect(rendered.container.querySelector('.sheet__inventory-list')).toBeTruthy())
			return rendered
		}

		function descriptions(container: HTMLElement): HTMLElement[] {
			return Array.from(container.querySelectorAll<HTMLElement>('.sheet__item-description'))
		}

		it('renders an item’s plain description text on its row', async () => {
			const owner: Character = { ...character, id: 'desc-plain', inventory: [{ name: 'Torch', source: 'XPHB', quantity: 1 }] }
			const { container } = await renderSheet(owner)

			const shown = descriptions(container)
			expect(shown).toHaveLength(1)
			expect(shown[0].textContent).toContain('A torch sheds bright light in a 20-foot radius while it burns.')
			// Collapsed by default: the survey found a median description of 330 characters.
			expect(shown[0].tagName).toBe('DETAILS')
			expect((shown[0] as HTMLDetailsElement).open).toBe(false)
			expect(shown[0].querySelector('summary')!.textContent).toContain('Torch')
		})

		it('renders a description’s markup through the shared renderer, not as raw braces', async () => {
			const owner: Character = { ...character, id: 'desc-markup', inventory: [{ name: 'Cloak of Protection', source: 'XDMG', quantity: 1 }] }
			const { container } = await renderSheet(owner)

			const shown = descriptions(container)
			expect(shown).toHaveLength(1)
			const text = shown[0].textContent!
			expect(text).toContain('You gain a +1 bonus to Armor Class and saving throws while you wear this cloak.')
			expect(text).not.toContain('{@')
			expect(text).not.toContain('|XPHB')
			// The renderer's own element, carrying the reference it kept (D4) — proof the shared layer ran.
			expect(shown[0].querySelector('[data-ref-category="variantrule"]')!.textContent).toBe('Armor Class')
		})

		it('shows no description section for an item that has none', async () => {
			const owner: Character = { ...character, id: 'desc-none', inventory: [{ name: 'Backpack', source: 'XPHB', quantity: 1 }] }
			const { container } = await renderSheet(owner)

			// Absent text is not an error (D43) — the row is there, the section is not.
			expect(container.querySelector('.sheet__inventory-list')!.textContent).toContain('Backpack')
			expect(descriptions(container)).toHaveLength(0)
			expect(container.querySelector('.sheet__inventory')!.textContent).not.toContain('Description of')
		})

		it('an unresolvable row still renders, named, with the problem stated and no description (D43)', async () => {
			const owner: Character = { ...character, id: 'desc-missing', inventory: [{ name: 'Mystery Blade', source: 'HOMEBREW', quantity: 1 }] }
			const { container } = await renderSheet(owner)

			const section = container.querySelector('.sheet__inventory')!
			expect(section.textContent).toContain('Mystery Blade')
			expect(section.textContent).toContain('Item data not found for "Mystery Blade" (HOMEBREW).')
			expect(descriptions(container)).toHaveLength(0)
		})

		it('gives the description of each row separately, naming the item it belongs to', async () => {
			const owner: Character = {
				...character,
				id: 'desc-two',
				inventory: [
					{ name: 'Torch', source: 'XPHB', quantity: 1 },
					{ name: 'Cloak of Protection', source: 'XDMG', quantity: 1 },
				],
			}
			const { container } = await renderSheet(owner)

			const summaries = descriptions(container).map((details) => details.querySelector('summary')!.textContent)
			expect(summaries).toEqual(['Description of Torch', 'Description of Cloak of Protection'])
		})
	})

	/*
	 * The proficiency bonus block used to put ValueBreakdown's <details> inside a
	 * <p>, which is invalid nesting and warned on every render. Guarded here so
	 * the console noise four reports listed cannot come back.
	 */
	describe('the proficiency bonus breakdown nests validly', () => {
		it('does not put a <details> inside a <p>', async () => {
			const { container } = render(<CharacterSheet character={character} />)
			await screen.findByRole('heading', { name: 'Aria' })

			const section = container.querySelector('.sheet__proficiency-bonus')!
			expect(section.querySelector('details')).toBeTruthy()
			expect(section.querySelector('p details')).toBeNull()
			expect(section.querySelector('p')).toBeNull()
		})

		/* The other half of the same warning: initiative renders the same CalculatedNumber the same way. */
		it('does not put a <details> inside a <p> in the initiative block either', async () => {
			const { container } = render(<CharacterSheet character={character} />)
			await screen.findByRole('heading', { name: 'Aria' })

			const section = container.querySelector('.sheet__initiative')!
			expect(section.querySelector('details')).toBeTruthy()
			expect(section.querySelector('p')).toBeNull()
		})
	})

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

		it('an Archfey Warlock at level 3 shows its "_"-keyed patron spell (Misty Step) on the sheet, named for the subclass (this task)', async () => {
			const spellcastingAbility: ClassSpellcastingAbility[] = [{ className: 'Warlock', classSource: 'XPHB', ability: 'cha' }]
			const alwaysPrepared: AlwaysPreparedSpell[] = [
				{ name: 'Misty Step', source: 'XPHB', level: 2, grantedAtLevel: 3, ritual: false, concentration: false, origin: 'subclass' },
			]
			const details: SpellDetail[] = [spellDetail({ name: 'Misty Step', source: 'XPHB', level: 2, entries: ['Briefly surrounded by silver mist, you teleport up to 30 feet.'] })]
			vi.mocked(loadSpellcastingAbilityClassData).mockResolvedValue(spellcastingAbility)
			vi.mocked(loadSpellSlotsClassData).mockResolvedValue([])
			vi.mocked(loadSpellDetails).mockResolvedValue(details)
			vi.mocked(loadSubclassSource).mockResolvedValue('XPHB')
			vi.mocked(loadSubclassAlwaysPreparedSpells).mockResolvedValue(alwaysPrepared)

			const warlock: Character = {
				id: 'wl3',
				name: 'Fey Pact',
				classes: [{ className: 'Warlock', classSource: 'XPHB', subclass: 'Archfey Patron', level: 3 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 10, dexterity: 10, constitution: 13, intelligence: 10, wisdom: 10, charisma: 16 },
				},
			}

			const { container } = render(<CharacterSheet character={warlock} />)
			await screen.findByRole('heading', { name: 'Fey Pact' })

			await waitFor(() => expect(container.querySelector('.sheet__spells')?.textContent).toContain('Misty Step'))
			const spellsSection = container.querySelector('.sheet__spells')!

			const mistyStepSummary = Array.from(spellsSection.querySelectorAll('summary')).find((s) => s.textContent?.includes('Misty Step'))!
			expect(mistyStepSummary.textContent).toContain('always prepared (Archfey Patron)')
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
		 * This task: Mask of Many Faces grants Disguise Self with NO wrapper key
		 * in the data at all — its "without expending a spell slot" fact lives
		 * only in prose (docs/REPORT.md). Per Daniel's decision, a bare grant
		 * from a chosen optional feature is labeled "no spell slot", not "at
		 * will" — the data never says HOW OFTEN, only that no slot is spent.
		 */
		it('a spell granted by a chosen invocation with NO wrapper (Mask of Many Faces) shows both the invocation name AND "no spell slot" (this task)', async () => {
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
					usage: { kind: 'noSlot' },
				},
			]
			vi.mocked(loadSpellcastingAbilityClassData).mockResolvedValue(spellcastingAbility)
			vi.mocked(loadSpellSlotsClassData).mockResolvedValue(spellSlots)
			vi.mocked(loadSpellDetails).mockResolvedValue(details)
			vi.mocked(loadOptionalFeatureGrantedSpells).mockResolvedValue(granted)

			const warlock: Character = {
				id: 'wl4',
				name: 'Many Faces Warlock',
				classes: [{ className: 'Warlock', classSource: 'XPHB', subclass: null, level: 2 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 10, dexterity: 10, constitution: 13, intelligence: 10, wisdom: 10, charisma: 16 },
				},
				optionalFeatureChoices: [{ featureType: 'EI', choices: ['Mask of Many Faces'] }],
			}

			const { container } = render(<CharacterSheet character={warlock} />)
			await screen.findByRole('heading', { name: 'Many Faces Warlock' })

			const spellsSection = container.querySelector('.sheet__spells')!
			await waitFor(() => expect(spellsSection.textContent).toContain('Disguise Self'))

			const summary = Array.from(spellsSection.querySelectorAll('summary')).find((s) => s.textContent?.includes('Disguise Self'))!
			expect(summary.textContent).toContain('from invocation (Mask of Many Faces)')
			expect(summary.textContent).toContain('no spell slot')
			expect(summary.textContent).not.toContain('at will')
		})

		it('a rest-limited feat-granted spell (Fey Teleportation, real shape `daily: {"1": [...]}`) shows the rest its own text names, never "1/day"', async () => {
			const details: SpellDetail[] = [spellDetail({ name: 'Misty Step', source: 'XPHB', level: 2, entries: ['Briefly surrounded by silvery mist.'] })]
			const featGrantedSpells: FeatGrantedSpell[] = [
				{
					name: 'Misty Step',
					source: 'XPHB',
					level: 2,
					ritual: false,
					concentration: false,
					origin: 'feat',
					featName: 'Fey Teleportation',
					ability: 'int',
					usage: { kind: 'onceFreePerShortOrLongRest' },
				},
			]
			vi.mocked(loadSpellDetails).mockResolvedValue(details)
			vi.mocked(loadFeatGrantedSpells).mockResolvedValue(featGrantedSpells)

			const fighter: Character = {
				id: 'f5',
				name: 'Daily Teleporter',
				classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 4 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 16, dexterity: 12, constitution: 14, intelligence: 12, wisdom: 10, charisma: 8 },
				},
				featAsiChoices: [{ level: 4, kind: 'feat', name: 'Fey Teleportation', source: 'XPHB' }],
			}

			const { container } = render(<CharacterSheet character={fighter} />)
			await screen.findByRole('heading', { name: 'Daily Teleporter' })

			const spellsSection = container.querySelector('.sheet__spells')!
			await waitFor(() => expect(spellsSection.textContent).toContain('Misty Step'))

			const summary = Array.from(spellsSection.querySelectorAll('summary')).find((s) => s.textContent?.includes('Misty Step'))!
			expect(summary.textContent).toContain('from feat (Fey Teleportation)')
			expect(summary.textContent).toContain('1/short or long rest (no slot)')
			expect(summary.textContent).not.toContain('/day')
		})

		it('an ordinary always-prepared spell (no usage wrapper in the data) shows its provenance with NO usage label at all (this task)', async () => {
			const spellcastingAbility: ClassSpellcastingAbility[] = [{ className: 'Cleric', classSource: 'XPHB', ability: 'wis' }]
			const spellSlots: ClassSpellSlotsData[] = [{ className: 'Cleric', classSource: 'XPHB', casterProgression: 'full', spellSlotsByLevel: [[2], [3]], pactSlotsByLevel: null }]
			const alwaysPrepared: AlwaysPreparedSpell[] = [
				{ name: 'Cure Wounds', source: 'XPHB', level: 1, grantedAtLevel: 3, ritual: false, concentration: false, origin: 'subclass' },
			]
			const details: SpellDetail[] = [spellDetail({ name: 'Cure Wounds', source: 'XPHB', level: 1, entries: ['A creature you touch regains hit points.'] })]
			vi.mocked(loadSpellcastingAbilityClassData).mockResolvedValue(spellcastingAbility)
			vi.mocked(loadSpellSlotsClassData).mockResolvedValue(spellSlots)
			vi.mocked(loadSpellDetails).mockResolvedValue(details)
			vi.mocked(loadSubclassSource).mockResolvedValue('XPHB')
			vi.mocked(loadSubclassAlwaysPreparedSpells).mockResolvedValue(alwaysPrepared)

			const cleric: Character = {
				id: 'cl9',
				name: 'Ordinary Domain Priest',
				classes: [{ className: 'Cleric', classSource: 'XPHB', subclass: 'Life Domain', level: 3 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 10, dexterity: 10, constitution: 13, intelligence: 10, wisdom: 16, charisma: 10 },
				},
			}

			const { container } = render(<CharacterSheet character={cleric} />)
			await screen.findByRole('heading', { name: 'Ordinary Domain Priest' })

			const spellsSection = container.querySelector('.sheet__spells')!
			await waitFor(() => expect(spellsSection.textContent).toContain('Cure Wounds'))

			const summary = Array.from(spellsSection.querySelectorAll('summary')).find((s) => s.textContent?.includes('Cure Wounds'))!
			expect(summary.textContent).toContain('always prepared (Life Domain)')
			for (const term of ['at will', '/day', 'no spell slot', 'ritual (no slot)']) {
				expect(summary.textContent).not.toContain(term)
			}
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

		it("a Magic Initiate level-1 pick shows the \"1/long rest (no slot)\" usage term next to its provenance (chosen-spell usage terms)", async () => {
			const spellcastingAbility: ClassSpellcastingAbility[] = [{ className: 'Cleric', classSource: 'XPHB', ability: 'wis' }]
			const spellSlots: ClassSpellSlotsData[] = [{ className: 'Cleric', classSource: 'XPHB', casterProgression: 'full', spellSlotsByLevel: [[2]], pactSlotsByLevel: null }]
			const details: SpellDetail[] = [spellDetail({ name: 'Ray of Sickness', source: 'XPHB', level: 1, entries: ['A ray of sickening greenish energy.'] })]
			const featGrantedSpells: FeatGrantedSpell[] = [
				{ name: 'Ray of Sickness', source: 'XPHB', level: 1, ritual: false, concentration: false, origin: 'feat', featName: 'Magic Initiate', ability: 'int', usage: { kind: 'onceFreePerLongRest' } },
			]
			vi.mocked(loadSpellcastingAbilityClassData).mockResolvedValue(spellcastingAbility)
			vi.mocked(loadSpellSlotsClassData).mockResolvedValue(spellSlots)
			vi.mocked(loadSpellDetails).mockResolvedValue(details)
			vi.mocked(loadFeatGrantedSpells).mockResolvedValue(featGrantedSpells)

			const cleric: Character = {
				id: 'cl3',
				name: 'Magic Initiate Cleric 2',
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
						magicInitiate: { className: 'Wizard', classSource: 'XPHB', cantrips: [], spell: { name: 'Ray of Sickness', source: 'XPHB' } },
					},
				],
			}

			const { container } = render(<CharacterSheet character={cleric} />)
			await screen.findByRole('heading', { name: 'Magic Initiate Cleric 2' })

			const spellsSection = container.querySelector('.sheet__spells')!
			await waitFor(() => expect(spellsSection.textContent).toContain('Ray of Sickness'))
			const summary = Array.from(spellsSection.querySelectorAll('summary')).find((s) => s.textContent?.includes('Ray of Sickness'))!
			expect(summary.textContent).toContain('from feat (Magic Initiate)')
			expect(summary.textContent).toContain('1/long rest (no slot)')
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
			// Not a Beast, and above the spell's CR 0 cap: in the file only because Pact of the Chain names it.
			{
				name: 'Imp',
				source: 'XMM',
				size: ['T'],
				type: { type: 'fiend', tags: ['devil'] },
				cr: '1',
				crNumber: 1,
				ac: [13],
				hp: { average: 21, formula: '6d4 + 6' },
				speed: { walk: 20, fly: 40 },
				str: 6,
				dex: 17,
				con: 13,
				int: 11,
				wis: 12,
				cha: 14,
				languages: ['Common', 'Infernal'],
				spellcasting: [{ name: 'Invisibility', headerEntries: ['The imp casts {@spell Invisibility|XPHB} on itself.'] }],
				pactOfTheChain: true,
				action: [{ name: 'Sting', entries: ['{@atkr m} {@hit 5}, reach 5 ft. {@h} 6 Piercing damage.'] }],
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

			await waitFor(() => expect(container.querySelector('.sheet__familiar')).toBeTruthy())
			const section = container.querySelector('.sheet__familiar')!
			expect(section.textContent).toContain('Owl')
			// The pool is capped at CR 0 by the spell's own text — Wolf is CR 1/2.
			expect(section.textContent).not.toContain('Wolf')
		})

		it('says plainly that nothing is summoned when no form is chosen', async () => {
			const { container } = render(<CharacterSheet character={wizard} />)
			await screen.findByRole('heading', { name: 'Conjurer' })

			await waitFor(() => expect(container.querySelector('.sheet__familiar')).toBeTruthy())
			const section = container.querySelector('.sheet__familiar')!
			expect(section.querySelector('.sheet__familiar-none')!.textContent).toContain('No familiar is summoned')
			// The picker is the shared searchable control; with nothing chosen it starts open
			// so a form can be picked, and every option carries its own collapsed stat block.
			const toggle = section.querySelector('.option-list__toggle')!
			expect(toggle.getAttribute('aria-expanded')).toBe('true')
			expect((screen.getByRole('radio', { name: 'No familiar summoned' }) as HTMLInputElement).checked).toBe(true)
			expect(section.querySelector('details.beast')).toBeTruthy()
		})

		it('shows the chosen form as an open stat block instead of the prompt', async () => {
			const user = userEvent.setup()
			const withFamiliar: Character = { ...wizard, familiar: { name: 'Owl', source: 'XMM' } }
			const { container } = render(<CharacterSheet character={withFamiliar} />)
			await screen.findByRole('heading', { name: 'Conjurer' })

			await waitFor(() => expect(container.querySelector('.sheet__familiar')).toBeTruthy())
			const section = container.querySelector('.sheet__familiar')!
			expect(section.querySelector('.sheet__familiar-none')).toBeNull()
			// Exactly one stat block is open: the summoned form, shown below the picker.
			const chosen = section.querySelector('details.beast[open]')!
			expect(chosen.querySelector('summary')!.textContent).toContain('Owl')

			// The control auto-collapses once a form is chosen; opening it shows Owl selected.
			const toggle = section.querySelector('.option-list__toggle')!
			expect(toggle.getAttribute('aria-expanded')).toBe('false')
			await user.click(toggle)
			expect((screen.getByRole('radio', { name: /Owl/ }) as HTMLInputElement).checked).toBe(true)
		})

		it('states the gap when the stored form is not one this familiar can take (D43)', async () => {
			const stale: Character = { ...wizard, familiar: { name: 'Imp', source: 'XMM' } }
			const { container } = render(<CharacterSheet character={stale} />)
			await screen.findByRole('heading', { name: 'Conjurer' })

			await waitFor(() => expect(container.querySelector('.sheet__familiar')).toBeTruthy())
			const section = container.querySelector('.sheet__familiar')!
			expect(section.textContent).toContain('"Imp" (XMM) is not a form this familiar can take')
		})

		it('reports a pick to the caller, and clearing it as null', async () => {
			const user = userEvent.setup()
			const onChooseFamiliar = vi.fn()
			const { container, unmount } = render(<CharacterSheet character={wizard} onChooseFamiliar={onChooseFamiliar} />)
			await screen.findByRole('heading', { name: 'Conjurer' })
			await waitFor(() => expect(container.querySelector('.sheet__familiar')).toBeTruthy())

			await user.click(screen.getByRole('radio', { name: /Owl/ }))
			expect(onChooseFamiliar).toHaveBeenCalledWith({ name: 'Owl', source: 'XMM' })

			// With a form on record the list starts collapsed; open it and pick "No familiar summoned".
			unmount()
			const withFamiliar: Character = { ...wizard, familiar: { name: 'Owl', source: 'XMM' } }
			render(<CharacterSheet character={withFamiliar} onChooseFamiliar={onChooseFamiliar} />)
			await screen.findByRole('heading', { name: 'Conjurer' })
			await waitFor(() => expect(document.querySelector('.sheet__familiar')).toBeTruthy())
			await user.click(document.querySelector('.sheet__familiar .option-list__toggle') as HTMLElement)
			await user.click(screen.getByRole('radio', { name: 'No familiar summoned' }))
			expect(onChooseFamiliar).toHaveBeenLastCalledWith(null)
		})

		it('offers the Pact of the Chain forms only to a Warlock who took the invocation', async () => {
			const chainWarlock: Character = {
				id: 'ff3',
				name: 'Chainer',
				classes: [{ className: 'Warlock', classSource: 'XPHB', subclass: 'Fiend Patron', level: 3 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 15 },
				},
				optionalFeatureChoices: [{ featureType: 'EI', choices: ['Pact of the Chain'] }],
			}
			vi.mocked(loadOptionalFeatureGrantedSpells).mockResolvedValue([
				{
					name: 'Find Familiar',
					source: 'XPHB',
					level: 1,
					ritual: true,
					concentration: false,
					origin: 'optionalFeature',
					optionName: 'Pact of the Chain',
				},
			])

			const { container } = render(<CharacterSheet character={chainWarlock} />)
			await screen.findByRole('heading', { name: 'Chainer' })
			await waitFor(() => expect(container.querySelector('.sheet__familiar')).toBeTruthy())

			const section = container.querySelector('.sheet__familiar')!
			expect(section.textContent).toContain('Imp')
			expect(section.querySelector('.sheet__familiar-origin')!.textContent).toContain('Pact of the Chain')

			// A Wizard with the same spell and no invocation is offered the spell's own pool only.
			cleanup()
			vi.mocked(loadOptionalFeatureGrantedSpells).mockResolvedValue([])
			const { container: plain } = render(<CharacterSheet character={wizard} />)
			await screen.findByRole('heading', { name: 'Conjurer' })
			await waitFor(() => expect(plain.querySelector('.sheet__familiar')).toBeTruthy())
			expect(plain.querySelector('.sheet__familiar')!.textContent).not.toContain('Imp')
			expect(plain.querySelector('.sheet__familiar .sheet__familiar-origin')).toBeNull()
		})

		/** A chain Warlock has two forms in the pool (Owl from the spell, Imp from the pact) — enough to filter. */
		function chainWarlock(familiar?: CharacterFamiliar): Character {
			return {
				id: 'ffchain',
				name: 'Chainer',
				classes: [{ className: 'Warlock', classSource: 'XPHB', subclass: 'Fiend Patron', level: 3 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 10, wisdom: 12, charisma: 15 },
				},
				optionalFeatureChoices: [{ featureType: 'EI', choices: ['Pact of the Chain'] }],
				...(familiar ? { familiar } : {}),
			}
		}

		it('filters the familiar forms by name as the player types', async () => {
			const user = userEvent.setup()
			vi.mocked(loadOptionalFeatureGrantedSpells).mockResolvedValue([
				{ name: 'Find Familiar', source: 'XPHB', level: 1, ritual: true, concentration: false, origin: 'optionalFeature', optionName: 'Pact of the Chain' },
			])
			render(<CharacterSheet character={chainWarlock()} onChooseFamiliar={vi.fn()} />)
			await screen.findByRole('heading', { name: 'Chainer' })
			await waitFor(() => expect(document.querySelector('.sheet__familiar')).toBeTruthy())

			expect(screen.getByRole('radio', { name: /Owl/ })).toBeTruthy()
			await user.type(screen.getByLabelText('Search Familiar form'), 'imp')
			expect(screen.getByRole('radio', { name: /Imp/ })).toBeTruthy()
			expect(screen.queryByRole('radio', { name: /Owl/ })).toBeNull()
		})

		it('keeps the chosen familiar form visible and selected through a non-matching search', async () => {
			const user = userEvent.setup()
			vi.mocked(loadOptionalFeatureGrantedSpells).mockResolvedValue([
				{ name: 'Find Familiar', source: 'XPHB', level: 1, ritual: true, concentration: false, origin: 'optionalFeature', optionName: 'Pact of the Chain' },
			])
			render(<CharacterSheet character={chainWarlock({ name: 'Imp', source: 'XMM' })} onChooseFamiliar={vi.fn()} />)
			await screen.findByRole('heading', { name: 'Chainer' })
			await waitFor(() => expect(document.querySelector('.sheet__familiar')).toBeTruthy())

			await user.click(document.querySelector('.sheet__familiar .option-list__toggle') as HTMLElement)
			await user.type(screen.getByLabelText('Search Familiar form'), 'owl')
			const imp = screen.getByRole('radio', { name: /Imp/ }) as HTMLInputElement
			expect(imp.checked).toBe(true)
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

			await waitFor(() => expect(container.querySelector('.sheet__familiar')).toBeTruthy())
			expect(container.querySelector('.sheet__familiar')!.textContent).toContain('Owl')
		})

		it('renders no section at all — and fetches nothing — for a character without the spell', async () => {
			const { container } = render(<CharacterSheet character={character} />)
			await screen.findByRole('heading', { name: 'Aria' })

			expect(container.querySelector('.sheet__familiar')).toBeNull()
			expect(screen.queryByRole('heading', { name: 'Familiar' })).toBeNull()
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
			await waitFor(() => expect(container.querySelector('.sheet__familiar')).toBeTruthy())

			const section = container.querySelector('.sheet__familiar')!
			const details = section.querySelector('details.beast')!
			expect(details.hasAttribute('open')).toBe(false)
			expect(details.querySelector('summary')!.textContent).toContain('Owl — Tiny Beast, CR 0')
			expect(section.textContent).toContain('Melee Attack Roll:')
			expect(section.textContent).not.toContain('{@')
		})
	})

	/*
	 * D43, both halves: a per-character grant load that fails says so in the
	 * section it feeds (an empty section and a section that could not be built
	 * must never look alike), and one failed load never takes the sheet down.
	 */
	describe('a failed grant load is visible, and the rest of the sheet survives it', () => {
		const warlock: Character = {
			id: 'w9',
			name: 'Unlucky Warlock',
			classes: [{ className: 'Warlock', classSource: 'XPHB', subclass: 'Fiend Patron', level: 5 }],
			species: { name: 'Elf', source: 'XPHB' },
			abilityScores: {
				method: 'standardArray',
				scores: { strength: 10, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 8, charisma: 15 },
			},
			optionalFeatureChoices: [{ featureType: 'EI', choices: ['Devil’s Sight'] }],
			featAsiChoices: [{ level: 4, kind: 'feat', name: 'Fey-Touched', source: 'XPHB' }],
		}

		afterEach(() => {
			vi.mocked(loadSubclassSource).mockReset().mockResolvedValue(null)
			vi.mocked(loadSubclassAlwaysPreparedSpells).mockReset().mockResolvedValue([])
			vi.mocked(loadFeatGrantedSpells).mockReset().mockResolvedValue([])
			vi.mocked(loadOptionalFeatureGrantedSpells).mockReset().mockResolvedValue([])
			vi.mocked(loadGrantedSenses).mockReset().mockResolvedValue([])
			vi.mocked(loadBeasts).mockReset().mockResolvedValue([])
		})

		/** Every one of these renders the whole sheet, so each test asserts the failure is stated AND the sheet around it is intact. */
		async function renderAfterFailure(): Promise<HTMLElement> {
			const { container } = render(<CharacterSheet character={warlock} />)
			await screen.findByRole('heading', { name: 'Unlucky Warlock' })
			await waitFor(() => expect(container.querySelector('.error')).toBeTruthy())
			expect(container.querySelector('.sheet__abilities')!.textContent).toContain('Charisma')
			expect(container.querySelector('.sheet__skills')).toBeTruthy()
			return container
		}

		it('a failed subclass always-prepared load says so in the Spells section', async () => {
			vi.mocked(loadSubclassSource).mockResolvedValue('XPHB')
			vi.mocked(loadSubclassAlwaysPreparedSpells).mockRejectedValue(new Error('data/classes.json — HTTP 500'))

			const container = await renderAfterFailure()
			const spells = container.querySelector('.sheet__spells')!
			expect(spells.textContent).toContain('Could not load always-prepared subclass spells: data/classes.json — HTTP 500')
		})

		it('a failed feat-spell load says so in the Spells section', async () => {
			vi.mocked(loadFeatGrantedSpells).mockRejectedValue(new Error('data/feats.json — HTTP 500'))

			const container = await renderAfterFailure()
			expect(container.querySelector('.sheet__spells')!.textContent).toContain('Could not load feat-granted spells: data/feats.json — HTTP 500')
		})

		it('a failed invocation-spell load says so in the Spells section', async () => {
			vi.mocked(loadOptionalFeatureGrantedSpells).mockRejectedValue(new Error('data/optional-features.json — HTTP 500'))

			const container = await renderAfterFailure()
			expect(container.querySelector('.sheet__spells')!.textContent).toContain(
				'Could not load spells granted by your chosen options: data/optional-features.json — HTTP 500',
			)
		})

		it('a failed granted-senses load says so under Senses, naming Darkvision as possibly short too', async () => {
			vi.mocked(loadGrantedSenses).mockRejectedValue(new Error('data/feats.json — HTTP 500'))

			const container = await renderAfterFailure()
			const senses = container.querySelector('.sheet__senses')!
			expect(senses.textContent).toContain('Could not load senses granted by feats and invocations: data/feats.json — HTTP 500')
			expect(senses.textContent).toContain('Darkvision')
			// The traits row still renders its own species-derived value rather than disappearing.
			expect(container.querySelector('.sheet__traits')!.textContent).toContain('Darkvision:')
		})

		it('a failed class-optional-feature load says so under its own heading', async () => {
			vi.mocked(loadChosenClassOptionalFeatures).mockRejectedValueOnce(new Error('data/optional-features.json — HTTP 500'))

			const container = await renderAfterFailure()
			expect(container.querySelector('.sheet__class-optional-features')!.textContent).toContain(
				'Could not load the options chosen for your class: data/optional-features.json — HTTP 500',
			)
		})

		it('a failed class-feature-choice load says so under its own heading', async () => {
			vi.mocked(loadChosenClassFeatureChoices).mockRejectedValueOnce(new Error('data/class-features.json — HTTP 500'))

			const container = await renderAfterFailure()
			expect(container.querySelector('.sheet__class-feature-choices')!.textContent).toContain(
				'Could not load class feature choices: data/class-features.json — HTTP 500',
			)
		})

		it('a failed beast load keeps the Familiar section, states the cause, and still names the stored form', async () => {
			vi.mocked(loadBeasts).mockRejectedValue(new Error('data/beasts.json — HTTP 500'))
			const conjurer: Character = {
				id: 'ff9',
				name: 'Unlucky Conjurer',
				classes: [{ className: 'Bard', classSource: 'XPHB', subclass: null, level: 3 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 15 },
				},
				spellChoices: [{ className: 'Bard', classSource: 'XPHB', spells: [{ name: 'Find Familiar', source: 'XPHB' }] }],
				familiar: { name: 'Owl', source: 'XMM' },
			}

			const { container } = render(<CharacterSheet character={conjurer} />)
			await screen.findByRole('heading', { name: 'Unlucky Conjurer' })
			await waitFor(() => expect(container.querySelector('.sheet__familiar')).toBeTruthy())

			const section = container.querySelector('.sheet__familiar')!
			expect(section.textContent).toContain('Could not load the Beast forms a familiar can take: data/beasts.json — HTTP 500')
			expect(section.textContent).toContain('Summoned form on record: Owl (XMM)')
			// Never the misattributed message the empty pool would otherwise produce.
			expect(section.textContent).not.toContain('is not a form this familiar can take')
			expect(container.querySelector('.sheet__abilities')!.textContent).toContain('Charisma')
			expect(container.querySelector('.sheet__skills')).toBeTruthy()
		})

		it('a failed beast load names itself in the Wild Shape section instead of blaming each form', async () => {
			vi.mocked(loadBeasts).mockRejectedValue(new Error('data/beasts.json — HTTP 500'))
			const druid: Character = {
				id: 'ws9',
				name: 'Unlucky Shifter',
				classes: [{ className: 'Druid', classSource: 'XPHB', subclass: null, level: 4 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 10, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 15, charisma: 8 },
				},
				wildShapeForms: [{ className: 'Druid', classSource: 'XPHB', forms: [{ name: 'Wolf', source: 'XMM' }] }],
			}

			const { container } = render(<CharacterSheet character={druid} />)
			await screen.findByRole('heading', { name: 'Unlucky Shifter' })
			await waitFor(() => expect(container.querySelector('.error')).toBeTruthy())

			const section = container.querySelector('.sheet__wild-shape-forms')!
			expect(section.textContent).toContain('Could not load Beast stat blocks: data/beasts.json — HTTP 500')
			// The form is still listed by name — the section never depended on the fetch to know what the character stored.
			expect(section.textContent).toContain('Wolf')
			expect(container.querySelector('.sheet__skills')).toBeTruthy()
		})

		it('a character with nothing granted shows no error and no empty grant sections at all', async () => {
			const { container } = render(<CharacterSheet character={character} />)
			await screen.findByRole('heading', { name: 'Aria' })
			await waitFor(() => expect(container.querySelector('.sheet__feats')).toBeTruthy())

			expect(container.querySelector('.error')).toBeNull()
			expect(container.querySelector('.sheet__senses')).toBeNull()
			expect(container.querySelector('.sheet__class-feature-choices')).toBeNull()
			expect(container.querySelector('.sheet__class-optional-features')).toBeNull()
			expect(container.querySelector('.sheet__spells')).toBeNull()
			// No Find Familiar and no stored form, so beasts.json is never fetched and no beast error can exist.
			expect(container.querySelector('.sheet__familiar')).toBeNull()
			expect(container.querySelector('.sheet__wild-shape-forms')).toBeNull()
			expect(vi.mocked(loadBeasts)).not.toHaveBeenCalled()
		})
	})
})
