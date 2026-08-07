import { describe, expect, it } from 'vitest'
import { extractSubclassAlwaysPreparedSpells } from './subclassPreparedSpells'

const forgeDomain = {
	entryType: 'subclass',
	name: 'Forge Domain',
	source: 'XPHB',
	className: 'Cleric',
	classSource: 'XPHB',
	additionalSpells: [
		{
			prepared: {
				'3': ['identify', 'searing smite|xphb'],
				'5': ['heat metal', 'magic weapon'],
			},
		},
	],
}

const knownOnlySubclass = {
	entryType: 'subclass',
	name: 'Fiend',
	source: 'XPHB',
	className: 'Warlock',
	classSource: 'XPHB',
	additionalSpells: [
		{
			known: {
				'1': ['burning hands'],
			},
		},
	],
}

const innateOnlySubclass = {
	entryType: 'subclass',
	name: 'Path of the Ancestral Guardian',
	source: 'XPHB',
	className: 'Barbarian',
	classSource: 'XPHB',
	additionalSpells: [
		{
			innate: {
				'10': ['augury', 'clairvoyance'],
			},
		},
	],
}

const mixedPreparedKnownSubclass = {
	entryType: 'subclass',
	name: 'Grave Domain',
	source: 'XPHB',
	className: 'Cleric',
	classSource: 'XPHB',
	additionalSpells: [
		{
			prepared: {
				'1': ['identify'],
			},
			known: {
				'1': ['burning hands'],
			},
		},
	],
}

const wrappedInnateSubclass = {
	entryType: 'subclass',
	name: 'Psi Warrior',
	source: 'XPHB',
	className: 'Fighter',
	classSource: 'XPHB',
	additionalSpells: [
		{
			innate: {
				'18': { daily: { '1': ['heat metal'] } },
			},
		},
	],
}

const nonNumericLevelKeySubclass = {
	entryType: 'subclass',
	name: 'Archfey Patron',
	source: 'XPHB',
	className: 'Warlock',
	classSource: 'XPHB',
	additionalSpells: [
		{
			innate: {
				_: { daily: { cha: ['identify'] } },
			},
		},
	],
}

const expandedPoolOnlySubclass = {
	entryType: 'subclass',
	name: 'Eldritch Knight',
	source: 'XPHB',
	className: 'Fighter',
	classSource: 'XPHB',
	additionalSpells: [
		{
			expanded: {
				'3': [{ all: 'level=0|class=Wizard' }, { all: 'level=1|class=Wizard' }],
			},
		},
	],
}

const expandedPlusKnownSubclass = {
	entryType: 'subclass',
	name: 'Arcane Trickster',
	source: 'XPHB',
	className: 'Rogue',
	classSource: 'XPHB',
	additionalSpells: [
		{
			known: {
				'3': ['burning hands'],
			},
			expanded: {
				'3': [{ all: 'level=0|class=Wizard' }, { all: 'level=1|class=Wizard' }],
			},
		},
	],
}

const noAdditionalSpells = {
	entryType: 'subclass',
	name: 'Champion',
	source: 'XPHB',
	className: 'Fighter',
	classSource: 'XPHB',
	additionalSpells: undefined,
}

const collegeOfLore = {
	entryType: 'subclass',
	name: 'College of Lore',
	source: 'XPHB',
	className: 'Bard',
	classSource: 'XPHB',
	additionalSpells: [
		{
			prepared: {
				'6': [{ choose: 'level=0;1;2;3|class=Cleric;Druid;Wizard' }],
			},
		},
	],
}

const classes = [
	forgeDomain,
	knownOnlySubclass,
	innateOnlySubclass,
	mixedPreparedKnownSubclass,
	wrappedInnateSubclass,
	nonNumericLevelKeySubclass,
	expandedPoolOnlySubclass,
	expandedPlusKnownSubclass,
	noAdditionalSpells,
	collegeOfLore,
]

const identify = { name: 'Identify', source: 'XPHB', level: 1, duration: [{ type: 'instant' }], meta: {} }
const searingSmite = { name: 'Searing Smite', source: 'XPHB', level: 1, duration: [{ type: 'instant' }], meta: {} }
const heatMetal = {
	name: 'Heat Metal',
	source: 'XPHB',
	level: 2,
	duration: [{ type: 'timed', duration: { type: 'minute', amount: 1 }, concentration: true }],
	meta: {},
}
const magicWeapon = { name: 'Magic Weapon', source: 'XPHB', level: 2, duration: [{ type: 'instant' }], meta: {} }
const burningHands = { name: 'Burning Hands', source: 'XPHB', level: 1, duration: [{ type: 'instant' }], meta: {} }
const augury = { name: 'Augury', source: 'XPHB', level: 2, duration: [{ type: 'instant' }], meta: {} }
const clairvoyance = { name: 'Clairvoyance', source: 'XPHB', level: 3, duration: [{ type: 'timed', duration: { type: 'minute', amount: 10 } }], meta: {} }

const spells = [identify, searingSmite, heatMetal, magicWeapon, burningHands, augury, clairvoyance]

