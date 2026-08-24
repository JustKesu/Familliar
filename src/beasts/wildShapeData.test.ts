import { describe, expect, it } from 'vitest'
import type { Beast } from './beastData'
import { formatCr, isLegalWildShapeForm, wildShapeForms, wildShapeLimits, wildShapeLimitsFor } from './wildShapeData'

function beast(overrides: Partial<Beast> = {}): Beast {
	return {
		name: 'Wolf',
		source: 'XMM',
		size: ['M'],
		type: 'beast',
		cr: '1/4',
		crNumber: 0.25,
		ac: [13],
		hp: { average: 11, formula: '2d8 + 2' },
		speed: { walk: 40 },
		str: 14,
		dex: 15,
		con: 12,
		int: 3,
		wis: 12,
		cha: 6,
		action: [{ name: 'Bite', entries: ['{@atkr m} {@hit 4}, reach 5 ft. {@h} 7 Piercing damage.'] }],
		...overrides,
	}
}

/*
 * The numbers below are the "Beast Shapes" table printed inside the Wild
 * Shape feature (see wildShapeData.ts's header) — level 2: 4 forms, CR 1/4,
 * no fly; level 4: 6 forms, CR 1/2, no fly; level 8: 8 forms, CR 1, fly.
 */
describe('wildShapeLimits — the Beast Shapes table', () => {
	it('gives nothing to a non-Druid or a Druid below level 2', () => {
		expect(wildShapeLimits('Fighter', 20, null)).toBeNull()
		expect(wildShapeLimits('Druid', 1, null)).toBeNull()
	})

	it('matches the table at each of its three steps', () => {
		expect(wildShapeLimits('Druid', 2, null)).toMatchObject({ knownForms: 4, maxCr: 0.25, maxCrLabel: '1/4', flyAllowed: false })
		expect(wildShapeLimits('Druid', 4, null)).toMatchObject({ knownForms: 6, maxCr: 0.5, maxCrLabel: '1/2', flyAllowed: false })
		expect(wildShapeLimits('Druid', 8, null)).toMatchObject({ knownForms: 8, maxCr: 1, maxCrLabel: '1', flyAllowed: true })
	})

	it('holds a step until the next one is reached', () => {
		expect(wildShapeLimits('Druid', 3, null)).toMatchObject({ knownForms: 4, maxCr: 0.25 })
		expect(wildShapeLimits('Druid', 7, null)).toMatchObject({ knownForms: 6, maxCr: 0.5, flyAllowed: false })
		expect(wildShapeLimits('Druid', 20, null)).toMatchObject({ knownForms: 8, maxCr: 1, flyAllowed: true })
	})

	/* "starting at level 8, you can adopt a form that has a Fly Speed" */
	it('allows a Fly Speed from level 8 and not before', () => {
		expect(wildShapeLimits('Druid', 7, null)?.flyAllowed).toBe(false)
		expect(wildShapeLimits('Druid', 8, null)?.flyAllowed).toBe(true)
	})
})

/* Circle Forms: "The maximum Challenge Rating for the form equals your Druid level divided by 3 (round down)." */
describe('wildShapeLimits — Circle of the Moon', () => {
	it('computes the cap as level / 3 rounded down', () => {
		expect(wildShapeLimits('Druid', 3, 'Circle of the Moon')).toMatchObject({ maxCr: 1, maxCrLabel: '1', moonCap: true })
		expect(wildShapeLimits('Druid', 8, 'Circle of the Moon')).toMatchObject({ maxCr: 2, moonCap: true })
		expect(wildShapeLimits('Druid', 17, 'Circle of the Moon')).toMatchObject({ maxCr: 5, moonCap: true })
		expect(wildShapeLimits('Druid', 20, 'Circle of the Moon')).toMatchObject({ maxCr: 6, moonCap: true })
	})

	it('leaves known forms and the Fly Speed gate alone — Circle Forms speaks only about CR', () => {
		expect(wildShapeLimits('Druid', 3, 'Circle of the Moon')?.knownForms).toBe(4)
		expect(wildShapeLimits('Druid', 7, 'Circle of the Moon')?.flyAllowed).toBe(false)
		expect(wildShapeLimits('Druid', 8, 'Circle of the Moon')?.knownForms).toBe(8)
	})

	it('does not apply to another circle, or below the level Circle Forms is granted', () => {
		expect(wildShapeLimits('Druid', 8, 'Circle of the Land')).toMatchObject({ maxCr: 1, moonCap: false })
		expect(wildShapeLimits('Druid', 2, 'Circle of the Moon')).toMatchObject({ maxCr: 0.25, moonCap: false })
	})
})

