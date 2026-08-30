import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractBackgrounds } from './backgroundData'
import { buildItemIndex, type ItemIndex } from '../inventory/startingEquipmentData'

function loadRealBackgrounds(): unknown {
	const raw = readFileSync(join(__dirname, '..', '..', 'data', 'backgrounds.json'), 'utf8')
	return JSON.parse(raw)
}

function loadRealItemIndex(): ItemIndex {
	const raw = readFileSync(join(__dirname, '..', '..', 'data', 'items.json'), 'utf8')
	return buildItemIndex(JSON.parse(raw))
}

describe('extractBackgrounds — real data/backgrounds.json', () => {
	const backgrounds = extractBackgrounds(loadRealBackgrounds(), loadRealItemIndex())

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
			expect(bg.startingEquipment.options).toHaveLength(2)
			for (const option of bg.startingEquipment.options) expect(option.elements.length).toBeGreaterThan(0)
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
		expect(efaEntry?.startingEquipment.options.map((o) => o.key)).toEqual(['a', 'b'])
		expect(xphbEntry?.startingEquipment.options.map((o) => o.key)).toEqual(['A', 'B'])
	})

	/*
	 * The background step's preview and the equipment step read one parser, so
	 * these labels are the same strings the equipment step offers.
	 */
	it('labels item codes from items.json, coin amounts as coins, and item groups as a category', () => {
		const optionA = backgrounds.find((b) => b.name === 'Acolyte')?.startingEquipment.options[0]
		expect(optionA?.label).toBe('Option A')
		const labels = optionA?.elements.map((element) => element.label) ?? []
		expect(labels).toContain('Robe')
		expect(labels).toContain('8 gp')
		expect(labels).toContain('a holy symbol (your choice)')
	})

	it('resolves equipmentType category placeholders to a readable label', () => {
		const artisan = backgrounds.find((b) => b.name === 'Artisan')
		const category = artisan?.startingEquipment.options[0].elements.find((element) => element.kind === 'category')
		expect(category).toEqual({ kind: 'category', categories: ['toolArtisan'], label: "artisan's tools (your choice)" })
	})
})

describe('extractBackgrounds — synthetic shapes', () => {
	const emptyIndex = buildItemIndex([])
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
		expect(() => extractBackgrounds([{ ...rawItem, ability: [{ notChoose: true }, {}] }], emptyIndex)).toThrow()
	})

	it('throws if skillProficiencies does not have exactly 2 keys', () => {
		expect(() => extractBackgrounds([{ ...rawItem, skillProficiencies: [{ insight: true }] }], emptyIndex)).toThrow()
	})

	it('throws if an option key does not hold an array of elements', () => {
		expect(() => extractBackgrounds([{ ...rawItem, startingEquipment: [{ A: 'robe|xphb' }] }], emptyIndex)).toThrow()
	})

	it('reads lowercase a/b keys the same as uppercase A/B', () => {
		const lowercase = extractBackgrounds(
			[{ ...rawItem, startingEquipment: [{ a: ['robe|xphb'], b: [{ value: 100 }] }] }],
			emptyIndex,
		)
		expect(lowercase[0].startingEquipment.options.map((o) => o.key)).toEqual(['a', 'b'])
		expect(lowercase[0].startingEquipment.options[1].elements).toEqual([{ kind: 'coins', copper: 100, label: '1 gp' }])
	})
})
