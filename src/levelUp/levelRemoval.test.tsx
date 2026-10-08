// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { computeSpellSlots, type ClassSpellSlotsData } from '../calculation/spellSlots'
import { saveCharacter, wizardDataFromCharacter } from '../creation/wizardState'
import type { ResolverData } from '../featureResolver'
import type { Character, SpentSpellSlots } from '../storage/character'
import { CharacterStore, type CharacterCreateInput, type KeyValueStorage } from '../storage/characterStore'
import { levelGainsFor } from './levelGains'
import { CLASSES, RESOLVER } from './levelGains.fixtures'
import { characterUpdateInput, levelRemovalCore, levelRemovalPlan, levelRemovalTarget, type LevelRemovalPlan } from './levelRemoval'
import { levelUpStepConditions } from './levelUpSteps'
import { RemoveLevelButton } from './RemoveLevelButton'

/* Build order step 8, slice 8e: removing a level. */

afterEach(cleanup)

function memoryStorage(): KeyValueStorage & { raw: () => string | null } {
	const values = new Map<string, string>()
	return {
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => void values.set(key, value),
		removeItem: (key) => void values.delete(key),
		raw: () => values.get('familliar:characters') ?? null,
	}
}

function single(className: string, subclass: string | null, level: number, createdAtLevel?: number): Character {
	return { id: 'c1', name: 'Aria', classes: [{ className, classSource: 'XPHB', subclass, level }], ...(createdAtLevel !== undefined ? { createdAtLevel } : {}) }
}

function plan(character: Character, resolver: ResolverData = RESOLVER): LevelRemovalPlan {
	const result = levelRemovalPlan(character, CLASSES, resolver, null)
	if ('reason' in result) throw new Error(result.reason)
	return result
}

const lookups = { subclasses: [{ name: 'Champion', source: 'XPHB', featureType: null }], spellLevels: [] }
const PORTRAIT = 'data:image/jpeg;base64,AAAA'

function removeTopLevel(store: CharacterStore, id: string): void {
	const stored = store.list().find((character) => character.id === id)!
	store.update(id, characterUpdateInput(plan(stored).result))
}

describe('a level up followed by removing that level', () => {
	it('leaves a Fighter levelled from 4 to 5 as before the level up, except that the held style keeps the source the level up backfilled (D318)', () => {
		const storage = memoryStorage()
		const store = new CharacterStore(storage)
		const created = store.create({
			name: 'Aria',
			classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Champion', level: 4 }],
			classSkills: ['athletics', 'perception'],
			masteries: [{ name: 'Longsword' }, { name: 'Greataxe' }, { name: 'Shortbow' }, { name: 'Rapier' }],
			fightingStyles: [{ className: 'Fighter', classSource: 'XPHB', name: 'Archery' }],
			featAsiChoices: [{ level: 4, kind: 'asi', increases: { strength: 2 } }],
			// Key order as storage reads it back (toCharacterHitPointLevels) — the level up rewrites held entries in that order.
			hitPointLevels: [2, 3, 4].map((level) => ({ level, dieResult: 6, kind: 'average' as const })),
			currentHp: 30,
			createdAtLevel: 4,
			portrait: PORTRAIT,
		})
		const before = storage.raw()

		const gains = levelGainsFor(created, created.classes[0], CLASSES, RESOLVER)
		const seed = wizardDataFromCharacter(created, lookups)
		const data = {
			...seed,
			classChoice: { className: 'Fighter', classSource: 'XPHB', level: 5 },
			hitPointLevels: [...seed.hitPointLevels, { level: 5, kind: 'roll' as const, dieResult: 9 }],
		}
		// The wizard always passes a lookup; it backfills a source on held picks that have none.
		const pickSources = (featureType: string, name: string) => (featureType === 'FS' && name === 'Archery' ? 'XPHB' : undefined)
		saveCharacter(store, data, undefined, { ...levelUpStepConditions(gains), characterLevel: 5, featAsiEligibleLevelCount: 1, hitDieFaces: 10 }, undefined, created, 5, undefined, pickSources)
		expect(storage.raw()).not.toBe(before)
		// W-8: a level up keeps the portrait, and removing the level again does too.
		expect(store.list()[0].portrait).toBe(PORTRAIT)

		removeTopLevel(store, created.id)
		const [after] = JSON.parse(storage.raw()!) as Record<string, unknown>[]
		expect(after['fightingStyles']).toEqual([{ className: 'Fighter', classSource: 'XPHB', name: 'Archery', source: 'XPHB' }])
		expect({ ...after, fightingStyles: [{ className: 'Fighter', classSource: 'XPHB', name: 'Archery' }] }).toEqual((JSON.parse(before!) as unknown[])[0])
	})

	it('F-5 (finding 10): a level up and removing that level keep the species cantrip and the species feat', () => {
		const storage = memoryStorage()
		const store = new CharacterStore(storage)
		const speciesCantrip = { name: 'Fire Bolt', source: 'XPHB' }
		const speciesFeat = { origin: 'species' as const, name: 'Alert', source: 'XPHB' }
		const created = store.create({
			name: 'Aria',
			classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Champion', level: 4 }],
			species: { name: 'Elf; High Elf Lineage', source: 'XPHB' },
			speciesCantrip,
			grantedFeats: [speciesFeat],
			classSkills: ['athletics', 'perception'],
			masteries: [{ name: 'Longsword' }, { name: 'Greataxe' }, { name: 'Shortbow' }, { name: 'Rapier' }],
			fightingStyles: [{ className: 'Fighter', classSource: 'XPHB', name: 'Archery' }],
			featAsiChoices: [{ level: 4, kind: 'asi', increases: { strength: 2 } }],
			hitPointLevels: [2, 3, 4].map((level) => ({ level, dieResult: 6, kind: 'average' as const })),
			createdAtLevel: 4,
		})
		const before = storage.raw()

		const gains = levelGainsFor(created, created.classes[0], CLASSES, RESOLVER)
		const seed = wizardDataFromCharacter(created, lookups)
		const data = { ...seed, classChoice: { className: 'Fighter', classSource: 'XPHB', level: 5 }, hitPointLevels: [...seed.hitPointLevels, { level: 5, kind: 'roll' as const, dieResult: 9 }] }
		saveCharacter(store, data, undefined, { ...levelUpStepConditions(gains), characterLevel: 5, featAsiEligibleLevelCount: 1, hitDieFaces: 10 }, undefined, created, 5)
		expect(store.list()[0]).toMatchObject({ speciesCantrip, grantedFeats: [speciesFeat] })

		removeTopLevel(store, created.id)
		expect(storage.raw()).toBe(before)
	})

	it('leaves a Fighter levelled from 3 to 4 with new picks byte-identical to before the level up', () => {
		const storage = memoryStorage()
		const store = new CharacterStore(storage)
		const created = store.create({
			name: 'Aria',
			classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Champion', level: 3 }],
			masteries: [{ name: 'Longsword' }, { name: 'Greataxe' }, { name: 'Shortbow' }],
			hitPointLevels: [2, 3].map((level) => ({ level, dieResult: 6, kind: 'average' as const })),
			createdAtLevel: 3,
		})
		const before = storage.raw()

		const gains = levelGainsFor(created, created.classes[0], CLASSES, RESOLVER)
		const seed = wizardDataFromCharacter(created, lookups)
		const data = {
			...seed,
			classChoice: { className: 'Fighter', classSource: 'XPHB', level: 4 },
			masteries: [...seed.masteries, 'Rapier'],
			featAsiChoices: [{ level: 4, kind: 'asi' as const, increases: { strength: 2 } }],
			hitPointLevels: [...seed.hitPointLevels, { level: 4, kind: 'roll' as const, dieResult: 7 }],
		}
		saveCharacter(store, data, undefined, { ...levelUpStepConditions(gains), characterLevel: 4, featAsiEligibleLevelCount: 1, hitDieFaces: 10 }, undefined, created, 4)
		expect(store.list()[0].masteries).toContainEqual({ name: 'Rapier', level: 4 })

		removeTopLevel(store, created.id)
		expect(storage.raw()).toBe(before)
	})
})

