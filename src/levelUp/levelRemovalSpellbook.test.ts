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

describe('Remove level and the book picks (D425)', () => {
	function wizardAt(level: number): Character {
		const character = wizard4()
		character.classes = [{ className: 'Wizard', classSource: 'XPHB', subclass: null, level }]
		character.spellbooks = [
			{
				...character.spellbooks![0],
				spells: [...character.spellbooks![0].spells, { name: 'Fireball', source: 'XPHB', origin: { kind: 'level', level } }, { name: 'Counterspell', source: 'XPHB', origin: { kind: 'copied' } }],
				mastery: [
					{ name: 'Sleep', source: 'XPHB' },
					{ name: 'Web', source: 'XPHB' },
				],
				signature: [
					{ name: 'Fireball', source: 'XPHB' },
					{ name: 'Counterspell', source: 'XPHB' },
				],
			},
		]
		return character
	}

	it('Wizard 18 to 17 drops both Mastery picks and names them', () => {
		const plan = levelRemovalCore(wizardAt(18), CLASSES, RESOLVER, null)
		if ('reason' in plan) throw new Error(plan.reason)
		expect(plan.result.spellbooks?.[0].mastery).toBeUndefined()
		expect(plan.dropped).toEqual(expect.arrayContaining(['Spell Mastery: Sleep', 'Spell Mastery: Web']))
	})

	it('Wizard 20 to 19 drops the Signature picks and keeps Mastery, except a pick whose spell left with the level', () => {
		const plan = levelRemovalCore(wizardAt(20), CLASSES, RESOLVER, null)
		if ('reason' in plan) throw new Error(plan.reason)
		expect(plan.result.spellbooks?.[0].mastery).toEqual([
			{ name: 'Sleep', source: 'XPHB' },
			{ name: 'Web', source: 'XPHB' },
		])
		expect(plan.result.spellbooks?.[0].signature).toBeUndefined()
		expect(plan.dropped).toEqual(expect.arrayContaining(['Signature Spells: Fireball', 'Signature Spells: Counterspell']))
		expect(plan.dropped.some((line) => line.startsWith('Spell Mastery:'))).toBe(false)
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

	it('F-HLSB B: a book entry lost with Wizard 4 stays prepared while a remaining Savant pick keeps it in the book', () => {
		const character = evoker3()
		character.classes = [{ className: 'Wizard', classSource: 'XPHB', subclass: 'Evoker', level: 4 }]
		character.spellbooks = [
			{
				className: 'Wizard',
				classSource: 'XPHB',
				spells: [
					{ name: 'Shatter', source: 'XPHB', origin: { kind: 'level', level: 4 } },
					{ name: 'Shield', source: 'XPHB', origin: { kind: 'level', level: 4 } },
				],
			},
		]
		const plan = levelRemovalCore(character, CLASSES, RESOLVER, null)
		if ('reason' in plan) throw new Error(plan.reason)
		expect(plan.result.spellChoices?.[0].spells.map((spell) => spell.name)).toEqual(['Shatter', 'Thunderwave'])
		expect(plan.dropped).toEqual(expect.arrayContaining(['Spellbook: Shatter', 'Wizard spell: Shield (no longer prepared)']))
		expect(plan.dropped).not.toContain('Wizard spell: Shatter (no longer prepared)')
	})

	it('F-HLSB C: a Savant record of another subclass does not keep a lost book entry prepared', () => {
		const character = evoker3()
		character.classes = [{ className: 'Wizard', classSource: 'XPHB', subclass: 'Evoker', level: 4 }]
		character.subclassSpellChoices = [{ ...character.subclassSpellChoices![0], subclassName: 'Abjurer' }]
		character.spellbooks = [{ className: 'Wizard', classSource: 'XPHB', spells: [{ name: 'Shatter', source: 'XPHB', origin: { kind: 'level', level: 4 } }] }]
		const plan = levelRemovalCore(character, CLASSES, RESOLVER, null)
		if ('reason' in plan) throw new Error(plan.reason)
		expect(plan.dropped).toContain('Wizard spell: Shatter (no longer prepared)')
	})
})

describe('Remove level and fighting style cantrips (F-HLSB D)', () => {
	it('names the Blessed Warrior cantrips that go with the style', () => {
		const resolver = {
			...RESOLVER,
			classFeatures: [
				...(RESOLVER.classFeatures as unknown[]),
				{ id: 'cf|fighting style|paladin|xphb|2|xphb', name: 'Fighting Style', className: 'Paladin', classSource: 'XPHB', level: 2, entries: ['You gain a Fighting Style feat.'] },
			],
		}
		const paladin: Character = {
			id: 'p1',
			name: 'Paladin',
			classes: [{ className: 'Paladin', classSource: 'XPHB', subclass: null, level: 2 }],
			fightingStyles: [
				{
					className: 'Paladin',
					classSource: 'XPHB',
					name: 'Blessed Warrior',
					source: 'XPHB',
					filterChoiceSpells: { cantrips: [{ name: 'Guidance', source: 'XPHB' }, { name: 'Sacred Flame', source: 'XPHB' }], spells: [] },
				},
			],
		}
		const plan = levelRemovalCore(paladin, CLASSES, resolver as typeof RESOLVER, null)
		if ('reason' in plan) throw new Error(plan.reason)
		expect(plan.result.fightingStyles).toEqual([])
		expect(plan.dropped).toEqual(expect.arrayContaining(['Fighting style: Blessed Warrior', 'Fighting style cantrip: Guidance', 'Fighting style cantrip: Sacred Flame']))
	})
})
