import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildItemNameLookup, extractBackgrounds } from './backgroundData'

function loadRealBackgrounds(): unknown {
	const raw = readFileSync(join(__dirname, '..', '..', 'data', 'backgrounds.json'), 'utf8')
	return JSON.parse(raw)
}

function loadRealItemLookup(): ReadonlyMap<string, string> {
	const raw = readFileSync(join(__dirname, '..', '..', 'data', 'items.json'), 'utf8')
	return buildItemNameLookup(JSON.parse(raw))
}

describe('extractBackgrounds — real data/backgrounds.json', () => {
	const itemNames = loadRealItemLookup()
	const backgrounds = extractBackgrounds(loadRealBackgrounds(), itemNames)

	it('reads all 33 backgrounds (17 EFA + 16 XPHB, per NOTES.md)', () => {
		expect(backgrounds).toHaveLength(33)
		expect(backgrounds.filter((b) => b.source === 'EFA')).toHaveLength(17)
		expect(backgrounds.filter((b) => b.source === 'XPHB')).toHaveLength(16)
	})

	it('gives every background exactly 3 distinct ability choices, 2 skills, a tool proficiency, an origin feat and two equipment options', () => {
		for (const bg of backgrounds) {
			expect(new Set(bg.abilityChoices).size).toBe(3)
			expect(bg.skillProficiencies).toHaveLength(2)
			expect(bg.toolProficiency).toBeDefined()
			expect(bg.originFeat.name.length).toBeGreaterThan(0)
			expect(bg.originFeat.source.length).toBeGreaterThan(0)
			expect(bg.equipmentOptionA.length).toBeGreaterThan(0)
			expect(bg.equipmentOptionB.length).toBeGreaterThan(0)
		}
	})

	it("extracts the origin feat name from the key-shaped feats field, including Noble's capitalized key", () => {
		const acolyte = backgrounds.find((b) => b.name === 'Acolyte')
		expect(acolyte?.originFeat).toEqual({ name: 'Magic Initiate; Cleric', source: 'XPHB' })

		const noble = backgrounds.find((b) => b.name === 'Noble')
		expect(noble?.originFeat).toEqual({ name: 'Skilled', source: 'XPHB' })
	})

	it('handles both tool proficiency shapes: a named tool and a category choice', () => {
		const acolyte = backgrounds.find((b) => b.name === 'Acolyte')
		expect(acolyte?.toolProficiency).toEqual({ kind: 'named', name: "Calligrapher's Supplies" })

		const artisan = backgrounds.find((b) => b.name === 'Artisan')
		expect(artisan?.toolProficiency).toEqual({
			kind: 'category',
			category: 'anyArtisansTool',
			label: "Artisan's tools (your choice)",
		})
	})

	it('reads startingEquipment case-insensitively for both EFA (a/b) and XPHB (A/B) sources', () => {
		const efaEntry = backgrounds.find((b) => b.source === 'EFA')
		const xphbEntry = backgrounds.find((b) => b.source === 'XPHB')
		expect(efaEntry?.equipmentOptionA.length).toBeGreaterThan(0)
		expect(efaEntry?.equipmentOptionB.length).toBeGreaterThan(0)
		expect(xphbEntry?.equipmentOptionA.length).toBeGreaterThan(0)
		expect(xphbEntry?.equipmentOptionB.length).toBeGreaterThan(0)
	})

	it('resolves item codes to display names via items.json, and coin amounts to copper', () => {
		const acolyte = backgrounds.find((b) => b.name === 'Acolyte')
		const optionA = acolyte?.equipmentOptionA ?? []
		expect(optionA.some((e) => e.kind === 'item' && e.label === 'Robe')).toBe(true)
		expect(optionA.some((e) => e.kind === 'coins' && e.copper === 800)).toBe(true)
	})

	it('falls back to a humanized label for equipment codes absent from items.json (item-group references)', () => {
		const acolyte = backgrounds.find((b) => b.name === 'Acolyte')
		const holySymbol = acolyte?.equipmentOptionA.find((e) => e.kind === 'item' && e.label === 'Holy Symbol')
		expect(holySymbol).toBeDefined()
	})

	it('resolves equipmentType category placeholders to a readable label', () => {
		const artisan = backgrounds.find((b) => b.name === 'Artisan')
		const category = artisan?.equipmentOptionA.find((e) => e.kind === 'category')
		expect(category).toEqual({ kind: 'category', label: "an artisan's tool of your choice" })
	})
})

describe('extractBackgrounds — synthetic shapes', () => {
	const rawItem = {
		name: 'Acolyte',
		source: 'XPHB',
		ability: [
			{ choose: { weighted: { from: ['int', 'wis', 'cha'], weights: [2, 1] } } },
			{ choose: { weighted: { from: ['int', 'wis', 'cha'], weights: [1, 1, 1] } } },
		],
		feats: [{ 'skilled|xphb': true }],
		skillProficiencies: [{ insight: true, religion: true }],
		toolProficiencies: [{ "calligrapher's supplies": true }],
		startingEquipment: [{ A: ['robe|xphb', { value: 800 }], B: [{ value: 5000 }] }],
	}

	it('throws if ability is not the expected 2-element choose/weighted shape', () => {
		expect(() => extractBackgrounds([{ ...rawItem, ability: [{ notChoose: true }, {}] }], new Map())).toThrow()
	})

	it('throws if skillProficiencies does not have exactly 2 keys', () => {
		expect(() =>
			extractBackgrounds([{ ...rawItem, skillProficiencies: [{ insight: true }] }], new Map()),
		).toThrow()
	})

	it('throws if startingEquipment is missing an A/B key', () => {
		expect(() =>
			extractBackgrounds([{ ...rawItem, startingEquipment: [{ A: ['robe|xphb'] }] }], new Map()),
		).toThrow()
	})

	it('reads lowercase a/b keys the same as uppercase A/B', () => {
		const lowercase = extractBackgrounds(
			[{ ...rawItem, startingEquipment: [{ a: ['robe|xphb'], b: [{ value: 100 }] }] }],
			new Map(),
		)
		expect(lowercase[0].equipmentOptionA).toHaveLength(1)
		expect(lowercase[0].equipmentOptionB).toEqual([{ kind: 'coins', copper: 100 }])
	})
})