describe('level history (M1a, D317)', () => {
	const FIGHTER = { className: 'Fighter', classSource: 'XPHB' }

	function levelUpFighter4(store: CharacterStore, created: Character): void {
		const gains = levelGainsFor(created, created.classes[0], CLASSES, RESOLVER)
		const seed = wizardDataFromCharacter(created, lookups)
		const data = { ...seed, classChoice: { className: 'Fighter', classSource: 'XPHB', level: 5 }, hitPointLevels: [...seed.hitPointLevels, { level: 5, kind: 'roll' as const, dieResult: 9 }] }
		saveCharacter(store, data, undefined, { ...levelUpStepConditions(gains), characterLevel: 5, featAsiEligibleLevelCount: 1, hitDieFaces: 10 }, undefined, created, 5)
	}

	function fighter4(levelOrder?: (typeof FIGHTER)[]): CharacterCreateInput {
		return {
			name: 'Aria',
			classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Champion', level: 4 }],
			classSkills: ['athletics', 'perception'],
			masteries: [{ name: 'Longsword' }, { name: 'Greataxe' }, { name: 'Shortbow' }, { name: 'Rapier' }],
			fightingStyles: [{ className: 'Fighter', classSource: 'XPHB', name: 'Archery' }],
			featAsiChoices: [{ level: 4, kind: 'asi' as const, increases: { strength: 2 } }],
			hitPointLevels: [2, 3, 4].map((level) => ({ level, dieResult: 6, kind: 'average' as const })),
			createdAtLevel: 4,
			...(levelOrder ? { levelOrder } : {}),
		}
	}

	it('a level up appends the class, and removing the level drops it again', () => {
		const storage = memoryStorage()
		const store = new CharacterStore(storage)
		const created = store.create(fighter4([FIGHTER, FIGHTER, FIGHTER, FIGHTER]))
		const before = storage.raw()

		levelUpFighter4(store, created)
		expect(store.list()[0].levelOrder).toEqual([FIGHTER, FIGHTER, FIGHTER, FIGHTER, FIGHTER])

		removeTopLevel(store, created.id)
		expect(store.list()[0].levelOrder).toEqual([FIGHTER, FIGHTER, FIGHTER, FIGHTER])
		expect(storage.raw()).toBe(before)
	})

	it('a character with no history stays without one through a level up and a removal', () => {
		const store = new CharacterStore(memoryStorage())
		const created = store.create(fighter4())
		expect('levelOrder' in created).toBe(false)

		levelUpFighter4(store, created)
		expect('levelOrder' in store.list()[0]).toBe(false)
		removeTopLevel(store, created.id)
		expect('levelOrder' in store.list()[0]).toBe(false)
	})
})

describe('levelRemovalCore on two level axes (D328)', () => {
	const WIZARD = { className: 'Wizard', classSource: 'XPHB' }
	const FIGHTER = { className: 'Fighter', classSource: 'XPHB' }
	// classes order differs from levelOrder order on purpose: the top level is Fighter's, not classes[0]'s.
	const wizardFighter: Character = {
		id: 'm6',
		name: 'Split',
		createdAtLevel: 1,
		classes: [
			{ ...WIZARD, subclass: null, level: 1 },
			{ ...FIGHTER, subclass: null, level: 2 },
		],
		levelOrder: [WIZARD, FIGHTER, FIGHTER],
		masteries: [{ name: 'Longsword', level: 2 }, { name: 'Rapier', level: 3 }],
		classFeatureChoices: [
			{ ...FIGHTER, featureName: 'Fighter Two', grantedAtLevel: 2, optionName: 'A' },
			{ ...WIZARD, featureName: 'Wizard Two', grantedAtLevel: 2, optionName: 'B' },
		],
		hitPointLevels: [2, 3].map((level) => ({ level, kind: 'average' as const, dieResult: 6 })),
	}

	function core(character: Character) {
		const result = levelRemovalCore(character, CLASSES, RESOLVER, null)
		if ('reason' in result) throw new Error(result.reason)
		return result
	}

	it('lowers the class of levelOrder.at(-1), drops its class-level-2 choice and the character-level-3 picks', () => {
		const { level, result } = core(wizardFighter)
		expect(level).toBe(3)
		expect(result.classes).toEqual([
			{ ...WIZARD, subclass: null, level: 1 },
			{ ...FIGHTER, subclass: null, level: 1 },
		])
		expect(result.levelOrder).toEqual([WIZARD, FIGHTER])
		expect(result.classFeatureChoices?.map((choice) => choice.featureName)).toEqual(['Wizard Two'])
		expect(result.masteries).toEqual([{ name: 'Longsword', level: 2 }])
		expect(result.hitPointLevels).toEqual([{ level: 2, kind: 'average', dieResult: 6 }])
	})

	it('the gate lets a multiclass character with a consistent history through (D332)', () => {
		const result = levelRemovalPlan(wizardFighter, CLASSES, RESOLVER, null)
		expect('reason' in result).toBe(false)
	})
})

