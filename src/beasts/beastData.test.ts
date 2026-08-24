import { describe, expect, it } from 'vitest'
import {
	extractBeasts,
	familiarFormOptions,
	findFamiliarBeasts,
	hasFindFamiliar,
	hasPactOfTheChain,
	isBeastCreature,
	pactOfTheChainForms,
	type Beast,
} from './beastData'

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

/* beasts.json holds non-Beasts since the Pact of the Chain forms joined it (D67's name-based intake). */
const imp = (): Beast =>
	beast({ name: 'Imp', type: { type: 'fiend', tags: ['devil'] }, cr: '1', crNumber: 1, pactOfTheChain: true })

describe('the Pact of the Chain forms', () => {
	it('are the only entries the flag marks, whatever their CR or type', () => {
		const pool = [beast({ name: 'Owl' }), imp(), beast({ name: 'Venomous Snake', cr: '1/8', crNumber: 0.125, pactOfTheChain: true })]
		expect(pactOfTheChainForms(pool).map((b) => b.name)).toEqual(['Imp', 'Venomous Snake'])
	})

	it('are kept out of the spell\'s own pool, which is Beasts at CR 0', () => {
		expect(findFamiliarBeasts([beast({ name: 'Owl' }), imp()]).map((b) => b.name)).toEqual(['Owl'])
	})

	it('are recognised as non-Beasts by isBeastCreature', () => {
		expect(isBeastCreature(imp())).toBe(false)
		expect(isBeastCreature(beast())).toBe(true)
		expect(isBeastCreature(beast({ type: { type: 'beast', swarmSize: 'T' } }))).toBe(true)
	})
})

describe('familiarFormOptions', () => {
	const pool = [beast({ name: 'Owl' }), imp()]

	it('offers the spell pool alone without the invocation', () => {
		expect(familiarFormOptions(pool, false)).toEqual([{ beast: pool[0], origin: 'spell' }])
	})

	it('adds the invocation forms, labelled, for a character who has it', () => {
		expect(familiarFormOptions(pool, true).map((option) => [option.beast.name, option.origin])).toEqual([
			['Owl', 'spell'],
			['Imp', 'pact-of-the-chain'],
		])
	})

	it('offers a creature in both pools once', () => {
		const both = [beast({ name: 'Owl', pactOfTheChain: true })]
		expect(familiarFormOptions(both, true)).toEqual([{ beast: both[0], origin: 'spell' }])
	})
})

describe('hasPactOfTheChain', () => {
	it('is true when an invocation pick names it, whatever case or padding', () => {
		expect(hasPactOfTheChain([{ choices: ['Agonizing Blast', 'pact of the chain '] }])).toBe(true)
	})

	it('is false for another pact, or for no picks at all', () => {
		expect(hasPactOfTheChain([{ choices: ['Pact of the Blade', 'Pact of the Tome'] }])).toBe(false)
		expect(hasPactOfTheChain([])).toBe(false)
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
