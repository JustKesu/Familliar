import { describe, expect, it } from 'vitest'
import { itemWeaponGrants } from '../calculation/itemProficiencies'
import { computeProficiencies } from '../calculation/proficiencies'
import { computeSavingThrow, type ClassSavingThrowProficiencies } from '../calculation/savingThrows'
import { computeSkill } from '../calculation/skills'
import { buildInventoryResolver } from '../inventory/inventoryData'
import { isProficientWithWeapon } from '../weapons/weaponProficiency'
import { CUSTOM_ITEM_SOURCE, type Character, type CharacterInventoryItem, type CustomItemDefinition } from '../storage/character'
import { buildItemGrants } from './damageResponseData'
import { buildItemConditionGrants, buildItemProficiencyGrants, conditionAdvantageLines, conditionsGranted } from './itemProficiencyData'

const fighter5: Character = {
	id: '1',
	name: 'Fighter5',
	classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 5 }],
	abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 } },
	abilityBonus: { strength: 2, constitution: 1 },
}
const classData: ClassSavingThrowProficiencies[] = [{ className: 'Fighter', classSource: 'XPHB', abilities: ['str', 'con'] }]

function row(custom: CustomItemDefinition, extra: Partial<CharacterInventoryItem> = {}): CharacterInventoryItem {
	return { name: custom.name, source: CUSTOM_ITEM_SOURCE, quantity: 1, custom, ...extra }
}

const ring: CustomItemDefinition = {
	name: 'Ring of Shadows',
	kind: 'worn',
	proficiencies: [
		{ kind: 'savingThrow', ability: 'strength' },
		{ kind: 'savingThrow', ability: 'intelligence' },
		{ kind: 'skill', skill: 'stealth', expertise: true },
		{ kind: 'tool', tool: "Thieves' Tools" },
		{ kind: 'language', language: 'Elvish' },
		{ kind: 'weaponCategory', category: 'martial' },
		{ kind: 'weapon', name: 'Rapier', source: 'XPHB' },
		{ kind: 'armor', armor: 'heavy' },
	],
	conditionImmune: ['Frightened', 'Exhaustion'],
	conditionAdvantage: ['Charmed', 'Frightened'],
	vulnerable: ['fire'],
}

describe('item proficiencies in the numbers', () => {
	const grants = buildItemProficiencyGrants([row(ring)], [])

	it('a save the class already grants counts once and names both sources; a new one names the item', () => {
		expect(computeSavingThrow('strength', fighter5, classData, [], [], grants)).toMatchObject({
			value: { status: 'proficient', modifier: 6 },
			breakdown: [
				{ source: 'strength modifier', amount: 3 },
				{ source: 'proficiency (Fighter, Ring of Shadows)', amount: 3 },
			],
		})
		expect(computeSavingThrow('intelligence', fighter5, classData, [], [], grants)).toMatchObject({
			value: { status: 'proficient', modifier: 4 },
			breakdown: [
				{ source: 'intelligence modifier', amount: 1 },
				{ source: 'proficiency (Ring of Shadows)', amount: 3 },
			],
		})
	})

	it('item expertise over a class proficiency wins: expertise, twice the bonus, item named', () => {
		const rogueish = { ...fighter5, classSkills: ['stealth'] }
		expect(computeSkill('stealth', rogueish, [], [], grants)).toMatchObject({
			value: { status: 'expertise', modifier: 2 + 6 },
			breakdown: [
				{ source: 'dexterity modifier', amount: 2 },
				{ source: 'expertise (class, Ring of Shadows)', amount: 6 },
			],
		})
		expect(computeSkill('stealth', fighter5, [], [], grants)).toMatchObject({ value: { status: 'expertise', modifier: 8 } })
	})

	it('an item proficient (not expertise) skill leaves a class expertise alone', () => {
		const proficient = buildItemProficiencyGrants([row({ name: 'Cap', kind: 'worn', proficiencies: [{ kind: 'skill', skill: 'stealth' }] })], [])
		expect(computeSkill('stealth', { ...fighter5, classSkills: ['stealth'], expertiseSkills: [{ name: 'stealth' }] }, [], [], proficient)).toMatchObject({ value: { status: 'expertise' } })
		expect(computeSkill('stealth', fighter5, [], [], proficient)).toMatchObject({ value: { status: 'proficient', modifier: 5 } })
	})

	it('an unattuned item that requires attunement gets the D76 line and no number', () => {
		const gated = buildItemProficiencyGrants([row({ ...ring, requiresAttunement: true })], [])
		const save = computeSavingThrow('intelligence', fighter5, classData, [], [], gated)
		expect(save).toMatchObject({ value: { status: 'none', modifier: 1 } })
		expect(save.status === 'known' && save.breakdown[1]).toEqual({
			source: 'Ring of Shadows',
			amount: 0,
			note: 'considered (saving throw proficiency) — not applied: requires attunement and you are not attuned to it',
		})
		const skill = computeSkill('stealth', fighter5, [], [], gated)
		expect(skill).toMatchObject({ value: { status: 'none', modifier: 2 } })
		expect(skill.status === 'known' && skill.breakdown[1].note).toContain('considered (expertise)')

		const attuned = buildItemProficiencyGrants([row({ ...ring, requiresAttunement: true }, { attuned: true })], [])
		expect(computeSavingThrow('intelligence', fighter5, classData, [], [], attuned)).toMatchObject({ value: { status: 'proficient' } })
	})
})

