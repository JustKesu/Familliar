import { describe, expect, it } from 'vitest'
import { levelGainsFor, type LevelGain } from './levelGains'
import type { ResolverData } from '../featureResolver'
import type { Character } from '../storage/character'

/*
 * Fixtures mirror the real data shapes (classes.json's classFeatureIds /
 * subclassFeatureIds / subclassTitle / classTableGroups / optionalfeature-
 * Progression, D33 ids on class and subclass features) but carry only the
 * fields this module's callees read. The numbers are the PHB 2024 ones, so
 * every expectation below is checkable against the book.
 */

const CLASSES = [
	{
		entryType: 'class',
		name: 'Fighter',
		source: 'XPHB',
		subclassTitle: 'Fighter Subclass',
		// `hd` is what marks a base class entry for extractSpellCountClassData; without it a non-caster reads as a class with no spell data at all.
		hd: { number: 1, faces: 10 },
		// Fighter's own "Weapon Mastery" table column: 3 at level 1, 4 at level 4, 5 at level 10.
		classTableGroups: [{ colLabels: ['Weapon Mastery'], rows: [['3'], ['3'], ['3'], ['4'], ['4'], ['4'], ['4'], ['4'], ['4'], ['5']] }],
		classFeatureIds: [
			'cf|fighting style|fighter|xphb|1|xphb',
			'cf|weapon mastery|fighter|xphb|1|xphb',
			'cf|fighter subclass|fighter|xphb|3|xphb',
			'cf|ability score improvement|fighter|xphb|4|xphb',
			'cf|extra attack|fighter|xphb|5|xphb',
			'cf|ability score improvement|fighter|xphb|6|xphb',
		],
		classFeatures: [{ gainSubclassFeature: true, classFeature: 'Fighter Subclass|Fighter|XPHB|3' }],
	},
	{ entryType: 'subclass', name: 'Champion', className: 'Fighter', classSource: 'XPHB', shortName: 'Champion', source: 'XPHB', subclassFeatureIds: [] },
	{
		entryType: 'class',
		name: 'Rogue',
		source: 'XPHB',
		subclassTitle: 'Rogue Subclass',
		hd: { number: 1, faces: 8 },
		classFeatureIds: [
			'cf|expertise|rogue|xphb|1|xphb',
			'cf|rogue subclass|rogue|xphb|3|xphb',
			'cf|ability score improvement|rogue|xphb|4|xphb',
			'cf|expertise|rogue|xphb|6|xphb',
		],
		classFeatures: [{ gainSubclassFeature: true, classFeature: 'Rogue Subclass|Rogue|XPHB|3' }],
	},
	{ entryType: 'subclass', name: 'Thief', className: 'Rogue', classSource: 'XPHB', shortName: 'Thief', source: 'XPHB', subclassFeatureIds: [] },
	{
		entryType: 'class',
		name: 'Sorcerer',
		source: 'XPHB',
		subclassTitle: 'Sorcerer Subclass',
		hd: { number: 1, faces: 6 },
		preparedSpellsChange: 'level',
		cantripProgression: [4, 4, 4, 5, 5, 5, 5, 5, 5, 6],
		preparedSpellsProgression: [2, 4, 6, 7, 9, 10, 11, 12, 14, 15],
		optionalfeatureProgression: [{ name: 'Metamagic', featureType: ['MM'], progression: { '2': 2, '10': 3, '17': 4 } }],
		classFeatureIds: ['cf|sorcerer subclass|sorcerer|xphb|3|xphb', 'cf|ability score improvement|sorcerer|xphb|4|xphb'],
		classFeatures: [{ gainSubclassFeature: true, classFeature: 'Sorcerer Subclass|Sorcerer|XPHB|3' }],
	},
	{
		entryType: 'subclass',
		name: 'Draconic Sorcery',
		className: 'Sorcerer',
		classSource: 'XPHB',
		shortName: 'Draconic',
		source: 'XPHB',
		subclassFeatureIds: [],
	},
	{
		entryType: 'class',
		name: 'Cleric',
		source: 'XPHB',
		subclassTitle: 'Cleric Subclass',
		hd: { number: 1, faces: 8 },
		classFeatureIds: ['cf|cleric subclass|cleric|xphb|3|xphb'],
		classFeatures: [{ gainSubclassFeature: true, classFeature: 'Cleric Subclass|Cleric|XPHB|3' }],
	},
	{
		entryType: 'subclass',
		name: 'Life Domain',
		className: 'Cleric',
		classSource: 'XPHB',
		shortName: 'Life',
		source: 'XPHB',
		// Disciple of Life is filed at level 1 although the subclass itself is first taken at 3 —
		// the downward level drift scripts/investigate-closure-level-drift.js found.
		subclassFeatureIds: ['scf|life domain|cleric|xphb|life|xphb|3|xphb', 'scf|disciple of life|cleric|xphb|life|xphb|1|xphb'],
	},
]