describe('extractSubclassAlwaysPreparedSpells', () => {
	it('returns the always-prepared spells granted at or below the given level, marked as subclass-sourced', () => {
		const result = extractSubclassAlwaysPreparedSpells(classes, spells, 'Forge Domain', 'XPHB', 'Cleric', 'XPHB', 3)
		expect(result.map((s) => s.name).sort()).toEqual(['Identify', 'Searing Smite'])
		expect(result.every((s) => s.origin === 'subclass')).toBe(true)
	})

	it('level gating: a spell granted at a higher subclass level is not returned below that level', () => {
		const belowGrant = extractSubclassAlwaysPreparedSpells(classes, spells, 'Forge Domain', 'XPHB', 'Cleric', 'XPHB', 4)
		expect(belowGrant.map((s) => s.name)).not.toContain('Heat Metal')

		const atGrant = extractSubclassAlwaysPreparedSpells(classes, spells, 'Forge Domain', 'XPHB', 'Cleric', 'XPHB', 5)
		expect(atGrant.map((s) => s.name).sort()).toEqual(['Heat Metal', 'Identify', 'Magic Weapon', 'Searing Smite'])
	})

	it('carries the granting class level and resolves a "name|source" reference', () => {
		const result = extractSubclassAlwaysPreparedSpells(classes, spells, 'Forge Domain', 'XPHB', 'Cleric', 'XPHB', 3)
		const searing = result.find((s) => s.name === 'Searing Smite')
		expect(searing?.grantedAtLevel).toBe(3)
		expect(searing?.source).toBe('XPHB')
	})

	it('carries concentration and ritual flags through', () => {
		const result = extractSubclassAlwaysPreparedSpells(classes, spells, 'Forge Domain', 'XPHB', 'Cleric', 'XPHB', 5)
		expect(result.find((s) => s.name === 'Heat Metal')?.concentration).toBe(true)
		expect(result.find((s) => s.name === 'Identify')?.concentration).toBe(false)
	})

	it('a subclass granting fixed spells under `known` (not `prepared`) is returned, marked subclass-sourced, level-gated (d6a)', () => {
		const belowGrant = extractSubclassAlwaysPreparedSpells(classes, spells, 'Fiend', 'XPHB', 'Warlock', 'XPHB', 0)
		expect(belowGrant).toEqual([])

		const atGrant = extractSubclassAlwaysPreparedSpells(classes, spells, 'Fiend', 'XPHB', 'Warlock', 'XPHB', 5)
		expect(atGrant.map((s) => s.name)).toEqual(['Burning Hands'])
		expect(atGrant[0].origin).toBe('subclass')
		expect(atGrant[0].grantedAtLevel).toBe(1)
	})

	it('a subclass granting fixed spells under `innate` is returned the same way, level-gated (d6a)', () => {
		const belowGrant = extractSubclassAlwaysPreparedSpells(classes, spells, 'Path of the Ancestral Guardian', 'XPHB', 'Barbarian', 'XPHB', 9)
		expect(belowGrant).toEqual([])

		const atGrant = extractSubclassAlwaysPreparedSpells(classes, spells, 'Path of the Ancestral Guardian', 'XPHB', 'Barbarian', 'XPHB', 10)
		expect(atGrant.map((s) => s.name).sort()).toEqual(['Augury', 'Clairvoyance'])
	})

	it('a subclass mixing `prepared` with another fixed key returns all its fixed spells once, none dropped, none doubled (d6a)', () => {
		const result = extractSubclassAlwaysPreparedSpells(classes, spells, 'Grave Domain', 'XPHB', 'Cleric', 'XPHB', 1)
		expect(result.map((s) => s.name).sort()).toEqual(['Burning Hands', 'Identify'])
	})

	it('unwraps a `resource`/`daily`/`ritual`-nested grant one level deep and returns it as a plain grant (d6a)', () => {
		const result = extractSubclassAlwaysPreparedSpells(classes, spells, 'Psi Warrior', 'XPHB', 'Fighter', 'XPHB', 18)
		expect(result.map((s) => s.name)).toEqual(['Heat Metal'])
	})

	it('a non-numeric level key (Warlock Archfey Patron\'s "_") is skipped cleanly, not granted at every level (d6a)', () => {
		const result = extractSubclassAlwaysPreparedSpells(classes, spells, 'Archfey Patron', 'XPHB', 'Warlock', 'XPHB', 20)
		expect(result).toEqual([])
	})

	it('an `expanded`-only subclass (pool-widening, e.g. Eldritch Knight) returns nothing — deferred, not invented (d6a)', () => {
		const result = extractSubclassAlwaysPreparedSpells(classes, spells, 'Eldritch Knight', 'XPHB', 'Fighter', 'XPHB', 20)
		expect(result).toEqual([])
	})

	it('a subclass mixing `expanded` (pool-widening) with a genuine fixed `known` grant returns only the fixed part (d6a)', () => {
		const result = extractSubclassAlwaysPreparedSpells(classes, spells, 'Arcane Trickster', 'XPHB', 'Rogue', 'XPHB', 20)
		expect(result.map((s) => s.name)).toEqual(['Burning Hands'])
	})

	it('a subclass with no additionalSpells at all returns nothing, cleanly', () => {
		const result = extractSubclassAlwaysPreparedSpells(classes, spells, 'Champion', 'XPHB', 'Fighter', 'XPHB', 5)
		expect(result).toEqual([])
	})

	it('a nested choice inside `prepared` (Bard College of Lore) is skipped cleanly, not invented', () => {
		const result = extractSubclassAlwaysPreparedSpells(classes, spells, 'College of Lore', 'XPHB', 'Bard', 'XPHB', 10)
		expect(result).toEqual([])
	})

	it('an unresolvable subclass identity returns nothing, cleanly', () => {
		const result = extractSubclassAlwaysPreparedSpells(classes, spells, 'Nonexistent', 'XPHB', 'Cleric', 'XPHB', 5)
		expect(result).toEqual([])
	})
})