describe('item proficiencies on the Proficiencies card and in attacks', () => {
	const grants = buildItemProficiencyGrants([row(ring)], [])
	const withBackgroundTool: Character = { ...fighter5, background: { name: 'Criminal', source: 'XPHB', skillProficiencies: ['stealth', 'deception'], toolProficiency: "Thieves' Tools" } }

	it('lists each entry with the item as a source; an entry another source grants counts once with both', () => {
		const result = computeProficiencies(withBackgroundTool, [], [], [], grants)
		expect(result.tools).toEqual([{ key: "thieves' tools", label: "Thieves' Tools", sources: [{ kind: 'background', name: 'Criminal (background)' }, { kind: 'item', name: 'Ring of Shadows' }] }])
		expect(result.languages.find((item) => item.label === 'Elvish')?.sources).toEqual([{ kind: 'item', name: 'Ring of Shadows' }])
		expect(result.armor.map((item) => item.label)).toEqual(['Heavy armor'])
		expect(result.weapons.map((item) => item.label)).toEqual(['Martial weapons', 'Rapier'])
	})

	it('skips an unattuned item entirely', () => {
		const gated = buildItemProficiencyGrants([row({ ...ring, requiresAttunement: true })], [])
		const result = computeProficiencies(fighter5, [], [], [], gated)
		expect(result.tools).toEqual([])
		expect(result.weapons).toEqual([])
	})

	it('a martial item category makes a martial weapon proficient, and only while applied', () => {
		const longsword = { name: 'Longsword', weaponCategory: 'martial', propertyFull: ['Versatile'], typeCode: 'M' }
		expect(isProficientWithWeapon(longsword, [])).toBe(false)
		expect(isProficientWithWeapon(longsword, itemWeaponGrants(grants))).toBe(true)
		expect(isProficientWithWeapon({ name: 'Rapier', weaponCategory: 'martial' }, itemWeaponGrants(buildItemProficiencyGrants([row({ name: 'Pin', kind: 'worn', proficiencies: [{ kind: 'weapon', name: 'Rapier', source: 'XPHB' }] })], [])))).toBe(true)
		expect(itemWeaponGrants(buildItemProficiencyGrants([row({ ...ring, requiresAttunement: true })], []))).toEqual([])
	})
})

describe('vulnerability and condition defences', () => {
	it('a custom vulnerability becomes a vulnerability grant, withheld while unattuned', () => {
		expect(buildItemGrants([row(ring)], [])).toEqual([{ kind: 'vulnerability', sourceName: 'Ring of Shadows', damageTypes: ['fire'] }])
		expect(buildItemGrants([row({ ...ring, requiresAttunement: true })], [])).toEqual([
			{ kind: 'resistance', sourceName: 'Ring of Shadows', damageTypes: [], withheldReason: 'requires attunement and you are not attuned to it' },
		])
	})

	it('collects immunities and advantages by condition, alphabetical, naming every item', () => {
		const second = row({ name: 'Charm Band', kind: 'worn', conditionImmune: ['Frightened'], conditionAdvantage: ['Charmed'] })
		const grants = buildItemConditionGrants([row(ring), second], [])
		expect(conditionsGranted(grants, 'immune')).toEqual([
			{ condition: 'Exhaustion', sources: ['Ring of Shadows'] },
			{ condition: 'Frightened', sources: ['Ring of Shadows', 'Charm Band'] },
		])
		expect(conditionAdvantageLines(grants)).toEqual([
			'Advantage on saving throws against Charmed, Frightened (Ring of Shadows)',
			'Advantage on saving throws against Charmed (Charm Band)',
		])
	})

	it('an unattuned item that requires attunement contributes to neither list; attuned it does', () => {
		const gated = { ...ring, requiresAttunement: true as const }
		const off = buildItemConditionGrants([row(gated)], [])
		expect(conditionsGranted(off, 'immune')).toEqual([])
		expect(conditionAdvantageLines(off)).toEqual([])
		const on = buildItemConditionGrants([row(gated, { attuned: true })], [])
		expect(conditionsGranted(on, 'immune').map((entry) => entry.condition)).toEqual(['Exhaustion', 'Frightened'])
		expect(conditionAdvantageLines(on)).toHaveLength(1)
	})

	it('skips a definition that cannot be read', () => {
		const broken = row({ ...ring, conditionImmune: ['Sleepy'] })
		expect(buildInventoryResolver([])(broken).ref).toBeNull()
		expect(buildItemConditionGrants([broken], [])).toEqual([])
		expect(buildItemProficiencyGrants([broken], [])).toEqual([])
	})
})
