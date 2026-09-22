// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { computeSpellSlots, type ClassSpellSlotsData } from '../calculation/spellSlots'
import { saveCharacter, wizardDataFromCharacter } from '../creation/wizardState'
import type { ResolverData } from '../featureResolver'
import type { Character, SpentSpellSlots } from '../storage/character'
import { CharacterStore, type KeyValueStorage } from '../storage/characterStore'
import { levelGainsFor } from './levelGains'
import { CLASSES, RESOLVER } from './levelGains.fixtures'
import { characterUpdateInput, levelRemovalPlan, levelRemovalTarget, type LevelRemovalPlan } from './levelRemoval'
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

function removeTopLevel(store: CharacterStore, id: string): void {
	const stored = store.list().find((character) => character.id === id)!
	store.update(id, characterUpdateInput(plan(stored).result))
}

describe('a level up followed by removing that level', () => {
	it('leaves a Fighter levelled from 4 to 5 byte-identical to before the level up', () => {
		const storage = memoryStorage()
		const store = new CharacterStore(storage)
		const created = store.create({
			name: 'Aria',
			classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Champion', level: 4 }],
			classSkills: ['athletics', 'perception'],
			masteries: [{ name: 'Longsword' }, { name: 'Greataxe' }, { name: 'Shortbow' }, { name: 'Rapier' }],
			fightingStyle: 'Archery',
			featAsiChoices: [{ level: 4, kind: 'asi', increases: { strength: 2 } }],
			// Key order as storage reads it back (toCharacterHitPointLevels) — the level up rewrites held entries in that order.
			hitPointLevels: [2, 3, 4].map((level) => ({ level, dieResult: 6, kind: 'average' as const })),
			currentHp: 30,
			createdAtLevel: 4,
		})
		const before = storage.raw()

		const gains = levelGainsFor(created, 5, CLASSES, RESOLVER)
		const seed = wizardDataFromCharacter(created, lookups)
		const data = {
			...seed,
			classChoice: { className: 'Fighter', classSource: 'XPHB', level: 5 },
			hitPointLevels: [...seed.hitPointLevels, { level: 5, kind: 'roll' as const, dieResult: 9 }],
		}
		saveCharacter(store, data, undefined, { ...levelUpStepConditions(gains), characterLevel: 5, featAsiEligibleLevelCount: 1 }, undefined, created, 5)
		expect(storage.raw()).not.toBe(before)

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

		const gains = levelGainsFor(created, 4, CLASSES, RESOLVER)
		const seed = wizardDataFromCharacter(created, lookups)
		const data = {
			...seed,
			classChoice: { className: 'Fighter', classSource: 'XPHB', level: 4 },
			masteries: [...seed.masteries, 'Rapier'],
			featAsiChoices: [{ level: 4, kind: 'asi' as const, increases: { strength: 2 } }],
			hitPointLevels: [...seed.hitPointLevels, { level: 4, kind: 'roll' as const, dieResult: 7 }],
		}
		saveCharacter(store, data, undefined, { ...levelUpStepConditions(gains), characterLevel: 4, featAsiEligibleLevelCount: 1 }, undefined, created, 4)
		expect(store.list()[0].masteries).toContainEqual({ name: 'Rapier', level: 4 })

		removeTopLevel(store, created.id)
		expect(storage.raw()).toBe(before)
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
		expect(plan({ ...single('Paladin', null, 2, 1), fightingStyle: 'Defense' }, withPaladin).result.fightingStyle).toBeNull()
		expect(plan({ ...single('Fighter', null, 2, 1), fightingStyle: 'Archery' }, withPaladin).result.fightingStyle).toBe('Archery')
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

describe('when a level cannot be removed', () => {
	it('refuses at level 1, at the created-at level, without a created-at level, and for a multiclass character', () => {
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
		expect(levelRemovalTarget(multiclass)).toEqual({ reason: expect.stringContaining('Multiclass') })
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
})

/* Slice 9b3: the same invariant as the block above, one pool over — and D11's two pools clamp separately. */
describe('spent spell slots on a level removal', () => {
	/* Sorcerer's real level 1-5 rows, plus a Warlock carrying Pact Magic's own two columns (1 slot to level 1, 2 from 2). */
	const SLOT_CLASSES = [
		...CLASSES.map((entry) =>
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

	it('refuses a multiclass character on the control', () => {
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
		expect(button.title).toContain('Multiclass')
	})

	it('asks inside the page first, and cancelling hands nothing to the writer', async () => {
		const onRemoveLevel = vi.fn()
		const user = userEvent.setup()
		render(<RemoveLevelButton character={single('Fighter', 'Champion', 5, 4)} onRemoveLevel={onRemoveLevel} loadPlan={fixturePlan} />)

		await user.click(await screen.findByRole('button', { name: 'Remove level 5' }))
		expect(screen.getByRole('alertdialog', { name: 'Remove level 5?' })).not.toBeNull()
		await user.click(screen.getByRole('button', { name: 'Cancel' }))

		expect(onRemoveLevel).not.toHaveBeenCalled()
		expect(screen.getByRole('button', { name: 'Remove level 5' })).not.toBeNull()

		await user.click(screen.getByRole('button', { name: 'Remove level 5' }))
		await user.click(screen.getByRole('button', { name: 'Confirm removing level 5' }))
		expect(onRemoveLevel).toHaveBeenCalledTimes(1)
		expect((onRemoveLevel.mock.calls[0][0] as Character).classes[0].level).toBe(4)
	})
})
