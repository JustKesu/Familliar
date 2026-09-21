// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
import { loadFeatTextEntries, loadSpellcastingAbilityClassData, loadSubclassSource } from './sheetData'
import { loadSpellSlotsClassData } from '../spells/spellSlotsClassData'
import { loadSpellCountClassData } from '../spells/spellCountClassData'
import type { ClassSpellCountData } from '../calculation/spellCounts'
import { loadSpellDetails, type SpellDetail } from '../spells/spellDetailData'
import { loadSubclassAlwaysPreparedSpells, type AlwaysPreparedSpell } from '../spells/subclassPreparedSpells'
import { loadSubclassChosenSpells } from '../spells/subclassSpellChoiceData'
import { loadFeatGrantedSpells, type FeatGrantedSpell } from '../spells/featSpells'
import { loadOptionalFeatureGrantedSpells, type OptionalFeatureGrantedSpell } from '../spells/optionalFeatureSpells'
import { loadRaceSpells } from '../spells/raceSpells'
import { choiceNames, CUSTOM_ITEM_SOURCE, type Character, type CharacterFamiliar, type CustomItemDefinition, type SpentSpellSlots } from '../storage/character'
import type { HitPointFields } from '../storage/characterStore'
import { loadAcFormulaKeys } from './armourClassData'
import { loadDamageResponseData } from './damageResponseData'
import { loadGrantedSenses, type GrantedSense } from './grantedSenses'
import { loadSpeciesTraitNames } from './speciesTraitNames'
import { loadResolverData } from '../featureResolver'
import { loadDataFile } from '../dataLoader/dataLoader'
import { loadBeasts, type Beast } from '../beasts/beastData'
import { loadChosenClassFeatureChoices } from '../classFeatureChoices/classFeatureChoiceData'
import { grantedClassFeaturesFrom, loadGrantedClassFeatures } from './grantedClassFeatures'
import {
	chosenOptionalFeatureOptions,
	loadChosenClassOptionalFeatures,
	loadChosenOptionalFeatureOptions,
	type OptionalFeatureSelection,
} from '../optionalFeatures/optionalFeatureData'
import { loadItemEntryTemplates } from '../inventory/itemEntryResolver'

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

vi.mock('../spells/spellCountClassData', () => ({
	loadSpellCountClassData: vi.fn(async () => []),
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

vi.mock('../spells/raceSpells', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../spells/raceSpells')>()
	return { ...actual, loadRaceSpells: vi.fn(async () => ({ spells: [], notes: [] })) }
})

vi.mock('./grantedSenses', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./grantedSenses')>()
	return { ...actual, loadGrantedSenses: vi.fn(async () => []) }
})

/* Slice 8a: only the species.json fetch is stubbed — speciesTraitNamesFrom itself stays real. */
vi.mock('./speciesTraitNames', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./speciesTraitNames')>()
	return { ...actual, loadSpeciesTraitNames: vi.fn(async () => []) }
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
			/* Slice b-fix: two two-handed weapons and a one-handed one, so the hands rule has something to displace. */
			{
				name: 'Greatsword',
				source: 'XPHB',
				typeCode: 'M',
				weapon: true,
				weaponCategory: 'martial',
				dmg1: '2d6',
				dmgTypeFull: 'slashing',
				propertyFull: ['Heavy', 'Two-Handed'],
				masteryFull: ['Graze'],
			},
			{
				name: 'Greataxe',
				source: 'XPHB',
				typeCode: 'M',
				weapon: true,
				weaponCategory: 'martial',
				dmg1: '1d12',
				dmgTypeFull: 'slashing',
				propertyFull: ['Heavy', 'Two-Handed'],
				masteryFull: ['Cleave'],
			},
			{
				name: 'Shortsword',
				source: 'XPHB',
				typeCode: 'M',
				weapon: true,
				weaponCategory: 'martial',
				dmg1: '1d6',
				dmgTypeFull: 'piercing',
				propertyFull: ['Finesse', 'Light'],
				masteryFull: ['Vex'],
			},
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
			/* Slice "the markup form the renderer does not know": carries a {#itemEntry} reference plus the fields its template reads. */
			{
				name: 'Ring of Fire Resistance',
				source: 'XDMG',
				requiresAttunement: true,
				resist: ['fire'],
				detail1: 'a pearl',
				entries: ['{#itemEntry Ring of Resistance|XDMG}'],
			},
			{ name: 'Acid Absorbing Tattoo', source: 'XDMG', resist: ['acid'] },
			{ name: 'Periapt of Proof against Poison', source: 'XDMG', requiresAttunement: true, immune: ['poison'] },
			/* Slice f-fix. A consumable's resistance never applies from being carried. */
			{ name: 'Potion of Fire Resistance', source: 'XPHB', typeCode: 'P', resist: ['fire'] },
			/* Actions table (slice 3): a Thrown weapon carries a `range` string, so the Range column has something to show. */
			{
				name: 'Handaxe',
				source: 'XPHB',
				typeCode: 'M',
				weapon: true,
				weaponCategory: 'simple',
				dmg1: '1d6',
				dmgTypeFull: 'slashing',
				propertyFull: ['Light', 'Thrown'],
				range: '20/60',
			},
			/* Slice 9d3: two ammunition weapons and what feeds them — the loose item and the pack, linked the way items.json links them (ammoType / packContents). */
			{
				name: 'Shortbow',
				source: 'XPHB',
				typeCode: 'R',
				weapon: true,
				weaponCategory: 'simple',
				dmg1: '1d6',
				dmgTypeFull: 'piercing',
				propertyFull: ['Ammunition', 'Two-Handed'],
				range: '80/320',
				ammoType: 'arrow|xphb',
			},
			{
				name: 'Light Crossbow',
				source: 'XPHB',
				typeCode: 'R',
				weapon: true,
				weaponCategory: 'simple',
				dmg1: '1d8',
				dmgTypeFull: 'piercing',
				propertyFull: ['Ammunition', 'Loading', 'Two-Handed'],
				range: '80/320',
				ammoType: 'bolt|xphb',
			},
			{ name: 'Arrow', source: 'XPHB', typeCode: 'A' },
			{ name: 'Arrows (20)', source: 'XPHB', typeCode: 'A', packContents: [{ item: 'arrow|xphb', quantity: 20 }] },
			{ name: 'Bolt', source: 'XPHB', typeCode: 'A' },
		]),
	}
})

/* resolveItemEntryRefs / extractItemEntryTemplates run for real — only the {#itemEntry} template fetch is stubbed. */
vi.mock('../inventory/itemEntryResolver', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../inventory/itemEntryResolver')>()
	return {
		...actual,
		loadItemEntryTemplates: vi.fn(async () => [
			{
				name: 'Ring of Resistance',
				source: 'XDMG',
				entriesTemplate: [
					'You have {@variantrule Resistance|XPHB} to {{getFullImmRes item.resist}} damage while wearing this ring. The ring is set with {{item.detail1}}.',
				],
			},
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
			async (classes: { className: string }[], selection: OptionalFeatureSelection[]) => {
				const chosen = classes.some((c) => c.className === 'Warlock') ? choiceNames(selection.find((s) => s.featureType === 'EI')?.choices) : []
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
		/* Only the fetch is stubbed — the actions-table tests below run the real chosenOptionalFeatureOptions over inline fixtures. */
		loadChosenOptionalFeatureOptions: vi.fn(async () => []),
	}
})

/* Wrapping the real function rather than replacing it — the D21 tests below deliberately run the real join over stubbed resolver data. */
vi.mock('../classFeatureChoices/classFeatureChoiceData', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../classFeatureChoices/classFeatureChoiceData')>()
	return { ...actual, loadChosenClassFeatureChoices: vi.fn(actual.loadChosenClassFeatureChoices) }
})

/* Only the fetch is stubbed — grantedClassFeaturesFrom (the whole D87 resolver) runs for real in the tests below, fed inline fixtures. */
vi.mock('./grantedClassFeatures', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./grantedClassFeatures')>()
	return { ...actual, loadGrantedClassFeatures: vi.fn(async () => []) }
})

vi.mock('../featureResolver', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../featureResolver')>()
	return {
		...actual,
		loadResolverData: vi.fn(async () => ({ classFeatures: [], subclassFeatures: [], optionalFeatures: [], feats: [] })),
	}
})

