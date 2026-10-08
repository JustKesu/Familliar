import { describe, expect, it } from 'vitest'
import { afterShortRest } from '../rest/rest'
import type { Character, CharacterClass } from '../storage/character'
import { classPoolKey, poolUsesAfterLevelChange, poolUsesAfterSplit, resourceKeyFor, withLegacyPoolUses } from './classPools'
import { resourceUsesAfterLevelUp } from '../levelUp/multiclassLevelUp'
import { computeCharacterResources, poolGrantingClassNames, type ResourceFeature } from './resources'
import { levelFeatChip } from '../sheet/ManageFeatsPanel'

const CLASSES = [
	{ entryType: 'class', name: 'Cleric', source: 'XPHB', classTableGroups: [{ colLabels: ['Channel Divinity'], rows: [[0], [2], [2], [2], [2], [3]] }] },
	{ entryType: 'class', name: 'Paladin', source: 'XPHB', classTableGroups: [{ colLabels: ['Channel Divinity'], rows: [[0], [0], [2], [2], [2]] }] },
]

const cls = (className: string, level: number): CharacterClass => ({ className, classSource: 'XPHB', subclass: null, level })
const character = (...classes: CharacterClass[]): Character => ({ id: 'c1', name: 'Test', classes })

const REST_TEXT = ['You regain one expended use when you finish a {@variantrule Short Rest|XPHB}, and you regain all expended uses when you finish a {@variantrule Long Rest|XPHB}.']
const CLERIC_CD: ResourceFeature = { name: 'Channel Divinity', className: 'Cleric', entries: REST_TEXT }
const TURN_UNDEAD: ResourceFeature = { name: 'Turn Undead', className: 'Cleric', consumes: { name: 'Channel Divinity' }, entries: [] }
const PALADIN_CD: ResourceFeature = { name: 'Channel Divinity', className: 'Paladin', entries: ['You can use this feature twice. You regain all expended uses when you finish a {@variantrule Long Rest|XPHB}.'] }
const FEATURES = [CLERIC_CD, TURN_UNDEAD, PALADIN_CD]

