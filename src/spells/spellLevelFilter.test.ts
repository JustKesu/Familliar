import { describe, expect, it } from 'vitest'
import type { SpellSlotsEntry } from '../calculation/spellSlots'
import type { ClassSpellListSpell } from './classSpellListData'
import { filterSpellsByLevel } from './spellLevelFilter'

function spell(name: string, level: number): ClassSpellListSpell {
	return { name, source: 'XPHB', level, ritual: false, concentration: false, viaVariant: false }
}

const spellList: ClassSpellListSpell[] = [
	spell('Prestidigitation', 0),
	spell('Fire Bolt', 0),
	spell('Magic Missile', 1),
	spell('Misty Step', 2),
	spell('Fireball', 3),
	spell('Polymorph', 4),
	spell('Wish', 9),
]

describe('filterSpellsByLevel', () => {
	it('a full caster (Wizard) with slots up to level 3: keeps 1-3, drops 4+, keeps cantrips', () => {
		const slots: SpellSlotsEntry = {
			className: 'Wizard',
			classSource: 'XPHB',
			ordinarySlots: [4, 3, 2, 0, 0, 0, 0, 0, 0],
		}
		const result = filterSpellsByLevel(spellList, slots)
		expect(result.map((s) => s.name).sort()).toEqual(['Fire Bolt', 'Fireball', 'Magic Missile', 'Misty Step', 'Prestidigitation'].sort())
	})

	it('a half caster (Paladin) with slots up to level 2: keeps 1-2, drops 3+, keeps cantrips', () => {
		const slots: SpellSlotsEntry = {
			className: 'Paladin',
			classSource: 'XPHB',
			ordinarySlots: [4, 2, 0, 0, 0, 0, 0, 0, 0],
		}
		const result = filterSpellsByLevel(spellList, slots)
		expect(result.map((s) => s.name).sort()).toEqual(['Fire Bolt', 'Magic Missile', 'Misty Step', 'Prestidigitation'].sort())
	})

	it('a Warlock whose pact slots are level 3: keeps 1-3, drops 4+, from the pact slot level', () => {
		const slots: SpellSlotsEntry = {
			className: 'Warlock',
			classSource: 'XPHB',
			pactSlots: { count: 2, slotLevel: 3 },
		}
		const result = filterSpellsByLevel(spellList, slots)
		expect(result.map((s) => s.name).sort()).toEqual(['Fire Bolt', 'Fireball', 'Magic Missile', 'Misty Step', 'Prestidigitation'].sort())
	})

	it('cantrips always survive regardless of slot level, even with only level-1 slots', () => {
		const slots: SpellSlotsEntry = {
			className: 'Wizard',
			classSource: 'XPHB',
			ordinarySlots: [2, 0, 0, 0, 0, 0, 0, 0, 0],
		}
		const result = filterSpellsByLevel(spellList, slots)
		expect(result.map((s) => s.name)).toContain('Prestidigitation')
		expect(result.map((s) => s.name)).toContain('Fire Bolt')
		expect(result.find((s) => s.name === 'Misty Step')).toBeUndefined()
	})

	it('no spell slots entry at all: only cantrips survive (a non-caster class has no leveled access)', () => {
		const result = filterSpellsByLevel(spellList, undefined)
		expect(result.map((s) => s.name).sort()).toEqual(['Fire Bolt', 'Prestidigitation'].sort())
	})
})