/* M8 (D332): the last level of the history removes its class when that class was at 1. */
describe('removing the last level of a class (D332)', () => {
	const FIGHTER = { className: 'Fighter', classSource: 'XPHB' }
	const ROGUE = { className: 'Rogue', classSource: 'XPHB' }
	const WIZARD = { className: 'Wizard', classSource: 'XPHB' }
	const CLERIC = { className: 'Cleric', classSource: 'XPHB' }
	const fighterRogue: Character = {
		id: 'm8',
		name: 'Split',
		createdAtLevel: 4,
		classes: [
			{ ...FIGHTER, subclass: 'Champion', level: 4 },
			{ ...ROGUE, subclass: null, level: 1 },
		],
		levelOrder: [FIGHTER, FIGHTER, FIGHTER, FIGHTER, ROGUE],
		classSkills: ['athletics', 'perception'],
		fightingStyles: [{ ...FIGHTER, name: 'Archery', source: 'XPHB' }],
		masteries: [{ name: 'Longsword' }, { name: 'Greataxe' }, { name: 'Shortbow' }, { name: 'Rapier' }],
		expertiseSkills: [{ name: 'stealth', level: 5 }, { name: 'athletics', level: 5 }],
		featAsiChoices: [{ level: 4, kind: 'asi', increases: { strength: 2 } }],
		multiclassPicks: [{ ...ROGUE, kind: 'skill', name: 'stealth' }],
		classFeatureChoices: [{ ...ROGUE, featureName: 'Rogue One', grantedAtLevel: 1, optionName: 'A' }],
		languages: [{ name: 'Common', source: 'XPHB', grantedBy: 'automatic' }, { name: 'Elvish', source: 'XPHB', grantedBy: 'thievesCant' }],
		hitPointLevels: [2, 3, 4, 5].map((level) => ({ level, kind: 'average' as const, dieResult: level === 5 ? 5 : 6 })),
		play: { spentHitDice: { 'Rogue|XPHB': 1, 'Fighter|XPHB': 2 } },
	}

	function core(character: Character): LevelRemovalPlan {
		const result = levelRemovalPlan(character, CLASSES, RESOLVER, null)
		if ('reason' in result) throw new Error(result.reason)
		return result
	}

	it('Fighter 4 / Rogue 1, Rogue last: Rogue and everything it owns go, Fighter records stay (finding 4)', () => {
		const { level, removedClass, dropped, result } = core(fighterRogue)
		expect(level).toBe(5)
		expect(removedClass).toBe('Rogue')
		expect(result.classes).toEqual([{ ...FIGHTER, subclass: 'Champion', level: 4 }])
		expect(result.levelOrder).toEqual([FIGHTER, FIGHTER, FIGHTER, FIGHTER])
		expect(result.multiclassPicks).toEqual([])
		expect(result.expertiseSkills).toEqual([])
		expect(result.classFeatureChoices).toEqual([])
		expect(result.languages).toEqual([{ name: 'Common', source: 'XPHB', grantedBy: 'automatic' }])
		expect(result.hitPointLevels?.map((entry) => entry.level)).toEqual([2, 3, 4])
		expect(result.play).toEqual({ spentHitDice: { 'Fighter|XPHB': 2 } })
		expect(result).toMatchObject({ fightingStyles: fighterRogue.fightingStyles, masteries: fighterRogue.masteries, featAsiChoices: fighterRogue.featAsiChoices, classSkills: fighterRogue.classSkills })
		expect(dropped).toEqual(
			expect.arrayContaining(['Skill proficiency: stealth (Rogue multiclass)', 'Expertise: stealth', 'Rogue One: A', 'Language: Elvish', 'Rogue hit dice: 1 spent, now 0']),
		)
	})

	it('the saved result passes the write check and is an ordinary single-class character', () => {
		const store = new CharacterStore(memoryStorage())
		const { id: _id, ...input } = fighterRogue
		const created = store.create(input)
		store.update(created.id, characterUpdateInput(core(store.list()[0]).result))
		const [saved] = store.list()
		expect(saved.classes).toEqual([{ ...FIGHTER, subclass: 'Champion', level: 4 }])
		expect(saved.levelOrder).toEqual([FIGHTER, FIGHTER, FIGHTER, FIGHTER])
		expect('multiclassPicks' in saved).toBe(false)
		expect(levelRemovalTarget(saved)).toEqual({ reason: expect.stringContaining('created at level 4') })
	})

	it('drops the class spells, subclass spell picks, Wild Shape forms, its fighting style and the Tome spells of a dropped option', () => {
		const character: Character = {
			id: 'm8b',
			name: 'Caster',
			createdAtLevel: 3,
			classes: [
				{ ...WIZARD, subclass: null, level: 3 },
				{ ...CLERIC, subclass: null, level: 1 },
			],
			levelOrder: [WIZARD, WIZARD, WIZARD, CLERIC],
			spellChoices: [
				{ ...WIZARD, spells: [{ name: 'Shield', source: 'XPHB' }] },
				{ ...CLERIC, spells: [{ name: 'Bless', source: 'XPHB' }, { name: 'Guidance', source: 'XPHB' }] },
			],
			wildShapeForms: [{ ...CLERIC, forms: [{ name: 'Wolf', source: 'XMM' }] }],
			subclassSpellChoices: [{ subclassName: 'Lore', subclassSource: 'XPHB', ...CLERIC, picks: [{ grantedAtLevel: 3, slotIndex: 0, name: 'Command', source: 'XPHB' }] }],
			fightingStyles: [{ ...CLERIC, name: 'Defense' }],
			optionalFeatureChoices: [
				{ featureType: 'EI', choices: [{ name: 'Pact of the Tome', level: 4 }], spellChoices: [{ optionName: 'Pact of the Tome', cantrips: [{ name: 'Light', source: 'XPHB' }], spells: [] }] },
			],
			play: { concentratingOn: { name: 'Bless', source: 'XPHB' }, temporaryHitPoints: 3 },
		}
		const { removedClass, dropped, result } = core(character)
		expect(removedClass).toBe('Cleric')
		expect(result.spellChoices).toEqual([{ ...WIZARD, spells: [{ name: 'Shield', source: 'XPHB' }] }])
		expect(result.wildShapeForms).toEqual([])
		expect(result.subclassSpellChoices).toEqual([])
		expect(result.fightingStyles).toEqual([])
		expect(result.optionalFeatureChoices).toEqual([])
		expect(result.play).toEqual({ temporaryHitPoints: 3 })
		expect(dropped).toEqual(
			expect.arrayContaining(['Cleric spell: Bless', 'Cleric spell: Guidance', 'Wild Shape form: Wolf', 'Fighting style: Defense', 'Pact of the Tome spell: Light', 'Concentration: Bless']),
		)
	})

	it('keeps concentration on a spell another class still holds, and on a spell of a kept class', () => {
		const both: Character = {
			id: 'm8c',
			name: 'Both',
			createdAtLevel: 3,
			classes: [
				{ ...WIZARD, subclass: null, level: 3 },
				{ ...CLERIC, subclass: null, level: 1 },
			],
			levelOrder: [WIZARD, WIZARD, WIZARD, CLERIC],
			spellChoices: [
				{ ...WIZARD, spells: [{ name: 'Detect Magic', source: 'XPHB' }] },
				{ ...CLERIC, spells: [{ name: 'Detect Magic', source: 'XPHB' }] },
			],
			play: { concentratingOn: { name: 'Detect Magic', source: 'XPHB' } },
		}
		expect(core(both).result.play).toEqual(both.play)
	})

	it('current behaviour (F-11, review f): concentration on a spell a feat also grants still ends with the removed class, because only stored class picks count as holding it', () => {
		const character: Character = {
			id: 'm8f',
			name: 'Feated',
			createdAtLevel: 3,
			classes: [
				{ ...WIZARD, subclass: null, level: 3 },
				{ ...CLERIC, subclass: null, level: 1 },
			],
			levelOrder: [WIZARD, WIZARD, WIZARD, CLERIC],
			spellChoices: [{ ...CLERIC, spells: [{ name: 'Bless', source: 'XPHB' }] }],
			grantedFeats: [
				{ origin: 'manual', id: 'mi1', name: 'Magic Initiate', source: 'XPHB', magicInitiate: { ...CLERIC, cantrips: [], spell: { name: 'Bless', source: 'XPHB' } } },
			],
			play: { concentratingOn: { name: 'Bless', source: 'XPHB' } },
		}
		const { dropped, result } = core(character)
		expect(result.play?.concentratingOn).toBeUndefined()
		expect(dropped).toContain('Concentration: Bless')
		expect(result.grantedFeats).toEqual(character.grantedFeats)
	})

	it('removing a non-last level of a multiclass class keeps its levelless records (Warlock 6 / Sorcerer 3)', () => {
		const SORCERER = { className: 'Sorcerer', classSource: 'XPHB' }
		const WARLOCK = { className: 'Warlock', classSource: 'XPHB' }
		const character: Character = {
			id: 'm8d',
			name: 'Pact',
			createdAtLevel: 6,
			classes: [
				{ ...WARLOCK, subclass: null, level: 6 },
				{ ...SORCERER, subclass: null, level: 3 },
			],
			levelOrder: [...Array.from({ length: 6 }, () => WARLOCK), SORCERER, SORCERER, SORCERER],
			spellChoices: [{ ...SORCERER, spells: [{ name: 'Shield', source: 'XPHB' }] }],
			multiclassPicks: [],
		}
		const { removedClass, result } = core(character)
		expect(removedClass).toBeUndefined()
		expect(result.classes).toEqual([
			{ ...WARLOCK, subclass: null, level: 6 },
			{ ...SORCERER, subclass: null, level: 2 },
		])
		expect(result.spellChoices).toEqual(character.spellChoices)
	})
})

