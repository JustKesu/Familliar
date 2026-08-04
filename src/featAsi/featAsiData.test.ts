import { describe, expect, it } from 'vitest'
import {
	evaluateFeatPrerequisites,
	exceedsAbilityScoreCap,
	featAbilityChoiceOptions,
	featAsiGrantsFor,
	featsRequiringAbilityChoice,
	isValidAbilityIncrease,
	speciesPrereqInfoFor,
	type FeatEntry,
	type PrerequisiteContext,
} from './featAsiData'

/*
 * Pure-logic tests for the feat/ASI slice (D46: a script investigated the
 * data shape before this was written — scripts/investigate-feat-asi-
 * eligibility.js and scripts/investigate-feat-structured-fields.js).
 */

const classFeatures = [
	{ name: 'Ability Score Improvement', className: 'Fighter', classSource: 'XPHB', level: 4 },
	{ name: 'Ability Score Improvement', className: 'Fighter', classSource: 'XPHB', level: 6 },
	{ name: 'Ability Score Improvement', className: 'Fighter', classSource: 'XPHB', level: 8 },
	{ name: 'Epic Boon', className: 'Fighter', classSource: 'XPHB', level: 19 },
	{ name: 'Ability Score Improvement', className: 'Wizard', classSource: 'XPHB', level: 4 },
]

describe('featAsiGrantsFor', () => {
	it('finds every grant at or below the given level, sorted ascending', () => {
		expect(featAsiGrantsFor(classFeatures, 'Fighter', 'XPHB', 8)).toEqual([
			{ level: 4, kind: 'asi' },
			{ level: 6, kind: 'asi' },
			{ level: 8, kind: 'asi' },
		])
	})

	it('includes Epic Boon once the character reaches that level', () => {
		expect(featAsiGrantsFor(classFeatures, 'Fighter', 'XPHB', 19)).toEqual([
			{ level: 4, kind: 'asi' },
			{ level: 6, kind: 'asi' },
			{ level: 8, kind: 'asi' },
			{ level: 19, kind: 'epicBoon' },
		])
	})

	it('returns nothing below the class\'s first grant level', () => {
		expect(featAsiGrantsFor(classFeatures, 'Fighter', 'XPHB', 3)).toEqual([])
	})

	it('does not mix up two different classes', () => {
		expect(featAsiGrantsFor(classFeatures, 'Wizard', 'XPHB', 8)).toEqual([{ level: 4, kind: 'asi' }])
	})
})

describe('isValidAbilityIncrease', () => {
	it('accepts +2 to one ability', () => {
		expect(isValidAbilityIncrease({ strength: 2 })).toBe(true)
	})

	it('accepts +1 to two different abilities', () => {
		expect(isValidAbilityIncrease({ strength: 1, dexterity: 1 })).toBe(true)
	})

	it('rejects +1 to a single ability', () => {
		expect(isValidAbilityIncrease({ strength: 1 })).toBe(false)
	})

	it('rejects +2 to two abilities', () => {
		expect(isValidAbilityIncrease({ strength: 2, dexterity: 2 })).toBe(false)
	})

	it('rejects an empty map', () => {
		expect(isValidAbilityIncrease({})).toBe(false)
	})
})

describe('exceedsAbilityScoreCap', () => {
	it('is false when the result stays at or under 20', () => {
		expect(exceedsAbilityScoreCap({ strength: 18 }, { strength: 2 })).toBe(false)
	})

	it('is true when the result would go over 20', () => {
		expect(exceedsAbilityScoreCap({ strength: 19 }, { strength: 2 })).toBe(true)
	})

	it('checks every ability in the increase map independently', () => {
		expect(exceedsAbilityScoreCap({ strength: 20, dexterity: 10 }, { strength: 1, dexterity: 1 })).toBe(true)
	})
})

describe('featAbilityChoiceOptions', () => {
	it('returns the named abilities for a choice-shaped feat (half-feat)', () => {
		const feat: FeatEntry = { name: 'Athlete', source: 'XPHB', category: 'G', ability: [{ choose: { from: ['str', 'dex'] } }] }
		expect(featAbilityChoiceOptions(feat)).toEqual(['strength', 'dexterity'])
	})

	it('returns null for a fixed-bonus feat', () => {
		const feat: FeatEntry = { name: 'Actor', source: 'XPHB', category: 'G', ability: [{ cha: 1 } as never] }
		expect(featAbilityChoiceOptions(feat)).toBeNull()
	})

	it('returns null for a feat with no ability field at all', () => {
		const feat: FeatEntry = { name: 'Tough', source: 'XPHB', category: 'G' }
		expect(featAbilityChoiceOptions(feat)).toBeNull()
	})
})

describe('featsRequiringAbilityChoice', () => {
	it('keys only the feats whose ability bonus is a choice, by name|source', () => {
		const feats: FeatEntry[] = [
			{ name: 'Athlete', source: 'XPHB', category: 'G', ability: [{ choose: { from: ['str', 'dex'] } }] },
			{ name: 'Actor', source: 'XPHB', category: 'G' },
			{ name: 'Tough', source: 'XPHB', category: 'G' },
		]
		expect(featsRequiringAbilityChoice(feats)).toEqual(new Set(['Athlete|XPHB']))
	})
})

