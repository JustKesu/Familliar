import { describe, expect, it } from 'vitest'
import { extractClassSpellList } from './classSpellListData'

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
