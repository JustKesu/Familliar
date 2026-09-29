import { describe, expect, it } from 'vitest'
import type { Beast } from '../beasts/beastData'
import { flatBonusesByTarget } from '../calculation/itemFlatBonuses'
import { CUSTOM_ITEM_SOURCE, type CharacterInventoryItem, type CustomItemBonus } from '../storage/character'
import { extraRows, familiarHitPoints } from './extrasData'
import { applyFamiliarBonuses, familiarBonusLines, familiarItemBonuses, NO_FAMILIAR_BONUSES, rewriteAttackText } from './familiarItemBonuses'
import { buildItemFlatBonusGrants } from './itemFlatBonusData'

function pin(bonuses: CustomItemBonus[], extra: Partial<CharacterInventoryItem> = {}, requiresAttunement = false): CharacterInventoryItem {
	return {
		name: 'Familiar Pin',
		source: CUSTOM_ITEM_SOURCE,
		quantity: 1,
		custom: { name: 'Familiar Pin', kind: 'other', ...(requiresAttunement ? { requiresAttunement: true as const } : {}), bonuses },
		...extra,
	}
}

const CAT: Beast = {
	name: 'Cat',
	source: 'XMM',
	size: ['T'],
	type: 'beast',
	cr: '0',
	crNumber: 0,
	ac: [12],
	hp: { average: 2, formula: '1d4' },
	speed: { walk: 40, climb: 30 },
	str: 3,
	dex: 15,
	con: 10,
	int: 3,
	wis: 12,
	cha: 7,
	save: { dex: '+4' },
	action: [{ name: 'Scratch', entries: ['{@atkr m} {@hit 4}, reach 5 ft. {@h}1 Slashing damage.'] }],
}

const bonus = (target: CustomItemBonus['target'], amount: number): CustomItemBonus => ({ target, amount }) as CustomItemBonus

describe('familiarItemBonuses gate (D216)', () => {
	it('applies with no attunement requirement even carried in the pack, ignoring quantity', () => {
		const result = familiarItemBonuses([pin([bonus('familiarArmourClass', 2)], { quantity: 3 })], [], 5)
		expect(result.ac).toBe(2)
		expect(familiarBonusLines(result)).toEqual(['Familiar Pin: AC +2'])
	})

	it('withholds an unattuned item that requires attunement and says why, then applies once attuned', () => {
		const held = pin([bonus('familiarArmourClass', 2), bonus('familiarWalkingSpeed', 10)], {}, true)
		const before = familiarItemBonuses([held], [], 5)
		expect(before.ac).toBe(0)
		expect(before.speed).toBe(0)
		expect(familiarBonusLines(before)).toEqual(['Familiar Pin: AC +2, walking speed +10 — not applied: not attuned'])
		expect(familiarItemBonuses([{ ...held, attuned: true }], [], 5).ac).toBe(2)
	})

	it('multiplies a per-level max HP bonus by the character level', () => {
		const result = familiarItemBonuses([pin([{ target: 'familiarMaxHitPoints', amount: 1, perLevel: true }])], [], 3)
		expect(result.maxHp).toBe(3)
		expect(familiarBonusLines(result)).toEqual(['Familiar Pin: max HP +1 per level (+3)'])
	})

	it('grants nothing from a malformed definition (D43)', () => {
		const broken = pin([bonus('familiarArmourClass', 2)])
		broken.custom = { ...broken.custom!, bonuses: [{ target: 'familiarArmourClass', amount: 0 }] }
		expect(familiarItemBonuses([broken], [], 5)).toEqual(NO_FAMILIAR_BONUSES)
	})

	it('lists no source for an item with only character bonuses, and leaves the character’s own numbers alone', () => {
		const inventory = [pin([bonus('initiative', 2), bonus('familiarAttack', 1)])]
		expect(familiarItemBonuses([pin([bonus('initiative', 2)])], [], 5).sources).toEqual([])
		const flat = flatBonusesByTarget(buildItemFlatBonusGrants(inventory, []), 5)
		expect(flat.initiative).toHaveLength(1)
		expect(flat.weaponAttack).toEqual([])
	})
})

describe('applyFamiliarBonuses', () => {
	const totals = (patch: Partial<typeof NO_FAMILIAR_BONUSES>) => ({ ...NO_FAMILIAR_BONUSES, ...patch })

	it('returns the same beast when nothing applies', () => {
		expect(applyFamiliarBonuses(CAT, NO_FAMILIAR_BONUSES)).toBe(CAT)
	})

	it('moves AC, average HP and walking speed only, on a copy', () => {
		const next = applyFamiliarBonuses(CAT, totals({ ac: 2, maxHp: 5, speed: 10 }))
		expect(next.ac).toEqual([14])
		expect(next.hp).toEqual({ average: 7, formula: '1d4 + 5' })
		expect(next.speed).toEqual({ walk: 50, climb: 30 })
		expect(CAT.ac).toEqual([12])
		expect(CAT.speed.walk).toBe(40)
	})

	it('leaves a formula-only HP and a form with no walking speed alone', () => {
		const swimmer: Beast = { ...CAT, hp: { formula: '1d4' }, speed: { swim: 30 } }
		const next = applyFamiliarBonuses(swimmer, totals({ maxHp: 5, speed: 10 }))
		expect(next.hp).toEqual({ formula: '1d4' })
		expect(next.speed).toEqual({ swim: 30 })
	})

	it('lists all six saves: the data’s value where it has one, else the ability modifier, plus the bonus', () => {
		const next = applyFamiliarBonuses(CAT, totals({ save: 1 }))
		expect(next.save).toEqual({ str: '-3', dex: '+5', con: '+1', int: '-3', wis: '+2', cha: '-1' })
		expect(Object.keys(next.save!)).toEqual(['str', 'dex', 'con', 'int', 'wis', 'cha'])
	})

	it('rewrites the action text for attack and damage', () => {
		const next = applyFamiliarBonuses(CAT, totals({ attack: 1, damage: 1 }))
		expect(next.action![0].entries).toEqual(['{@atkr m} {@hit 5}, reach 5 ft. {@h}2 Slashing damage.'])
	})
})

