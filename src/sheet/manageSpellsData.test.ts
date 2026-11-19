import { describe, expect, it } from 'vitest'
import { pickCounts, preparedSpellRows, spellbookFill, withClassPicks, withSpellbookSpells, type SpellRef } from './manageSpellsData'

const ref = (name: string): SpellRef => ({ name, source: 'XPHB' })

describe('spellbookFill (D422)', () => {
	const wizardLevels: Record<string, number> = { 'Fire Bolt': 0, Shield: 1, 'Magic Missile': 1, 'Misty Step': 2, Bless: 1 }
	const wizardLevelOf = (spell: SpellRef) => wizardLevels[spell.name] ?? null
	const migrated = (name: string) => ({ ...ref(name), origin: { kind: 'migrated' as const } })

	it('adds the leveled Wizard picks as migrated and leaves cantrips and unknown levels out', () => {
		const choices = [{ className: 'Wizard', classSource: 'XPHB', spells: [ref('Fire Bolt'), ref('Shield'), ref('Misty Step'), ref('Mystery')] }]
		expect(spellbookFill(undefined, choices, wizardLevelOf)).toEqual([{ className: 'Wizard', classSource: 'XPHB', spells: [migrated('Shield'), migrated('Misty Step')] }])
	})

	it('keeps what the book holds and adds only the missing picks', () => {
		const book = [{ className: 'Wizard', classSource: 'XPHB', spells: [{ ...ref('Shield'), origin: { kind: 'copied' as const } }] }]
		const choices = [{ className: 'Wizard', classSource: 'XPHB', spells: [ref('Shield'), ref('Magic Missile')] }]
		expect(spellbookFill(book, choices, wizardLevelOf)).toEqual([
			{ className: 'Wizard', classSource: 'XPHB', spells: [{ ...ref('Shield'), origin: { kind: 'copied' } }, migrated('Magic Missile')] },
		])
	})

	it('returns null when nothing is missing, so the sheet writes once and never loops', () => {
		const choices = [{ className: 'Wizard', classSource: 'XPHB', spells: [ref('Fire Bolt'), ref('Shield')] }]
		const filled = spellbookFill(undefined, choices, wizardLevelOf)
		expect(spellbookFill(filled!, choices, wizardLevelOf)).toBeNull()
		expect(spellbookFill(undefined, [{ className: 'Wizard', classSource: 'XPHB', spells: [ref('Fire Bolt')] }], wizardLevelOf)).toBeNull()
	})

	it('gives no other class a book, nor the 2014 Wizard', () => {
		const choices = [
			{ className: 'Cleric', classSource: 'XPHB', spells: [ref('Bless')] },
			{ className: 'Wizard', classSource: 'PHB', spells: [ref('Shield')] },
		]
		expect(spellbookFill(undefined, choices, wizardLevelOf)).toBeNull()
	})

	it('withSpellbookSpells drops an emptied book', () => {
		const book = [{ className: 'Wizard', classSource: 'XPHB', spells: [migrated('Shield')] }]
		expect(withSpellbookSpells(book, 'Wizard', 'XPHB', [])).toEqual([])
	})
})
const LEVELS: Record<string, number> = { Guidance: 0, Light: 0, Bless: 1, 'Cure Wounds': 1, Aid: 2, 'Spiritual Weapon': 2 }
const levelOf = (spell: SpellRef) => LEVELS[spell.name] ?? null

describe('preparedSpellRows / pickCounts (D208)', () => {
	const rows = preparedSpellRows(
		{
			picks: [ref('Guidance'), ref('Aid'), ref('Bless'), ref('Mystery')],
			subclassChoicePicks: [ref('Spiritual Weapon')],
			alwaysPrepared: [ref('Bless'), ref('Cure Wounds'), ref('Light')],
		},
		levelOf,
	)

	it('lists every spell the class gives once, cantrips first, a picked spell keeping its pick kind', () => {
		expect(rows.map((row) => [row.name, row.kind])).toEqual([
			['Guidance', 'pick'],
			['Light', 'alwaysPrepared'],
			['Bless', 'pick'],
			['Cure Wounds', 'alwaysPrepared'],
			['Aid', 'pick'],
			['Spiritual Weapon', 'subclassChoice'],
			['Mystery', 'pick'],
		])
	})

	it('counts only the class’s own picks of known level — not always-prepared, not subclass choice picks', () => {
		// Bless is picked AND always prepared: it keeps its Unprepare button but no longer takes a slot (F-7b).
		expect(rows.find((row) => row.name === 'Bless')).toMatchObject({ kind: 'pick', alsoGranted: true })
		expect(pickCounts(rows)).toEqual({ cantrips: 1, prepared: 1 })
	})
})

describe('withClassPicks', () => {
	const choices = [
		{ className: 'Cleric', classSource: 'XPHB', spells: [ref('Bless')] },
		{ className: 'Wizard', classSource: 'XPHB', spells: [ref('Shield')] },
	]

	it('replaces one class’s picks in place', () => {
		expect(withClassPicks(choices, 'Cleric', 'XPHB', [ref('Bless'), ref('Aid')])).toEqual([
			{ className: 'Cleric', classSource: 'XPHB', spells: [ref('Bless'), ref('Aid')] },
			choices[1],
		])
	})

	it('adds an entry for a class with none, and drops one left empty', () => {
		expect(withClassPicks([], 'Sorcerer', 'XPHB', [ref('Fire Bolt')])).toEqual([{ className: 'Sorcerer', classSource: 'XPHB', spells: [ref('Fire Bolt')] }])
		expect(withClassPicks(choices, 'Cleric', 'XPHB', [])).toEqual([choices[1]])
	})
})
