import { describe, expect, it, vi } from 'vitest'
import { emptyWizardData, isStepComplete, sameWizardData, saveCharacter, wizardDataFromCharacter, wizardReducer, wizardToolGrants, type WizardData, type WizardSeedLookups } from './wizardState'
import { editCharacterBlockedReason } from '../levelUp/levelUpSteps'
import { CLASSES, RESOLVER } from '../levelUp/levelGains.fixtures'
import { levelRemovalCore } from '../levelUp/levelRemoval'
import { heldClassPrerequisiteNote } from '../multiclass/multiclassPrerequisites'
import type { Character } from '../storage/character'
import type { CharacterStore } from '../storage/characterStore'

const X = 'XPHB'

function twoClasses(): WizardData {
	return {
		...emptyWizardData(),
		classChoice: { className: 'Fighter', classSource: X, level: 4 },
		activeClassFeatureTypes: [],
		otherClasses: [
			{
				classChoice: { className: 'Rogue', classSource: X, level: 1 },
				subclass: null,
				fightingStyle: null,
				optionalFeatureChoices: [],
				classOptionalFeatureChoices: [],
				spellChoices: [],
				subclassSpellChoices: [],
				classFeatureChoices: [],
				wildShapeForms: [],
				activeClassFeatureTypes: [],
			},
		],
	}
}

describe('D333 multiclass Edit', () => {
	it('sameWizardData ignores which held class is active, and sees a change in a stashed one', () => {
		const seeded = twoClasses()
		const switched = wizardReducer({ step: 'class', data: seeded }, { type: 'switchClass', to: { className: 'Rogue', classSource: X } }).data
		expect(sameWizardData(switched, seeded)).toBe(true)
		const changed = wizardReducer({ step: 'class', data: switched }, { type: 'setFightingStyle', style: 'Archery' }).data
		expect(sameWizardData(changed, seeded)).toBe(false)
	})

	it('the hit points step checks every level against its own die when hitDieFacesByLevel is given', () => {
		const data = { ...twoClasses(), hitPointLevels: [2, 3, 4].map((level) => ({ level, kind: 'average' as const, dieResult: 6 })) }
		const faces = [10, 10, 10, 10, 8]
		expect(isStepComplete('hitPoints', data, { hitDieFacesByLevel: faces })).toBe(false)
		const full = { ...data, hitPointLevels: [...data.hitPointLevels, { level: 5, kind: 'average' as const, dieResult: 5 }] }
		expect(isStepComplete('hitPoints', full, { hitDieFacesByLevel: faces })).toBe(true)
		expect(isStepComplete('hitPoints', full, { hitDieFacesByLevel: null })).toBe(false)
	})

	it('Edit is blocked only for a multiclass character without a consistent levelOrder', () => {
		const classes = [
			{ className: 'Fighter', classSource: X, subclass: null, level: 2 },
			{ className: 'Rogue', classSource: X, subclass: null, level: 1 },
		]
		const base = { id: 'c', name: 'c', classes } as Character
		expect(editCharacterBlockedReason(base)).toBe('Cannot tell which class each level came from (no level history).')
		const order = [...classes.flatMap((entry) => Array.from({ length: entry.level }, () => ({ className: entry.className, classSource: X })))]
		expect(editCharacterBlockedReason({ ...base, levelOrder: order })).toBeNull()
		expect(editCharacterBlockedReason({ ...base, classes: [classes[0]!] })).toBeNull()
	})

	it('heldClassPrerequisiteNote words an OR requirement and stays quiet when met', () => {
		const parsed = [
			{ entryType: 'class', name: 'Fighter', source: X, primaryAbility: [{ str: true }, { dex: true }] },
			{ entryType: 'class', name: 'Monk', source: X, primaryAbility: [{ dex: true, wis: true }] },
		]
		const fighter = { className: 'Fighter', classSource: X }
		expect(heldClassPrerequisiteNote(fighter, parsed, { strength: 10, dexterity: 11 })).toBe(
			'Below the multiclass prerequisite of Fighter (Strength 13 or Dexterity 13). Rules check this only when entering a class.',
		)
		expect(heldClassPrerequisiteNote(fighter, parsed, { strength: 10, dexterity: 13 })).toBeNull()
		expect(heldClassPrerequisiteNote({ className: 'Monk', classSource: X }, parsed, { dexterity: 14, wisdom: 12 })).toBe(
			'Below the multiclass prerequisite of Monk (Dexterity 13 and Wisdom 13). Rules check this only when entering a class.',
		)
	})
})

