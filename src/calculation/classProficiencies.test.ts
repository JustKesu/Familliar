import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import type { Character } from '../storage/character'
import { isProficientWithWeapon, weaponProficiencyGrantsFor } from '../weapons/weaponProficiency'
import { computeProficiencies, type ProficiencyItem } from './proficiencies'

const CLASSES: unknown = JSON.parse(readFileSync(join(__dirname, '..', '..', 'data', 'classes.json'), 'utf8'))

function multiclass(...entries: [string, number][]): Character {
	return {
		id: 'mc',
		name: 'Multiclass',
		classes: [...entries].reverse().map(([className, level]) => ({ className, classSource: 'XPHB', subclass: null, level })),
		levelOrder: entries.flatMap(([className, level]) => Array.from({ length: level }, () => ({ className, classSource: 'XPHB' }))),
	}
}

const rows = (items: ProficiencyItem[]) => Object.fromEntries(items.map((item) => [item.key, item.sources.map((source) => source.name)]))

describe('D321: class proficiencies of a multiclass character', () => {
	it('Fighter first: every Fighter starting proficiency, nothing from Wizard', () => {
		const result = computeProficiencies(multiclass(['Fighter', 1], ['Wizard', 1]), CLASSES, [], [])
		expect(rows(result.armor)).toEqual({ light: ['Fighter'], medium: ['Fighter'], heavy: ['Fighter'], shield: ['Fighter'] })
		expect(rows(result.weapons)).toEqual({ simple: ['Fighter'], martial: ['Fighter'] })
	})

	it('Wizard first: Wizard starting plus light, medium, shield and martial from Fighter', () => {
		const result = computeProficiencies(multiclass(['Wizard', 1], ['Fighter', 1]), CLASSES, [], [])
		expect(rows(result.armor)).toEqual({ light: ['Fighter (multiclass)'], medium: ['Fighter (multiclass)'], shield: ['Fighter (multiclass)'] })
		expect(rows(result.weapons)).toEqual({ simple: ['Wizard'], martial: ['Fighter (multiclass)'] })
	})

	it("Rogue second adds only light armor and Thieves' Tools", () => {
		const result = computeProficiencies(multiclass(['Wizard', 1], ['Rogue', 1]), CLASSES, [], [])
		expect(rows(result.armor)).toEqual({ light: ['Rogue (multiclass)'] })
		expect(rows(result.weapons)).toEqual({ simple: ['Wizard'] })
		expect(rows(result.tools)).toEqual({ "thieves' tools": ['Rogue (multiclass)'] })
	})

	it('weapon attack proficiency matches the card for Wizard first + Rogue second', () => {
		const character = multiclass(['Wizard', 1], ['Rogue', 1])
		const grants = weaponProficiencyGrantsFor(character, CLASSES, [], null)
		const rapier = { name: 'Rapier', weaponCategory: 'martial', propertyFull: ['Finesse'], type: 'M|XPHB' }
		const dagger = { name: 'Dagger', weaponCategory: 'simple', propertyFull: ['Finesse', 'Light', 'Thrown'], type: 'M|XPHB' }
		expect(isProficientWithWeapon(rapier, grants)).toBe(false)
		expect(isProficientWithWeapon(dagger, grants)).toBe(true)
		expect(computeProficiencies(character, CLASSES, [], []).weapons.map((item) => item.key)).toEqual(['simple'])
	})

	it('a single-class character is unchanged', () => {
		const rogue = computeProficiencies(multiclass(['Rogue', 3]), CLASSES, [], [])
		expect(rows(rogue.armor)).toEqual({ light: ['Rogue'] })
		expect(rows(rogue.tools)).toEqual({ "thieves' tools": ['Rogue'] })
	})
})
