import { describe, expect, it } from 'vitest'
import { grantedClassFeaturesFrom } from './grantedClassFeatures'
import type { ResolverData } from '../featureResolver'
import type { Character } from '../storage/character'

/*
 * Fixtures mirror the real data shapes (D33 ids on class/subclass features,
 * classes.json's classFeatureIds / subclassFeatureIds / gainSubclassFeature
 * refs) but only the fields the D87 resolver reads.
 */

const CLASSES = [
	{
		entryType: 'class',
		name: 'Fighter',
		source: 'XPHB',
		classFeatureIds: [
			'cf|second wind|fighter|xphb|1|xphb',
			'cf|fighting style|fighter|xphb|1|xphb', // counted-options container
			'cf|fighter subclass|fighter|xphb|3|xphb', // gainSubclassFeature placeholder
		],
		classFeatures: [
			'Second Wind|Fighter|XPHB|1',
			'Fighting Style|Fighter|XPHB|1',
			{ gainSubclassFeature: true, classFeature: 'Fighter Subclass|Fighter|XPHB|3' },
		],
	},
	{
		entryType: 'subclass',
		name: 'Champion',
		className: 'Fighter',
		classSource: 'XPHB',
		shortName: 'Champion',
		source: 'XPHB',
		subclassFeatureIds: ['scf|improved critical|fighter|xphb|champion|xphb|3|xphb'],
	},
	{
		entryType: 'class',
		name: 'Cleric',
		source: 'XPHB',
		classFeatureIds: [
			'cf|channel divinity|cleric|xphb|2|xphb',
			'cf|blessed strikes|cleric|xphb|7|xphb',
			'cf|cleric subclass|cleric|xphb|3|xphb', // gainSubclassFeature placeholder
		],
		classFeatures: [
			'Channel Divinity|Cleric|XPHB|2',
			'Blessed Strikes|Cleric|XPHB|7',
			{ gainSubclassFeature: true, classFeature: 'Cleric Subclass|Cleric|XPHB|3' },
		],
	},
	{
		entryType: 'subclass',
		name: 'Life Domain',
		className: 'Cleric',
		classSource: 'XPHB',
		shortName: 'Life',
		source: 'XPHB',
		subclassFeatureIds: ['scf|life domain|cleric|xphb|life|xphb|3|xphb'], // wrapper only
	},
	{
		entryType: 'class',
		name: 'Druid',
		source: 'XPHB',
		classFeatureIds: [
			'cf|wild shape|druid|xphb|2|xphb',
			'cf|elemental fury|druid|xphb|7|xphb', // counted-options container (all refClassFeature)
			'cf|druid subclass|druid|xphb|3|xphb', // gainSubclassFeature placeholder
		],
		classFeatures: [
			'Wild Shape|Druid|XPHB|2',
			'Elemental Fury|Druid|XPHB|7',
			{ gainSubclassFeature: true, classFeature: 'Druid Subclass|Druid|XPHB|3' },
		],
	},
]

