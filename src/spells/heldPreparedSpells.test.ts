import { describe, expect, it } from 'vitest'
import { preparedByOtherClass } from './heldPreparedSpells'
import { spellIdentityKey } from './subclassPreparedSpells'

const groups = [
	{ className: 'Wizard', spells: [{ name: 'Shield', source: 'XPHB' }] },
	{ className: 'Cleric', spells: [{ name: 'Burning Hands', source: 'XPHB' }] },
	{ className: 'Warlock', spells: [{ name: 'Burning Hands', source: 'XPHB' }] },
]

describe('preparedByOtherClass (D331)', () => {
	it('maps a spell another class has always prepared to that class, the first one when several do', () => {
		const forWizard = preparedByOtherClass(groups, 'Wizard')
		expect(forWizard.get(spellIdentityKey('Burning Hands', 'XPHB'))).toBe('Cleric')
		expect(forWizard.has(spellIdentityKey('Shield', 'XPHB'))).toBe(false)
	})

	it('never reports a class to itself, and is empty for a single class', () => {
		expect(preparedByOtherClass(groups, 'Cleric').get(spellIdentityKey('Burning Hands', 'XPHB'))).toBe('Warlock')
		expect(preparedByOtherClass([groups[0]!], 'Wizard').size).toBe(0)
	})
})
