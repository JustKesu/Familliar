import { describe, expect, it } from 'vitest'
import { featureActionRows, grantedFeatureOrigin } from './featureActionRowData'
import type { GrantedFeature } from './grantedClassFeatures'
import type { FeatTextEntry } from './sheetData'
import type { OptionalFeatureOption } from '../optionalFeatures/optionalFeatureData'

function granted(name: string, over: Partial<GrantedFeature> = {}): GrantedFeature {
	return { id: `cf|${name.toLowerCase()}`, name, level: 1, entries: [], kind: 'class', className: 'Fighter', ...over }
}

function option(name: string, over: Partial<OptionalFeatureOption> = {}): OptionalFeatureOption {
	return { name, source: 'XPHB', entries: [], ...over }
}

const REST = 'You regain the expended use when you finish a {@variantrule Short Rest|XPHB}.'

describe('featureActionRows', () => {
	it('keeps a granted feature qualifying by its rest tag, and drops one qualifying by neither test', () => {
		const rows = featureActionRows(
			[granted('Second Wind', { entries: [REST] }), granted('Improved Critical', { entries: ['You score a critical hit on a 19 or 20.'] })],
			[],
			[],
			[],
		)
		expect(rows.map((row) => row.name)).toEqual(['Second Wind'])
	})

	it('keeps a granted feature qualifying only by `consumes` — the 72 features with no rest tag at all', () => {
		const rows = featureActionRows([granted('Stunning Strike', { consumes: { name: 'Focus Point' }, entries: ['When you hit with an attack…'] })], [], [], [])
		expect(rows.map((row) => row.name)).toEqual(['Stunning Strike'])
	})

	it('leaves every cell but the name to the caller — a row carries a key, a name, its resource candidate and its origin only', () => {
		const [row] = featureActionRows([granted('Rage', { entries: [REST] })], [], [], [])
		// No `consumes`, so the candidate falls back to the feature's own resolved name (Rage is one of the 8 self-limited resources).
		expect(row).toEqual({ key: 'feature|rage', name: 'Rage', resourceName: 'Rage', origin: 'Fighter 1' })
	})

	it('collapses a feature the data restates at a later level into one row (Action Surge at 2 and 17), keeping the level first gained', () => {
		const rows = featureActionRows(
			[
				granted('Action Surge', { id: 'cf|action surge|fighter|xphb|2|xphb', level: 2, entries: [REST] }),
				granted('Action Surge', { id: 'cf|action surge|fighter|xphb|17|xphb', level: 17, entries: [REST] }),
			],
			[],
			[],
			[],
		)
		expect(rows.map((row) => row.name)).toEqual(['Action Surge'])
		expect(rows[0].origin).toBe('Fighter 2')
	})

	it('keeps the resolver order — granted features by the level they were gained at, then feats, then chosen options', () => {
		const rows = featureActionRows(
			[granted('Rage', { level: 1, entries: [REST] }), granted('Relentless Rage', { level: 11, entries: [REST] })],
			[{ name: 'Lucky', source: 'XPHB', level: 4 }],
			[{ name: 'Lucky', source: 'XPHB', entries: [REST] }],
			[option('Quickened Spell', { consumes: { name: 'Sorcery Points', amount: 2 } })],
		)
		expect(rows.map((row) => row.name)).toEqual(['Rage', 'Relentless Rage', 'Lucky', 'Quickened Spell'])
	})

	it('adds a feat whose own text carries the rest tag, and skips a feat that carries neither', () => {
		const featTexts: FeatTextEntry[] = [
			{ name: 'Lucky', source: 'XPHB', entries: [REST] },
			{ name: 'Alert', source: 'XPHB', entries: ['You gain a bonus to Initiative equal to your Proficiency Bonus.'] },
		]
		const rows = featureActionRows(
			[],
			[
				{ name: 'Lucky', source: 'XPHB', level: 4 },
				{ name: 'Alert', source: 'XPHB', level: 8 },
			],
			featTexts,
			[],
		)
		expect(rows.map((row) => row.name)).toEqual(['Lucky'])
		expect(rows[0].key).toBe('feat|lucky')
	})

	it('matches a feat on name AND source, so a same-named feat from another book is not tested against the wrong text', () => {
		const rows = featureActionRows([], [{ name: 'Lucky', source: 'XPHB', level: 4 }], [{ name: 'Lucky', source: 'PHB', entries: [REST] }], [])
		expect(rows).toEqual([])
	})

	it('gives no row to a feat whose text is missing entirely (D43 — the Feats list reports it)', () => {
		expect(featureActionRows([], [{ name: 'Ghostly Gift', source: 'HOMEBREW', level: 4 }], [], [])).toEqual([])
	})

	/*
	 * The third source. All 38 usable Metamagic / Maneuver / Arcane Shot options
	 * qualify only through `consumes`, so these two cases are the whole gap part A
	 * left open: the pool spender gets a row, the passive style does not.
	 */
	it('gives a chosen Metamagic option a row from `consumes` alone, with no rest tag in its text', () => {
		const rows = featureActionRows([], [], [], [option('Twinned Spell', { consumes: { name: 'Sorcery Points', amount: 1 }, entries: ['When you cast a spell…'] })])
		expect(rows).toEqual([{ key: 'option|twinned spell', name: 'Twinned Spell', resourceName: 'Sorcery Points', origin: null }])
	})

	it('gives no row to a chosen fighting style, which carries neither `consumes` nor a rest tag', () => {
		expect(featureActionRows([], [], [], [option('Defense', { entries: ['While you are wearing armor, you gain a +1 bonus to AC.'] })])).toEqual([])
	})

	it('collapses an option that shares its name with a granted feature into the one row', () => {
		const rows = featureActionRows([granted('Eldritch Smite', { entries: [REST] })], [], [], [option('Eldritch Smite', { consumes: { name: 'Pact Slot' } })])
		expect(rows).toEqual([{ key: 'feature|eldritch smite', name: 'Eldritch Smite', resourceName: 'Eldritch Smite', origin: 'Fighter 1' }])
	})

	it('returns nothing for a character with no features, feats or chosen options', () => {
		expect(featureActionRows([], [], [], [])).toEqual([])
	})

	it('resolves a `consumes` name through resources.ts\'s own alias, same as computeCharacterResources (slice 9b2)', () => {
		const rows = featureActionRows([granted('Stunning Strike', { consumes: { name: 'Ki' }, entries: ['When you hit with an attack…'] })], [], [], [])
		expect(rows).toEqual([{ key: 'feature|stunning strike', name: 'Stunning Strike', resourceName: 'Focus Point', origin: 'Fighter 1' }])
	})

	it('reads a bare-string `consumes` the same as a `{ name }` record', () => {
		const rows = featureActionRows([granted('Wild Shape', { consumes: 'Wild Shape', entries: ['When you finish a rest…'] })], [], [], [])
		expect(rows[0].resourceName).toBe('Wild Shape')
	})

	it('labels each source with its origin: class and level, subclass with its class level, feat with its level, option through the caller', () => {
		const rows = featureActionRows(
			[
				granted('Second Wind', { level: 1, entries: [REST] }),
				granted('Relentless', { level: 18, kind: 'subclass', className: 'Fighter', subclassShortName: 'Battle Master', entries: [REST] }),
			],
			[{ name: 'Lucky', source: 'XPHB', level: 4 }],
			[{ name: 'Lucky', source: 'XPHB', entries: [REST] }],
			[option('Precision Attack', { consumes: { name: 'Superiority Die' } })],
			(chosen) => (chosen.name === 'Precision Attack' ? 'Battle Master' : null),
		)
		expect(rows.map((row) => [row.name, row.origin])).toEqual([
			['Second Wind', 'Fighter 1'],
			['Relentless', 'Battle Master, Fighter 18'],
			['Lucky', 'Feat, level 4'],
			['Precision Attack', 'Battle Master'],
		])
	})
})

describe('grantedFeatureOrigin', () => {
	it('names the class and level, and puts the subclass first for a subclass feature', () => {
		expect(grantedFeatureOrigin({ className: 'Cleric', level: 2 })).toBe('Cleric 2')
		expect(grantedFeatureOrigin({ className: 'Cleric', subclassShortName: 'Life', level: 3 })).toBe('Life, Cleric 3')
	})
})
