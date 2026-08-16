import { describe, expect, it } from 'vitest'
import { extractSubclassAlwaysPreparedSpells, levelForPactSlotRank } from './subclassPreparedSpells'

/** Real Warlock Pact Magic slotLevel-by-character-level progression (spellSlots.ts's PactSlots.slotLevel), levels 1-9: rank rises at 1st/3rd/5th/7th/9th. */
const warlockPactSlotsByLevel = [
	{ count: 1, slotLevel: 1 },
	{ count: 2, slotLevel: 1 },
	{ count: 2, slotLevel: 2 },
	{ count: 2, slotLevel: 2 },
	{ count: 2, slotLevel: 3 },
	{ count: 2, slotLevel: 3 },
	{ count: 2, slotLevel: 4 },
	{ count: 2, slotLevel: 4 },
	{ count: 2, slotLevel: 5 },
]

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

const hexblade = {
	entryType: 'subclass',
	name: 'The Hexblade',
	source: 'XGE',
	className: 'Warlock',
	classSource: 'XPHB',
	additionalSpells: [
		{
			expanded: {
				s1: ['shield', 'wrathful smite'],
				s2: ['blur', 'branding smite'],
				s3: ['blink', 'elemental weapon'],
			},
		},
	],
}

const fathomless = {
	entryType: 'subclass',
	name: 'The Fathomless',
	source: 'TCE',
	className: 'Warlock',
	classSource: 'XPHB',
	additionalSpells: [
		{
			expanded: {
				s1: ['create or destroy water', 'thunderwave'],
				s2: ['gust of wind', 'silence'],
				s3: ['lightning bolt', 'sleet storm'],
			},
		},
	],
}

/** The real, in-use Celestial subclass entry (XPHB "Celestial Patron") — `known`/`prepared` only, no `expanded` at all (D6a's already-handled shape). */
const celestialPatron = {
	entryType: 'subclass',
	name: 'Celestial Patron',
	source: 'XPHB',
	className: 'Warlock',
	classSource: 'XPHB',
	additionalSpells: [
		{
			known: {
				'1': ['sacred flame|xphb#c'],
			},
			prepared: {
				'3': ['cure wounds|xphb'],
			},
		},
	],
}

