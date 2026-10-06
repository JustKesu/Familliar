import { describe, expect, it } from 'vitest'
import { firstClass, isMulticlass } from './characterLevel'

describe('firstClass (D321)', () => {
	const fighter = { className: 'Fighter', classSource: 'XPHB', subclass: null, level: 1 }
	const wizard = { className: 'Wizard', classSource: 'XPHB', subclass: null, level: 2 }

	it('is levelOrder[0] when levelOrder is present', () => {
		const levelOrder = [{ className: 'Wizard', classSource: 'XPHB' }, { className: 'Fighter', classSource: 'XPHB' }, { className: 'Wizard', classSource: 'XPHB' }]
		expect(firstClass({ classes: [fighter, wizard], levelOrder })).toBe(wizard)
	})

	it('falls back to classes[0] when levelOrder is absent or empty', () => {
		expect(firstClass({ classes: [fighter, wizard] })).toBe(fighter)
		expect(firstClass({ classes: [fighter, wizard], levelOrder: [] })).toBe(fighter)
	})

	it('is the only class of a single-class character', () => {
		expect(firstClass({ classes: [wizard], levelOrder: [{ className: 'Wizard', classSource: 'XPHB' }, { className: 'Wizard', classSource: 'XPHB' }] })).toBe(wizard)
		expect(firstClass({ classes: [] })).toBeUndefined()
	})
})

describe('isMulticlass (D316)', () => {
	it('is true only for more than one class', () => {
		expect(isMulticlass(undefined)).toBe(false)
		expect(isMulticlass([])).toBe(false)
		expect(isMulticlass([{}])).toBe(false)
		expect(isMulticlass([{}, {}])).toBe(true)
	})
})
