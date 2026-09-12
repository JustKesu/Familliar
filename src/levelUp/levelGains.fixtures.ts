import type { ResolverData } from '../featureResolver'

/*
 * Fixtures mirror the real data shapes (classes.json's classFeatureIds /
 * subclassFeatureIds / subclassTitle / classTableGroups / optionalfeature-
 * Progression, D33 ids on class and subclass features) but carry only the
 * fields levelGainsFor's callees read. The numbers are the PHB 2024 ones, so
 * every expectation built on them is checkable against the book.
 */

export const CLASSES = [
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

export const RESOLVER: ResolverData = { classFeatures: CF, subclassFeatures: SCF, optionalFeatures: [], feats: [] }
