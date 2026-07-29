import { describe, expect, it } from 'vitest'
import { distinctRefs, scanRefs } from './scanRefs'

describe('scanRefs', () => {
	it('finds a top-level ref', () => {
		const entries = [{ type: 'refClassFeature', classFeature: 'Rage|Barbarian|XPHB|1|XPHB' }]
		expect(scanRefs(entries)).toEqual([{ kind: 'classFeature', uid: 'Rage|Barbarian|XPHB|1|XPHB' }])
	})

	it('finds a ref nested inside entries > options', () => {
		const entries = [
			{
				type: 'entries',
				entries: [
					{
						type: 'options',
						entries: [{ type: 'refOptionalfeature', optionalfeature: 'Careful Spell|XPHB' }],
					},
				],
			},
		]
		expect(scanRefs(entries)).toEqual([{ kind: 'optionalfeature', uid: 'Careful Spell|XPHB' }])
	})

	it('finds a ref that is itself a list item', () => {
		const entries = [
			{
				type: 'list',
				items: [{ type: 'refFeat', feat: 'Blessed Warrior|XPHB' }],
			},
		]
		expect(scanRefs(entries)).toEqual([{ kind: 'feat', uid: 'Blessed Warrior|XPHB' }])
	})

	it('dedupes repeated refs to the same target', () => {
		const entries = [
			{ type: 'refClassFeature', classFeature: 'Rage|Barbarian|XPHB|1|XPHB' },
			{ type: 'refClassFeature', classFeature: 'Rage|Barbarian|XPHB|1|XPHB' },
		]
		expect(scanRefs(entries)).toHaveLength(2)
		expect(distinctRefs(entries)).toHaveLength(1)
	})

	it('returns nothing for plain prose', () => {
		expect(scanRefs(['Just some text.'])).toEqual([])
	})
})