/* Slice 9b2: CharacterSheet now fetches classes.json directly for computeCharacterResources' parsedClasses — same fetch stub reasoning as grantedClassFeatures above, an empty array being a legal classes.json that resolves every resource to "not in data". */
vi.mock('../dataLoader/dataLoader', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../dataLoader/dataLoader')>()
	return { ...actual, loadDataFile: vi.fn(async () => []) }
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
	describe('rolls beside ability scores, saves and skills (step 9 slice 9c2)', () => {
		const ROLL_TEXT = /^(\d+(?:, \d+)*) ([+−]) (\d+) = (\d+)$/

		function parseRoll(el: Element): { dice: number[]; modifier: number; total: number } {
			const match = el.textContent!.trim().match(ROLL_TEXT)
			if (!match) throw new Error(`unexpected roll text ${el.textContent}`)
			const modifier = match[2] === '−' ? -Number(match[3]) : Number(match[3])
			return { dice: match[1]!.split(', ').map(Number), modifier, total: Number(match[4]) }
		}

		function listItem(container: HTMLElement, section: string, text: string): HTMLElement {
			const item = Array.from(container.querySelectorAll(`${section} li`)).find((li) => li.textContent?.includes(text))
			if (!item) throw new Error(`no ${section} row containing ${text}`)
			return item as HTMLElement
		}

		/** The number printed in the row, read from the value span so a roll's own "+ 5" is never mistaken for it. */
		function printedModifier(item: HTMLElement): number {
			const text = item.querySelector(':scope > span')!.textContent!.trim()
			return Number(text.replace('−', '-').replace('+', ''))
		}

		async function renderKnown(subject: Character = character) {
			const rendered = render(<CharacterSheet character={subject} />)
			await screen.findByRole('heading', { name: 'Aria' })
			return rendered
		}

		it('rolls a d20 plus the printed modifier for a saving throw, leaving the printed number alone', async () => {
			const user = userEvent.setup()
			const { container } = await renderKnown()
			const item = listItem(container, '.sheet__saving-throws', 'Strength:')
			const printed = printedModifier(item)
			expect(item.querySelector('.dice-roll__result')).toBeNull()

			await user.click(screen.getByRole('button', { name: 'Roll Strength saving throw' }))
			const roll = parseRoll(item.querySelector('.dice-roll__result')!)
			expect(roll.dice).toHaveLength(1)
			expect(roll.dice[0]).toBeGreaterThanOrEqual(1)
			expect(roll.dice[0]).toBeLessThanOrEqual(20)
			expect(roll.modifier).toBe(printed)
			expect(roll.total).toBe(roll.dice[0]! + printed)
			expect(printedModifier(item)).toBe(printed)
		})

		describe('advantage and disadvantage (step 9 slice 9c3a)', () => {
			const KEEP_TEXT = /^(\d+), (\d+) \(kept (\d+)\) ([+−]) (\d+) = (\d+)$/

			it('keeps the chosen mode when the modifier changes, clearing only the shown result (9c3b fix)', async () => {
				const user = userEvent.setup()
				const { container, rerender } = await renderKnown()
				const printed = printedModifier(listItem(container, '.sheet__saving-throws', 'Strength:'))
				await user.selectOptions(screen.getByRole('combobox', { name: 'Roll mode for Strength saving throw' }), 'disadvantage')
				await user.click(screen.getByRole('button', { name: 'Roll Strength saving throw' }))
				expect(listItem(container, '.sheet__saving-throws', 'Strength:').querySelector('.dice-roll__result')).not.toBeNull()

				// Strength 15 → 17 lifts the modifier by one.
				rerender(
					<CharacterSheet
						character={{ ...character, abilityScores: { ...character.abilityScores!, scores: { ...character.abilityScores!.scores, strength: 17 } } }}
					/>,
				)
				await waitFor(() => expect(printedModifier(listItem(container, '.sheet__saving-throws', 'Strength:'))).toBe(printed + 1))
				const item = listItem(container, '.sheet__saving-throws', 'Strength:')
				expect(item.querySelector('.dice-roll__result')).toBeNull()
				expect((screen.getByRole('combobox', { name: 'Roll mode for Strength saving throw' }) as HTMLSelectElement).value).toBe('disadvantage')
			})

			it.each([
				['advantage', Math.max],
				['disadvantage', Math.min],
			] as const)('rolls two d20s with %s, names the kept one and leaves the printed modifier alone', async (mode, pick) => {
				const user = userEvent.setup()
				const { container } = await renderKnown()
				const item = listItem(container, '.sheet__saving-throws', 'Strength:')
				const printed = printedModifier(item)

				await user.selectOptions(screen.getByRole('combobox', { name: 'Roll mode for Strength saving throw' }), mode)
				expect(item.querySelector('.dice-roll__result')).toBeNull()

				for (let i = 0; i < 5; i++) {
					await user.click(screen.getByRole('button', { name: 'Roll Strength saving throw' }))
					const match = item.querySelector('.dice-roll__result')!.textContent!.trim().match(KEEP_TEXT)
					if (!match) throw new Error(`unexpected roll text ${item.querySelector('.dice-roll__result')!.textContent}`)
					const [first, second, kept, total] = [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[6])]
					expect(kept).toBe(pick(first, second))
					expect(total).toBe(kept + printed)
					expect(match[4] === '−' ? -Number(match[5]) : Number(match[5])).toBe(printed)
					expect(printedModifier(item)).toBe(printed)
				}
			})

			it('goes back to a single die when the mode returns to normal', async () => {
				const user = userEvent.setup()
				const { container } = await renderKnown()
				const item = listItem(container, '.sheet__skills', 'Athletics:')
				const mode = screen.getByRole('combobox', { name: 'Roll mode for Athletics check' })

				await user.selectOptions(mode, 'advantage')
				await user.click(screen.getByRole('button', { name: 'Roll Athletics check' }))
				expect(item.querySelector('.dice-roll__result')!.textContent).toMatch(/kept/)

				await user.selectOptions(mode, 'normal')
				await user.click(screen.getByRole('button', { name: 'Roll Athletics check' }))
				expect(parseRoll(item.querySelector('.dice-roll__result')!).dice).toHaveLength(1)
			})

			it('puts one mode control beside every ability, saving throw and skill roll button', async () => {
				const { container } = await renderKnown()
				for (const [section, count] of [['.sheet__abilities', 6], ['.sheet__saving-throws', 6], ['.sheet__skills', 18]] as const) {
					expect(container.querySelectorAll(`${section} .dice-roll__mode`)).toHaveLength(count)
				}
			})
		})

		it('rolls a skill, and an ability check, the same way', async () => {
			const user = userEvent.setup()
			const { container } = await renderKnown()

			const skill = listItem(container, '.sheet__skills', 'Athletics:')
			await user.click(screen.getByRole('button', { name: 'Roll Athletics check' }))
			const skillRoll = parseRoll(skill.querySelector('.dice-roll__result')!)
			expect(skillRoll.modifier).toBe(printedModifier(skill))

			// Strength 15 → +2; the ability row prints "15 (+2)".
			const ability = listItem(container, '.sheet__abilities', 'Strength:')
			await user.click(screen.getByRole('button', { name: 'Roll Strength check' }))
			const abilityRoll = parseRoll(ability.querySelector('.dice-roll__result')!)
			expect(abilityRoll.modifier).toBe(2)
			expect(abilityRoll.total).toBe(abilityRoll.dice[0]! + 2)
		})

		it('gives every roll button its own name, and puts none on the passive values', async () => {
			const { container } = await renderKnown()
			const labels = (section: string) => Array.from(container.querySelectorAll(`${section} .dice-roll__button`)).map((b) => b.getAttribute('aria-label'))
			const all = [...labels('.sheet__abilities'), ...labels('.sheet__saving-throws'), ...labels('.sheet__skills')]
			expect(labels('.sheet__abilities')).toHaveLength(6)
			expect(labels('.sheet__saving-throws')).toHaveLength(6)
			expect(labels('.sheet__skills')).toHaveLength(18)
			expect(new Set(all).size).toBe(30)
			expect(container.querySelectorAll('.sheet__passive-values .dice-roll__button')).toHaveLength(0)
		})

		it('drops a stale skill result when the modifier behind it changes', async () => {
			const user = userEvent.setup()
			const { container, rerender } = await renderKnown()
			const skill = listItem(container, '.sheet__skills', 'Athletics:')
			const before = printedModifier(skill)
			await user.click(screen.getByRole('button', { name: 'Roll Athletics check' }))
			expect(skill.querySelector('.dice-roll__result')).not.toBeNull()

			// Strength 15 → 17 lifts the modifier from +2 to +3.
			rerender(
				<CharacterSheet
					character={{ ...character, abilityScores: { ...character.abilityScores!, scores: { ...character.abilityScores!.scores, strength: 17 } } }}
				/>,
			)
			await waitFor(() => expect(printedModifier(listItem(container, '.sheet__skills', 'Athletics:'))).toBe(before + 1))
			expect(listItem(container, '.sheet__skills', 'Athletics:').querySelector('.dice-roll__result')).toBeNull()
		})

		it('offers no roll where the modifier is unresolved', async () => {
			const incomplete: Character = { id: 'c2', name: 'Aria', classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 3 }] }
			const { container } = await renderKnown(incomplete)
			for (const section of ['.sheet__abilities', '.sheet__saving-throws', '.sheet__skills']) {
				expect(container.querySelector(section)!.textContent).toContain('unresolved')
				expect(container.querySelectorAll(`${section} .dice-roll__button`)).toHaveLength(0)
			}
		})
	})

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
			expertiseSkills: [{ name: 'stealth' }],
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

		it('the search filters carried items too, not just the ones left to add', async () => {
			const user = userEvent.setup()
			const carrying: Character = {
				...character,
				id: 'inv-search-carried',
				inventory: [
					{ name: 'Cloak of Protection', source: 'XDMG', quantity: 1 },
					{ name: 'Longsword', source: 'XPHB', quantity: 1 },
				],
			}
			const { container } = render(<CharacterSheet character={carrying} onEditInventory={vi.fn()} />)
			await screen.findByRole('heading', { name: 'Aria' })

			const section = container.querySelector('.sheet__inventory')!
			await waitFor(() => expect(section.querySelector('.option-list__toggle')).toBeTruthy())
			await user.click(section.querySelector('.option-list__toggle') as HTMLElement)
			await user.type(screen.getByRole('searchbox', { name: 'Search Add an item' }), 'cloak of prote')

			expect(screen.getByRole('checkbox', { name: 'Cloak of Protection (XDMG)' })).toBeTruthy()
			// Longsword is carried too, but it doesn't match the search, so it must not still be listed.
			expect(screen.queryByRole('checkbox', { name: 'Longsword (XPHB)' })).toBeNull()
		})

		it('clears the search text when the panel is closed and reopened', async () => {
			const user = userEvent.setup()
			const { container } = render(<CharacterSheet character={character} onEditInventory={vi.fn()} />)
			await screen.findByRole('heading', { name: 'Aria' })

			const section = container.querySelector('.sheet__inventory')!
			await waitFor(() => expect(section.querySelector('.option-list__toggle')).toBeTruthy())
			const toggle = section.querySelector('.option-list__toggle') as HTMLElement
			await user.click(toggle)
			await user.type(screen.getByRole('searchbox', { name: 'Search Add an item' }), 'torch')
			expect(screen.queryByRole('checkbox', { name: 'Longsword (XPHB)' })).toBeNull()

			await user.click(toggle) // close
			await user.click(toggle) // reopen

			const search = screen.getByRole('searchbox', { name: 'Search Add an item' }) as HTMLInputElement
			expect(search.value).toBe('')
			expect(screen.getByRole('checkbox', { name: 'Longsword (XPHB)' })).toBeTruthy()
		})

		it('changes a quantity on commit, and floors it at 0 (slice 9d3)', async () => {
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

			// 0 is a real quantity now (a spent stack stays to be restocked); below it the field stops, and removing is Discard's job.
			await user.clear(qty)
			await user.type(qty, '0')
			await user.tab()
			expect(onEditInventory).toHaveBeenLastCalledWith([{ name: 'Longsword', source: 'XPHB', quantity: 0 }])
			expect(qty.value).toBe('0')

			await user.clear(qty)
			await user.type(qty, '-4')
			await user.tab()
			expect(qty.value).toBe('0')
		})

		it('discarding an item takes it out of the inventory entirely', async () => {
			const user = userEvent.setup()
			const onEditInventory = vi.fn()
			const one: Character = { ...character, id: 'inv4', inventory: [{ name: 'Longsword', source: 'XPHB', quantity: 2 }] }
			const { container } = render(<CharacterSheet character={one} onEditInventory={onEditInventory} />)
			await screen.findByRole('heading', { name: 'Aria' })

			const section = container.querySelector('.sheet__inventory')!
			await waitFor(() => expect(section.querySelector('.sheet__inventory-list')).toBeTruthy())
			await user.click(screen.getByRole('button', { name: 'Discard Longsword from inventory' }))
			expect(onEditInventory).toHaveBeenCalledWith([])
		})

		it('putting a held weapon down leaves it in the inventory, unequipped', async () => {
			const user = userEvent.setup()
			const onEditInventory = vi.fn()
			const holding: Character = {
				...character,
				id: 'inv-put-down',
				inventory: [{ name: 'Longsword', source: 'XPHB', quantity: 1, equipped: 'held' }],
			}
			render(<CharacterSheet character={holding} onEditInventory={onEditInventory} />)
			await screen.findByRole('heading', { name: 'Aria' })

			await user.click(screen.getByRole('button', { name: 'Put down Longsword' }))
			expect(onEditInventory).toHaveBeenCalledWith([{ name: 'Longsword', source: 'XPHB', quantity: 1 }])
		})

		it('names Put down and Discard distinguishably, so a slip between them is not a silent loss', async () => {
			const held: Character = {
				...character,
				id: 'inv-control-names',
				inventory: [{ name: 'Longsword', source: 'XPHB', quantity: 1, equipped: 'held' }],
			}
			render(<CharacterSheet character={held} onEditInventory={vi.fn()} />)
			await screen.findByRole('heading', { name: 'Aria' })

			expect(screen.getByRole('button', { name: 'Put down Longsword' })).toBeTruthy()
			expect(screen.getByRole('button', { name: 'Discard Longsword from inventory' })).toBeTruthy()
			// Neither name is a substring of the other, so a screen reader or a fuzzy match can't confuse them.
			expect('Put down Longsword'.includes('Discard')).toBe(false)
			expect('Discard Longsword from inventory'.includes('Put down')).toBe(false)
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
			expect(container.querySelector('.sheet__inventory-notice')!.textContent).toBe(
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

			await user.click(screen.getByRole('button', { name: 'Put down Chain Mail' }))
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
			// Speed lives in the persistent header (slice 1), no longer in the traits section.
			const speedItem = container.querySelector('.sheet__speed')!
			await waitFor(() => expect(speedItem.textContent).toContain('20 ft.'))
			expect(speedItem.textContent).toContain('Chain Mail (Strength 13 required, you have 10)')
		})
	})

	/*
	 * Hands (build order step 7, slice b-fix). Slice b let a character hold a
	 * greatsword and a greataxe at once and left a shield on under a two-handed
	 * weapon; the fix is the two hands the rules actually give, so these are the
	 * cases a count of weapons would get wrong.
	 */
	describe('hands and grip (step 7 slice b-fix)', () => {
		function inventorySection(container: HTMLElement): HTMLElement {
			return container.querySelector('.sheet__inventory') as HTMLElement
		}

		function notice(container: HTMLElement): string {
			return inventorySection(container).querySelector('.sheet__inventory-notice')?.textContent ?? ''
		}

		function attackDamage(container: HTMLElement, name: string): string {
			const row = Array.from(container.querySelectorAll('.sheet__action-row')).find((tr) => tr.querySelector('.sheet__action-name')?.textContent === name)
			if (!row) throw new Error(`no attack row for ${name}`)
			return row.querySelector('.sheet__action-damage')!.textContent ?? ''
		}

		async function renderSheet(subject: Character, onEditInventory?: (inventory: Character['inventory'] & object) => void) {
			const rendered = render(<CharacterSheet character={subject} onEditInventory={onEditInventory} />)
			await screen.findByRole('heading', { name: 'Aria' })
			await waitFor(() => expect(rendered.container.querySelector('.sheet__actions-table')).toBeTruthy())
			return rendered
		}

		const owning = (id: string, ...inventory: NonNullable<Character['inventory']>): Character => ({ ...character, id, inventory })
		const row = (name: string, equipped?: 'held'): NonNullable<Character['inventory']>[number] => ({
			name,
			source: 'XPHB',
			quantity: 1,
			...(equipped ? { equipped } : {}),
		})

		it('lets two one-handed weapons be held at once — dual wielding stays legal', async () => {
			const user = userEvent.setup()
			const onEditInventory = vi.fn()
			const { container } = await renderSheet(owning('hands-dual', row('Shortsword', 'held'), row('Rapier')), onEditInventory)

			await user.click(screen.getByRole('button', { name: 'Equip Rapier' }))
			expect(onEditInventory).toHaveBeenCalledWith([row('Shortsword', 'held'), row('Rapier', 'held')])
			expect(notice(container)).toBe('')
		})

		it('a two-handed weapon puts the shield down, and says so', async () => {
			const user = userEvent.setup()
			const onEditInventory = vi.fn()
			const { container } = await renderSheet(owning('hands-greatsword', row('Shield', 'held'), row('Greatsword')), onEditInventory)

			await user.click(screen.getByRole('button', { name: 'Equip Greatsword' }))
			expect(onEditInventory).toHaveBeenCalledWith([row('Shield'), row('Greatsword', 'held')])
			expect(notice(container)).toBe('Unequipped Shield — Greatsword needs both hands.')
		})

		it('a shield puts a held two-handed weapon down, and says so', async () => {
			const user = userEvent.setup()
			const onEditInventory = vi.fn()
			const { container } = await renderSheet(owning('hands-shield', row('Greatsword', 'held'), row('Shield')), onEditInventory)

			await user.click(screen.getByRole('button', { name: 'Equip Shield' }))
			expect(onEditInventory).toHaveBeenCalledWith([row('Greatsword'), row('Shield', 'held')])
			expect(notice(container)).toBe('Unequipped Greatsword — Shield needs a free hand.')
		})

		it('a two-handed weapon displaces another two-handed weapon', async () => {
			const user = userEvent.setup()
			const onEditInventory = vi.fn()
			const { container } = await renderSheet(owning('hands-both', row('Greatsword', 'held'), row('Greataxe')), onEditInventory)

			await user.click(screen.getByRole('button', { name: 'Equip Greataxe' }))
			expect(onEditInventory).toHaveBeenCalledWith([row('Greatsword'), row('Greataxe', 'held')])
			expect(notice(container)).toBe('Unequipped Greatsword — Greataxe needs both hands.')
		})

		it("a Versatile weapon's damage follows its grip, and the stored grip survives a reload", async () => {
			const user = userEvent.setup()
			const onEditInventory = vi.fn()
			const { container } = await renderSheet(owning('hands-grip', row('Longsword', 'held')), onEditInventory)
			// STR 15 (+2).
			expect(attackDamage(container, 'Longsword')).toBe('1d8 + 2 slashing')

			await user.selectOptions(screen.getByLabelText('Grip for Longsword'), 'two-handed')
			expect(onEditInventory).toHaveBeenCalledWith([{ ...row('Longsword', 'held'), grip: 'two-handed' }])

			// The reload: the same sheet rendered from what was stored reads the bigger die.
			cleanup()
			const stored = await renderSheet(owning('hands-grip-2', { ...row('Longsword', 'held'), grip: 'two-handed' }), vi.fn())
			expect(attackDamage(stored.container, 'Longsword')).toBe('1d10 + 2 slashing')
			expect((screen.getByLabelText('Grip for Longsword') as HTMLSelectElement).value).toBe('two-handed')
		})

		it('two-handing a Versatile weapon puts a held shield down, since the second hand is a real hand', async () => {
			const user = userEvent.setup()
			const onEditInventory = vi.fn()
			const { container } = await renderSheet(owning('hands-grip-shield', row('Shield', 'held'), row('Longsword', 'held')), onEditInventory)

			await user.selectOptions(screen.getByLabelText('Grip for Longsword'), 'two-handed')
			expect(onEditInventory).toHaveBeenCalledWith([row('Shield'), { ...row('Longsword', 'held'), grip: 'two-handed' }])
			expect(notice(container)).toBe('Unequipped Shield — Longsword needs both hands.')
		})

		it('offers the grip control only on a Versatile weapon, and only while it is held', async () => {
			await renderSheet(owning('hands-grip-absent', row('Longsword', 'held'), row('Rapier', 'held'), row('Shield', 'held')), vi.fn())
			expect(screen.getByLabelText('Grip for Longsword')).toBeTruthy()
			// Rapier is Finesse, not Versatile; a shield has no grip to choose at all.
			expect(screen.queryByLabelText('Grip for Rapier')).toBeNull()
			expect(screen.queryByLabelText('Grip for Shield')).toBeNull()

			cleanup()
			await renderSheet(owning('hands-grip-carried', row('Longsword')), vi.fn())
			expect(screen.queryByLabelText('Grip for Longsword')).toBeNull()
		})

		/*
		 * Fix slice: a custom weapon used to carry no properties at all, so it
		 * always took one hand — a homebrew greatsword could be held alongside a
		 * shield. Two-Handed now reaches the same `propertyFull` handsRequiredOf
		 * reads for a real weapon, so it displaces exactly as Greatsword does above.
		 */
		it('a custom Two-Handed weapon puts a held shield down, the same as a real one', async () => {
			const user = userEvent.setup()
			const onEditInventory = vi.fn()
			const greatclub = {
				name: 'Bone Greatclub',
				source: CUSTOM_ITEM_SOURCE,
				quantity: 1,
				custom: { name: 'Bone Greatclub', kind: 'weapon' as const, damageDice: '1d10', damageType: 'bludgeoning', twoHanded: true as const },
			}
			const { container } = await renderSheet(owning('hands-custom-two-handed', row('Shield', 'held'), greatclub), onEditInventory)

			await user.click(screen.getByRole('button', { name: 'Equip Bone Greatclub' }))
			expect(onEditInventory).toHaveBeenCalledWith([row('Shield'), { ...greatclub, equipped: 'held' }])
			expect(notice(container)).toBe('Unequipped Shield — Bone Greatclub needs both hands.')
		})

		/* Versatile needs BOTH the property (to offer the grip control at all) and the second die (`damageDice2`) — without either the control has nothing to switch to. */
		it('a custom Versatile weapon offers the grip control and follows it for damage', async () => {
			const user = userEvent.setup()
			const onEditInventory = vi.fn()
			const glaive = {
				name: 'Bone Glaive',
				source: CUSTOM_ITEM_SOURCE,
				quantity: 1,
				equipped: 'held' as const,
				custom: {
					name: 'Bone Glaive',
					kind: 'weapon' as const,
					damageDice: '1d8',
					damageDice2: '1d10',
					damageType: 'slashing',
					versatile: true as const,
					weaponCategory: 'martial' as const,
				},
			}
			const { container } = await renderSheet(owning('hands-custom-versatile', glaive), onEditInventory)
			// STR 15 (+2), one-handed die.
			expect(attackDamage(container, 'Bone Glaive')).toBe('1d8 + 2 slashing')

			await user.selectOptions(screen.getByLabelText('Grip for Bone Glaive'), 'two-handed')
			expect(onEditInventory).toHaveBeenCalledWith([{ ...glaive, grip: 'two-handed' }])

			// The reload: the same sheet rendered from what was stored reads the bigger die.
			cleanup()
			const stored = await renderSheet(owning('hands-custom-versatile-2', { ...glaive, grip: 'two-handed' }), vi.fn())
			expect(attackDamage(stored.container, 'Bone Glaive')).toBe('1d10 + 2 slashing')
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
			return container.querySelector('.sheet__actions') as HTMLElement
		}

		function attackRow(container: HTMLElement, name: string): HTMLElement {
			const row = Array.from(attacksSection(container).querySelectorAll('.sheet__action-row')).find(
				(tr) => tr.querySelector('.sheet__action-name')?.textContent === name,
			)
			if (!row) throw new Error(`no attack row for ${name}`)
			return row as HTMLElement
		}

		async function renderSheet(subject: Character, onEditInventory?: (inventory: Character['inventory'] & object) => void) {
			const rendered = render(<CharacterSheet character={subject} onEditInventory={onEditInventory} />)
			await screen.findByRole('heading', { name: 'Aria' })
			await waitFor(() => expect(attacksSection(rendered.container).querySelector('.sheet__actions-table')).toBeTruthy())
			return rendered
		}

		const holding = (...names: string[]): Character['inventory'] => names.map((name) => ({ name, source: 'XPHB', quantity: 1, equipped: 'held' as const }))

		it('lists a held longsword with its to-hit, its one-handed damage, mastery and properties', async () => {
			const { container } = await renderSheet({ ...character, id: 'atk-longsword', inventory: holding('Longsword') })
			const row = attackRow(container, 'Longsword')
			// STR 15 (+2) + PB 3 at level 5.
			expect(row.textContent).toContain('+5')
			expect(row.querySelector('.sheet__action-damage')!.textContent).toBe('1d8 + 2 slashing')
			expect(row.querySelector('.sheet__action-versatile')!.textContent).toContain('held in one hand')
			expect(row.textContent).toContain('Mastery: Sap')
			expect(row.textContent).toContain('Properties: Versatile')
		})

		it('shows the unarmed strike every character has, and the attacks-per-action count from the feature table', async () => {
			const { container } = await renderSheet(character)
			expect(attackRow(container, 'Unarmed Strike').querySelector('.sheet__action-damage')!.textContent).toBe('1 + 2 bludgeoning')
			// The stub grants "Extra Attack"; the count belongs to the character's turn, not to a weapon row.
			expect(attacksSection(container).querySelector('.sheet__actions-per-action')!.textContent).toContain('2')
		})

		it('an item that is held but not a weapon does not become an attack', async () => {
			const { container } = await renderSheet({ ...character, id: 'atk-shield', inventory: holding('Shield') })
			expect(Array.from(attacksSection(container).querySelectorAll('.sheet__action-name')).map((node) => node.textContent)).toEqual(['Unarmed Strike'])
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

		it('renders a real table with the five action columns (slice 3)', async () => {
			const { container } = await renderSheet({ ...character, id: 'atk-table', inventory: holding('Longsword') })
			const table = attacksSection(container).querySelector('table.sheet__actions-table')!
			expect(table).toBeTruthy()
			const headers = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent)
			expect(headers).toEqual(['Name', 'Range', 'To Hit / DC', 'Damage', 'Notes'])
			// One row per held weapon plus the Unarmed Strike, in the tbody.
			const names = Array.from(table.querySelectorAll('tbody .sheet__action-row .sheet__action-name')).map((n) => n.textContent)
			expect(names).toEqual(['Longsword', 'Unarmed Strike'])
			// Attacks per action stays a summary line above the table, never a row.
			expect(attacksSection(container).querySelector('.sheet__actions-per-action')!.textContent).toContain('Attacks per action')
			expect(table.querySelector('tbody')!.textContent).not.toContain('Attacks per action')
		})

		it('fills the Range cell for a Thrown weapon and leaves it blank for a plain melee weapon', async () => {
			const { container } = await renderSheet({ ...character, id: 'atk-range', inventory: holding('Handaxe', 'Longsword') })
			expect(attackRow(container, 'Handaxe').querySelector('.sheet__action-range')!.textContent).toBe('20/60 ft.')
			expect(attackRow(container, 'Longsword').querySelector('.sheet__action-range')!.textContent).toBe('')
		})

		it('keeps a D43 unresolved weapon inside the table, named, with the problem stated', async () => {
			const { container } = await renderSheet({ ...character, id: 'atk-d43-table', inventory: holding('Sword of Nothing') })
			const row = attackRow(container, 'Sword of Nothing')
			expect(row.closest('table.sheet__actions-table')).toBeTruthy()
			expect(row.querySelector('.sheet__action-to-hit')!.textContent).toContain('unresolved')
			expect(row.querySelector('.sheet__action-notes')!.textContent).toContain('was not found in the item data')
		})

		describe('ammunition beside a held weapon (step 9 slice 9d3)', () => {
			const SHORTBOW = { name: 'Shortbow', source: 'XPHB', quantity: 1, equipped: 'held' as const }
			const arrows = (quantity: number, extra: Partial<NonNullable<Character['inventory']>[number]> = {}) => ({ name: 'Arrow', source: 'XPHB', quantity, ...extra })

			/* Holds the character in state the way CharacterManager does, so a click is followed by the sheet re-reading what it wrote. */
			function Harness({ initial, onEdit }: { initial: Character; onEdit: (inventory: NonNullable<Character['inventory']>) => void }) {
				const [current, setCurrent] = useState(initial)
				return (
					<CharacterSheet
						character={current}
						onEditInventory={(inventory) => {
							onEdit(inventory)
							setCurrent((previous) => ({ ...previous, inventory }))
						}}
					/>
				)
			}

			async function renderStateful(inventory: Character['inventory'], onEdit = vi.fn()) {
				const rendered = render(<Harness initial={{ ...character, id: `ammo-${Math.random()}`, inventory }} onEdit={onEdit} />)
				await screen.findByRole('heading', { name: 'Aria' })
				await waitFor(() => expect(attacksSection(rendered.container).querySelector('.sheet__actions-table')).toBeTruthy())
				return { ...rendered, onEdit }
			}

			const ammoText = (container: HTMLElement, weapon: string) => attackRow(container, weapon).querySelector('.sheet__action-ammo')!.textContent

			it('spends one from the matching item, and stops at 0 with the button disabled', async () => {
				const user = userEvent.setup()
				const { container, onEdit } = await renderStateful([SHORTBOW, arrows(2)])
				expect(ammoText(container, 'Shortbow')).toContain('Arrow: 2')

				const spend = screen.getByRole('button', { name: 'Spend one Arrow' })
				await user.click(spend)
				expect(onEdit).toHaveBeenLastCalledWith([SHORTBOW, arrows(1)])
				expect(ammoText(container, 'Shortbow')).toContain('Arrow: 1')

				await user.click(spend)
				expect(onEdit).toHaveBeenLastCalledWith([SHORTBOW, arrows(0)])
				expect(ammoText(container, 'Shortbow')).toContain('Arrow: 0')
				expect((spend as HTMLButtonElement).disabled).toBe(true)

				// Disabled means no third write: nothing goes negative.
				await user.click(spend)
				expect(onEdit).toHaveBeenCalledTimes(2)
			})

			it('shows each matching item separately with its own count, and spends only the one clicked', async () => {
				const user = userEvent.setup()
				const { container, onEdit } = await renderStateful([SHORTBOW, arrows(12), arrows(3, { magicBonus: 1 })])
				const groups = Array.from(attackRow(container, 'Shortbow').querySelectorAll('.sheet__action-ammo-item')).map((node) => node.textContent!.replace(/\s+/g, ' ').trim())
				expect(groups).toEqual(['Arrow: 12 −1', 'Arrow +1: 3 −1'])

				await user.click(screen.getByRole('button', { name: 'Spend one Arrow +1' }))
				expect(onEdit).toHaveBeenLastCalledWith([SHORTBOW, arrows(12), arrows(2, { magicBonus: 1 })])
				expect(ammoText(container, 'Shortbow')).toContain('Arrow: 12')
				expect(ammoText(container, 'Shortbow')).toContain('Arrow +1: 2')
			})

			it('shows 0 with a disabled button when the inventory has nothing that fits, rather than hiding the line (D43)', async () => {
				const { container } = await renderStateful([{ ...SHORTBOW }, { name: 'Bolt', source: 'XPHB', quantity: 9 }])
				expect(ammoText(container, 'Shortbow')).toContain('Arrow: 0')
				expect((screen.getByRole('button', { name: 'Spend one Arrow' }) as HTMLButtonElement).disabled).toBe(true)
			})

			it('pairs each weapon with its own ammunition', async () => {
				const { container } = await renderStateful([
					{ name: 'Light Crossbow', source: 'XPHB', quantity: 1, equipped: 'held' as const },
					arrows(12),
					{ name: 'Bolt', source: 'XPHB', quantity: 7 },
				])
				expect(ammoText(container, 'Light Crossbow')).toContain('Bolt: 7')
				expect(ammoText(container, 'Light Crossbow')).not.toContain('Arrow')
			})

			it('adds nothing to a weapon that fires no ammunition', async () => {
				const { container } = await renderStateful([
					{ name: 'Longsword', source: 'XPHB', quantity: 1, equipped: 'held' as const },
					{ name: 'Handaxe', source: 'XPHB', quantity: 3 },
					arrows(12),
				])
				expect(attackRow(container, 'Longsword').querySelector('.sheet__action-ammo')).toBeNull()
				expect(attackRow(container, 'Unarmed Strike').querySelector('.sheet__action-ammo')).toBeNull()
				expect(attackRow(container, 'Longsword').querySelector('.sheet__action-notes')!.textContent).toBe('Mastery: Sap · Properties: Versatile')
				expect(screen.queryByRole('button', { name: /^Spend one/ })).toBeNull()
			})

			it('does not put an ammunition line on a weapon that is not held', async () => {
				const { container } = await renderStateful([{ name: 'Shortbow', source: 'XPHB', quantity: 1 }, arrows(12)])
				expect(container.querySelector('.sheet__action-ammo')).toBeNull()
			})

			it('is the same number the Inventář tab shows, in both directions', async () => {
				const user = userEvent.setup()
				const { container } = await renderStateful([SHORTBOW, arrows(5)])
				const field = screen.getByLabelText('Quantity of Arrow') as HTMLInputElement
				expect(field.value).toBe('5')

				await user.click(screen.getByRole('button', { name: 'Spend one Arrow' }))
				expect(field.value).toBe('4')

				await user.clear(field)
				await user.type(field, '9')
				await user.tab()
				expect(ammoText(container, 'Shortbow')).toContain('Arrow: 9')

				// Restocking from 0 is the Inventář field's job, and the button comes back with it.
				await user.clear(field)
				await user.type(field, '0')
				await user.tab()
				expect(ammoText(container, 'Shortbow')).toContain('Arrow: 0')
				expect((screen.getByRole('button', { name: 'Spend one Arrow' }) as HTMLButtonElement).disabled).toBe(true)
				await user.clear(field)
				await user.type(field, '3')
				await user.tab()
				expect((screen.getByRole('button', { name: 'Spend one Arrow' }) as HTMLButtonElement).disabled).toBe(false)
			})

			it('opens a pack on the first spend: the pack is gone and the rest are loose arrows in the Inventář', async () => {
				const user = userEvent.setup()
				const { container, onEdit } = await renderStateful([SHORTBOW, { name: 'Arrows (20)', source: 'XPHB', quantity: 1 }])
				expect(ammoText(container, 'Shortbow')).toContain('Arrows (20): 1 pack')

				await user.click(screen.getByRole('button', { name: 'Spend one Arrow from Arrows (20)' }))
				expect(onEdit).toHaveBeenLastCalledWith([SHORTBOW, arrows(19)])
				expect(ammoText(container, 'Shortbow')).toContain('Arrow: 19')
				expect(screen.queryByLabelText('Quantity of Arrows (20)')).toBeNull()
				expect((screen.getByLabelText('Quantity of Arrow') as HTMLInputElement).value).toBe('19')
			})

			it('still shows the counts, with no buttons, when the sheet cannot edit', async () => {
				const { container } = await renderSheet({ ...character, id: 'ammo-readonly', inventory: [SHORTBOW, arrows(4)] })
				expect(ammoText(container, 'Shortbow')).toContain('Arrow: 4')
				expect(screen.queryByRole('button', { name: /^Spend one/ })).toBeNull()
			})

			describe('the to-hit roll spends ammunition (slice 9d4)', () => {
				const rolledResults = (container: HTMLElement, weapon: string) => attackRow(container, weapon).querySelectorAll('.dice-roll__result')

				it('spends one matching item per to-hit roll, and a damage roll spends nothing', async () => {
					const user = userEvent.setup()
					const { container, onEdit } = await renderStateful([SHORTBOW, arrows(5)])

					await user.click(screen.getByRole('button', { name: 'Roll Shortbow damage' }))
					expect(rolledResults(container, 'Shortbow')).toHaveLength(1)
					expect(onEdit).not.toHaveBeenCalled()
					expect(ammoText(container, 'Shortbow')).toContain('Arrow: 5')

					await user.click(screen.getByRole('button', { name: 'Roll Shortbow to hit' }))
					expect(onEdit).toHaveBeenCalledTimes(1)
					expect(onEdit).toHaveBeenLastCalledWith([SHORTBOW, arrows(4)])
					expect(ammoText(container, 'Shortbow')).toContain('Arrow: 4')

					await user.click(screen.getByRole('button', { name: 'Roll Shortbow to hit' }))
					expect(onEdit).toHaveBeenLastCalledWith([SHORTBOW, arrows(3)])
					expect(ammoText(container, 'Shortbow')).toContain('Arrow: 3')
				})

				it('rolls another weapon or a check without touching the ammunition', async () => {
					const user = userEvent.setup()
					const { container, onEdit } = await renderStateful([SHORTBOW, { name: 'Longsword', source: 'XPHB', quantity: 1, equipped: 'held' as const }, arrows(5)])
					await user.click(screen.getByRole('button', { name: 'Roll Longsword to hit' }))
					await user.click(screen.getByRole('button', { name: 'Roll Strength check' }))
					expect(onEdit).not.toHaveBeenCalled()
					expect(ammoText(container, 'Shortbow')).toContain('Arrow: 5')
				})

				it('still rolls at 0 ammunition, and the count stays at 0 with no write', async () => {
					const user = userEvent.setup()
					const { container, onEdit } = await renderStateful([SHORTBOW, arrows(0)])
					await user.click(screen.getByRole('button', { name: 'Roll Shortbow to hit' }))
					expect(rolledResults(container, 'Shortbow')).toHaveLength(1)
					expect(ammoText(container, 'Shortbow')).toContain('Arrow: 0')
					expect(onEdit).not.toHaveBeenCalled()
				})

				it('still rolls when nothing in the inventory feeds the weapon', async () => {
					const user = userEvent.setup()
					const { container, onEdit } = await renderStateful([SHORTBOW, { name: 'Bolt', source: 'XPHB', quantity: 9 }])
					await user.click(screen.getByRole('button', { name: 'Roll Shortbow to hit' }))
					expect(rolledResults(container, 'Shortbow')).toHaveLength(1)
					expect(onEdit).not.toHaveBeenCalled()
				})

				it('does not guess between two matching items: the roll spends nothing and the manual buttons still do', async () => {
					const user = userEvent.setup()
					const { container, onEdit } = await renderStateful([SHORTBOW, arrows(12), arrows(3, { magicBonus: 1 })])
					await user.click(screen.getByRole('button', { name: 'Roll Shortbow to hit' }))
					expect(rolledResults(container, 'Shortbow')).toHaveLength(1)
					expect(onEdit).not.toHaveBeenCalled()
					expect(ammoText(container, 'Shortbow')).toContain('Arrow: 12')
					expect(ammoText(container, 'Shortbow')).toContain('Arrow +1: 3')

					await user.click(screen.getByRole('button', { name: 'Spend one Arrow +1' }))
					expect(onEdit).toHaveBeenLastCalledWith([SHORTBOW, arrows(12), arrows(2, { magicBonus: 1 })])
				})

				it('does not guess between a loose item and a pack either', async () => {
					const user = userEvent.setup()
					const { onEdit } = await renderStateful([SHORTBOW, arrows(12), { name: 'Arrows (20)', source: 'XPHB', quantity: 1 }])
					await user.click(screen.getByRole('button', { name: 'Roll Shortbow to hit' }))
					expect(onEdit).not.toHaveBeenCalled()
				})

				it('leaves a weapon without ammoType exactly as it was', async () => {
					const user = userEvent.setup()
					const { container, onEdit } = await renderStateful([{ name: 'Longsword', source: 'XPHB', quantity: 1, equipped: 'held' as const }, arrows(5)])
					await user.click(screen.getByRole('button', { name: 'Roll Longsword to hit' }))
					expect(rolledResults(container, 'Longsword')).toHaveLength(1)
					expect(onEdit).not.toHaveBeenCalled()
				})

				it('is the same state as the manual −1 and the Inventář tab, whichever one spent', async () => {
					const user = userEvent.setup()
					const { container, onEdit } = await renderStateful([SHORTBOW, arrows(5)])
					const field = screen.getByLabelText('Quantity of Arrow') as HTMLInputElement

					await user.click(screen.getByRole('button', { name: 'Roll Shortbow to hit' }))
					expect(field.value).toBe('4')
					await user.click(screen.getByRole('button', { name: 'Spend one Arrow' }))
					expect(field.value).toBe('3')
					await user.click(screen.getByRole('button', { name: 'Roll Shortbow to hit' }))
					expect(field.value).toBe('2')
					expect(ammoText(container, 'Shortbow')).toContain('Arrow: 2')
					expect(onEdit).toHaveBeenCalledTimes(3)
					expect(onEdit).toHaveBeenLastCalledWith([SHORTBOW, arrows(2)])
				})

				it('opens a lone pack on the first roll, as the manual −1 does', async () => {
					const user = userEvent.setup()
					const { onEdit } = await renderStateful([SHORTBOW, { name: 'Arrows (20)', source: 'XPHB', quantity: 1 }])
					await user.click(screen.getByRole('button', { name: 'Roll Shortbow to hit' }))
					expect(onEdit).toHaveBeenLastCalledWith([SHORTBOW, arrows(19)])
				})

				it('rolls without spending when the sheet cannot edit', async () => {
					const user = userEvent.setup()
					const { container } = await renderSheet({ ...character, id: 'ammo-roll-readonly', inventory: [SHORTBOW, arrows(4)] })
					await user.click(screen.getByRole('button', { name: 'Roll Shortbow to hit' }))
					expect(rolledResults(container, 'Shortbow')).toHaveLength(1)
					expect(ammoText(container, 'Shortbow')).toContain('Arrow: 4')
				})
			})
		})

		describe('to-hit roll (step 9 slice 9c1)', () => {
			function rollResult(row: HTMLElement): { die: number; modifier: number; total: number } {
				const results = row.querySelectorAll('.dice-roll__result')
				expect(results).toHaveLength(1)
				const match = results[0]!.textContent!.trim().match(/^(\d+) \+ (\d+) = (\d+)$/)
				if (!match) throw new Error(`unexpected roll text ${results[0]!.textContent}`)
				return { die: Number(match[1]), modifier: Number(match[2]), total: Number(match[3]) }
			}

			it('rolls a d20 plus the printed modifier beside the to-hit, and a second roll replaces the first', async () => {
				const user = userEvent.setup()
				const { container } = await renderSheet({ ...character, id: 'atk-roll', inventory: holding('Longsword') })
				const row = attackRow(container, 'Longsword')
				expect(row.querySelector('.dice-roll__result')).toBeNull()

				await user.click(screen.getByRole('button', { name: 'Roll Longsword to hit' }))
				const first = rollResult(row)
				expect(first.modifier).toBe(5)
				expect(first.die).toBeGreaterThanOrEqual(1)
				expect(first.die).toBeLessThanOrEqual(20)
				expect(first.total).toBe(first.die + 5)
				expect(row.querySelector('.sheet__action-to-hit')!.textContent).toContain('+5')

				await user.click(screen.getByRole('button', { name: 'Roll Longsword to hit' }))
				expect(rollResult(row).modifier).toBe(5)
			})

			it('rolls two d20s with advantage on the to-hit, and keeps the higher', async () => {
				const user = userEvent.setup()
				const { container } = await renderSheet({ ...character, id: 'atk-roll-adv', inventory: holding('Longsword') })
				const row = attackRow(container, 'Longsword')

				await user.selectOptions(screen.getByRole('combobox', { name: 'Roll mode for Longsword to hit' }), 'advantage')
				await user.click(screen.getByRole('button', { name: 'Roll Longsword to hit' }))
				const match = row.querySelector('.dice-roll__result')!.textContent!.trim().match(/^(\d+), (\d+) \(kept (\d+)\) \+ 5 = (\d+)$/)
				expect(match).not.toBeNull()
				expect(Number(match![3])).toBe(Math.max(Number(match![1]), Number(match![2])))
				expect(Number(match![4])).toBe(Number(match![3]) + 5)
				expect(row.querySelector('.sheet__action-to-hit')!.textContent).toContain('+5')
			})

			it('offers no roll on an unresolved to-hit, and does on the Unarmed Strike', async () => {
				const { container } = await renderSheet({ ...character, id: 'atk-roll-d43', inventory: holding('Sword of Nothing') })
				expect(attackRow(container, 'Sword of Nothing').querySelector('.dice-roll__button')).toBeNull()
				expect(attackRow(container, 'Unarmed Strike').querySelector('.dice-roll__button')).toBeTruthy()
			})
		})

		describe('damage roll (step 9 slice 9c2)', () => {
			function damageRoll(row: HTMLElement): { dice: number[]; modifier: number; total: number } {
				const results = row.querySelectorAll('.dice-roll__result')
				expect(results).toHaveLength(1)
				const match = results[0]!.textContent!.trim().match(/^(\d+(?:, \d+)*) \+ (\d+) = (\d+)$/)
				if (!match) throw new Error(`unexpected roll text ${results[0]!.textContent}`)
				return { dice: match[1]!.split(', ').map(Number), modifier: Number(match[2]), total: Number(match[3]) }
			}

			it('rolls one die per die of a one-dice weapon and lists it', async () => {
				const user = userEvent.setup()
				const { container } = await renderSheet({ ...character, id: 'dmg-longsword', inventory: holding('Longsword') })
				const row = attackRow(container, 'Longsword')
				expect(row.querySelector('.sheet__action-damage')!.textContent).toBe('1d8 + 2 slashing')

				await user.click(screen.getByRole('button', { name: 'Roll Longsword damage' }))
				const roll = damageRoll(row)
				expect(roll.dice).toHaveLength(1)
				expect(roll.dice[0]).toBeGreaterThanOrEqual(1)
				expect(roll.dice[0]).toBeLessThanOrEqual(8)
				expect(roll.modifier).toBe(2)
				expect(roll.total).toBe(roll.dice[0]! + 2)
				expect(row.querySelector('.sheet__action-damage')!.textContent).toBe('1d8 + 2 slashing')
			})

			it('rolls both dice of a 2d6 weapon and lists each, summed with the modifier', async () => {
				const user = userEvent.setup()
				const { container } = await renderSheet({ ...character, id: 'dmg-greatsword', inventory: holding('Greatsword') })
				const row = attackRow(container, 'Greatsword')
				expect(row.querySelector('.sheet__action-damage')!.textContent).toBe('2d6 + 2 slashing')

				await user.click(screen.getByRole('button', { name: 'Roll Greatsword damage' }))
				const roll = damageRoll(row)
				expect(roll.dice).toHaveLength(2)
				for (const die of roll.dice) {
					expect(die).toBeGreaterThanOrEqual(1)
					expect(die).toBeLessThanOrEqual(6)
				}
				expect(roll.modifier).toBe(2)
				expect(roll.total).toBe(roll.dice[0]! + roll.dice[1]! + 2)
			})

			it('has no advantage or disadvantage control on a damage roll, only on the to-hit beside it', async () => {
				const { container } = await renderSheet({ ...character, id: 'dmg-no-mode', inventory: holding('Longsword') })
				const row = attackRow(container, 'Longsword')
				expect(row.querySelector('.sheet__action-damage')!.querySelector('select')).toBeNull()
				expect(row.querySelectorAll('.dice-roll__mode')).toHaveLength(1)
				expect(screen.queryByRole('combobox', { name: 'Roll mode for Longsword damage' })).toBeNull()
				expect(screen.getByRole('combobox', { name: 'Roll mode for Longsword to hit' })).toBeTruthy()
			})

			it('offers no damage roll for the flat Unarmed Strike, though its to-hit still rolls', async () => {
				const { container } = await renderSheet({ ...character, id: 'dmg-unarmed', inventory: holding('Longsword') })
				expect(screen.queryByRole('button', { name: 'Roll Unarmed Strike damage' })).toBeNull()
				expect(screen.getByRole('button', { name: 'Roll Unarmed Strike to hit' })).toBeTruthy()
				expect(screen.getByRole('button', { name: 'Roll Longsword damage' })).toBeTruthy()
				expect(attackRow(container, 'Unarmed Strike').querySelectorAll('.dice-roll__button')).toHaveLength(1)
			})

			it('drops a stale damage result when the modifier behind it changes', async () => {
				const user = userEvent.setup()
				const subject: Character = { ...character, id: 'dmg-stale', inventory: holding('Longsword') }
				const { container, rerender } = await renderSheet(subject)
				await user.click(screen.getByRole('button', { name: 'Roll Longsword damage' }))
				expect(attackRow(container, 'Longsword').querySelector('.dice-roll__result')).not.toBeNull()

				// Strength 15 → 17 lifts the damage modifier from +2 to +3.
				rerender(
					<CharacterSheet
						character={{ ...subject, abilityScores: { ...subject.abilityScores!, scores: { ...subject.abilityScores!.scores, strength: 17 } } }}
					/>,
				)
				await waitFor(() => expect(attackRow(container, 'Longsword').querySelector('.sheet__action-damage')!.textContent).toBe('1d8 + 3 slashing'))
				expect(attackRow(container, 'Longsword').querySelector('.dice-roll__result')).toBeNull()
			})
		})

		describe('roll history (step 9 slice 9c3b)', () => {
			function history(container: HTMLElement): HTMLDetailsElement {
				return container.querySelector('.sheet__persistent-header .sheet__roll-history') as HTMLDetailsElement
			}

			function historyLines(container: HTMLElement): string[] {
				return Array.from(history(container).querySelectorAll('li')).map((li) => li.textContent!)
			}

			function shownResult(scope: Element): string {
				return scope.querySelector('.dice-roll__result')!.textContent!.trim()
			}

			function rowOf(container: HTMLElement, section: string, text: string): HTMLElement {
				return Array.from(container.querySelectorAll(`${section} li`)).find((li) => li.textContent?.includes(text)) as HTMLElement
			}

			it('starts closed and empty', async () => {
				const { container } = await renderSheet({ ...character, id: 'history-empty', inventory: holding('Longsword') })
				expect(history(container).open).toBe(false)
				expect(history(container).querySelector('summary')!.textContent).toBe('Roll history')
				expect(historyLines(container)).toEqual([])
			})

			it('adds one entry per roll from every kind of button, newest first, matching each inline result', async () => {
				const user = userEvent.setup()
				const { container } = await renderSheet({ ...character, id: 'history-mixed', inventory: holding('Longsword') })

				await user.click(screen.getByRole('button', { name: 'Roll Strength saving throw' }))
				const save = shownResult(rowOf(container, '.sheet__saving-throws', 'Strength:'))
				await user.click(screen.getByRole('button', { name: 'Roll Athletics check' }))
				const skill = shownResult(rowOf(container, '.sheet__skills', 'Athletics:'))
				await user.click(screen.getByRole('button', { name: 'Roll Longsword to hit' }))
				const toHit = shownResult(attackRow(container, 'Longsword').querySelector('.sheet__action-to-hit')!)
				await user.click(screen.getByRole('button', { name: 'Roll Longsword damage' }))
				const damage = shownResult(attackRow(container, 'Longsword').querySelector('.sheet__action-damage')!.parentElement!)
				await user.click(screen.getByRole('button', { name: 'Roll initiative' }))
				const initiative = shownResult(container.querySelector('.sheet__initiative')!)

				expect(historyLines(container)).toEqual([
					`Initiative: ${initiative}`,
					`Longsword damage: ${damage}`,
					`Longsword to hit: ${toHit}`,
					`Athletics check: ${skill}`,
					`Strength saving throw: ${save}`,
				])
				expect(history(container).open).toBe(false)
			})

			/* D117: a death save is a roll like the others and lands in the same list, outcome included. */
			it('records a death save roll, and shows the number in the header', async () => {
				const user = userEvent.setup()
				const random = vi.spyOn(Math, 'random').mockReturnValue(0)
				try {
					const { container } = render(<CharacterSheet character={{ ...character, id: 'history-death', currentHp: 0 }} onEditHitPoints={vi.fn()} />)
					await screen.findByRole('heading', { name: 'Aria' })

					await user.click(screen.getByRole('button', { name: 'Roll death save' }))

					expect(historyLines(container)).toEqual(['Death save: Rolled 1 — two failures.'])
					expect(container.querySelector('.sheet__death-save-roll')!.textContent).toBe('Rolled 1 — two failures.')
				} finally {
					random.mockRestore()
				}
			})

			it('keeps the newest 50 and drops the oldest on the 51st roll', async () => {
				const user = userEvent.setup()
				const { container } = await renderSheet({ ...character, id: 'history-cap', inventory: holding('Longsword') })
				await user.click(screen.getByRole('button', { name: 'Roll Strength saving throw' }))
				for (let i = 0; i < 49; i++) await user.click(screen.getByRole('button', { name: 'Roll Athletics check' }))
				expect(historyLines(container)).toHaveLength(50)
				expect(historyLines(container)[49]).toMatch(/^Strength saving throw: /)

				await user.click(screen.getByRole('button', { name: 'Roll Athletics check' }))
				expect(historyLines(container)).toHaveLength(50)
				expect(historyLines(container).every((line) => line.startsWith('Athletics check: '))).toBe(true)
			})
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
			// Slice b-fix: the refusal now uses the SAME notice the equip displacement does, and is announced (role="status") rather than only drawn.
			const refusal = inventorySection(container).querySelector('.sheet__inventory-notice')!
			expect(refusal.getAttribute('role')).toBe('status')
			expect(refusal.textContent).toBe('Cannot attune to Wand of the War Mage, +1: you can be attuned to at most 3 magic items at once, and 3 already are.')
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
			expect(inventorySection(second).querySelector('.sheet__inventory-notice')!.textContent).toContain('at most 4 magic items at once')
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
			await user.click(screen.getByRole('button', { name: 'Put down Chain Mail' }))
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
			const row = Array.from(container.querySelectorAll('.sheet__action-row')).find(
				(tr) => tr.querySelector('.sheet__action-name')?.textContent === name,
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
			expect(row.querySelector('.sheet__action-damage')!.textContent).toBe('1d4 + 3 piercing')
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
			expect(row.querySelector('.sheet__action-damage')!.textContent).toBe('1d8 + 4 slashing')
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
			expect(withheld.querySelector('.sheet__action-damage')!.textContent).toBe('1d8 + 2 slashing')

			cleanup()
			const attuned: Character = { ...unattuned, id: 'mb-attuned', inventory: [{ ...unattuned.inventory![0], attuned: true }] }
			const { container: second } = await renderSheet(attuned)
			const applied = attackNamed(second, 'Sword of Sharpness +3')
			expect(applied.textContent).toContain('+8')
			expect(applied.querySelector('.sheet__action-damage')!.textContent).toBe('1d8 + 5 slashing')
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

		/*
		 * The markup form the renderer does not know: {#itemEntry Name|Source} is
		 * a reference to a SHARED description template, filled from the item's own
		 * fields (resist, detail1) before <Entries> ever sees it.
		 */
		it('fills a {#itemEntry} reference from the shared template — text, not source', async () => {
			const owner: Character = {
				...character,
				id: 'desc-itementry',
				inventory: [{ name: 'Ring of Fire Resistance', source: 'XDMG', quantity: 1 }],
			}
			const { container } = await renderSheet(owner)

			const shown = descriptions(container)
			expect(shown).toHaveLength(1)
			const text = shown[0].textContent!
			expect(text).toContain('Resistance to fire damage while wearing this ring')
			expect(text).toContain('The ring is set with a pearl.')
			// None of the three brace sigils survives to the DOM.
			expect(text).not.toContain('{#')
			expect(text).not.toContain('{{')
			expect(text).not.toContain('{@')
			expect(text).not.toContain('|XPHB')
			// The shared markup renderer ran on the resolved text (D4 — it keeps the reference).
			expect(shown[0].querySelector('[data-ref-category="variantrule"]')!.textContent).toBe('Resistance')
		})

		it('shows a visible, named note when the {#itemEntry} template is missing (D43)', async () => {
			vi.mocked(loadItemEntryTemplates).mockResolvedValueOnce([])
			const owner: Character = {
				...character,
				id: 'desc-itementry-missing',
				inventory: [{ name: 'Ring of Fire Resistance', source: 'XDMG', quantity: 1 }],
			}
			const { container } = await renderSheet(owner)

			const shown = descriptions(container)
			expect(shown).toHaveLength(1)
			const text = shown[0].textContent!
			expect(text).toContain('"Ring of Resistance|XDMG" is not in the data')
			expect(text).not.toContain('{#')
			expect(text).not.toContain('{{')
		})
	})

	/*
	 * Custom items (build order step 7, slice e2a). End to end for the same
	 * reason the slices before it are: the row the player ends up with is the
	 * product of the form, the stored definition and the resolver, and a bug in
	 * any one of the three is invisible from the other two.
	 */
	describe('custom items (step 7 slice e2a)', () => {
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

		const scarf = {
			name: 'Scarf of Warmth',
			source: CUSTOM_ITEM_SOURCE,
			quantity: 1,
			custom: { name: 'Scarf of Warmth', kind: 'worn' as const, valueCopper: 5000, description: 'You are comfortable in cold weather.' },
		}

		it('creates one from nothing, carrying every field the form offers onto the new row', async () => {
			const user = userEvent.setup()
			const onEditInventory = vi.fn()
			await renderSheet(character, onEditInventory)

			await user.type(screen.getByLabelText('Custom item name'), 'Scarf of Warmth')
			await user.selectOptions(screen.getByLabelText('Custom item kind'), 'worn')
			await user.clear(screen.getByLabelText('Value in gold'))
			await user.type(screen.getByLabelText('Value in gold'), '50')
			await user.tab()
			await user.click(screen.getByLabelText('Custom item requires attunement'))
			await user.type(screen.getByLabelText('Custom item attunement condition'), 'by a bard')
			await user.type(screen.getByLabelText('Custom item description'), 'You are comfortable in cold weather.')
			await user.click(screen.getByRole('button', { name: 'Add custom item' }))

			expect(onEditInventory).toHaveBeenCalledWith([
				{
					name: 'Scarf of Warmth',
					source: CUSTOM_ITEM_SOURCE,
					quantity: 1,
					custom: {
						name: 'Scarf of Warmth',
						kind: 'worn',
						valueCopper: 5000,
						requiresAttunement: true,
						attunementCondition: 'by a bard',
						description: 'You are comfortable in cold weather.',
					},
				},
			])
		})

		/*
		 * Fix slice: the resistances/immunities controls used to be native
		 * multi-selects, which need ctrl-click for more than one pick and cannot be
		 * driven from a touch screen — walking the app landed a resistance and an
		 * immunity that were never chosen. Checkboxes fix that; this proves several
		 * of each survive a save and a reload, not just the form's own state.
		 */
		it('several resistances and immunities chosen through the checkboxes survive a save and reload', async () => {
			const user = userEvent.setup()
			const onEditInventory = vi.fn()
			await renderSheet(character, onEditInventory)

			await user.type(screen.getByLabelText('Custom item name'), 'Ashen Cloak')
			await user.selectOptions(screen.getByLabelText('Custom item kind'), 'worn')
			await user.click(screen.getByLabelText('Custom item resistances: Fire'))
			await user.click(screen.getByLabelText('Custom item resistances: Cold'))
			await user.click(screen.getByLabelText('Custom item immunities: Poison'))
			await user.click(screen.getByRole('button', { name: 'Add custom item' }))

			const saved = onEditInventory.mock.calls.at(-1)![0]
			expect(saved).toEqual([
				{
					name: 'Ashen Cloak',
					source: CUSTOM_ITEM_SOURCE,
					quantity: 1,
					custom: { name: 'Ashen Cloak', kind: 'worn', resist: ['fire', 'cold'], immune: ['poison'] },
				},
			])
			cleanup()

			// Reloaded from storage, editing shows the same three boxes ticked and no others.
			await renderSheet({ ...character, id: 'ci-reload-resist', inventory: saved }, vi.fn())
			await user.click(screen.getByRole('button', { name: 'Edit Ashen Cloak' }))
			expect((screen.getByLabelText('Custom item resistances: Fire') as HTMLInputElement).checked).toBe(true)
			expect((screen.getByLabelText('Custom item resistances: Cold') as HTMLInputElement).checked).toBe(true)
			expect((screen.getByLabelText('Custom item resistances: Acid') as HTMLInputElement).checked).toBe(false)
			expect((screen.getByLabelText('Custom item immunities: Poison') as HTMLInputElement).checked).toBe(true)
			expect((screen.getByLabelText('Custom item immunities: Fire') as HTMLInputElement).checked).toBe(false)
		})

		/* D74: a value typed in gold, including a fraction (a torch is 1 copper, 0.01 gp), arrives in storage as whole copper. */
		it('a fractional value in gold arrives in storage as the right number of copper', async () => {
			const user = userEvent.setup()
			const onEditInventory = vi.fn()
			await renderSheet(character, onEditInventory)

			await user.type(screen.getByLabelText('Custom item name'), 'Tiny Whistle')
			await user.clear(screen.getByLabelText('Value in gold'))
			await user.type(screen.getByLabelText('Value in gold'), '0.01')
			await user.tab()
			await user.click(screen.getByRole('button', { name: 'Add custom item' }))

			expect(onEditInventory).toHaveBeenCalledWith([
				expect.objectContaining({ custom: expect.objectContaining({ valueCopper: 1 }) }),
			])
		})

		it('creates one by copying an existing item, with the copy seeding the form', async () => {
			const user = userEvent.setup()
			const onEditInventory = vi.fn()
			const { container } = await renderSheet(character, onEditInventory)

			const copyList = container.querySelector('.sheet__custom-item .option-list__toggle') as HTMLElement
			await user.click(copyList)
			await user.click(screen.getByRole('radio', { name: 'Chain Mail (XPHB)' }))

			// The form is seeded from the item, computed fields included, so only the change has to be typed (slice e2b).
			expect((screen.getByLabelText('Custom item name') as HTMLInputElement).value).toBe('Chain Mail')
			expect((screen.getByLabelText('Custom item kind') as HTMLSelectElement).value).toBe('armour')
			expect((screen.getByLabelText('Custom item armour class') as HTMLInputElement).value).toBe('16')
			expect((screen.getByLabelText('Custom item armour category') as HTMLSelectElement).value).toBe('heavy')
			// Slice e2c: both penalties come with the copy, so a quiet chain mail is a change the player makes rather than one the copy makes for them.
			expect((screen.getByLabelText('Custom item stealth disadvantage') as HTMLInputElement).checked).toBe(true)
			expect((screen.getByLabelText('Custom item Strength requirement') as HTMLInputElement).value).toBe('13')

			await user.click(screen.getByRole('button', { name: 'Add custom item' }))

			expect(onEditInventory).toHaveBeenCalledWith([
				{
					name: 'Chain Mail',
					source: CUSTOM_ITEM_SOURCE,
					quantity: 1,
					custom: {
						name: 'Chain Mail',
						kind: 'armour',
						armourClass: 16,
						armourCategory: 'heavy',
						stealthDisadvantage: true,
						strengthRequirement: 13,
					},
				},
			])
		})

		/*
		 * Fix slice: slice e2c put both controls on armour AND shield, and on a
		 * shield neither does anything — the shield path carries neither field, so
		 * ticking the box or typing a number was silently thrown away. A control
		 * that does nothing is worse than no control, and no book shield carries
		 * either property.
		 */
		it('shows neither the Stealth nor the Strength control on the shield kind', async () => {
			const user = userEvent.setup()
			await renderSheet(character, vi.fn())

			await user.selectOptions(screen.getByLabelText('Custom item kind'), 'armour')
			expect(screen.getByLabelText('Custom item stealth disadvantage')).toBeTruthy()
			expect(screen.getByLabelText('Custom item Strength requirement')).toBeTruthy()

			await user.selectOptions(screen.getByLabelText('Custom item kind'), 'shield')
			expect(screen.queryByLabelText('Custom item stealth disadvantage')).toBeNull()
			expect(screen.queryByLabelText('Custom item Strength requirement')).toBeNull()
			// The AC field stays — a shield still declares the bonus it adds.
			expect(screen.getByLabelText('Custom item armour class')).toBeTruthy()
		})

		/* The rule is correct — only heavy armour has a Strength requirement — but the form used to let it be set on light/medium with nothing saying it would do nothing. */
		it('notes beside the Strength requirement that only heavy armour is affected by it', async () => {
			const user = userEvent.setup()
			const { container } = await renderSheet(character, vi.fn())

			await user.selectOptions(screen.getByLabelText('Custom item kind'), 'armour')
			expect(container.querySelector('.sheet__custom-item-armour')!.textContent).toContain('only heavy armour is slowed by an unmet Strength requirement')

			await user.selectOptions(screen.getByLabelText('Custom item armour category'), 'heavy')
			expect(container.querySelector('.sheet__custom-item-armour')!.textContent).not.toContain('only heavy armour is slowed by an unmet Strength requirement')

			await user.selectOptions(screen.getByLabelText('Custom item armour category'), 'medium')
			expect(container.querySelector('.sheet__custom-item-armour')!.textContent).toContain('only heavy armour is slowed by an unmet Strength requirement')
		})

		/* Slice e2c: the whole point of the two fields is that switching one off is a decision, and the sheet has to show the decision landing. */
		it('a custom suit imposes the Stealth disadvantage it declares, and none when it declares none', async () => {
			const suit = (stealthDisadvantage: true | undefined) => ({
				name: 'Bark Plate',
				source: CUSTOM_ITEM_SOURCE,
				quantity: 1,
				equipped: 'worn' as const,
				custom: { name: 'Bark Plate', kind: 'armour' as const, armourClass: 16, armourCategory: 'heavy' as const, ...(stealthDisadvantage ? { stealthDisadvantage } : {}) },
			})

			const hampering = await renderSheet({ ...character, id: 'ci-stealth-on', inventory: [suit(true)] })
			await waitFor(() => expect(hampering.container.querySelector('.sheet__armour-class-value')!.textContent).toBe('16'))
			expect(hampering.container.querySelector('.sheet__stealth-note')!.textContent).toContain('Disadvantage on Stealth checks (Bark Plate)')
			cleanup()

			const quiet = await renderSheet({ ...character, id: 'ci-stealth-off', inventory: [suit(undefined)] })
			// The armour is unchanged — only the note goes.
			await waitFor(() => expect(quiet.container.querySelector('.sheet__armour-class-value')!.textContent).toBe('16'))
			expect(quiet.container.querySelector('.sheet__stealth-note')).toBeNull()
		})

		it('a custom suit costs 10 feet of speed to a character below the Strength it asks for', async () => {
			const weak: Character = {
				...character,
				id: 'ci-strength',
				abilityScores: { ...character.abilityScores!, scores: { ...character.abilityScores!.scores, strength: 10 } },
				inventory: [
					{
						name: 'Bark Plate',
						source: CUSTOM_ITEM_SOURCE,
						quantity: 1,
						equipped: 'worn',
						custom: { name: 'Bark Plate', kind: 'armour', armourClass: 16, armourCategory: 'heavy', strengthRequirement: 13 },
					},
				],
			}
			const { container } = await renderSheet(weak)
			const speedItem = container.querySelector('.sheet__speed')!
			await waitFor(() => expect(speedItem.textContent).toContain('20 ft.'))
			expect(speedItem.textContent).toContain('Bark Plate (Strength 13 required, you have 10)')
		})

		it('shows the row with its description, its value and a custom marker', async () => {
			const owner: Character = { ...character, id: 'ci-row', inventory: [scarf] }
			const { container } = await renderSheet(owner)

			const row = inventoryRow(container, 'Scarf of Warmth')
			expect(row.textContent).toContain('(custom)')
			expect(row.textContent).toContain('50 gp')
			expect(row.querySelector('.sheet__item-description')!.textContent).toContain('You are comfortable in cold weather.')
			// It resolves against its own definition, so nothing reports it missing from items.json (D43).
			expect(row.textContent).not.toContain('Item data not found')
		})

		/* D9/D55: what the app cannot compute is SHOWN, never quietly applied — a sentence about Stealth changes no number. */
		it('applies nothing from the description text', async () => {
			const owner: Character = {
				...character,
				id: 'ci-prose',
				inventory: [
					{
						name: 'Comfortable Chain Mail',
						source: CUSTOM_ITEM_SOURCE,
						quantity: 1,
						equipped: 'worn',
						custom: { name: 'Comfortable Chain Mail', kind: 'armour', description: 'This suit does not impose disadvantage on Stealth checks.' },
					},
				],
			}
			const { container } = await renderSheet(owner)

			expect(inventoryRow(container, 'Comfortable Chain Mail').textContent).toContain('does not impose disadvantage on Stealth')
			// Armour Class is 10 + Dex 2: a custom suit declares no AC in this slice, and prose is never read for one (D21).
			await waitFor(() => expect(container.querySelector('.sheet__armour-class-value')).toBeTruthy())
			expect(container.querySelector('.sheet__armour-class-value')!.textContent).toBe('12')
		})

		it('equips, attunes and takes a magic bonus like any other row', async () => {
			const user = userEvent.setup()
			const onEditInventory = vi.fn()
			const blade = {
				name: 'Bone Blade',
				source: CUSTOM_ITEM_SOURCE,
				quantity: 1,
				custom: { name: 'Bone Blade', kind: 'weapon' as const, requiresAttunement: true as const, attunementCondition: 'by a druid' },
			}
			const owner: Character = { ...character, id: 'ci-equip', inventory: [blade] }
			const { container } = await renderSheet(owner, onEditInventory)

			// The requirement is printed exactly as the definition writes it and never evaluated (D78).
			expect(inventoryRow(container, 'Bone Blade').textContent).toContain('Requires attunement by a druid')

			await user.click(screen.getByRole('button', { name: 'Equip Bone Blade' }))
			expect(onEditInventory).toHaveBeenLastCalledWith([{ ...blade, equipped: 'held' }])

			await user.click(screen.getByRole('button', { name: 'Attune to Bone Blade' }))
			expect(onEditInventory).toHaveBeenLastCalledWith([{ ...blade, attuned: true }])

			await user.selectOptions(screen.getByLabelText('Magic bonus for Bone Blade'), '1')
			expect(onEditInventory).toHaveBeenLastCalledWith([{ ...blade, magicBonus: 1 }])
		})

		it('shows a player-set bonus in the custom item’s own name (D79)', async () => {
			const owner: Character = {
				...character,
				id: 'ci-bonus',
				inventory: [{ name: 'Bone Blade', source: CUSTOM_ITEM_SOURCE, quantity: 1, magicBonus: 1, custom: { name: 'Bone Blade', kind: 'weapon' } }],
			}
			const { container } = await renderSheet(owner)
			expect(inventorySection(container).textContent).toContain('Bone Blade +1')
		})

		/* Storage refuses a character wearing two suits, so the displacement rule has to see a custom one too. */
		it('wearing a custom suit puts down the real one it displaces', async () => {
			const user = userEvent.setup()
			const onEditInventory = vi.fn()
			const owner: Character = {
				...character,
				id: 'ci-displace',
				inventory: [
					{ name: 'Chain Mail', source: 'XPHB', quantity: 1, equipped: 'worn' },
					{ name: 'Bark Plate', source: CUSTOM_ITEM_SOURCE, quantity: 1, custom: { name: 'Bark Plate', kind: 'armour' } },
				],
			}
			const { container } = await renderSheet(owner, onEditInventory)

			await user.click(screen.getByRole('button', { name: 'Equip Bark Plate' }))
			expect(onEditInventory).toHaveBeenLastCalledWith([
				{ name: 'Chain Mail', source: 'XPHB', quantity: 1 },
				{ name: 'Bark Plate', source: CUSTOM_ITEM_SOURCE, quantity: 1, equipped: 'worn', custom: { name: 'Bark Plate', kind: 'armour' } },
			])
			expect(container.querySelector('.sheet__inventory-notice')!.textContent).toContain('Unequipped Chain Mail')
		})

		it('keeps two custom items that differ in one field on separate rows', async () => {
			const owner: Character = {
				...character,
				id: 'ci-two',
				inventory: [
					{ name: 'Scarf', source: CUSTOM_ITEM_SOURCE, quantity: 1, custom: { name: 'Scarf', kind: 'worn' } },
					{ name: 'Scarf', source: CUSTOM_ITEM_SOURCE, quantity: 1, custom: { name: 'Scarf', kind: 'worn', description: 'It glows.' } },
				],
			}
			const { container } = await renderSheet(owner)

			const rows = Array.from(inventorySection(container).querySelectorAll('.sheet__inventory-list > li'))
			expect(rows).toHaveLength(2)
			expect(rows.filter((row) => row.textContent?.includes('It glows.'))).toHaveLength(1)
		})

		it('renders a malformed definition, named, with the problem stated and the section intact (D43)', async () => {
			const owner: Character = {
				...character,
				id: 'ci-broken',
				inventory: [
					{ name: 'Bad Thing', source: CUSTOM_ITEM_SOURCE, quantity: 1, custom: { name: 'Bad Thing', kind: 'banana' } as unknown as CustomItemDefinition },
					{ name: 'Torch', source: 'XPHB', quantity: 1 },
				],
			}
			const { container } = await renderSheet(owner)

			const row = inventoryRow(container, 'Bad Thing')
			expect(row.textContent).toContain('Custom item "Bad Thing" cannot be read')
			expect(row.textContent).toContain('banana')
			// Neither the rest of the list nor the sections that read the inventory fall over.
			expect(inventoryRow(container, 'Torch').textContent).toContain('A torch sheds bright light')
			expect(container.querySelector('.sheet__armour-class-value')!.textContent).toBe('12')
		})
	})

	/*
	 * What a custom item COUNTS FOR (build order step 7, slice e2b). End to end
	 * for the same reason e2a is: the number a player sees is the product of the
	 * stored definition, the resolver and the value's own module, and a test of
	 * any one of the three has twice now passed on a sheet that showed nothing.
	 *
	 * The character is the file's Fighter 5: STR 15 (+2), DEX 14 (+2), PB +3,
	 * Elf (30 ft. walk, 60 ft. darkvision), proficient with martial weapons.
	 */
	describe('custom items that count (step 7 slice e2b)', () => {
		function inventorySection(container: HTMLElement): HTMLElement {
			return container.querySelector('.sheet__inventory') as HTMLElement
		}

		async function renderSheet(subject: Character, onEditInventory?: (inventory: Character['inventory'] & object) => void) {
			const rendered = render(<CharacterSheet character={subject} onEditInventory={onEditInventory} />)
			await screen.findByRole('heading', { name: 'Aria' })
			await waitFor(() => expect(inventorySection(rendered.container).querySelector('.sheet__attunement-count')).toBeTruthy())
			return rendered
		}

		function owning(id: string, ...inventory: NonNullable<Character['inventory']>): Character {
			return { ...character, id, inventory }
		}

		function customRow(custom: CustomItemDefinition, extra: Partial<NonNullable<Character['inventory']>[number]> = {}) {
			return { name: custom.name, source: CUSTOM_ITEM_SOURCE, quantity: 1, custom, ...extra }
		}

		async function armourClassOf(container: HTMLElement): Promise<string> {
			await waitFor(() => expect(container.querySelector('.sheet__armour-class-value')).toBeTruthy())
			return container.querySelector('.sheet__armour-class-value')!.textContent ?? ''
		}

		function traitLine(container: HTMLElement, label: string): HTMLElement {
			// Speed moved to the persistent header (slice 1); size and darkvision stay in the traits section.
			if (label === 'Speed') return container.querySelector('.sheet__speed') as HTMLElement
			const line = Array.from(container.querySelectorAll('.sheet__traits li')).find((li) => li.textContent?.startsWith(label))
			if (!line) throw new Error(`no trait line for ${label}`)
			return line as HTMLElement
		}

		it('a worn custom suit reaches Armour Class with the Dexterity cap its category calls for', async () => {
			const medium = await renderSheet(
				owning('e2b-medium', customRow({ name: 'Bark Plate', kind: 'armour', armourClass: 14, armourCategory: 'medium' }, { equipped: 'worn' })),
			)
			// 14 + Dex 2 (uncapped at +2 by medium armour).
			expect(await armourClassOf(medium.container)).toBe('16')
			cleanup()

			const heavy = await renderSheet(
				owning('e2b-heavy', customRow({ name: 'Bark Plate', kind: 'armour', armourClass: 14, armourCategory: 'heavy' }, { equipped: 'worn' })),
			)
			// Heavy armour allows no Dexterity bonus at all — the same rule a real suit follows.
			expect(await armourClassOf(heavy.container)).toBe('14')
			expect(heavy.container.querySelector('.sheet__armour-class')!.textContent).toContain('heavy armour allows no Dexterity bonus')
		})

		it('a custom shield adds its bonus on top of the suit', async () => {
			const { container } = await renderSheet(
				owning(
					'e2b-shield',
					customRow({ name: 'Bark Plate', kind: 'armour', armourClass: 14, armourCategory: 'medium' }, { equipped: 'worn' }),
					customRow({ name: 'Bark Shield', kind: 'shield', armourClass: 2 }, { equipped: 'held' }),
				),
			)
			expect(await armourClassOf(container)).toBe('18')
		})

		/* Requirement of this slice: "no armour equipped" while a suit is plainly worn reads as a bug, however true it is. */
		it('names a worn custom suit that has no Armour Class instead of reporting no armour', async () => {
			const { container } = await renderSheet(owning('e2b-unset', customRow({ name: 'Bark Plate', kind: 'armour' }, { equipped: 'worn' })))

			expect(await armourClassOf(container)).toBe('12')
			const section = container.querySelector('.sheet__armour-class')!
			expect(section.textContent).toContain('Bark Plate is equipped, but its Armour Class is not set')
			expect(section.textContent).not.toContain('no armour equipped')
			expect(container.querySelector('.sheet__armour-not-set')).toBeTruthy()
		})

		it('a held custom weapon produces an attack line with the right to-hit and damage', async () => {
			const { container } = await renderSheet(
				owning(
					'e2b-weapon',
					customRow(
						{ name: 'Bone Blade', kind: 'weapon', damageDice: '1d8', damageType: 'slashing', weaponCategory: 'martial', weaponRange: 'melee' },
						{ equipped: 'held' },
					),
				),
			)
			const line = Array.from(container.querySelectorAll('.sheet__action-row')).find((tr) => tr.textContent?.includes('Bone Blade'))!
			// STR +2 and the martial proficiency bonus +3.
			expect(line.textContent).toContain('+5')
			expect(line.textContent).toContain('1d8 + 2 slashing')
		})

		it('applies a player-set magic bonus to that line once, in each roll (D79)', async () => {
			const { container } = await renderSheet(
				owning(
					'e2b-weapon-bonus',
					customRow(
						{ name: 'Bone Blade', kind: 'weapon', damageDice: '1d8', damageType: 'slashing', weaponCategory: 'martial' },
						{ equipped: 'held', magicBonus: 1 },
					),
				),
			)
			const line = Array.from(container.querySelectorAll('.sheet__action-row')).find((tr) => tr.textContent?.includes('Bone Blade'))!
			expect(line.textContent).toContain('Bone Blade +1')
			expect(line.textContent).toContain('+6')
			expect(line.textContent).toContain('1d8 + 3 slashing')
		})

		it('withholds a custom item’s resistance until it is attuned, then grants it', async () => {
			const ring: CustomItemDefinition = { name: 'Band of Ash', kind: 'worn', requiresAttunement: true, resist: ['fire'] }

			const unattuned = await renderSheet(owning('e2b-resist-off', customRow(ring)))
			const before = unattuned.container.querySelector('.sheet__damage-responses')!
			await waitFor(() => expect(before.textContent).toContain('Band of Ash'))
			expect(before.textContent).toContain('requires attunement and you are not attuned to it')
			expect(before.querySelector('.sheet__damage-response-list')).toBeNull()
			cleanup()

			const attuned = await renderSheet(owning('e2b-resist-on', customRow(ring, { attuned: true })))
			const after = attuned.container.querySelector('.sheet__damage-responses')!
			await waitFor(() => expect(after.textContent).toContain('Fire'))
			expect(after.querySelector('.sheet__damage-response-list')!.textContent).toContain('Fire — resistance (Band of Ash)')
		})

		it('a custom item’s speed adjustment reaches the walking speed', async () => {
			const { container } = await renderSheet(owning('e2b-speed', customRow({ name: 'Bounding Boots', kind: 'worn', speedBonus: 10 })))
			const speed = traitLine(container, 'Speed')
			await waitFor(() => expect(speed.textContent).toContain('40 ft.'))
			expect(speed.textContent).toContain('Bounding Boots')
		})

		it('a custom item’s darkvision reaches the value, beating the species figure rather than adding to it', async () => {
			const { container } = await renderSheet(owning('e2b-dark', customRow({ name: 'Night Goggles', kind: 'worn', darkvision: 120 })))
			const darkvision = traitLine(container, 'Darkvision')
			await waitFor(() => expect(darkvision.textContent).toContain('120 ft.'))
			// The Elf's own 60 is listed and beaten, never summed with the item's.
			expect(darkvision.textContent).toContain('does not exceed from item (Night Goggles)')
		})

		it('a custom item’s flat bonus reaches its target once attuned', async () => {
			const charm: CustomItemDefinition = { name: 'Charm of the Sage', kind: 'worn', requiresAttunement: true, bonusArmourClass: 1, bonusSavingThrow: 2 }
			const { container } = await renderSheet(owning('e2b-flat', customRow(charm, { attuned: true })))

			// Nothing is worn, so 10 + Dex 2 + the charm's 1.
			expect(await armourClassOf(container)).toBe('13')
			const constitution = Array.from(container.querySelectorAll('.sheet__saving-throws li')).find((li) => li.textContent?.includes('Constitution'))!
			// CON +1, proficient +3, charm +2.
			expect(constitution.textContent).toContain('+6')
		})

		/* Editing exists so a change costs the field, not the item: the row's quantity, attunement and bonus all survive it. */
		it('editing a custom item changes what it contributes, keeping the rest of the row', async () => {
			const user = userEvent.setup()
			const onEditInventory = vi.fn()
			const unfinished = owning('e2b-edit', customRow({ name: 'Bark Plate', kind: 'armour' }, { equipped: 'worn', quantity: 2, magicBonus: 1 }))
			const first = await renderSheet(unfinished, onEditInventory)

			expect(await armourClassOf(first.container)).toBe('12')

			await user.click(screen.getByRole('button', { name: 'Edit Bark Plate +1' }))
			await user.type(screen.getByLabelText('Custom item armour class'), '14')
			await user.selectOptions(screen.getByLabelText('Custom item armour category'), 'medium')
			await user.click(screen.getByRole('button', { name: 'Save changes' }))

			const edited = onEditInventory.mock.calls.at(-1)![0]
			expect(edited).toEqual([
				{
					name: 'Bark Plate',
					source: CUSTOM_ITEM_SOURCE,
					quantity: 2,
					equipped: 'worn',
					magicBonus: 1,
					custom: { name: 'Bark Plate', kind: 'armour', armourClass: 14, armourCategory: 'medium' },
				},
			])
			cleanup()

			// 14 + Dex 2 + the +1 set on the row, and the "not set" line is gone.
			const second = await renderSheet({ ...unfinished, id: 'e2b-edited', inventory: edited })
			expect(await armourClassOf(second.container)).toBe('17')
			expect(second.container.querySelector('.sheet__armour-not-set')).toBeNull()
		})

		it('puts an edited item down when its new kind cannot hold the slot it was in', async () => {
			const user = userEvent.setup()
			const onEditInventory = vi.fn()
			await renderSheet(owning('e2b-edit-kind', customRow({ name: 'Bone Blade', kind: 'weapon', damageDice: '1d8' }, { equipped: 'held' })), onEditInventory)

			await user.click(screen.getByRole('button', { name: 'Edit Bone Blade' }))
			await user.selectOptions(screen.getByLabelText('Custom item kind'), 'worn')
			await user.click(screen.getByRole('button', { name: 'Save changes' }))

			// A sword edited into a cloak is not still in hand, and a slot nothing can empty is worse than an empty slot.
			expect(onEditInventory.mock.calls.at(-1)![0]).toEqual([
				{ name: 'Bone Blade', source: CUSTOM_ITEM_SOURCE, quantity: 1, custom: { name: 'Bone Blade', kind: 'worn', damageDice: '1d8' } },
			])
		})

		it('offers the Edit control on a custom row and on no other', async () => {
			const { container } = await renderSheet(
				owning('e2b-edit-only', customRow({ name: 'Bone Blade', kind: 'weapon' }), { name: 'Torch', source: 'XPHB', quantity: 1 }),
				vi.fn(),
			)
			const buttons = Array.from(inventorySection(container).querySelectorAll('button')).map((button) => button.getAttribute('aria-label'))
			expect(buttons).toContain('Edit Bone Blade')
			expect(buttons).not.toContain('Edit Torch')
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
			optionalFeatureChoices: [{ featureType: 'EI', choices: [{ name: 'Agonizing Blast' }, { name: 'Devil’s Sight' }] }],
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
				optionalFeatureChoices: [{ featureType: 'EI', choices: [{ name: 'Devil’s Sight' }] }],
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

	/*
	 * The full class + subclass feature list (D87). loadGrantedClassFeatures is
	 * stubbed, but grantedClassFeaturesFrom — the whole resolver — runs for real
	 * over the fixtures here, and loadResolverData feeds the same records so the
	 * <details> expansions resolve too. End-to-end for the same reason the
	 * sections above are: a resolved feature that never reaches the tab has
	 * shipped twice in this project.
	 */
	describe('full class and subclass feature list (D87)', () => {
		const CLASSES = [
			{
				entryType: 'class',
				name: 'Fighter',
				source: 'XPHB',
				classFeatureIds: [
					'cf|second wind|fighter|xphb|1|xphb',
					'cf|fighting style|fighter|xphb|1|xphb', // choice container — ClassOptionalFeaturePicker owns it
					'cf|fighter subclass|fighter|xphb|3|xphb', // gainSubclassFeature placeholder
				],
				classFeatures: [
					'Second Wind|Fighter|XPHB|1',
					'Fighting Style|Fighter|XPHB|1',
					{ gainSubclassFeature: true, classFeature: 'Fighter Subclass|Fighter|XPHB|3' },
				],
			},
			{
				entryType: 'subclass',
				name: 'Champion',
				className: 'Fighter',
				classSource: 'XPHB',
				shortName: 'Champion',
				source: 'XPHB',
				subclassFeatureIds: ['scf|improved critical|fighter|xphb|champion|xphb|3|xphb'],
			},
			{
				entryType: 'class',
				name: 'Cleric',
				source: 'XPHB',
				classFeatureIds: [
					'cf|channel divinity|cleric|xphb|2|xphb',
					'cf|divine conduit|cleric|xphb|7|xphb',
					'cf|cleric subclass|cleric|xphb|3|xphb', // gainSubclassFeature placeholder
				],
				classFeatures: [
					'Channel Divinity|Cleric|XPHB|2',
					'Divine Conduit|Cleric|XPHB|7',
					{ gainSubclassFeature: true, classFeature: 'Cleric Subclass|Cleric|XPHB|3' },
				],
			},
			{
				entryType: 'subclass',
				name: 'Life Domain',
				className: 'Cleric',
				classSource: 'XPHB',
				shortName: 'Life',
				source: 'XPHB',
				// Only the wrapper is in the id list; its three parts are reached by ref alone.
				subclassFeatureIds: ['scf|life domain|cleric|xphb|life|xphb|3|xphb'],
			},
		]

		const CF = [
			{ id: 'cf|second wind|fighter|xphb|1|xphb', name: 'Second Wind', className: 'Fighter', classSource: 'XPHB', level: 1, source: 'XPHB', entries: ['You have a limited well of physical stamina.'] },
			{
				id: 'cf|fighting style|fighter|xphb|1|xphb',
				name: 'Fighting Style',
				className: 'Fighter',
				classSource: 'XPHB',
				level: 1,
				source: 'XPHB',
				entries: [
					'You gain a Fighting Style feat of your choice.',
					{
						type: 'options',
						count: 1,
						entries: [
							{ type: 'refOptionalfeature', optionalfeature: 'Defense|XPHB' },
							{ type: 'refOptionalfeature', optionalfeature: 'Dueling|XPHB' },
						],
					},
				],
			},
			{ id: 'cf|fighter subclass|fighter|xphb|3|xphb', name: 'Fighter Subclass', className: 'Fighter', classSource: 'XPHB', level: 3, source: 'XPHB', entries: ['You gain a Fighter subclass of your choice.'] },
			{
				id: 'cf|channel divinity|cleric|xphb|2|xphb',
				name: 'Channel Divinity',
				className: 'Cleric',
				classSource: 'XPHB',
				level: 2,
				source: 'XPHB',
				entries: [{ type: 'entries', name: 'Channel Divinity', entries: ['You can channel divine energy directly from the Outer Planes.'] }],
			},
			{ id: 'cf|cleric subclass|cleric|xphb|3|xphb', name: 'Cleric Subclass', className: 'Cleric', classSource: 'XPHB', level: 3, source: 'XPHB', entries: ['You gain a Cleric subclass of your choice.'] },
			// A plain feature whose text refs ONE specific "Potent Spellcasting" by uid — the id/uid-not-name case (D87 rule 2).
			{
				id: 'cf|divine conduit|cleric|xphb|7|xphb',
				name: 'Divine Conduit',
				className: 'Cleric',
				classSource: 'XPHB',
				level: 7,
				source: 'XPHB',
				entries: ['Your faith sharpens your magic.', { type: 'refClassFeature', classFeature: 'Potent Spellcasting|Cleric|XPHB|17|XPHB' }],
			},
			{ id: 'cf|potent spellcasting|cleric|xphb|17|xphb', name: 'Potent Spellcasting', className: 'Cleric', classSource: 'XPHB', level: 17, source: 'XPHB', entries: ['Add your Wisdom modifier to the damage of your Cleric cantrips.'] },
			{ id: 'cf|potent spellcasting|druid|xphb|18|xphb', name: 'Potent Spellcasting', className: 'Druid', classSource: 'XPHB', level: 18, source: 'XPHB', entries: ['Add your Wisdom modifier to the damage of your Druid cantrips.'] },
		]

		const SF = [
			{
				id: 'scf|improved critical|fighter|xphb|champion|xphb|3|xphb',
				name: 'Improved Critical',
				className: 'Fighter',
				classSource: 'XPHB',
				subclassShortName: 'Champion',
				subclassSource: 'XPHB',
				level: 3,
				source: 'XPHB',
				entries: ['Your attack rolls can score a critical hit on a roll of 19 or 20.'],
			},
			{
				id: 'scf|life domain|cleric|xphb|life|xphb|3|xphb',
				name: 'Life Domain',
				className: 'Cleric',
				classSource: 'XPHB',
				subclassShortName: 'Life',
				subclassSource: 'XPHB',
				level: 3,
				source: 'XPHB',
				entries: [
					'The life force that suffuses the multiverse blesses you.',
					{ type: 'refSubclassFeature', subclassFeature: 'Disciple of Life|Cleric|XPHB|Life|XPHB|3|XPHB' },
					{ type: 'refSubclassFeature', subclassFeature: 'Preserve Life|Cleric|XPHB|Life|XPHB|3|XPHB' },
				],
			},
			{ id: 'scf|disciple of life|cleric|xphb|life|xphb|3|xphb', name: 'Disciple of Life', className: 'Cleric', classSource: 'XPHB', subclassShortName: 'Life', subclassSource: 'XPHB', level: 3, source: 'XPHB', entries: ['Your healing spells mend more grievous wounds.'] },
			{ id: 'scf|preserve life|cleric|xphb|life|xphb|3|xphb', name: 'Preserve Life', className: 'Cleric', classSource: 'XPHB', subclassShortName: 'Life', subclassSource: 'XPHB', level: 3, source: 'XPHB', entries: ['As a Channel Divinity option, you present your holy symbol and restore hit points.'] },
		]

		const RESOLVER = { classFeatures: CF, subclassFeatures: SF, optionalFeatures: [], feats: [] }

		afterEach(() => {
			vi.mocked(loadGrantedClassFeatures).mockReset().mockResolvedValue([])
			vi.mocked(loadResolverData).mockReset().mockResolvedValue({ classFeatures: [], subclassFeatures: [], optionalFeatures: [], feats: [] })
		})

		it('a Fighter (Champion) 5 lists the granted features and drops the choice container and the subclass placeholder', async () => {
			vi.mocked(loadResolverData).mockResolvedValue(RESOLVER)
			vi.mocked(loadGrantedClassFeatures).mockResolvedValue(grantedClassFeaturesFrom(character, CLASSES, RESOLVER))

			const { container } = render(<CharacterSheet character={character} />)
			await screen.findByRole('heading', { name: 'Aria' })

			const section = await waitFor(() => {
				const found = container.querySelector('.sheet__granted-features')
				expect(found?.textContent).toContain('Second Wind')
				return found!
			})
			expect(section.textContent).toContain('Improved Critical')
			// Rule 3 / rule 4: neither the counted-options container nor the placeholder is listed.
			expect(section.textContent).not.toContain('Fighting Style')
			expect(section.textContent).not.toContain('Fighter Subclass')
		})

		it('a Cleric (Life) 17 keeps the wrapper AND its ref-introduced parts, and resolves the Cleric "Potent Spellcasting" — not the Druid one', async () => {
			vi.mocked(loadResolverData).mockResolvedValue(RESOLVER)
			const cleric: Character = {
				id: 'cl-life',
				name: 'Living Cleric',
				classes: [{ className: 'Cleric', classSource: 'XPHB', subclass: 'Life Domain', level: 17 }],
			}
			vi.mocked(loadGrantedClassFeatures).mockResolvedValue(grantedClassFeaturesFrom(cleric, CLASSES, RESOLVER))

			const { container } = render(<CharacterSheet character={cleric} />)
			await screen.findByRole('heading', { name: 'Living Cleric' })

			const section = await waitFor(() => {
				const found = container.querySelector('.sheet__granted-features')
				expect(found?.textContent).toContain('Disciple of Life')
				return found!
			})
			// Rule 5: the wrapper is an ordinary entry, alongside the features it introduces by ref.
			expect(section.textContent).toContain('Life Domain')
			expect(section.textContent).toContain('Disciple of Life')
			expect(section.textContent).toContain('Preserve Life')
			expect(section.textContent).toContain('Channel Divinity')
			// Rule 2: the closure matched the ref by id, so only the Cleric feature's text appears.
			expect(section.textContent).toContain('damage of your Cleric cantrips')
			expect(section.textContent).not.toContain('damage of your Druid cantrips')
			// Rule 4: the subclass placeholder is not a row.
			expect(section.textContent).not.toContain('Cleric Subclass')
		})
	})

	/*
	 * Usable-feature rows in the actions table (sheet rebuild slice 5 part A,
	 * D86). End-to-end for the same reason the D87 block above is: the row is the
	 * product of the resolver's output, D86's test and the table's own rendering,
	 * and a feature that qualifies in a unit test but never reaches the table has
	 * shipped in this project before. grantedClassFeaturesFrom runs for real over
	 * the fixtures here; only the fetch is stubbed.
	 *
	 * The D86 headline cases, one per class: Second Wind and Action Surge
	 * (Fighter, and Action Surge is the restated-at-17 case), Rage (Barbarian),
	 * Channel Divinity (Cleric), a feat (Lucky), and — now that
	 * OptionalFeatureOption carries `consumes` — the chosen optional features a
	 * Sorcerer's Metamagic and a Battle Master's Maneuvers stand for. Those last
	 * run the real chosenOptionalFeatureOptions over inline fixtures; only the
	 * fetch is stubbed, same as the resolver above.
	 */
	describe('usable-feature rows in the actions table (slice 5 part A, D86)', () => {
		const REST = 'You regain the expended use when you finish a {@variantrule Short Rest|XPHB}.'

		const CLASSES = [
			{
				entryType: 'class',
				name: 'Fighter',
				source: 'XPHB',
				classFeatureIds: ['cf|second wind|fighter|xphb|1|xphb', 'cf|action surge|fighter|xphb|2|xphb', 'cf|action surge|fighter|xphb|17|xphb', 'cf|improved fighter|fighter|xphb|5|xphb'],
				classFeatures: ['Second Wind|Fighter|XPHB|1', 'Action Surge|Fighter|XPHB|2', 'Action Surge|Fighter|XPHB|17', 'Improved Fighter|Fighter|XPHB|5'],
			},
			{
				entryType: 'class',
				name: 'Barbarian',
				source: 'XPHB',
				classFeatureIds: ['cf|rage|barbarian|xphb|1|xphb', 'cf|unarmored defense|barbarian|xphb|1|xphb'],
				classFeatures: ['Rage|Barbarian|XPHB|1', 'Unarmored Defense|Barbarian|XPHB|1'],
			},
			{
				entryType: 'class',
				name: 'Cleric',
				source: 'XPHB',
				classFeatureIds: ['cf|channel divinity|cleric|xphb|2|xphb'],
				classFeatures: ['Channel Divinity|Cleric|XPHB|2'],
			},
		]

		const CF = [
			{ id: 'cf|second wind|fighter|xphb|1|xphb', name: 'Second Wind', className: 'Fighter', classSource: 'XPHB', level: 1, source: 'XPHB', entries: [`You have a limited well of physical stamina. ${REST}`] },
			// Restated at 17 (a second use) — the data holds two records for the one feature.
			{ id: 'cf|action surge|fighter|xphb|2|xphb', name: 'Action Surge', className: 'Fighter', classSource: 'XPHB', level: 2, source: 'XPHB', entries: [`You can push yourself beyond your normal limits. ${REST}`] },
			{ id: 'cf|action surge|fighter|xphb|17|xphb', name: 'Action Surge', className: 'Fighter', classSource: 'XPHB', level: 17, source: 'XPHB', entries: [`You can use it twice before a rest. ${REST}`] },
			// Qualifies under neither test — a passive the table must leave out.
			{ id: 'cf|improved fighter|fighter|xphb|5|xphb', name: 'Improved Fighter', className: 'Fighter', classSource: 'XPHB', level: 5, source: 'XPHB', entries: ['Your attack rolls improve.'] },
			// The `consumes`-only shape: 72 real features qualify this way and no rest tag appears in their text.
			{ id: 'cf|rage|barbarian|xphb|1|xphb', name: 'Rage', className: 'Barbarian', classSource: 'XPHB', level: 1, source: 'XPHB', consumes: { name: 'Rage' }, entries: ['You can enter a Rage as a Bonus Action.'] },
			{ id: 'cf|unarmored defense|barbarian|xphb|1|xphb', name: 'Unarmored Defense', className: 'Barbarian', classSource: 'XPHB', level: 1, source: 'XPHB', entries: ['Your base AC equals 10 plus your Dexterity and Constitution modifiers.'] },
			{ id: 'cf|channel divinity|cleric|xphb|2|xphb', name: 'Channel Divinity', className: 'Cleric', classSource: 'XPHB', level: 2, source: 'XPHB', entries: [`You can channel divine energy directly from the Outer Planes. ${REST}`] },
		]

		const RESOLVER = { classFeatures: CF, subclassFeatures: [], optionalFeatures: [], feats: [] }

		function rowNames(container: HTMLElement): (string | null)[] {
			const table = container.querySelector('.sheet__actions table.sheet__actions-table')!
			return Array.from(table.querySelectorAll('tbody .sheet__action-row .sheet__action-name')).map((node) => node.textContent)
		}

		async function renderFor(subject: Character): Promise<HTMLElement> {
			vi.mocked(loadResolverData).mockResolvedValue(RESOLVER)
			vi.mocked(loadGrantedClassFeatures).mockResolvedValue(grantedClassFeaturesFrom(subject, CLASSES, RESOLVER))
			const { container } = render(<CharacterSheet character={subject} />)
			await screen.findByRole('heading', { name: subject.name })
			await waitFor(() => expect(container.querySelector('.sheet__actions-table')).toBeTruthy())
			return container
		}

		afterEach(() => {
			vi.mocked(loadGrantedClassFeatures).mockReset().mockResolvedValue([])
			vi.mocked(loadResolverData).mockReset().mockResolvedValue({ classFeatures: [], subclassFeatures: [], optionalFeatures: [], feats: [] })
			vi.mocked(loadFeatTextEntries).mockReset().mockResolvedValue([])
		})

		it('a Fighter 17 gets Second Wind and ONE Action Surge row, after the weapon rows, and no row for a passive', async () => {
			const fighter: Character = { ...character, id: 'act-fighter', classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 17 }] }
			const container = await renderFor(fighter)

			await waitFor(() => expect(rowNames(container)).toContain('Second Wind'))
			// The weapon row still comes first; features are appended to the same table.
			expect(rowNames(container)).toEqual(['Unarmed Strike', 'Second Wind', 'Action Surge'])
			expect(rowNames(container)).not.toContain('Improved Fighter')
		})

		/*
		 * Slice 9b2: this describe block's CLASSES fixture carries no classTableGroups
		 * at all (only classFeatureIds/classFeatures), so computeCharacterResources
		 * resolves every one of Second Wind/Rage/Channel Divinity here to "not in
		 * data" — same as the ~90 real subclass-level resources the data never tables.
		 * A row for one of those must render exactly as it did before this slice: a
		 * name only, no "Uses" text anywhere in the row.
		 */
		it('gives no Uses text to a resource row whose maximum is not in the data (the ~90 case, unaffected by slice 9b2)', async () => {
			const cleric: Character = { ...character, id: 'act-cleric-no-uses', classes: [{ className: 'Cleric', classSource: 'XPHB', subclass: null, level: 5 }] }
			const container = await renderFor(cleric)

			const row = await waitFor(() => {
				const found = Array.from(container.querySelectorAll('.sheet__action-row')).find((tr) => tr.querySelector('.sheet__action-name')?.textContent === 'Channel Divinity')
				expect(found).toBeTruthy()
				return found as HTMLElement
			})
			expect(row.textContent).not.toContain('Uses')
			expect(row.querySelector('.sheet__action-uses')).toBeNull()
		})

		it('a feature row fills the Name cell only — Range, To Hit / DC and Damage stay empty', async () => {
			const fighter: Character = { ...character, id: 'act-fighter-cells', classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 5 }] }
			const container = await renderFor(fighter)

			const row = await waitFor(() => {
				const found = Array.from(container.querySelectorAll('.sheet__action-row')).find((tr) => tr.querySelector('.sheet__action-name')?.textContent === 'Second Wind')
				expect(found).toBeTruthy()
				return found as HTMLElement
			})
			expect(row.closest('table.sheet__actions-table')).toBeTruthy()
			expect(row.querySelector('.sheet__action-range')!.textContent).toBe('')
			expect(row.querySelector('.sheet__action-to-hit')!.textContent).toBe('')
			expect(row.querySelector('.sheet__action-damage-cell')!.textContent).toBe('')
			expect(row.querySelector('.sheet__action-notes')!.textContent).toBe('')
		})

		it('a Barbarian gets a Rage row from `consumes` alone, with no rest tag anywhere in its text', async () => {
			const barbarian: Character = { ...character, id: 'act-barb', name: 'Grog', classes: [{ className: 'Barbarian', classSource: 'XPHB', subclass: null, level: 5 }] }
			const container = await renderFor(barbarian)

			await waitFor(() => expect(rowNames(container)).toContain('Rage'))
			expect(rowNames(container)).not.toContain('Unarmored Defense')
		})

		it('a Cleric gets a Channel Divinity row', async () => {
			const cleric: Character = { ...character, id: 'act-cleric', name: 'Pike', classes: [{ className: 'Cleric', classSource: 'XPHB', subclass: null, level: 5 }] }
			const container = await renderFor(cleric)

			await waitFor(() => expect(rowNames(container)).toContain('Channel Divinity'))
		})

		it('a rest-tagged FEAT gets a row too, and a feat that is neither does not', async () => {
			vi.mocked(loadFeatTextEntries).mockResolvedValue([
				{ name: 'Lucky', source: 'XPHB', entries: [REST] },
				{ name: 'Alert', source: 'XPHB', entries: ['You gain a bonus to Initiative equal to your Proficiency Bonus.'] },
			])
			const feated: Character = {
				...character,
				id: 'act-feats',
				classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 5 }],
				featAsiChoices: [
					{ level: 4, kind: 'feat', name: 'Lucky', source: 'XPHB' },
					{ level: 8, kind: 'feat', name: 'Alert', source: 'XPHB' },
				],
			}
			const container = await renderFor(feated)

			await waitFor(() => expect(rowNames(container)).toContain('Lucky'))
			expect(rowNames(container)).not.toContain('Alert')
		})

		/*
		 * Chosen optional features, the third source. MM is a CLASS progression and
		 * MV:B a SUBCLASS one — both are asserted because the sheet's other
		 * optional-feature path (chosenClassOptionalFeatures) resolves only the
		 * former, and the actions table deliberately does not go through it.
		 */
		const OPTIONAL_FEATURES = [
			// Every real Metamagic/Maneuver/Arcane Shot option qualifies this way and no other: `consumes`, no rest tag.
			{ name: 'Twinned Spell', source: 'XPHB', featureType: ['MM'], consumes: { name: 'Sorcery Points', amount: 1 }, entries: ['When you cast a spell that targets only one creature…'] },
			{ name: 'Trip Attack', source: 'XPHB', featureType: ['MV:B'], consumes: { name: 'Combat Superiority Die' }, entries: ['When you hit a creature with an attack roll…'] },
			// Qualifies under neither test — a chosen option the table must leave out.
			{ name: 'Ambush', source: 'XPHB', featureType: ['MV:B'], entries: ['You add the die to your Stealth check or Initiative roll.'] },
		]
		// Per D12 a fighting style is a feats.json entry of category FS, not an optional feature.
		const FS_FEATS = [{ name: 'Defense', source: 'XPHB', category: 'FS', entries: ['While you are wearing armor, you gain a +1 bonus to AC.'] }]

		function withRealOptionResolution(): void {
			vi.mocked(loadChosenOptionalFeatureOptions).mockImplementation(async (selection, fightingStyle) =>
				chosenOptionalFeatureOptions(OPTIONAL_FEATURES, FS_FEATS, selection, fightingStyle),
			)
		}

		afterEach(() => {
			vi.mocked(loadChosenOptionalFeatureOptions).mockReset().mockResolvedValue([])
		})

		it('a Sorcerer gets a row for the Metamagic option they chose, from `consumes` alone', async () => {
			withRealOptionResolution()
			const sorcerer: Character = {
				...character,
				id: 'act-sorcerer',
				name: 'Nott',
				classes: [{ className: 'Sorcerer', classSource: 'XPHB', subclass: null, level: 3 }],
				optionalFeatureChoices: [{ featureType: 'MM', choices: [{ name: 'Twinned Spell' }] }],
			}
			const container = await renderFor(sorcerer)

			await waitFor(() => expect(rowNames(container)).toContain('Twinned Spell'))
		})

		/*
		 * D99: one featureType collects picks from several levels, which is why the
		 * level sits on the pick. The actions table must read straight past it.
		 */
		it('a Metamagic pick that records the level it was taken at still gets its row', async () => {
			withRealOptionResolution()
			const sorcerer: Character = {
				...character,
				id: 'act-sorcerer-leveled',
				name: 'Nott',
				classes: [{ className: 'Sorcerer', classSource: 'XPHB', subclass: null, level: 10 }],
				optionalFeatureChoices: [{ featureType: 'MM', choices: [{ name: 'Twinned Spell', level: 10 }] }],
			}
			const container = await renderFor(sorcerer)

			await waitFor(() => expect(rowNames(container)).toContain('Twinned Spell'))
		})

		it("a Battle Master gets rows for the maneuvers they chose — a SUBCLASS progression's picks, and not the one qualifying under neither test", async () => {
			withRealOptionResolution()
			const battleMaster: Character = {
				...character,
				id: 'act-battlemaster',
				name: 'Yasha',
				classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Battle Master', level: 5 }],
				optionalFeatureChoices: [{ featureType: 'MV:B', choices: [{ name: 'Trip Attack' }, { name: 'Ambush' }] }],
			}
			const container = await renderFor(battleMaster)

			await waitFor(() => expect(rowNames(container)).toContain('Trip Attack'))
			expect(rowNames(container)).not.toContain('Ambush')
		})

		/*
		 * D88's gap: the actions table shows a Battle Master's maneuver by name,
		 * but nothing on the sheet showed its full text — the "Class options"
		 * section only resolves class-level picks, and a Maneuver is granted by
		 * the SUBCLASS. The new "Subclass options" section (below the existing
		 * "Class options" one) closes it, using the same resolved records the
		 * actions table already gets.
		 */
		it("shows a Battle Master's chosen maneuver as full text on the sheet, not just its name in the actions table", async () => {
			withRealOptionResolution()
			const battleMaster: Character = {
				...character,
				id: 'act-battlemaster-text',
				name: 'Yasha',
				classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Battle Master', level: 5 }],
				optionalFeatureChoices: [{ featureType: 'MV:B', choices: [{ name: 'Trip Attack' }] }],
			}
			const container = await renderFor(battleMaster)
			await waitFor(() => expect(rowNames(container)).toContain('Trip Attack'))

			const section = container.querySelector('.sheet__subclass-optional-features') as HTMLElement
			expect(section).toBeTruthy()
			expect(within(section).getAllByText('Trip Attack')).toHaveLength(1)
			expect(within(section).getByText(/When you hit a creature with an attack roll/)).toBeTruthy()
		})

		it('does not repeat an option in Subclass options when Class options already shows it', async () => {
			withRealOptionResolution()
			vi.mocked(loadChosenClassOptionalFeatures).mockResolvedValueOnce([
				{ featureType: 'MM', name: 'Metamagic', options: [{ name: 'Twinned Spell', source: 'XPHB', entries: OPTIONAL_FEATURES[0]!.entries }] },
			])
			const sorcerer: Character = {
				...character,
				id: 'act-sorcerer-dedupe',
				name: 'Nott',
				classes: [{ className: 'Sorcerer', classSource: 'XPHB', subclass: null, level: 3 }],
				optionalFeatureChoices: [{ featureType: 'MM', choices: [{ name: 'Twinned Spell' }] }],
			}
			const container = await renderFor(sorcerer)
			await screen.findByRole('heading', { name: 'Metamagic' })

			// Shown once, by Class options — Subclass options renders no section at all once its one pick is deduped away.
			const classOptions = container.querySelector('.sheet__class-optional-features') as HTMLElement
			expect(within(classOptions).getAllByText('Twinned Spell')).toHaveLength(1)
			expect(container.querySelector('.sheet__subclass-optional-features')).toBeNull()
		})

		it('gives no row to the chosen fighting style, which carries neither `consumes` nor a rest tag', async () => {
			withRealOptionResolution()
			const fighter: Character = {
				...character,
				id: 'act-style',
				classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 5 }],
				fightingStyle: 'Defense',
			}
			const container = await renderFor(fighter)

			await waitFor(() => expect(rowNames(container)).toContain('Second Wind'))
			expect(rowNames(container)).not.toContain('Defense')
		})

		/* D88: no actions-table row for a fighting style (above), but nothing else on the sheet showed it either — Subclass options now does. */
		it('shows the chosen fighting style as full text in Subclass options, even though it never gets an actions-table row', async () => {
			withRealOptionResolution()
			const fighter: Character = {
				...character,
				id: 'act-style-text',
				classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 5 }],
				fightingStyle: 'Defense',
			}
			const container = await renderFor(fighter)
			await waitFor(() => expect(rowNames(container)).toContain('Second Wind'))

			const section = container.querySelector('.sheet__subclass-optional-features') as HTMLElement
			expect(section).toBeTruthy()
			expect(within(section).getByText('Defense')).toBeTruthy()
			expect(within(section).getByText(/While you are wearing armor/)).toBeTruthy()
		})
	})

	/*
	 * Uses tracking for the 8 resources with a computed maximum (slice 9b2).
	 * classes.json now carries real classTableGroups, unlike the "not in data"
	 * fixture above — computeCharacterResources resolves a real number here, so
	 * the actions table gets something to key a tracker off.
	 */
	describe('Uses tracking for a resource with a computed maximum (slice 9b2)', () => {
		const REST = 'You regain the expended use when you finish a {@variantrule Short Rest|XPHB}.'

		// Same table shape resources.test.ts's own fixture uses (Fighter's "Second Wind" column, 2 uses at level 1), plus the classFeatureIds/classFeatures grantedClassFeaturesFrom needs to grant the row at all.
		const CLASSES = [
			{
				entryType: 'class',
				name: 'Fighter',
				source: 'XPHB',
				classFeatureIds: ['cf|second wind|fighter|xphb|1|xphb'],
				classFeatures: ['Second Wind|Fighter|XPHB|1'],
				classTableGroups: [{ colLabels: ['Second Wind'], rows: [[2], [2], [2], [3], [3]] }],
			},
			{
				entryType: 'class',
				name: 'Cleric',
				source: 'XPHB',
				classFeatureIds: ['cf|preserve life|cleric|xphb|2|xphb', 'cf|turn undead|cleric|xphb|2|xphb'],
				classFeatures: ['Preserve Life|Cleric|XPHB|2', 'Turn Undead|Cleric|XPHB|2'],
				classTableGroups: [{ colLabels: ['Channel Divinity'], rows: [[1], [1], [2], [2], [2]] }],
			},
		]

		const CF = [
			{ id: 'cf|second wind|fighter|xphb|1|xphb', name: 'Second Wind', className: 'Fighter', classSource: 'XPHB', level: 1, source: 'XPHB', entries: [`You have a limited well of physical stamina. ${REST}`] },
			// Two different Channel-Divinity options — a Cleric build carries both, and both must key the same shared counter.
			{
				id: 'cf|preserve life|cleric|xphb|2|xphb',
				name: 'Preserve Life',
				className: 'Cleric',
				classSource: 'XPHB',
				level: 2,
				source: 'XPHB',
				consumes: { name: 'Channel Divinity' },
				entries: ['You can use your Channel Divinity to heal the badly injured.'],
			},
			{
				id: 'cf|turn undead|cleric|xphb|2|xphb',
				name: 'Turn Undead',
				className: 'Cleric',
				classSource: 'XPHB',
				level: 2,
				source: 'XPHB',
				consumes: { name: 'Channel Divinity' },
				entries: ['You can use your Channel Divinity to turn undead.'],
			},
		]

		const RESOLVER = { classFeatures: CF, subclassFeatures: [], optionalFeatures: [], feats: [] }

		async function renderFor(subject: Character, onEditResourceUses?: (resourceUses: Record<string, number> | undefined) => void) {
			vi.mocked(loadResolverData).mockResolvedValue(RESOLVER)
			vi.mocked(loadGrantedClassFeatures).mockResolvedValue(grantedClassFeaturesFrom(subject, CLASSES, RESOLVER))
			vi.mocked(loadDataFile).mockImplementation(async (path: string) => (path === 'data/classes.json' ? CLASSES : []))
			const { container } = render(<CharacterSheet character={subject} onEditResourceUses={onEditResourceUses} />)
			await screen.findByRole('heading', { name: subject.name })
			await waitFor(() => expect(container.querySelector('.sheet__actions-table')).toBeTruthy())
			return container
		}

		function usesTextFor(container: HTMLElement, featureName: string): string | null {
			const row = Array.from(container.querySelectorAll('.sheet__action-row')).find((tr) => tr.querySelector('.sheet__action-name')?.textContent === featureName)
			return row?.querySelector('.sheet__action-uses')?.textContent ?? null
		}

		afterEach(() => {
			vi.mocked(loadGrantedClassFeatures).mockReset().mockResolvedValue([])
			vi.mocked(loadResolverData).mockReset().mockResolvedValue({ classFeatures: [], subclassFeatures: [], optionalFeatures: [], feats: [] })
			vi.mocked(loadDataFile).mockReset().mockResolvedValue([])
		})

		it('shows spent 0 of the computed maximum for a character who has spent nothing', async () => {
			const fighter: Character = { ...character, id: 'uses-fighter', classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 1 }] }
			const container = await renderFor(fighter)
			expect(usesTextFor(container, 'Second Wind')).toContain('0 / 2')
		})

		it('reads the stored spent count from Character.play.resourceUses, keyed by the resolved name', async () => {
			const fighter: Character = { ...character, id: 'uses-fighter-spent', classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 1 }], play: { resourceUses: { 'Second Wind': 1 } } }
			const container = await renderFor(fighter)
			expect(usesTextFor(container, 'Second Wind')).toContain('1 / 2')
		})

		it('marking a use reports the incremented count through onEditResourceUses', async () => {
			const onEditResourceUses = vi.fn()
			const fighter: Character = { ...character, id: 'uses-fighter-mark', classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 1 }], play: { resourceUses: { 'Second Wind': 1 } } }
			await renderFor(fighter, onEditResourceUses)

			fireEvent.click(screen.getByRole('button', { name: 'Use Second Wind' }))
			expect(onEditResourceUses).toHaveBeenCalledWith({ 'Second Wind': 2 })
		})

		it('the mark-a-use button is disabled once spent reaches the maximum, so it cannot grow past it', async () => {
			const fighter: Character = { ...character, id: 'uses-fighter-capped', classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 1 }], play: { resourceUses: { 'Second Wind': 2 } } }
			const container = await renderFor(fighter, vi.fn())
			expect((screen.getByRole('button', { name: 'Use Second Wind' }) as HTMLButtonElement).disabled).toBe(true)
			expect(container.querySelector('.sheet__action-uses')!.textContent).toContain('2 / 2')
		})

		it('undoing a use reports the decremented count through onEditResourceUses', async () => {
			const onEditResourceUses = vi.fn()
			const fighter: Character = { ...character, id: 'uses-fighter-undo', classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 1 }], play: { resourceUses: { 'Second Wind': 1 } } }
			await renderFor(fighter, onEditResourceUses)

			fireEvent.click(screen.getByRole('button', { name: 'Undo a use of Second Wind' }))
			expect(onEditResourceUses).toHaveBeenCalledWith({ 'Second Wind': 0 })
		})

		it('the undo button is disabled once spent reaches 0, so it cannot go below it', async () => {
			const fighter: Character = { ...character, id: 'uses-fighter-floored', classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 1 }] }
			await renderFor(fighter, vi.fn())
			expect((screen.getByRole('button', { name: 'Undo a use of Second Wind' }) as HTMLButtonElement).disabled).toBe(true)
		})

		it('two rows that consume the same resolved resource show the same shared count, and marking either moves both', async () => {
			const cleric: Character = {
				...character,
				id: 'uses-cleric-shared',
				classes: [{ className: 'Cleric', classSource: 'XPHB', subclass: null, level: 5 }],
				play: { resourceUses: { 'Channel Divinity': 1 } },
			}
			const container = await renderFor(cleric)

			expect(usesTextFor(container, 'Preserve Life')).toContain('1 / 2')
			expect(usesTextFor(container, 'Turn Undead')).toContain('1 / 2')
		})

		it('marking a use on one Channel-Divinity row would move the OTHER row too — the write is keyed by resource, not by row', async () => {
			const onEditResourceUses = vi.fn()
			const cleric: Character = {
				...character,
				id: 'uses-cleric-shared-write',
				classes: [{ className: 'Cleric', classSource: 'XPHB', subclass: null, level: 5 }],
				play: { resourceUses: { 'Channel Divinity': 1 } },
			}
			await renderFor(cleric, onEditResourceUses)

			fireEvent.click(screen.getAllByRole('button', { name: 'Use Channel Divinity' })[0]!)
			expect(onEditResourceUses).toHaveBeenCalledWith({ 'Channel Divinity': 2 })
		})
	})

	describe('spellcasting sections (build order step 6 slice d4)', () => {
		afterEach(() => {
			vi.mocked(loadSpellcastingAbilityClassData).mockReset().mockResolvedValue([])
			vi.mocked(loadSpellSlotsClassData).mockReset().mockResolvedValue([])
			vi.mocked(loadSpellCountClassData).mockReset().mockResolvedValue([])
			vi.mocked(loadSpellDetails).mockReset().mockResolvedValue([])
			vi.mocked(loadSubclassSource).mockReset().mockResolvedValue(null)
			vi.mocked(loadSubclassAlwaysPreparedSpells).mockReset().mockResolvedValue([])
			vi.mocked(loadFeatGrantedSpells).mockReset().mockResolvedValue([])
			vi.mocked(loadOptionalFeatureGrantedSpells).mockReset().mockResolvedValue([])
			vi.mocked(loadRaceSpells).mockReset().mockResolvedValue({ spells: [], notes: [] })
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

		/*
		 * Sheet rebuild slice 4: the spells that carry an attack roll or a save
		 * also appear as rows in the ACTIONS table, with the same numbers the
		 * Spellcasting section prints. End-to-end because the row's numbers travel
		 * from spellChoices through computeSpellcasting to a table cell; the
		 * selection rules themselves are spellActionRowData.test.ts.
		 */
		describe('spell rows in the actions table (rebuild slice 4)', () => {
			const spellcastingAbility: ClassSpellcastingAbility[] = [{ className: 'Wizard', classSource: 'XPHB', ability: 'int' }]
			const details: SpellDetail[] = [
				spellDetail({
					name: 'Fire Bolt',
					source: 'XPHB',
					level: 0,
					spellAttack: ['R'],
					scalingLevelDice: [{ label: 'fire damage', scaling: { '1': '1d10', '5': '2d10', '11': '3d10', '17': '4d10' } }],
				}),
				spellDetail({ name: 'Fireball', source: 'XPHB', level: 3, savingThrow: ['dexterity'] }),
				spellDetail({ name: 'Mage Armor', source: 'XPHB', level: 1 }),
			]

			const wizard: Character = {
				id: 'slice4',
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
							{ name: 'Fire Bolt', source: 'XPHB' },
							{ name: 'Fireball', source: 'XPHB' },
							{ name: 'Mage Armor', source: 'XPHB' },
						],
					},
				],
			}

			function actionRow(container: HTMLElement, name: string): HTMLElement {
				const row = Array.from(container.querySelectorAll('.sheet__actions-table .sheet__action-row')).find(
					(tr) => tr.querySelector('.sheet__action-name')?.textContent === name,
				)
				if (!row) throw new Error(`no action row for ${name}`)
				return row as HTMLElement
			}

			async function renderWizard() {
				vi.mocked(loadSpellcastingAbilityClassData).mockResolvedValue(spellcastingAbility)
				vi.mocked(loadSpellDetails).mockResolvedValue(details)
				const rendered = render(<CharacterSheet character={wizard} />)
				await screen.findByRole('heading', { name: 'Elminster' })
				await waitFor(() => expect(rendered.container.querySelector('.sheet__actions-table')).toBeTruthy())
				return rendered
			}

			it('gives an attack spell a to-hit and a save spell a DC, and leaves a spell with neither out of the table', async () => {
				const { container } = await renderWizard()
				// INT 16 (+3) + PB 3 at level 5 — the same numbers the Spellcasting section shows.
				expect(actionRow(container, 'Fire Bolt').querySelector('.sheet__action-to-hit')!.textContent).toContain('+6')
				expect(actionRow(container, 'Fireball').querySelector('.sheet__action-to-hit')!.textContent).toContain('DC 14 Dexterity')
				expect(() => actionRow(container, 'Mage Armor')).toThrow()
				// Mage Armor is not duplicated away either — it stays in the Kouzla tab.
				expect(container.querySelector('.sheet__spells')!.textContent).toContain('Mage Armor')
			})

			it('fills Damage from structured cantrip scaling only, and never invents a Notes value (D21)', async () => {
				const { container } = await renderWizard()
				expect(actionRow(container, 'Fire Bolt').querySelector('.sheet__action-damage-cell')!.textContent).toBe('2d10 fire damage')
				expect(actionRow(container, 'Fireball').querySelector('.sheet__action-damage-cell')!.textContent).toBe('')
				expect(actionRow(container, 'Fireball').querySelector('.sheet__action-notes')!.textContent).toBe('')
			})

			it('labels a spell row with the level wording the spell list uses, and keeps the weapon rows alongside it', async () => {
				const { container } = await renderWizard()
				expect(actionRow(container, 'Fire Bolt').textContent).toContain('(Cantrip)')
				expect(actionRow(container, 'Fireball').textContent).toContain('(Level 3)')
				expect(actionRow(container, 'Unarmed Strike')).toBeTruthy()
			})
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

		/* Slice 9b3: spending a slot, in each of D11's two pools. */
		describe('spent spell slots', () => {
			const WIZARD_SLOTS: ClassSpellSlotsData[] = [
				{ className: 'Wizard', classSource: 'XPHB', casterProgression: 'full', spellSlotsByLevel: [[2], [3], [4, 2]], pactSlotsByLevel: null },
			]
			const WARLOCK_SLOTS: ClassSpellSlotsData[] = [
				{
					className: 'Warlock',
					classSource: 'XPHB',
					casterProgression: 'pact',
					spellSlotsByLevel: null,
					pactSlotsByLevel: [{ count: 1, slotLevel: 1 }, { count: 2, slotLevel: 1 }],
				},
			]

			async function renderCaster(
				className: string,
				level: number,
				slots: ClassSpellSlotsData[],
				play: Character['play'],
				onEditSpentSpellSlots?: (spentSpellSlots: SpentSpellSlots | undefined) => void,
			) {
				vi.mocked(loadSpellSlotsClassData).mockResolvedValue(slots)
				const subject: Character = {
					id: `slots-${className}-${level}`,
					name: 'Slotter',
					classes: [{ className, classSource: 'XPHB', subclass: null, level }],
					...(play ? { play } : {}),
				}
				const { container } = render(<CharacterSheet character={subject} onEditSpentSpellSlots={onEditSpentSpellSlots} />)
				await screen.findByRole('heading', { name: 'Slotter' })
				await waitFor(() => expect(container.querySelector('.sheet__spell-slots')).toBeTruthy())
				return container
			}

			it('shows one tracker per level that has slots, reading the stored spent count', async () => {
				const container = await renderCaster('Wizard', 3, WIZARD_SLOTS, { spentSpellSlots: { ordinary: { 1: 3 } } })
				const trackers = Array.from(container.querySelectorAll('.sheet__spell-slots .sheet__action-uses')).map((node) => node.textContent)
				expect(trackers).toHaveLength(2) // levels 1 and 2 only — level 3 has no slots at Wizard 3
				expect(trackers[0]).toContain('3 / 4')
				expect(trackers[1]).toContain('0 / 2')
			})

			it('marking and undoing a slot reports the new count for that level alone', async () => {
				const onEdit = vi.fn()
				await renderCaster('Wizard', 3, WIZARD_SLOTS, { spentSpellSlots: { ordinary: { 1: 1, 2: 2 } } }, onEdit)

				fireEvent.click(screen.getByRole('button', { name: 'Use level 1 spell slots' }))
				expect(onEdit).toHaveBeenCalledWith({ ordinary: { 1: 2, 2: 2 } })

				fireEvent.click(screen.getByRole('button', { name: 'Undo a use of level 2 spell slots' }))
				expect(onEdit).toHaveBeenLastCalledWith({ ordinary: { 1: 1, 2: 1 } })
			})

			it('bounds each level at its own maximum and at 0', async () => {
				await renderCaster('Wizard', 3, WIZARD_SLOTS, { spentSpellSlots: { ordinary: { 1: 4 } } }, vi.fn())
				expect((screen.getByRole('button', { name: 'Use level 1 spell slots' }) as HTMLButtonElement).disabled).toBe(true)
				expect((screen.getByRole('button', { name: 'Undo a use of level 1 spell slots' }) as HTMLButtonElement).disabled).toBe(false)
				// Level 2 is untouched: its own bound is the other way round.
				expect((screen.getByRole('button', { name: 'Use level 2 spell slots' }) as HTMLButtonElement).disabled).toBe(false)
				expect((screen.getByRole('button', { name: 'Undo a use of level 2 spell slots' }) as HTMLButtonElement).disabled).toBe(true)
			})

			it('D11: a Warlock gets a Pact Magic tracker of its own, written under its own key', async () => {
				const onEdit = vi.fn()
				const container = await renderCaster('Warlock', 2, WARLOCK_SLOTS, { spentSpellSlots: { pact: 1 } }, onEdit)

				const pact = container.querySelector('.sheet__pact-slots')!
				expect(pact.querySelector('.sheet__action-uses')!.textContent).toContain('1 / 2')
				expect(container.querySelectorAll('.sheet__spell-slots .sheet__action-uses')).toHaveLength(1)

				fireEvent.click(screen.getByRole('button', { name: 'Use Pact Magic slots' }))
				expect(onEdit).toHaveBeenCalledWith({ pact: 2 })
			})

			it('leaves the counts unchangeable without the callback', async () => {
				const container = await renderCaster('Wizard', 3, WIZARD_SLOTS, undefined)
				expect(container.querySelector('.sheet__spell-slots button')).toBeNull()
			})
		})

		/* Slice 9d1: which spell is being concentrated on — tracked and persisted, nothing more. */
		describe('concentration', () => {
			const DETAILS: SpellDetail[] = [
				spellDetail({ name: 'Bless', source: 'XPHB', level: 1, concentration: true }),
				spellDetail({ name: 'Shield of Faith', source: 'XPHB', level: 1, concentration: true }),
				spellDetail({ name: 'Fireball', source: 'XPHB', level: 3 }),
			]
			const caster: Character = {
				id: 'conc1',
				name: 'Focused',
				classes: [{ className: 'Cleric', classSource: 'XPHB', subclass: null, level: 5 }],
				spellChoices: [
					{
						className: 'Cleric',
						classSource: 'XPHB',
						spells: [
							{ name: 'Bless', source: 'XPHB' },
							{ name: 'Shield of Faith', source: 'XPHB' },
							{ name: 'Fireball', source: 'XPHB' },
						],
					},
				],
			}

			/* Holds the character in state the way CharacterManager does, so a click is followed by the sheet re-reading what it wrote. */
			function Harness({ initial, onEdit }: { initial: Character; onEdit: (spellName: string | null) => void }) {
				const [current, setCurrent] = useState(initial)
				return (
					<CharacterSheet
						character={current}
						onEditConcentration={(spellName) => {
							onEdit(spellName)
							setCurrent({ ...current, play: spellName === null ? undefined : { ...current.play, concentratingOn: spellName } })
						}}
					/>
				)
			}

			async function renderCaster(play?: Character['play']) {
				vi.mocked(loadSpellDetails).mockResolvedValue(DETAILS)
				const onEdit = vi.fn()
				const subject = play ? { ...caster, play } : caster
				const { container } = render(<Harness initial={subject} onEdit={onEdit} />)
				await screen.findByRole('button', { name: 'Concentrate on Bless' })
				return { container, onEdit }
			}

			function headerLine(container: HTMLElement): string | undefined {
				return container.querySelector('.sheet__persistent-header .sheet__concentration')?.textContent ?? undefined
			}

			function pressed(name: string): string | null {
				return screen.getByRole('button', { name }).getAttribute('aria-pressed')
			}

			it('offers the button on a spell that needs concentration and on no other', async () => {
				const { container } = await renderCaster()
				expect(screen.getByRole('button', { name: 'Concentrate on Shield of Faith' })).toBeTruthy()
				expect(screen.queryByRole('button', { name: 'Concentrate on Fireball' })).toBeNull()
				expect(container.querySelectorAll('.spell-list__concentrate')).toHaveLength(2)
			})

			it('sets the spell, marks its button pressed and names it in the header', async () => {
				const { container, onEdit } = await renderCaster()
				expect(headerLine(container)).toBeUndefined()
				expect(pressed('Concentrate on Bless')).toBe('false')

				fireEvent.click(screen.getByRole('button', { name: 'Concentrate on Bless' }))

				expect(onEdit).toHaveBeenLastCalledWith('Bless')
				expect(pressed('Concentrate on Bless')).toBe('true')
				expect(pressed('Concentrate on Shield of Faith')).toBe('false')
				expect(headerLine(container)).toContain('Concentrating: Bless')
			})

			it('replaces the spell already being concentrated on, without asking', async () => {
				const confirm = vi.spyOn(window, 'confirm')
				const { container, onEdit } = await renderCaster({ concentratingOn: 'Bless' })
				expect(headerLine(container)).toContain('Concentrating: Bless')

				fireEvent.click(screen.getByRole('button', { name: 'Concentrate on Shield of Faith' }))

				expect(onEdit).toHaveBeenCalledTimes(1)
				expect(onEdit).toHaveBeenLastCalledWith('Shield of Faith')
				expect(pressed('Concentrate on Bless')).toBe('false')
				expect(pressed('Concentrate on Shield of Faith')).toBe('true')
				expect(headerLine(container)).toContain('Concentrating: Shield of Faith')
				expect(headerLine(container)).not.toContain('Bless')
				expect(confirm).not.toHaveBeenCalled()
				confirm.mockRestore()
			})

			it('drops it when the pressed button is clicked again', async () => {
				const { container, onEdit } = await renderCaster({ concentratingOn: 'Bless' })
				expect(pressed('Concentrate on Bless')).toBe('true')

				fireEvent.click(screen.getByRole('button', { name: 'Concentrate on Bless' }))

				expect(onEdit).toHaveBeenLastCalledWith(null)
				expect(pressed('Concentrate on Bless')).toBe('false')
				expect(headerLine(container)).toBeUndefined()
			})

			it('drops it from the header control, and the spell’s own button follows', async () => {
				const { container, onEdit } = await renderCaster({ concentratingOn: 'Shield of Faith' })
				expect(pressed('Concentrate on Shield of Faith')).toBe('true')

				fireEvent.click(within(container.querySelector<HTMLElement>('.sheet__persistent-header')!).getByRole('button', { name: 'Drop concentration' }))

				expect(onEdit).toHaveBeenLastCalledWith(null)
				expect(pressed('Concentrate on Shield of Faith')).toBe('false')
				expect(headerLine(container)).toBeUndefined()
			})

			it('shows the header line only while a spell is set', async () => {
				const { container } = await renderCaster()
				expect(container.querySelector('.sheet__concentration')).toBeNull()
				expect(screen.queryByRole('button', { name: 'Drop concentration' })).toBeNull()

				fireEvent.click(screen.getByRole('button', { name: 'Concentrate on Bless' }))
				expect(container.querySelectorAll('.sheet__concentration')).toHaveLength(1)

				fireEvent.click(screen.getByRole('button', { name: 'Drop concentration' }))
				expect(container.querySelector('.sheet__concentration')).toBeNull()
			})

			it('on a read-only sheet still shows a stored concentration, with nothing to change it', async () => {
				vi.mocked(loadSpellDetails).mockResolvedValue(DETAILS)
				const { container } = render(<CharacterSheet character={{ ...caster, play: { concentratingOn: 'Bless' } }} />)
				await screen.findByRole('heading', { name: 'Focused' })
				await waitFor(() => expect(container.querySelector('.sheet__spells summary')).toBeTruthy())

				expect(headerLine(container)).toContain('Concentrating: Bless')
				expect(screen.queryByRole('button', { name: 'Drop concentration' })).toBeNull()
				expect(container.querySelector('.spell-list__concentrate')).toBeNull()
			})

			describe('a concentration spell that leaves the character', () => {
				const HEX: FeatGrantedSpell = { name: 'Hex', source: 'XPHB', level: 1, ritual: false, concentration: true, origin: 'feat', featName: 'Hexed', ability: 'cha' }
				const HEXED_FEAT = { level: 4, kind: 'feat' as const, name: 'Hexed', source: 'XPHB' }

				afterEach(() => {
					vi.mocked(loadFeatGrantedSpells).mockReset().mockResolvedValue([])
				})

				it('an edit that drops the spell from the chosen list clears it from the header and the spell list', async () => {
					vi.mocked(loadSpellDetails).mockResolvedValue(DETAILS)
					const concentrating: Character = { ...caster, play: { concentratingOn: 'Bless' } }
					const { container, rerender } = render(<CharacterSheet character={concentrating} onEditConcentration={() => {}} />)
					await screen.findByRole('button', { name: 'Concentrate on Bless' })
					expect(headerLine(container)).toContain('Concentrating: Bless')

					// What the wizard's store.update hands back: a new spell list, play state carried across unchanged.
					const edited: Character = {
						...concentrating,
						spellChoices: [{ className: 'Cleric', classSource: 'XPHB', spells: [{ name: 'Shield of Faith', source: 'XPHB' }] }],
					}
					rerender(<CharacterSheet character={edited} onEditConcentration={() => {}} />)

					await waitFor(() => expect(headerLine(container)).toBeUndefined())
					expect(screen.queryByRole('button', { name: 'Drop concentration' })).toBeNull()
					expect(pressed('Concentrate on Shield of Faith')).toBe('false')
					expect(screen.queryByRole('button', { name: 'Concentrate on Bless' })).toBeNull()
				})

				it('a spell granted by a feat shows while the feat is taken and clears once it is not', async () => {
					vi.mocked(loadSpellDetails).mockResolvedValue([...DETAILS, spellDetail({ name: 'Hex', source: 'XPHB', level: 1, concentration: true })])
					vi.mocked(loadFeatGrantedSpells).mockImplementation(async (subject) => ((subject.featAsiChoices ?? []).length > 0 ? [HEX] : []))
					const withFeat: Character = { ...caster, featAsiChoices: [HEXED_FEAT], play: { concentratingOn: 'Hex' } }
					const { container, rerender } = render(<CharacterSheet character={withFeat} onEditConcentration={() => {}} />)
					await screen.findByRole('button', { name: 'Concentrate on Hex' })
					expect(pressed('Concentrate on Hex')).toBe('true')
					expect(headerLine(container)).toContain('Concentrating: Hex')

					rerender(<CharacterSheet character={{ ...withFeat, featAsiChoices: [] }} onEditConcentration={() => {}} />)

					await waitFor(() => expect(headerLine(container)).toBeUndefined())
					expect(screen.queryByRole('button', { name: 'Concentrate on Hex' })).toBeNull()
				})

				it('keeps showing it while a spell grant failed to load, since the list is then known to be short (D43)', async () => {
					vi.mocked(loadSpellDetails).mockResolvedValue(DETAILS)
					vi.mocked(loadFeatGrantedSpells).mockRejectedValue(new Error('feats.json unavailable'))
					const { container } = render(<CharacterSheet character={{ ...caster, featAsiChoices: [HEXED_FEAT], play: { concentratingOn: 'Hex' } }} />)
					await waitFor(() => expect(container.textContent).toContain('feats.json unavailable'))

					expect(headerLine(container)).toContain('Concentrating: Hex')
				})
			})
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
				optionalFeatureChoices: [{ featureType: 'EI', choices: [{ name: 'Mask of Many Faces' }] }],
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
				expect.objectContaining({ optionalFeatureChoices: [{ featureType: 'EI', choices: [{ name: 'Mask of Many Faces' }] }] }),
			)
		})

		/*
		 * Race slice: a species grant reaches the Kouzla tab and the actions table
		 * through the SAME pipeline the other four sources use — no parallel
		 * display path. Aasimar is the one species with a FIXED spellcasting
		 * ability, so it is also the one that produces real numbers today.
		 */
		it('a spell granted by the species shows "from species (...)" and, for a fixed ability, its own attack/DC entry and actions row', async () => {
			const details: SpellDetail[] = [
				spellDetail({ name: 'Healing Word', source: 'XPHB', level: 1, entries: ['A creature regains hit points.'] }),
				spellDetail({ name: 'Sacred Flame', source: 'XPHB', level: 0, savingThrow: ['dexterity'], entries: ['Flame-like radiance descends.'] }),
			]
			vi.mocked(loadSpellDetails).mockResolvedValue(details)
			vi.mocked(loadRaceSpells).mockResolvedValue({
				spells: [
					{ name: 'Healing Word', source: 'XPHB', level: 1, ritual: false, concentration: false, origin: 'species', speciesName: 'Aasimar', grantedAtLevel: 3, ability: 'cha', usage: { kind: 'onceFreePerLongRest' } },
					{ name: 'Sacred Flame', source: 'XPHB', level: 0, ritual: false, concentration: false, origin: 'species', speciesName: 'Aasimar', grantedAtLevel: null, ability: 'cha' },
				],
				notes: [],
			})

			const aasimar: Character = {
				id: 'aa1',
				name: 'Aasimar Fighter',
				classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 3 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 15, dexterity: 10, constitution: 13, intelligence: 10, wisdom: 10, charisma: 16 },
				},
				species: { name: 'Aasimar', source: 'XPHB' },
			}

			const { container } = render(<CharacterSheet character={aasimar} />)
			await screen.findByRole('heading', { name: 'Aasimar Fighter' })

			const spellsSection = container.querySelector('.sheet__spells')!
			await waitFor(() => expect(spellsSection.textContent).toContain('Healing Word'))
			const summary = Array.from(spellsSection.querySelectorAll('summary')).find((s) => s.textContent?.includes('Healing Word'))!
			expect(summary.textContent).toContain('from species (Aasimar)')
			expect(summary.textContent).toContain('1/long rest (no slot)')
			expect(summary.textContent).not.toContain('player pick')

			// A Fighter has no casting class at all, so these numbers can only come from the species entry (CHA 16 -> +3, PB 2).
			const attacks = container.querySelector('.sheet__spell-attacks')!
			expect(attacks.textContent).toContain('Aasimar')
			expect(attacks.textContent).toContain('+5')
			expect(attacks.textContent).toContain('13')

			// Sacred Flame carries a save, so it earns an ordinary actions-table row rather than a second display path.
			const actionsTable = container.querySelector('.sheet__actions-table')!
			expect(actionsTable.textContent).toContain('Sacred Flame')
		})

		/*
		 * D89 follow-up: a `choose`-ability species with a STORED pick resolves
		 * exactly like Aasimar's fixed one. raceSpells.ts is what actually reads
		 * `Character.speciesSpellcastingAbility` (raceSpells.test.ts covers that);
		 * this test only confirms the sheet renders real numbers, not the
		 * placeholder, once `loadRaceSpells` hands back a resolved `ability`.
		 */
		it('a species spell with a stored spellcasting-ability choice gets a real attack bonus/DC, not the placeholder note (Aarakocra)', async () => {
			const details: SpellDetail[] = [spellDetail({ name: 'Mage Hand', source: 'XPHB', level: 0, entries: ['A spectral hand appears.'] })]
			vi.mocked(loadSpellDetails).mockResolvedValue(details)
			vi.mocked(loadRaceSpells).mockResolvedValue({
				spells: [
					{ name: 'Mage Hand', source: 'XPHB', level: 0, ritual: false, concentration: false, origin: 'species', speciesName: 'Aarakocra', grantedAtLevel: null, ability: 'wis' },
				],
				notes: [],
			})

			const aarakocra: Character = {
				id: 'ar1',
				name: 'Aarakocra Fighter',
				classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 3 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 15, dexterity: 10, constitution: 13, intelligence: 10, wisdom: 16, charisma: 10 },
				},
				species: { name: 'Aarakocra', source: 'XPHB' },
				speciesSpellcastingAbility: 'wisdom',
			}

			const { container } = render(<CharacterSheet character={aarakocra} />)
			await screen.findByRole('heading', { name: 'Aarakocra Fighter' })

			const spellsSection = container.querySelector('.sheet__spells')!
			await waitFor(() => expect(spellsSection.textContent).toContain('Mage Hand'))
			const summary = Array.from(spellsSection.querySelectorAll('summary')).find((s) => s.textContent?.includes('Mage Hand'))!
			expect(summary.textContent).not.toContain('spellcasting ability not chosen yet')

			// WIS 16 -> +3, PB 2 at level 3.
			const attacks = container.querySelector('.sheet__spell-attacks')!
			expect(attacks.textContent).toContain('Aarakocra')
			expect(attacks.textContent).toContain('+5')
			expect(attacks.textContent).toContain('13')
		})

		/* The other 33 species leave the ability unchosen — the spell still appears, saying plainly why it has no numbers (D58), and the deferred cantrip-choice entries say so too. */
		it('a species spell with no chosen ability still appears, marked unresolved, alongside the deferred cantrip-choice note', async () => {
			const details: SpellDetail[] = [spellDetail({ name: 'Mage Hand', source: 'XPHB', level: 0, entries: ['A spectral hand appears.'] })]
			vi.mocked(loadSpellDetails).mockResolvedValue(details)
			vi.mocked(loadRaceSpells).mockResolvedValue({
				spells: [
					{
						name: 'Mage Hand',
						source: 'XPHB',
						level: 0,
						ritual: false,
						concentration: false,
						origin: 'species',
						speciesName: 'Elf; High Elf Lineage',
						grantedAtLevel: null,
						unresolvedAbilityReason: 'spellcasting ability not chosen yet',
					},
				],
				notes: [{ speciesName: 'Elf; High Elf Lineage', text: 'Elf; High Elf Lineage lets you pick a cantrip from the Wizard spell list — not yet supported.' }],
			})

			const elf: Character = {
				id: 'el1',
				name: 'High Elf Fighter',
				classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 3 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 15, dexterity: 10, constitution: 13, intelligence: 14, wisdom: 10, charisma: 10 },
				},
				species: { name: 'Elf; High Elf Lineage', source: 'XPHB' },
			}

			const { container } = render(<CharacterSheet character={elf} />)
			await screen.findByRole('heading', { name: 'High Elf Fighter' })

			const spellsSection = container.querySelector('.sheet__spells')!
			await waitFor(() => expect(spellsSection.textContent).toContain('Mage Hand'))
			const summary = Array.from(spellsSection.querySelectorAll('summary')).find((s) => s.textContent?.includes('Mage Hand'))!
			expect(summary.textContent).toContain('from species (Elf; High Elf Lineage)')
			expect(summary.textContent).toContain('spellcasting ability not chosen yet')
			// No ability means no attack/DC entry to show — nothing is invented from the character's class.
			expect(container.querySelector('.sheet__spell-attacks')).toBeNull()
			expect(spellsSection.textContent).toContain('pick a cantrip from the Wizard spell list — not yet supported.')
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
				optionalFeatureChoices: [{ featureType: 'EI', choices: [{ name: 'Mask of Many Faces' }] }],
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
				optionalFeatureChoices: [{ featureType: 'EI', choices: [{ name: 'Pact of the Tome' }], spellChoices: tomePicks }],
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
				optionalFeatureChoices: [{ featureType: 'EI', choices: [{ name: 'One with Shadows' }, { name: 'Shroud of Shadow' }] }],
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

	/*
	 * Slice 8e2 (D106): what the sheet says about a chosen spell above what
	 * this character can currently cast, and about knowing/preparing more
	 * spells than its level allows — the gap D104 left when a level is
	 * removed (spells carry no level, so nothing was dropped with it).
	 */
	describe('spell limits against level (slice 8e2, D106)', () => {
		afterEach(() => {
			vi.mocked(loadSpellcastingAbilityClassData).mockReset().mockResolvedValue([])
			vi.mocked(loadSpellSlotsClassData).mockReset().mockResolvedValue([])
			vi.mocked(loadSpellCountClassData).mockReset().mockResolvedValue([])
			vi.mocked(loadSpellDetails).mockReset().mockResolvedValue([])
		})

		it('marks a chosen spell above the highest castable level as unavailable, and leaves an in-range one unmarked (e.g. after levelling up then back down, D104)', async () => {
			const spellSlots: ClassSpellSlotsData[] = [
				{ className: 'Wizard', classSource: 'XPHB', casterProgression: 'full', spellSlotsByLevel: [[2]], pactSlotsByLevel: null },
			]
			const spellCounts: ClassSpellCountData[] = [
				{ className: 'Wizard', classSource: 'XPHB', cantripProgression: [4], leveledSpellProgression: [6], label: 'prepared' },
			]
			const details: SpellDetail[] = [
				spellDetail({ name: 'Prestidigitation', source: 'XPHB', level: 0 }),
				spellDetail({ name: 'Mage Armor', source: 'XPHB', level: 1 }),
				spellDetail({ name: 'Fireball', source: 'XPHB', level: 3 }),
			]
			vi.mocked(loadSpellSlotsClassData).mockResolvedValue(spellSlots)
			vi.mocked(loadSpellCountClassData).mockResolvedValue(spellCounts)
			vi.mocked(loadSpellDetails).mockResolvedValue(details)

			const wizard: Character = {
				id: 'lim1',
				name: 'Overreacher',
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
							{ name: 'Prestidigitation', source: 'XPHB' },
							{ name: 'Mage Armor', source: 'XPHB' },
							{ name: 'Fireball', source: 'XPHB' },
						],
					},
				],
			}

			const { container } = render(<CharacterSheet character={wizard} />)
			await screen.findByRole('heading', { name: 'Overreacher' })

			const spellsSection = container.querySelector('.sheet__spells')!
			await waitFor(() => expect(spellsSection.textContent).toContain('Fireball'))

			const fireballSummary = Array.from(spellsSection.querySelectorAll('summary')).find((s) => s.textContent?.includes('Fireball'))!
			expect(fireballSummary.textContent).toContain('unavailable at this level')
			const mageArmorSummary = Array.from(spellsSection.querySelectorAll('summary')).find((s) => s.textContent?.includes('Mage Armor'))!
			expect(mageArmorSummary.textContent).not.toContain('unavailable at this level')
			const cantripSummary = Array.from(spellsSection.querySelectorAll('summary')).find((s) => s.textContent?.includes('Prestidigitation'))!
			expect(cantripSummary.textContent).not.toContain('unavailable at this level')
			expect(spellsSection.querySelector('.sheet__spell-count-over')).toBeNull()
			expect(spellsSection.querySelector('.sheet__spell-limit-unknown')).toBeNull()
		})

		it('shows a count, not a guess at which spell, when more are known/prepared than the level allows', async () => {
			const spellSlots: ClassSpellSlotsData[] = [
				{ className: 'Sorcerer', classSource: 'XPHB', casterProgression: 'full', spellSlotsByLevel: [[2]], pactSlotsByLevel: null },
			]
			const spellCounts: ClassSpellCountData[] = [
				{ className: 'Sorcerer', classSource: 'XPHB', cantripProgression: [4], leveledSpellProgression: [2], label: 'known' },
			]
			const details: SpellDetail[] = [
				spellDetail({ name: 'Fire Bolt', source: 'XPHB', level: 0 }),
				spellDetail({ name: 'Mage Hand', source: 'XPHB', level: 0 }),
				spellDetail({ name: 'Prestidigitation', source: 'XPHB', level: 0 }),
				spellDetail({ name: 'Light', source: 'XPHB', level: 0 }),
				spellDetail({ name: 'Ray of Frost', source: 'XPHB', level: 0 }),
				spellDetail({ name: 'Magic Missile', source: 'XPHB', level: 1 }),
				spellDetail({ name: 'Shield', source: 'XPHB', level: 1 }),
				spellDetail({ name: 'Chromatic Orb', source: 'XPHB', level: 1 }),
			]
			vi.mocked(loadSpellSlotsClassData).mockResolvedValue(spellSlots)
			vi.mocked(loadSpellCountClassData).mockResolvedValue(spellCounts)
			vi.mocked(loadSpellDetails).mockResolvedValue(details)

			const sorcerer: Character = {
				id: 'lim2',
				name: 'Overprepared',
				classes: [{ className: 'Sorcerer', classSource: 'XPHB', subclass: null, level: 1 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 8, dexterity: 12, constitution: 13, intelligence: 10, wisdom: 12, charisma: 16 },
				},
				spellChoices: [
					{
						className: 'Sorcerer',
						classSource: 'XPHB',
						spells: [
							{ name: 'Fire Bolt', source: 'XPHB' },
							{ name: 'Mage Hand', source: 'XPHB' },
							{ name: 'Prestidigitation', source: 'XPHB' },
							{ name: 'Light', source: 'XPHB' },
							{ name: 'Ray of Frost', source: 'XPHB' },
							{ name: 'Magic Missile', source: 'XPHB' },
							{ name: 'Shield', source: 'XPHB' },
							{ name: 'Chromatic Orb', source: 'XPHB' },
						],
					},
				],
			}

			const { container } = render(<CharacterSheet character={sorcerer} />)
			await screen.findByRole('heading', { name: 'Overprepared' })

			const spellsSection = container.querySelector('.sheet__spells')!
			await waitFor(() => expect(spellsSection.textContent).toContain('Chromatic Orb'))

			expect(spellsSection.textContent).toContain('Cantrips: 5 known, 4 allowed.')
			expect(spellsSection.textContent).toContain('Spells known: 3 known, 2 allowed.')
			expect(spellsSection.querySelector('.spell-list__unavailable')).toBeNull()
		})

		it('shows no limit notice anywhere for a character within its limits', async () => {
			const spellSlots: ClassSpellSlotsData[] = [
				{ className: 'Wizard', classSource: 'XPHB', casterProgression: 'full', spellSlotsByLevel: [[2]], pactSlotsByLevel: null },
			]
			const spellCounts: ClassSpellCountData[] = [
				{ className: 'Wizard', classSource: 'XPHB', cantripProgression: [4], leveledSpellProgression: [6], label: 'prepared' },
			]
			const details: SpellDetail[] = [
				spellDetail({ name: 'Prestidigitation', source: 'XPHB', level: 0 }),
				spellDetail({ name: 'Mage Armor', source: 'XPHB', level: 1 }),
			]
			vi.mocked(loadSpellSlotsClassData).mockResolvedValue(spellSlots)
			vi.mocked(loadSpellCountClassData).mockResolvedValue(spellCounts)
			vi.mocked(loadSpellDetails).mockResolvedValue(details)

			const wizard: Character = {
				id: 'lim3',
				name: 'Well Within Limits',
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
							{ name: 'Prestidigitation', source: 'XPHB' },
							{ name: 'Mage Armor', source: 'XPHB' },
						],
					},
				],
			}

			const { container } = render(<CharacterSheet character={wizard} />)
			await screen.findByRole('heading', { name: 'Well Within Limits' })

			const spellsSection = container.querySelector('.sheet__spells')!
			await waitFor(() => expect(spellsSection.textContent).toContain('Mage Armor'))

			expect(spellsSection.querySelector('.spell-list__unavailable')).toBeNull()
			expect(spellsSection.querySelector('.sheet__spell-count-over')).toBeNull()
			expect(spellsSection.querySelector('.sheet__spell-limit-unknown')).toBeNull()
		})

		it('says the limit cannot be determined for a multiclass character, rather than showing nothing', async () => {
			const details: SpellDetail[] = [spellDetail({ name: 'Fireball', source: 'XPHB', level: 3 })]
			vi.mocked(loadSpellDetails).mockResolvedValue(details)

			const multiclass: Character = {
				id: 'lim4',
				name: 'Theurge Overreacher',
				classes: [
					{ className: 'Wizard', classSource: 'XPHB', subclass: null, level: 3 },
					{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 2 },
				],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 10, dexterity: 12, constitution: 13, intelligence: 16, wisdom: 12, charisma: 10 },
				},
				spellChoices: [{ className: 'Wizard', classSource: 'XPHB', spells: [{ name: 'Fireball', source: 'XPHB' }] }],
			}

			const { container } = render(<CharacterSheet character={multiclass} />)
			await screen.findByRole('heading', { name: 'Theurge Overreacher' })

			const spellsSection = container.querySelector('.sheet__spells')!
			await waitFor(() => expect(spellsSection.textContent).toContain('Fireball'))

			expect(container.querySelector('.sheet__spell-limit-unknown')).toBeTruthy()
			expect(spellsSection.textContent).toContain('combining more than one class')
			expect(spellsSection.querySelector('.spell-list__unavailable')).toBeNull()
			expect(spellsSection.querySelector('.sheet__spell-count-over')).toBeNull()
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
				optionalFeatureChoices: [{ featureType: 'EI', choices: [{ name: 'Pact of the Chain' }] }],
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
				// D99: this one records the level it was taken at, the sibling test above does not — the forms offered are the same.
				optionalFeatureChoices: [{ featureType: 'EI', choices: [{ name: 'Pact of the Chain', level: 2 }] }],
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
			// Slice 8e2 (D106): one known form against an allowance of 8 (level 6) — well within limits, no count notice.
			expect(section.querySelector('.sheet__wild-shape-count-over')).toBeNull()
			expect(section.querySelector('.sheet__wild-shape-count-unknown')).toBeNull()

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

		it('shows a count, not a guess at which form, when more Wild Shape forms are known than the level allows (slice 8e2, D106)', async () => {
			const druid: Character = {
				id: 'ws3',
				name: 'Overstuffed Shifter',
				classes: [{ className: 'Druid', classSource: 'XPHB', subclass: null, level: 2 }],
				abilityScores: {
					method: 'standardArray',
					scores: { strength: 10, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 15, charisma: 8 },
				},
				// Level 2 allows 4 known forms (Beast Shapes table) — 5 stored is one over.
				wildShapeForms: [
					{
						className: 'Druid',
						classSource: 'XPHB',
						forms: [
							{ name: 'Form1', source: 'XMM' },
							{ name: 'Form2', source: 'XMM' },
							{ name: 'Form3', source: 'XMM' },
							{ name: 'Form4', source: 'XMM' },
							{ name: 'Form5', source: 'XMM' },
						],
					},
				],
			}

			const { container } = render(<CharacterSheet character={druid} />)
			await screen.findByRole('heading', { name: 'Overstuffed Shifter' })

			await waitFor(() => expect(container.querySelector('.sheet__wild-shape-forms')).toBeTruthy())
			const section = container.querySelector('.sheet__wild-shape-forms')!
			expect(section.textContent).toContain('Druid Wild Shape forms: 5 known, 4 allowed.')
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
			optionalFeatureChoices: [{ featureType: 'EI', choices: [{ name: 'Devil’s Sight' }] }],
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

describe('the persistent header (rebuild slice 1)', () => {
	async function renderSheet(subject: Character, onEditHitPoints?: (hitPoints: HitPointFields) => void) {
		const result = render(<CharacterSheet character={subject} onEditHitPoints={onEditHitPoints} />)
		await screen.findByRole('heading', { level: 1, name: subject.name })
		return result
	}

	it('shows the six values once, in the header, and not again in the flat section list', async () => {
		const { container } = await renderSheet(character)
		await waitFor(() => expect(container.querySelector('.sheet__armour-class-value')).toBeTruthy())

		const header = container.querySelector('.sheet__persistent-header')!
		expect(header.querySelector('h1')!.textContent).toBe('Aria')
		expect(header.querySelector('.sheet__armour-class')).toBeTruthy()
		expect(header.querySelector('.sheet__initiative')).toBeTruthy()
		expect(header.querySelector('.sheet__speed')).toBeTruthy()
		expect(header.querySelector('.sheet__proficiency-bonus')).toBeTruthy()
		expect(header.querySelector('.sheet__hit-points')).toBeTruthy()

		// Exactly one of each on the whole sheet — nothing left behind in the body.
		expect(container.querySelectorAll('.sheet__armour-class')).toHaveLength(1)
		expect(container.querySelectorAll('.sheet__initiative')).toHaveLength(1)
		expect(container.querySelectorAll('.sheet__proficiency-bonus')).toHaveLength(1)
		expect(container.querySelectorAll('.sheet__speed')).toHaveLength(1)
		// The traits section keeps size and darkvision but no longer speed.
		const traits = container.querySelector('.sheet__traits')!
		expect(traits.textContent).not.toContain('Speed')
		expect(traits.textContent).toContain('Size')
		expect(traits.textContent).toContain('Darkvision')
	})

	it('shows an unset current HP as "—" beside the computed maximum, and is read-only without the callback', async () => {
		// Fighter 5, d10, CON 13 (+1), no recorded per-level choices: 10 + 4x6 + 5x1 = 39 (slice 8a).
		const { container } = await renderSheet(character)
		await waitFor(() => expect(container.querySelector('.sheet__hit-points-value')!.textContent).toBe('— / 39'))
		expect(screen.queryByLabelText('Current HP')).toBeNull()
	})

	it('carries the computed maximum’s breakdown, naming every level and Constitution (slice 8a)', async () => {
		const { container } = await renderSheet(character)
		await waitFor(() => expect(container.querySelector('.sheet__max-hit-points details')).toBeTruthy())
		const breakdown = container.querySelector('.sheet__max-hit-points details')!.textContent!
		expect(breakdown).toContain('level 1 (d10 maximum): +10')
		expect(breakdown).toContain('level 5 (d10 average): +6')
		expect(breakdown).toContain('constitution modifier (+1) × 5 levels: +5')
		expect(breakdown).toContain('no choices recorded')
	})

	it('a stored max override replaces the computed maximum, and current HP still edits through the callback', async () => {
		const onEditHitPoints = vi.fn()
		const withHp: Character = { ...character, currentHp: 18, maxHpOverride: 40 }
		const { container } = await renderSheet(withHp, onEditHitPoints)
		await waitFor(() => expect(container.querySelector('.sheet__hit-points-value')!.textContent).toBe('18 / 40'))
		expect(container.querySelector('.sheet__max-hit-points')!.textContent).toContain('manual maximum')

		const field = screen.getByLabelText('Current HP')
		fireEvent.change(field, { target: { value: '11' } })
		fireEvent.blur(field)
		expect(onEditHitPoints).toHaveBeenLastCalledWith({ currentHp: 11, maxHpOverride: 40, temporaryHitPoints: undefined })
	})

	/* Slice 9a1 (D110): the header reads the stored pile, and healing clamps to the maximum the sheet itself computed. */
	it('shows stored temporary hit points beside the pair and heals no further than the computed maximum', async () => {
		const onEditHitPoints = vi.fn()
		const withHp: Character = { ...character, currentHp: 30, play: { temporaryHitPoints: 8 } }
		const { container } = await renderSheet(withHp, onEditHitPoints)
		await waitFor(() => expect(container.querySelector('.sheet__hit-points-value')!.textContent).toBe('30 / 39 + 8 temporary'))

		fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '50' } })
		fireEvent.click(screen.getByRole('button', { name: 'Heal' }))
		expect(onEditHitPoints).toHaveBeenLastCalledWith({ currentHp: 39, maxHpOverride: undefined, temporaryHitPoints: 8 })
	})

	it('a species trait in the bonus table raises the computed maximum (slice 8a)', async () => {
		vi.mocked(loadSpeciesTraitNames).mockResolvedValueOnce(['Darkvision', 'Dwarven Resilience', 'Dwarven Toughness', 'Stonecunning'])
		const { container } = await renderSheet({ ...character, id: 'hp-dwarf' })
		// +1 per character level on top of the 39 above.
		await waitFor(() => expect(container.querySelector('.sheet__hit-points-value')!.textContent).toBe('— / 44'))
		expect(container.querySelector('.sheet__max-hit-points')!.textContent).toContain('Dwarven Toughness (+1 per character level)')
	})
})

