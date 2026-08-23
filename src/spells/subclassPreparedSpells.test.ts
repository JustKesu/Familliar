import { describe, expect, it } from 'vitest'
import { dedupeAlwaysPreparedSpells, extractSubclassAlwaysPreparedSpells, levelForPactSlotRank, type AlwaysPreparedSpell } from './subclassPreparedSpells'

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

/** Real duplicate-emission case (this task, D46 via scripts/investigate-glamour-duplicate-2.js): the SAME level-6 spell sits under both `prepared` and `innate` in the SAME additionalSpells entry. */
const collegeOfGlamour = {
	entryType: 'subclass',
	name: 'College of Glamour',
	source: 'XPHB',
	className: 'Bard',
	classSource: 'XPHB',
	additionalSpells: [
		{
			prepared: {
				'3': ['charm person', 'mirror image'],
				'6': ['command'],
			},
			innate: {
				'6': ['command'],
			},
		},
	],
}

/** Real Divine Soul (Sorcerer, XGE/XPHB) shape — 5 separate additionalSpells entries (one per alignment), each with its own single-spell `known` grant and its own class-level-keyed pool-widening `expanded` (not rank-keyed, so never read by the rank-grant branch). The reported "Bless shows twice" bug did not reproduce against this shape (see docs/REPORT.md) — kept here as a non-overlap regression fixture. */
const divineSoul = {
	entryType: 'subclass',
	name: 'Divine Soul',
	source: 'XGE',
	className: 'Sorcerer',
	classSource: 'XPHB',
	additionalSpells: [
		{ name: 'Good', known: { '1': ['cure wounds'] }, expanded: { '1': [{ all: 'level=0|class=Cleric' }] } },
		{ name: 'Evil', known: { '1': ['inflict wounds'] }, expanded: { '1': [{ all: 'level=0|class=Cleric' }] } },
		{ name: 'Law', known: { '1': ['bless'] }, expanded: { '1': [{ all: 'level=0|class=Cleric' }] } },
		{ name: 'Chaos', known: { '1': ['bane'] }, expanded: { '1': [{ all: 'level=0|class=Cleric' }] } },
		{ name: 'Neutrality', known: { '1': ['protection from evil and good'] }, expanded: { '1': [{ all: 'level=0|class=Cleric' }] } },
	],
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
	collegeOfGlamour,
	divineSoul,
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
const charmPerson = { name: 'Charm Person', source: 'XPHB', level: 1, duration: [{ type: 'timed', duration: { type: 'hour', amount: 1 } }], meta: {} }
const mirrorImage = { name: 'Mirror Image', source: 'XPHB', level: 2, duration: [{ type: 'timed', duration: { type: 'minute', amount: 1 } }], meta: {} }
const command = { name: 'Command', source: 'XPHB', level: 1, duration: [{ type: 'instant' }], meta: {} }
const inflictWounds = { name: 'Inflict Wounds', source: 'XPHB', level: 1, duration: [{ type: 'instant' }], meta: {} }
const bless = { name: 'Bless', source: 'XPHB', level: 1, duration: [{ type: 'timed', duration: { type: 'minute', amount: 1 }, concentration: true }], meta: {} }
const bane = { name: 'Bane', source: 'XPHB', level: 1, duration: [{ type: 'timed', duration: { type: 'minute', amount: 1 }, concentration: true }], meta: {} }
const protectionFromEvilAndGood = {
	name: 'Protection from Evil and Good',
	source: 'XPHB',
	level: 1,
	duration: [{ type: 'timed', duration: { type: 'minute', amount: 10 }, concentration: true }],
	meta: {},
}

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
	charmPerson,
	mirrorImage,
	command,
	inflictWounds,
	bless,
	bane,
	protectionFromEvilAndGood,
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

	it('a "_"-keyed grant (Warlock Archfey Patron) is skipped cleanly when no subclassGrantLevel is supplied, not granted at every level (this task)', () => {
		const result = extractSubclassAlwaysPreparedSpells(classes, spells, 'Archfey Patron', 'XPHB', 'Warlock', 'XPHB', 20)
		expect(result).toEqual([])
	})

	it('a "_"-keyed grant (Archfey Patron) resolves at the subclass\'s own grant level once subclassGrantLevel is supplied, and unwraps the daily/cha resource wrapper via the same extractRefs path (this task)', () => {
		const belowGrant = extractSubclassAlwaysPreparedSpells(classes, spells, 'Archfey Patron', 'XPHB', 'Warlock', 'XPHB', 2, undefined, 3)
		expect(belowGrant).toEqual([])

		const atGrant = extractSubclassAlwaysPreparedSpells(classes, spells, 'Archfey Patron', 'XPHB', 'Warlock', 'XPHB', 3, undefined, 3)
		expect(atGrant.map((s) => s.name)).toEqual(['Identify'])
		expect(atGrant[0].grantedAtLevel).toBe(3)

		const aboveGrant = extractSubclassAlwaysPreparedSpells(classes, spells, 'Archfey Patron', 'XPHB', 'Warlock', 'XPHB', 20, undefined, 3)
		expect(aboveGrant.map((s) => s.name)).toEqual(['Identify'])
	})

	it('a key that is neither numeric nor "_" is skipped cleanly even when subclassGrantLevel is supplied (D43 — not "unparseable means always")', () => {
		const weird = {
			entryType: 'subclass',
			name: 'Weird Key Subclass',
			source: 'XPHB',
			className: 'Warlock',
			classSource: 'XPHB',
			additionalSpells: [{ innate: { weirdKey: ['identify'] } }],
		}
		const result = extractSubclassAlwaysPreparedSpells([...classes, weird], spells, 'Weird Key Subclass', 'XPHB', 'Warlock', 'XPHB', 20, undefined, 3)
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

	describe('de-duplication of a spell reachable via two grant paths (this task)', () => {
		it('College of Glamour: Command (listed under BOTH `prepared` and `innate` at level 6) is returned exactly once', () => {
			const result = extractSubclassAlwaysPreparedSpells(classes, spells, 'College of Glamour', 'XPHB', 'Bard', 'XPHB', 20)
			const commandEntries = result.filter((s) => s.name === 'Command')
			expect(commandEntries).toHaveLength(1)
			expect(commandEntries[0].grantedAtLevel).toBe(6)
			// no spell lost to over-eager de-dup — the two non-overlapping spells from `prepared` are still present.
			expect(result.map((s) => s.name).sort()).toEqual(['Charm Person', 'Command', 'Mirror Image'])
		})

		it('Divine Soul: 5 non-overlapping alignment grants (the reported repro) all resolve, each exactly once — the reported duplicate did not reproduce, this is a regression guard', () => {
			const result = extractSubclassAlwaysPreparedSpells(classes, spells, 'Divine Soul', 'XGE', 'Sorcerer', 'XPHB', 20)
			expect(result.map((s) => s.name).sort()).toEqual(['Bane', 'Bless', 'Cure Wounds', 'Inflict Wounds', 'Protection from Evil and Good'])
			const blessEntries = result.filter((s) => s.name === 'Bless')
			expect(blessEntries).toHaveLength(1)
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

describe('dedupeAlwaysPreparedSpells (this task)', () => {
	function entry(overrides: Partial<AlwaysPreparedSpell> & { name: string; grantedAtLevel: number }): AlwaysPreparedSpell {
		return { source: 'XPHB', level: 1, ritual: false, concentration: false, origin: 'subclass', ...overrides }
	}

	it('collapses two entries with the same name+source into one, keeping the LOWER grantedAtLevel', () => {
		const result = dedupeAlwaysPreparedSpells([entry({ name: 'Command', grantedAtLevel: 6 }), entry({ name: 'Command', grantedAtLevel: 3 })])
		expect(result).toHaveLength(1)
		expect(result[0].grantedAtLevel).toBe(3)
	})

	it('source comparison is case-insensitive, matching findSpell\'s own uppercase convention', () => {
		const result = dedupeAlwaysPreparedSpells([entry({ name: 'Bless', source: 'xphb', grantedAtLevel: 1 }), entry({ name: 'Bless', source: 'XPHB', grantedAtLevel: 1 })])
		expect(result).toHaveLength(1)
	})

	it('leaves non-overlapping spells untouched, none lost', () => {
		const result = dedupeAlwaysPreparedSpells([entry({ name: 'Cure Wounds', grantedAtLevel: 1 }), entry({ name: 'Bless', grantedAtLevel: 1 }), entry({ name: 'Bane', grantedAtLevel: 1 })])
		expect(result.map((s) => s.name).sort()).toEqual(['Bane', 'Bless', 'Cure Wounds'])
	})
})
