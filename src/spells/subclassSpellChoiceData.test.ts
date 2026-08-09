import { describe, expect, it } from 'vitest'
import {
	extractSubclassChosenSpells,
	isSubclassSpellChoice,
	subclassSpellChoiceShape,
	unlockedSubclassSpellChoiceSlots,
} from './subclassSpellChoiceData'
import { offeredSpellsForSlot } from './featSpellChoiceData'

/*
 * Pure-logic tests for the subclass filter-choice spell picker's data layer
 * (build order step 6, slice d6b). Fixtures mirror the exact shapes
 * scripts/investigate-d6b-choice-shapes.js confirmed — trimmed, not full
 * classes.json/spells.json entries (CLAUDE.md).
 */

const collegeOfLore = {
	entryType: 'subclass',
	name: 'College of Lore',
	shortName: 'Lore',
	source: 'XPHB',
	className: 'Bard',
	classSource: 'XPHB',
	additionalSpells: [{ prepared: { '6': [{ choose: 'level=0;1;2;3|class=Cleric;Druid;Wizard' }, { choose: 'level=0;1;2;3|class=Cleric;Druid;Wizard' }] } }],
}

const evoker = {
	entryType: 'subclass',
	name: 'Evoker',
	shortName: 'Evoker',
	source: 'XPHB',
	className: 'Wizard',
	classSource: 'XPHB',
	additionalSpells: [
		{
			known: {
				'3': [{ choose: 'level=0;1;2|class=Wizard|school=V' }, { choose: 'level=0;1;2|class=Wizard|school=V' }],
				'5': [{ choose: 'level=0;1;2;3|class=Wizard|school=V' }],
				'7': [{ choose: 'level=0;1;2;3;4|class=Wizard|school=V' }],
			},
		},
	],
}

/** A fixed-grant subclass (Cleric - Grave Domain shape) — must remain unaffected: no choice slots at all. */
const graveDomain = {
	entryType: 'subclass',
	name: 'Grave Domain',
	shortName: 'Grave',
	source: 'XPHB',
	className: 'Cleric',
	classSource: 'XPHB',
	additionalSpells: [{ prepared: { '1': ['bane', 'false life'] }, known: { '1': ['spare the dying#c'] } }],
}

const classes = [collegeOfLore, evoker, graveDomain]

describe('isSubclassSpellChoice', () => {
	it('is true for the 5 covered subclasses, false for anything else', () => {
		expect(isSubclassSpellChoice({ name: 'College of Lore', source: 'XPHB' })).toBe(true)
		expect(isSubclassSpellChoice({ name: 'Evoker', source: 'XPHB' })).toBe(true)
		expect(isSubclassSpellChoice({ name: 'Grave Domain', source: 'XPHB' })).toBe(false)
	})
})

describe('subclassSpellChoiceShape', () => {
	it('College of Lore: 2 slots, both at level 6, both class-list Cleric/Druid/Wizard capped at level 3', () => {
		const shape = subclassSpellChoiceShape(classes, 'College of Lore', 'XPHB', 'Bard', 'XPHB')
		expect(shape).toEqual([
			{
				grantedAtLevel: 6,
				slotIndex: 0,
				levels: [0, 1, 2, 3],
				filter: {
					kind: 'class',
					classes: [
						{ className: 'Cleric', classSource: 'XPHB' },
						{ className: 'Druid', classSource: 'XPHB' },
						{ className: 'Wizard', classSource: 'XPHB' },
					],
				},
			},
			{
				grantedAtLevel: 6,
				slotIndex: 1,
				levels: [0, 1, 2, 3],
				filter: {
					kind: 'class',
					classes: [
						{ className: 'Cleric', classSource: 'XPHB' },
						{ className: 'Druid', classSource: 'XPHB' },
						{ className: 'Wizard', classSource: 'XPHB' },
					],
				},
			},
		])
	})

	it('Evoker: 2 slots at level 3 (cap 0-2), then 1 more at each of 5 and 7 (growing cap), all class=Wizard AND school=V', () => {
		const shape = subclassSpellChoiceShape(classes, 'Evoker', 'XPHB', 'Wizard', 'XPHB')
		expect(shape.map((s) => ({ grantedAtLevel: s.grantedAtLevel, slotIndex: s.slotIndex, levels: s.levels }))).toEqual([
			{ grantedAtLevel: 3, slotIndex: 0, levels: [0, 1, 2] },
			{ grantedAtLevel: 3, slotIndex: 1, levels: [0, 1, 2] },
			{ grantedAtLevel: 5, slotIndex: 0, levels: [0, 1, 2, 3] },
			{ grantedAtLevel: 7, slotIndex: 0, levels: [0, 1, 2, 3, 4] },
		])
		expect(shape[0].filter).toEqual({ kind: 'class', classes: [{ className: 'Wizard', classSource: 'XPHB' }], schools: ['V'] })
	})

	it('a fixed-grant subclass (Grave Domain) has no choice slots', () => {
		expect(subclassSpellChoiceShape(classes, 'Grave Domain', 'XPHB', 'Cleric', 'XPHB')).toEqual([])
	})

	it('a subclass not in SUBCLASS_SPELL_CHOICE_KEYS returns empty even if found', () => {
		expect(subclassSpellChoiceShape(classes, 'Nonexistent', 'XPHB', 'Bard', 'XPHB')).toEqual([])
	})
})