describe('what removing a level drops', () => {
	const rogue: Character = {
		...single('Rogue', 'Thief', 6, 3),
		masteries: [{ name: 'Dagger' }, { name: 'Shortbow', level: 6 }],
		expertiseSkills: [{ name: 'stealth' }, { name: 'perception' }, { name: 'insight', level: 6 }, { name: 'athletics', level: 6 }],
		optionalFeatureChoices: [
			{ featureType: 'EI', choices: [{ name: 'Agonizing Blast' }, { name: 'Repelling Blast', level: 6 }] },
			{ featureType: 'MV', choices: [{ name: 'Parry', level: 6 }] },
		],
		featAsiChoices: [
			{ level: 4, kind: 'asi', increases: { dexterity: 2 } },
			{ level: 6, kind: 'feat', name: 'Alert', source: 'XPHB' },
		],
		classFeatureChoices: [
			{ className: 'Rogue', classSource: 'XPHB', featureName: 'Old Choice', grantedAtLevel: 1, optionName: 'A' },
			{ className: 'Rogue', classSource: 'XPHB', featureName: 'New Choice', grantedAtLevel: 6, optionName: 'B' },
		],
		subclassSpellChoices: [
			{
				subclassName: 'Thief',
				subclassSource: 'XPHB',
				className: 'Rogue',
				classSource: 'XPHB',
				picks: [
					{ grantedAtLevel: 3, slotIndex: 0, name: 'Shield', source: 'XPHB' },
					{ grantedAtLevel: 6, slotIndex: 0, name: 'Blur', source: 'XPHB' },
				],
			},
		],
		spellChoices: [{ className: 'Rogue', classSource: 'XPHB', spells: [{ name: 'Fireball', source: 'XPHB' }] }],
		hitPointLevels: [5, 6].map((level) => ({ level, kind: 'average' as const, dieResult: 5 })),
	}

	it('drops every pick carrying the removed level and touches no pick without a level', () => {
		const { result, dropped } = plan(rogue)

		expect(result.classes).toEqual([{ className: 'Rogue', classSource: 'XPHB', subclass: 'Thief', level: 5 }])
		expect(result.masteries).toEqual([{ name: 'Dagger' }])
		expect(result.expertiseSkills).toEqual([{ name: 'stealth' }, { name: 'perception' }])
		expect(result.optionalFeatureChoices).toEqual([{ featureType: 'EI', choices: [{ name: 'Agonizing Blast' }] }])
		expect(result.featAsiChoices).toEqual([{ level: 4, kind: 'asi', increases: { dexterity: 2 } }])
		expect(result.classFeatureChoices?.map((choice) => choice.featureName)).toEqual(['Old Choice'])
		expect(result.subclassSpellChoices?.[0].picks.map((pick) => pick.name)).toEqual(['Shield'])
		expect(result.hitPointLevels).toEqual([{ level: 5, kind: 'average', dieResult: 5 }])
		expect(dropped).toContain('Hit points for level 6')
		expect(dropped).toContain('Feat: Alert')
	})

	it('leaves known and prepared spells stored', () => {
		expect(plan(rogue).result.spellChoices).toEqual(rogue.spellChoices)
	})

	it('clears the subclass only when the class chooses it at the removed level', () => {
		expect(plan(single('Cleric', 'Life Domain', 3, 2)).result.classes[0].subclass).toBeNull()
		expect(plan(single('Fighter', 'Champion', 4, 3)).result.classes[0].subclass).toBe('Champion')
	})

	it('clears the fighting style only when the class grants it at the removed level', () => {
		const withPaladin: ResolverData = {
			...RESOLVER,
			classFeatures: [...(RESOLVER.classFeatures as unknown[]), { name: 'Fighting Style', className: 'Paladin', classSource: 'XPHB', level: 2, entries: [] }],
		}
		const defense = { className: 'Paladin', classSource: 'XPHB', name: 'Defense' }
		const archery = { className: 'Fighter', classSource: 'XPHB', name: 'Archery' }
		expect(plan({ ...single('Paladin', null, 2, 1), fightingStyles: [defense] }, withPaladin).result.fightingStyles).toEqual([])
		expect(plan({ ...single('Fighter', null, 2, 1), fightingStyles: [archery] }, withPaladin).result.fightingStyles).toEqual([archery])
	})

	it('needs no work for spell slots: they follow the level down', () => {
		const wizard: ClassSpellSlotsData = {
			className: 'Wizard',
			classSource: 'XPHB',
			casterProgression: 'full',
			spellSlotsByLevel: [
				[2, 0, 0],
				[3, 0, 0],
				[4, 2, 0],
				[4, 3, 0],
				[4, 3, 2],
			],
			pactSlotsByLevel: null,
		}
		const slots = (character: Character) => {
			const result = computeSpellSlots(character, [wizard])
			return result.status === 'known' ? result.value[0].ordinarySlots : null
		}
		const removed = plan(single('Wizard', null, 5, 4)).result
		expect(slots(removed)).toEqual(slots(single('Wizard', null, 4)))
		expect(slots(removed)?.[2]).toBe(0)
	})
})

