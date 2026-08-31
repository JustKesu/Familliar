import { describe, expect, it } from 'vitest'
import type { Character } from '../storage/character'
import type { WeaponProficiencyGrant } from '../weapons/weaponProficiency'
import { computeAttacksPerAction, computeWeaponAttacks, UNARMED_STRIKE_KEY, type HeldWeapon, type ResolvedWeapon, type WeaponAttack } from './weaponAttacks'

/** STR 16 (+3), DEX 14 (+2), PB +2 at level 1. */
const scores: Character['abilityScores'] = {
	method: 'standardArray',
	scores: { strength: 16, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 },
}

/** DEX 18 (+4) beats STR 12 (+1) — the finesse default. */
const nimbleScores: Character['abilityScores'] = {
	method: 'standardArray',
	scores: { strength: 12, dexterity: 18, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 },
}

function character(className: string, level: number, abilityScores = scores): Character {
	return {
		id: '1',
		name: className,
		classes: [{ className, classSource: 'XPHB', subclass: null, level }],
		abilityScores,
	}
}

/* Field values copied from items.json via scripts/investigate-weapon-attack-fields.js. */
const longsword: ResolvedWeapon = {
	name: 'Longsword',
	source: 'XPHB',
	typeCode: 'M',
	weaponCategory: 'martial',
	dmg1: '1d8',
	dmg2: '1d10',
	dmgTypeFull: 'slashing',
	propertyFull: ['Versatile'],
	masteryFull: ['Sap'],
}

const rapier: ResolvedWeapon = {
	name: 'Rapier',
	source: 'XPHB',
	typeCode: 'M',
	weaponCategory: 'martial',
	dmg1: '1d8',
	dmgTypeFull: 'piercing',
	propertyFull: ['Finesse'],
	masteryFull: ['Vex'],
}

const javelin: ResolvedWeapon = {
	name: 'Javelin',
	source: 'XPHB',
	typeCode: 'M',
	weaponCategory: 'simple',
	dmg1: '1d6',
	dmgTypeFull: 'piercing',
	propertyFull: ['Thrown'],
	masteryFull: ['Slow'],
	range: '30/120',
}

const shortbow: ResolvedWeapon = {
	name: 'Shortbow',
	source: 'XPHB',
	typeCode: 'R',
	weaponCategory: 'simple',
	dmg1: '1d6',
	dmgTypeFull: 'piercing',
	propertyFull: ['Ammunition', 'Two-Handed'],
	masteryFull: ['Vex'],
	range: '80/320',
}

const martialGrants: WeaponProficiencyGrant[] = [
	{ kind: 'category', category: 'simple' },
	{ kind: 'category', category: 'martial' },
]

function held(weapon: ResolvedWeapon, chosenAbility: HeldWeapon['chosenAbility'] = null): HeldWeapon {
	return { name: weapon.name, source: weapon.source, weapon, chosenAbility }
}

function attackNamed(attacks: WeaponAttack[], name: string): WeaponAttack {
	const found = attacks.find((attack) => attack.name === name)
	if (!found) throw new Error(`no attack named ${name}`)
	return found
}

function toHitOf(attack: WeaponAttack): number | string {
	return attack.toHit.status === 'known' ? attack.toHit.value : attack.toHit.reason
}

function damageTextOf(attack: WeaponAttack): string | null {
	return attack.damage.status === 'known' ? attack.damage.value.text : null
}