describe('sheet tabs (rebuild slice 2)', () => {
	const TAB_LABELS = ['Vlastnosti a hody', 'Kouzla', 'Inventář', 'Schopnosti a rysy', 'Akce', 'Vzhled a poznámky']
	const TAB_IDS = ['stats', 'spells', 'inventory', 'features', 'actions', 'notes']

	afterEach(() => {
		vi.mocked(loadGrantedSenses).mockReset().mockResolvedValue([])
	})

	it('renders the six section tabs with the stats tab selected by default', async () => {
		render(<CharacterSheet character={character} />)
		await screen.findByRole('heading', { name: 'Aria' })

		const tabs = screen.getAllByRole('tab')
		expect(tabs.map((tab) => tab.textContent)).toEqual(TAB_LABELS)
		expect(tabs[0].getAttribute('aria-selected')).toBe('true')
		expect(tabs.slice(1).every((tab) => tab.getAttribute('aria-selected') === 'false')).toBe(true)
	})

	it('wires each tab to its panel and marks only the stats panel active on first render', async () => {
		const { container } = render(<CharacterSheet character={character} />)
		await screen.findByRole('heading', { name: 'Aria' })

		for (const id of TAB_IDS) {
			expect(container.querySelector(`#sheet-tab-${id}`)!.getAttribute('aria-controls')).toBe(`sheet-panel-${id}`)
			expect(container.querySelector(`#sheet-panel-${id}`)!.getAttribute('aria-labelledby')).toBe(`sheet-tab-${id}`)
		}
		expect(container.querySelector('#sheet-panel-stats')!.className).toContain('sheet__panel--active')
		for (const id of ['spells', 'inventory', 'features', 'actions', 'notes']) {
			expect(container.querySelector(`#sheet-panel-${id}`)!.className).not.toContain('sheet__panel--active')
		}
	})

	it('moves the active tab and panel on click', async () => {
		const user = userEvent.setup()
		const { container } = render(<CharacterSheet character={character} />)
		await screen.findByRole('heading', { name: 'Aria' })

		await user.click(screen.getByRole('tab', { name: 'Inventář' }))

		expect(screen.getByRole('tab', { name: 'Inventář' }).getAttribute('aria-selected')).toBe('true')
		expect(screen.getByRole('tab', { name: 'Vlastnosti a hody' }).getAttribute('aria-selected')).toBe('false')
		expect(container.querySelector('#sheet-panel-inventory')!.className).toContain('sheet__panel--active')
		expect(container.querySelector('#sheet-panel-stats')!.className).not.toContain('sheet__panel--active')
	})

	it('groups the stats/rolls sections, senses included, under the first tab', async () => {
		vi.mocked(loadGrantedSenses).mockResolvedValue([{ senseType: 'blindsight', range: 10, origin: 'feat', name: 'Skulker' }])
		const withSense: Character = { ...character, id: 'tabs-stats', featAsiChoices: [{ level: 4, kind: 'feat', name: 'Skulker', source: 'XPHB' }] }

		const { container } = render(<CharacterSheet character={withSense} />)
		await screen.findByRole('heading', { name: 'Aria' })
		await waitFor(() => expect(container.querySelector('.sheet__senses')).toBeTruthy())

		const panel = container.querySelector('#sheet-panel-stats')!
		for (const cls of [
			'.sheet__abilities',
			'.sheet__saving-throws',
			'.sheet__skills',
			'.sheet__passive-values',
			'.sheet__traits',
			'.sheet__senses',
			'.sheet__hit-dice',
		]) {
			expect(panel.querySelector(cls)).toBeTruthy()
		}
	})

	it('puts inventory and damage responses under the Inventář tab, and weapon attacks under Akce', async () => {
		const { container } = render(<CharacterSheet character={character} />)
		await screen.findByRole('heading', { name: 'Aria' })
		await waitFor(() => expect(container.querySelector('.sheet__inventory')).toBeTruthy())

		const inventory = container.querySelector('#sheet-panel-inventory')!
		expect(inventory.querySelector('.sheet__inventory')).toBeTruthy()
		expect(inventory.querySelector('.sheet__damage-responses')).toBeTruthy()

		const actions = container.querySelector('#sheet-panel-actions')!
		expect(actions.querySelector('.sheet__actions')).toBeTruthy()

		expect(container.querySelectorAll('.sheet__actions')).toHaveLength(1)
		expect(container.querySelector('#sheet-panel-stats')!.querySelector('.sheet__damage-responses')).toBeNull()
	})

	it('puts spells under Kouzla and features/class options under Schopnosti a rysy', async () => {
		const warlock: Character = {
			id: 'tabs-caster',
			name: 'Aria',
			classes: [{ className: 'Warlock', classSource: 'XPHB', subclass: null, level: 5 }],
			optionalFeatureChoices: [{ featureType: 'EI', choices: [{ name: 'Agonizing Blast' }] }],
			spellChoices: [{ className: 'Warlock', classSource: 'XPHB', spells: [{ name: 'Eldritch Blast', source: 'XPHB' }] }],
		}

		const { container } = render(<CharacterSheet character={warlock} />)
		await screen.findByRole('heading', { name: 'Aria' })
		await waitFor(() => expect(container.querySelector('.sheet__class-optional-features')).toBeTruthy())

		expect(container.querySelector('#sheet-panel-spells')!.querySelector('.sheet__spells')).toBeTruthy()

		const features = container.querySelector('#sheet-panel-features')!
		expect(features.querySelector('.sheet__feats')).toBeTruthy()
		expect(features.querySelector('.sheet__class-optional-features')).toBeTruthy()
	})
})

