import { describe, expect, it } from 'vitest'
import { subclassesFor } from './subclassData'

/*
 * Unit test for the subclass/feature join, using hand-built fixtures (never
 * data/ itself, per CLAUDE.md). Covers the fallback path (Arcane Archer,
 * whose feature text is filed under classSource "PHB" while the subclass
 * itself is converted to "XPHB" per D27) alongside the strict path (Battle
 * Master, where classSource already matches on both sides).
 */

const parsedClasses = [
	{ entryType: 'class', name: 'Fighter', source: 'XPHB', subclassTitle: 'Fighter Subclass' },
	{ entryType: 'subclass', name: 'Arcane Archer', shortName: 'Arcane Archer', source: 'XGE', className: 'Fighter', classSource: 'XPHB' },
	{ entryType: 'subclass', name: 'Battle Master', shortName: 'Battle Master', source: 'XPHB', className: 'Fighter', classSource: 'XPHB' },
]

const parsedClassFeatures = [{ name: 'Fighter Subclass', className: 'Fighter', classSource: 'XPHB', level: 3 }]

const parsedSubclassFeatures = [
	// Filed under the edition Arcane Archer was PUBLISHED for (PHB), not the
	// XPHB the subclass itself was converted to — the bug this fixes.
	{
		className: 'Fighter',
		classSource: 'PHB',
		subclassShortName: 'Arcane Archer',
		subclassSource: 'XGE',
		level: 3,
		entries: ['Arcane Shot options.'],
	},
	// Battle Master already matches classSource on both sides.
	{
		className: 'Fighter',
		classSource: 'XPHB',
		subclassShortName: 'Battle Master',
		subclassSource: 'XPHB',
		level: 3,
		entries: ['Maneuvers and superiority dice.'],
	},
]

describe('subclassesFor', () => {
	it('finds Arcane Archer feature text via the relaxed fallback join', () => {
		const options = subclassesFor(parsedClasses, parsedSubclassFeatures, parsedClassFeatures, 'Fighter', 'XPHB')
		const arcaneArcher = options.find((o) => o.name === 'Arcane Archer')
		expect(arcaneArcher?.entries).toEqual(['Arcane Shot options.'])
	})

	it('finds Battle Master feature text via the strict classSource-matching join', () => {
		const options = subclassesFor(parsedClasses, parsedSubclassFeatures, parsedClassFeatures, 'Fighter', 'XPHB')
		const battleMaster = options.find((o) => o.name === 'Battle Master')
		expect(battleMaster?.entries).toEqual(['Maneuvers and superiority dice.'])
	})
})
