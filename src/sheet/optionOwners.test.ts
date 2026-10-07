import { describe, expect, it } from 'vitest'
import { multiclassOptionOwner, type OptionOwner } from './optionOwners'

const owners: OptionOwner[] = [
	{ featureType: 'EI', className: 'Warlock', subclass: null },
	{ featureType: 'MM', className: 'Sorcerer', subclass: null },
	{ featureType: 'MV:B', className: 'Fighter', subclass: 'Battle Master' },
]
const option = (name: string, featureType: string) => ({ name, source: 'XPHB', entries: [], featureType })

describe('multiclassOptionOwner (F-10)', () => {
	it('names the class whose progression offers an invocation or metamagic option', () => {
		expect(multiclassOptionOwner(option('Agonizing Blast', 'EI'), [], owners)).toEqual({ className: 'Warlock', label: 'Warlock' })
		expect(multiclassOptionOwner(option('Twinned Spell', 'MM'), [], owners)).toEqual({ className: 'Sorcerer', label: 'Sorcerer' })
	})

	it('labels a subclass option with the subclass and keeps the owning class for grouping', () => {
		expect(multiclassOptionOwner(option('Riposte', 'MV:B'), [], owners)).toEqual({ className: 'Fighter', label: 'Battle Master' })
	})

	it('prefers the class stored on a fighting style (D328)', () => {
		const styles = [{ className: 'Paladin', classSource: 'XPHB', name: 'Defense', source: 'XPHB' }]
		expect(multiclassOptionOwner(option('Defense', 'FS'), styles, owners)).toEqual({ className: 'Paladin', label: 'Paladin' })
	})

	it('says nothing when no class offers the type', () => {
		expect(multiclassOptionOwner(option('Mystery', 'ZZ'), [], owners)).toBeNull()
	})
})