describe('speciesPrereqInfoFor', () => {
	const species = [
		{ name: 'Elf', source: 'XPHB', size: ['M'] },
		{ name: 'Halfling', source: 'XPHB', size: ['S'] },
		{ name: 'Deep Gnome', source: 'MPMM', size: ['S'], creatureTypeTags: ['gnome'] },
		{ name: 'Sea Elf', source: 'MPMM', size: ['M'], creatureTypeTags: ['elf'] },
		{ name: 'Human', source: 'XPHB', size: ['S', 'M'] },
	]

	it('links a renamed variant back to its family via creatureTypeTags', () => {
		expect(speciesPrereqInfoFor(species, 'Deep Gnome', 'MPMM')).toEqual({ size: 'S', raceTags: ['gnome'] })
	})

	it('reports size as null when the species offers an unresolved size choice', () => {
		expect(speciesPrereqInfoFor(species, 'Human', 'XPHB')).toEqual({ size: null, raceTags: [] })
	})

	it('returns null for a species not in the data', () => {
		expect(speciesPrereqInfoFor(species, 'Nonexistent', 'XPHB')).toBeNull()
	})
})

function baseContext(overrides: Partial<PrerequisiteContext> = {}): PrerequisiteContext {
	return {
		characterLevel: 4,
		abilityScores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 },
		hasFightingStyleFeature: false,
		hasSpellcasting: false,
		armorProficiencies: [],
		weaponProficiencies: [],
		speciesName: null,
		speciesRaceTags: [],
		speciesSize: null,
		chosenFeats: [],
		...overrides,
	}
}

