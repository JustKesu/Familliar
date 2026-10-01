import { describe, expect, it } from 'vitest'
import type { Character, FeatAsiChoice } from '../storage/character'
import type { FeatEntry } from './featAsiData'
import { abilityScoresBelowLevel, featAsiChoiceProblem, featAsiLevelOffers, featAsiLevels, grantedFeatsOf, invalidFeatAsiLevels, type FeatAsiStepData } from './featAsiLevels'

const feats = [
	{ name: 'Tough', source: 'XPHB', category: 'O' },
	{ name: 'Alert', source: 'XPHB', category: 'O' },
	{ name: 'Alert', source: 'PHB', category: 'G' },
	{ name: 'Skilled', source: 'XPHB', category: 'O', repeatable: true },
	{ name: 'Athlete', source: 'XPHB', category: 'G', ability: [{ choose: { from: ['str', 'dex'] } }] },
	{ name: 'Great Weapon Master', source: 'XPHB', category: 'G', prerequisite: [{ level: 4, ability: [{ str: 13 }] }] },
	{ name: 'Late Boon', source: 'TEST', category: 'EB', prerequisite: [{ level: 8 }] },
	{ name: 'Gift A', source: 'TEST', category: 'DG', prerequisite: [{ exclusiveFeatCategory: ['DG'] }] },
	{ name: 'Gift B', source: 'TEST', category: 'DG', prerequisite: [{ exclusiveFeatCategory: ['DG'] }] },
] as unknown as FeatEntry[]

const data: FeatAsiStepData = {
	grants: [4, 6, 8].map((level) => ({ level, kind: 'asi' as const })),
	feats,
	featsRequiringAbilityChoice: new Set(['Athlete|XPHB']),
	ctx: { hasFightingStyleFeature: false, hasSpellcasting: false, armorProficiencies: [], weaponProficiencies: [], speciesName: null, speciesRaceTags: [], speciesSize: null },
}

function draft(strength: number, extra: Partial<Character> = {}): Character {
	return { id: '', name: '', classes: [], abilityScores: { method: 'standardArray', scores: { strength, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 } }, ...extra }
}

const levelsOf = (choices: FeatAsiChoice[], strength = 12, granted = grantedFeatsOf(null, [], []), base: Partial<Character> = {}) => featAsiLevels(data, choices, granted, draft(strength, base))

describe('D253: ability scores below a card', () => {
	it('adds lower-level ASIs and half-feats, never the card itself or higher, and never items', () => {
		const character = draft(11, {
			abilityBonus: { strength: 1 },
			featAsiChoices: [
				{ level: 4, kind: 'asi', increases: { strength: 2 } },
				{ level: 6, kind: 'feat', name: 'Athlete', source: 'XPHB', chosenAbility: 'strength' },
				{ level: 8, kind: 'asi', increases: { strength: 2 } },
			],
			inventory: [{ name: 'Gauntlets of Ogre Power', source: 'DMG', quantity: 1, attuned: true }] as unknown as Character['inventory'],
		})
		expect(abilityScoresBelowLevel(character, feats, 4).strength).toBe(12)
		expect(abilityScoresBelowLevel(character, feats, 6).strength).toBe(14)
		expect(abilityScoresBelowLevel(character, feats, 8).strength).toBe(15)
	})

	it('counts the background origin feat and manual feats, whatever the level', () => {
		const character = draft(12, { grantedFeats: [{ origin: 'manual', name: 'Athlete', source: 'XPHB', chosenAbility: 'strength' }] })
		expect(abilityScoresBelowLevel(character, feats, 4).strength).toBe(13)

		const background = draft(12, {
			background: { name: 'Farmhand', source: 'TEST', skillProficiencies: ['nature', 'survival'], toolProficiency: "Carpenter's Tools" },
			grantedFeats: [{ origin: 'background', name: 'Athlete', source: 'XPHB', chosenAbility: 'strength' }],
		})
		expect(featAsiLevels(data, [], grantedFeatsOf({ name: 'Athlete', source: 'XPHB' }, [], []), background).scoresBelow(4).strength).toBe(13)
	})
})

