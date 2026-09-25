import { describe, expect, it } from 'vitest'
import type { SpellDetail } from '../spells/spellDetailData'
import type { SheetSpellEntry } from './SpellList'
import {
	castsWithSlot,
	filterSpellsTabSections,
	sectionLabel,
	shortCastingTime,
	shortUsageLabel,
	spellEffect,
	spellNotes,
	spellsTabSections,
	spellSubtitle,
	UNRESOLVED_SECTION,
} from './spellsTabData'

function detail(name: string, level: number, over: Partial<SpellDetail> = {}): SpellDetail {
	return {
		name,
		source: 'XPHB',
		level,
		ritual: false,
		concentration: false,
		time: [{ number: 1, unit: 'action' }],
		range: undefined,
		components: { v: true, s: true },
		duration: [{ type: 'instant' }],
		entries: [],
		entriesHigherLevel: [],
		scalingLevelDice: [],
		damageInflict: [],
		conditionInflict: [],
		...over,
	}
}

function entry(name: string, over: Partial<SheetSpellEntry> = {}): SheetSpellEntry {
	return { name, source: 'XPHB', chosen: true, subclassOrigins: [], featOrigins: [], optionalFeatureOrigins: [], speciesOrigins: [], usages: [], unresolvedAbilityReasons: [], ...over }
}

const NO_SLOTS = [0, 0, 0, 0, 0, 0, 0, 0, 0]
const DETAILS = [
	detail('Eldritch Blast', 0),
	detail('Hex', 1, { concentration: true }),
	detail('Misty Step', 2),
	detail('Counterspell', 3),
	detail('Banishment', 4, { concentration: true }),
	detail('Detect Magic', 1, { ritual: true, concentration: true }),
]

function keys(sections: ReturnType<typeof spellsTabSections>) {
	return sections.map((section) => [section.key, section.rows.map((row) => row.entry.name)])
}

describe('spellsTabSections', () => {
	it('single pool Warlock: slot-cast spells up to the pact level stand in the pact section with their own level as a badge', () => {
		const sections = spellsTabSections({
			entries: [entry('Hex'), entry('Misty Step', { chosen: false, subclassOrigins: ['Archfey Patron'] }), entry('Counterspell'), entry('Eldritch Blast'), entry('Banishment')],
			details: DETAILS,
			ordinarySlots: NO_SLOTS,
			pact: { count: 2, slotLevel: 3 },
			unavailableAboveLevel: 3,
		})
		expect(keys(sections)).toEqual([
			[0, ['Eldritch Blast']],
			[3, ['Counterspell', 'Hex', 'Misty Step']],
			[4, ['Banishment']],
		])
		const pactSection = sections[1]!
		expect(pactSection.pactSlots).toBe(2)
		expect(pactSection.ordinarySlots).toBe(0)
		expect(pactSection.rows.map((row) => row.badgeLevel)).toEqual([null, 1, 2])
		// Above the pact level: own section, no slots, marked by D106.
		expect(sections[2]!.pactSlots + sections[2]!.ordinarySlots).toBe(0)
		expect(sections[2]!.rows[0]!.unavailable).toBe(true)
	})

	it('single pool Warlock: a free-use grant keeps its own level section', () => {
		const sections = spellsTabSections({
			entries: [entry('Hex', { chosen: false, featOrigins: ['Hexed'], usages: [{ kind: 'onceFreePerLongRest' }] }), entry('Misty Step', { chosen: false, optionalFeatureOrigins: ['Fey Step'], usages: [{ kind: 'noSlot' }] })],
			details: DETAILS,
			ordinarySlots: NO_SLOTS,
			pact: { count: 2, slotLevel: 3 },
		})
		expect(keys(sections)).toEqual([
			[1, ['Hex']],
			[2, ['Misty Step']],
			[3, []],
		])
	})

	it('both pools: spells stay in their native level, and the pact boxes join the matching ordinary section', () => {
		const sections = spellsTabSections({
			entries: [entry('Hex'), entry('Counterspell')],
			details: DETAILS,
			ordinarySlots: [4, 3, 2, 0, 0, 0, 0, 0, 0],
			pact: { count: 1, slotLevel: 2 },
		})
		expect(keys(sections)).toEqual([
			[1, ['Hex']],
			[2, []],
			[3, ['Counterspell']],
		])
		expect(sections[1]).toMatchObject({ ordinarySlots: 3, pactSlots: 1 })
		expect(sections[0]!.rows[0]!.badgeLevel).toBeNull()
	})

	it('puts a spell without text in a last Unresolved section', () => {
		const sections = spellsTabSections({ entries: [entry('Nowhere'), entry('Hex')], details: DETAILS, ordinarySlots: [2, 0, 0, 0, 0, 0, 0, 0, 0], pact: null })
		expect(sections.map((section) => section.key)).toEqual([1, UNRESOLVED_SECTION])
	})
})

describe('castsWithSlot', () => {
	it('chosen and plain class grants cast with a slot; usage-term and feat/species-only grants do not', () => {
		expect(castsWithSlot(entry('Hex'))).toBe(true)
		expect(castsWithSlot(entry('Hex', { chosen: false, subclassOrigins: ['Fiend Patron'] }))).toBe(true)
		expect(castsWithSlot(entry('Hex', { chosen: false, optionalFeatureOrigins: ['Pact of the Tome'] }))).toBe(true)
		expect(castsWithSlot(entry('Hex', { chosen: false, optionalFeatureOrigins: ['Mask of Many Faces'], usages: [{ kind: 'noSlot' }] }))).toBe(false)
		expect(castsWithSlot(entry('Hex', { chosen: false, featOrigins: ['Magic Initiate'], usages: [{ kind: 'onceFreePerLongRest' }] }))).toBe(false)
		expect(castsWithSlot(entry('Hex', { chosen: false, speciesOrigins: ['Tiefling'] }))).toBe(false)
	})
})

