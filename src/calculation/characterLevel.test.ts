import { describe, expect, it } from 'vitest'
import { isMulticlass } from './characterLevel'

describe('isMulticlass (D316)', () => {
	it('is true only for more than one class', () => {
		expect(isMulticlass(undefined)).toBe(false)
		expect(isMulticlass([])).toBe(false)
		expect(isMulticlass([{}])).toBe(false)
		expect(isMulticlass([{}, {}])).toBe(true)
	})
})
