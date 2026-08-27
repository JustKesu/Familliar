import { describe, expect, it } from 'vitest'
import { resolveRef } from './resolveRef'
import type { ResolverData } from './refTypes'

const data: ResolverData = {
	classFeatures: [
		{ name: 'Rage', className: 'Barbarian', classSource: 'XPHB', level: 1, source: 'XPHB', id: 'cf|rage|barbarian|xphb|1|xphb', entries: ['Rage text.'] },
		{ name: 'Second Wind', className: 'Fighter', classSource: 'PHB', level: 1, source: 'PHB', id: 'cf|second wind|fighter|phb|1|phb', entries: ['Second Wind text.'] },
	],
	subclassFeatures: [
		{
			name: 'Wails from the Grave',
			className: 'Rogue',
			classSource: 'PHB',
			subclassShortName: 'Phantom',
			subclassSource: 'TCE',
			level: 3,
			source: 'TCE',
			id: 'scf|wails from the grave|rogue|phb|phantom|tce|3|tce',
			entries: ['Wails text.'],
		},
		{
			name: 'Tools of the Trade',
			className: 'Artificer',
			classSource: 'EFA',
			subclassShortName: 'Alchemist',
			subclassSource: 'EFA',
			level: 3,
			source: 'EFA',
			id: 'scf|tools of the trade|artificer|efa|alchemist|efa|3|efa',
			entries: ['Tool text.'],
		},
	],
	optionalFeatures: [{ name: 'Careful Spell', source: 'XPHB', entries: ['Careful Spell text.'] }],
	feats: [
		{ name: 'Blessed Warrior', source: 'XPHB', category: 'FS', entries: ['Blessed Warrior text.'] },
		{ name: 'Dueling', source: 'XPHB', category: 'FS', entries: ['Dueling text.'] },
	],
}

describe('resolveRef', () => {
	it('resolves a classFeature ref by its D33 id', () => {
		expect(resolveRef({ kind: 'classFeature', uid: 'Rage|Barbarian|XPHB|1|XPHB' }, data)).toEqual({
			name: 'Rage',
			entries: ['Rage text.'],
		})
	})

	it('resolves a subclassFeature ref by its D33 id', () => {
		expect(
			resolveRef({ kind: 'subclassFeature', uid: 'Tools of the Trade|Artificer|EFA|Alchemist|EFA|3|EFA' }, data),
		).toEqual({ name: 'Tools of the Trade', entries: ['Tool text.'] })
	})

	// Druid's Primal Order/Elemental Fury point at the short form; without this
	// the class-feature choice picker resolves neither of its options.
	it('resolves a classFeature ref whose uid omits the source segment repeating classSource', () => {
		expect(resolveRef({ kind: 'classFeature', uid: 'Rage|Barbarian|XPHB|1' }, data)).toEqual({
			name: 'Rage',
			entries: ['Rage text.'],
		})
	})

	it('resolves a subclassFeature ref whose uid omits the source segment repeating subclassSource', () => {
		expect(resolveRef({ kind: 'subclassFeature', uid: 'Tools of the Trade|Artificer|EFA|Alchemist|EFA|3' }, data)).toEqual({
			name: 'Tools of the Trade',
			entries: ['Tool text.'],
		})
	})

	// 134 of the 420 ref* nodes in data/ are this shape — every XGE/TCE
	// subclass's own features, filed under classSource PHB (D27) and referenced
	// with that segment left empty. They resolved against nothing before.
	it('resolves a subclassFeature ref whose classSource segment is empty (means PHB)', () => {
		expect(resolveRef({ kind: 'subclassFeature', uid: 'Wails from the Grave|Rogue||Phantom|TCE|3' }, data)).toEqual({
			name: 'Wails from the Grave',
			entries: ['Wails text.'],
		})
	})

	it('resolves a subclassFeature ref whose trailing source segment is present but empty', () => {
		expect(resolveRef({ kind: 'subclassFeature', uid: 'Wails from the Grave|Rogue||Phantom|TCE|3|' }, data)).toEqual({
			name: 'Wails from the Grave',
			entries: ['Wails text.'],
		})
	})

	it('resolves a classFeature ref whose classSource segment is empty (means PHB)', () => {
		expect(resolveRef({ kind: 'classFeature', uid: 'Second Wind|Fighter||1' }, data)).toEqual({
			name: 'Second Wind',
			entries: ['Second Wind text.'],
		})
	})

	it('does not reshape a uid of any other length into a wrong match', () => {
		expect(resolveRef({ kind: 'classFeature', uid: 'Rage|Barbarian|XPHB' }, data)).toBeNull()
		expect(resolveRef({ kind: 'subclassFeature', uid: 'Tools of the Trade|Artificer|EFA' }, data)).toBeNull()
	})

	it('resolves an optionalfeature ref against optional-features.json', () => {
		expect(resolveRef({ kind: 'optionalfeature', uid: 'Careful Spell|XPHB' }, data)).toEqual({
			name: 'Careful Spell',
			entries: ['Careful Spell text.'],
		})
	})

	it('falls back to feats.json category FS for a Fighting Style optionalfeature ref (D12)', () => {
		expect(resolveRef({ kind: 'optionalfeature', uid: 'Dueling|XPHB' }, data)).toEqual({
			name: 'Dueling',
			entries: ['Dueling text.'],
		})
	})

	it('resolves a source-less optionalfeature ref by name alone against feats.json category FS, when the name is unambiguous', () => {
		expect(resolveRef({ kind: 'optionalfeature', uid: 'Dueling' }, data)).toEqual({
			name: 'Dueling',
			entries: ['Dueling text.'],
		})
	})

	it('fails to resolve a source-less optionalfeature ref when the name matches more than one FS feat, rather than picking one', () => {
		const ambiguousData: ResolverData = {
			...data,
			feats: [
				{ name: 'Blessed Warrior', source: 'XPHB', category: 'FS', entries: ['Blessed Warrior text.'] },
				{ name: 'Dueling', source: 'XPHB', category: 'FS', entries: ['Dueling text.'] },
				{ name: 'Dueling', source: 'AAG', category: 'FS', entries: ['A different Dueling.'] },
			],
		}
		expect(resolveRef({ kind: 'optionalfeature', uid: 'Dueling' }, ambiguousData)).toBeNull()
	})

	it('resolves a feat ref by name and source', () => {
		expect(resolveRef({ kind: 'feat', uid: 'Blessed Warrior|XPHB' }, data)).toEqual({
			name: 'Blessed Warrior',
			entries: ['Blessed Warrior text.'],
		})
	})

	it('returns null when nothing matches', () => {
		expect(resolveRef({ kind: 'feat', uid: 'Nonexistent Feat|XPHB' }, data)).toBeNull()
		expect(resolveRef({ kind: 'classFeature', uid: 'Nonexistent|Barbarian|XPHB|1|XPHB' }, data)).toBeNull()
	})
})
