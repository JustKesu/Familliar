import { describe, expect, it } from 'vitest'
import { concentrationSaveAdvantageLines } from './concentrationSaveAdvantages'

describe('concentrationSaveAdvantageLines', () => {
	it('Eldritch Mind and War Caster each give a line, invocation first', () => {
		expect(concentrationSaveAdvantageLines([{ name: 'Eldritch Mind' }], [{ name: 'War Caster', source: 'XPHB' }])).toEqual([
			'Advantage on Constitution saves to maintain Concentration (Eldritch Mind)',
			'Advantage on Constitution saves to maintain Concentration (War Caster)',
		])
	})

	it('other sources and other names give none', () => {
		expect(concentrationSaveAdvantageLines([{ name: 'Eldritch Mind', source: 'PHB' }, { name: 'Agonizing Blast', source: 'XPHB' }], [{ name: 'War Caster', source: 'PHB' }])).toEqual([])
	})
})
