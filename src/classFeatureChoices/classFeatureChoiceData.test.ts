import { describe, expect, it } from 'vitest'
import { chosenClassFeatureChoicesFrom, classFeatureChoicesFrom } from './classFeatureChoiceData'
import type { ResolverData } from '../featureResolver'

/** Mirrors the real shape: a counted `options` node of refClassFeature pointers, with the targets as their own class-features.json records (D33 ids). */
const classFeatures = [
	{
		name: 'Divine Order',
		className: 'Cleric',
		classSource: 'XPHB',
		level: 1,
		source: 'XPHB',
		id: 'cf|divine order|cleric|xphb|1|xphb',
		entries: [
			'You have dedicated yourself to one of the following sacred roles of your choice.',
			{
				type: 'options',
				count: 1,
				entries: [
					{ type: 'refClassFeature', classFeature: 'Protector|Cleric|XPHB|1|XPHB' },
					{ type: 'refClassFeature', classFeature: 'Thaumaturge|Cleric|XPHB|1|XPHB' },
				],
			},
		],
	},
	{ name: 'Protector', className: 'Cleric', classSource: 'XPHB', level: 1, source: 'XPHB', id: 'cf|protector|cleric|xphb|1|xphb', entries: ['Protector text.'] },
	{
		name: 'Thaumaturge',
		className: 'Cleric',
		classSource: 'XPHB',
		level: 1,
		source: 'XPHB',
		id: 'cf|thaumaturge|cleric|xphb|1|xphb',
		entries: ['Thaumaturge text.'],
	},
	// The short-form uid Druid actually uses: no trailing |source, since it repeats classSource.
	{
		name: 'Elemental Fury',
		className: 'Druid',
		classSource: 'XPHB',
		level: 7,
		source: 'XPHB',
		id: 'cf|elemental fury|druid|xphb|7|xphb',
		entries: [{ type: 'options', count: 1, entries: [{ type: 'refClassFeature', classFeature: 'Primal Strike|Druid|XPHB|7' }] }],
	},
	{
		name: 'Primal Strike',
		className: 'Druid',
		classSource: 'XPHB',
		level: 7,
		source: 'XPHB',
		id: 'cf|primal strike|druid|xphb|7|xphb',
		entries: ['Primal Strike text.'],
	},
	// A counted options node of refOptionalfeature pointers — the ClassOptionalFeaturePicker's job, never this one's.
	{
		name: 'Metamagic Options',
		className: 'Sorcerer',
		classSource: 'XPHB',
		level: 2,
		source: 'XPHB',
		id: 'cf|metamagic options|sorcerer|xphb|2|xphb',
		entries: [{ type: 'options', count: 2, entries: [{ type: 'refOptionalfeature', optionalfeature: 'Careful Spell|XPHB' }] }],
	},
	// No count: a plain container for parts the character receives all of, not a choice.
	{
		name: 'Uncounted Feature',
		className: 'Cleric',
		classSource: 'XPHB',
		level: 2,
		source: 'XPHB',
		id: 'cf|uncounted feature|cleric|xphb|2|xphb',
		entries: [{ type: 'options', entries: [{ type: 'refClassFeature', classFeature: 'Protector|Cleric|XPHB|1|XPHB' }] }],
	},
]

const data: ResolverData = { classFeatures, subclassFeatures: [], optionalFeatures: [], feats: [] }

describe('classFeatureChoicesFrom', () => {
	it('offers a counted refClassFeature options node with each option resolved to its own text', () => {
		const choices = classFeatureChoicesFrom(classFeatures, data, 'Cleric', 'XPHB', 1)
		expect(choices).toHaveLength(1)
		expect(choices[0]).toMatchObject({ featureName: 'Divine Order', grantedAtLevel: 1, count: 1 })
		expect(choices[0].options.map((option) => option.name)).toEqual(['Protector', 'Thaumaturge'])
		expect(choices[0].options[1]).toMatchObject({ entries: ['Thaumaturge text.'], found: true })
	})

	it('resolves an option whose uid omits the source segment (Druid short form)', () => {
		const choices = classFeatureChoicesFrom(classFeatures, data, 'Druid', 'XPHB', 7)
		expect(choices[0].options[0]).toMatchObject({ name: 'Primal Strike', entries: ['Primal Strike text.'], found: true })
	})

	it('ignores an options node of refOptionalfeature pointers — ClassOptionalFeaturePicker owns those', () => {
		expect(classFeatureChoicesFrom(classFeatures, data, 'Sorcerer', 'XPHB', 20)).toEqual([])
	})

	it('ignores an options node with no count — the character receives every listed part', () => {
		const choices = classFeatureChoicesFrom(classFeatures, data, 'Cleric', 'XPHB', 20)
		expect(choices.map((choice) => choice.featureName)).toEqual(['Divine Order'])
	})

	it('does not offer a feature the character has not reached the level for', () => {
		expect(classFeatureChoicesFrom(classFeatures, data, 'Druid', 'XPHB', 6)).toEqual([])
	})

	it('keeps an unresolvable option visible rather than dropping it (D43)', () => {
		const orphan = [
			{
				name: 'Broken Order',
				className: 'Bard',
				classSource: 'XPHB',
				level: 1,
				source: 'XPHB',
				id: 'cf|broken order|bard|xphb|1|xphb',
				entries: [{ type: 'options', count: 1, entries: [{ type: 'refClassFeature', classFeature: 'Nowhere|Bard|XPHB|1|XPHB' }] }],
			},
		]
		const choices = classFeatureChoicesFrom(orphan, { ...data, classFeatures: orphan }, 'Bard', 'XPHB', 1)
		expect(choices[0].options[0]).toMatchObject({ name: 'Nowhere', found: false })
	})
})

describe('chosenClassFeatureChoicesFrom', () => {
	const character = {
		classes: [{ className: 'Cleric', classSource: 'XPHB', level: 1 }],
		classFeatureChoices: [
			{ className: 'Cleric', classSource: 'XPHB', featureName: 'Divine Order', grantedAtLevel: 1, optionName: 'Thaumaturge' },
		],
	}

	it('joins a stored pick to the text of the option it names', () => {
		expect(chosenClassFeatureChoicesFrom(character, data)).toEqual([
			{ featureName: 'Divine Order', grantedAtLevel: 1, optionName: 'Thaumaturge', entries: ['Thaumaturge text.'], found: true },
		])
	})

	it('returns nothing for a character that made no choice', () => {
		expect(chosenClassFeatureChoicesFrom({ classes: character.classes }, data)).toEqual([])
	})

	it('keeps a pick whose option is no longer offered, marked not-found (D43)', () => {
		const stale = {
			classes: [{ className: 'Cleric', classSource: 'XPHB', level: 1 }],
			classFeatureChoices: [
				{ className: 'Cleric', classSource: 'XPHB', featureName: 'Divine Order', grantedAtLevel: 1, optionName: 'Gone' },
			],
		}
		expect(chosenClassFeatureChoicesFrom(stale, data)).toEqual([
			{ featureName: 'Divine Order', grantedAtLevel: 1, optionName: 'Gone', entries: [], found: false },
		])
	})
})