const CF = [
	{ id: 'cf|fighting style|fighter|xphb|1|xphb', name: 'Fighting Style', className: 'Fighter', classSource: 'XPHB', level: 1, entries: ['You gain a Fighting Style feat.'] },
	{ id: 'cf|weapon mastery|fighter|xphb|1|xphb', name: 'Weapon Mastery', className: 'Fighter', classSource: 'XPHB', level: 1, entries: ['Your training with weapons.'] },
	{ id: 'cf|fighter subclass|fighter|xphb|3|xphb', name: 'Fighter Subclass', className: 'Fighter', classSource: 'XPHB', level: 3, entries: ['You gain a subclass.'] },
	{ id: 'cf|ability score improvement|fighter|xphb|4|xphb', name: 'Ability Score Improvement', className: 'Fighter', classSource: 'XPHB', level: 4, entries: ['Take the ASI feat.'] },
	{ id: 'cf|extra attack|fighter|xphb|5|xphb', name: 'Extra Attack', className: 'Fighter', classSource: 'XPHB', level: 5, entries: ['You can attack twice.'] },
	{ id: 'cf|ability score improvement|fighter|xphb|6|xphb', name: 'Ability Score Improvement', className: 'Fighter', classSource: 'XPHB', level: 6, entries: ['Take the ASI feat.'] },
	{ id: 'cf|expertise|rogue|xphb|1|xphb', name: 'Expertise', className: 'Rogue', classSource: 'XPHB', level: 1, entries: ['Choose two skill proficiencies.'] },
	{ id: 'cf|rogue subclass|rogue|xphb|3|xphb', name: 'Rogue Subclass', className: 'Rogue', classSource: 'XPHB', level: 3, entries: ['You gain a subclass.'] },
	{ id: 'cf|ability score improvement|rogue|xphb|4|xphb', name: 'Ability Score Improvement', className: 'Rogue', classSource: 'XPHB', level: 4, entries: ['Take the ASI feat.'] },
	{ id: 'cf|expertise|rogue|xphb|6|xphb', name: 'Expertise', className: 'Rogue', classSource: 'XPHB', level: 6, entries: ['Choose two more skill proficiencies.'] },
	{ id: 'cf|sorcerer subclass|sorcerer|xphb|3|xphb', name: 'Sorcerer Subclass', className: 'Sorcerer', classSource: 'XPHB', level: 3, entries: ['You gain a subclass.'] },
	{ id: 'cf|ability score improvement|sorcerer|xphb|4|xphb', name: 'Ability Score Improvement', className: 'Sorcerer', classSource: 'XPHB', level: 4, entries: ['Take the ASI feat.'] },
	{ id: 'cf|cleric subclass|cleric|xphb|3|xphb', name: 'Cleric Subclass', className: 'Cleric', classSource: 'XPHB', level: 3, entries: ['You gain a subclass.'] },
]

const SCF = [
	{
		id: 'scf|life domain|cleric|xphb|life|xphb|3|xphb',
		name: 'Life Domain',
		className: 'Cleric',
		classSource: 'XPHB',
		subclassShortName: 'Life',
		subclassSource: 'XPHB',
		level: 3,
		entries: ['You gain the following features.', { type: 'refSubclassFeature', subclassFeature: 'Disciple of Life|Cleric|XPHB|Life|XPHB|1' }],
	},
	{
		id: 'scf|disciple of life|cleric|xphb|life|xphb|1|xphb',
		name: 'Disciple of Life',
		className: 'Cleric',
		classSource: 'XPHB',
		subclassShortName: 'Life',
		subclassSource: 'XPHB',
		level: 1,
		entries: ['Your healing spells are more potent.'],
	},
]

const RESOLVER: ResolverData = { classFeatures: CF, subclassFeatures: SCF, optionalFeatures: [], feats: [] }

function character(classes: Character['classes']): Character {
	return { id: 'c1', name: 'Test', classes }
}

const fighter = character([{ className: 'Fighter', classSource: 'XPHB', subclass: 'Champion', level: 7 }])
const rogue = character([{ className: 'Rogue', classSource: 'XPHB', subclass: 'Thief', level: 6 }])
const sorcerer = character([{ className: 'Sorcerer', classSource: 'XPHB', subclass: 'Draconic Sorcery', level: 10 }])
const cleric = character([{ className: 'Cleric', classSource: 'XPHB', subclass: 'Life Domain', level: 3 }])

function partCount(gain: LevelGain, name: string): number {
	return gain.parts.find((part) => part.name === name)?.count ?? 0
}

