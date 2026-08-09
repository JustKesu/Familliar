import { describe, expect, it } from 'vitest'
import { extractClassSpellList, extractFeatExpandedSpellList } from './classSpellListData'

const fireball = {
	name: 'Fireball',
	source: 'XPHB',
	level: 3,
	school: 'V',
	duration: [{ type: 'instant' }],
	meta: {},
	availableTo: {
		classes: [{ name: 'Wizard', classSource: 'XPHB' }],
		classVariants: [],
	},
}

const spiritShroud = {
	name: 'Spirit Shroud',
	source: 'TCE',
	level: 3,
	school: 'N',
	duration: [{ type: 'timed', duration: { type: 'minute', amount: 1 }, concentration: true }],
	meta: {},
	availableTo: {
		classes: [],
		classVariants: [{ name: 'Cleric', classSource: 'XPHB', definedInSources: ['TCE'] }],
	},
}

const sacredFlame = {
	name: 'Sacred Flame',
	source: 'XPHB',
	level: 0,
	school: 'V',
	duration: [{ type: 'instant' }],
	meta: {},
	availableTo: {
		classes: [{ name: 'Cleric', classSource: 'XPHB' }],
		classVariants: [],
	},
}

const findFamiliar = {
	name: 'Find Familiar',
	source: 'XPHB',
	level: 1,
	school: 'C',
	duration: [{ type: 'instant' }],
	meta: { ritual: true },
	availableTo: {
		classes: [{ name: 'Wizard', classSource: 'XPHB' }],
		classVariants: [],
	},
}

const barbarianOnly = {
	name: 'Not A Real Spell',
	source: 'XPHB',
	level: 1,
	availableTo: {
		classes: [{ name: 'Bard', classSource: 'XPHB' }],
		classVariants: [],
	},
}

const spells = [fireball, spiritShroud, sacredFlame, findFamiliar, barbarianOnly]

describe('extractClassSpellList', () => {
	it('a spell in `availableTo.classes` is on the list, not flagged as variant', () => {
		const result = extractClassSpellList(spells, 'Wizard', 'XPHB')
		const entry = result.find((s) => s.name === 'Fireball')
		expect(entry).toBeDefined()
		expect(entry?.viaVariant).toBe(false)
	})

	it('a spell with empty `classes` but a matching `classVariants` entry is still on the list, flagged as variant', () => {
		const result = extractClassSpellList(spells, 'Cleric', 'XPHB')
		const entry = result.find((s) => s.name === 'Spirit Shroud')
		expect(entry).toBeDefined()
		expect(entry?.viaVariant).toBe(true)
	})

	it('a spell for a different class only is not on the list', () => {
		const result = extractClassSpellList(spells, 'Wizard', 'XPHB')
		expect(result.find((s) => s.name === 'Not A Real Spell')).toBeUndefined()
	})

	it('cantrips and leveled spells both come back in one list, each carrying its own level', () => {
		const result = extractClassSpellList(spells, 'Cleric', 'XPHB')
		const cantrip = result.find((s) => s.name === 'Sacred Flame')
		const leveled = result.find((s) => s.name === 'Spirit Shroud')
		expect(cantrip?.level).toBe(0)
		expect(leveled?.level).toBe(3)
	})

	it('carries ritual and concentration flags through when present', () => {
		const result = extractClassSpellList(spells, 'Wizard', 'XPHB')
		const ritual = result.find((s) => s.name === 'Find Familiar')
		const nonRitual = result.find((s) => s.name === 'Fireball')
		expect(ritual?.ritual).toBe(true)
		expect(nonRitual?.ritual).toBe(false)

		const concEntry = extractClassSpellList(spells, 'Cleric', 'XPHB').find((s) => s.name === 'Spirit Shroud')
		expect(concEntry?.concentration).toBe(true)
		expect(nonRitual?.concentration).toBe(false)
	})
})

describe('extractFeatExpandedSpellList (D46, the 12 marks)', () => {
	const markOfDetection = {
		name: 'Mark of Detection',
		source: 'EFA',
		additionalSpells: [
			{
				ability: { choose: ['int', 'wis', 'cha'] },
				prepared: { _: { daily: { 1: ['detect magic'] } } },
				expanded: {
					s1: ['detect evil and good', 'identify'],
					s2: ['detect thoughts|xphb'],
				},
			},
		],
	}

	const tough = { name: 'Tough', source: 'XPHB', category: 'G' }

	const feats = [markOfDetection, tough]

	const identify = { name: 'Identify', source: 'XPHB', level: 1, school: 'D', duration: [{ type: 'instant' }], meta: { ritual: true } }
	const detectEvilAndGood = { name: 'Detect Evil and Good', source: 'XPHB', level: 1, school: 'D', duration: [{ type: 'timed', duration: { type: 'minute', amount: 1 }, concentration: true }], meta: {} }
	const detectThoughts = { name: 'Detect Thoughts', source: 'XPHB', level: 2, school: 'D', duration: [{ type: 'instant' }], meta: {} }
	const detectMagic = { name: 'Detect Magic', source: 'XPHB', level: 1, school: 'D', duration: [{ type: 'instant' }], meta: { ritual: true } }
	const spells = [identify, detectEvilAndGood, detectThoughts, detectMagic]

	it("resolves every ref under `expanded`, flattening the s1/s2/... spell-level grouping into one list with each spell's own level", () => {
		const result = extractFeatExpandedSpellList(feats, spells, 'Mark of Detection', 'EFA')
		expect(result.map((s) => s.name).sort()).toEqual(['Detect Evil and Good', 'Detect Thoughts', 'Identify'])
		expect(result.find((s) => s.name === 'Identify')?.level).toBe(1)
		expect(result.find((s) => s.name === 'Detect Thoughts')?.level).toBe(2)
	})

	it('carries school, ritual and concentration through, and is never flagged viaVariant (no availableTo data involved)', () => {
		const result = extractFeatExpandedSpellList(feats, spells, 'Mark of Detection', 'EFA')
		const identifyEntry = result.find((s) => s.name === 'Identify')
		expect(identifyEntry?.school).toBe('D')
		expect(identifyEntry?.ritual).toBe(true)
		expect(identifyEntry?.viaVariant).toBe(false)

		const detectEvilEntry = result.find((s) => s.name === 'Detect Evil and Good')
		expect(detectEvilEntry?.concentration).toBe(true)
		expect(detectEvilEntry?.ritual).toBe(false)
	})

	it("does NOT return the mark's fixed `prepared` grant (Detect Magic) — only `expanded`", () => {
		const result = extractFeatExpandedSpellList(feats, spells, 'Mark of Detection', 'EFA')
		expect(result.find((s) => s.name === 'Detect Magic')).toBeUndefined()
	})

	it('a feat with no `expanded` key (every feat but a mark) returns an empty list, no guard needed by name', () => {
		expect(extractFeatExpandedSpellList(feats, spells, 'Tough', 'XPHB')).toEqual([])
	})

	it('a feat name/source with no match returns an empty list', () => {
		expect(extractFeatExpandedSpellList(feats, spells, 'Nonexistent', 'XPHB')).toEqual([])
	})

	it('a reference that does not resolve against the filtered spells list is skipped cleanly (D43)', () => {
		const spellsMissingIdentify = spells.filter((s) => s.name !== 'Identify')
		const result = extractFeatExpandedSpellList(feats, spellsMissingIdentify, 'Mark of Detection', 'EFA')
		expect(result.find((s) => s.name === 'Identify')).toBeUndefined()
		expect(result.map((s) => s.name).sort()).toEqual(['Detect Evil and Good', 'Detect Thoughts'])
	})
})
