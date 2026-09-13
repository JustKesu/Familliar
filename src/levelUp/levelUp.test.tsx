// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { levelGainsFor, type LevelGains } from './levelGains'
import { CLASSES, RESOLVER } from './levelGains.fixtures'
import { levelUpStepConditions, unknownLevelUpSteps } from './levelUpSteps'
import { overwrittenHeldPicks } from './heldPicks'
import { LevelUpButton } from './LevelUpButton'
import { isStepComplete, saveCharacter, visibleSteps, wizardDataFromCharacter } from '../creation/wizardState'
import type { Character } from '../storage/character'
import type { CharacterStore } from '../storage/characterStore'

/* Build order step 8, slice 8d3: the Level up button and the walk it opens. */

afterEach(cleanup)

function single(className: string, subclass: string | null, level: number): Character {
	return { id: 'c1', name: 'Aria', classes: [{ className, classSource: 'XPHB', subclass, level }] }
}

function walkedSteps(character: Character): readonly string[] {
	const gains = levelGainsFor(character, character.classes[0].level + 1, CLASSES, RESOLVER)
	return visibleSteps({ ...levelUpStepConditions(gains), characterLevel: gains.level })
}

async function fixtureGains(character: Character, level: number): Promise<LevelGains> {
	return levelGainsFor(character, level, CLASSES, RESOLVER)
}

describe('which steps a level up walks', () => {
	it('walks the feat/ASI step for a Fighter going from 3 to 4', () => {
		expect(walkedSteps(single('Fighter', 'Champion', 3))).toEqual(['class', 'featAsi', 'hitPoints', 'review'])
	})

	it('walks only hit points and review for a Fighter going from 4 to 5, and lists Extra Attack as granted', () => {
		const fighter = single('Fighter', 'Champion', 4)
		expect(walkedSteps(fighter)).toEqual(['hitPoints', 'review'])
		expect(levelGainsFor(fighter, 5, CLASSES, RESOLVER).newFeatures.map((feature) => feature.name)).toEqual(['Extra Attack'])
	})

	it('walks the class step for a character reaching its subclass level', () => {
		expect(walkedSteps(single('Cleric', null, 2))).toContain('class')
	})

	it('walks an unknown step rather than hiding it, with the reason the app cannot answer', () => {
		const gains = levelGainsFor(single('Fighter', 'Psi Warrior', 4), 5, CLASSES, RESOLVER)
		const steps = visibleSteps(levelUpStepConditions(gains))
		expect(steps).toContain('class')
		expect(steps).toContain('spells')
		expect(unknownLevelUpSteps(gains).class).toContain('Psi Warrior')
	})
})

describe('LevelUpButton', () => {
	it('offers no usable button at level 20 and says why, without asking the data', () => {
		const loadGains = vi.fn(fixtureGains)
		render(<LevelUpButton character={single('Fighter', 'Champion', 20)} onLevelUp={() => {}} loadGains={loadGains} />)

		const button = screen.getByRole('button', { name: /level up/i })
		expect((button as HTMLButtonElement).disabled).toBe(true)
		expect(button.textContent).toContain('Level 20 is the highest character level')
		expect(loadGains).not.toHaveBeenCalled()
	})

	it('offers no usable button for a multiclass character and says why', async () => {
		const multiclass: Character = {
			id: 'c2',
			name: 'Bree',
			classes: [
				{ className: 'Fighter', classSource: 'XPHB', subclass: 'Champion', level: 3 },
				{ className: 'Rogue', classSource: 'XPHB', subclass: 'Thief', level: 2 },
			],
		}
		render(<LevelUpButton character={multiclass} onLevelUp={() => {}} loadGains={fixtureGains} />)

		const button = await screen.findByRole('button', { name: /multiclass/i })
		expect((button as HTMLButtonElement).disabled).toBe(true)
	})

	it('hands the next level’s gains to the walk when clicked', async () => {
		const onLevelUp = vi.fn()
		render(<LevelUpButton character={single('Fighter', 'Champion', 4)} onLevelUp={onLevelUp} loadGains={fixtureGains} />)

		await userEvent.setup().click(await screen.findByRole('button', { name: 'Level up to 5' }))
		expect(onLevelUp).toHaveBeenCalledWith(expect.objectContaining({ level: 5, unresolved: null }))
	})
})