describe('class-feature languages on a level removal (D172)', () => {
	const languages: Character['languages'] = [
		{ name: 'Common', source: 'XPHB', grantedBy: 'automatic' },
		{ name: 'Elvish', source: 'XPHB', grantedBy: 'creation' },
		{ name: 'Giant', source: 'XPHB', grantedBy: 'deftExplorer' },
		{ name: 'Orc', source: 'XPHB', grantedBy: 'deftExplorer' },
	]

	it("removing Ranger level 2 drops Deft Explorer's two languages and nothing else", () => {
		const removed = plan({ ...single('Ranger', null, 2, 1), languages })
		expect(removed.result.languages?.map((language) => language.name)).toEqual(['Common', 'Elvish'])
		expect(removed.dropped).toEqual(expect.arrayContaining(['Language: Giant', 'Language: Orc']))
	})

	it('removing Ranger level 3 keeps them', () => {
		expect(plan({ ...single('Ranger', null, 3, 1), languages }).result.languages).toEqual(languages)
	})
})

describe('class tool picks on a level removal (D174)', () => {
	const toolChoices: Character['toolChoices'] = [{ grantedBy: 'battleMaster', name: "Smith's Tools" }]

	it('removing Fighter level 3 drops the Battle Master tool pick', () => {
		const removed = plan({ ...single('Fighter', 'Battle Master', 3, 1), toolChoices })
		expect(removed.result.toolChoices).toEqual([])
		expect(removed.dropped).toContain("Tool proficiency: Smith's Tools")
	})

	it('removing Fighter level 4 keeps it', () => {
		expect(plan({ ...single('Fighter', 'Battle Master', 4, 1), toolChoices }).result.toolChoices).toEqual(toolChoices)
	})
})

describe('subclass skill picks on a level removal (D177)', () => {
	const subclassSkills: Character['subclassSkills'] = [{ grantedBy: 'cavalier', name: 'history' }]
	const cavalierLanguage = { name: 'Elvish', source: 'XPHB', grantedBy: 'cavalier' as const }

	it('removing Fighter level 3 drops the Cavalier skill and a Cavalier language', () => {
		const removed = plan({ ...single('Fighter', 'Cavalier', 3, 1), subclassSkills, languages: [cavalierLanguage] })
		expect(removed.result.subclassSkills).toEqual([])
		expect(removed.result.languages).toEqual([])
		expect(removed.dropped).toEqual(expect.arrayContaining(['Skill proficiency: history', 'Language: Elvish']))
	})

	it('removing Fighter level 4 keeps them', () => {
		const removed = plan({ ...single('Fighter', 'Cavalier', 4, 1), subclassSkills, languages: [cavalierLanguage] })
		expect(removed.result.subclassSkills).toEqual(subclassSkills)
		expect(removed.result.languages).toEqual([cavalierLanguage])
	})
})

describe('when a level cannot be removed', () => {
	it('refuses at level 1, at the created-at level, without a created-at level, and for a multiclass character without history', () => {
		expect(levelRemovalTarget(single('Fighter', null, 1, 1))).toEqual({ reason: expect.stringContaining('Level 1') })
		expect(levelRemovalTarget(single('Fighter', 'Champion', 5, 5))).toEqual({ reason: expect.stringContaining('created at level 5') })
		expect(levelRemovalTarget(single('Fighter', 'Champion', 5))).toEqual({ reason: expect.stringContaining('not known') })
		const multiclass: Character = {
			...single('Fighter', 'Champion', 3, 1),
			classes: [
				{ className: 'Fighter', classSource: 'XPHB', subclass: 'Champion', level: 3 },
				{ className: 'Rogue', classSource: 'XPHB', subclass: null, level: 2 },
			],
		}
		expect(levelRemovalTarget(multiclass)).toEqual({ reason: 'Cannot tell which class each level came from (no level history).' })
	})
})

