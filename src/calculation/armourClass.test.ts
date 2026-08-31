import { describe, expect, it } from 'vitest'
import type { Character } from '../storage/character'
import { armourSpeedPenalty, computeArmourClass, type EquippedArmour, type EquippedGear, type EquippedShield } from './armourClass'
import { computeSpeed, type SpeciesTraitsData } from './speciesTraits'

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

/** DEX 16 (+3), CON 16 (+3), WIS 14 (+2), CHA 14 (+2). */
const nimble: Character['abilityScores'] = {
	method: 'standardArray',
	scores: { strength: 10, dexterity: 16, constitution: 16, intelligence: 8, wisdom: 14, charisma: 14 },
}

const chainMail: EquippedArmour = { name: 'Chain Mail', category: 'heavy', ac: 16, strengthRequirement: 13, stealthDisadvantage: true }
const leather: EquippedArmour = { name: 'Leather Armor', category: 'light', ac: 11, strengthRequirement: null, stealthDisadvantage: false }
const halfPlate: EquippedArmour = { name: 'Half Plate Armor', category: 'medium', ac: 15, strengthRequirement: null, stealthDisadvantage: true }
const shield: EquippedShield = { name: 'Shield', acBonus: 2 }

function gear(overrides: Partial<EquippedGear> = {}): EquippedGear {
	return { armour: null, shield: null, unresolved: [], carriedArmourNotWorn: [], ...overrides }
}

function sources(result: ReturnType<typeof computeArmourClass>): string[] {
	return result.status === 'known' ? result.breakdown.map((row) => row.source) : []
}

function noteFor(result: ReturnType<typeof computeArmourClass>, source: string): string | undefined {
	return result.status === 'known' ? result.breakdown.find((row) => row.source === source)?.note : undefined
}

describe('computeArmourClass — worn armour', () => {
	it('adds base AC plus the shield bonus, never the shield ac as a total', () => {
		const result = computeArmourClass(fighter5, gear({ armour: chainMail, shield }))
		expect(result).toMatchObject({ status: 'known', value: { value: 18 } })
		expect(result.status === 'known' && result.breakdown).toEqual([
			{ source: 'Chain Mail (heavy armour)', amount: 16 },
			{ source: 'dexterity modifier', amount: 0, note: 'heavy armour allows no Dexterity bonus' },
			{ source: 'Shield', amount: 2 },
		])
	})

	it('light armour takes the whole Dexterity modifier', () => {
		const result = computeArmourClass({ ...fighter5, abilityScores: nimble }, gear({ armour: leather }))
		expect(result).toMatchObject({ status: 'known', value: { value: 14 } })
		expect(noteFor(result, 'dexterity modifier')).toBeUndefined()
	})

	it('medium armour caps the Dexterity modifier at +2 and says so', () => {
		const result = computeArmourClass({ ...fighter5, abilityScores: nimble }, gear({ armour: halfPlate }))
		expect(result).toMatchObject({ status: 'known', value: { value: 17 } })
		expect(noteFor(result, 'dexterity modifier')).toBe('capped at +2 by medium armour')
	})

	it('reports the Stealth penalty without computing anything from it', () => {
		const worn = computeArmourClass(fighter5, gear({ armour: halfPlate }))
		expect(worn).toMatchObject({ status: 'known', value: { value: 17, stealthDisadvantage: ['Half Plate Armor'] } })
		const bare = computeArmourClass(fighter5, gear({ armour: leather }))
		expect(bare).toMatchObject({ status: 'known', value: { stealthDisadvantage: [] } })
	})

	it('returns unknown when ability scores have not been set (D43)', () => {
		expect(computeArmourClass({ id: '2', name: 'Blank', classes: [] }, gear()).status).toBe('unknown')
	})
})

describe('computeArmourClass — no armour', () => {
	it('is 10 + Dex and the breakdown says no armour is equipped', () => {
		const result = computeArmourClass(fighter5, gear())
		expect(result).toMatchObject({ status: 'known', value: { value: 12 } })
		expect(noteFor(result, 'armour')).toBe('no armour equipped')
	})

	it('armour that is owned but not worn changes nothing, and the breakdown names it', () => {
		const result = computeArmourClass(fighter5, gear({ carriedArmourNotWorn: ['Chain Mail'] }))
		expect(result).toMatchObject({ status: 'known', value: { value: 12 } })
		expect(noteFor(result, 'armour')).toBe('no armour equipped — Chain Mail is carried but not worn')
	})
})

