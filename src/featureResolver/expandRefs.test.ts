import { describe, expect, it } from 'vitest'
import { buildExpansions } from './expandRefs'
import type { ResolverData } from './refTypes'

describe('buildExpansions', () => {
	it('expands a ref to an existing feature', () => {
		const data: ResolverData = {
			classFeatures: [
				{ name: 'Rage', id: 'cf|rage|barbarian|xphb|1|xphb', entries: ['Rage text.'] },
			],
			subclassFeatures: [],
			optionalFeatures: [],
			feats: [],
		}
		const entries = [{ type: 'refClassFeature', classFeature: 'Rage|Barbarian|XPHB|1|XPHB' }]

		const [expansion] = buildExpansions(entries, data)
		expect(expansion.found).toBe(true)
		expect(expansion.name).toBe('Rage')
		expect(expansion.entries).toEqual(['Rage text.'])
	})

	it('expands a ref nested inside the resolved feature (chained refs)', () => {
		const data: ResolverData = {
			classFeatures: [
				{
					name: 'Channel Divinity',
					id: 'cf|channel divinity|cleric|xphb|2|xphb',
					entries: ['Base text.', { type: 'refFeat', feat: 'Blessed Warrior|XPHB' }],
				},
			],
			subclassFeatures: [],
			optionalFeatures: [],
			feats: [{ name: 'Blessed Warrior', source: 'XPHB', entries: ['Feat text.'] }],
		}
		const entries = [{ type: 'refClassFeature', classFeature: 'Channel Divinity|Cleric|XPHB|2|XPHB' }]

		const [expansion] = buildExpansions(entries, data)
		expect(expansion.found).toBe(true)
		expect(expansion.children).toHaveLength(1)
		expect(expansion.children[0]).toMatchObject({ found: true, name: 'Blessed Warrior' })
	})

	it('reports a not-found ref without crashing', () => {
		const data: ResolverData = { classFeatures: [], subclassFeatures: [], optionalFeatures: [], feats: [] }
		const entries = [{ type: 'refFeat', feat: 'Nonexistent|XPHB' }]

		const [expansion] = buildExpansions(entries, data)
		expect(expansion.found).toBe(false)
		expect(expansion.name).toBe('Nonexistent')
		expect(expansion.children).toEqual([])
	})

	it('does not loop forever on a cycle', () => {
		const data: ResolverData = {
			classFeatures: [
				{ name: 'A', id: 'cf|a|x|xphb|1|xphb', entries: [{ type: 'refClassFeature', classFeature: 'B|X|XPHB|1|XPHB' }] },
				{ name: 'B', id: 'cf|b|x|xphb|1|xphb', entries: [{ type: 'refClassFeature', classFeature: 'A|X|XPHB|1|XPHB' }] },
			],
			subclassFeatures: [],
			optionalFeatures: [],
			feats: [],
		}
		const entries = [{ type: 'refClassFeature', classFeature: 'A|X|XPHB|1|XPHB' }]

		const [a] = buildExpansions(entries, data)
		expect(a.name).toBe('A')
		const [b] = a.children
		expect(b.name).toBe('B')
		// B points back at A, already on this path, so it doesn't re-expand.
		expect(b.children).toEqual([])
	})
})
