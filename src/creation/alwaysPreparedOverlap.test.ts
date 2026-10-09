import { describe, expect, it } from 'vitest'
import { splitAlwaysPreparedPicks } from './alwaysPreparedOverlap'

describe('splitAlwaysPreparedPicks (D339)', () => {
	const picks = [
		{ name: 'Bless', source: 'XPHB', level: 1 },
		{ name: 'Bless', source: 'PHB', level: 1 },
		{ name: 'Command', source: 'XPHB', level: 1 },
	]

	it('splits by name and source', () => {
		expect(splitAlwaysPreparedPicks(picks, [{ name: 'Bless', source: 'XPHB' }])).toEqual({ kept: picks.slice(1), removed: [picks[0]] })
	})

	it('an empty list removes nothing', () => {
		expect(splitAlwaysPreparedPicks(picks, [])).toEqual({ kept: picks, removed: [] })
	})
})
