import { describe, expect, it } from 'vitest'
import type { Character } from '../storage/character'
import { CLASSES, RESOLVER } from './levelGains.fixtures'
import { levelRemovalCore } from './levelRemoval'

/* D423: Remove level and the Wizard's book. */

function wizard4(): Character {
	return {
		id: 'w1',
		name: 'Elminster',
		classes: [{ className: 'Wizard', classSource: 'XPHB', subclass: null, level: 4 }],
		spellChoices: [
			{
				className: 'Wizard',
				classSource: 'XPHB',
				spells: [
					{ name: 'Shield', source: 'XPHB' },
					{ name: 'Misty Step', source: 'XPHB' },
					{ name: 'Web', source: 'XPHB' },
				],
			},
		],
		spellbooks: [
			{
				className: 'Wizard',
				classSource: 'XPHB',
				spells: [
					{ name: 'Shield', source: 'XPHB', origin: { kind: 'level', level: 1 } },
					{ name: 'Misty Step', source: 'XPHB', origin: { kind: 'level', level: 4 } },
					{ name: 'Web', source: 'XPHB', origin: { kind: 'level', level: 4 } },
					{ name: 'Identify', source: 'XPHB', origin: { kind: 'copied' } },
					{ name: 'Sleep', source: 'XPHB', origin: { kind: 'migrated' } },
				],
			},
		],
	}
}

describe('Remove level of a Wizard (D423)', () => {
	it('removes the book entries written at that Wizard level and unprepares them; copied and migrated stay', () => {
		const plan = levelRemovalCore(wizard4(), CLASSES, RESOLVER, null)
		if ('reason' in plan) throw new Error(plan.reason)
		expect(plan.result.spellbooks?.[0].spells.map((spell) => spell.name)).toEqual(['Shield', 'Identify', 'Sleep'])
		expect(plan.result.spellChoices?.[0].spells.map((spell) => spell.name)).toEqual(['Shield'])
		expect(plan.dropped).toEqual(expect.arrayContaining(['Spellbook: Misty Step', 'Spellbook: Web', 'Wizard spell: Misty Step (no longer prepared)', 'Wizard spell: Web (no longer prepared)']))
	})

	it('leaves the book alone when no entry carries the removed level', () => {
		const character = wizard4()
		character.classes = [{ className: 'Wizard', classSource: 'XPHB', subclass: null, level: 5 }]
		const plan = levelRemovalCore(character, CLASSES, RESOLVER, null)
		if ('reason' in plan) throw new Error(plan.reason)
		expect(plan.result.spellbooks).toEqual(character.spellbooks)
		expect(plan.dropped.some((line) => line.startsWith('Spellbook:'))).toBe(false)
	})
})

describe('Remove level and Savant picks (D424)', () => {
	function evoker3(): Character {
		return {
			id: 'w2',
			name: 'Evoker',
			classes: [{ className: 'Wizard', classSource: 'XPHB', subclass: 'Evoker', level: 3 }],
			subclassSpellChoices: [
				{
					subclassName: 'Evoker',
					subclassSource: 'XPHB',
					className: 'Wizard',
					classSource: 'XPHB',
					picks: [
						{ grantedAtLevel: 3, slotIndex: 0, name: 'Shatter', source: 'XPHB' },
						{ grantedAtLevel: 3, slotIndex: 1, name: 'Thunderwave', source: 'XPHB' },
					],
				},
			],
			spellChoices: [{ className: 'Wizard', classSource: 'XPHB', spells: [{ name: 'Shatter', source: 'XPHB' }, { name: 'Thunderwave', source: 'XPHB' }, { name: 'Shield', source: 'XPHB' }] }],
			spellbooks: [
				{
					className: 'Wizard',
					classSource: 'XPHB',
					spells: [
						{ name: 'Shield', source: 'XPHB', origin: { kind: 'level', level: 1 } },
						{ name: 'Thunderwave', source: 'XPHB', origin: { kind: 'copied' } },
					],
				},
			],
		}
	}

	it('unprepares a lost Savant spell the stored book does not hold, and names it', () => {
		const plan = levelRemovalCore(evoker3(), CLASSES, RESOLVER, null)
		if ('reason' in plan) throw new Error(plan.reason)
		expect(plan.result.subclassSpellChoices).toEqual([])
		expect(plan.result.spellChoices?.[0].spells.map((spell) => spell.name)).toEqual(['Thunderwave', 'Shield'])
		expect(plan.dropped).toEqual(expect.arrayContaining(['Evoker spell choice: Shatter', 'Wizard spell: Shatter (no longer prepared)']))
		expect(plan.dropped).not.toContain('Wizard spell: Thunderwave (no longer prepared)')
	})
})
