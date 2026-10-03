import { describe, expect, it } from 'vitest'
import type { Ability } from '../abilities/abilityScores'
import type { Character } from '../storage/character'
import { chosenSpellUsageFor } from '../spells/chosenSpellUsage'
import { alsoCastableWithSlot } from '../spells/alsoCastableWithSlot'
import { computeArmourClass, type EquippedArmour, type EquippedGear, type EquippedShield } from './armourClass'
import { totalCharacterLevel } from './characterLevel'
import { featureSpeedAdjustments } from './featureSpeed'
import { freeCastCounter, withLegacyFreeCastUses } from './freeCastResources'
import { noMagicBonus } from './magicBonus'
import { computeSavingThrow, type ClassSavingThrowProficiencies } from './savingThrows'
import { computeFeatSpellcasting } from './spellcasting'
import { computeWeaponAttacks, damageText, type HeldWeapon, type ResolvedWeapon, type WeaponAttack } from './weaponAttacks'

function character(className: string, level: number, scores: Partial<Record<Ability, number>> = {}, over: Partial<Character> = {}): Character {
	return {
		id: '1',
		name: className,
		classes: [{ className, classSource: 'XPHB', subclass: null, level }],
		abilityScores: { method: 'standardArray', scores: { strength: 10, dexterity: 16, constitution: 12, intelligence: 10, wisdom: 10, charisma: 10, ...scores } },
		...over,
	}
}

const longbow: ResolvedWeapon = { name: 'Longbow', source: 'XPHB', typeCode: 'R', weaponCategory: 'martial', dmg1: '1d8', dmgTypeFull: 'piercing', propertyFull: ['Ammunition', 'Heavy', 'Two-Handed'], range: '150/600' }
const longsword: ResolvedWeapon = { name: 'Longsword', source: 'XPHB', typeCode: 'M', weaponCategory: 'martial', dmg1: '1d8', dmg2: '1d10', dmgTypeFull: 'slashing', propertyFull: ['Versatile'] }
const dagger: ResolvedWeapon = { name: 'Dagger', source: 'XPHB', typeCode: 'M', weaponCategory: 'simple', dmg1: '1d4', dmgTypeFull: 'piercing', propertyFull: ['Finesse', 'Light', 'Thrown'], range: '20/60' }
const held = (weapon: ResolvedWeapon): HeldWeapon => ({ key: weapon.name, name: weapon.name, source: weapon.source, weapon, chosenAbility: null, magicBonus: noMagicBonus(weapon.name), grip: 'one-handed' })
const grants = [{ kind: 'category' as const, category: 'simple' }, { kind: 'category' as const, category: 'martial' }]
const named = (attacks: WeaponAttack[], name: string) => attacks.find((attack) => attack.name === name)!

const chainMail: EquippedArmour = { name: 'Chain Mail', category: 'heavy', ac: 16, strengthRequirement: null, stealthDisadvantage: true, magicBonus: noMagicBonus('Chain Mail') }
const leather: EquippedArmour = { name: 'Leather Armor', category: 'light', ac: 11, strengthRequirement: null, stealthDisadvantage: false, magicBonus: noMagicBonus('Leather Armor') }
const shield: EquippedShield = { name: 'Shield', acBonus: 2, magicBonus: noMagicBonus('Shield') }
const gear = (over: Partial<EquippedGear> = {}): EquippedGear => ({ armour: null, shield: null, unresolved: [], carriedArmourNotWorn: [], incompleteArmour: [], ...over })

describe('A2 Fighting Style', () => {
	it('Archery adds +2 to a ranged weapon only, as its own row', () => {
		const attacks = computeWeaponAttacks(character('Fighter', 1, {}, { fightingStyle: 'Archery' }), [held(longbow), held(longsword)], grants)
		const bow = named(attacks, 'Longbow').toHit
		expect(bow.status === 'known' && bow.value).toBe(3 + 2 + 2)
		expect(bow.status === 'known' && bow.breakdown).toContainEqual({ source: 'Archery (Fighting Style)', amount: 2 })
		const sword = named(attacks, 'Longsword').toHit
		expect(sword.status === 'known' && sword.breakdown.map((row) => row.source)).not.toContain('Archery (Fighting Style)')
	})

	it('Dueling and Thrown Weapon Fighting are named, not counted', () => {
		const dueling = named(computeWeaponAttacks(character('Fighter', 1, {}, { fightingStyle: 'Dueling' }), [held(longsword)], grants), 'Longsword').damage
		expect(dueling.status === 'known' && dueling.value.modifier).toBe(0)
		expect(dueling.status === 'known' && dueling.breakdown.find((row) => row.source === 'Dueling (Fighting Style)')?.note).toMatch(/not included/)
		const thrown = named(computeWeaponAttacks(character('Fighter', 1, {}, { fightingStyle: 'Thrown Weapon Fighting' }), [held(dagger)], grants), 'Dagger').damage
		expect(thrown.status === 'known' && thrown.breakdown.find((row) => row.source === 'Thrown Weapon Fighting (Fighting Style)')?.note).toMatch(/not included/)
	})

	it('Defense: +1 AC in armour (Chain Mail 17), nothing unarmoured', () => {
		const defender = character('Fighter', 1, {}, { fightingStyle: 'Defense' })
		const armoured = computeArmourClass(defender, gear({ armour: chainMail }))
		expect(armoured.status === 'known' && armoured.value.value).toBe(17)
		expect(armoured.status === 'known' && armoured.breakdown).toContainEqual({ source: 'Defense (Fighting Style)', amount: 1 })
		const bare = computeArmourClass(defender, gear())
		expect(bare.status === 'known' && bare.value.value).toBe(13)
	})
})

