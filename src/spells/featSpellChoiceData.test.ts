import { describe, expect, it } from 'vitest'
import { filterChoiceFeatShape, filterChoiceRequiredCounts, offeredSpellsForSlot, ritualCasterSpellCount } from './featSpellChoiceData'

/*
 * Pure-logic tests for the generic filter-choice feat picker's data layer
 * (build order step 6, slice d5b-1). Feat/spell fixtures mirror the exact
 * shapes scripts/investigate-filter-choice-picker-shape.js confirmed —
 * trimmed, not full feats.json/spells.json entries (CLAUDE.md).
 */

const artificerInitiate = {
	name: 'Artificer Initiate',
	source: 'TCE',
	additionalSpells: [{ ability: 'int', innate: { _: { daily: { '1': [{ choose: 'level=1|class=Artificer' }] } } }, known: { _: [{ choose: 'level=0|class=Artificer' }] } }],
}

const blessedWarrior = {
	name: 'Blessed Warrior',
	source: 'XPHB',
	additionalSpells: [{ ability: 'cha', known: { _: [{ choose: 'level=0|class=cleric', count: 2 }] } }],
}

const woodElfMagic = {
	name: 'Wood Elf Magic',
	source: 'XGE',
	additionalSpells: [
		{ ability: 'wis', innate: { _: { daily: { '1e': ['longstrider', 'pass without trace'] } } }, known: { _: [{ choose: 'level=0|class=Druid' }] } },
	],
}

const feyTouched = {
	name: 'Fey-Touched',
	source: 'XPHB',
	additionalSpells: [{ ability: 'inherit', innate: { _: { daily: { '1e': ['misty step|xphb', { choose: 'level=1|school=E;D' }] } } } }],
}

const ritualCaster = {
	name: 'Ritual Caster',
	source: 'XPHB',
	additionalSpells: [
		{
			prepared: {
				'1': [{ choose: 'level=1|components & miscellaneous=ritual', count: 2 }],
				'5': [{ choose: 'level=1|components & miscellaneous=ritual', count: 1 }],
				'9': [{ choose: 'level=1|components & miscellaneous=ritual', count: 1 }],
				'13': [{ choose: 'level=1|components & miscellaneous=ritual', count: 1 }],
				'17': [{ choose: 'level=1|components & miscellaneous=ritual', count: 1 }],
			},
		},
	],
}

const feats = [artificerInitiate, blessedWarrior, woodElfMagic, feyTouched, ritualCaster]

describe('filterChoiceFeatShape', () => {
	it('Artificer Initiate: a cantrip slot AND a level-1 spell slot, both class-list Artificer, both count 1', () => {
		const shape = filterChoiceFeatShape(feats, 'Artificer Initiate', 'TCE')
		expect(shape.cantripSlot).toEqual({ levels: [0], filter: { kind: 'class', classes: [{ className: 'Artificer', classSource: 'EFA' }] }, count: 1 })
		expect(shape.spellSlot).toEqual({ levels: [1], filter: { kind: 'class', classes: [{ className: 'Artificer', classSource: 'EFA' }] }, count: 1 })
	})

	it('Blessed Warrior: only a cantrip slot, count 2, lowercase class name still resolves', () => {
		const shape = filterChoiceFeatShape(feats, 'Blessed Warrior', 'XPHB')
		expect(shape.cantripSlot).toEqual({ levels: [0], filter: { kind: 'class', classes: [{ className: 'Cleric', classSource: 'XPHB' }] }, count: 2 })
		expect(shape.spellSlot).toBeNull()
	})

	it('Wood Elf Magic: only a cantrip slot — the fixed innate spells are not a choose node', () => {
		const shape = filterChoiceFeatShape(feats, 'Wood Elf Magic', 'XGE')
		expect(shape.cantripSlot).toEqual({ levels: [0], filter: { kind: 'class', classes: [{ className: 'Druid', classSource: 'XPHB' }] }, count: 1 })
		expect(shape.spellSlot).toBeNull()
	})

	it('Fey-Touched: only a spell slot, school filter, no cantrip slot', () => {
		const shape = filterChoiceFeatShape(feats, 'Fey-Touched', 'XPHB')
		expect(shape.cantripSlot).toBeNull()
		expect(shape.spellSlot).toEqual({ levels: [1], filter: { kind: 'school', schools: ['E', 'D'] }, count: 1 })
	})

	it('Ritual Caster: a ritual-filter spell slot with a NULL count — the level-keyed copies collapse to one, count comes from proficiency bonus instead', () => {
		const shape = filterChoiceFeatShape(feats, 'Ritual Caster', 'XPHB')
		expect(shape.cantripSlot).toBeNull()
		expect(shape.spellSlot).toEqual({ levels: [1], filter: { kind: 'ritual' }, count: null })
	})

	it('a feat not in FILTER_CHOICE_FEAT_KEYS returns an empty shape', () => {
		expect(filterChoiceFeatShape(feats, 'Tough', 'XPHB')).toEqual({ cantripSlot: null, spellSlot: null })
	})
})