describe('computeWeaponAttacks — proficiency', () => {
	it('adds the proficiency bonus for a fighter proficient with a longsword', () => {
		const attacks = computeWeaponAttacks(character('Fighter', 1), [held(longsword)], martialGrants)
		const attack = attackNamed(attacks, 'Longsword')
		expect(toHitOf(attack)).toBe(5)
		expect(attack.toHit.status === 'known' && attack.toHit.breakdown).toEqual([
			{ source: 'strength modifier', amount: 3 },
			{ source: 'proficiency bonus', amount: 2 },
		])
		expect(attack.notes).not.toContain('Not proficient — no proficiency bonus on the attack roll')
	})

	it('withholds the proficiency bonus from a wizard holding the same longsword, and says why', () => {
		const wizardGrants: WeaponProficiencyGrant[] = [{ kind: 'category', category: 'simple' }]
		const attacks = computeWeaponAttacks(character('Wizard', 1), [held(longsword)], wizardGrants)
		const attack = attackNamed(attacks, 'Longsword')
		expect(toHitOf(attack)).toBe(3)
		expect(attack.toHit.status === 'known' && attack.toHit.breakdown[1]).toEqual({
			source: 'proficiency bonus',
			amount: 0,
			note: 'not proficient with Longsword',
		})
		expect(attack.notes).toContain('Not proficient — no proficiency bonus on the attack roll')
		// Damage never takes the proficiency bonus either way (SPEC section B).
		expect(damageTextOf(attack)).toBe('1d8 + 3 slashing')
	})
})

describe('computeWeaponAttacks — finesse', () => {
	it('defaults to whichever of Strength and Dexterity is higher', () => {
		const strong = attackNamed(computeWeaponAttacks(character('Rogue', 1), [held(rapier)], martialGrants), 'Rapier')
		expect(strong.abilityChoice).toEqual({ using: 'strength', options: ['strength', 'dexterity'], isDefault: true })
		expect(toHitOf(strong)).toBe(5)

		const nimble = attackNamed(computeWeaponAttacks(character('Rogue', 1, nimbleScores), [held(rapier)], martialGrants), 'Rapier')
		expect(nimble.abilityChoice).toEqual({ using: 'dexterity', options: ['strength', 'dexterity'], isDefault: true })
		expect(toHitOf(nimble)).toBe(6)
		expect(damageTextOf(nimble)).toBe('1d8 + 4 piercing')
	})

	it('uses the player’s stored pick over the default, and marks it as no longer the default', () => {
		const switched = attackNamed(computeWeaponAttacks(character('Rogue', 1, nimbleScores), [held(rapier, 'strength')], martialGrants), 'Rapier')
		expect(switched.abilityChoice).toEqual({ using: 'strength', options: ['strength', 'dexterity'], isDefault: false })
		expect(toHitOf(switched)).toBe(3)
		expect(damageTextOf(switched)).toBe('1d8 + 1 piercing')
	})

	it('offers no choice on a weapon without Finesse', () => {
		expect(attackNamed(computeWeaponAttacks(character('Fighter', 1), [held(longsword)], martialGrants), 'Longsword').abilityChoice).toBeNull()
	})
})

describe('computeWeaponAttacks — weapon properties', () => {
	it('shows a versatile weapon’s two-handed damage as a second figure', () => {
		const attack = attackNamed(computeWeaponAttacks(character('Fighter', 1), [held(longsword)], martialGrants), 'Longsword')
		expect(damageTextOf(attack)).toBe('1d8 + 3 slashing')
		expect(attack.damage.status === 'known' && attack.damage.value.twoHandedText).toBe('1d10 + 3 slashing')
		expect(attack.damage.status === 'known' && attack.damage.breakdown).toEqual([
			{ source: 'Longsword damage dice', amount: 0, note: '1d8' },
			{ source: 'strength modifier', amount: 3 },
			{ source: 'two-handed (Versatile)', amount: 0, note: '1d10' },
		])
	})

	it('shows a thrown weapon’s range as the data writes it, and a plain melee weapon none', () => {
		const attacks = computeWeaponAttacks(character('Fighter', 1), [held(javelin), held(longsword)], martialGrants)
		expect(attackNamed(attacks, 'Javelin').range).toBe('30/120')
		expect(attackNamed(attacks, 'Longsword').range).toBeNull()
	})

	it('attacks with Dexterity with a ranged weapon and lists its mastery and properties', () => {
		const attack = attackNamed(computeWeaponAttacks(character('Fighter', 1), [held(shortbow)], martialGrants), 'Shortbow')
		expect(toHitOf(attack)).toBe(4)
		expect(damageTextOf(attack)).toBe('1d6 + 2 piercing')
		expect(attack.range).toBe('80/320')
		expect(attack.notes).toEqual(['Mastery: Vex', 'Properties: Ammunition, Two-Handed'])
	})
})