describe('computeArmourClass — alternative formulas', () => {
	const barbarian: Character = { ...fighter5, abilityScores: nimble, classes: [{ className: 'Barbarian', classSource: 'XPHB', subclass: null, level: 3 }] }

	it("a Barbarian's Unarmored Defense beats the plain unarmoured number", () => {
		const result = computeArmourClass(barbarian, gear(), ['barbarian-unarmored-defense'])
		expect(result).toMatchObject({ status: 'known', value: { value: 16 } })
		expect(sources(result)).toEqual(['Unarmored Defense (Barbarian) base', 'dexterity modifier', 'constitution modifier', 'unarmoured'])
		expect(noteFor(result, 'unarmoured')).toContain('10 + Dex = 13')
	})

	it("a Monk's Unarmored Defense likewise, and a shield rules it out", () => {
		const monk: Character = { ...barbarian, classes: [{ className: 'Monk', classSource: 'XPHB', subclass: null, level: 3 }] }
		expect(computeArmourClass(monk, gear(), ['monk-unarmored-defense'])).toMatchObject({ status: 'known', value: { value: 15 } })

		const withShield = computeArmourClass(monk, gear({ shield }), ['monk-unarmored-defense'])
		expect(withShield).toMatchObject({ status: 'known', value: { value: 15 } })
		expect(noteFor(withShield, 'Unarmored Defense (Monk)')).toContain('not available while wielding Shield')
	})

	it('a character eligible for two formulas takes the better one, with both in the breakdown', () => {
		// Barbarian 1 / Sorcerer 3 (Draconic): 10+3+3 = 16 beats 10+3+2 = 15.
		const both: Character = {
			...barbarian,
			classes: [
				{ className: 'Barbarian', classSource: 'XPHB', subclass: null, level: 1 },
				{ className: 'Sorcerer', classSource: 'XPHB', subclass: 'Draconic Sorcery', level: 3 },
			],
		}
		const result = computeArmourClass(both, gear(), ['barbarian-unarmored-defense', 'draconic-resilience'])
		expect(result).toMatchObject({ status: 'known', value: { value: 16 } })
		expect(noteFor(result, 'Draconic Resilience')).toBe('considered (10 + Dex + Cha = 15) — not applied: Unarmored Defense (Barbarian) gives 16')
		expect(noteFor(result, 'unarmoured')).toContain('not applied')
	})

	it('Mage Armor is considered but never applied — a prepared spell is not a cast one', () => {
		const wizard: Character = { ...fighter5, abilityScores: nimble }
		const result = computeArmourClass(wizard, gear(), ['mage-armor'])
		expect(result).toMatchObject({ status: 'known', value: { value: 13 } })
		expect(noteFor(result, 'Mage Armor')).toBe('considered (13 + Dex = 16) — not applied: only while the spell is cast, which this app does not track yet')
	})

	it('an eligible formula is still listed when armour rules it out', () => {
		const result = computeArmourClass(barbarian, gear({ armour: chainMail }), ['barbarian-unarmored-defense'])
		expect(result).toMatchObject({ status: 'known', value: { value: 16 } })
		expect(noteFor(result, 'Unarmored Defense (Barbarian)')).toContain('not available while wearing Chain Mail')
	})
})

describe('computeArmourClass — unresolvable equipped item (D43)', () => {
	it('still produces a number, names the item and marks the result incomplete', () => {
		const result = computeArmourClass(fighter5, gear({ shield, unresolved: [{ name: 'Mystery Plate', source: 'HOMEBREW' }] }))
		expect(result).toMatchObject({ status: 'known', value: { value: 14, incomplete: ['Mystery Plate (HOMEBREW)'] } })
		expect(noteFor(result, 'Mystery Plate (HOMEBREW)')).toContain('not found in the item data')
	})
})

describe('armourSpeedPenalty', () => {
	const species: SpeciesTraitsData[] = [{ name: 'Human', source: 'XPHB', speed: 30, size: ['M'] }]
	const human: Character = { ...fighter5, species: { name: 'Human', source: 'XPHB' } }

	it('costs 10 feet when heavy armour is worn without the Strength it requires, with the reason in the speed breakdown', () => {
		// STR 10 against Chain Mail's requirement of 13.
		const weak: Character = { ...human, abilityScores: { ...fighter5.abilityScores!, scores: { ...fighter5.abilityScores!.scores, strength: 10 } } }
		const penalty = armourSpeedPenalty(weak, chainMail)
		expect(penalty).toEqual([{ source: 'Chain Mail (Strength 13 required, you have 10)', amount: -10 }])

		expect(computeSpeed(weak, species, penalty)).toEqual({
			status: 'known',
			value: { walk: 20 },
			breakdown: [
				{ source: 'Human', amount: 30 },
				{ source: 'Chain Mail (Strength 13 required, you have 10)', amount: -10 },
			],
		})
	})

	it('costs nothing when the Strength requirement is met, when the armour is not heavy, and when nothing is worn', () => {
		expect(armourSpeedPenalty(human, chainMail)).toEqual([])
		expect(armourSpeedPenalty(human, halfPlate)).toEqual([])
		expect(armourSpeedPenalty(human, null)).toEqual([])
		expect(computeSpeed(human, species)).toMatchObject({ status: 'known', value: { walk: 30 } })
	})
})