describe('rewriteAttackText, one case per pattern in beasts.json (DATA.md, R14d)', () => {
	it('average with a dice modifier', () => {
		expect(rewriteAttackText('{@atkr m} {@hit 4}, reach 5 feet. {@h}4 ({@damage 1d4 + 2}) Slashing damage.', 1, 1)).toBe('{@atkr m} {@hit 5}, reach 5 feet. {@h}5 ({@damage 1d4 + 3}) Slashing damage.')
	})
	it('average with a negative modifier that reaches zero', () => {
		expect(rewriteAttackText('{@atkr m} {@hit 1}, reach 5 ft. {@h}1 ({@damage 1d4 - 1}) Piercing damage.', 0, 1)).toBe('{@atkr m} {@hit 1}, reach 5 ft. {@h}2 ({@damage 1d4}) Piercing damage.')
	})
	it('average with bare dice', () => {
		expect(rewriteAttackText('{@atkr m} {@hit 2}, reach 5 ft. {@h}2 ({@damage 1d4}) Bludgeoning damage.', 2, 2)).toBe('{@atkr m} {@hit 4}, reach 5 ft. {@h}4 ({@damage 1d4 + 2}) Bludgeoning damage.')
	})
	it('a flat number, with "to hit" wording and a ranged attack', () => {
		expect(rewriteAttackText('{@atkr m} {@hit 4} to hit, reach 5 ft. {@h}1 Piercing damage.', 1, 1)).toBe('{@atkr m} {@hit 5} to hit, reach 5 ft. {@h}2 Piercing damage.')
		expect(rewriteAttackText('{@atkr r} {@hit 6}, range 40/160 ft. {@h}1 Piercing damage, and the target has the {@condition Charmed|XPHB} condition.', 1, 1)).toContain('{@hit 7}, range 40/160 ft. {@h}2 Piercing')
	})
	it('moves the hit damage only, not a rider or an alternative', () => {
		expect(rewriteAttackText('{@atkr m} {@hit 2}, reach 5 ft. {@h}1 Piercing damage plus 3 ({@damage 1d6}) Poison damage.', 1, 1)).toBe('{@atkr m} {@hit 3}, reach 5 ft. {@h}2 Piercing damage plus 3 ({@damage 1d6}) Poison damage.')
	})
	it('a tag between the hit number and the damage', () => {
		const text = '{@atkr m} {@hit 5} (with {@variantrule Advantage|XPHB} if x), reach 5 ft. {@h}3 ({@damage 1d6}) Piercing damage.'
		expect(rewriteAttackText(text, 1, 1)).toBe('{@atkr m} {@hit 6} (with {@variantrule Advantage|XPHB} if x), reach 5 ft. {@h}4 ({@damage 1d6 + 1}) Piercing damage.')
	})
	it('leaves a saving-throw action and non-attack text alone', () => {
		const save = '{@actSave con} {@dc 12}, one creature. {@actSaveFail} 5 ({@damage 2d4}) Poison damage.'
		expect(rewriteAttackText(save, 1, 1)).toBe(save)
		expect(rewriteAttackText('The cat has advantage on Perception checks.', 1, 1)).toBe('The cat has advantage on Perception checks.')
	})
})

describe('the familiar’s Extras row', () => {
	const familiar = { name: 'Cat', source: 'XMM' }
	const forms = [{ beast: CAT, origin: 'spell' as const }]

	it('clamps a stored current HP above the new max', () => {
		expect(familiarHitPoints({ ...familiar, currentHp: 7 }, CAT)).toEqual({ current: 2, max: 2, temporary: 0 })
	})

	it('carries the bonuses on the familiar row and leaves a Wild Shape row unchanged', () => {
		const bonuses = familiarItemBonuses([pin([bonus('familiarArmourClass', 2), { target: 'familiarMaxHitPoints', amount: 5 }])], [], 3)
		const rows = extraRows({
			familiar,
			familiarForms: forms,
			wildShapeForms: [{ className: 'Druid', classSource: 'XPHB', forms: [{ name: 'Cat', source: 'XMM' }] }],
			beasts: [CAT],
			pending: false,
			familiarBonuses: bonuses,
		})
		expect(rows[0].beast?.ac).toEqual([14])
		expect(rows[0].hitPoints).toEqual({ current: 7, max: 7, temporary: 0 })
		expect(rows[1].beast).toBe(CAT)
	})
})
