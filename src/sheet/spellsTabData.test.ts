import { describe, expect, it } from 'vitest'
import type { Ability } from '../abilities/abilityScores'
import type { AbilityScoreValue } from '../calculation/abilityScores'
import { freeCastResources, withFreeCastResources } from '../calculation/freeCastResources'
import type { FeatSpellcastingEntry, SpeciesSpellcastingEntry, SpellcastingEntry } from '../calculation/spellcasting'
import { type Calculated, known } from '../calculation/types'
import type { SpellDetail } from '../spells/spellDetailData'
import type { SpellUsage } from '../spells/subclassPreparedSpells'
import { combineSpellEntries, type SheetSpellEntry, type SpellGrant } from './SpellList'
import {
	castsWithSlot,
	filterSpellsTabSections,
	sectionLabel,
	shortCastingTime,
	shortUsageLabel,
	spellEffect,
	spellNotes,
	spellsTabActionSections,
	spellsTabRowCaster,
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
	return { name, source: 'XPHB', chosen: true, subclassOrigins: [], featOrigins: [], optionalFeatureOrigins: [], speciesOrigins: [], usages: [], unresolvedAbilityReasons: [], grants: [], ...over }
}

function grant(origin: SpellGrant['origin'], originName: string, usage: SpellUsage | null = null): SpellGrant {
	return { origin, originName, usage }
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
			entries: [
				entry('Hex'),
				entry('Misty Step', { chosen: false, subclassOrigins: ['Archfey Patron'], grants: [grant('subclass', 'Archfey Patron')] }),
				entry('Counterspell'),
				entry('Eldritch Blast'),
				entry('Banishment'),
			],
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
		expect(castsWithSlot(entry('Hex', { chosen: false, subclassOrigins: ['Fiend Patron'], grants: [grant('subclass', 'Fiend Patron')] }))).toBe(true)
		expect(castsWithSlot(entry('Hex', { chosen: false, optionalFeatureOrigins: ['Pact of the Tome'], grants: [grant('optionalFeature', 'Pact of the Tome')] }))).toBe(true)
		// D190: Archfey's Misty Step is a slot grant AND a CHA/LR grant — still cast with a slot.
		const mistyStep = entry('Misty Step', {
			chosen: false,
			subclassOrigins: ['Archfey Patron'],
			usages: [{ kind: 'freePerLongRestByAbility', ability: 'cha' }],
			grants: [grant('subclass', 'Archfey Patron'), grant('subclass', 'Archfey Patron', { kind: 'freePerLongRestByAbility', ability: 'cha' })],
		})
		expect(castsWithSlot(mistyStep)).toBe(true)
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

describe('combineSpellEntries grants (D190)', () => {
	it('keeps one entry per spell and ties each usage to the source that granted it', () => {
		const [misty, ...rest] = combineSpellEntries(
			[{ spells: [{ name: 'Misty Step', source: 'XPHB' }] }],
			[{ subclassName: 'Archfey Patron', spells: [{ name: 'Misty Step', source: 'XPHB', usage: null }, { name: 'Misty Step', source: 'XPHB', usage: { kind: 'freePerLongRestByAbility', ability: 'cha' } }] }],
			[
				{ featName: 'Fey-Touched', name: 'Misty Step', source: 'XPHB', usage: { kind: 'onceFreePerLongRest' } },
				{ featName: 'Fey-Touched', name: 'Misty Step', source: 'XPHB', usage: { kind: 'onceFreePerLongRest' } },
			],
		)
		expect(rest).toEqual([])
		expect(misty!.chosen).toBe(true)
		expect(misty!.grants).toEqual([
			{ origin: 'subclass', originName: 'Archfey Patron', usage: null },
			{ origin: 'subclass', originName: 'Archfey Patron', usage: { kind: 'freePerLongRestByAbility', ability: 'cha' } },
			{ origin: 'feat', originName: 'Fey-Touched', usage: { kind: 'onceFreePerLongRest' } },
		])
		expect(misty!.usages).toEqual([{ kind: 'freePerLongRestByAbility', ability: 'cha' }, { kind: 'onceFreePerLongRest' }])
	})
})

describe('spellsTabActionSections (D190)', () => {
	const ONCE: SpellUsage = { kind: 'onceFreePerLongRest' }
	const CHA: SpellUsage = { kind: 'freePerLongRestByAbility', ability: 'cha' }
	const ROW_DETAILS = [
		...DETAILS,
		detail('Hellish Rebuke', 1),
		detail('Darkness', 2),
		detail('Guidance', 0),
		detail('Bless', 1),
		detail('Command', 1),
		detail('Mage Armor', 1),
		detail('Water Breathing', 3),
	]
	function scores(charisma: number): Record<Ability, Calculated<AbilityScoreValue>> {
		const abilities: Ability[] = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']
		return Object.fromEntries(
			abilities.map((ability) => {
				const score = ability === 'charisma' ? charisma : 10
				return [ability, known({ score, modifier: Math.floor((score - 10) / 2) }, [])]
			}),
		) as Record<Ability, Calculated<AbilityScoreValue>>
	}
	function sectionsFor(entries: SheetSpellEntry[], slots: { ordinary?: number[]; pact?: { count: number; slotLevel: number } | null }, extraMaxima: [string, number][] = []) {
		const resources = withFreeCastResources([], freeCastResources(entries, scores(16)))
		const maxima = new Map([...resources.flatMap((r): [string, number][] => (r.max.status === 'known' ? [[r.name, r.max.value]] : [])), ...extraMaxima])
		return spellsTabActionSections({ entries, details: ROW_DETAILS, ordinarySlots: slots.ordinary ?? NO_SLOTS, pact: slots.pact ?? null, resourceMaxima: maxima })
	}
	function rows(sections: ReturnType<typeof spellsTabActionSections>) {
		return sections.flatMap((section) =>
			section.rows.map((row) => [section.key, row.key, row.action.kind === 'cast' ? `CAST${row.badgeLevel !== null ? ` (${row.badgeLevel})` : ''}` : row.action.kind === 'use' ? `USE ${row.action.label} max ${row.action.max}` : `LABEL ${row.action.label}`]),
		)
	}

	it('Tiefling (Infernal) Warlock 3 who also chose Hellish Rebuke: CAST in the pact section with a badge, USE 1/LR in its own level', () => {
		const entries = combineSpellEntries([{ spells: [{ name: 'Hellish Rebuke', source: 'XPHB' }] }], [], [], [], [
			{ speciesName: 'Tiefling; Infernal Legacy', name: 'Hellish Rebuke', source: 'XPHB', usage: ONCE },
		])
		expect(rows(sectionsFor(entries, { pact: { count: 2, slotLevel: 2 } }))).toEqual([
			[1, 'hellish rebuke|XPHB#use:spell:species:Tiefling; Infernal Legacy:hellish rebuke|XPHB', 'USE 1/LR max 1'],
			[2, 'hellish rebuke|XPHB#cast', 'CAST (1)'],
		])
	})

	it('Fighter with origin Magic Initiate: no slots, so no CAST — the 1st-level pick is USE only, the cantrip At will', () => {
		const entries = combineSpellEntries([], [], [
			{ featName: 'Magic Initiate', name: 'Guidance', source: 'XPHB', usage: undefined },
			{ featName: 'Magic Initiate', name: 'Bless', source: 'XPHB', usage: ONCE },
		])
		expect(rows(sectionsFor(entries, {}))).toEqual([
			[0, 'guidance|XPHB#label', 'LABEL At will'],
			[1, 'bless|XPHB#use:spell:feat:Magic Initiate:bless|XPHB', 'USE 1/LR max 1'],
		])
	})

	it('Cleric 5 with Fey-Touched: Misty Step and the chosen 1st-level spell each get CAST and their own USE counter', () => {
		const entries = combineSpellEntries([], [], [
			{ featName: 'Fey-Touched', name: 'Misty Step', source: 'XPHB', usage: ONCE },
			{ featName: 'Fey-Touched', name: 'Command', source: 'XPHB', usage: ONCE },
		])
		expect(rows(sectionsFor(entries, { ordinary: [4, 3, 2, 0, 0, 0, 0, 0, 0] }))).toEqual([
			[1, 'command|XPHB#cast', 'CAST'],
			[1, 'command|XPHB#use:spell:feat:Fey-Touched:command|XPHB', 'USE 1/LR max 1'],
			[2, 'misty step|XPHB#cast', 'CAST'],
			[2, 'misty step|XPHB#use:spell:feat:Fey-Touched:misty step|XPHB', 'USE 1/LR max 1'],
		])
	})

	it('Warlock with Armor of Shadows (label only) and Gift of the Depths (USE, no CAST: a NO source)', () => {
		const entries = combineSpellEntries([], [], [], [
			{ optionName: 'Armor of Shadows', name: 'Mage Armor', source: 'XPHB', usage: { kind: 'noSlot' } },
			{ optionName: 'Gift of the Depths', name: 'Water Breathing', source: 'XPHB', usage: ONCE },
		])
		expect(rows(sectionsFor(entries, { pact: { count: 2, slotLevel: 3 } }))).toEqual([
			[1, 'mage armor|XPHB#label', 'LABEL No slot'],
			[3, 'water breathing|XPHB#use:spell:optionalFeature:Gift of the Depths:water breathing|XPHB', 'USE 1/LR max 1'],
		])
	})

	it('Monk Warrior of Shadow: Darkness is USE "1 FP" on the Focus Point pool, no new counter', () => {
		const entries = combineSpellEntries([], [{ subclassName: 'Warrior of Shadow', spells: [{ name: 'Darkness', source: 'XPHB', usage: { kind: 'resource', cost: 1, resourceName: 'Focus Point' } }] }])
		expect(freeCastResources(entries, scores(10))).toEqual([])
		const [row] = sectionsFor(entries, {}, [['Focus Point', 5]]).flatMap((section) => section.rows)
		expect(row!.action).toMatchObject({ kind: 'use', counterKey: 'Focus Point', cost: 1, max: 5, label: '1 FP' })
	})

	it('Archfey Warlock 5: Misty Step CAST in the pact section and USE CHA/LR in its own level, counted on Steps of the Fey', () => {
		const entries = combineSpellEntries([], [
			{ subclassName: 'Archfey Patron', spells: [{ name: 'Misty Step', source: 'XPHB', usage: null }, { name: 'Misty Step', source: 'XPHB', usage: CHA }] },
		])
		expect(rows(sectionsFor(entries, { pact: { count: 2, slotLevel: 3 } }))).toEqual([
			[2, 'misty step|XPHB#use:Steps of the Fey', 'USE CHA/LR max 3'],
			[3, 'misty step|XPHB#cast', 'CAST (2)'],
		])
	})

	it('a spell with no text is one label row in Unresolved', () => {
		expect(rows(sectionsFor([entry('Nowhere')], {}))).toEqual([[UNRESOLVED_SECTION, 'nowhere|XPHB#label', 'LABEL ']])
	})

	describe('spellsTabRowCaster', () => {
		const numbers = (bonus: number) => ({ spellAttackBonus: bonus, spellAttackBreakdown: [], spellSaveDC: 8 + bonus, spellSaveDCBreakdown: [] })
		const warlock: SpellcastingEntry = { className: 'Warlock', classSource: 'XPHB', ability: 'charisma', ...numbers(5) }
		const tiefling: SpeciesSpellcastingEntry = { speciesName: 'Tiefling; Infernal Legacy', ability: 'intelligence', ...numbers(2) }
		const feyTouched: FeatSpellcastingEntry = { featName: 'Fey-Touched', ability: 'wisdom', ...numbers(3) }

		it('USE casts with its granting species or feat, CAST with the class', () => {
			const tieflingEntries = combineSpellEntries([{ spells: [{ name: 'Hellish Rebuke', source: 'XPHB' }] }], [], [], [], [
				{ speciesName: 'Tiefling; Infernal Legacy', name: 'Hellish Rebuke', source: 'XPHB', usage: ONCE },
			])
			const tieflingRows = sectionsFor(tieflingEntries, { pact: { count: 2, slotLevel: 2 } }).flatMap((section) => section.rows)
			const bonusOf = (row: (typeof tieflingRows)[number]) => {
				const caster = spellsTabRowCaster(row, [warlock], [feyTouched], [tiefling])
				return 'attack' in caster ? caster.attack.bonus : caster.reason
			}
			expect(tieflingRows.map((row) => [row.action.kind, bonusOf(row)])).toEqual([
				['use', 2],
				['cast', 5],
			])

			const feyEntries = combineSpellEntries([], [], [{ featName: 'Fey-Touched', name: 'Misty Step', source: 'XPHB', usage: ONCE }])
			const feyRows = sectionsFor(feyEntries, { pact: { count: 2, slotLevel: 2 } }).flatMap((section) => section.rows)
			expect(feyRows.map((row) => [row.action.kind, bonusOf(row)])).toEqual([
				['cast', 5],
				['use', 3],
			])
		})
	})
})