describe('unlockedSubclassSpellChoiceSlots', () => {
	it('College of Lore: nothing unlocked below level 6, 2 slots at level 6+', () => {
		const shape = subclassSpellChoiceShape(classes, 'College of Lore', 'XPHB', 'Bard', 'XPHB')
		expect(unlockedSubclassSpellChoiceSlots(shape, 5)).toEqual([])
		expect(unlockedSubclassSpellChoiceSlots(shape, 6)).toHaveLength(2)
	})

	it('Evoker: slots accumulate progressively by level', () => {
		const shape = subclassSpellChoiceShape(classes, 'Evoker', 'XPHB', 'Wizard', 'XPHB')
		expect(unlockedSubclassSpellChoiceSlots(shape, 2)).toHaveLength(0)
		expect(unlockedSubclassSpellChoiceSlots(shape, 3)).toHaveLength(2)
		expect(unlockedSubclassSpellChoiceSlots(shape, 5)).toHaveLength(3)
		expect(unlockedSubclassSpellChoiceSlots(shape, 6)).toHaveLength(3)
		expect(unlockedSubclassSpellChoiceSlots(shape, 7)).toHaveLength(4)
	})
})

const spells = [
	{ name: 'Fire Bolt', source: 'XPHB', level: 0, school: 'V', availableTo: { classes: [{ name: 'Wizard', classSource: 'XPHB' }] } },
	{ name: 'Prestidigitation', source: 'XPHB', level: 0, school: 'T', availableTo: { classes: [{ name: 'Wizard', classSource: 'XPHB' }] } },
	{ name: 'Burning Hands', source: 'XPHB', level: 1, school: 'V', availableTo: { classes: [{ name: 'Wizard', classSource: 'XPHB' }] } },
	{ name: 'Shield', source: 'XPHB', level: 1, school: 'A', availableTo: { classes: [{ name: 'Wizard', classSource: 'XPHB' }] } },
	{ name: 'Fireball', source: 'XPHB', level: 3, school: 'V', availableTo: { classes: [{ name: 'Wizard', classSource: 'XPHB' }] } },
	{ name: 'Guidance', source: 'XPHB', level: 0, school: 'D', availableTo: { classes: [{ name: 'Cleric', classSource: 'XPHB' }] } },
	{ name: 'Healing Word', source: 'XPHB', level: 1, school: 'A', availableTo: { classes: [{ name: 'Cleric', classSource: 'XPHB' }, { name: 'Druid', classSource: 'XPHB' }] } },
	{ name: 'Revivify', source: 'XPHB', level: 3, school: 'N', availableTo: { classes: [{ name: 'Cleric', classSource: 'XPHB' }] } },
	{ name: 'Raise Dead', source: 'XPHB', level: 5, school: 'N', availableTo: { classes: [{ name: 'Cleric', classSource: 'XPHB' }] } },
]

describe('offeredSpellsForSlot (reused from featSpellChoiceData.ts) applied to a subclass slot', () => {
	it('Evoker level-3 slot: only school=V Wizard spells at level 0-2', () => {
		const shape = subclassSpellChoiceShape(classes, 'Evoker', 'XPHB', 'Wizard', 'XPHB')
		const offered = offeredSpellsForSlot(spells, shape[0])
		expect(offered.map((s) => s.name).sort()).toEqual(['Fire Bolt', 'Burning Hands'].sort())
	})

	it('College of Lore level-6 slot: any Cleric/Druid/Wizard spell at level 0-3, unioned and deduplicated', () => {
		const shape = subclassSpellChoiceShape(classes, 'College of Lore', 'XPHB', 'Bard', 'XPHB')
		const offered = offeredSpellsForSlot(spells, shape[0])
		expect(offered.map((s) => s.name).sort()).toEqual(['Burning Hands', 'Fire Bolt', 'Fireball', 'Guidance', 'Healing Word', 'Prestidigitation', 'Revivify', 'Shield'].sort())
	})
})

describe('extractSubclassChosenSpells', () => {
	it('resolves stored picks into AlwaysPreparedSpell entries with origin subclass and the stored grantedAtLevel', () => {
		const result = extractSubclassChosenSpells(spells, [
			{
				subclassName: 'Evoker',
				subclassSource: 'XPHB',
				className: 'Wizard',
				classSource: 'XPHB',
				picks: [
					{ grantedAtLevel: 3, slotIndex: 0, name: 'fire bolt', source: 'XPHB' },
					{ grantedAtLevel: 3, slotIndex: 1, name: 'burning hands', source: 'XPHB' },
				],
			},
		])
		expect(result).toEqual([
			{ name: 'Fire Bolt', source: 'XPHB', level: 0, grantedAtLevel: 3, ritual: false, concentration: false, origin: 'subclass' },
			{ name: 'Burning Hands', source: 'XPHB', level: 1, grantedAtLevel: 3, ritual: false, concentration: false, origin: 'subclass' },
		])
	})

	it('skips a pick that does not resolve against spells.json (D43)', () => {
		const result = extractSubclassChosenSpells(spells, [
			{
				subclassName: 'Evoker',
				subclassSource: 'XPHB',
				className: 'Wizard',
				classSource: 'XPHB',
				picks: [{ grantedAtLevel: 3, slotIndex: 0, name: 'not a real spell', source: 'XPHB' }],
			},
		])
		expect(result).toEqual([])
	})

	it('no choices means no spells', () => {
		expect(extractSubclassChosenSpells(spells, [])).toEqual([])
	})
})
