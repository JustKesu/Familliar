import { describe, expect, it } from 'vitest'
import { breathWeaponDiceCount, computeBreathWeapon } from './breathWeapon'
import { known } from './types'

const con14 = known({ modifier: 2 }, [])
const black = [{ kind: 'resistance' as const, sourceName: 'Dragonborn (Black)', damageTypes: ['acid'] }]

describe('breathWeaponDiceCount', () => {
	it.each([
		[1, 1],
		[4, 1],
		[5, 2],
		[10, 2],
		[11, 3],
		[17, 4],
		[20, 4],
	])('level %i rolls %id10', (level, dice) => {
		expect(breathWeaponDiceCount(level)).toBe(dice)
	})
})

describe('computeBreathWeapon', () => {
	it('DC is 8 + CON modifier + Proficiency Bonus: CON 14 at level 1 is 12, at level 5 is 13', () => {
		const level1 = computeBreathWeapon(1, con14, known(2, []), black).dc
		const level5 = computeBreathWeapon(5, con14, known(3, []), black).dc
		expect(level1.status === 'known' && level1.value).toBe(12)
		expect(level5.status === 'known' && level5.value).toBe(13)
	})

	it('damage is the dice for the level and the ancestry type', () => {
		expect(computeBreathWeapon(5, con14, known(3, []), black).damage).toMatchObject({ status: 'known', value: '2d10 Acid' })
	})

	it('an ancestry not chosen leaves the damage unknown', () => {
		const bare = [{ kind: 'resistance' as const, sourceName: 'Dragonborn', damageTypes: [], choiceFrom: ['acid', 'fire'] }]
		expect(computeBreathWeapon(1, con14, known(2, []), bare).damage.status).toBe('unknown')
		expect(computeBreathWeapon(1, con14, known(2, []), []).damage.status).toBe('unknown')
	})
})
