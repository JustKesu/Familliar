import { describe, expect, it } from 'vitest'
import { computeProficiencies } from '../calculation/proficiencies'
import type { Character, CharacterClassFeatureChoice } from '../storage/character'
import { isProficientWithWeapon, weaponProficiencyGrantsFor } from './weaponProficiency'

function classEntry(name: string, source = 'XPHB'): unknown {
	return { entryType: 'class', name, source, classFeatures: [], startingProficiencies: { weapons: ['simple'] } }
}
function subclassEntry(className: string, name: string, source: string, classSource = 'XPHB'): unknown {
	return { entryType: 'subclass', className, classSource, name, shortName: name, source }
}

const CLASSES = [
	classEntry('Warlock'),
	classEntry('Cleric'),
	classEntry('Druid'),
	classEntry('Bard'),
	classEntry('Fighter'),
	classEntry('Artificer', 'EFA'),
	subclassEntry('Warlock', 'The Hexblade', 'XGE'),
	subclassEntry('Cleric', 'Twilight Domain', 'TCE'),
	subclassEntry('Bard', 'College of Swords', 'XGE'),
	subclassEntry('Artificer', 'Battle Smith', 'EFA', 'EFA'),
	subclassEntry('Artificer', 'Artillerist', 'EFA', 'EFA'),
]

const LONGSWORD = { name: 'Longsword', source: 'XPHB', typeCode: 'M', weaponCategory: 'martial' }
const SCIMITAR = { name: 'Scimitar', source: 'XPHB', typeCode: 'M', weaponCategory: 'martial' }
const LONGBOW = { name: 'Longbow', source: 'XPHB', typeCode: 'R', weaponCategory: 'martial' }
const RAW_LONGBOW = { name: 'Longbow', source: 'XPHB', type: 'R|XPHB', weaponCategory: 'martial' }

function make(className: string, level: number, options: { classSource?: string; subclass?: string; choices?: CharacterClassFeatureChoice[] } = {}): Character {
	return {
		id: 'c1',
		name: 'Test',
		classes: [{ className, classSource: options.classSource ?? 'XPHB', subclass: options.subclass ?? null, level }],
		classFeatureChoices: options.choices,
	}
}

const choice = (className: string, featureName: string, optionName: string): CharacterClassFeatureChoice[] => [
	{ className, classSource: 'XPHB', featureName, grantedAtLevel: 1, optionName },
]

const grantsOf = (c: Character) => weaponProficiencyGrantsFor(c, CLASSES, [], null)
const cardLabels = (c: Character) => computeProficiencies(c, CLASSES, [], []).weapons.map((item) => item.label)

const MARTIAL_CASES: [string, Character][] = [
	['Hexblade 3', make('Warlock', 3, { subclass: 'The Hexblade' })],
	['Twilight Domain 3', make('Cleric', 3, { subclass: 'Twilight Domain' })],
	['Divine Order: Protector', make('Cleric', 1, { choices: choice('Cleric', 'Divine Order', 'Protector') })],
	['Primal Order: Warden', make('Druid', 1, { choices: choice('Druid', 'Primal Order', 'Warden') })],
	['College of Valor 3', make('Bard', 3, { subclass: 'College of Valor' })],
	['Battle Smith 3', make('Artificer', 3, { classSource: 'EFA', subclass: 'Battle Smith' })],
]

describe('feature weapon grants reach attacks (D178)', () => {
	it.each(MARTIAL_CASES)('%s: a longsword is proficient, and the card lists Martial weapons', (_, c) => {
		expect(isProficientWithWeapon(LONGSWORD, grantsOf(c))).toBe(true)
		expect(cardLabels(c)).toContain('Martial weapons')
	})

	it('College of Swords: a scimitar and nothing else martial', () => {
		const c = make('Bard', 3, { subclass: 'College of Swords' })
		expect(isProficientWithWeapon(SCIMITAR, grantsOf(c))).toBe(true)
		expect(isProficientWithWeapon(LONGSWORD, grantsOf(c))).toBe(false)
		expect(cardLabels(c)).toContain('Scimitar')
	})

	it('Martial ranged weapons: a longbow, raw or resolved, but not a longsword', () => {
		const c = make('Artificer', 3, { classSource: 'EFA', subclass: 'Artillerist' })
		expect(isProficientWithWeapon(LONGBOW, grantsOf(c))).toBe(true)
		expect(isProficientWithWeapon(RAW_LONGBOW, grantsOf(c))).toBe(true)
		expect(isProficientWithWeapon(LONGSWORD, grantsOf(c))).toBe(false)
		expect(cardLabels(c)).toContain('Martial ranged weapons')
	})

	it('grants arrive at the level the card applies them: Hexblade 2 has nothing, on both', () => {
		const c = make('Warlock', 2, { subclass: 'The Hexblade' })
		expect(isProficientWithWeapon(LONGSWORD, grantsOf(c))).toBe(false)
		expect(cardLabels(c)).not.toContain('Martial weapons')
	})

	it('a character without these grants is unchanged', () => {
		const c = make('Fighter', 3)
		expect(grantsOf(c)).toEqual([{ kind: 'category', category: 'simple' }])
		expect(isProficientWithWeapon(LONGSWORD, grantsOf(c))).toBe(false)
	})
})
