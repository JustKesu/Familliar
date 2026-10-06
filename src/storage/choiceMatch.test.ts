import { describe, expect, it } from 'vitest'
import { chosenOptionalFeatureOptions } from '../optionalFeatures/optionalFeatureData'
import { pickSourceLookup } from '../optionalFeatures/pickSources'
import { hasFightingStyle } from '../calculation/fightingStyles'
import { CharacterStore, type KeyValueStorage } from './characterStore'
import { findPicked, matchesPick } from './choiceMatch'

class MemoryStorage implements KeyValueStorage {
	private data = new Map<string, string>()
	getItem(key: string): string | null {
		return this.data.get(key) ?? null
	}
	setItem(key: string, value: string): void {
		this.data.set(key, value)
	}
	removeItem(key: string): void {
		this.data.delete(key)
	}
}

// The data has no same-named pair from two books (M1b survey, DATA.md), so the pair is a fixture.
const OLD = { name: 'Shove', source: 'PHB', featureType: ['MV:B'], entries: ['Old text.'] }
const NEW = { name: 'Shove', source: 'XPHB', featureType: ['MV:B'], entries: ['New text.'] }
const OPTIONS = [OLD, NEW]
const STYLE_OLD = { name: 'Archery', source: 'PHB', category: 'FS', entries: ['Old archery.'] }
const STYLE_NEW = { name: 'Archery', source: 'XPHB', category: 'FS', entries: ['New archery.'] }
const FEATS = [STYLE_OLD, STYLE_NEW]

describe('the D318 matching rule', () => {
	it('a pick with a source matches name and source', () => {
		expect(matchesPick({ name: 'Shove', source: 'XPHB' }, NEW)).toBe(true)
		expect(matchesPick({ name: 'Shove', source: 'XPHB' }, OLD)).toBe(false)
		expect(findPicked(OPTIONS, { name: 'shove', source: 'XPHB' })).toBe(NEW)
	})

	it('a pick without a source matches by name, first hit, as before', () => {
		expect(matchesPick({ name: 'Shove' }, OLD)).toBe(true)
		expect(matchesPick({ name: 'Shove' }, NEW)).toBe(true)
		expect(findPicked(OPTIONS, { name: 'SHOVE' })).toBe(OLD)
		expect(findPicked(OPTIONS, { name: 'Parry' })).toBeUndefined()
	})

	it('a pick whose source the data no longer has matches nothing', () => {
		expect(findPicked(OPTIONS, { name: 'Shove', source: 'TCE' })).toBeUndefined()
	})

	it('two same-named options from two sources stay distinct after save and reload', () => {
		const store = new CharacterStore(new MemoryStorage())
		store.create({
			name: 'Aria',
			classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Battle Master', level: 3 }],
			fightingStyles: [{ className: 'Fighter', classSource: 'XPHB', name: 'Archery', source: 'XPHB' }],
			optionalFeatureChoices: [{ featureType: 'MV:B', choices: [{ name: 'Shove', source: 'XPHB' }, { name: 'Shove', source: 'PHB' }] }],
		})
		const [reloaded] = store.list()
		const resolved = chosenOptionalFeatureOptions(OPTIONS, FEATS, reloaded.optionalFeatureChoices ?? [], reloaded.fightingStyles)
		expect(resolved.map((option) => `${option.name}|${option.source}|${option.featureType}`)).toEqual(['Shove|XPHB|MV:B', 'Shove|PHB|MV:B', 'Archery|XPHB|FS'])
		expect(resolved[0].entries).toEqual(['New text.'])
		expect(resolved[1].entries).toEqual(['Old text.'])
	})

	it('a sourceless style still applies by name, and a sourced one through its own row', () => {
		const feats = FEATS.map(({ name, source }) => ({ name, source }))
		const character = (style: { name: string; source?: string }) => ({ id: '1', name: 'Aria', classes: [], fightingStyles: [style] })
		expect(hasFightingStyle(character({ name: 'Archery' }), feats, 'Archery')).toBe(true)
		expect(hasFightingStyle(character({ name: 'Archery', source: 'PHB' }), feats, 'Archery')).toBe(true)
		expect(hasFightingStyle(character({ name: 'Defense' }), feats, 'Archery')).toBe(false)
	})

	it('the save-time lookup records the first same-named row, the one a sourceless pick reads as', () => {
		const lookup = pickSourceLookup(OPTIONS, FEATS)
		expect(lookup('MV:B', 'Shove')).toBe('PHB')
		expect(lookup('FS', 'Archery')).toBe('PHB')
		expect(lookup('FS:B', 'Archery')).toBe('PHB')
		expect(lookup('MV:B', 'Parry')).toBeUndefined()
	})
})
