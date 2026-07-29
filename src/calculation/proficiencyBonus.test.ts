import { describe, expect, it } from 'vitest'
import type { CharacterClass } from '../storage/character'
import { computeProficiencyBonus, proficiencyBonusForLevel } from './proficiencyBonus'

describe('proficiencyBonusForLevel', () => {
	it('is +2 through level 4, +3 at the level 4/5 break', () => {
		expect(proficiencyBonusForLevel(1)).toBe(2)
		expect(proficiencyBonusForLevel(4)).toBe(2)
		expect(proficiencyBonusForLevel(5)).toBe(3)
		expect(proficiencyBonusForLevel(8)).toBe(3)
		expect(proficiencyBonusForLevel(9)).toBe(4)
		expect(proficiencyBonusForLevel(17)).toBe(6)
		expect(proficiencyBonusForLevel(20)).toBe(6)
	})
})

describe('computeProficiencyBonus', () => {
	it('is +3 for a Fighter 5 (D46 fixture)', () => {
		const classes: CharacterClass[] = [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 5 }]
		expect(computeProficiencyBonus(classes)).toEqual({
			status: 'known',
			value: 3,
			breakdown: [{ source: 'Fighter', amount: 5 }],
		})
	})

	it('is +2 for a Barbarian 1 (boundary level fixture)', () => {
		const classes: CharacterClass[] = [{ className: 'Barbarian', classSource: 'XPHB', subclass: null, level: 1 }]
		expect(computeProficiencyBonus(classes)).toEqual({
			status: 'known',
			value: 2,
			breakdown: [{ source: 'Barbarian', amount: 1 }],
		})
	})

	it('flips from +2 to +3 between Fighter 4 and Fighter 5', () => {
		const fighter4: CharacterClass[] = [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 4 }]
		const fighter5: CharacterClass[] = [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 5 }]
		const at4 = computeProficiencyBonus(fighter4)
		const at5 = computeProficiencyBonus(fighter5)
		expect(at4.status === 'known' && at4.value).toBe(2)
		expect(at5.status === 'known' && at5.value).toBe(3)
	})

	it('sums total level across multiple classes (D11)', () => {
		const classes: CharacterClass[] = [
			{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 3 },
			{ className: 'Rogue', classSource: 'XPHB', subclass: null, level: 2 },
		]
		expect(computeProficiencyBonus(classes)).toEqual({
			status: 'known',
			value: 3,
			breakdown: [
				{ source: 'Fighter', amount: 3 },
				{ source: 'Rogue', amount: 2 },
			],
		})
	})

	it('returns unknown when the character has no classes', () => {
		expect(computeProficiencyBonus([]).status).toBe('unknown')
	})
})
