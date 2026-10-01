import { describe, expect, it } from 'vitest'
import type { Character, FeatAsiChoice } from '../storage/character'
import { computeAbilityScores } from '../calculation/abilityScores'
import type { FeatEffectEntry } from '../calculation/featEffects'
import { ABILITIES } from '../abilities/abilityScores'
import type { FeatEntry } from './featAsiData'
import {
	abilityScoresBelowLevel,
	featAsiChoiceProblem,
	featAsiLevelOffers,
	featAsiLevels,
	featAsiStepValid,
	grantedFeatsOf,
	invalidFeatAsiLevels,
	type FeatAsiStepData,
	type FeatAsiStepLoad,
} from './featAsiLevels'

const feats = [
	{ name: 'Fixed Strength', source: 'TEST', category: 'G', ability: [{ str: 1 }] },
	{ name: 'Boon of Might', source: 'TEST', category: 'EB', ability: [{ choose: { from: ['str', 'dex'] }, max: 30 }] },
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
			// The custom ring grants a half-feat through itemFeatGrants; it would add +1 STR if the inventory were not left out.
			inventory: [
				{ name: 'Gauntlets of Ogre Power', source: 'DMG', quantity: 1, attuned: true },
				{ name: 'Ring of Might', source: 'custom', quantity: 1, custom: { name: 'Ring of Might', kind: 'worn', feats: [{ name: 'Athlete', source: 'XPHB', chosenAbility: 'strength' }] } },
			] as unknown as Character['inventory'],
		})
		const withItem = computeAbilityScores(character, feats as unknown as FeatEffectEntry[]).strength
		expect(withItem.status === 'known' && withItem.value.score).toBe(12 + 2 + 1 + 2 + 1)
		expect(abilityScoresBelowLevel(character, feats, 4).strength).toBe(12)
		expect(abilityScoresBelowLevel(character, feats, 6).strength).toBe(14)
		expect(abilityScoresBelowLevel(character, feats, 8).strength).toBe(15)
	})

	it('at a level above every choice equals the scores the sheet shows without items', () => {
		const character = draft(11, {
			abilityBonus: { strength: 1, dexterity: 2 },
			featAsiChoices: [
				{ level: 4, kind: 'asi', increases: { strength: 2 } },
				{ level: 6, kind: 'feat', name: 'Athlete', source: 'XPHB', chosenAbility: 'dexterity' },
				{ level: 8, kind: 'asi', increases: { dexterity: 1, wisdom: 1 } },
			],
			grantedFeats: [{ origin: 'manual', name: 'Fixed Strength', source: 'TEST' }],
		})
		const sheet = computeAbilityScores(character, feats as unknown as FeatEffectEntry[])
		const below = abilityScoresBelowLevel(character, feats, 21)
		for (const ability of ABILITIES) {
			const score = sheet[ability]
			expect(below[ability]).toBe(score.status === 'known' ? score.value.score : undefined)
		}
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

	it('names the manual origin', () => {
		const levels = levelsOf([], 12, grantedFeatsOf(null, [{ name: 'Tough', source: 'XPHB' }], [{ name: 'Alert', source: 'XPHB', itemName: 'Ring' }]))
		expect(featAsiChoiceProblem(levels, { level: 4, kind: 'feat', name: 'Tough', source: 'XPHB' })).toBe('Tough is already taken (Added manually) — choose another feat.')
	})

	it('a clash with an item feat is a warning that does not lock the step', () => {
		const alert: FeatAsiChoice = { level: 4, kind: 'feat', name: 'Alert', source: 'XPHB' }
		const levels = levelsOf([alert], 12, grantedFeatsOf(null, [], [{ name: 'Alert', source: 'XPHB', itemName: 'Ring' }]))
		expect(featAsiChoiceProblem(levels, alert)).toBe('Alert is also granted by Ring — you may keep it or choose another feat.')
		expect(invalidFeatAsiLevels(levels)).toEqual([])
		const unnamed = levelsOf([alert], 12, grantedFeatsOf(null, [], [{ name: 'Alert', source: 'XPHB' }]))
		expect(featAsiChoiceProblem(unnamed, alert)).toBe('Alert is also granted by an item — you may keep it or choose another feat.')
	})

	it('an item never hides a holder the player must fix', () => {
		const alert: FeatAsiChoice = { level: 4, kind: 'feat', name: 'Alert', source: 'XPHB' }
		const itemFirst = grantedFeatsOf({ name: 'Alert', source: 'XPHB' }, [], [{ name: 'Alert', source: 'XPHB', itemName: 'Ring' }])
		expect(featAsiChoiceProblem(levelsOf([alert], 12, itemFirst), alert)).toBe('Alert is already taken (Background) — choose another feat.')
		const lowerLevel = levelsOf(
			[alert, { level: 8, kind: 'feat', name: 'Alert', source: 'XPHB' }],
			12,
			grantedFeatsOf(null, [], [{ name: 'Alert', source: 'XPHB', itemName: 'Ring' }]),
		)
		expect(invalidFeatAsiLevels(lowerLevel)).toEqual([8])
		expect(featAsiChoiceProblem(lowerLevel, lowerLevel.choices[1])).toBe('Alert is already taken (level 4) — choose another feat.')
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

	it('a Dark Gift on the background excludes a different one chosen at a level', () => {
		const levels = levelsOf([{ level: 4, kind: 'feat', name: 'Gift A', source: 'TEST' }], 12, grantedFeatsOf({ name: 'Gift B', source: 'TEST' }, [], []))
		expect(featAsiChoiceProblem(levels, levels.choices[0])).toBe('Gift A no longer meets its prerequisite (already has a Dark Gift) — choose another feat.')
	})
})

describe('F-3: the ability cap on every card', () => {
	const asi = (level: number, ability: 'strength' | 'dexterity'): FeatAsiChoice => ({ level, kind: 'asi', increases: { [ability]: 2 } })

	it('flags a card whose ASI passes 20 once a LOWER card is changed, and locks it only outside a level up', () => {
		// STR 15 + background +1 = 16; 6: +2 -> 18, 8: +2 -> 20, then 4: +2 pushes card 8 to 22.
		const base = { abilityBonus: { strength: 1 } }
		const before = levelsOf([asi(6, 'strength'), asi(8, 'strength')], 15, grantedFeatsOf(null, [], []), base)
		expect(invalidFeatAsiLevels(before)).toEqual([])
		const after = levelsOf([asi(4, 'strength'), asi(6, 'strength'), asi(8, 'strength')], 15, grantedFeatsOf(null, [], []), base)
		expect(invalidFeatAsiLevels(after)).toEqual([8])
		expect(featAsiChoiceProblem(after, after.choices[2])).toBe('+2 STR would take Strength above 20 — choose another ability.')
		expect(featAsiChoiceProblem(after, after.choices[1])).toBeNull()
		expect(invalidFeatAsiLevels(after, [8])).toEqual([])
		expect(featAsiChoiceProblem(after, after.choices[2])).not.toBeNull()
	})

	it('flags a half-feat bonus and a fixed feat bonus above 20', () => {
		const athlete = (chosenAbility: 'strength' | 'dexterity'): FeatAsiChoice => ({ level: 8, kind: 'feat', name: 'Athlete', source: 'XPHB', chosenAbility })
		const full = levelsOf([athlete('strength')], 20)
		expect(featAsiChoiceProblem(full, full.choices[0])).toBe('+1 STR would take Strength above 20 — choose another ability.')
		expect(featAsiChoiceProblem(levelsOf([athlete('dexterity')], 20), athlete('dexterity'))).toBeNull()
		const fixed = levelsOf([{ level: 8, kind: 'feat', name: 'Fixed Strength', source: 'TEST' }], 20)
		expect(featAsiChoiceProblem(fixed, fixed.choices[0])).toBe('+1 STR would take Strength above 20 — choose another ability.')
		expect(featAsiChoiceProblem(levelsOf([{ level: 8, kind: 'feat', name: 'Fixed Strength', source: 'TEST' }], 19), { level: 8, kind: 'feat', name: 'Fixed Strength', source: 'TEST' })).toBeNull()
	})

	it('an Epic Boon goes up to the feat’s own max of 30', () => {
		const boon = (strength: number): ReturnType<typeof levelsOf> => levelsOf([{ level: 8, kind: 'feat', name: 'Boon of Might', source: 'TEST', chosenAbility: 'strength' }], strength)
		expect(featAsiChoiceProblem(boon(29), boon(29).choices[0])).toBeNull()
		expect(featAsiChoiceProblem(boon(30), boon(30).choices[0])).toBe('+1 STR would take Strength above 30 — choose another ability.')
	})

	it('a choice not yet complete adds nothing', () => {
		const levels = levelsOf([{ level: 4, kind: 'asi', increases: {} }, { level: 6, kind: 'feat', name: 'Athlete', source: 'XPHB' }], 20)
		expect(invalidFeatAsiLevels(levels)).toEqual([])
	})
})

describe('F-3: the Next gate', () => {
	const choices: FeatAsiChoice[] = [{ level: 4, kind: 'feat', name: 'Tough', source: 'XPHB' }]
	const granted = grantedFeatsOf({ name: 'Tough', source: 'XPHB' }, [], [])
	const gate = (load: FeatAsiStepLoad, held?: number[]) => featAsiStepValid(load, choices, granted, draft(12), held)

	it('stays shut while loading and opens after a failed load', () => {
		expect(gate({ status: 'loading' })).toBe(false)
		expect(gate({ status: 'error', message: 'offline' })).toBe(true)
	})

	it('follows the choices once loaded, except at a level a level up cannot change', () => {
		expect(gate({ status: 'ready', data })).toBe(false)
		expect(gate({ status: 'ready', data }, [4])).toBe(true)
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