describe('offeredSpellsForSlot', () => {
	const spells = [
		{ name: 'Guidance', source: 'XPHB', level: 0, school: 'D', availableTo: { classes: [{ name: 'Cleric', classSource: 'XPHB' }] } },
		{ name: 'Sacred Flame', source: 'XPHB', level: 0, school: 'V', availableTo: { classes: [{ name: 'Cleric', classSource: 'XPHB' }] } },
		{ name: 'Fire Bolt', source: 'XPHB', level: 0, school: 'V', availableTo: { classes: [{ name: 'Wizard', classSource: 'XPHB' }] } },
		{ name: 'Misty Step', source: 'XPHB', level: 2, school: 'C', meta: {} },
		{ name: 'Identify', source: 'XPHB', level: 1, school: 'D', meta: {} },
		{ name: 'Charm Person', source: 'XPHB', level: 1, school: 'E', meta: {} },
		{ name: 'Fireball', source: 'XPHB', level: 3, school: 'V', meta: {} },
		{ name: 'Comprehend Languages', source: 'XPHB', level: 1, school: 'D', meta: { ritual: true } },
		{ name: 'Detect Poison and Disease', source: 'XPHB', level: 1, school: 'D', meta: {} },
	]

	it('a class slot reuses classSpellListData.ts, filtered to the slot level', () => {
		const offered = offeredSpellsForSlot(spells, { levels: [0], filter: { kind: 'class', classes: [{ className: 'Cleric', classSource: 'XPHB' }] } })
		expect(offered.map((s) => s.name).sort()).toEqual(['Guidance', 'Sacred Flame'])
	})

	it('a class slot unions candidates across every class the filter names, deduplicated', () => {
		const offered = offeredSpellsForSlot(spells, {
			levels: [0],
			filter: { kind: 'class', classes: [{ className: 'Cleric', classSource: 'XPHB' }, { className: 'Wizard', classSource: 'XPHB' }] },
		})
		expect(offered.map((s) => s.name).sort()).toEqual(['Fire Bolt', 'Guidance', 'Sacred Flame'])
	})

	it('a school slot offers only that level\'s spells in the listed schools', () => {
		const offered = offeredSpellsForSlot(spells, { levels: [1], filter: { kind: 'school', schools: ['D', 'E'] } })
		expect(offered.map((s) => s.name).sort()).toEqual(['Charm Person', 'Comprehend Languages', 'Detect Poison and Disease', 'Identify'])
	})

	it('a ritual slot offers only that level\'s ritual-tagged spells', () => {
		const offered = offeredSpellsForSlot(spells, { levels: [1], filter: { kind: 'ritual' } })
		expect(offered.map((s) => s.name)).toEqual(['Comprehend Languages'])
	})
})

describe('ritualCasterSpellCount / filterChoiceRequiredCounts', () => {
	it('tracks proficiency bonus at Ritual Caster\'s own data thresholds (1/5/9/13/17)', () => {
		expect(ritualCasterSpellCount(1)).toBe(2)
		expect(ritualCasterSpellCount(5)).toBe(3)
		expect(ritualCasterSpellCount(9)).toBe(4)
		expect(ritualCasterSpellCount(13)).toBe(5)
		expect(ritualCasterSpellCount(17)).toBe(6)
	})

	it('required counts match each feat\'s own slot shape, Ritual Caster\'s spells count driven by level', () => {
		expect(filterChoiceRequiredCounts('Blessed Warrior', 'XPHB', 4)).toEqual({ cantrips: 2, spells: 0 })
		expect(filterChoiceRequiredCounts('Artificer Initiate', 'TCE', 4)).toEqual({ cantrips: 1, spells: 1 })
		expect(filterChoiceRequiredCounts('Ritual Caster', 'XPHB', 9)).toEqual({ cantrips: 0, spells: 4 })
		expect(filterChoiceRequiredCounts('Tough', 'XPHB', 4)).toBeNull()
	})
})
