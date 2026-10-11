import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { computeSavingThrow, type ClassSavingThrowProficiencies } from '../calculation/savingThrows'
import type { FeatEffectEntry } from '../calculation/featEffects'
import type { Character } from '../storage/character'
import { describeKenseiWeaponsError, describeStoredCharacterError, toCharacter } from '../storage/validate'
import { heldKenseiWeapons, kenseiSlotsFilled, kenseiSlotsFor, kenseiWeaponOptions, kenseiWeaponsOwed } from './kensei'

const items: unknown = JSON.parse(readFileSync(join(__dirname, '..', '..', 'data', 'items.json'), 'utf8'))

describe('kenseiWeaponOptions (D344)', () => {
	const options = kenseiWeaponOptions(items)

	it('offers every ordinary simple/martial weapon without Heavy, plus the Longbow', () => {
		expect(options).toHaveLength(41)
		expect(options.filter((option) => option.ranged)).toHaveLength(17)
	})

	it('keeps the Longbow (Heavy in the data, allowed by the feature text) and drops the Greatsword', () => {
		expect(options).toContainEqual({ name: 'Longbow', ranged: true })
		expect(options.map((option) => option.name)).not.toContain('Greatsword')
		expect(options.map((option) => option.name)).not.toContain('Heavy Crossbow')
		expect(options).toContainEqual({ name: 'Longsword', ranged: false })
	})
})

describe('Kensei slots', () => {
	const monk = (level: number, subclass: string | null = 'Way of the Kensei') => [{ className: 'Monk', classSource: 'XPHB', subclass, level }]

	it('grows at Monk 3, 6, 11 and 17', () => {
		expect(kenseiSlotsFor(monk(2, null))).toHaveLength(0)
		expect(kenseiSlotsFor(monk(3)).map((slot) => slot.kind)).toEqual(['melee', 'ranged'])
		expect(kenseiSlotsFor(monk(6))).toHaveLength(3)
		expect(kenseiSlotsFor(monk(17))).toHaveLength(5)
		expect(kenseiSlotsFor(monk(6, 'Warrior of Shadow'))).toHaveLength(0)
	})

	it('counts only picks whose level the Monk has reached', () => {
		const picks = [
			{ name: 'Longsword', level: 3 },
			{ name: 'Longbow', level: 3 },
			{ name: 'Spear', level: 6 },
		]
		expect(heldKenseiWeapons(monk(5), picks).map((pick) => pick.name)).toEqual(['Longsword', 'Longbow'])
		expect(kenseiWeaponsOwed(monk(6), picks.slice(0, 2))).toBe(1)
		expect(kenseiSlotsFilled(kenseiSlotsFor(monk(6)), picks)).toBe(true)
		expect(kenseiSlotsFilled(kenseiSlotsFor(monk(6)), picks.slice(1))).toBe(false)
	})
})

describe('validation (schema 61)', () => {
	const record = { schemaVersion: 61, id: '1', name: 'Aria', classes: [{ className: 'Monk', classSource: 'XPHB', subclass: 'Way of the Kensei', level: 6 }] }

	it('accepts level-stamped picks and refuses bad shapes', () => {
		expect(describeKenseiWeaponsError(undefined)).toBeNull()
		expect(describeKenseiWeaponsError([{ name: 'Longsword', level: 3 }])).toBeNull()
		expect(describeKenseiWeaponsError('x')).toMatch(/not an array/)
		expect(describeKenseiWeaponsError([{ name: '', level: 3 }])).toMatch(/name/)
		expect(describeKenseiWeaponsError([{ name: 'Longsword', level: 4 }])).toMatch(/level/)
	})

	it('validates and reads both fields', () => {
		const stored = { ...record, kenseiWeapons: [{ name: 'Longsword', level: 3 }], elegantCourtierSave: 'charisma' }
		expect(describeStoredCharacterError(stored, 0)).toBeNull()
		expect(toCharacter(stored)).toMatchObject({ kenseiWeapons: [{ name: 'Longsword', level: 3 }], elegantCourtierSave: 'charisma' })
		expect(describeStoredCharacterError({ ...record, elegantCourtierSave: 'wisdom' }, 0)).toMatch(/elegantCourtierSave/)
	})
})

describe('Elegant Courtier save (D344)', () => {
	const classData: ClassSavingThrowProficiencies[] = [{ className: 'Fighter', classSource: 'XPHB', abilities: ['str', 'con'] }]
	const resilient = { name: 'Resilient', source: 'XPHB', savingThrowProficiencies: [{ choose: { from: ['wis'] } }] } as unknown as FeatEffectEntry
	const fighter = (level: number, extra: Partial<Character> = {}): Character => ({
		id: 'f',
		name: 'F',
		classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Samurai', level }],
		abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 } },
		...extra,
	})
	const proficient = (character: Character, ability: 'wisdom' | 'intelligence' | 'charisma', feats: FeatEffectEntry[] = []) => {
		const result = computeSavingThrow(ability, character, classData, feats)
		return result.status === 'known' ? result.value.status : 'unknown'
	}
	const withResilient = (extra: Partial<Character> = {}) =>
		fighter(7, { featAsiChoices: [{ level: 4, kind: 'feat', name: 'Resilient', source: 'XPHB', chosenAbility: 'wisdom' }], ...extra })

	it('grants Wisdom at Fighter 7, not at 6', () => {
		expect(proficient(fighter(6), 'wisdom')).toBe('none')
		expect(proficient(fighter(7), 'wisdom')).toBe('proficient')
		const breakdown = computeSavingThrow('wisdom', fighter(7), classData)
		expect(breakdown.status === 'known' && breakdown.breakdown.some((row) => row.source === 'proficiency (Elegant Courtier)')).toBe(true)
	})

	it('with Wisdom already held, grants the stored Intelligence or Charisma pick instead', () => {
		expect(proficient(withResilient(), 'charisma', [resilient])).toBe('none')
		expect(proficient(withResilient({ elegantCourtierSave: 'charisma' }), 'charisma', [resilient])).toBe('proficient')
		expect(proficient(withResilient({ elegantCourtierSave: 'charisma' }), 'intelligence', [resilient])).toBe('none')
	})

	it('ignores a stored pick while Wisdom is not held from elsewhere', () => {
		expect(proficient(fighter(7, { elegantCourtierSave: 'charisma' }), 'charisma')).toBe('none')
		expect(proficient(fighter(7, { elegantCourtierSave: 'charisma' }), 'wisdom')).toBe('proficient')
	})
})