describe('computeWeaponAttacks — unarmed strike', () => {
	it('is always present, proficient, and does 1 + Strength bludgeoning', () => {
		const attacks = computeWeaponAttacks(character('Fighter', 1), [], [])
		expect(attacks).toHaveLength(1)
		const unarmed = attacks[0]
		expect(unarmed.key).toBe(UNARMED_STRIKE_KEY)
		expect(unarmed.name).toBe('Unarmed Strike')
		expect(toHitOf(unarmed)).toBe(5)
		expect(damageTextOf(unarmed)).toBe('1 + 3 bludgeoning')
		expect(unarmed.notes).toEqual([])
	})

	it('takes the Monk’s Martial Arts die in place of the flat 1', () => {
		const attacks = computeWeaponAttacks(character('Monk', 5), [], [], [], '1d8')
		const unarmed = attacks[0]
		expect(damageTextOf(unarmed)).toBe('1d8 + 3 bludgeoning')
		expect(unarmed.damage.status === 'known' && unarmed.damage.breakdown[0]).toEqual({ source: 'Martial Arts die', amount: 0, note: '1d8' })
		expect(unarmed.notes).toEqual(['Martial Arts die (Monk): 1d8'])
	})

	it('comes last, after the weapons in hand', () => {
		const attacks = computeWeaponAttacks(character('Fighter', 1), [held(longsword)], martialGrants)
		expect(attacks.map((attack) => attack.name)).toEqual(['Longsword', 'Unarmed Strike'])
	})
})

describe('computeWeaponAttacks — missing data (D43)', () => {
	it('names a held weapon the item data does not know instead of dropping it or crashing', () => {
		const attacks = computeWeaponAttacks(character('Fighter', 1), [{ name: 'Sword of Nothing', source: 'HOMEBREW', weapon: null, chosenAbility: null }], martialGrants)
		const attack = attacks[0]
		expect(attack.name).toBe('Sword of Nothing')
		expect(attack.toHit.status).toBe('unknown')
		expect(attack.damage.status).toBe('unknown')
		expect(attack.notes).toEqual(['"Sword of Nothing" (HOMEBREW) is held but was not found in the item data.'])
		// The unarmed strike is still worked out — one bad row does not take the section with it.
		expect(attacks[1].toHit.status).toBe('known')
	})

	it('reports every attack as unresolved when ability scores have not been set', () => {
		const noScores: Character = { id: '1', name: 'Blank', classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 1 }] }
		const attacks = computeWeaponAttacks(noScores, [held(longsword)], martialGrants)
		expect(attacks.map((attack) => attack.toHit.status)).toEqual(['unknown', 'unknown'])
	})
})

describe('computeAttacksPerAction', () => {
	it('gives one attack to a character with no Extra Attack feature', () => {
		const result = computeAttacksPerAction(['Second Wind', 'Action Surge'])
		expect(result).toMatchObject({ status: 'known', value: 1 })
		expect(result.status === 'known' && result.breakdown).toEqual([{ source: 'the Attack action', amount: 1 }])
	})

	it('gives a fighter at level 11 three attacks and says which feature lost', () => {
		const result = computeAttacksPerAction(['Extra Attack', 'Two Extra Attacks'])
		expect(result).toMatchObject({ status: 'known', value: 3 })
		expect(result.status === 'known' && result.breakdown).toEqual([
			{ source: 'the Attack action', amount: 1 },
			{ source: 'Two Extra Attacks', amount: 2 },
			{ source: 'Extra Attack', amount: 0, note: 'considered (2 attacks) — not applied: Two Extra Attacks gives 3' },
		])
	})

	it('gives two attacks for Extra Attack alone', () => {
		expect(computeAttacksPerAction(['Extra Attack'])).toMatchObject({ status: 'known', value: 2 })
	})
})
