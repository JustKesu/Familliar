import { describe, expect, it } from 'vitest'
import { TOTAL_ATTACKS_BY_FEATURE_NAME, totalAttacksAmong, totalAttacksForFeatureName } from './extraAttackData'

/*
 * Nothing consumes this table yet — attacks are build order step 7. It is
 * tested now because the point of a D70 hand table is that it is verifiable
 * against the quoted rules text, and a table nobody checks is worth less than
 * no table at all.
 */

describe('totalAttacksForFeatureName', () => {
	it('reads TOTAL attacks, not extra ones — "Extra Attack" is two attacks, not one', () => {
		expect(totalAttacksForFeatureName('Extra Attack')).toBe(2)
		expect(totalAttacksForFeatureName('Two Extra Attacks')).toBe(3)
		expect(totalAttacksForFeatureName('Three Extra Attacks')).toBe(4)
	})

	it('records exactly the three names the data carries, and nothing else', () => {
		expect(Object.keys(TOTAL_ATTACKS_BY_FEATURE_NAME).sort()).toEqual(['Extra Attack', 'Three Extra Attacks', 'Two Extra Attacks'])
	})

	it('a name not in the table gets null, never a count decoded out of the words in it (D70)', () => {
		expect(totalAttacksForFeatureName('Four Extra Attacks')).toBeNull()
		expect(totalAttacksForFeatureName('Second Wind')).toBeNull()
		expect(totalAttacksForFeatureName('extra attack')).toBeNull()
	})
})

describe('totalAttacksAmong', () => {
	it('a character with none of these features still attacks once', () => {
		expect(totalAttacksAmong([])).toBe(1)
		expect(totalAttacksAmong(['Second Wind', 'Action Surge'])).toBe(1)
	})

	it('a Fighter at 11 holds both features; they replace each other, so the higher one wins whichever order they arrive in', () => {
		expect(totalAttacksAmong(['Extra Attack', 'Two Extra Attacks'])).toBe(3)
		expect(totalAttacksAmong(['Two Extra Attacks', 'Extra Attack'])).toBe(3)
	})

	it('a Fighter at 20 holds all three', () => {
		expect(totalAttacksAmong(['Extra Attack', 'Two Extra Attacks', 'Three Extra Attacks'])).toBe(4)
	})

	it('a level-5 martial holds only the first', () => {
		expect(totalAttacksAmong(['Extra Attack'])).toBe(2)
	})
})