/** Warlock The Genie: 4 additionalSpells entries (one per genie kind), each with its own rank-keyed `expanded` — nothing stores which kind was picked, so this must stay deferred (guarded structurally: more than one entry). */
const genie = {
	entryType: 'subclass',
	name: 'The Genie',
	source: 'TCE',
	className: 'Warlock',
	classSource: 'XPHB',
	additionalSpells: [
		{ name: 'Dao', expanded: { s1: ['sanctuary'] } },
		{ name: 'Djinni', expanded: { s1: ['thunderwave'] } },
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
	hexblade,
	fathomless,
	celestialPatron,
	genie,
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

const shield = { name: 'Shield', source: 'XPHB', level: 1, duration: [{ type: 'instant' }], meta: {} }
const wrathfulSmite = { name: 'Wrathful Smite', source: 'XPHB', level: 1, duration: [{ type: 'instant' }], meta: {} }
const blur = { name: 'Blur', source: 'XPHB', level: 2, duration: [{ type: 'timed', duration: { type: 'minute', amount: 1 }, concentration: true }], meta: {} }
const brandingSmite = { name: 'Branding Smite', source: 'XPHB', level: 2, duration: [{ type: 'instant' }], meta: {} }
const blink = { name: 'Blink', source: 'XPHB', level: 3, duration: [{ type: 'instant' }], meta: {} }
const elementalWeapon = { name: 'Elemental Weapon', source: 'XPHB', level: 3, duration: [{ type: 'instant' }], meta: {} }
const createOrDestroyWater = { name: 'Create or Destroy Water', source: 'XPHB', level: 1, duration: [{ type: 'instant' }], meta: {} }
const thunderwave = { name: 'Thunderwave', source: 'XPHB', level: 1, duration: [{ type: 'instant' }], meta: {} }
const gustOfWind = { name: 'Gust of Wind', source: 'XPHB', level: 2, duration: [{ type: 'timed', duration: { type: 'minute', amount: 1 }, concentration: true }], meta: {} }
const silence = { name: 'Silence', source: 'XPHB', level: 2, duration: [{ type: 'timed', duration: { type: 'minute', amount: 10 } }, { type: 'instant' }], meta: {} }
const sacredFlame = { name: 'Sacred Flame', source: 'XPHB', level: 0, duration: [{ type: 'instant' }], meta: {} }
const cureWounds = { name: 'Cure Wounds', source: 'XPHB', level: 1, duration: [{ type: 'instant' }], meta: {} }

const spells = [
	identify,
	searingSmite,
	heatMetal,
	magicWeapon,
	burningHands,
	augury,
	clairvoyance,
	shield,
	wrathfulSmite,
	blur,
	brandingSmite,
	blink,
	elementalWeapon,
	createOrDestroyWater,
	thunderwave,
	gustOfWind,
	silence,
	sacredFlame,
	cureWounds,
]

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

	describe('pact-slot-rank-keyed `expanded` grant (Hexblade/Fathomless follow-up)', () => {
		it('Hexblade at pact slot rank 2 (character level 3): rank-1 and rank-2 spells present, rank-3 not yet', () => {
			const result = extractSubclassAlwaysPreparedSpells(classes, spells, 'The Hexblade', 'XGE', 'Warlock', 'XPHB', 3, warlockPactSlotsByLevel)
			expect(result.map((s) => s.name).sort()).toEqual(['Blur', 'Branding Smite', 'Shield', 'Wrathful Smite'])
			expect(result.every((s) => s.origin === 'subclass')).toBe(true)
		})

		it('Fathomless at pact slot rank 2 (character level 3): its own rank-1 and rank-2 spells present, rank-3 not yet', () => {
			const result = extractSubclassAlwaysPreparedSpells(classes, spells, 'The Fathomless', 'TCE', 'Warlock', 'XPHB', 3, warlockPactSlotsByLevel)
			expect(result.map((s) => s.name).sort()).toEqual(['Create or Destroy Water', 'Gust of Wind', 'Silence', 'Thunderwave'])
		})

		it('level gating: a rank-3 spell is absent below character level 5 (where pact slot level first reaches 3) and present at/above it', () => {
			const belowRank3 = extractSubclassAlwaysPreparedSpells(classes, spells, 'The Hexblade', 'XGE', 'Warlock', 'XPHB', 4, warlockPactSlotsByLevel)
			expect(belowRank3.map((s) => s.name)).not.toContain('Blink')
			expect(belowRank3.map((s) => s.name)).not.toContain('Elemental Weapon')

			const atRank3 = extractSubclassAlwaysPreparedSpells(classes, spells, 'The Hexblade', 'XGE', 'Warlock', 'XPHB', 5, warlockPactSlotsByLevel)
			expect(atRank3.map((s) => s.name)).toEqual(expect.arrayContaining(['Blink', 'Elemental Weapon']))
			const blinkEntry = atRank3.find((s) => s.name === 'Blink')
			expect(blinkEntry?.grantedAtLevel).toBe(5)
		})

		it('without a pactSlotsByLevel table, a rank-keyed grant is skipped cleanly rather than guessed', () => {
			const result = extractSubclassAlwaysPreparedSpells(classes, spells, 'The Hexblade', 'XGE', 'Warlock', 'XPHB', 9)
			expect(result).toEqual([])
		})

		it("Celestial's own `known`/`prepared` grant still resolves unchanged (no regression) — it carries no `expanded` at all", () => {
			const result = extractSubclassAlwaysPreparedSpells(classes, spells, 'Celestial Patron', 'XPHB', 'Warlock', 'XPHB', 3, warlockPactSlotsByLevel)
			expect(result.map((s) => s.name).sort()).toEqual(['Cure Wounds', 'Sacred Flame'])
		})

		it("Warlock The Genie's 4 per-kind `expanded` entries stay deferred (structurally ambiguous — more than one additionalSpells entry)", () => {
			const result = extractSubclassAlwaysPreparedSpells(classes, spells, 'The Genie', 'TCE', 'Warlock', 'XPHB', 20, warlockPactSlotsByLevel)
			expect(result).toEqual([])
		})

		it('a non-patron subclass (Forge Domain) is unaffected by the pactSlotsByLevel parameter being supplied', () => {
			const result = extractSubclassAlwaysPreparedSpells(classes, spells, 'Forge Domain', 'XPHB', 'Cleric', 'XPHB', 5, warlockPactSlotsByLevel)
			expect(result.map((s) => s.name).sort()).toEqual(['Heat Metal', 'Identify', 'Magic Weapon', 'Searing Smite'])
		})
	})
})

describe('levelForPactSlotRank', () => {
	it('finds the character level where the pact slot level first reaches each rank (1st/3rd/5th/7th/9th for a single-class Warlock)', () => {
		expect(levelForPactSlotRank(1, warlockPactSlotsByLevel)).toBe(1)
		expect(levelForPactSlotRank(2, warlockPactSlotsByLevel)).toBe(3)
		expect(levelForPactSlotRank(3, warlockPactSlotsByLevel)).toBe(5)
		expect(levelForPactSlotRank(4, warlockPactSlotsByLevel)).toBe(7)
		expect(levelForPactSlotRank(5, warlockPactSlotsByLevel)).toBe(9)
	})

	it('returns null when the table never reaches the requested rank', () => {
		expect(levelForPactSlotRank(5, warlockPactSlotsByLevel.slice(0, 5))).toBeNull()
	})
})
