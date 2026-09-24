import { describe, expect, it } from 'vitest'
import type { Character, CharacterClassFeatureChoice } from '../storage/character'
import { computeProficiencies, extractFeatProficiencyEntries, type Proficiencies } from './proficiencies'

const MONK_PROSE = 'Martial weapons that have the {@filter Light|items|type=martial weapon|property=light} property'
const ROGUE_PROSE = 'Martial weapons that have the {@filter Finesse or Light|items|type=martial weapon|property=finesse;light} property'

function classEntry(name: string, armor: string[] | undefined, weapons: string[]): unknown {
	return { entryType: 'class', name, source: 'XPHB', classFeatures: [], startingProficiencies: { ...(armor ? { armor } : {}), weapons } }
}

const CLASSES = [
	classEntry('Fighter', ['light', 'medium', 'heavy', 'shield'], ['simple', 'martial']),
	classEntry('Rogue', ['light'], ['simple', ROGUE_PROSE]),
	classEntry('Monk', undefined, ['simple', MONK_PROSE]),
	classEntry('Cleric', ['light', 'medium', 'shield'], ['simple']),
	classEntry('Druid', ['light', 'shield'], ['simple']),
	classEntry('Bard', ['light'], ['simple']),
	classEntry('Wizard', undefined, ['simple']),
]

const FEATS = extractFeatProficiencyEntries([
	{ name: 'Lightly Armored', source: 'XPHB', armorProficiencies: [{ light: true, shield: true }] },
	{ name: 'Moderately Armored', source: 'XPHB', armorProficiencies: [{ medium: true }] },
	{ name: 'Martial Weapon Training', source: 'XPHB', weaponProficiencies: [{ martial: true }] },
	{ name: 'Tavern Brawler', source: 'XPHB', weaponProficiencies: [{ improvised: true }] },
])

function character(className: string, options: { level?: number; subclass?: string; choices?: CharacterClassFeatureChoice[] } = {}): Character {
	return {
		id: 'c1',
		name: 'Test',
		classes: [{ className, classSource: 'XPHB', subclass: options.subclass ?? null, level: options.level ?? 1 }],
		classFeatureChoices: options.choices,
	}
}

function compute(c: Character, feats: string[] = []): Proficiencies {
	return computeProficiencies(c, CLASSES, feats.map((name) => ({ name, source: 'XPHB' })), FEATS)
}

const labels = (items: Proficiencies[keyof Proficiencies]) => items.map((item) => item.label)

describe('computeProficiencies', () => {
	it('Fighter: all armor and both weapon categories, from the class', () => {
		const result = compute(character('Fighter'))
		expect(labels(result.armor)).toEqual(['Light armor', 'Medium armor', 'Heavy armor', 'Shields'])
		expect(labels(result.weapons)).toEqual(['Simple weapons', 'Martial weapons'])
		expect(result.weapons[1].sources).toEqual([{ kind: 'class', name: 'Fighter' }])
	})

	it('Rogue: light armor, simple weapons and the Finesse-or-Light subset', () => {
		const result = compute(character('Rogue'))
		expect(labels(result.armor)).toEqual(['Light armor'])
		expect(labels(result.weapons)).toEqual(['Simple weapons', 'Martial weapons with the Finesse or Light property'])
	})

	it('Monk: no armor, simple weapons and the Light subset', () => {
		const result = compute(character('Monk'))
		expect(result.armor).toEqual([])
		expect(labels(result.weapons)).toEqual(['Simple weapons', 'Martial weapons with the Light property'])
	})

	it('Monk with Martial Weapon Training: the subset is dropped', () => {
		expect(labels(compute(character('Monk'), ['Martial Weapon Training']).weapons)).toEqual(['Simple weapons', 'Martial weapons'])
	})

	it('Cleric: Protector adds heavy armor and martial weapons, Thaumaturge does not', () => {
		const choice = (optionName: string) => [{ className: 'Cleric', classSource: 'XPHB', featureName: 'Divine Order', grantedAtLevel: 1, optionName }]
		const plain = compute(character('Cleric', { choices: choice('Thaumaturge') }))
		expect(labels(plain.armor)).toEqual(['Light armor', 'Medium armor', 'Shields'])
		expect(labels(plain.weapons)).toEqual(['Simple weapons'])

		const protector = compute(character('Cleric', { choices: choice('Protector') }))
		expect(labels(protector.armor)).toEqual(['Light armor', 'Medium armor', 'Heavy armor', 'Shields'])
		expect(protector.armor[2].sources).toEqual([{ kind: 'classFeatureChoice', name: 'Cleric — Protector' }])
		expect(labels(protector.weapons)).toEqual(['Simple weapons', 'Martial weapons'])
	})

	it('Druid with Warden: medium armor and martial weapons', () => {
		const result = compute(character('Druid', { choices: [{ className: 'Druid', classSource: 'XPHB', featureName: 'Primal Order', grantedAtLevel: 1, optionName: 'Warden' }] }))
		expect(labels(result.armor)).toEqual(['Light armor', 'Medium armor', 'Shields'])
		expect(result.armor[1].sources.map((s) => s.name)).toEqual(['Druid — Warden'])
		expect(labels(result.weapons)).toEqual(['Simple weapons', 'Martial weapons'])
	})

	it('Bard College of Valor: Martial Training arrives at level 3, not 2', () => {
		expect(labels(compute(character('Bard', { level: 2, subclass: 'College of Valor' })).weapons)).toEqual(['Simple weapons'])
		const l3 = compute(character('Bard', { level: 3, subclass: 'College of Valor' }))
		expect(labels(l3.armor)).toEqual(['Light armor', 'Medium armor', 'Shields'])
		expect(labels(l3.weapons)).toEqual(['Simple weapons', 'Martial weapons'])
		expect(l3.weapons[1].sources).toEqual([{ kind: 'subclass', name: 'College of Valor' }])
	})

	it('Wizard with Lightly and Moderately Armored', () => {
		expect(compute(character('Wizard')).armor).toEqual([])
		const result = compute(character('Wizard'), ['Lightly Armored', 'Moderately Armored'])
		expect(labels(result.armor)).toEqual(['Light armor', 'Medium armor', 'Shields'])
		expect(result.armor[1].sources).toEqual([{ kind: 'feat', name: 'Moderately Armored (feat)' }])
	})

	it('the same proficiency from two sources is one entry listing both', () => {
		const result = compute(character('Fighter'), ['Martial Weapon Training'])
		expect(labels(result.weapons)).toEqual(['Simple weapons', 'Martial weapons'])
		expect(result.weapons[1].sources.map((s) => s.name)).toEqual(['Fighter', 'Martial Weapon Training (feat)'])
	})

	it('Tavern Brawler lists Improvised weapons last', () => {
		expect(labels(compute(character('Rogue'), ['Tavern Brawler']).weapons)).toEqual([
			'Simple weapons',
			'Martial weapons with the Finesse or Light property',
			'Improvised weapons',
		])
	})
})
