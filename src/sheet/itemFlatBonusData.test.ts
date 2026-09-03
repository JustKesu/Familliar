import { describe, expect, it } from 'vitest'
import { computeArmourClass, type EquippedGear } from '../calculation/armourClass'
import { flatBonusesByTarget } from '../calculation/itemFlatBonuses'
import { computeSavingThrow, type ClassSavingThrowProficiencies } from '../calculation/savingThrows'
import { computeSkill } from '../calculation/skills'
import { computeSpellcasting, type ClassSpellcastingAbility } from '../calculation/spellcasting'
import type { ItemRef } from '../inventory/inventoryData'
import { CUSTOM_ITEM_SOURCE, type Character, type CharacterInventoryItem } from '../storage/character'
import { buildItemFlatBonusGrants } from './itemFlatBonusData'

/** The real fields, as scripts/investigate-worn-bonuses.js found them: every carrier requires attunement, and the values are "+N" strings parsed to numbers. */
const cloakOfProtection: ItemRef = { name: 'Cloak of Protection', source: 'XDMG', requiresAttunement: true, bonusAc: 1, bonusSavingThrow: 1 }
const ringOfProtection: ItemRef = { name: 'Ring of Protection', source: 'XDMG', typeCode: 'RG', requiresAttunement: true, bonusAc: 1, bonusSavingThrow: 1 }
const rodOfThePactKeeper: ItemRef = { name: '+2 Rod of the Pact Keeper', source: 'XDMG', typeCode: 'RD', requiresAttunement: true, bonusSpellAttack: 2, bonusSpellSaveDc: 2 }
const stoneOfGoodLuck: ItemRef = { name: 'Stone of Good Luck', source: 'XDMG', requiresAttunement: true, bonusSavingThrow: 1, bonusAbilityCheck: 1 }
const iounStoneOfMastery: ItemRef = { name: 'Ioun Stone, Mastery', source: 'XDMG', requiresAttunement: true, bonusProficiencyBonus: 1 }
/** The only two carriers of any of the six keys that need no attunement, and both are armour — slice e already applies their bonusAc through the armour role. */
const glamouredStuddedLeather: ItemRef = { name: 'Glamoured Studded Leather', source: 'XDMG', typeCode: 'LA', ac: 12, bonusAc: 1 }
const repulsionShield: ItemRef = { name: 'Repulsion Shield', source: 'EFA', typeCode: 'S', ac: 2, bonusAc: 1 }

const itemRefs = [cloakOfProtection, ringOfProtection, rodOfThePactKeeper, stoneOfGoodLuck, iounStoneOfMastery, glamouredStuddedLeather, repulsionShield]

function row(name: string, source: string, extra: Partial<CharacterInventoryItem> = {}): CharacterInventoryItem {
	return { name, source, quantity: 1, ...extra }
}

function bonuses(inventory: CharacterInventoryItem[]) {
	return flatBonusesByTarget(buildItemFlatBonusGrants(inventory, itemRefs))
}

/** DEX 14 (+2), CON 13 (+1), WIS 10 (+0), CHA 8 (-1), STR 15 (+2). */
const fighter5: Character = {
	id: '1',
	name: 'Fighter5',
	classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 5 }],
	abilityScores: {
		method: 'standardArray',
		scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 },
	},
}

/** DEX 16 (+3), CON 16 (+3) — Unarmored Defense gives 10 + 3 + 3 = 16. */
const barbarian3: Character = {
	id: '2',
	name: 'Barbarian3',
	classes: [{ className: 'Barbarian', classSource: 'XPHB', subclass: null, level: 3 }],
	abilityScores: {
		method: 'standardArray',
		scores: { strength: 15, dexterity: 16, constitution: 16, intelligence: 8, wisdom: 10, charisma: 12 },
	},
}

/** INT 16 (+3), PB +3 at level 5 → attack +6, DC 14. */
const wizard5: Character = {
	id: '3',
	name: 'Wizard5',
	classes: [{ className: 'Wizard', classSource: 'XPHB', subclass: null, level: 5 }],
	abilityScores: {
		method: 'standardArray',
		scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 16, wisdom: 12, charisma: 10 },
	},
}

const fighterSaves: ClassSavingThrowProficiencies[] = [{ className: 'Fighter', classSource: 'XPHB', abilities: ['str', 'con'] }]
const wizardAbility: ClassSpellcastingAbility = { className: 'Wizard', classSource: 'XPHB', ability: 'int' }

