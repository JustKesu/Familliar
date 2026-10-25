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

const PSI_TABLE = (label: string) => [{ colLabels: [`{@tip Die Size|${label} Die Size}`, `{@tip Number|${label} Die Number}`], rows: [[6, 4], [6, 4], [6, 4]] }]
const PSI_CLASSES = [
	{ entryType: 'subclass', name: 'Psi Warrior', shortName: 'Psi Warrior', className: 'Fighter', classSource: 'XPHB', subclassTableGroups: PSI_TABLE('Psionic Energy') },
	{ entryType: 'subclass', name: 'Soulknife', shortName: 'Soulknife', className: 'Rogue', classSource: 'XPHB', subclassTableGroups: PSI_TABLE('Soulknife Energy') },
]
const sub = (className: string, subclass: string, level: number): CharacterClass => ({ className, classSource: 'XPHB', subclass, level })
const PSIONIC_POWER_TEXT = ['You regain one of your expended Psionic Energy Dice when you finish a {@variantrule Short Rest|XPHB}, and you regain all of them when you finish a {@variantrule Long Rest|XPHB}.']
const PSI_FEATURES: ResourceFeature[] = [
	{ name: 'Psionic Power', className: 'Fighter', entries: PSIONIC_POWER_TEXT },
	{ name: 'Protective Field', className: 'Fighter', consumes: { name: 'Psionic Energy Die' }, entries: [] },
	{ name: 'Psionic Power', className: 'Rogue', entries: PSIONIC_POWER_TEXT },
	{ name: 'Psi-Bolstered Knack', className: 'Rogue', consumes: { name: 'Psionic Energy Die' }, entries: [] },
]

describe('D398 Psionic Energy Die pools per subclass', () => {
	it('gives Psi Warrior 3 / Soulknife 3 two pools of 4, each recovering one die on a Short Rest', () => {
		const resources = computeCharacterResources(character(sub('Fighter', 'Psi Warrior', 3), sub('Rogue', 'Soulknife', 3)), PSI_CLASSES, PSI_FEATURES)
		expect(resources.map((r) => [r.name, r.pool, r.className, r.max.status === 'known' ? r.max.value : null, r.shortRest])).toEqual([
			['Psionic Energy Die (Fighter)', 'Psionic Energy Die', 'Fighter', 4, 'one'],
			['Psionic Energy Die (Rogue)', 'Psionic Energy Die', 'Rogue', 4, 'one'],
		])
	})

	it('files Protective Field under the Fighter pool and Psi-Bolstered Knack under the Rogue pool', () => {
		const split = computeCharacterResources(character(sub('Fighter', 'Psi Warrior', 3), sub('Rogue', 'Soulknife', 3)), PSI_CLASSES, PSI_FEATURES)
		expect(resourceKeyFor('Psionic Energy Die', 'Fighter', split)).toBe('Psionic Energy Die (Fighter)')
		expect(resourceKeyFor('Psionic Energy Die', 'Rogue', split)).toBe('Psionic Energy Die (Rogue)')
	})

	it('keeps one plain pool for a lone Soulknife (4 dice) and a lone Psi Warrior', () => {
		for (const [held, features] of [
			[sub('Rogue', 'Soulknife', 3), PSI_FEATURES.slice(2)],
			[sub('Fighter', 'Psi Warrior', 3), PSI_FEATURES.slice(0, 2)],
		] as const) {
			const resources = computeCharacterResources(character(held), PSI_CLASSES, features)
			expect(resources.map((r) => [r.name, r.max.status === 'known' ? r.max.value : null, r.shortRest])).toEqual([['Psionic Energy Die', 4, 'one']])
			expect(resources[0]).not.toHaveProperty('pool')
		}
	})
})

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

	it('D386: Spelldrinker options under a Paladin consume the Paladin pool in a Paladin / Cleric multiclass', () => {
		const split = computeCharacterResources(character(cls('Paladin', 3), cls('Cleric', 3)), CLASSES, FEATURES)
		const spelldrinker = [
			{ name: 'Absorb Magic', className: 'Paladin', consumes: { name: 'Channel Divinity' } },
			{ name: 'Expeditious Command', className: 'Paladin', consumes: { name: 'Channel Divinity' } },
		]
		for (const option of spelldrinker) {
			expect(resourceKeyFor(option.consumes.name, option.className, split)).toBe('Channel Divinity (Paladin)')
			expect(resourceKeyFor(option.consumes.name, option.className, split)).not.toBe(classPoolKey('Channel Divinity', 'Cleric'))
		}
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

	it('resourceUsesAfterLevelUp leaves a single-class level up’s keys unchanged', () => {
		const uses = { 'Channel Divinity': 1, Rage: 2 }
		expect(resourceUsesAfterLevelUp({ ...character(cls('Cleric', 3)), play: { resourceUses: uses } }, [cls('Cleric', 4)], CLASSES)).toEqual(uses)
	})

	it('a level up of a legacy save whose pool is already split keeps the plain key for the sheet handover', () => {
		const legacy: Character = { ...character(cls('Cleric', 3), cls('Paladin', 3)), play: { resourceUses: { 'Channel Divinity': 1 } } }
		expect(resourceUsesAfterLevelUp(legacy, [cls('Cleric', 4), cls('Paladin', 3)], CLASSES)).toEqual({ 'Channel Divinity': 1 })
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