describe('F-11 review fixes (D334)', () => {
	const F = { className: 'Fighter', classSource: X }
	const R = { className: 'Rogue', classSource: X }
	const W = { className: 'Wizard', classSource: X }
	const SMITH = { grantedBy: 'battleMaster' as const, name: "Smith's Tools" }
	const conditions = { characterLevel: 1, editingExistingCharacter: true }
	const levelUpConditions = { levelUpSteps: new Set(['hitPoints', 'review'] as const), levelUpTargetLevel: 5, characterLevel: 5, hitDieFaces: 8 }

	const store = (): CharacterStore => ({ update: vi.fn((id: string) => ({ id, name: 'T', classes: [] })) }) as unknown as CharacterStore

	function character(classes: Character['classes'], extra: Partial<Character> = {}): Character {
		return {
			id: 'c1',
			name: 'Test',
			classes,
			levelOrder: classes.flatMap((entry) => Array.from({ length: entry.level }, () => ({ className: entry.className, classSource: entry.classSource }))),
			abilityScores: { method: 'standardArray', scores: { strength: 15, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 8 } },
			species: { name: 'Elf', source: X },
			background: { name: 'Soldier', source: X, skillProficiencies: ['athletics', 'intimidation'], toolProficiency: 'Dice Set' },
			abilityBonus: { strength: 2, constitution: 1 },
			languages: [
				{ name: 'Common', source: X, grantedBy: 'automatic' },
				{ name: 'Draconic', source: X, grantedBy: 'creation' },
				{ name: 'Dwarvish', source: X, grantedBy: 'creation' },
				...(classes.some((entry) => entry.className === 'Rogue') ? [{ name: 'Elvish', source: X, grantedBy: 'thievesCant' as const }] : []),
			],
			classSkills: ['acrobatics', 'survival'],
			speciesSkills: ['perception'],
			...extra,
		}
	}

	const held = (...entries: { ref: { className: string; classSource: string }; subclasses?: WizardSeedLookups['subclasses']; featureTypes?: string[]; fightingStyleLevel?: number | null }[]): WizardSeedLookups => ({
		subclasses: [],
		spellLevels: [],
		heldClasses: entries.map(({ ref, subclasses, featureTypes, fightingStyleLevel }) => ({ ...ref, subclasses: subclasses ?? [], featureTypes: featureTypes ?? [], ...(fightingStyleLevel !== undefined ? { fightingStyleLevel } : {}) })),
	})

	function saveEdit(existing: Character, lookups: WizardSeedLookups, change: (data: WizardData) => WizardData = (data) => data) {
		const target = store()
		saveCharacter(target, change(wizardDataFromCharacter(existing, lookups)), ['athletics', 'intimidation'], conditions, undefined, existing)
		return vi.mocked(target.update).mock.calls[0][1]
	}

	const battleMaster = [{ name: 'Battle Master', source: X, featureType: 'MV:B' }]

	describe('finding 1: subclass tool grants of a non-first class', () => {
		const rogueFighter = () =>
			character([{ ...R, subclass: null, level: 1 }, { ...F, subclass: 'Battle Master', level: 3 }], { toolChoices: [SMITH], optionalFeatureChoices: [{ featureType: 'MV:B', choices: [{ name: 'Precision Attack', level: 3 }] }] })

		it('an untouched multiclass Edit keeps a Battle Master pick on the second class, and the Languages step asks for it', () => {
			const lookups = held({ ref: R }, { ref: F, subclasses: battleMaster })
			expect(saveEdit(rogueFighter(), lookups).toolChoices).toEqual([SMITH])
			const data = wizardDataFromCharacter(rogueFighter(), lookups)
			const classes = rogueFighter().classes
			expect(wizardToolGrants(data, null, classes).map((grant) => grant.grantedBy)).toEqual(['battleMaster'])
			expect(wizardToolGrants({ ...data, toolChoices: [] }, null, classes)).toHaveLength(1)
		})

		it('a level up of the other class keeps it', () => {
			const existing = rogueFighter()
			const lookups = { ...held({ ref: R }, { ref: F, subclasses: battleMaster }), activeClass: { ...R, featureTypes: [] } }
			const seed = wizardDataFromCharacter({ ...existing, classes: [{ ...R, subclass: null, level: 1 }, { ...F, subclass: 'Battle Master', level: 3 }] }, lookups)
			const target = store()
			const data = { ...seed, classChoice: { ...R, level: 2 }, hitPointLevels: [{ level: 5, kind: 'average' as const, dieResult: 5 }] }
			saveCharacter(target, data, undefined, levelUpConditions, undefined, { ...existing, hitPointLevels: [] }, 5)
			expect(vi.mocked(target.update).mock.calls[0][1].toolChoices).toEqual([SMITH])
		})

		it('a level up of a non-first Fighter to 3 offers the pick and saves it', () => {
			const existing = character([{ ...R, subclass: null, level: 2 }, { ...F, subclass: null, level: 2 }])
			const seed = wizardDataFromCharacter(existing, { subclasses: battleMaster, spellLevels: [], activeClass: { ...F, featureTypes: [] } })
			const data: WizardData = {
				...seed,
				classChoice: { ...F, level: 3 },
				subclass: battleMaster[0],
				toolChoices: [SMITH],
				optionalFeatureChoices: ['Precision Attack'],
				hitPointLevels: [{ level: 5, kind: 'average', dieResult: 6 }],
			}
			expect(wizardToolGrants(data, 5).map((grant) => grant.grantedBy)).toEqual(['battleMaster'])
			const target = store()
			saveCharacter(target, data, undefined, { ...levelUpConditions, hitDieFaces: 10 }, undefined, existing, 5)
			const input = vi.mocked(target.update).mock.calls[0][1]
			expect(input.toolChoices).toEqual([SMITH])
			expect(input.classes?.map((entry) => entry.subclass)).toEqual([null, 'Battle Master'])
		})
	})

	describe('finding 2: untagged (pre-58) fighting style in a multiclass Edit', () => {
		const untagged = () => character([{ ...F, subclass: null, level: 3 }, { ...R, subclass: null, level: 1 }], { fightingStyles: [{ name: 'Archery', source: X }] })

		it('goes to the first class whose grant level it has reached, and is saved tagged without a duplicate', () => {
			const lookups = held({ ref: F, fightingStyleLevel: 1 }, { ref: R, fightingStyleLevel: null })
			const data = wizardDataFromCharacter(untagged(), lookups)
			expect(data.fightingStyle).toBe('Archery')
			expect(saveEdit(untagged(), lookups).fightingStyles).toEqual([{ ...F, name: 'Archery', source: X }])
		})

		it('skips a class whose grant level is above its level', () => {
			const lookups = held({ ref: F, fightingStyleLevel: 4 }, { ref: R, fightingStyleLevel: 1 })
			const data = wizardDataFromCharacter(untagged(), lookups)
			expect(data.fightingStyle).toBeNull()
			expect(data.otherClasses![0].fightingStyle).toBe('Archery')
		})

		it('stays untagged and unchanged when no class qualifies', () => {
			const lookups = held({ ref: F, fightingStyleLevel: null }, { ref: R, fightingStyleLevel: null })
			expect(wizardDataFromCharacter(untagged(), lookups).fightingStyle).toBeNull()
			expect(saveEdit(untagged(), lookups).fightingStyles).toEqual([{ name: 'Archery', source: X }])
		})
	})

	describe('finding 3: level stamps of masteries and expertise changed in Edit', () => {
		const fighterRogue = () =>
			character([{ ...F, subclass: 'Champion', level: 4 }, { ...R, subclass: null, level: 1 }], {
				masteries: [{ name: 'Longsword' }, { name: 'Greataxe', level: 4 }],
				expertiseSkills: [{ name: 'stealth', level: 5 }, { name: 'perception', level: 5 }],
			})
		const lookups = held({ ref: F }, { ref: R })

		it('a replacing pick inherits the stamp of the slot it replaced, unchanged picks keep theirs', () => {
			const input = saveEdit(fighterRogue(), lookups, (data) => ({ ...data, expertiseSkills: ['athletics', 'perception'], masteries: ['Longsword', 'Shortbow'] }))
			expect(input.expertiseSkills).toEqual([{ name: 'athletics', level: 5 }, { name: 'perception', level: 5 }])
			expect(input.masteries).toEqual([{ name: 'Longsword' }, { name: 'Shortbow', level: 4 }])
		})

		it('Remove level of Rogue then removes the swapped expertise', () => {
			const existing = fighterRogue()
			const input = saveEdit(existing, lookups, (data) => ({ ...data, expertiseSkills: ['athletics', 'perception'] }))
			const edited = { ...existing, ...input } as Character
			const removal = levelRemovalCore(edited, CLASSES, RESOLVER, null)
			if ('reason' in removal) throw new Error(removal.reason)
			expect(removal.removedClass).toBe('Rogue')
			expect(removal.result.expertiseSkills).toEqual([])
		})

		it('a single-class Edit does the same', () => {
			const existing = character([{ ...R, subclass: null, level: 5 }], { expertiseSkills: [{ name: 'stealth', level: 1 }, { name: 'perception', level: 1 }] })
			const input = saveEdit(existing, held({ ref: R }), (data) => ({ ...data, expertiseSkills: ['athletics', 'perception'] }))
			expect(input.expertiseSkills).toEqual([{ name: 'athletics', level: 1 }, { name: 'perception', level: 1 }])
		})
	})

	describe('finding 4: an optional-feature type two held classes list', () => {
		it('is claimed by the first of them and saved once', () => {
			const existing = character([{ ...F, subclass: null, level: 3 }, { ...R, subclass: null, level: 1 }], { optionalFeatureChoices: [{ featureType: 'XX', choices: [{ name: 'Alpha', level: 2 }] }] })
			const lookups = held({ ref: F, featureTypes: ['XX'] }, { ref: R, featureTypes: ['XX'] })
			const data = wizardDataFromCharacter(existing, lookups)
			expect(data.classOptionalFeatureChoices).toHaveLength(1)
			expect(data.otherClasses![0].classOptionalFeatureChoices).toEqual([])
			expect(saveEdit(existing, lookups).optionalFeatureChoices).toEqual(existing.optionalFeatureChoices)
		})
	})

	describe('finding 5: subclassSource of subclass spell picks', () => {
		const picks = [{ grantedAtLevel: 3, slotIndex: 0, name: 'Sleep', source: X }]
		const existing = () =>
			character([{ ...F, subclass: null, level: 1 }, { ...W, subclass: 'Bladesinger', level: 3 }], { subclassSpellChoices: [{ subclassName: 'Bladesinger', subclassSource: 'TCE', ...W, picks }] })

		it('keeps the stored source when the subclass is not in the loaded list', () => {
			expect(saveEdit(existing(), held({ ref: F }, { ref: W })).subclassSpellChoices).toEqual(existing().subclassSpellChoices)
		})

		it('keeps the stored source when a same-named subclass of another source is loaded', () => {
			const lookups = held({ ref: F }, { ref: W, subclasses: [{ name: 'Bladesinger', source: 'XPHB', featureType: null }] })
			expect(saveEdit(existing(), lookups).subclassSpellChoices).toEqual(existing().subclassSpellChoices)
		})
	})
})