function emptyGear(overrides: Partial<EquippedGear> = {}): EquippedGear {
	return { armour: null, shield: null, unresolved: [], carriedArmourNotWorn: [], incompleteArmour: [], ...overrides }
}

describe('a Cloak of Protection', () => {
	it('reaches BOTH Armour Class and every saving throw once attuned', () => {
		const applied = bonuses([row('Cloak of Protection', 'XDMG', { attuned: true })])

		const ac = computeArmourClass(fighter5, emptyGear(), [], [], applied.armourClass)
		expect(ac).toMatchObject({ status: 'known', value: { value: 13 } })
		expect(ac.status === 'known' && ac.breakdown).toContainEqual({ source: 'Cloak of Protection', amount: 1 })

		const save = computeSavingThrow('dexterity', fighter5, fighterSaves, [], applied.savingThrow)
		expect(save).toMatchObject({ status: 'known', value: { modifier: 3 } })
		expect(save.status === 'known' && save.breakdown).toContainEqual({ source: 'Cloak of Protection', amount: 1 })
	})

	it('reaches NEITHER while it is carried unattuned, and says so in both places (D76)', () => {
		const applied = bonuses([row('Cloak of Protection', 'XDMG')])

		const ac = computeArmourClass(fighter5, emptyGear(), [], [], applied.armourClass)
		expect(ac).toMatchObject({ status: 'known', value: { value: 12 } })

		const save = computeSavingThrow('dexterity', fighter5, fighterSaves, [], applied.savingThrow)
		expect(save).toMatchObject({ status: 'known', value: { modifier: 2 } })

		for (const result of [ac, save]) {
			const note = result.status === 'known' ? result.breakdown.find((line) => line.source === 'Cloak of Protection')?.note : undefined
			expect(note).toBe('considered (+1) — not applied: requires attunement and you are not attuned to it')
		}
	})
})

describe('a worn bonus and the AC formula that won', () => {
	it('adds to an Unarmored Defense, not only to worn armour', () => {
		const applied = bonuses([row('Ring of Protection', 'XDMG', { attuned: true })])
		const ac = computeArmourClass(barbarian3, emptyGear(), ['barbarian-unarmored-defense'], [], applied.armourClass)

		// 10 + Dex 3 + Con 3 = 16, plus the ring.
		expect(ac).toMatchObject({ status: 'known', value: { value: 17 } })
		expect(ac.status === 'known' && ac.breakdown).toContainEqual({ source: 'Ring of Protection', amount: 1 })
	})
})

describe('spell attack and spell save DC', () => {
	it('each get their own bonus from the same item', () => {
		const applied = bonuses([row('+2 Rod of the Pact Keeper', 'XDMG', { attuned: true })])
		const result = computeSpellcasting(wizard5, [wizardAbility], [], applied.spellAttack, applied.spellSaveDc)

		expect(result.status).toBe('known')
		const entry = result.status === 'known' ? result.value[0] : null
		expect(entry?.spellAttackBonus).toBe(8)
		expect(entry?.spellSaveDC).toBe(16)
		expect(entry?.spellAttackBreakdown).toContainEqual({ source: '+2 Rod of the Pact Keeper', amount: 2 })
		expect(entry?.spellSaveDCBreakdown).toContainEqual({ source: '+2 Rod of the Pact Keeper', amount: 2 })
	})
})

describe('two bonus-carrying items attuned at once', () => {
	it('shows both as separate breakdown lines, never one summed line', () => {
		const applied = bonuses([row('Cloak of Protection', 'XDMG', { attuned: true }), row('Stone of Good Luck', 'XDMG', { attuned: true })])

		const save = computeSavingThrow('dexterity', fighter5, fighterSaves, [], applied.savingThrow)
		expect(save).toMatchObject({ status: 'known', value: { modifier: 4 } })
		expect(save.status === 'known' && save.breakdown.filter((line) => line.amount === 1)).toEqual([
			{ source: 'Cloak of Protection', amount: 1 },
			{ source: 'Stone of Good Luck', amount: 1 },
		])
	})

	it('lands the Stone of Good Luck on ability checks too', () => {
		const applied = bonuses([row('Stone of Good Luck', 'XDMG', { attuned: true })])
		const skill = computeSkill('acrobatics', fighter5, [], applied.abilityCheck)

		expect(skill).toMatchObject({ status: 'known', value: { modifier: 3 } })
		expect(skill.status === 'known' && skill.breakdown).toContainEqual({ source: 'Stone of Good Luck', amount: 1 })
	})
})

