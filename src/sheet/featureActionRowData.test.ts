import { describe, expect, it } from 'vitest'
import { featureActionRows } from './featureActionRowData'
import type { GrantedFeature } from './grantedClassFeatures'
import type { FeatTextEntry } from './sheetData'
import type { OptionalFeatureOption } from '../optionalFeatures/optionalFeatureData'

function granted(name: string, over: Partial<GrantedFeature> = {}): GrantedFeature {
	return { id: `cf|${name.toLowerCase()}`, name, level: 1, entries: [], kind: 'class', ...over }
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

	it('leaves every cell but the name to the caller — a row carries a key and a name only', () => {
		const [row] = featureActionRows([granted('Rage', { entries: [REST] })], [], [], [])
		expect(row).toEqual({ key: 'feature|rage', name: 'Rage' })
	})

	it('collapses a feature the data restates at a later level into one row (Action Surge at 2 and 17)', () => {
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
	})

	it('keeps the resolver order — granted features by the level they were gained at, then feats, then chosen options', () => {
		const rows = featureActionRows(
			[granted('Rage', { level: 1, entries: [REST] }), granted('Relentless Rage', { level: 11, entries: [REST] })],
			[{ name: 'Lucky', source: 'XPHB' }],
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
				{ name: 'Lucky', source: 'XPHB' },
				{ name: 'Alert', source: 'XPHB' },
			],
			featTexts,
			[],
		)
		expect(rows.map((row) => row.name)).toEqual(['Lucky'])
		expect(rows[0].key).toBe('feat|lucky')
	})

	it('matches a feat on name AND source, so a same-named feat from another book is not tested against the wrong text', () => {
		const rows = featureActionRows([], [{ name: 'Lucky', source: 'XPHB' }], [{ name: 'Lucky', source: 'PHB', entries: [REST] }], [])
		expect(rows).toEqual([])
	})

	it('gives no row to a feat whose text is missing entirely (D43 — the Feats list reports it)', () => {
		expect(featureActionRows([], [{ name: 'Ghostly Gift', source: 'HOMEBREW' }], [], [])).toEqual([])
	})

	/*
	 * The third source. All 38 usable Metamagic / Maneuver / Arcane Shot options
	 * qualify only through `consumes`, so these two cases are the whole gap part A
	 * left open: the pool spender gets a row, the passive style does not.
	 */
	it('gives a chosen Metamagic option a row from `consumes` alone, with no rest tag in its text', () => {
		const rows = featureActionRows([], [], [], [option('Twinned Spell', { consumes: { name: 'Sorcery Points', amount: 1 }, entries: ['When you cast a spell…'] })])
		expect(rows).toEqual([{ key: 'option|twinned spell', name: 'Twinned Spell' }])
	})

	it('gives no row to a chosen fighting style, which carries neither `consumes` nor a rest tag', () => {
		expect(featureActionRows([], [], [], [option('Defense', { entries: ['While you are wearing armor, you gain a +1 bonus to AC.'] })])).toEqual([])
	})

	it('collapses an option that shares its name with a granted feature into the one row', () => {
		const rows = featureActionRows([granted('Eldritch Smite', { entries: [REST] })], [], [], [option('Eldritch Smite', { consumes: { name: 'Pact Slot' } })])
		expect(rows).toEqual([{ key: 'feature|eldritch smite', name: 'Eldritch Smite' }])
	})

	it('returns nothing for a character with no features, feats or chosen options', () => {
		expect(featureActionRows([], [], [], [])).toEqual([])
	})
})
