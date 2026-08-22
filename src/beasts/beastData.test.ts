import { describe, expect, it } from 'vitest'
import { extractBeasts, findFamiliarBeasts, hasFindFamiliar, type Beast } from './beastData'

function beast(overrides: Partial<Beast> = {}): Beast {
	return {
		name: 'Bat',
		source: 'XMM',
		size: ['T'],
		type: 'beast',
		cr: '0',
		crNumber: 0,
		ac: [12],
		hp: { average: 1, formula: '1d4 - 1' },
		speed: { walk: 5, fly: 30 },
		str: 2,
		dex: 15,
		con: 8,
		int: 2,
		wis: 12,
		cha: 4,
		action: [{ name: 'Bite', entries: ['{@atkr m} {@hit 0}, reach 5 ft. {@h} 1 Piercing damage.'] }],
		...overrides,
	}
}

describe('extractBeasts', () => {
	it('throws when the file is not an array', () => {
		expect(() => extractBeasts({ beast: [] })).toThrow(/expected a top-level array/)
	})

	it('keeps well-formed entries and drops malformed ones', () => {
		const parsed = [beast(), { name: 'Broken', source: 'XMM' }, null, 'nonsense']
		const result = extractBeasts(parsed)
		expect(result.map((b) => b.name)).toEqual(['Bat'])
	})

	it('keeps a beast that carries none of the optional fields', () => {
		const bare = beast()
		delete bare.skill
		delete bare.senses
		delete bare.trait
		expect(extractBeasts([bare])).toHaveLength(1)
	})
})

describe('findFamiliarBeasts', () => {
	it('keeps CR 0 and drops anything above it', () => {
		const pool = [beast({ name: 'Cat' }), beast({ name: 'Venomous Snake', cr: '1/8', crNumber: 0.125 })]
		expect(findFamiliarBeasts(pool).map((b) => b.name)).toEqual(['Cat'])
	})

	/* The spell's own {@filter} excludes swarms alongside the CR 0 limit. */
	it('drops a swarm even at CR 0', () => {
		const pool = [beast({ name: 'Rat' }), beast({ name: 'Swarm of Rats', type: { type: 'beast', swarmSize: 'T' } })]
		expect(findFamiliarBeasts(pool).map((b) => b.name)).toEqual(['Rat'])
	})

	it('keeps a beast whose type object carries tags rather than a swarm size', () => {
		const pool = [beast({ name: 'Compsognathus', type: { type: 'beast', tags: ['dinosaur'] } })]
		expect(findFamiliarBeasts(pool)).toHaveLength(1)
	})
})

describe('hasFindFamiliar', () => {
	it('finds the spell whatever case the list uses', () => {
		expect(hasFindFamiliar([{ name: 'Mage Hand' }, { name: 'find familiar' }])).toBe(true)
		expect(hasFindFamiliar([{ name: 'Find Familiar' }])).toBe(true)
	})

	it('is false for a list without it', () => {
		expect(hasFindFamiliar([{ name: 'Find Steed' }, { name: 'Fireball' }])).toBe(false)
		expect(hasFindFamiliar([])).toBe(false)
	})
})
