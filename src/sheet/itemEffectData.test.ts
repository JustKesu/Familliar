import { describe, expect, it } from 'vitest'
import { computeDarkvision, computeSpeed, type SpeciesTraitsData } from '../calculation/speciesTraits'
import type { ItemRef } from '../inventory/inventoryData'
import { CUSTOM_ITEM_SOURCE, type Character, type CharacterInventoryItem, type CustomItemDefinition } from '../storage/character'
import { buildItemDarkvisionGrants, buildItemSpeedAdjustments } from './itemEffectData'

/** Elf: 30 ft. walk, 60 ft. darkvision — the same fixture speciesTraits' own tests use. */
const SPECIES: SpeciesTraitsData[] = [{ name: 'Elf', source: 'XPHB', speed: 30, size: ['M'], darkvision: 60 }]
const HUMAN: SpeciesTraitsData[] = [{ name: 'Human', source: 'XPHB', speed: 30, size: ['M'] }]

function character(species: string): Character {
	return { id: '1', name: 'Test', classes: [], species: { name: species, source: 'XPHB' } }
}

function row(custom: CustomItemDefinition, extra: Partial<CharacterInventoryItem> = {}): CharacterInventoryItem {
	return { name: custom.name, source: CUSTOM_ITEM_SOURCE, quantity: 1, custom, ...extra }
}

const boots: CustomItemDefinition = { name: 'Bounding Boots', kind: 'worn', speedBonus: 10 }
const goggles: CustomItemDefinition = { name: 'Night Goggles', kind: 'worn', darkvision: 120 }

/* No item in items.json is read into either field (extractItemRefs sets neither), so a real item is here only to prove it contributes nothing. */
const ITEMS: ItemRef[] = [{ name: 'Torch', source: 'XPHB', typeCode: 'G' }]

describe('buildItemSpeedAdjustments', () => {
	it('reaches the walking speed through the parameter computeSpeed already takes', () => {
		const adjustments = buildItemSpeedAdjustments([row(boots)], ITEMS)
		expect(adjustments).toEqual([{ source: 'Bounding Boots', amount: 10 }])

		const speed = computeSpeed(character('Elf'), SPECIES, adjustments)
		expect(speed).toMatchObject({ status: 'known', value: { walk: 40 } })
		expect(speed.status === 'known' && speed.breakdown).toEqual([
			{ source: 'Elf', amount: 30 },
			{ source: 'Bounding Boots', amount: 10 },
		])
	})

	it('withholds it while an item that requires attunement is not attuned (D76)', () => {
		const gated = { ...boots, requiresAttunement: true as const }
		const withheld = buildItemSpeedAdjustments([row(gated)], ITEMS)
		expect(withheld).toEqual([{ source: 'Bounding Boots', amount: 0, note: 'considered (+10 ft.) — not applied: requires attunement and you are not attuned to it' }])
		expect(computeSpeed(character('Elf'), SPECIES, withheld)).toMatchObject({ value: { walk: 30 } })

		expect(buildItemSpeedAdjustments([row(gated, { attuned: true })], ITEMS)).toEqual([{ source: 'Bounding Boots', amount: 10 }])
	})

	it('carries a negative adjustment as written, and ignores quantity', () => {
		expect(buildItemSpeedAdjustments([row({ name: 'Leaden Boots', kind: 'worn', speedBonus: -10 }, { quantity: 3 })], ITEMS)).toEqual([{ source: 'Leaden Boots', amount: -10 }])
	})

	it('finds nothing on an ordinary item', () => {
		expect(buildItemSpeedAdjustments([{ name: 'Torch', source: 'XPHB', quantity: 1 }], ITEMS)).toEqual([])
	})
})

describe('buildItemDarkvisionGrants', () => {
	it('reaches darkvision as another candidate, never as an addition', () => {
		const grants = buildItemDarkvisionGrants([row(goggles)], ITEMS)
		expect(grants).toEqual([{ range: 120, origin: 'item', name: 'Night Goggles' }])

		// 120 beats the Elf's 60, and the species figure is still listed with the reason it lost.
		const darkvision = computeDarkvision(character('Elf'), SPECIES, grants)
		expect(darkvision).toMatchObject({ status: 'known', value: 120 })
		expect(darkvision.status === 'known' && darkvision.breakdown).toEqual([
			{ source: 'Elf', amount: 0, note: 'does not exceed from item (Night Goggles) (120 ft.)' },
			{ source: 'from item (Night Goggles)', amount: 120 },
		])
	})

	it('gives a character with no darkvision of their own the item’s range', () => {
		expect(computeDarkvision(character('Human'), HUMAN, buildItemDarkvisionGrants([row(goggles)], ITEMS))).toMatchObject({ status: 'known', value: 120 })
	})

	it('withholds it while unattuned, listing what it would have given (D76)', () => {
		const gated = { ...goggles, requiresAttunement: true as const }
		const grants = buildItemDarkvisionGrants([row(gated)], ITEMS)
		expect(grants[0].withheldReason).toBe('requires attunement and you are not attuned to it')

		const darkvision = computeDarkvision(character('Elf'), SPECIES, grants)
		expect(darkvision).toMatchObject({ status: 'known', value: 60 })
		expect(darkvision.status === 'known' && darkvision.breakdown).toContainEqual({
			source: 'from item (Night Goggles)',
			amount: 0,
			note: 'considered (120 ft.) — not applied: requires attunement and you are not attuned to it',
		})
	})

	it('leaves the value at zero when every candidate is withheld, rather than picking one anyway', () => {
		const grants = buildItemDarkvisionGrants([row({ ...goggles, requiresAttunement: true as const })], ITEMS)
		expect(computeDarkvision(character('Human'), HUMAN, grants)).toMatchObject({ status: 'known', value: 0 })
	})
})