/* Slice 9b1: a lower level means smaller pools, so the spent counts come down with them. */
describe('resource uses on a level removal', () => {
	/* The shared fixture has no resource table; Fighter's real Second Wind column (2 uses to level 3, 3 from 4) is added for these two tests alone. */
	const SECOND_WIND_ID = 'cf|second wind|fighter|xphb|1|xphb'
	const RESOURCE_CLASSES = CLASSES.map((entry) =>
		entry.entryType === 'class' && entry.name === 'Fighter'
			? {
					...entry,
					classTableGroups: [...(entry.classTableGroups ?? []), { colLabels: ['Second Wind'], rows: [[2], [2], [2], [3], [3], [3], [3], [3], [3], [4]] }],
					classFeatureIds: [...(entry.classFeatureIds ?? []), SECOND_WIND_ID],
				}
			: entry,
	)
	const RESOURCE_RESOLVER: ResolverData = {
		...RESOLVER,
		classFeatures: [
			...(RESOLVER.classFeatures as unknown[]),
			{
				id: SECOND_WIND_ID,
				name: 'Second Wind',
				className: 'Fighter',
				classSource: 'XPHB',
				level: 1,
				entries: ['You regain one expended use when you finish a {@variantrule Short Rest|XPHB}.'],
			},
		],
	}

	function fighterWithUses(level: number, resourceUses: Record<string, number>): Character {
		return { ...single('Fighter', 'Champion', level, 1), play: { temporaryHitPoints: 5, resourceUses } }
	}

	it('brings a count above the new maximum down to it, and says so', () => {
		const result = levelRemovalPlan(fighterWithUses(4, { 'Second Wind': 3 }), RESOURCE_CLASSES, RESOURCE_RESOLVER, null)
		if ('reason' in result) throw new Error(result.reason)

		expect(result.result.play).toEqual({ temporaryHitPoints: 5, resourceUses: { 'Second Wind': 2 } })
		expect(result.dropped).toContain('Second Wind: 3 spent, now 2')
	})

	it('leaves a count that still fits, and one whose maximum is not in the data, alone', () => {
		const result = levelRemovalPlan(fighterWithUses(4, { 'Second Wind': 1, 'Superiority Die': 9 }), RESOURCE_CLASSES, RESOURCE_RESOLVER, null)
		if ('reason' in result) throw new Error(result.reason)

		expect(result.result.play?.resourceUses).toEqual({ 'Second Wind': 1, 'Superiority Die': 9 })
		expect(result.dropped.some((line) => line.includes('spent'))).toBe(false)
	})

	it('D332: a pool of a removed class goes with it; a count whose maximum was never known stays', () => {
		const ROGUE = { className: 'Rogue', classSource: 'XPHB' }
		const FIGHTER = { className: 'Fighter', classSource: 'XPHB' }
		const character: Character = {
			...single('Rogue', null, 4, 4),
			classes: [
				{ ...ROGUE, subclass: null, level: 4 },
				{ ...FIGHTER, subclass: null, level: 1 },
			],
			levelOrder: [ROGUE, ROGUE, ROGUE, ROGUE, FIGHTER],
			play: { resourceUses: { 'Second Wind': 1, 'Superiority Die': 9 } },
		}
		const result = levelRemovalPlan(character, RESOURCE_CLASSES, RESOURCE_RESOLVER, null)
		if ('reason' in result) throw new Error(result.reason)

		expect(result.result.play?.resourceUses).toEqual({ 'Superiority Die': 9 })
		expect(result.dropped).toContain('Second Wind: 1 spent, now 0')
	})
})

describe('a resource pool two classes share (F-11, review finding 6)', () => {
	const CLERIC = { className: 'Cleric', classSource: 'XPHB' }
	const PALADIN = { className: 'Paladin', classSource: 'XPHB' }
	const channelDivinity = (uses: number) => [{ colLabels: ['Channel Divinity'], rows: Array.from({ length: 10 }, () => [uses]) }]
	const POOL_CLASSES = [
		...CLASSES.map((entry) => (entry.entryType === 'class' && entry.name === 'Cleric' ? { ...entry, classTableGroups: channelDivinity(2) } : entry)),
		{ entryType: 'class', name: 'Paladin', source: 'XPHB', hd: { number: 1, faces: 10 }, classFeatureIds: [], classFeatures: [], classTableGroups: channelDivinity(3) },
	]

	it('current behaviour: the pool keeps its name while another class still gives it, so the count is clamped to that class’s maximum, not deleted', () => {
		const character: Character = {
			id: 'm8p',
			name: 'Twin pool',
			createdAtLevel: 3,
			classes: [
				{ ...CLERIC, subclass: null, level: 3 },
				{ ...PALADIN, subclass: null, level: 1 },
			],
			levelOrder: [CLERIC, CLERIC, CLERIC, PALADIN],
			play: { resourceUses: { 'Channel Divinity': 3 } },
		}
		const result = levelRemovalPlan(character, POOL_CLASSES, RESOLVER, null)
		if ('reason' in result) throw new Error(result.reason)

		expect(result.result.classes.map((entry) => entry.className)).toEqual(['Cleric'])
		expect(result.result.play?.resourceUses).toEqual({ 'Channel Divinity': 2 })
		expect(result.dropped).toContain('Channel Divinity: 3 spent, now 2')
	})

	it('D336: removing the class takes its own pool and count; the other class keeps its count under the plain key', () => {
		const character: Character = {
			id: 'm10b',
			name: 'Twin pool',
			createdAtLevel: 3,
			classes: [
				{ ...CLERIC, subclass: null, level: 3 },
				{ ...PALADIN, subclass: null, level: 1 },
			],
			levelOrder: [CLERIC, CLERIC, CLERIC, PALADIN],
			play: { resourceUses: { 'Channel Divinity (Cleric)': 1, 'Channel Divinity (Paladin)': 2 } },
		}
		const result = levelRemovalPlan(character, POOL_CLASSES, RESOLVER, null)
		if ('reason' in result) throw new Error(result.reason)

		expect(result.result.play?.resourceUses).toEqual({ 'Channel Divinity': 1 })
		expect(result.dropped).toContain('Channel Divinity (Paladin): 2 spent, now 0')
	})

	it('D336: a class that drops below the level of its pool loses its own key; the other class keeps its count', () => {
		// Paladin's real table: no Channel Divinity before level 3.
		const classes = POOL_CLASSES.map((entry) =>
			entry.entryType === 'class' && entry.name === 'Paladin' ? { ...entry, classTableGroups: [{ colLabels: ['Channel Divinity'], rows: [[0], [0], [2], [2], [2]] }] } : entry,
		)
		const character: Character = {
			id: 'm10b2',
			name: 'Twin pool',
			createdAtLevel: 3,
			classes: [
				{ ...CLERIC, subclass: null, level: 3 },
				{ ...PALADIN, subclass: null, level: 3 },
			],
			levelOrder: [CLERIC, CLERIC, CLERIC, PALADIN, PALADIN, PALADIN],
			play: { resourceUses: { 'Channel Divinity (Cleric)': 1, 'Channel Divinity (Paladin)': 1 } },
		}
		const result = levelRemovalPlan(character, classes, RESOLVER, null)
		if ('reason' in result) throw new Error(result.reason)

		expect(result.result.classes.map((entry) => entry.level)).toEqual([3, 2])
		expect(result.result.play?.resourceUses).toEqual({ 'Channel Divinity': 1 })
		expect(result.dropped).toContain('Channel Divinity (Paladin): 1 spent, now 0')
	})

	it('D336 (4): a legacy plain count on a pool that stays split goes to the first class, clamped to its maximum, and the cut is listed', () => {
		const character: Character = {
			id: 'm10b3',
			name: 'Twin pool',
			createdAtLevel: 3,
			classes: [
				{ ...CLERIC, subclass: null, level: 3 },
				{ ...PALADIN, subclass: null, level: 2 },
			],
			levelOrder: [CLERIC, CLERIC, CLERIC, PALADIN, PALADIN],
			play: { resourceUses: { 'Channel Divinity': 3 } },
		}
		const result = levelRemovalPlan(character, POOL_CLASSES, RESOLVER, null)
		if ('reason' in result) throw new Error(result.reason)

		expect(result.result.classes.map((entry) => entry.level)).toEqual([3, 1])
		expect(result.result.play?.resourceUses).toEqual({ 'Channel Divinity (Cleric)': 2 })
		expect(result.dropped).toContain('Channel Divinity (Cleric): 3 spent, now 2')
	})
})