describe('A3 Martial Arts die on Monk weapons', () => {
	it('uses the larger of the weapon die and the Martial Arts die, with its own row', () => {
		const damage = named(computeWeaponAttacks(character('Monk', 5), [held(dagger), held(longsword)], grants, [], '1d8'), 'Dagger').damage
		expect(damage.status === 'known' && damage.value.text).toBe('1d8 + 3 piercing')
		expect(damage.status === 'known' && damage.breakdown[0]).toEqual({ source: 'Martial Arts die', amount: 0, note: '1d8 (in place of 1d4)' })
	})

	it('leaves a non-Monk weapon and a larger weapon die alone', () => {
		const attacks = computeWeaponAttacks(character('Monk', 1), [held(longsword)], grants, [], '1d6')
		const damage = named(attacks, 'Longsword').damage
		expect(damage.status === 'known' && damage.value.dice).toBe('1d8')
	})
})

describe('A4 speed from features', () => {
	it('Unarmored Movement only without armour and shield', () => {
		expect(featureSpeedAdjustments(['Unarmored Movement'], 15, null, null)).toEqual([{ source: 'Unarmored Movement', amount: 15 }])
		expect(featureSpeedAdjustments(['Unarmored Movement'], 15, null, shield)[0]).toMatchObject({ amount: 0, note: 'considered (+15 ft.) — not applied: not while wielding Shield' })
		expect(featureSpeedAdjustments(['Unarmored Movement'], 15, leather, null)[0]?.amount).toBe(0)
	})

	it('Fast Movement and Roving stop in heavy armour only; Speedy always applies', () => {
		expect(featureSpeedAdjustments(['Fast Movement', 'Roving', 'Speedy'], null, leather, null).map((row) => row.amount)).toEqual([10, 10, 10])
		expect(featureSpeedAdjustments(['Fast Movement', 'Roving', 'Speedy'], null, chainMail, null).map((row) => row.amount)).toEqual([0, 0, 10])
	})
})

describe('A5/A6 saving throws', () => {
	const classData: ClassSavingThrowProficiencies[] = [
		{ className: 'Monk', classSource: 'XPHB', abilities: ['str', 'dex'] },
		{ className: 'Rogue', classSource: 'XPHB', abilities: ['dex', 'int'] },
		{ className: 'Paladin', classSource: 'XPHB', abilities: ['wis', 'cha'] },
	]
	const value = (result: ReturnType<typeof computeSavingThrow>) => (result.status === 'known' ? result.value : null)

	it('Disciplined Survivor (Monk 14): every save, the source named once', () => {
		const monk = character('Monk', 14)
		expect(value(computeSavingThrow('wisdom', monk, classData))?.status).toBe('proficient')
		const dex = computeSavingThrow('dexterity', monk, classData)
		expect(dex.status === 'known' && dex.breakdown[1]).toEqual({ source: 'proficiency (Monk, class feature (Disciplined Survivor))', amount: 5 })
		expect(value(computeSavingThrow('wisdom', character('Monk', 13), classData))?.status).toBe('none')
	})

	it('Slippery Mind (Rogue 15): Wis and Cha; Rogue 15 Wis 14 = +2 + PB 5', () => {
		const rogue = character('Rogue', 15, { wisdom: 14 })
		expect(value(computeSavingThrow('wisdom', rogue, classData))?.modifier).toBe(7)
		expect(value(computeSavingThrow('strength', rogue, classData))?.status).toBe('none')
	})

	it('Aura of Protection (Paladin 6): +Cha to every save, minimum +1', () => {
		const paladin = character('Paladin', 6, { charisma: 16 })
		const str = computeSavingThrow('strength', paladin, classData)
		expect(str.status === 'known' && str.breakdown).toContainEqual({ source: 'Aura of Protection (while conscious)', amount: 3 })
		const low = computeSavingThrow('strength', character('Paladin', 6, { charisma: 8 }), classData)
		expect(low.status === 'known' && low.breakdown).toContainEqual({ source: 'Aura of Protection (while conscious)', amount: 1 })
		const five = computeSavingThrow('strength', character('Paladin', 5, { charisma: 16 }), classData)
		expect(five.status === 'known' && five.breakdown.map((row) => row.source)).not.toContain('Aura of Protection (while conscious)')
	})
})

