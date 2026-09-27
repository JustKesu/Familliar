import { describe, expect, it } from 'vitest'
import { pickCounts, preparedSpellRows, withClassPicks, type SpellRef } from './manageSpellsData'

const ref = (name: string): SpellRef => ({ name, source: 'XPHB' })
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
		expect(pickCounts(rows)).toEqual({ cantrips: 1, prepared: 2 })
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