describe('evaluateFeatPrerequisites', () => {
	it('is eligible with no prerequisite field at all', () => {
		const feat: FeatEntry = { name: 'Tough', source: 'XPHB', category: 'G' }
		expect(evaluateFeatPrerequisites(feat, baseContext())).toEqual({ eligible: true, reasons: [] })
	})

	it('fails an unmet ability + level requirement with a readable reason', () => {
		const feat: FeatEntry = { name: 'Actor', source: 'XPHB', category: 'G', prerequisite: [{ level: 4, ability: [{ cha: 13 }] }] }
		const result = evaluateFeatPrerequisites(feat, baseContext())
		expect(result.eligible).toBe(false)
		expect(result.reasons).toEqual(['Requires Charisma 13+.'])
	})

	it('passes once the ability score is high enough', () => {
		const feat: FeatEntry = { name: 'Actor', source: 'XPHB', category: 'G', prerequisite: [{ level: 4, ability: [{ cha: 13 }] }] }
		const result = evaluateFeatPrerequisites(feat, baseContext({ abilityScores: { charisma: 13 } }))
		expect(result).toEqual({ eligible: true, reasons: [] })
	})

	it('treats top-level prerequisite entries as alternatives (OR) — Athlete passes on either Strength or Dexterity', () => {
		const feat: FeatEntry = {
			name: 'Athlete',
			source: 'XPHB',
			category: 'G',
			prerequisite: [
				{ level: 4, ability: [{ str: 13 }] },
				{ level: 4, ability: [{ dex: 13 }] },
			],
		}
		expect(evaluateFeatPrerequisites(feat, baseContext({ abilityScores: { dexterity: 13 } })).eligible).toBe(true)
	})

	it('the Fighting Style prerequisite checks hasFightingStyleFeature', () => {
		const feat: FeatEntry = { name: 'Archery', source: 'XPHB', category: 'FS', prerequisite: [{ feature: ['Fighting Style'] }] }
		expect(evaluateFeatPrerequisites(feat, baseContext()).eligible).toBe(false)
		expect(evaluateFeatPrerequisites(feat, baseContext({ hasFightingStyleFeature: true })).eligible).toBe(true)
	})

	it('matches a race prerequisite through the base species name', () => {
		const feat: FeatEntry = { name: 'Dragon Fear', source: 'XPHB', category: 'G', prerequisite: [{ race: [{ name: 'dragonborn' }] }] }
		expect(evaluateFeatPrerequisites(feat, baseContext({ speciesName: 'Dragonborn (Red)' })).eligible).toBe(true)
		expect(evaluateFeatPrerequisites(feat, baseContext({ speciesName: 'Elf' })).eligible).toBe(false)
	})

	it('matches a race prerequisite through creatureTypeTags for a renamed variant', () => {
		const feat: FeatEntry = { name: 'Fade Away', source: 'XPHB', category: 'G', prerequisite: [{ race: [{ name: 'gnome' }] }] }
		expect(evaluateFeatPrerequisites(feat, baseContext({ speciesName: 'Deep Gnome', speciesRaceTags: ['gnome'] })).eligible).toBe(true)
	})

	it('matches a race + subrace prerequisite via the "; " naming convention', () => {
		const feat: FeatEntry = { name: 'Drow High Magic', source: 'XPHB', category: 'G', prerequisite: [{ race: [{ name: 'elf', subrace: 'drow' }] }] }
		expect(evaluateFeatPrerequisites(feat, baseContext({ speciesName: 'Elf; Drow Lineage' })).eligible).toBe(true)
		expect(evaluateFeatPrerequisites(feat, baseContext({ speciesName: 'Elf; Wood Elf Lineage' })).eligible).toBe(false)
	})

	it('the "small race" race alternative checks speciesSize', () => {
		const feat: FeatEntry = {
			name: 'Squat Nimbleness',
			source: 'XPHB',
			category: 'G',
			prerequisite: [{ race: [{ name: 'dwarf' }, { name: 'small race', displayEntry: 'a Small race' }] }],
		}
		expect(evaluateFeatPrerequisites(feat, baseContext({ speciesName: 'Halfling', speciesSize: 'S' })).eligible).toBe(true)
		expect(evaluateFeatPrerequisites(feat, baseContext({ speciesName: 'Elf', speciesSize: 'M' })).eligible).toBe(false)
	})

	it('a race prerequisite for a species this app never offers (half-elf/half-orc) is always unmet, with a reason', () => {
		const feat: FeatEntry = { name: 'Orcish Fury', source: 'XPHB', category: 'G', prerequisite: [{ race: [{ name: 'half-orc' }] }] }
		const result = evaluateFeatPrerequisites(feat, baseContext({ speciesName: 'Orc' }))
		expect(result.eligible).toBe(false)
		expect(result.reasons).toEqual(['Requires species: half-orc.'])
	})

	it('spellcasting2020 checks hasSpellcasting', () => {
		const feat: FeatEntry = { name: 'War Caster', source: 'XPHB', category: 'G', prerequisite: [{ level: 4, spellcasting2020: true }] }
		expect(evaluateFeatPrerequisites(feat, baseContext()).eligible).toBe(false)
		expect(evaluateFeatPrerequisites(feat, baseContext({ hasSpellcasting: true })).eligible).toBe(true)
	})

	it('proficiency checks the class-derived armor/weapon lists', () => {
		const feat: FeatEntry = { name: 'Heavily Armored', source: 'XPHB', category: 'G', prerequisite: [{ level: 4, proficiency: [{ armor: 'medium' }] }] }
		expect(evaluateFeatPrerequisites(feat, baseContext()).eligible).toBe(false)
		expect(evaluateFeatPrerequisites(feat, baseContext({ armorProficiencies: ['light', 'medium'] })).eligible).toBe(true)
	})

	it('a feat prerequisite checks feats already chosen at earlier levels', () => {
		const feat: FeatEntry = {
			name: 'Greater Aberrant Mark',
			source: 'EFA',
			category: 'D',
			prerequisite: [{ level: 4, feat: ['aberrant dragonmark|efa'] }],
		}
		expect(evaluateFeatPrerequisites(feat, baseContext()).eligible).toBe(false)
		expect(
			evaluateFeatPrerequisites(
				feat,
				baseContext({ chosenFeats: [{ name: 'Aberrant Dragonmark', source: 'EFA', category: 'D' }] }),
			).eligible,
		).toBe(true)
	})

	it('a featCategory prerequisite checks the category of feats already chosen', () => {
		const feat: FeatEntry = { name: 'Potent Dragonmark', source: 'EFA', category: 'D', prerequisite: [{ level: 4, featCategory: ['D'] }] }
		expect(evaluateFeatPrerequisites(feat, baseContext()).eligible).toBe(false)
		expect(
			evaluateFeatPrerequisites(feat, baseContext({ chosenFeats: [{ name: 'Aberrant Dragonmark', source: 'EFA', category: 'D' }] }))
				.eligible,
		).toBe(true)
	})

	it('a campaign prerequisite is always unmet — this app tracks no campaign setting', () => {
		const feat: FeatEntry = { name: 'Aberrant Dragonmark', source: 'EFA', category: 'D', prerequisite: [{ campaign: ['Eberron'], exclusiveFeatCategory: ['D'] } as never] }
		const result = evaluateFeatPrerequisites(feat, baseContext())
		expect(result.eligible).toBe(false)
		expect(result.reasons[0]).toContain('Eberron')
		expect(result.reasons[0]).toContain('not tracked')
	})

	it('an otherSummary prerequisite shows its own prose verbatim, not a "Requires ..." reason', () => {
		const feat: FeatEntry = {
			name: 'Blessed Warrior',
			source: 'XPHB',
			category: 'FS:P',
			prerequisite: [{ otherSummary: { entry: 'When Gaining the Level 2 Paladin "Fighting Style" Feature' } }],
		}
		const result = evaluateFeatPrerequisites(feat, baseContext())
		expect(result.eligible).toBe(false)
		expect(result.reasons).toEqual(['When Gaining the Level 2 Paladin "Fighting Style" Feature'])
	})
})
