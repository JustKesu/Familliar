import { describe, expect, it } from 'vitest'
import { classSaveAdvantageLines } from './classSaveAdvantages'

const cls = (className: string, level: number, subclass: string | null = null, classSource = 'XPHB') => ({ className, classSource, level, subclass })

describe('classSaveAdvantageLines', () => {
	it('gates on class level: Barbarian 1 has Rage only, Barbarian 2 adds Danger Sense', () => {
		expect(classSaveAdvantageLines([cls('Barbarian', 1)])).toEqual(['Advantage on Strength saves while raging (Rage)'])
		expect(classSaveAdvantageLines([cls('Barbarian', 2)])).toEqual(['Advantage on Strength saves while raging (Rage)', 'Advantage on Dexterity saves unless Incapacitated (Danger Sense)'])
	})

	it('gates on subclass and source', () => {
		expect(classSaveAdvantageLines([cls('Wizard', 14, 'Abjurer')])).toEqual(['Advantage on saves against spells (Spell Resistance)'])
		expect(classSaveAdvantageLines([cls('Wizard', 14, 'Diviner')])).toEqual([])
		expect(classSaveAdvantageLines([cls('Barbarian', 2, null, 'PHB')])).toEqual([])
	})
})