describe('levelGainsFor', () => {
	it('reports the ASI a Fighter gains at level 4, named as the data names the feature', () => {
		const gains = levelGainsFor(fighter, 4, CLASSES, RESOLVER)
		expect(gains.steps.featAsi).toMatchObject({ status: 'adds', count: 1 })
		expect(gains.steps.featAsi.parts).toEqual([{ name: 'Ability Score Improvement', count: 1 }])
		// The same level also raises Fighter's weapon-mastery column from 3 to 4.
		expect(partCount(gains.steps.class, 'Weapon Mastery')).toBe(1)
	})

	it('reports no ASI at Fighter 5, but does report Extra Attack as a feature the level grants', () => {
		const gains = levelGainsFor(fighter, 5, CLASSES, RESOLVER)
		expect(gains.steps.featAsi.status).toBe('none')
		expect(gains.steps.class.status).toBe('none')
		expect(gains.newFeatures.map((feature) => feature.name)).toEqual(['Extra Attack'])
	})

	it('reports a level that asks for nothing but the hit points every level asks for', () => {
		const gains = levelGainsFor(fighter, 7, CLASSES, RESOLVER)
		expect(gains.newFeatures).toEqual([])
		expect(gains.steps.hitPoints).toMatchObject({ status: 'adds', count: 1 })
		const others = Object.entries(gains.steps).filter(([step]) => step !== 'hitPoints')
		expect(others.filter(([, gain]) => gain.status === 'adds')).toEqual([])
		expect(others.filter(([, gain]) => gain.status === 'unknown')).toEqual([])
	})

	it('reports the two extra Expertise skills a Rogue gains at level 6', () => {
		const gains = levelGainsFor(rogue, 6, CLASSES, RESOLVER)
		expect(gains.steps.expertise).toMatchObject({ status: 'adds', count: 2 })
		expect(gains.steps.expertise.parts).toEqual([{ name: 'Expertise', count: 2 }])
	})

	it('reports no further Expertise at Rogue 5, where the cumulative count is unchanged', () => {
		expect(levelGainsFor(rogue, 5, CLASSES, RESOLVER).steps.expertise.status).toBe('none')
	})

	it('reports the third Metamagic a Sorcerer gains at level 10, alongside that level\'s spell counts', () => {
		const gains = levelGainsFor(sorcerer, 10, CLASSES, RESOLVER)
		expect(gains.steps.classOptionalFeatures).toMatchObject({ status: 'adds', count: 1 })
		expect(gains.steps.classOptionalFeatures.parts).toEqual([{ name: 'Metamagic', count: 1 }])
		expect(partCount(gains.steps.spells, 'Cantrips')).toBe(1)
		expect(partCount(gains.steps.spells, 'Leveled spells')).toBe(1)
	})

	it('reports no further Metamagic at Sorcerer 9', () => {
		expect(levelGainsFor(sorcerer, 9, CLASSES, RESOLVER).steps.classOptionalFeatures.status).toBe('none')
	})

	it('reports the subclass choice at the level the class chooses one, under the title the data gives it', () => {
		const gains = levelGainsFor(cleric, 3, CLASSES, RESOLVER)
		expect(partCount(gains.steps.class, 'Cleric Subclass')).toBe(1)
		// The subclass's own level-1 feature arrives at 3 with it — the downward drift the survey found.
		// "Cleric Subclass" itself is the gainSubclassFeature placeholder and is never listed as a granted feature (D87 rule 4).
		expect(gains.newFeatures.map((feature) => feature.name).sort()).toEqual(['Disciple of Life', 'Life Domain'])
	})

	it('does not credit a not-yet-chosen subclass\'s level-1 features to the level before the subclass is taken', () => {
		const gains = levelGainsFor(cleric, 2, CLASSES, RESOLVER)
		expect(gains.newFeatures).toEqual([])
		expect(gains.steps.class.status).toBe('none')
	})

	it('returns a visible unresolved state for a multiclass character rather than guessing a class', () => {
		const multiclass = character([
			{ className: 'Fighter', classSource: 'XPHB', subclass: 'Champion', level: 3 },
			{ className: 'Rogue', classSource: 'XPHB', subclass: 'Thief', level: 2 },
		])
		const gains = levelGainsFor(multiclass, 4, CLASSES, RESOLVER)
		expect(gains.unresolved).toContain('Multiclass')
		expect(gains.newFeatures).toEqual([])
		expect(Object.values(gains.steps).every((gain) => gain.status === 'unknown')).toBe(true)
	})

	it('says which steps can never add anything after creation rather than leaving them out', () => {
		const gains = levelGainsFor(fighter, 5, CLASSES, RESOLVER)
		for (const step of ['species', 'background', 'languages', 'abilities', 'equipment', 'review'] as const) {
			expect(gains.steps[step].status).toBe('never')
			expect(gains.steps[step].reason).toBeTruthy()
		}
	})

	it('reports unknown, not zero, for a class the supplied data does not have', () => {
		const gains = levelGainsFor(character([{ className: 'Artificer', classSource: 'TCE', subclass: null, level: 4 }]), 4, CLASSES, RESOLVER)
		expect(gains.unresolved).toContain('Artificer')
		expect(gains.steps.featAsi.status).toBe('unknown')
	})

	it('reports unknown for a stored subclass the supplied data does not have', () => {
		const gains = levelGainsFor(character([{ className: 'Fighter', classSource: 'XPHB', subclass: 'Psi Warrior', level: 4 }]), 4, CLASSES, RESOLVER)
		expect(gains.unresolved).toBeNull()
		expect(gains.steps.class.status).toBe('unknown')
		expect(gains.steps.spells.status).toBe('unknown')
	})
})