const CF = [
	{ id: 'cf|second wind|fighter|xphb|1|xphb', name: 'Second Wind', className: 'Fighter', classSource: 'XPHB', level: 1, source: 'XPHB', entries: ['A limited well of stamina.'] },
	{
		id: 'cf|fighting style|fighter|xphb|1|xphb',
		name: 'Fighting Style',
		className: 'Fighter',
		classSource: 'XPHB',
		level: 1,
		source: 'XPHB',
		entries: [
			'You gain a Fighting Style feat of your choice.',
			{
				type: 'options',
				count: 1,
				entries: [
					{ type: 'refOptionalfeature', optionalfeature: 'Defense|XPHB' },
					{ type: 'refOptionalfeature', optionalfeature: 'Dueling|XPHB' },
				],
			},
		],
	},
	{ id: 'cf|fighter subclass|fighter|xphb|3|xphb', name: 'Fighter Subclass', className: 'Fighter', classSource: 'XPHB', level: 3, source: 'XPHB', entries: ['You gain a subclass.'] },
	{ id: 'cf|channel divinity|cleric|xphb|2|xphb', name: 'Channel Divinity', className: 'Cleric', classSource: 'XPHB', level: 2, source: 'XPHB', entries: ['Channel divine energy.'] },
	{ id: 'cf|cleric subclass|cleric|xphb|3|xphb', name: 'Cleric Subclass', className: 'Cleric', classSource: 'XPHB', level: 3, source: 'XPHB', entries: ['You gain a subclass.'] },
	// Plain-text ref to ONE specific "Potent Spellcasting" by uid (D87 rule 2 — id/uid, never name).
	{
		id: 'cf|blessed strikes|cleric|xphb|7|xphb',
		name: 'Blessed Strikes',
		className: 'Cleric',
		classSource: 'XPHB',
		level: 7,
		source: 'XPHB',
		entries: ['Divine power infuses your attacks.', { type: 'refClassFeature', classFeature: 'Potent Spellcasting|Cleric|XPHB|17|XPHB' }],
	},
	{ id: 'cf|potent spellcasting|cleric|xphb|17|xphb', name: 'Potent Spellcasting', className: 'Cleric', classSource: 'XPHB', level: 17, source: 'XPHB', entries: ['Add Wisdom to Cleric cantrip damage.'] },
	{ id: 'cf|potent spellcasting|druid|xphb|17|xphb', name: 'Potent Spellcasting', className: 'Druid', classSource: 'XPHB', level: 17, source: 'XPHB', entries: ['Add Wisdom to Druid cantrip damage.'] },
	{ id: 'cf|wild shape|druid|xphb|2|xphb', name: 'Wild Shape', className: 'Druid', classSource: 'XPHB', level: 2, source: 'XPHB', entries: ['Assume a beast form.'] },
	{
		id: 'cf|elemental fury|druid|xphb|7|xphb',
		name: 'Elemental Fury',
		className: 'Druid',
		classSource: 'XPHB',
		level: 7,
		source: 'XPHB',
		entries: [
			{
				type: 'options',
				count: 1,
				entries: [
					{ type: 'refClassFeature', classFeature: 'Potent Spellcasting|Druid|XPHB|17|XPHB' },
					{ type: 'refClassFeature', classFeature: 'Primal Strike|Druid|XPHB|7|XPHB' },
				],
			},
		],
	},
	{ id: 'cf|primal strike|druid|xphb|7|xphb', name: 'Primal Strike', className: 'Druid', classSource: 'XPHB', level: 7, source: 'XPHB', entries: ['Your attacks count as magical.'] },
	{ id: 'cf|druid subclass|druid|xphb|3|xphb', name: 'Druid Subclass', className: 'Druid', classSource: 'XPHB', level: 3, source: 'XPHB', entries: ['You gain a subclass.'] },
]

const SF = [
	{ id: 'scf|improved critical|fighter|xphb|champion|xphb|3|xphb', name: 'Improved Critical', className: 'Fighter', classSource: 'XPHB', subclassShortName: 'Champion', subclassSource: 'XPHB', level: 3, source: 'XPHB', entries: ['Crit on 19-20.'] },
	{
		id: 'scf|life domain|cleric|xphb|life|xphb|3|xphb',
		name: 'Life Domain',
		className: 'Cleric',
		classSource: 'XPHB',
		subclassShortName: 'Life',
		subclassSource: 'XPHB',
		level: 3,
		source: 'XPHB',
		entries: [
			'Life force blesses you.',
			{ type: 'refSubclassFeature', subclassFeature: 'Disciple of Life|Cleric|XPHB|Life|XPHB|3|XPHB' },
			{ type: 'refSubclassFeature', subclassFeature: 'Preserve Life|Cleric|XPHB|Life|XPHB|3|XPHB' },
		],
	},
	{ id: 'scf|disciple of life|cleric|xphb|life|xphb|3|xphb', name: 'Disciple of Life', className: 'Cleric', classSource: 'XPHB', subclassShortName: 'Life', subclassSource: 'XPHB', level: 3, source: 'XPHB', entries: ['Healing spells mend more.'] },
	{ id: 'scf|preserve life|cleric|xphb|life|xphb|3|xphb', name: 'Preserve Life', className: 'Cleric', classSource: 'XPHB', subclassShortName: 'Life', subclassSource: 'XPHB', level: 3, source: 'XPHB', entries: ['Restore hit points.'] },
]

const RESOLVER: ResolverData = { classFeatures: CF, subclassFeatures: SF, optionalFeatures: [], feats: [] }

function makeCharacter(over: Partial<Character> & Pick<Character, 'classes'>): Character {
	return { id: 'c', name: 'Fixture', ...over }
}

