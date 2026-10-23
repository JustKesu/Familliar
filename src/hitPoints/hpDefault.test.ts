import { describe, expect, it, vi } from 'vitest'
import { currentHpAfterMaxHpChange, currentHpFollowingMaxHp } from '../calculation/maxHitPoints'
import { CUSTOM_ITEM_SOURCE, type Character } from '../storage/character'
import { loadCharacterMaxHp, maxHpShift } from './hpDefault'

vi.mock('../sheet/sheetData', () => ({
	loadHitDiceClassData: vi.fn(async () => [{ className: 'Fighter', classSource: 'XPHB', faces: 10 }]),
	loadFeatEffectEntries: vi.fn(async () => []),
}))
vi.mock('../sheet/grantedClassFeatures', () => ({ loadGrantedClassFeatures: vi.fn(async () => []) }))
vi.mock('../sheet/speciesTraitNames', () => ({ loadSpeciesTraitNames: vi.fn(async () => []) }))
vi.mock('../inventory/inventoryData', async (importOriginal) => ({ ...(await importOriginal<typeof import('../inventory/inventoryData')>()), loadItemRefs: vi.fn(async () => []) }))

/* CON 13 (+1): level 3 is 10 + 6 + 6 + 3 = 25, level 4 is 10 + 6 + 6 + 6 + 4 = 32 before any item. */
function fighter(level: number, custom?: Record<string, unknown>, attuned = false): Character {
	return {
		id: 'f',
		name: 'Fighter',
		classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level }],
		abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 8, wisdom: 12, charisma: 10 } },
		...(custom ? { inventory: [{ name: 'Lucky Pin', source: CUSTOM_ITEM_SOURCE, quantity: 1, ...(attuned ? { attuned: true } : {}), custom: { name: 'Lucky Pin', kind: 'other', ...custom } }] } : {}),
	} as Character
}

const perLevel = { bonuses: [{ target: 'maxHitPoints', amount: 1, perLevel: true }] }

describe('loadCharacterMaxHp with item bonuses (R14a2)', () => {
	it('counts a per-level item bonus against the character level, as the sheet does', async () => {
		expect(await loadCharacterMaxHp(fighter(3, perLevel))).toMatchObject({ status: 'known', value: 28 })
		expect(await loadCharacterMaxHp(fighter(4, perLevel))).toMatchObject({ status: 'known', value: 36 })
	})

	it('shifts current HP by the real max-HP change on level up and back on removal', async () => {
		const [before, after] = await Promise.all([loadCharacterMaxHp(fighter(3, perLevel)), loadCharacterMaxHp(fighter(4, perLevel))])
		// 28 → 36 is +8 (7 from the level, 1 from the item); full HP stays full.
		expect(currentHpAfterMaxHpChange(28, before, after)).toBe(36)
		expect(currentHpAfterMaxHpChange(36, after, before)).toBe(28)
	})

	it('F-5 (finding 10): Tough taken as the species feat reaches the maximum', async () => {
		const human = { ...fighter(3), grantedFeats: [{ origin: 'species' as const, name: 'Tough', source: 'XPHB' }] }
		expect(await loadCharacterMaxHp(human)).toMatchObject({ status: 'known', value: 25 + 6 })
	})

	it('D376: Tough from Lessons of the First Ones reaches the maximum only while the invocation is held', async () => {
		const withFeat = { ...fighter(3), grantedFeats: [{ origin: 'invocation' as const, id: 'a', name: 'Tough', source: 'XPHB' }] }
		const lessons = [{ featureType: 'EI', choices: [{ name: 'Lessons of the First Ones', source: 'XPHB', level: 2 }] }]
		expect(await loadCharacterMaxHp({ ...withFeat, optionalFeatureChoices: lessons })).toMatchObject({ status: 'known', value: 25 + 6 })
		expect(await loadCharacterMaxHp(withFeat)).toMatchObject({ status: 'known', value: 25 })
	})

	it('leaves an unattuned attunement item out of the shift (D76)', async () => {
		const gated = { ...perLevel, requiresAttunement: true }
		const [before, after] = await Promise.all([loadCharacterMaxHp(fighter(3, gated)), loadCharacterMaxHp(fighter(4, gated))])
		expect(currentHpAfterMaxHpChange(25, before, after)).toBe(32)
		expect(await loadCharacterMaxHp(fighter(4, gated, true))).toMatchObject({ value: 36 })
	})
})

describe('maxHpShift + currentHpFollowingMaxHp (D381)', () => {
	const tough = (character: Character): Character => ({ ...character, grantedFeats: [{ origin: 'manual', id: 'm', name: 'Tough', source: 'XPHB' }] }) as Character

	it('Tough added raises current by the same amount, removed lowers it back', async () => {
		const up = await maxHpShift(fighter(3), tough(fighter(3)))
		expect(up).toBe(6)
		expect(currentHpFollowingMaxHp(25, up)).toBe(31)
		const down = await maxHpShift(tough(fighter(3)), fighter(3))
		expect(currentHpFollowingMaxHp(31, down)).toBe(25)
	})

	it('a +6 custom item attuned and unattuned moves current +6 then -6', async () => {
		const item = { requiresAttunement: true, bonuses: [{ target: 'maxHitPoints', amount: 6 }] }
		const on = await maxHpShift(fighter(3, item), fighter(3, item, true))
		expect(currentHpFollowingMaxHp(19, on)).toBe(25)
		const off = await maxHpShift(fighter(3, item, true), fighter(3, item))
		expect(currentHpFollowingMaxHp(25, off)).toBe(19)
	})

	it('Constitution raised in Edit moves current by the modifier change times the level', async () => {
		const raised = { ...fighter(3), abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 15, intelligence: 8, wisdom: 12, charisma: 10 } } } as Character
		expect(currentHpFollowingMaxHp(10, await maxHpShift(fighter(3), raised))).toBe(13)
	})

	it('a hand-set override is not followed', async () => {
		expect(await maxHpShift(fighter(3), { ...fighter(3), maxHpOverride: 40 })).toBeUndefined()
	})

	it('keeps 0 at 0, clamps at 0, leaves undefined and unresolved alone', () => {
		expect(currentHpFollowingMaxHp(0, 6)).toBe(0)
		expect(currentHpFollowingMaxHp(4, -6)).toBe(0)
		expect(currentHpFollowingMaxHp(undefined, 6)).toBeUndefined()
		expect(currentHpFollowingMaxHp(10, undefined)).toBeUndefined()
	})
})