/* Slice 9b3: the same invariant as the block above, one pool over — and D11's two pools clamp separately. */
describe('spent spell slots on a level removal', () => {
	/* Sorcerer's real level 1-5 rows, plus a Warlock carrying Pact Magic's own two columns (1 slot to level 1, 2 from 2). */
	const SLOT_CLASSES = [
		// The shared fixture's Warlock has no Pact Magic columns; this one replaces it.
		...CLASSES.filter((entry) => !(entry.entryType === 'class' && entry.name === 'Warlock')).map((entry) =>
			entry.entryType === 'class' && entry.name === 'Sorcerer'
				? {
						...entry,
						casterProgression: 'full',
						classTableGroups: [
							{
								colLabels: ['1st', '2nd', '3rd'],
								rowsSpellProgression: [
									[2, 0, 0],
									[3, 0, 0],
									[4, 2, 0],
									[4, 3, 0],
									[4, 3, 2],
								],
							},
						],
					}
				: entry,
		),
		{
			entryType: 'class',
			name: 'Warlock',
			source: 'XPHB',
			subclassTitle: 'Warlock Subclass',
			hd: { number: 1, faces: 8 },
			casterProgression: 'pact',
			classTableGroups: [{ colLabels: ['Spell Slots', 'Slot Level'], rows: [[1, 1], [2, 1], [2, 2], [2, 2], [2, 3]] }],
			classFeatureIds: [],
		},
	]

	function withSpent(className: string, level: number, spentSpellSlots: SpentSpellSlots): Character {
		return { ...single(className, null, level, 1), play: { temporaryHitPoints: 5, spentSpellSlots } }
	}

	function removalPlan(character: Character): LevelRemovalPlan {
		const result = levelRemovalPlan(character, SLOT_CLASSES, RESOLVER, null)
		if ('reason' in result) throw new Error(result.reason)
		return result
	}

	it('brings an ordinary count above the new maximum down to it, and says so', () => {
		// Sorcerer 5 -> 4 loses its only level 3 slots entirely and keeps 3 at level 2.
		const result = removalPlan(withSpent('Sorcerer', 5, { ordinary: { 2: 3, 3: 2 } }))

		expect(result.result.play).toEqual({ temporaryHitPoints: 5, spentSpellSlots: { ordinary: { 2: 3 } } })
		expect(result.dropped).toContain('Level 3 spell slots: 2 spent, now 0')
		expect(result.dropped.some((line) => line.startsWith('Level 2 spell slots'))).toBe(false)
	})

	it('clamps the Pact Magic pool on its own', () => {
		const result = removalPlan(withSpent('Warlock', 2, { pact: 2 }))

		expect(result.result.play?.spentSpellSlots).toEqual({ pact: 1 })
		expect(result.dropped).toContain('Pact Magic slots: 2 spent, now 1')
	})

	it('leaves the field off entirely once nothing survives the clamp', () => {
		const result = removalPlan(withSpent('Sorcerer', 3, { ordinary: { 2: 2 } }))

		expect(result.result.play).toEqual({ temporaryHitPoints: 5 })
	})
})

/* Slice 9b4: the same invariant again, against a maximum that is the class's own level rather than a data table. */
describe('spent hit dice on a level removal', () => {
	function withSpentHitDice(level: number, spentHitDice: Record<string, number>): Character {
		return { ...single('Fighter', 'Champion', level, 1), play: { temporaryHitPoints: 5, spentHitDice } }
	}

	it('brings a count above the new level down to it, and says so', () => {
		const result = plan(withSpentHitDice(4, { 'Fighter|XPHB': 4 }))

		expect(result.result.play).toEqual({ temporaryHitPoints: 5, spentHitDice: { 'Fighter|XPHB': 3 } })
		expect(result.dropped).toContain('Fighter hit dice: 4 spent, now 3')
	})

	it('leaves a count that still fits alone', () => {
		const result = plan(withSpentHitDice(4, { 'Fighter|XPHB': 2 }))

		expect(result.result.play?.spentHitDice).toEqual({ 'Fighter|XPHB': 2 })
		expect(result.dropped.some((line) => line.includes('hit dice'))).toBe(false)
	})

	it('drops a count for a class the character does not have, and leaves the field off once nothing survives', () => {
		const result = plan(withSpentHitDice(2, { 'Wizard|XPHB': 1 }))

		expect(result.result.play).toEqual({ temporaryHitPoints: 5 })
		expect(result.dropped).toContain('Wizard hit dice: 1 spent, now 0')
	})
})