function resolvedNames(character: Character): string[] {
	return grantedClassFeaturesFrom(character, CLASSES, RESOLVER).map((feature) => feature.name)
}

describe('grantedClassFeaturesFrom', () => {
	it('seeds from the id lists at or below level and lists class and subclass features together', () => {
		const fighter = makeCharacter({ classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Champion', level: 5 }] })
		expect(resolvedNames(fighter)).toEqual(['Second Wind', 'Improved Critical'])
	})

	it('excludes a choice container (rule 3) — its counted options node holds the choice refs', () => {
		const fighter = makeCharacter({ classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Champion', level: 5 }] })
		expect(resolvedNames(fighter)).not.toContain('Fighting Style')

		// A Druid whose only above-seed feature is Elemental Fury (all-refClassFeature counted options).
		const druid = makeCharacter({ classes: [{ className: 'Druid', classSource: 'XPHB', subclass: null, level: 7 }] })
		expect(resolvedNames(druid)).toEqual(['Wild Shape'])
		expect(resolvedNames(druid)).not.toContain('Elemental Fury')
	})

	it('excludes a gainSubclassFeature placeholder (rule 4) even though it is in classFeatureIds and level-reached', () => {
		const fighter = makeCharacter({ classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Champion', level: 5 }] })
		expect(resolvedNames(fighter)).not.toContain('Fighter Subclass')
	})

	it('keeps a wrapper (Life Domain) as an ordinary entry alongside the features it introduces by ref (rule 5)', () => {
		const cleric = makeCharacter({ classes: [{ className: 'Cleric', classSource: 'XPHB', subclass: 'Life Domain', level: 5 }] })
		const names = resolvedNames(cleric)
		expect(names).toContain('Life Domain')
		expect(names).toContain('Disciple of Life')
		expect(names).toContain('Preserve Life')
		expect(names).not.toContain('Cleric Subclass')
	})

	it('follows a plain-text ref by id and resolves the Cleric "Potent Spellcasting", not the Druid one', () => {
		const cleric = makeCharacter({ classes: [{ className: 'Cleric', classSource: 'XPHB', subclass: 'Life Domain', level: 17 }] })
		const potent = grantedClassFeaturesFrom(cleric, CLASSES, RESOLVER).filter((feature) => feature.name === 'Potent Spellcasting')
		expect(potent).toHaveLength(1)
		expect(potent[0].entries).toEqual(['Add Wisdom to Cleric cantrip damage.'])
		expect(potent[0].level).toBe(17)
	})

	it('does NOT pull the Druid "Potent Spellcasting" — it is only referenced from inside a counted options node (rule 2)', () => {
		const druid = makeCharacter({ classes: [{ className: 'Druid', classSource: 'XPHB', subclass: null, level: 17 }] })
		const names = resolvedNames(druid)
		expect(names).not.toContain('Potent Spellcasting')
		expect(names).not.toContain('Primal Strike')
		expect(names).not.toContain('Elemental Fury')
	})

	it('does not seed subclass features before a subclass is stored', () => {
		const fighter = makeCharacter({ classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 5 }] })
		expect(resolvedNames(fighter)).toEqual(['Second Wind'])
	})

	it('respects the level gate on the seed', () => {
		const cleric = makeCharacter({ classes: [{ className: 'Cleric', classSource: 'XPHB', subclass: 'Life Domain', level: 5 }] })
		const names = resolvedNames(cleric)
		expect(names).not.toContain('Blessed Strikes')
		expect(names).not.toContain('Potent Spellcasting')
	})

	it('returns entries sorted by granted level then name, each tagged class or subclass', () => {
		const cleric = makeCharacter({ classes: [{ className: 'Cleric', classSource: 'XPHB', subclass: 'Life Domain', level: 17 }] })
		const features = grantedClassFeaturesFrom(cleric, CLASSES, RESOLVER)
		expect(features.map((feature) => [feature.name, feature.level, feature.kind])).toEqual([
			['Channel Divinity', 2, 'class'],
			['Disciple of Life', 3, 'subclass'],
			['Life Domain', 3, 'subclass'],
			['Preserve Life', 3, 'subclass'],
			['Blessed Strikes', 7, 'class'],
			['Potent Spellcasting', 17, 'class'],
		])
	})
})