describe('wildShapeLimitsFor', () => {
	it('finds the Druid among several classes (D11)', () => {
		const found = wildShapeLimitsFor([
			{ className: 'Fighter', classSource: 'XPHB', subclass: 'Champion', level: 3 },
			{ className: 'Druid', classSource: 'XPHB', subclass: 'Circle of the Moon', level: 6 },
		])
		expect(found?.className).toBe('Druid')
		expect(found?.limits.maxCr).toBe(2)
	})

	it('is null when no class has Wild Shape', () => {
		expect(wildShapeLimitsFor([{ className: 'Rogue', classSource: 'XPHB', subclass: null, level: 5 }])).toBeNull()
	})
})

describe('wildShapeForms — the offered pool', () => {
	const pool: Beast[] = [
		beast({ name: 'Rat', cr: '0', crNumber: 0 }),
		beast({ name: 'Wolf', cr: '1/4', crNumber: 0.25 }),
		beast({ name: 'Black Bear', cr: '1/2', crNumber: 0.5 }),
		beast({ name: 'Brown Bear', cr: '1', crNumber: 1 }),
		beast({ name: 'Owl', cr: '0', crNumber: 0, speed: { walk: 5, fly: 60 } }),
		beast({ name: 'Swarm of Rats', cr: '1/4', crNumber: 0.25, type: { type: 'beast', swarmSize: 'T' } }),
	]

	it('caps by CR', () => {
		const level2 = wildShapeForms(pool, wildShapeLimits('Druid', 2, null)!)
		expect(level2.map((b) => b.name)).toEqual(['Rat', 'Wolf'])
	})

	it('excludes a form with a Fly Speed until level 8, then includes it', () => {
		expect(wildShapeForms(pool, wildShapeLimits('Druid', 4, null)!).map((b) => b.name)).not.toContain('Owl')
		expect(wildShapeForms(pool, wildShapeLimits('Druid', 8, null)!).map((b) => b.name)).toContain('Owl')
	})

	/* beasts.json also carries the Pact of the Chain forms, and a Skeleton at CR 1/4 sits well inside the caps. Wild Shape takes Beasts. */
	it('never offers a non-Beast that the familiar intake put in the file', () => {
		const withChainForm = [...pool, beast({ name: 'Skeleton', cr: '1/4', crNumber: 0.25, type: 'undead', pactOfTheChain: true })]
		for (const level of [2, 4, 8, 20]) {
			expect(wildShapeForms(withChainForm, wildShapeLimits('Druid', level, null)!).map((b) => b.name)).not.toContain('Skeleton')
		}
	})

	/* Every row of the Beast Shapes table states its Max CR as a filter carrying `miscellaneous=!swarm`. */
	it('never offers a swarm', () => {
		for (const level of [2, 4, 8, 20]) {
			expect(wildShapeForms(pool, wildShapeLimits('Druid', level, null)!).map((b) => b.name)).not.toContain('Swarm of Rats')
		}
	})

	it("widens with Circle of the Moon's higher cap", () => {
		const moon = wildShapeForms(pool, wildShapeLimits('Druid', 3, 'Circle of the Moon')!)
		expect(moon.map((b) => b.name)).toContain('Brown Bear')
		const land = wildShapeForms(pool, wildShapeLimits('Druid', 3, 'Circle of the Land')!)
		expect(land.map((b) => b.name)).not.toContain('Brown Bear')
	})

	it('a zero fly speed does not count as a Fly Speed', () => {
		const grounded = [beast({ name: 'Badger', cr: '0', crNumber: 0, speed: { walk: 20, fly: 0 } })]
		expect(wildShapeForms(grounded, wildShapeLimits('Druid', 2, null)!)).toHaveLength(1)
	})

	it('isLegalWildShapeForm agrees with the pool', () => {
		const limits = wildShapeLimits('Druid', 2, null)!
		expect(isLegalWildShapeForm(pool, limits, { name: 'Wolf', source: 'XMM' })).toBe(true)
		expect(isLegalWildShapeForm(pool, limits, { name: 'Brown Bear', source: 'XMM' })).toBe(false)
	})
})

describe('formatCr', () => {
	it('writes fractions the way a stat block does', () => {
		expect(formatCr(0.125)).toBe('1/8')
		expect(formatCr(0.25)).toBe('1/4')
		expect(formatCr(0.5)).toBe('1/2')
		expect(formatCr(0)).toBe('0')
		expect(formatCr(6)).toBe('6')
	})
})