describe('RemoveLevelButton', () => {
	const fixturePlan = async (character: Character) => levelRemovalPlan(character, CLASSES, RESOLVER, null)

	it('has no usable control at the created-at level and says why, without asking the data', () => {
		const loadPlan = vi.fn(fixturePlan)
		render(<RemoveLevelButton character={single('Fighter', 'Champion', 5, 5)} onRemoveLevel={() => {}} loadPlan={loadPlan} />)

		const button = screen.getByRole('button', { name: /remove level/i }) as HTMLButtonElement
		expect(button.disabled).toBe(true)
		expect(button.textContent).toBe('Remove level')
		expect(button.title).toContain('created at level 5')
		expect(loadPlan).not.toHaveBeenCalled()
	})

	it('says so on the control when the created-at level is not known', () => {
		render(<RemoveLevelButton character={single('Fighter', 'Champion', 5)} onRemoveLevel={() => {}} loadPlan={fixturePlan} />)

		const button = screen.getByRole('button', { name: /remove level/i }) as HTMLButtonElement
		expect(button.disabled).toBe(true)
		expect(button.textContent).toBe('Remove level')
		expect(button.title).toContain('not known')
	})

	it('refuses a multiclass character without level history on the control', () => {
		const multiclass: Character = {
			...single('Fighter', 'Champion', 3, 1),
			classes: [
				{ className: 'Fighter', classSource: 'XPHB', subclass: 'Champion', level: 3 },
				{ className: 'Rogue', classSource: 'XPHB', subclass: null, level: 2 },
			],
		}
		render(<RemoveLevelButton character={multiclass} onRemoveLevel={() => {}} loadPlan={fixturePlan} />)

		const button = screen.getByRole('button', { name: /remove level/i }) as HTMLButtonElement
		expect(button.disabled).toBe(true)
		expect(button.textContent).toBe('Remove level')
		expect(button.title).toBe('Remove level unavailable: Cannot tell which class each level came from (no level history).')
	})

	it('D332: names the class that leaves above the list of lost records', async () => {
		const user = userEvent.setup()
		const FIGHTER = { className: 'Fighter', classSource: 'XPHB' }
		const ROGUE = { className: 'Rogue', classSource: 'XPHB' }
		const multiclass: Character = {
			...single('Fighter', 'Champion', 4, 4),
			classes: [
				{ ...FIGHTER, subclass: 'Champion', level: 4 },
				{ ...ROGUE, subclass: null, level: 1 },
			],
			levelOrder: [FIGHTER, FIGHTER, FIGHTER, FIGHTER, ROGUE],
			multiclassPicks: [{ ...ROGUE, kind: 'skill', name: 'stealth' }],
		}
		render(<RemoveLevelButton character={multiclass} onRemoveLevel={() => {}} loadPlan={fixturePlan} />)

		await user.click(await screen.findByRole('button', { name: 'Remove level 5' }))
		const dialog = await screen.findByRole('alertdialog')
		const paragraphs = [...dialog.querySelectorAll('.confirm-dialog__extra p')].map((p) => p.textContent)
		expect(paragraphs[0]).toBe('Rogue will be removed from this character.')
		expect(paragraphs.indexOf('Rogue will be removed from this character.')).toBeLessThan(paragraphs.findIndex((text) => text?.startsWith('The character goes back')))
		expect(within(dialog).getByText('Skill proficiency: stealth (Rogue multiclass)')).toBeTruthy()
	})

	it('stays clickable across a save and confirms a plan built from the latest character (F-7b)', async () => {
		const onRemoveLevel = vi.fn()
		const user = userEvent.setup()
		const before = single('Fighter', 'Champion', 5, 4)
		const { rerender } = render(<RemoveLevelButton character={before} onRemoveLevel={onRemoveLevel} loadPlan={fixturePlan} />)
		await screen.findByRole('button', { name: 'Remove level 5' })

		// A blur-triggered save re-renders with a new character object right before the click lands.
		rerender(<RemoveLevelButton character={{ ...before, name: 'Saved just now' }} onRemoveLevel={onRemoveLevel} loadPlan={fixturePlan} />)
		const button = screen.getByRole('button', { name: 'Remove level 5' }) as HTMLButtonElement
		expect(button.disabled).toBe(false)

		await user.click(button)
		await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remove level' }))

		expect(onRemoveLevel).toHaveBeenCalledTimes(1)
		expect(onRemoveLevel.mock.calls[0][0].name).toBe('Saved just now')
	})

	it('asks inside the page first, and cancelling hands nothing to the writer', async () => {
		const onRemoveLevel = vi.fn()
		const user = userEvent.setup()
		render(<RemoveLevelButton character={single('Fighter', 'Champion', 5, 4)} onRemoveLevel={onRemoveLevel} loadPlan={fixturePlan} />)

		await user.click(await screen.findByRole('button', { name: 'Remove level 5' }))
		const dialog = screen.getByRole('alertdialog', { name: 'Remove level 5?' })
		expect(dialog.textContent).toContain('Choices made at this level will be lost.')
		expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Keep level' }))
		await user.click(within(dialog).getByRole('button', { name: 'Keep level' }))

		expect(onRemoveLevel).not.toHaveBeenCalled()
		expect(screen.queryByRole('alertdialog')).toBeNull()
		expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove level 5' }))

		await user.click(screen.getByRole('button', { name: 'Remove level 5' }))
		await user.keyboard('{Escape}')
		expect(screen.queryByRole('alertdialog')).toBeNull()
		expect(onRemoveLevel).not.toHaveBeenCalled()

		await user.click(screen.getByRole('button', { name: 'Remove level 5' }))
		await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove level' }))
		expect(onRemoveLevel).toHaveBeenCalledTimes(1)
		expect((onRemoveLevel.mock.calls[0][0] as Character).classes[0].level).toBe(4)
	})
})
