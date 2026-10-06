import { describe, expect, it } from 'vitest'
import type { SpellcastingEntry } from '../calculation/spellcasting'
import type { ClassSpellCountData } from '../calculation/spellCounts'
import type { ClassSpellSlotsData } from '../calculation/spellSlots'
import type { SpellDetail } from '../spells/spellDetailData'
import type { Character } from '../storage/character'
import { chosenSpellCap, classSpellLimits } from './classSpellLimits'
import { casterFor, spellActionRows } from './spellActionRowData'
import { combineSpellEntries, provenanceLabel, spellEntryKey } from './SpellList'
import { spellsTabActionSections } from './spellsTabData'

function detail(name: string, level: number, over: Partial<SpellDetail> = {}): SpellDetail {
	return {
		name,
		source: 'XPHB',
		level,
		ritual: false,
		concentration: false,
		time: [],
		range: { type: 'point', distance: { type: 'feet', amount: 60 } },
		components: undefined,
		duration: [],
		entries: [],
		entriesHigherLevel: [],
		scalingLevelDice: [],
		damageInflict: [],
		conditionInflict: [],
		...over,
	}
}

function caster(className: string, ability: SpellcastingEntry['ability'], dc: number): SpellcastingEntry {
	return { className, classSource: 'XPHB', ability, spellAttackBonus: dc - 8, spellAttackBreakdown: [], spellSaveDC: dc, spellSaveDCBreakdown: [] }
}

const wizard = caster('Wizard', 'intelligence', 13)
const cleric = caster('Cleric', 'wisdom', 12)
const warlock = caster('Warlock', 'charisma', 14)
const sorcerer = caster('Sorcerer', 'charisma', 14)

const pick = (className: string, ...names: string[]) => ({ className, classSource: 'XPHB', spells: names.map((name) => ({ name, source: 'XPHB' })) })

describe('chosen spells per class (D325)', () => {
	it('splits a spell two classes chose into two rows, each casting with its own class', () => {
		const entries = combineSpellEntries([pick('Wizard', 'Detect Magic'), pick('Cleric', 'Detect Magic')], [])
		expect(entries.map((entry) => entry.chosenBy?.className)).toEqual(['Wizard', 'Cleric'])
		expect(new Set(entries.map(spellEntryKey)).size).toBe(2)
		const dcs = entries.map((entry) => {
			const result = casterFor(entry, [wizard, cleric], [], [])
			return 'reason' in result ? result.reason : result.save.dc
		})
		expect(dcs).toEqual([13, 12])
	})

	it('names the class in multiclass provenance only', () => {
		const [entry] = combineSpellEntries([pick('Sorcerer', 'Fireball')], [])
		expect(provenanceLabel(entry!, true)).toBe('player pick (Sorcerer)')
		expect(provenanceLabel(entry!)).toBe('player pick')
	})

	it('lists Warlock and Sorcerer picks apart on Actions even though both cast with CHA', () => {
		const entries = combineSpellEntries([pick('Warlock', 'Hold Person'), pick('Sorcerer', 'Hold Person')], [])
		const rows = spellActionRows(entries, [detail('Hold Person', 2, { savingThrow: ['wisdom'] })], 9, [warlock, sorcerer], [])
		expect(rows.map((row) => [row.origin, row.save?.dc, row.unresolved])).toEqual([
			['Warlock', 14, null],
			['Sorcerer', 14, null],
		])
		expect(new Set(rows.map((row) => row.key)).size).toBe(2)
	})

	it('casts a subclass grant with the class owning the subclass', () => {
		const [entry] = combineSpellEntries([], [{ subclassName: 'Life Domain', className: 'Cleric', classSource: 'XPHB', spells: [{ name: 'Bless', source: 'XPHB' }] }])
		const result = casterFor(entry!, [wizard, cleric], [], [])
		expect('reason' in result ? result.reason : result.save.dc).toBe(12)
	})

	it('keeps a grant merged into the choosing class row', () => {
		const entries = combineSpellEntries([pick('Cleric', 'Bless')], [{ subclassName: 'Life Domain', className: 'Cleric', classSource: 'XPHB', spells: [{ name: 'Bless', source: 'XPHB' }] }])
		expect(entries).toHaveLength(1)
		expect(entries[0]!.subclassOrigins).toEqual(['Life Domain'])
		expect(entries[0]!.chosenBy?.className).toBe('Cleric')
	})
})

const sorcererSlots: ClassSpellSlotsData = {
	className: 'Sorcerer',
	classSource: 'XPHB',
	casterProgression: 'full',
	spellSlotsByLevel: [
		[2, 0, 0],
		[3, 0, 0],
		[4, 2, 0],
	],
	pactSlotsByLevel: null,
}
const warlockSlots: ClassSpellSlotsData = {
	className: 'Warlock',
	classSource: 'XPHB',
	casterProgression: 'pact',
	spellSlotsByLevel: null,
	pactSlotsByLevel: [1, 1, 2, 2, 3, 3].map((slotLevel) => ({ count: 2, slotLevel })),
}
const sorcererCounts: ClassSpellCountData = { className: 'Sorcerer', classSource: 'XPHB', cantripProgression: [4, 4, 4], leveledSpellProgression: [2, 4, 6], label: 'prepared' }
const warlockCounts: ClassSpellCountData = { className: 'Warlock', classSource: 'XPHB', cantripProgression: [2, 2, 2, 3, 3, 3], leveledSpellProgression: [2, 3, 4, 5, 6, 7], label: 'prepared' }

const warlockSorcerer: Character = {
	id: '1',
	name: 'Test',
	classes: [
		{ className: 'Warlock', classSource: 'XPHB', subclass: null, level: 6 },
		{ className: 'Sorcerer', classSource: 'XPHB', subclass: null, level: 3 },
	],
}

describe('classSpellLimits (D325)', () => {
	const details = [detail('Fireball', 3), detail('Counterspell', 3), ...['A', 'B', 'C', 'D', 'E'].map((name) => detail(name, 0))]
	const entries = combineSpellEntries([pick('Warlock', 'Counterspell'), pick('Sorcerer', 'Fireball', 'A', 'B', 'C', 'D', 'E')], [])

	it('caps and counts each class from its own table and its own picks', () => {
		const limits = classSpellLimits(warlockSorcerer, [warlockSlots, sorcererSlots], [warlockCounts, sorcererCounts], entries, details)
		expect(limits.map((limit) => [limit.className, limit.reason, limit.highestLevel, limit.cantripsStored, limit.leveledSpellsStored])).toEqual([
			['Warlock', null, 3, 0, 1],
			['Sorcerer', null, 2, 5, 1],
		])
		const sections = spellsTabActionSections({
			entries,
			details,
			ordinarySlots: [4, 2, 0, 0, 0, 0, 0, 0, 0],
			pact: { count: 2, slotLevel: 3 },
			unavailableAboveFor: chosenSpellCap(limits, warlockSorcerer),
			resourceMaxima: new Map(),
		})
		const byName = new Map(sections.flatMap((section) => section.rows).map((row) => [row.entry.name, row.unavailable]))
		expect(byName.get('Fireball')).toBe(true)
		expect(byName.get('Counterspell')).toBe(false)
	})

	it('gives an unknown class its own reason only', () => {
		const limits = classSpellLimits(warlockSorcerer, [warlockSlots], [warlockCounts, sorcererCounts], entries, details)
		expect(limits[0]!.reason).toBeNull()
		expect(limits[1]!.reason).toMatch(/Sorcerer/)
	})
})