describe('D336 per-class pools', () => {
	it('splits a pool two held classes grant, each with its own maximum and recovery', () => {
		const resources = computeCharacterResources(character(cls('Cleric', 6), cls('Paladin', 3)), CLASSES, FEATURES)
		expect(resources.map((r) => [r.name, r.pool, r.className, r.max.status === 'known' ? r.max.value : null, r.shortRest])).toEqual([
			['Channel Divinity (Cleric)', 'Channel Divinity', 'Cleric', 3, 'one'],
			['Channel Divinity (Paladin)', 'Channel Divinity', 'Paladin', 2, null],
		])
	})

	it('keeps the plain name when only one held class grants it', () => {
		for (const held of [character(cls('Cleric', 3)), character(cls('Cleric', 3), cls('Paladin', 2))]) {
			const resources = computeCharacterResources(held, CLASSES, FEATURES)
			expect(resources.map((r) => r.name)).toEqual(['Channel Divinity'])
			expect(resources[0]).not.toHaveProperty('pool')
		}
		expect(poolGrantingClassNames('Channel Divinity', character(cls('Cleric', 3), cls('Paladin', 2)), CLASSES)).toEqual(['Cleric'])
	})

	it('files a spender under its own class pool only while the pool is split', () => {
		const split = computeCharacterResources(character(cls('Cleric', 3), cls('Paladin', 3)), CLASSES, FEATURES)
		expect(resourceKeyFor('Channel Divinity', 'Paladin', split)).toBe('Channel Divinity (Paladin)')
		expect(resourceKeyFor('Channel Divinity', 'Cleric', split)).toBe(classPoolKey('Channel Divinity', 'Cleric'))
		expect(resourceKeyFor('Channel Divinity', null, split)).toBe('Channel Divinity')
		const single = computeCharacterResources(character(cls('Cleric', 3)), CLASSES, FEATURES)
		expect(resourceKeyFor('Channel Divinity', 'Cleric', single)).toBe('Channel Divinity')
	})

	it('hands a legacy plain count to the first class pool, capped at its maximum', () => {
		const split = computeCharacterResources(character(cls('Cleric', 3), cls('Paladin', 3)), CLASSES, FEATURES)
		expect(withLegacyPoolUses({ 'Channel Divinity': 1, Rage: 2 }, split, ['Cleric', 'Cleric', 'Paladin'])).toEqual({ 'Channel Divinity (Cleric)': 1, Rage: 2 })
		expect(withLegacyPoolUses({ 'Channel Divinity': 5 }, split, ['Paladin', 'Cleric', 'Paladin'])).toEqual({ 'Channel Divinity (Paladin)': 2 })
		const single = computeCharacterResources(character(cls('Cleric', 3)), CLASSES, FEATURES)
		expect(withLegacyPoolUses({ 'Channel Divinity': 1 }, single, ['Cleric'])).toEqual({ 'Channel Divinity': 1 })
	})

	it('a Short Rest recovers each pool by its own rule', () => {
		const split = computeCharacterResources(character(cls('Cleric', 3), cls('Paladin', 3)), CLASSES, FEATURES)
		const rest = afterShortRest(10, { resourceUses: { 'Channel Divinity (Cleric)': 2, 'Channel Divinity (Paladin)': 2 } }, split, null)
		expect(rest.resourceUses).toEqual({ 'Channel Divinity (Cleric)': 1, 'Channel Divinity (Paladin)': 2 })
	})

	it('a pool only one class still grants goes back to the plain key with that class count', () => {
		const before = computeCharacterResources(character(cls('Cleric', 3), cls('Paladin', 3)), CLASSES, FEATURES)
		const reduced = character(cls('Cleric', 3), cls('Paladin', 2))
		const after = computeCharacterResources(reduced, CLASSES, FEATURES)
		const uses = { 'Channel Divinity (Cleric)': 1, 'Channel Divinity (Paladin)': 2 }
		expect(poolUsesAfterLevelChange(uses, before, after, (pool) => poolGrantingClassNames(pool, reduced, CLASSES))).toEqual({
			'Channel Divinity': 1,
			'Channel Divinity (Paladin)': 2,
		})
		expect(poolUsesAfterLevelChange(uses, before, before, () => ['Cleric', 'Paladin'])).toEqual(uses)
	})

	it('a level up that splits a pool gives the plain count to the class that held it, capped; the new class starts full', () => {
		for (const order of [[cls('Cleric', 3), cls('Paladin', 2)], [cls('Paladin', 2), cls('Cleric', 3)]]) {
			const before = character(...order)
			const after = computeCharacterResources(character(...order.map((entry) => (entry.className === 'Paladin' ? { ...entry, level: 3 } : entry))), CLASSES, FEATURES)
			const grantersBefore = (pool: string) => poolGrantingClassNames(pool, before, CLASSES)
			expect(poolUsesAfterSplit({ 'Channel Divinity': 1, Rage: 2 }, after, grantersBefore)).toEqual({ 'Channel Divinity (Cleric)': 1, Rage: 2 })
			expect(poolUsesAfterSplit({ 'Channel Divinity': 5 }, after, grantersBefore)).toEqual({ 'Channel Divinity (Cleric)': 2 })
		}
		// No split, or no single holder before: nothing moves.
		const single = computeCharacterResources(character(cls('Cleric', 4)), CLASSES, FEATURES)
		expect(poolUsesAfterSplit({ 'Channel Divinity': 1 }, single, () => ['Cleric'])).toEqual({ 'Channel Divinity': 1 })
		const split = computeCharacterResources(character(cls('Cleric', 3), cls('Paladin', 3)), CLASSES, FEATURES)
		expect(poolUsesAfterSplit({ 'Channel Divinity': 1 }, split, () => [])).toEqual({ 'Channel Divinity': 1 })
	})

	it('resourceUsesAfterLevelUp splits at the level-up save', () => {
		const before: Character = { ...character(cls('Paladin', 2), cls('Cleric', 3)), play: { resourceUses: { 'Channel Divinity': 1 } } }
		expect(resourceUsesAfterLevelUp(before, [cls('Paladin', 3), cls('Cleric', 3)], CLASSES)).toEqual({ 'Channel Divinity (Cleric)': 1 })
		expect(resourceUsesAfterLevelUp(before, [cls('Paladin', 2), cls('Cleric', 4)], CLASSES)).toEqual({ 'Channel Divinity': 1 })
		expect(resourceUsesAfterLevelUp(character(cls('Cleric', 3)), [cls('Cleric', 4)], CLASSES)).toBeUndefined()
	})
})

describe('D336 Manage Feats level chip', () => {
	const order = (entries: [string, number][]) => entries.flatMap(([className, level]) => Array.from({ length: level }, () => ({ className, classSource: 'XPHB' })))

	it('names the class that took the level on a multiclass character', () => {
		expect(levelFeatChip(4, { classes: [cls('Wizard', 4), cls('Cleric', 1)], levelOrder: order([['Cleric', 1], ['Wizard', 4]]) })).toBe('From Wizard 3')
		expect(levelFeatChip(4, { classes: [cls('Wizard', 4), cls('Cleric', 1)], levelOrder: order([['Wizard', 4], ['Cleric', 1]]) })).toBe('From Wizard 4')
	})

	it('keeps "From level N" for one class or without a level history', () => {
		expect(levelFeatChip(4, { classes: [cls('Fighter', 4)] })).toBe('From level 4')
		expect(levelFeatChip(4, { classes: [cls('Wizard', 4), cls('Cleric', 1)] })).toBe('From level 4')
	})
})
