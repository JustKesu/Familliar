import { describe, expect, it, vi } from 'vitest'
import { currentHpAfterMaxHpChange } from '../calculation/maxHitPoints'
import { CUSTOM_ITEM_SOURCE, type Character } from '../storage/character'
import { loadCharacterMaxHp } from './hpDefault'

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

	it('leaves an unattuned attunement item out of the shift (D76)', async () => {
		const gated = { ...perLevel, requiresAttunement: true }
		const [before, after] = await Promise.all([loadCharacterMaxHp(fighter(3, gated)), loadCharacterMaxHp(fighter(4, gated))])
		expect(currentHpAfterMaxHpChange(25, before, after)).toBe(32)
		expect(await loadCharacterMaxHp(fighter(4, gated, true))).toMatchObject({ value: 36 })
	})
})