describe('buildItemFlatBonusGrants', () => {
	it('leaves an armour’s and a shield’s own bonusAc to slice e, so it is never counted twice', () => {
		const grants = buildItemFlatBonusGrants([row('Glamoured Studded Leather', 'XDMG', { equipped: 'worn' }), row('Repulsion Shield', 'EFA', { equipped: 'held' })], itemRefs)

		expect(grants).toEqual([])
	})

	it('names an attuned row the item data does not know, on every value it could have touched (D43)', () => {
		const grants = buildItemFlatBonusGrants([row('Amulet of Nothing', 'HB', { attuned: true })], itemRefs)

		expect(grants).toHaveLength(6)
		expect(new Set(grants.map((grant) => grant.target)).size).toBe(6)
		expect(grants[0].unresolvedReason).toBe('attuned but not found in the item data (HB) — any flat bonus it grants is not counted')
	})

	it('says nothing about an UNATTUNED row the item data does not know — it could not have contributed either way', () => {
		expect(buildItemFlatBonusGrants([row('Amulet of Nothing', 'HB')], itemRefs)).toEqual([])
	})

	it('ignores quantity — a second cloak in the pack is not a second +1', () => {
		const grants = buildItemFlatBonusGrants([row('Cloak of Protection', 'XDMG', { quantity: 3, attuned: true })], itemRefs)

		expect(grants.filter((grant) => grant.target === 'armourClass')).toEqual([{ sourceName: 'Cloak of Protection', target: 'armourClass', amount: 1 }])
	})

	it('carries the Ioun Stone of Mastery’s bonus as a grant, so the sheet can show it even though nothing applies it', () => {
		const grants = buildItemFlatBonusGrants([row('Ioun Stone, Mastery', 'XDMG', { attuned: true })], itemRefs)

		expect(grants).toEqual([{ sourceName: 'Ioun Stone, Mastery', target: 'proficiencyBonus', amount: 1 }])
	})

	/* Slice e2b: a custom item's five bonus fields land on the same ItemRef keys, so this file reads them with no second branch. */
	describe('a custom item', () => {
		const charm: CharacterInventoryItem = {
			name: 'Charm of the Sage',
			source: CUSTOM_ITEM_SOURCE,
			quantity: 1,
			custom: {
				name: 'Charm of the Sage',
				kind: 'worn',
				requiresAttunement: true,
				bonusArmourClass: 1,
				bonusSavingThrow: 2,
				bonusSpellAttack: 1,
				bonusSpellSaveDc: 1,
				bonusAbilityCheck: 1,
			},
		}

		it('reaches all five targets once attuned, and none of them before', () => {
			expect(buildItemFlatBonusGrants([charm], itemRefs).every((grant) => grant.withheldReason !== undefined)).toBe(true)

			const applied = buildItemFlatBonusGrants([{ ...charm, attuned: true }], itemRefs)
			expect(applied).toEqual([
				{ sourceName: 'Charm of the Sage', target: 'armourClass', amount: 1 },
				{ sourceName: 'Charm of the Sage', target: 'savingThrow', amount: 2 },
				{ sourceName: 'Charm of the Sage', target: 'spellAttack', amount: 1 },
				{ sourceName: 'Charm of the Sage', target: 'spellSaveDc', amount: 1 },
				{ sourceName: 'Charm of the Sage', target: 'abilityCheck', amount: 1 },
			])
		})

		it('reaches a real saving throw with its own named line', () => {
			const grants = flatBonusesByTarget(buildItemFlatBonusGrants([{ ...charm, attuned: true }], itemRefs))
			const save = computeSavingThrow('constitution', fighter5, fighterSaves, [], grants.savingThrow)

			// CON +1, proficient +3, charm +2.
			expect(save).toMatchObject({ status: 'known', value: { modifier: 6 } })
			expect(save.status === 'known' && save.breakdown).toContainEqual({ source: 'Charm of the Sage', amount: 2 })
		})

		/* A custom SUIT's bonusArmourClass is that suit's magic bonus, applied by slice e — reading it here too would count it twice. */
		it('leaves a custom suit’s own AC bonus to the armour role', () => {
			const suit: CharacterInventoryItem = {
				name: 'Bark Plate',
				source: CUSTOM_ITEM_SOURCE,
				quantity: 1,
				equipped: 'worn',
				custom: { name: 'Bark Plate', kind: 'armour', armourClass: 14, armourCategory: 'medium', bonusArmourClass: 1 },
			}
			expect(buildItemFlatBonusGrants([suit], itemRefs)).toEqual([])
		})
	})
})