describe('filterSpellsTabSections', () => {
	const sections = spellsTabSections({
		entries: [entry('Eldritch Blast'), entry('Hex'), entry('Detect Magic'), entry('Misty Step')],
		details: DETAILS,
		ordinarySlots: [4, 3, 2, 0, 0, 0, 0, 0, 0],
		pact: null,
	})

	it('All keeps every section, including a slot-only one', () => {
		expect(filterSpellsTabSections(sections, 'all', '').map((section) => section.key)).toEqual([0, 1, 2, 3])
	})

	it('a level pill keeps that section only', () => {
		expect(keys(filterSpellsTabSections(sections, 1, ''))).toEqual([[1, ['Detect Magic', 'Hex']]])
		expect(keys(filterSpellsTabSections(sections, 3, ''))).toEqual([[3, []]])
	})

	it('Concentration and Ritual filter rows by the spell flag and drop emptied sections', () => {
		expect(keys(filterSpellsTabSections(sections, 'concentration', ''))).toEqual([[1, ['Detect Magic', 'Hex']]])
		expect(keys(filterSpellsTabSections(sections, 'ritual', ''))).toEqual([[1, ['Detect Magic']]])
	})

	it('search matches part of the name in any case and combines with the pill', () => {
		expect(keys(filterSpellsTabSections(sections, 'all', 'mIs'))).toEqual([[2, ['Misty Step']]])
		expect(keys(filterSpellsTabSections(sections, 'concentration', 'magic'))).toEqual([[1, ['Detect Magic']]])
		expect(filterSpellsTabSections(sections, 'ritual', 'hex')).toEqual([])
	})
})

describe('cell texts', () => {
	it('sectionLabel', () => {
		expect(([0, 1, 2, 3, 4, UNRESOLVED_SECTION] as const).map((key) => sectionLabel(key))).toEqual(['Cantrips', '1st Level', '2nd Level', '3rd Level', '4th Level', 'Unresolved'])
	})

	it('spellEffect: cantrip dice at the character level, else damage types, else conditions', () => {
		const fireBolt = detail('Fire Bolt', 0, { damageInflict: ['fire'], scalingLevelDice: [{ label: 'fire damage', scaling: { '1': '1d10', '5': '2d10' } }] })
		expect(spellEffect(fireBolt, 5)).toEqual({ dice: ['2d10 fire damage'] })
		expect(spellEffect(detail('Eldritch Blast', 0, { damageInflict: ['force'] }), 5)).toEqual({ text: 'Force' })
		expect(spellEffect(detail('Ice Knife', 1, { damageInflict: ['piercing', 'cold'] }), 5)).toEqual({ text: 'Piercing, Cold' })
		expect(spellEffect(detail('Hold Person', 2, { conditionInflict: ['paralyzed'] }), 5)).toEqual({ text: 'Paralyzed' })
		expect(spellEffect(detail('Bless', 1), 5)).toBeNull()
	})

	it('shortUsageLabel', () => {
		expect(shortUsageLabel({ kind: 'onceFreePerLongRest' })).toBe('1/LR')
		expect(shortUsageLabel({ kind: 'onceFreePerShortOrLongRest' })).toBe('1/SR')
		expect(shortUsageLabel({ kind: 'freePerLongRestByProficiencyBonus', casts: 2 })).toBe('PB/LR')
		expect(shortUsageLabel({ kind: 'freePerLongRestByAbility', ability: 'wis' })).toBe('WIS/LR')
		expect(shortUsageLabel({ kind: 'atWill' })).toBe('At will')
		expect(shortUsageLabel({ kind: 'ritual' })).toBe('Ritual')
	})

	it('shortCastingTime drops the reaction trigger; spellNotes joins usage, components and duration', () => {
		const shield = detail('Shield', 1, { time: [{ number: 1, unit: 'reaction', condition: 'which you take when you are hit' }] })
		expect(shortCastingTime(shield)).toBe('1 reaction')
		const bless = detail('Bless', 1, { components: { v: true, s: true, m: 'a Holy Symbol' }, duration: [{ type: 'timed', duration: { type: 'minute', amount: 1 }, concentration: true }] })
		expect(spellNotes(entry('Bless', { usages: [{ kind: 'onceFreePerLongRest' }] }), bless)).toBe('1/long rest (no slot) · V, S, M · 1 minute')
	})

	it('spellSubtitle names the casting class for a chosen spell, else "Chosen", then the other sources and flags', () => {
		const row = { key: 'k', entry: entry('Bless', { subclassOrigins: ['Life Domain'] }), detail: detail('Bless', 1, { concentration: true }), badgeLevel: null, castWithSlot: true, unavailable: false }
		expect(spellSubtitle(row, 'Cleric')).toBe('Cleric · Life Domain · Concentration')
		expect(spellSubtitle(row, null)).toBe('Chosen · Life Domain · Concentration')
		expect(spellSubtitle({ ...row, unavailable: true, detail: detail('Bless', 1, { ritual: true }) }, 'Cleric')).toBe('Cleric · Life Domain · Ritual · Unavailable at this level')
	})
})
