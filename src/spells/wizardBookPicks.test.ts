import { describe, expect, it } from 'vitest'
import type { CharacterSpellbook } from '../storage/character'
import { withSpellbookSpells } from '../sheet/manageSpellsData'
import {
	activeBookPicks,
	bookPickFeatureNote,
	bookPickKindFor,
	bookPickStatus,
	canToggleBookPick,
	prunedBookPicks,
	toggledBookPicks,
	withBookPicks,
} from './wizardBookPicks'

const ACTION = [{ number: 1, unit: 'action' }]
const REACTION = [{ number: 1, unit: 'reaction' }]
const ref = (name: string) => ({ name, source: 'XPHB' })
const LEVELS: Record<string, number> = { 'Magic Missile': 1, Sleep: 1, 'Misty Step': 2, Web: 2, Fireball: 3, Counterspell: 3, Fly: 3 }
const levelOf = (spell: { name: string }) => LEVELS[spell.name] ?? null

function book(over: Partial<CharacterSpellbook> = {}): CharacterSpellbook {
	return {
		className: 'Wizard',
		classSource: 'XPHB',
		spells: Object.keys(LEVELS).map((name) => ({ ...ref(name), origin: { kind: 'copied' as const } })),
		...over,
	}
}

describe('bookPickKindFor (D425)', () => {
	it('offers Mastery for a level 1 or 2 action spell from Wizard 18', () => {
		expect(bookPickKindFor(1, ACTION, 18)).toBe('mastery')
		expect(bookPickKindFor(2, ACTION, 20)).toBe('mastery')
		expect(bookPickKindFor(1, ACTION, 17)).toBeNull()
	})
	it('refuses a reaction or bonus action spell (Shield) and other levels', () => {
		expect(bookPickKindFor(1, REACTION, 18)).toBeNull()
		expect(bookPickKindFor(2, [{ number: 1, unit: 'bonus' }], 18)).toBeNull()
		expect(bookPickKindFor(4, ACTION, 20)).toBeNull()
	})
	it('offers Signature for a level 3 spell at Wizard 20 only, whatever its casting time', () => {
		expect(bookPickKindFor(3, REACTION, 20)).toBe('signature')
		expect(bookPickKindFor(3, ACTION, 19)).toBeNull()
	})
})

describe('limits (D425)', () => {
	it('Mastery takes one spell per level', () => {
		const picks = toggledBookPicks({ mastery: [], signature: [] }, 'mastery', ref('Sleep'))
		expect(canToggleBookPick(picks, 'mastery', ref('Magic Missile'), levelOf)).toBe(false)
		expect(canToggleBookPick(picks, 'mastery', ref('Web'), levelOf)).toBe(true)
		expect(canToggleBookPick(picks, 'mastery', ref('Sleep'), levelOf)).toBe(true)
		expect(toggledBookPicks(picks, 'mastery', ref('Sleep')).mastery).toEqual([])
	})
	it('Signature takes two', () => {
		const picks = { mastery: [], signature: [ref('Fireball'), ref('Counterspell')] }
		expect(canToggleBookPick(picks, 'signature', ref('Fly'), levelOf)).toBe(false)
		expect(canToggleBookPick(picks, 'signature', ref('Fireball'), levelOf)).toBe(true)
	})
	it('status lines appear at 18 and 20', () => {
		const picks = { mastery: [ref('Sleep')], signature: [] }
		expect(bookPickStatus(picks, 17)).toEqual([])
		expect(bookPickStatus(picks, 18)).toEqual(['Spell Mastery: 1/2 chosen'])
		expect(bookPickStatus(picks, 20)).toEqual(['Spell Mastery: 1/2 chosen', 'Signature Spells: 0/2 chosen'])
	})
})

describe('active and pruned picks (D425)', () => {
	const stored = book({ mastery: [ref('Sleep'), ref('Web')], signature: [ref('Fireball')] })

	it('counts only picks still in the book (Savant included) at a level that grants them', () => {
		expect(activeBookPicks(stored, [ref('Sleep'), ref('Fireball')], 20)).toEqual({ mastery: [ref('Sleep')], signature: [ref('Fireball')] })
		expect(activeBookPicks(stored, stored.spells, 18)).toEqual({ mastery: [ref('Sleep'), ref('Web')], signature: [] })
		expect(activeBookPicks(stored, stored.spells, 17)).toEqual({ mastery: [], signature: [] })
	})

	it('Remove from spellbook drops the mark of that spell only', () => {
		const spells = stored.spells.filter((spell) => spell.name !== 'Sleep')
		const { spellbooks, dropped } = prunedBookPicks(withSpellbookSpells([stored], 'Wizard', 'XPHB', spells), 'Wizard', 'XPHB', spells, 20)
		expect(spellbooks[0].mastery).toEqual([ref('Web')])
		expect(spellbooks[0].signature).toEqual([ref('Fireball')])
		expect(dropped).toEqual(['Spell Mastery: Sleep'])
	})

	it('a Savant spell keeps its mark although the stored book lacks it', () => {
		const spells = stored.spells.filter((spell) => spell.name !== 'Web')
		expect(prunedBookPicks([stored], 'Wizard', 'XPHB', [...spells, ref('Web')], 20).dropped).toEqual([])
	})

	it('F-HLSB F: a book whose picks all stay is returned untouched, even after another book lost one', () => {
		const second = book({ mastery: [ref('Web')] })
		const spells = stored.spells.filter((spell) => spell.name !== 'Sleep')
		const { spellbooks } = prunedBookPicks([{ ...stored, spells }, second], 'Wizard', 'XPHB', spells, 20)
		expect(spellbooks[0].mastery).toEqual([ref('Web')])
		expect(spellbooks[1]).toBe(second)
	})

	it('withSpellbookSpells keeps the picks; withBookPicks leaves empty lists out', () => {
		expect(withSpellbookSpells([stored], 'Wizard', 'XPHB', stored.spells)[0].mastery).toEqual(stored.mastery)
		expect(withBookPicks(stored, { mastery: [], signature: [] })).toEqual(book())
	})
})

describe('bookPickFeatureNote (D425)', () => {
	it('points the 2024 Wizard features to Manage Spells', () => {
		expect(bookPickFeatureNote('Spell Mastery', 'Wizard', 'XPHB')).toBe('Choose in Manage Spells')
		expect(bookPickFeatureNote('Signature Spells', 'Wizard', 'XPHB')).toBe('Choose in Manage Spells')
		expect(bookPickFeatureNote('Spell Mastery', 'Wizard', 'PHB')).toBeNull()
		expect(bookPickFeatureNote('Arcane Recovery', 'Wizard', 'XPHB')).toBeNull()
	})
})