/* Slice 9d2: three plain textareas, each in its own independently collapsible <details>, each written to its own Character field. */
describe('the Vzhled a poznámky tab (slice 9d2)', () => {
	const MULTI_LINE = '- first\n\n  indented   \n* second\n'

	/* Holds the character in state the way CharacterManager does, so the sheet re-reads what it wrote. */
	function Harness({ initial, onEdit }: { initial: Character; onEdit: (field: string, text: string) => void }) {
		const [current, setCurrent] = useState(initial)
		return (
			<CharacterSheet
				character={current}
				onEditText={(field, text) => {
					onEdit(field, text)
					setCurrent((previous) => ({ ...previous, [field]: text }))
				}}
			/>
		)
	}

	async function openNotesTab(subject: Character = character, onEdit = vi.fn()) {
		const user = userEvent.setup()
		const { container } = render(<Harness initial={subject} onEdit={onEdit} />)
		await screen.findByRole('heading', { name: 'Aria' })
		await user.click(screen.getByRole('tab', { name: 'Vzhled a poznámky' }))
		return { user, container, onEdit }
	}

	function sectionDetails(container: HTMLElement): HTMLDetailsElement[] {
		return Array.from(container.querySelectorAll<HTMLDetailsElement>('#sheet-panel-notes details'))
	}

	it('is the last tab and is reached like the other five', async () => {
		const { container } = await openNotesTab()

		const tabs = screen.getAllByRole('tab')
		expect(tabs[tabs.length - 1].textContent).toBe('Vzhled a poznámky')
		expect(screen.getByRole('tab', { name: 'Vzhled a poznámky' }).getAttribute('aria-selected')).toBe('true')
		expect(container.querySelector('#sheet-panel-notes')!.className).toContain('sheet__panel--active')
		expect(container.querySelector('#sheet-panel-stats')!.className).not.toContain('sheet__panel--active')
	})

	it('holds Vzhled, Příběh and Poznámky in that order, each with exactly one textarea', async () => {
		const { container } = await openNotesTab()

		const sections = sectionDetails(container)
		expect(sections.map((section) => section.querySelector('summary')!.textContent)).toEqual(['Vzhled', 'Příběh', 'Poznámky'])
		for (const section of sections) expect(section.querySelectorAll('textarea')).toHaveLength(1)
		expect(container.querySelectorAll('#sheet-panel-notes textarea')).toHaveLength(3)
	})

	it('opens and closes each section without moving the other two', async () => {
		const { user, container } = await openNotesTab()
		const [appearance, backstory, notes] = sectionDetails(container)
		const openStates = () => [appearance.open, backstory.open, notes.open]

		expect(openStates()).toEqual([false, false, false])

		await user.click(screen.getByText('Příběh', { selector: 'summary' }))
		expect(openStates()).toEqual([false, true, false])

		await user.click(screen.getByText('Vzhled', { selector: 'summary' }))
		expect(openStates()).toEqual([true, true, false])

		await user.click(screen.getByText('Příběh', { selector: 'summary' }))
		expect(openStates()).toEqual([true, false, false])

		await user.click(screen.getByText('Poznámky', { selector: 'summary' }))
		expect(openStates()).toEqual([true, false, true])
	})

	it('writes each textarea to its own field, exactly as typed, line breaks included', async () => {
		const { user, onEdit } = await openNotesTab()

		// Tab leaves the field, which is what commits (D116).
		await user.type(screen.getByRole('textbox', { name: 'Vzhled' }), 'Tall{Enter}Green eyes')
		await user.tab()
		expect(onEdit).toHaveBeenLastCalledWith('appearance', 'Tall\nGreen eyes')

		await user.type(screen.getByRole('textbox', { name: 'Příběh' }), '- Raised by owls{Enter}  - Left at dawn  ')
		await user.tab()
		expect(onEdit).toHaveBeenLastCalledWith('backstory', '- Raised by owls\n  - Left at dawn  ')

		await user.type(screen.getByRole('textbox', { name: 'Poznámky' }), 'Owes Cato 5 gp')
		await user.tab()
		expect(onEdit).toHaveBeenLastCalledWith('notes', 'Owes Cato 5 gp')

		// Each textarea shows its own text and nothing of the other two.
		expect((screen.getByRole('textbox', { name: 'Vzhled' }) as HTMLTextAreaElement).value).toBe('Tall\nGreen eyes')
		expect((screen.getByRole('textbox', { name: 'Příběh' }) as HTMLTextAreaElement).value).toBe('- Raised by owls\n  - Left at dawn  ')
		expect((screen.getByRole('textbox', { name: 'Poznámky' }) as HTMLTextAreaElement).value).toBe('Owes Cato 5 gp')
		const fields = new Set(onEdit.mock.calls.map(([field]) => field))
		expect(fields).toEqual(new Set(['appearance', 'backstory', 'notes']))
	})

	it('shows stored text back in the matching textarea, multi-line text intact', async () => {
		await openNotesTab({ ...character, appearance: MULTI_LINE, notes: 'Only a note' })

		expect((screen.getByRole('textbox', { name: 'Vzhled' }) as HTMLTextAreaElement).value).toBe(MULTI_LINE)
		expect((screen.getByRole('textbox', { name: 'Příběh' }) as HTMLTextAreaElement).value).toBe('')
		expect((screen.getByRole('textbox', { name: 'Poznámky' }) as HTMLTextAreaElement).value).toBe('Only a note')
	})

	it('reports an emptied textarea as the empty string, which the store reads as none', async () => {
		const { user, onEdit } = await openNotesTab({ ...character, notes: 'x' })

		await user.clear(screen.getByRole('textbox', { name: 'Poznámky' }))
		await user.tab()

		expect(onEdit).toHaveBeenLastCalledWith('notes', '')
	})

	/* D116: the displayed text is the local draft; storage is written on idle or blur, never per keystroke. */
	describe('commit timing (D116)', () => {
		const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

		it('keeps typing local and writes once, with the final text, after the idle delay', async () => {
			const { user, onEdit } = await openNotesTab()
			const field = screen.getByRole('textbox', { name: 'Poznámky' }) as HTMLTextAreaElement

			await user.type(field, 'Owes Cato')

			expect(field.value).toBe('Owes Cato')
			expect(onEdit).not.toHaveBeenCalled()
			await waitFor(() => expect(onEdit).toHaveBeenCalledTimes(1), { timeout: 2000 })
			expect(onEdit).toHaveBeenLastCalledWith('notes', 'Owes Cato')
		})

		it('commits on blur at once, and the pending idle write does not repeat it', async () => {
			const { user, onEdit } = await openNotesTab()

			await user.type(screen.getByRole('textbox', { name: 'Poznámky' }), 'Owes Cato')
			expect(onEdit).not.toHaveBeenCalled()
			await user.tab()
			expect(onEdit).toHaveBeenCalledTimes(1)
			expect(onEdit).toHaveBeenLastCalledWith('notes', 'Owes Cato')

			await wait(800)
			expect(onEdit).toHaveBeenCalledTimes(1)
		})

		it('does not write on blur when nothing was typed', async () => {
			const { user, onEdit } = await openNotesTab({ ...character, notes: 'Stored' })

			await user.click(screen.getByRole('textbox', { name: 'Poznámky' }))
			await user.tab()

			expect(onEdit).not.toHaveBeenCalled()
		})

		it('flushes pending text when the sheet unmounts without a blur', async () => {
			const onEdit = vi.fn()
			const user = userEvent.setup()
			const { unmount } = render(<Harness initial={character} onEdit={onEdit} />)
			await screen.findByRole('heading', { name: 'Aria' })
			await user.click(screen.getByRole('tab', { name: 'Vzhled a poznámky' }))
			await user.type(screen.getByRole('textbox', { name: 'Příběh' }), 'Left at dawn')
			expect(onEdit).not.toHaveBeenCalled()

			unmount()

			expect(onEdit).toHaveBeenCalledTimes(1)
			expect(onEdit).toHaveBeenLastCalledWith('backstory', 'Left at dawn')
		})

		it.each(['beforeunload', 'pagehide'])('flushes pending text when the page goes away (%s) without a blur', async (event) => {
			const { user, onEdit } = await openNotesTab()

			await user.type(screen.getByRole('textbox', { name: 'Poznámky' }), 'Owes Cato')
			expect(onEdit).not.toHaveBeenCalled()

			fireEvent(window, new Event(event))

			expect(onEdit).toHaveBeenCalledTimes(1)
			expect(onEdit).toHaveBeenLastCalledWith('notes', 'Owes Cato')

			// The flush cleared the timer, so the idle write does not repeat it.
			await wait(800)
			expect(onEdit).toHaveBeenCalledTimes(1)
		})

		it('does nothing when the page goes away with no pending text', async () => {
			const { onEdit } = await openNotesTab({ ...character, notes: 'Stored' })

			fireEvent(window, new Event('beforeunload'))

			expect(onEdit).not.toHaveBeenCalled()
		})
	})

	it('leaves the textareas read-only when the sheet is given no way to write them', async () => {
		render(<CharacterSheet character={{ ...character, notes: 'Stored' }} />)
		await screen.findByRole('heading', { name: 'Aria' })

		const field = screen.getByRole('textbox', { name: 'Poznámky' }) as HTMLTextAreaElement
		expect(field.readOnly).toBe(true)
		expect(field.value).toBe('Stored')
	})

	/* Slice 9b6: one click on a hit die rolls it, heals by the total (plus Constitution) and marks it spent. */
	describe('spending a hit die', () => {
		const FIGHTER_KEY = 'Fighter|XPHB'
		// maxHpOverride pins a known maximum without a hit-point method; Constitution 13 is +1, so a d10 rolled as 6 heals 7.
		const fighter: Character = { ...character, id: 'hit-die', maxHpOverride: 50, currentHp: 20 }
		let randomSpy: { mockRestore: () => void }

		beforeEach(() => {
			randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5)
		})
		afterEach(() => {
			randomSpy.mockRestore()
		})

		function Harness({
			initial,
			onHitPoints,
			onSpent,
			onRest,
		}: {
			initial: Character
			onHitPoints: (hitPoints: HitPointFields) => void
			onSpent: (spentHitDice: Record<string, number> | undefined) => void
			onRest?: (rest: unknown) => void
		}) {
			const [current, setCurrent] = useState(initial)
			return (
				<CharacterSheet
					character={current}
					onEditHitPoints={(hitPoints) => {
						onHitPoints(hitPoints)
						setCurrent((c) => ({ ...c, currentHp: hitPoints.currentHp }))
					}}
					onEditSpentHitDice={(spentHitDice) => {
						onSpent(spentHitDice)
						setCurrent((c) => ({ ...c, play: { ...c.play, spentHitDice } }))
					}}
					onRest={onRest}
				/>
			)
		}

		async function renderHarness(subject: Character, onRest?: (rest: unknown) => void) {
			const onHitPoints = vi.fn()
			const onSpent = vi.fn()
			const { container } = render(<Harness initial={subject} onHitPoints={onHitPoints} onSpent={onSpent} onRest={onRest} />)
			await screen.findAllByRole('button', { name: /^Roll .* hit die$/ })
			return { container, onHitPoints, onSpent }
		}

		function hitDiceRows(container: HTMLElement): string[] {
			return Array.from(container.querySelectorAll('.sheet__hit-dice > ul > li')).map((li) => li.textContent ?? '')
		}

		function rollButton(className: string): HTMLButtonElement {
			return screen.getByRole('button', { name: `Roll ${className} hit die` }) as HTMLButtonElement
		}

		it('shows remaining against the maximum, reading the stored spend', async () => {
			const { container } = await renderHarness({ ...fighter, play: { spentHitDice: { [FIGHTER_KEY]: 2 } } })
			expect(hitDiceRows(container)[0]).toContain('d10 (Fighter): 3 / 5 remaining')
		})

		it('one click heals by the roll plus Constitution and marks one die spent', async () => {
			const { container, onHitPoints, onSpent } = await renderHarness(fighter)
			expect(hitDiceRows(container)[0]).toContain('5 / 5 remaining')

			fireEvent.click(rollButton('Fighter'))

			// Math.random 0.5 on a d10 is a 6; Constitution 13 adds 1.
			expect(container.querySelector('.sheet__hit-dice .dice-roll__result')!.textContent).toContain('6 + 1 = 7')
			expect(onHitPoints).toHaveBeenCalledTimes(1)
			expect(onHitPoints).toHaveBeenCalledWith({ currentHp: 27, maxHpOverride: 50, temporaryHitPoints: 0, deathSaves: undefined })
			expect(onSpent).toHaveBeenCalledTimes(1)
			expect(onSpent).toHaveBeenCalledWith({ [FIGHTER_KEY]: 1 })
			expect(hitDiceRows(container)[0]).toContain('4 / 5 remaining')
			expect(container.querySelector('.sheet__hit-points-value')!.textContent).toContain('27 / 50')
		})

		it('stops the healing at the maximum but still spends the die', async () => {
			const { onHitPoints, onSpent } = await renderHarness({ ...fighter, currentHp: 47 })

			fireEvent.click(rollButton('Fighter'))

			expect(onHitPoints).toHaveBeenCalledWith(expect.objectContaining({ currentHp: 50 }))
			expect(onSpent).toHaveBeenCalledWith({ [FIGHTER_KEY]: 1 })
		})

		it('keeps the other spent counts when one more is added', async () => {
			const { onSpent } = await renderHarness({ ...fighter, play: { spentHitDice: { [FIGHTER_KEY]: 2 } } })

			fireEvent.click(rollButton('Fighter'))

			expect(onSpent).toHaveBeenCalledWith({ [FIGHTER_KEY]: 3 })
		})

		it('spends only the rolled class in a multiclass character', async () => {
			const multiclass: Character = {
				...fighter,
				classes: [
					{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 3 },
					{ className: 'Bard', classSource: 'XPHB', subclass: null, level: 2 },
				],
			}
			const { container, onSpent } = await renderHarness(multiclass)
			expect(hitDiceRows(container)).toEqual([expect.stringContaining('d10 (Fighter): 3 / 3 remaining'), expect.stringContaining('d8 (Bard): 2 / 2 remaining')])

			fireEvent.click(rollButton('Bard'))

			expect(onSpent).toHaveBeenCalledWith({ 'Bard|XPHB': 1 })
			expect(hitDiceRows(container)[0]).toContain('3 / 3 remaining')
			expect(hitDiceRows(container)[1]).toContain('1 / 2 remaining')
		})

		it('disables the roll at 0 remaining, so nothing rolls and nothing heals', async () => {
			const { container, onHitPoints, onSpent } = await renderHarness({ ...fighter, play: { spentHitDice: { [FIGHTER_KEY]: 4 } } })

			fireEvent.click(rollButton('Fighter'))
			expect(hitDiceRows(container)[0]).toContain('0 / 5 remaining')
			expect(rollButton('Fighter').disabled).toBe(true)

			fireEvent.click(rollButton('Fighter'))
			expect(onHitPoints).toHaveBeenCalledTimes(1)
			expect(onSpent).toHaveBeenCalledTimes(1)
			expect(onSpent).toHaveBeenLastCalledWith({ [FIGHTER_KEY]: 5 })
			// The one result made before the count ran out is still on show.
			expect(container.querySelector('.sheet__hit-dice .dice-roll__result')).toBeTruthy()
		})

		it('is disabled from the start when every die is already spent', async () => {
			const { onHitPoints, onSpent } = await renderHarness({ ...fighter, play: { spentHitDice: { [FIGHTER_KEY]: 5 } } })

			expect(rollButton('Fighter').disabled).toBe(true)
			fireEvent.click(rollButton('Fighter'))
			expect(onHitPoints).not.toHaveBeenCalled()
			expect(onSpent).not.toHaveBeenCalled()
		})

		it('offers no roll to a writable sheet with no current HP to heal, and says why', async () => {
			const notSet: Character = { ...fighter }
			delete notSet.currentHp
			const { container, onHitPoints, onSpent } = await renderHarness(notSet)

			expect(rollButton('Fighter').disabled).toBe(true)
			expect(container.querySelector('.sheet__hit-dice-note')!.textContent).toContain('current HP')
			fireEvent.click(rollButton('Fighter'))
			expect(onHitPoints).not.toHaveBeenCalled()
			expect(onSpent).not.toHaveBeenCalled()
		})

		it('a read-only sheet still rolls, and writes nothing', async () => {
			const { container } = render(<CharacterSheet character={fighter} />)
			await screen.findByRole('button', { name: 'Roll Fighter hit die' })

			expect(rollButton('Fighter').disabled).toBe(false)
			fireEvent.click(rollButton('Fighter'))

			expect(container.querySelector('.sheet__hit-dice .dice-roll__result')!.textContent).toContain('6 + 1 = 7')
			expect(hitDiceRows(container)[0]).toContain('5 / 5 remaining')
			expect(container.querySelector('.sheet__hit-dice-note')).toBeNull()
		})

		it('a Short Rest passes the spent hit dice through untouched, a Long Rest returns them all', async () => {
			const onRest = vi.fn()
			await renderHarness({ ...fighter, play: { spentHitDice: { [FIGHTER_KEY]: 2 } } }, onRest)

			fireEvent.click(screen.getByRole('button', { name: 'Short Rest' }))
			expect(onRest).toHaveBeenLastCalledWith(expect.objectContaining({ spentHitDice: { [FIGHTER_KEY]: 2 } }))

			fireEvent.click(screen.getByRole('button', { name: 'Long Rest' }))
			expect(onRest).toHaveBeenLastCalledWith(expect.objectContaining({ spentHitDice: {} }))
		})
	})
})