describe('the hit points step during a level up', () => {
	/* Build order step 8, slice 8d5: a level-up walk asks about only the new level, leaving older levels without a stored entry on their D92 defaults. */
	it('completes once the single new-level entry is recorded, for a character with no stored hit point history', () => {
		const character = single('Fighter', 'Champion', 9)
		const gains = levelGainsFor(character, 10, CLASSES, RESOLVER)
		const conditions = { ...levelUpStepConditions(gains), characterLevel: 10 }
		expect(conditions.levelUpTargetLevel).toBe(10)

		const seed = wizardDataFromCharacter(character, { subclasses: [], spellLevels: [] })
		expect(isStepComplete('hitPoints', seed, conditions)).toBe(false)

		const withNewLevel = { ...seed, hitPointLevels: [...seed.hitPointLevels, { level: 10, kind: 'average' as const, dieResult: 6 }] }
		expect(isStepComplete('hitPoints', withNewLevel, conditions)).toBe(true)
	})
})

describe('saving a level up', () => {
	function store(): CharacterStore {
		return {
			create: vi.fn(),
			update: vi.fn((id: string) => ({ id, name: 'Aria', classes: [] })),
		} as unknown as CharacterStore
	}

	/** A level-3 Fighter whose creation-time picks carry no level. */
	function storedFighter(): Character {
		return {
			...single('Fighter', 'Champion', 3),
			classSkills: ['athletics', 'perception'],
			masteries: [{ name: 'Longsword' }, { name: 'Greataxe' }, { name: 'Shortbow' }],
			expertiseSkills: [],
			optionalFeatureChoices: [{ featureType: 'EI', choices: [{ name: 'Agonizing Blast' }] }],
			hitPointLevels: [
				{ level: 2, kind: 'average', dieResult: 6 },
				{ level: 3, kind: 'average', dieResult: 6 },
			],
		}
	}

	const lookups = { subclasses: [{ name: 'Champion', source: 'XPHB', featureType: null }], spellLevels: [] }

	function levelledData(character: Character) {
		const seed = wizardDataFromCharacter(character, lookups)
		return {
			...seed,
			classChoice: { className: 'Fighter', classSource: 'XPHB', level: 4 },
			masteries: [...seed.masteries, 'Rapier'],
			classOptionalFeatureChoices: [{ featureType: 'EI', choices: [{ name: 'Agonizing Blast' }, { name: 'Repelling Blast' }] }],
			featAsiChoices: [{ level: 4, kind: 'asi' as const, increases: { strength: 2 } }],
			hitPointLevels: [...seed.hitPointLevels, { level: 4, kind: 'roll' as const, dieResult: 7 }],
		}
	}

	function conditions(character: Character) {
		return { ...levelUpStepConditions(levelGainsFor(character, 4, CLASSES, RESOLVER)), featAsiEligibleLevelCount: 1, characterLevel: 4 }
	}

	it('writes the new level once, and every pick made during the walk carries that level', () => {
		const characterStore = store()
		const character = storedFighter()

		saveCharacter(characterStore, levelledData(character), undefined, conditions(character), undefined, character, 4)

		expect(characterStore.update).toHaveBeenCalledTimes(1)
		const input = vi.mocked(characterStore.update).mock.calls[0][1]
		expect(input.classes).toEqual([{ className: 'Fighter', classSource: 'XPHB', subclass: 'Champion', level: 4 }])
		// Creation-time picks keep carrying no level; 8e tells the two apart by exactly that.
		expect(input.masteries).toEqual([{ name: 'Longsword' }, { name: 'Greataxe' }, { name: 'Shortbow' }, { name: 'Rapier', level: 4 }])
		expect(input.optionalFeatureChoices).toEqual([
			{ featureType: 'EI', choices: [{ name: 'Agonizing Blast' }, { name: 'Repelling Blast', level: 4 }] },
		])
		expect(input.hitPointLevels).toContainEqual({ level: 4, kind: 'roll', dieResult: 7 })
	})

	it('refuses a walk that does not raise the character by exactly one level', () => {
		const characterStore = store()
		const character = storedFighter()
		const levelled = levelledData(character)
		const data = {
			...levelled,
			classChoice: { className: 'Fighter', classSource: 'XPHB', level: 5 },
			hitPointLevels: [...levelled.hitPointLevels, { level: 5, kind: 'average' as const, dieResult: 6 }],
		}

		expect(() =>
			saveCharacter(characterStore, data, undefined, { ...conditions(character), characterLevel: 5 }, undefined, character, 4),
		).toThrow(/exactly one level/)
		expect(characterStore.update).not.toHaveBeenCalled()
	})

	/* D108: a level that grants no subclass or fighting style (Fighter 4) must not let a walk overwrite either, nor drop any other earlier pick. */
	describe('refuses a walk that changes a pick made at an earlier level', () => {
		function heldFighter(): Character {
			return { ...storedFighter(), fightingStyle: 'Defense', expertiseSkills: [{ name: 'athletics' }] }
		}

		const overwrites: [string, (data: ReturnType<typeof levelledData>) => ReturnType<typeof levelledData>][] = [
			['the subclass', (data) => ({ ...data, subclass: { name: 'Battle Master', source: 'XPHB', featureType: 'MV:B' } })],
			['the fighting style', (data) => ({ ...data, fightingStyle: 'Archery' })],
			['a class skill', (data) => ({ ...data, classSkills: ['athletics', 'intimidation'] })],
			['a weapon mastery', (data) => ({ ...data, masteries: ['Longsword', 'Greataxe', 'Rapier'] })],
			['an expertise', (data) => ({ ...data, expertiseSkills: ['perception'] })],
		]

		it.each(overwrites)('%s', (_label, change) => {
			const characterStore = store()
			const character = heldFighter()

			expect(() =>
				saveCharacter(characterStore, change(levelledData(character)), undefined, conditions(character), undefined, character, 4),
			).toThrow(/cannot change one made at an earlier level/)
			expect(characterStore.update).not.toHaveBeenCalled()
		})

		it('a subclass optional-feature pick or a class feature choice', () => {
			const character: Character = {
				...single('Fighter', 'Battle Master', 3),
				optionalFeatureChoices: [{ featureType: 'MV:B', choices: [{ name: 'Trip Attack' }, { name: 'Riposte' }] }],
				classFeatureChoices: [{ className: 'Fighter', classSource: 'XPHB', featureName: 'Test Order', grantedAtLevel: 1, optionName: 'First' }],
			}
			const seed = wizardDataFromCharacter(character, { subclasses: [{ name: 'Battle Master', source: 'XPHB', featureType: 'MV:B' }], spellLevels: [] })
			const data = { ...seed, classChoice: { className: 'Fighter', classSource: 'XPHB', level: 4 } }

			expect(overwrittenHeldPicks(character, data)).toEqual([])
			expect(overwrittenHeldPicks(character, { ...data, optionalFeatureChoices: ['Trip Attack', 'Parry'] })).toEqual(['option Riposte'])
			expect(
				overwrittenHeldPicks(character, { ...data, classFeatureChoices: [{ ...character.classFeatureChoices![0], optionName: 'Second' }] }),
			).toEqual(['Test Order First'])
		})

		it('still saves a walk that only adds to what the character had', () => {
			const characterStore = store()
			const character = heldFighter()
			const data = levelledData(character)

			saveCharacter(characterStore, { ...data, expertiseSkills: ['athletics', 'perception'] }, undefined, conditions(character), undefined, character, 4)
			expect(characterStore.update).toHaveBeenCalledTimes(1)
		})
	})
})
