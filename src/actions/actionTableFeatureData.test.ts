import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { isActionTableFeature } from './actionTableFeatureData'

describe('isActionTableFeature — fixture shapes', () => {
	it('true when the feature carries consumes, regardless of entries', () => {
		expect(isActionTableFeature({ name: 'Flurry of Blows', consumes: { name: 'Focus Point' }, entries: ['Immediately after you take the Attack action.'] })).toBe(true)
	})

	it('true when entries mention the Long Rest variantrule tag, at the top level', () => {
		expect(isActionTableFeature({ name: 'X', entries: ['You regain all uses when you finish a {@variantrule Long Rest|XPHB}.'] })).toBe(true)
	})

	it('true for the Short Rest tag too', () => {
		expect(isActionTableFeature({ name: 'X', entries: ['Usable again after a {@variantrule Short Rest|XPHB|Short}.'] })).toBe(true)
	})

	it('finds the tag nested inside a list item', () => {
		expect(
			isActionTableFeature({
				name: 'X',
				entries: [{ type: 'list', items: ['Regains on a {@variantrule Long Rest|XPHB}.'] }],
			}),
		).toBe(true)
	})

	it('finds the tag nested inside a nested entries block', () => {
		expect(
			isActionTableFeature({
				name: 'X',
				entries: [{ type: 'entries', name: 'Uses', entries: ['Ends after a {@variantrule Short Rest|XPHB}.'] }],
			}),
		).toBe(true)
	})

	it('false with neither consumes nor a rest tag', () => {
		expect(isActionTableFeature({ name: 'Draconic Resilience', entries: ['Your AC equals 10 + your Dexterity modifier + your Charisma modifier.'] })).toBe(false)
	})

	it('false when entries mention rest in plain prose, without the tag (D86 accepted false negative)', () => {
		expect(isActionTableFeature({ name: 'X', entries: ['You regain all uses when you finish a long rest.'] })).toBe(false)
	})

	it('false for a non-record input, never throws', () => {
		expect(isActionTableFeature(null)).toBe(false)
		expect(isActionTableFeature(undefined)).toBe(false)
		expect(isActionTableFeature('Rage')).toBe(false)
		expect(isActionTableFeature(['entries'])).toBe(false)
	})
})

/*
 * D86 was verified against the real generated data before being written
 * (this session's investigation); this guard keeps that verification
 * running rather than trusting it stayed true. Same pattern as
 * resolveRefAgainstData.test.ts: read data/ once, assert on the real files.
 */
function read(name: string): unknown[] {
	const parsed = JSON.parse(readFileSync(`data/${name}`, 'utf8'))
	if (!Array.isArray(parsed)) throw new Error(`data/${name}: expected a top-level array.`)
	return parsed
}

describe('isActionTableFeature — against the generated data (D86)', () => {
	const classFeatures = read('class-features.json')

	const KNOWN_ACTION_FEATURES = ['Second Wind', 'Action Surge', 'Rage', 'Bardic Inspiration', 'Channel Divinity', 'Font of Magic', 'Innate Sorcery', 'Wild Shape', 'Lay on Hands']

	it.each(KNOWN_ACTION_FEATURES)('%s: at least one of its class-features.json records qualifies', (name) => {
		const records = classFeatures.filter((entry) => (entry as Record<string, unknown>)['name'] === name)
		expect(records.length).toBeGreaterThan(0)
		expect(records.some((entry) => isActionTableFeature(entry))).toBe(true)
	})

	it('a passive feature with no consumes and no rest tag does not qualify — Draconic Resilience (Sorcerer, Draconic)', () => {
		const subclassFeatures = read('subclass-features.json')
		const records = subclassFeatures.filter((entry) => (entry as Record<string, unknown>)['name'] === 'Draconic Resilience')
		expect(records.length).toBe(1)
		expect(isActionTableFeature(records[0])).toBe(false)
	})
})