describe('D254: a chosen feat that is no longer valid', () => {
	it('is flagged as taken by the background, and only the higher of two levels holding it', () => {
		expect(featAsiChoiceProblem(levelsOf([], 12, grantedFeatsOf({ name: 'Tough', source: 'XPHB' }, [], [])), { level: 4, kind: 'feat', name: 'Tough', source: 'XPHB' })).toBe(
			'Tough is already taken (Background) — choose another feat.',
		)
		const twice = levelsOf([
			{ level: 4, kind: 'feat', name: 'Tough', source: 'XPHB' },
			{ level: 6, kind: 'asi', increases: { dexterity: 2 } },
			{ level: 8, kind: 'feat', name: 'Tough', source: 'XPHB' },
		])
		expect(invalidFeatAsiLevels(twice)).toEqual([8])
		expect(featAsiChoiceProblem(twice, twice.choices[2])).toBe('Tough is already taken (level 4) — choose another feat.')
		expect(invalidFeatAsiLevels(twice, [8])).toEqual([])
	})

	it('names the manual and item origins', () => {
		const levels = levelsOf([], 12, grantedFeatsOf(null, [{ name: 'Tough', source: 'XPHB' }], [{ name: 'Alert', source: 'XPHB', itemName: 'Ring' }]))
		expect(featAsiChoiceProblem(levels, { level: 4, kind: 'feat', name: 'Tough', source: 'XPHB' })).toBe('Tough is already taken (Added manually) — choose another feat.')
		expect(featAsiChoiceProblem(levels, { level: 4, kind: 'feat', name: 'Alert', source: 'XPHB' })).toBe('Alert is already taken (From item (Ring)) — choose another feat.')
	})

	it('a repeatable feat is never taken', () => {
		const levels = levelsOf([
			{ level: 4, kind: 'feat', name: 'Skilled', source: 'XPHB' },
			{ level: 6, kind: 'feat', name: 'Skilled', source: 'XPHB' },
		])
		expect(invalidFeatAsiLevels(levels)).toEqual([])
	})

	it('a prerequisite met only through a lower level breaks when that level changes', () => {
		const athlete: FeatAsiChoice = { level: 4, kind: 'feat', name: 'Athlete', source: 'XPHB', chosenAbility: 'strength' }
		const gwm: FeatAsiChoice = { level: 8, kind: 'feat', name: 'Great Weapon Master', source: 'XPHB' }
		const met = levelsOf([athlete, { level: 6, kind: 'asi', increases: { dexterity: 2 } }, gwm])
		expect(featAsiLevelOffers(met, 8).find((offer) => offer.feat.name === 'Great Weapon Master')?.result.eligible).toBe(true)
		expect(featAsiLevelOffers(met, 4).find((offer) => offer.feat.name === 'Great Weapon Master')?.result.eligible).toBe(false)
		expect(invalidFeatAsiLevels(met)).toEqual([])

		const broken = levelsOf([{ ...athlete, chosenAbility: 'dexterity' }, { level: 6, kind: 'asi', increases: { dexterity: 2 } }, gwm])
		expect(featAsiChoiceProblem(broken, gwm)).toBe('Great Weapon Master no longer meets its prerequisite (needs STR 13) — choose another feat.')
	})

	it('an exclusive category conflict flags only the higher Dark Gift', () => {
		const levels = levelsOf([
			{ level: 4, kind: 'feat', name: 'Gift B', source: 'TEST' },
			{ level: 6, kind: 'asi', increases: { dexterity: 2 } },
			{ level: 8, kind: 'feat', name: 'Gift A', source: 'TEST' },
		])
		expect(invalidFeatAsiLevels(levels)).toEqual([8])
		expect(featAsiChoiceProblem(levels, levels.choices[2])).toBe('Gift A no longer meets its prerequisite (already has a Dark Gift) — choose another feat.')
	})
})

describe('D257: a level prerequisite reads the card level', () => {
	it('offers a level-8 feat on the level 8 card only, and flags it on a lower card', () => {
		const levels = levelsOf([{ level: 4, kind: 'feat', name: 'Late Boon', source: 'TEST' }])
		const eligibleAt = (level: number) => featAsiLevelOffers(levels, level).find((offer) => offer.feat.name === 'Late Boon')?.result.eligible
		expect(eligibleAt(4)).toBe(false)
		expect(eligibleAt(8)).toBe(true)
		expect(featAsiChoiceProblem(levels, levels.choices[0])).toBe('Late Boon no longer meets its prerequisite (needs character level 8) — choose another feat.')
		expect(featAsiChoiceProblem(levelsOf([{ level: 8, kind: 'feat', name: 'Late Boon', source: 'TEST' }]), { level: 8, kind: 'feat', name: 'Late Boon', source: 'TEST' })).toBeNull()
	})
})

describe('D255: the same feat name from two books', () => {
	it('is taken once either book is held', () => {
		const levels = levelsOf([], 12, grantedFeatsOf({ name: 'Alert', source: 'XPHB' }, [], []))
		expect(featAsiLevelOffers(levels, 4).filter((offer) => offer.feat.name === 'Alert').map((offer) => offer.held)).toEqual([true, true])
		expect(featAsiChoiceProblem(levels, { level: 4, kind: 'feat', name: 'Alert', source: 'PHB' })).toBe('Alert is already taken (Background) — choose another feat.')
	})
})