describe('A8 unarmed damage floor', () => {
	it('a flat 1 with a modifier below -1 reads 0', () => {
		expect(damageText(null, -2, 'bludgeoning')).toBe('0 bludgeoning')
		expect(damageText(null, -1, 'bludgeoning')).toBe('1 - 1 bludgeoning')
		const unarmed = named(computeWeaponAttacks(character('Fighter', 1, { strength: 6 }), [], grants), 'Unarmed Strike').damage
		expect(unarmed.status === 'known' && unarmed.value.text).toBe('0 bludgeoning')
	})
})

describe('A10 totalCharacterLevel', () => {
	it('sums every class', () => {
		expect(totalCharacterLevel([{ level: 3 }, { level: 2 }])).toBe(5)
		expect(totalCharacterLevel(undefined)).toBe(0)
	})
})

describe('A2-1 Magic Initiate instances', () => {
	it('one spellcasting entry per instance, each with its own ability', () => {
		const human = character('Fighter', 1, { intelligence: 16, wisdom: 10 })
		const spell = { source: 'XPHB', level: 1, ritual: false, concentration: false, origin: 'feat' as const, featName: 'Magic Initiate' }
		const result = computeFeatSpellcasting(human, [
			{ ...spell, name: 'Guiding Bolt', featInstance: 'species' as const, ability: 'wis' as const },
			{ ...spell, name: 'Magic Missile', featInstance: 'background' as const, ability: 'int' as const },
		])
		expect(result.status === 'known' && result.value.map((entry) => [entry.featKey, entry.spellAttackBonus, entry.spellSaveDC])).toEqual([
			['species', 2, 10],
			['background', 5, 13],
		])
	})

	it('an instance without an ability does not hide the other', () => {
		const spell = { source: 'XPHB', level: 1, ritual: false, concentration: false, origin: 'feat' as const, featName: 'Magic Initiate' }
		const result = computeFeatSpellcasting(character('Fighter', 1), [
			{ ...spell, name: 'Guiding Bolt', featInstance: 'species' as const },
			{ ...spell, name: 'Magic Missile', featInstance: 'background' as const, ability: 'int' as const },
		])
		expect(result.status === 'known' && result.value.map((entry) => entry.featKey)).toEqual(['background'])
	})

	it('counter key per instance; a count under the old key is still read', () => {
		const once = { kind: 'onceFreePerLongRest' as const }
		const spells = [
			{
				name: 'Cure Wounds',
				source: 'XPHB',
				grants: [
					{ origin: 'feat', originName: 'Magic Initiate', usage: once, instanceKey: 'species' },
					{ origin: 'feat', originName: 'Magic Initiate', usage: once, instanceKey: 'background' },
				],
			},
		]
		expect(freeCastCounter(spells[0]!, spells[0]!.grants[0]!)).toEqual({
			key: 'spell:feat:Magic Initiate#species:cure wounds|XPHB',
			cost: 1,
			legacyKey: 'spell:feat:Magic Initiate:cure wounds|XPHB',
		})
		expect(withLegacyFreeCastUses({ 'spell:feat:Magic Initiate:cure wounds|XPHB': 1, Rage: 2 }, spells)).toEqual({
			'spell:feat:Magic Initiate#species:cure wounds|XPHB': 1,
			'spell:feat:Magic Initiate#background:cure wounds|XPHB': 1,
			Rage: 2,
		})
		expect(withLegacyFreeCastUses({ 'spell:feat:Magic Initiate:cure wounds|XPHB': 1, 'spell:feat:Magic Initiate#species:cure wounds|XPHB': 0 }, spells)).toEqual({
			'spell:feat:Magic Initiate#species:cure wounds|XPHB': 0,
			'spell:feat:Magic Initiate#background:cure wounds|XPHB': 1,
		})
	})
})

describe('A2-3 Aberrant Dragonmark', () => {
	it('its 1st-level pick is free once per Short or Long Rest and also slot-castable (EFA)', () => {
		expect(chosenSpellUsageFor('Aberrant Dragonmark')).toEqual({ kind: 'onceFreePerShortOrLongRest' })
		expect(alsoCastableWithSlot('Aberrant Dragonmark')).toBe(true)
	})
})
