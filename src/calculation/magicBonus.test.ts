import { describe, expect, it } from 'vitest'
import { magicItemLabel, resolveMagicBonus } from './magicBonus'

describe('resolveMagicBonus', () => {
	it('applies the item’s own bonus and names it in the breakdown', () => {
		const bonus = resolveMagicBonus({ name: 'Dragon Scale Mail', itemBonus: 1, playerBonus: null, requiresAttunement: false, attuned: false })
		expect(bonus).toMatchObject({ carried: 1, applied: 1, origin: 'item', label: 'Dragon Scale Mail +1' })
		expect(bonus.contributions).toEqual([{ source: "magic bonus (Dragon Scale Mail's own)", amount: 1 }])
	})

	it('applies a player-set bonus on an item that has none of its own', () => {
		const bonus = resolveMagicBonus({ name: 'Longsword', itemBonus: null, playerBonus: 2, requiresAttunement: false, attuned: false })
		expect(bonus).toMatchObject({ carried: 2, applied: 2, origin: 'player', label: 'Longsword +2' })
		expect(bonus.contributions).toEqual([{ source: 'magic bonus (set on this item)', amount: 2 }])
	})

	it('never sums the two — the player-set bonus replaces the item’s own, which is still named', () => {
		const bonus = resolveMagicBonus({ name: 'Moon Sickle', itemBonus: 1, playerBonus: 1, requiresAttunement: false, attuned: false })
		expect(bonus.applied).toBe(1)
		expect(bonus.contributions).toEqual([
			{ source: 'magic bonus (set on this item)', amount: 1 },
			{ source: "magic bonus (Moon Sickle's own)", amount: 0, note: 'considered (+1) — not applied: replaced by the +1 set on this item' },
		])
	})

	it('withholds the bonus while the item requires attunement and is not attuned (D76)', () => {
		const context = { name: 'Sword of Sharpness', itemBonus: 3, playerBonus: null, requiresAttunement: true }
		const unattuned = resolveMagicBonus({ ...context, attuned: false })
		expect(unattuned).toMatchObject({ carried: 3, applied: 0, label: 'Sword of Sharpness +3' })
		expect(unattuned.contributions).toEqual([
			{
				source: "magic bonus (Sword of Sharpness's own)",
				amount: 0,
				note: 'considered (+3) — not applied: Sword of Sharpness requires attunement and you are not attuned to it',
			},
		])

		const attuned = resolveMagicBonus({ ...context, attuned: true })
		expect(attuned.applied).toBe(3)
		expect(attuned.contributions).toEqual([{ source: "magic bonus (Sword of Sharpness's own)", amount: 3 }])
	})

	it('contributes nothing at all for an ordinary item', () => {
		const bonus = resolveMagicBonus({ name: 'Torch', itemBonus: null, playerBonus: null, requiresAttunement: false, attuned: false })
		expect(bonus).toEqual({ carried: 0, origin: null, applied: 0, contributions: [], label: 'Torch' })
	})
})

describe('magicItemLabel', () => {
	it('appends the bonus to the name', () => {
		expect(magicItemLabel('Longsword', 1)).toBe('Longsword +1')
	})

	it('leaves a name that already spells the same bonus alone', () => {
		// 3 items in the data are named this way and none disagrees with its field (this slice's survey).
		expect(magicItemLabel('+1 Moon Sickle', 1)).toBe('+1 Moon Sickle')
	})

	it('still appends when the player set a different bonus than the name spells', () => {
		expect(magicItemLabel('+1 Moon Sickle', 3)).toBe('+1 Moon Sickle +3')
	})

	it('returns the plain name when there is no bonus', () => {
		expect(magicItemLabel('Longsword', 0)).toBe('Longsword')
	})
})
