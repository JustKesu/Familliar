// @vitest-environment jsdom
import { readFileSync } from 'fs'
import { join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { levelGainsFor, type LevelUpClass } from './levelGains'
import { CLASSES, RESOLVER } from './levelGains.fixtures'
import { LevelUpButton } from './LevelUpButton'
import { levelUpTarget } from './levelUpSteps'
import { checkOneClassRaised } from './multiclassLevelUp'
import { saveCharacter, wizardDataFromCharacter, type WizardStep } from '../creation/wizardState'
import { loadFeatAsiStepData } from '../featAsi/featAsiLevels'
import { evaluateFeatPrerequisites } from '../featAsi/featAsiData'
import { masteryWeaponsFor } from '../masteries/masteryData'
import type { Character, CharacterClass, FeatAsiChoice } from '../storage/character'
import type { CharacterStore } from '../storage/characterStore'

/* M7a (D329): Level up of one existing class of a multiclass character. */

vi.mock('../dataLoader/dataLoader', () => ({
	loadDataFile: vi.fn(async (path: string) => {
		const fs = await import('fs')
		const nodePath = await import('path')
		return JSON.parse(fs.readFileSync(nodePath.join(__dirname, '..', '..', path), 'utf8'))
	}),
}))

afterEach(cleanup)

const XPHB = 'XPHB'
const order = (entries: [string, number][]) => entries.flatMap(([className, count]) => Array.from({ length: count }, () => ({ className, classSource: XPHB })))
const cls = (className: string, level: number, subclass: string | null = null): CharacterClass => ({ className, classSource: XPHB, subclass, level })

function warlockSorcerer(): Character {
	return {
		id: 'ws',
		name: 'Aria',
		classes: [cls('Warlock', 6, 'Fiend Patron'), cls('Sorcerer', 3, 'Wild Magic Sorcery')],
		levelOrder: order([
			['Warlock', 6],
			['Sorcerer', 3],
		]),
		spellChoices: [
			{ className: 'Warlock', classSource: XPHB, spells: [{ name: 'Eldritch Blast', source: XPHB }, { name: 'Hex', source: XPHB }] },
			{ className: 'Sorcerer', classSource: XPHB, spells: [{ name: 'Fire Bolt', source: XPHB }, { name: 'Shield', source: XPHB }] },
		],
		fightingStyles: [{ className: 'Warlock', classSource: XPHB, name: 'Defense', source: XPHB }],
		optionalFeatureChoices: [
			{ featureType: 'EI', choices: [{ name: 'Agonizing Blast', source: XPHB }, { name: 'Repelling Blast', source: XPHB, level: 6 }] },
			{ featureType: 'MM', choices: [{ name: 'Careful Spell', source: XPHB, level: 8 }] },
		],
		classFeatureChoices: [{ className: 'Warlock', classSource: XPHB, featureName: 'Test Choice', grantedAtLevel: 1, optionName: 'Option A' }],
		featAsiChoices: [{ level: 4, kind: 'asi', increases: { charisma: 2 } }],
		hitPointLevels: [{ level: 2, kind: 'average', dieResult: 5 }],
	}
}

const SPELL_LEVELS = [
	{ name: 'Eldritch Blast', source: XPHB, level: 0 },
	{ name: 'Hex', source: XPHB, level: 1 },
	{ name: 'Fire Bolt', source: XPHB, level: 0 },
	{ name: 'Shield', source: XPHB, level: 1 },
	{ name: 'Magic Missile', source: XPHB, level: 1 },
]

function store(): CharacterStore {
	return { create: vi.fn(), update: vi.fn((id: string) => ({ id, name: 'Aria', classes: [] })) } as unknown as CharacterStore
}

const walked = (steps: WizardStep[]) => ({ levelUpSteps: new Set<WizardStep>(steps), levelUpTargetLevel: 10, characterLevel: 10, hitDieFaces: 6, featAsiEligibleLevelCount: 2 })

function sorcererLevelUp(character: Character, classLevel = 4) {
	const seed = wizardDataFromCharacter(character, { subclasses: [], spellLevels: SPELL_LEVELS, activeClass: { className: 'Sorcerer', classSource: XPHB, featureTypes: ['MM'] } })
	return {
		...seed,
		classChoice: { className: 'Sorcerer', classSource: XPHB, level: classLevel },
		spellChoices: [...seed.spellChoices, { name: 'Magic Missile', source: XPHB, level: 1 }],
		featAsiChoices: [...seed.featAsiChoices, { level: 10, kind: 'asi', increases: { dexterity: 2 } }] as FeatAsiChoice[],
		hitPointLevels: [...seed.hitPointLevels, { level: 10, kind: 'average' as const, dieResult: 4 }],
	}
}

describe('wizardDataFromCharacter for a multiclass level up', () => {
	it('seeds the per-class fields from the raised class only', () => {
		const seed = wizardDataFromCharacter(warlockSorcerer(), { subclasses: [], spellLevels: SPELL_LEVELS, activeClass: { className: 'Sorcerer', classSource: XPHB, featureTypes: ['MM'] } })
		expect(seed.classChoice).toEqual({ className: 'Sorcerer', classSource: XPHB, level: 3 })
		expect(seed.subclass?.name).toBe('Wild Magic Sorcery')
		expect(seed.spellChoices.map((pick) => pick.name)).toEqual(['Fire Bolt', 'Shield'])
		expect(seed.classOptionalFeatureChoices.map((entry) => entry.featureType)).toEqual(['MM'])
		expect(seed.fightingStyle).toBeNull()
		expect(seed.classFeatureChoices).toEqual([])
		// Character-axis picks stay whole.
		expect(seed.featAsiChoices).toHaveLength(1)
	})
})

describe('saveCharacter for a multiclass level up', () => {
	it('raises Sorcerer 3 → 4 in Warlock 6 / Sorcerer 3, appends Sorcerer to levelOrder and keeps every Warlock record byte-identical', () => {
		const character = warlockSorcerer()
		const characterStore = store()
		saveCharacter(characterStore, sorcererLevelUp(character), undefined, walked(['spells', 'featAsi', 'hitPoints', 'review']), undefined, character, 10)

		const input = vi.mocked(characterStore.update).mock.calls[0][1]
		expect(input.classes).toEqual([cls('Warlock', 6, 'Fiend Patron'), cls('Sorcerer', 4, 'Wild Magic Sorcery')])
		expect(input.levelOrder).toEqual([...character.levelOrder!, { className: 'Sorcerer', classSource: XPHB }])
		const ofWarlock = <T extends { className?: string }>(list: readonly T[] | undefined) => JSON.stringify(list?.filter((entry) => entry.className === 'Warlock'))
		expect(ofWarlock(input.spellChoices)).toBe(ofWarlock(character.spellChoices))
		expect(ofWarlock(input.fightingStyles)).toBe(ofWarlock(character.fightingStyles))
		expect(ofWarlock(input.classFeatureChoices)).toBe(ofWarlock(character.classFeatureChoices))
		expect(JSON.stringify(input.optionalFeatureChoices?.find((entry) => entry.featureType === 'EI'))).toBe(JSON.stringify(character.optionalFeatureChoices![0]))
		expect(input.optionalFeatureChoices?.find((entry) => entry.featureType === 'MM')).toEqual(character.optionalFeatureChoices![1])
		expect(input.spellChoices?.find((entry) => entry.className === 'Sorcerer')?.spells.map((spell) => spell.name)).toEqual(['Fire Bolt', 'Shield', 'Magic Missile'])
		expect(input.featAsiChoices).toEqual([...character.featAsiChoices!, { level: 10, kind: 'asi', increases: { dexterity: 2 } }])
	})

	it('refuses a walk that raises the class by two', () => {
		const character = warlockSorcerer()
		const characterStore = store()
		expect(() => saveCharacter(characterStore, sorcererLevelUp(character, 5), undefined, walked(['hitPoints', 'review']), undefined, character, 10)).toThrow(/exactly one level/)
		expect(characterStore.update).not.toHaveBeenCalled()
	})
})

describe('checkOneClassRaised', () => {
	const before = [cls('Warlock', 6), cls('Sorcerer', 3)]

	it('accepts exactly one class raised by one', () => {
		expect(() => checkOneClassRaised(before, [cls('Warlock', 6), cls('Sorcerer', 4)], 10)).not.toThrow()
	})

	it('throws when two classes change', () => {
		expect(() => checkOneClassRaised(before, [cls('Warlock', 7), cls('Sorcerer', 4)], 11)).toThrow(/exactly one level/)
	})

	it('throws when a class changes by two', () => {
		expect(() => checkOneClassRaised(before, [cls('Warlock', 6), cls('Sorcerer', 5)], 11)).toThrow(/exactly one level/)
	})

	it('throws when the classes are reordered or another class changes its subclass', () => {
		expect(() => checkOneClassRaised(before, [cls('Sorcerer', 4), cls('Warlock', 6)], 10)).toThrow()
		expect(() => checkOneClassRaised(before, [cls('Warlock', 6, 'Fiend Patron'), cls('Sorcerer', 4)], 10)).toThrow()
	})
})

describe('levelUpTarget (D329)', () => {
	it('needs the class for a multiclass character and refuses one it does not have', () => {
		const character = warlockSorcerer()
		expect(levelUpTarget(character)).toEqual({ reason: 'Choose which class gains the level.' })
		expect(levelUpTarget(character, { className: 'Sorcerer', classSource: XPHB })).toEqual({ level: 10, className: 'Sorcerer', classSource: XPHB })
		expect(levelUpTarget(character, { className: 'Bard', classSource: XPHB })).toHaveProperty('reason')
	})

	it('refuses a multiclass character whose level history does not match its classes', () => {
		const character = { ...warlockSorcerer(), levelOrder: order([['Warlock', 9]]) }
		expect(levelUpTarget(character, { className: 'Sorcerer', classSource: XPHB })).toEqual({ reason: 'Cannot tell which class each level came from (no level history).' })
	})

	it('keeps a single class working without a class in the route', () => {
		const fighter: Character = { id: 'f', name: 'F', classes: [cls('Fighter', 4)] }
		expect(levelUpTarget(fighter)).toEqual({ level: 5, className: 'Fighter', classSource: XPHB })
	})
})

describe('LevelUpButton for a multiclass character', () => {
	const fixtureGains = async (character: Character, target: LevelUpClass) => levelGainsFor(character, target, CLASSES, RESOLVER)

	it('opens the class window with one button per class, Cancel closes it without a level up', async () => {
		const onLevelUp = vi.fn()
		const user = userEvent.setup()
		render(<LevelUpButton character={warlockSorcerer()} onLevelUp={onLevelUp} loadGains={fixtureGains} />)

		await user.click(await screen.findByRole('button', { name: 'Level up to 10' }))
		const dialog = screen.getByRole('dialog', { name: 'Level up which class?' })
		expect([...dialog.querySelectorAll('.level-up-class__option')].map((button) => button.textContent)).toEqual(['Warlock 6 → 7', 'Sorcerer 3 → 4'])
		expect(document.activeElement?.textContent).toBe('Warlock 6 → 7')

		await user.click(screen.getByRole('button', { name: 'Cancel' }))
		expect(screen.queryByRole('dialog')).toBeNull()
		expect(onLevelUp).not.toHaveBeenCalled()
		expect(document.activeElement?.textContent).toContain('Level up to 10')
	})

	it('hands the chosen class’s gains to the walk', async () => {
		const onLevelUp = vi.fn()
		const user = userEvent.setup()
		render(<LevelUpButton character={warlockSorcerer()} onLevelUp={onLevelUp} loadGains={fixtureGains} />)

		await user.click(await screen.findByRole('button', { name: 'Level up to 10' }))
		await user.click(screen.getByRole('button', { name: 'Sorcerer 3 → 4' }))
		expect(onLevelUp).toHaveBeenCalledWith(expect.objectContaining({ level: 10, classLevel: 4, className: 'Sorcerer', unresolved: null }))
	})
})

describe('review M2-M4 finding 2: the feat step and the mastery pool read every class (classProficiencyGrants)', () => {
	const wizardFighter = { classes: [cls('Wizard', 4), cls('Fighter', 1)], levelOrder: order([['Wizard', 3], ['Fighter', 1], ['Wizard', 1]]) }

	it('Wizard 3 / Fighter 1 levelling Wizard to 4: medium armor in the context, Heavily Armored allowed, the ASI card at character level 5', async () => {
		const data = await loadFeatAsiStepData('Wizard', XPHB, 4, null, null, null, wizardFighter)
		expect(data.ctx.armorProficiencies).toContain('medium')
		expect(data.grants).toEqual([{ level: 5, kind: 'asi' }])
		const heavilyArmored = data.feats.find((feat) => feat.name === 'Heavily Armored' && feat.source === XPHB)!
		const scores = { strength: 15, dexterity: 15, constitution: 15, intelligence: 15, wisdom: 15, charisma: 15 }
		expect(evaluateFeatPrerequisites(heavilyArmored, { ...data.ctx, characterLevel: 5, abilityScores: scores, chosenFeats: [] }).eligible).toBe(true)
	})

	it('a single Wizard 4 keeps its own context (no medium armor)', async () => {
		const data = await loadFeatAsiStepData('Wizard', XPHB, 4, null, null, null)
		expect(data.ctx.armorProficiencies).not.toContain('medium')
		expect(data.grants).toEqual([{ level: 4, kind: 'asi' }])
	})

	it('a Rogue with a Fighter level gets martial weapons in the mastery pool', () => {
		const classes: unknown = JSON.parse(readFileSync(join(__dirname, '..', '..', 'data', 'classes.json'), 'utf8'))
		const items = [
			{ name: 'Dagger', source: XPHB, rarity: 'none', weaponCategory: 'simple', propertyFull: ['Finesse', 'Light', 'Thrown'], masteryFull: ['Nick'] },
			{ name: 'Greataxe', source: XPHB, rarity: 'none', weaponCategory: 'martial', propertyFull: ['Heavy', 'Two-Handed'], masteryFull: ['Cleave'] },
		]
		const rogueFighter = { classes: [cls('Rogue', 3), cls('Fighter', 1)], levelOrder: order([['Rogue', 3], ['Fighter', 1]]) }
		expect(masteryWeaponsFor(items, classes, 'Rogue', XPHB).map((weapon) => weapon.name)).toEqual(['Dagger'])
		expect(masteryWeaponsFor(items, classes, 'Rogue', XPHB, [], [], rogueFighter).map((weapon) => weapon.name)).toEqual(['Dagger', 'Greataxe'])
	})
})
