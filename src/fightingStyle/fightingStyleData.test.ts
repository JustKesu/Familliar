import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { pickSourceLookup } from '../optionalFeatures/pickSources'
import { chosenOptionalFeatureOptions } from '../optionalFeatures/optionalFeatureData'
import { extractFeatGrantedSpells } from '../spells/featSpells'
import type { Character } from '../storage/character'
import { describeFightingStylesError } from '../storage/validate'
import { fightingStyleCategoriesFrom, fightingStyleOptionsFrom, isClassFightingStyleCategory } from './fightingStyleData'

/* FS-1 (D419): Paladin and Ranger also offer their class-only Fighting Style feat. */

const FEATS = [
	{ name: 'Defense', source: 'XPHB', category: 'FS', entries: ['Defense text.'] },
	{ name: 'Blessed Warrior', source: 'XPHB', category: 'FS:P', entries: ['Blessed text.'], additionalSpells: [{ ability: 'cha', known: { _: [{ choose: 'level=0|class=cleric', count: 2 }] } }] },
	{ name: 'Druidic Warrior', source: 'XPHB', category: 'FS:R', entries: ['Druidic text.'], additionalSpells: [{ ability: 'wis', known: { _: [{ choose: 'level=0|class=druid', count: 2 }] } }] },
	{ name: 'Alert', source: 'XPHB', category: 'O', entries: ['Alert text.'] },
]
const CLASSES = [
	{ name: 'Fighter', source: 'XPHB', featProgression: [{ name: 'Fighting Style', category: ['FS'], progression: { '1': 1 } }] },
	{ name: 'Paladin', source: 'XPHB', featProgression: [{ name: 'Fighting Style', category: ['FS', 'FS:P'], progression: { '2': 1 } }] },
	{ name: 'Ranger', source: 'XPHB', featProgression: [{ name: 'Fighting Style', category: ['FS', 'FS:R'], progression: { '2': 1 } }] },
	{ name: 'Paladin', source: 'PHB' },
]

describe('fightingStyleCategoriesFrom', () => {
	it('reads the class featProgression row', () => {
		expect(fightingStyleCategoriesFrom(CLASSES, 'Paladin', 'XPHB')).toEqual(['FS', 'FS:P'])
		expect(fightingStyleCategoriesFrom(CLASSES, 'Ranger', 'XPHB')).toEqual(['FS', 'FS:R'])
		expect(fightingStyleCategoriesFrom(CLASSES, 'Fighter', 'XPHB')).toEqual(['FS'])
	})

	it('falls back to FS for a class without the row', () => {
		expect(fightingStyleCategoriesFrom(CLASSES, 'Paladin', 'PHB')).toEqual(['FS'])
		expect(fightingStyleCategoriesFrom(CLASSES, 'Nobody', 'XPHB')).toEqual(['FS'])
	})

	it('matches the generated classes.json', () => {
		const classes: unknown = JSON.parse(readFileSync('data/classes.json', 'utf8'))
		expect(fightingStyleCategoriesFrom(classes, 'Paladin', 'XPHB')).toEqual(['FS', 'FS:P'])
		expect(fightingStyleCategoriesFrom(classes, 'Ranger', 'XPHB')).toEqual(['FS', 'FS:R'])
		expect(fightingStyleCategoriesFrom(classes, 'Fighter', 'XPHB')).toEqual(['FS'])
	})
})

describe('fightingStyleOptionsFrom', () => {
	const names = (categories?: string[]) => fightingStyleOptionsFrom(FEATS, categories).map((option) => option.name)

	it('offers Blessed Warrior only to the Paladin and Druidic Warrior only to the Ranger', () => {
		expect(names(fightingStyleCategoriesFrom(CLASSES, 'Paladin', 'XPHB'))).toEqual(['Defense', 'Blessed Warrior'])
		expect(names(fightingStyleCategoriesFrom(CLASSES, 'Ranger', 'XPHB'))).toEqual(['Defense', 'Druidic Warrior'])
		expect(names(fightingStyleCategoriesFrom(CLASSES, 'Fighter', 'XPHB'))).toEqual(['Defense'])
	})

	it('defaults to FS only', () => {
		expect(names()).toEqual(['Defense'])
	})

	it('isClassFightingStyleCategory takes FS and FS:* only', () => {
		expect(['FS', 'FS:P', 'FS:R', 'O', 'G', undefined].map(isClassFightingStyleCategory)).toEqual([true, true, true, false, false, false])
	})
})

describe('stored class style with Blessed Warrior', () => {
	const style = {
		className: 'Paladin',
		classSource: 'XPHB',
		name: 'Blessed Warrior',
		source: 'XPHB',
		filterChoiceSpells: { cantrips: [{ name: 'Guidance', source: 'XPHB' }, { name: 'Sacred Flame', source: 'XPHB' }], spells: [] },
	}

	it('validates, and rejects malformed cantrips', () => {
		expect(describeFightingStylesError([style])).toBeNull()
		expect(describeFightingStylesError([{ ...style, filterChoiceSpells: { cantrips: 'Guidance', spells: [] } }])).toMatch(/fightingStyles\[0\]\.filterChoiceSpells/)
	})

	it('puts its cantrips on the Spells tab with the feat ability (CHA)', () => {
		const spells = [
			{ name: 'Guidance', source: 'XPHB', level: 0 },
			{ name: 'Sacred Flame', source: 'XPHB', level: 0 },
		]
		const character = { id: '1', name: 'P', classes: [{ className: 'Paladin', classSource: 'XPHB', subclass: null, level: 2 }], fightingStyles: [style] } as unknown as Character
		const granted = extractFeatGrantedSpells(FEATS, spells, character, null)
		expect(granted.map((spell) => [spell.name, spell.featName, spell.ability])).toEqual([
			['Guidance', 'Blessed Warrior', 'cha'],
			['Sacred Flame', 'Blessed Warrior', 'cha'],
		])
	})

	it('a Druidic Warrior style casts with WIS', () => {
		const druidic = { className: 'Ranger', classSource: 'XPHB', name: 'Druidic Warrior', source: 'XPHB', filterChoiceSpells: { cantrips: [{ name: 'Guidance', source: 'XPHB' }], spells: [] } }
		const character = { id: '1', name: 'R', classes: [{ className: 'Ranger', classSource: 'XPHB', subclass: null, level: 2 }], fightingStyles: [druidic] } as unknown as Character
		expect(extractFeatGrantedSpells(FEATS, [{ name: 'Guidance', source: 'XPHB', level: 0 }], character, null).map((spell) => spell.ability)).toEqual(['wis'])
	})

	it('resolves on the Features tab and in the pick-source lookup', () => {
		expect(chosenOptionalFeatureOptions([], FEATS, [], [style]).map((option) => option.name)).toEqual(['Blessed Warrior'])
		const lookup = pickSourceLookup([], FEATS)
		expect(lookup('FS', 'Blessed Warrior')).toBe('XPHB')
		// College of Swords' FS:B still resolves against category FS only (D12).
		expect(lookup('FS:B', 'Blessed Warrior')).toBeUndefined()
	})
})
