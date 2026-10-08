import { describe, expect, it } from 'vitest'
import { emptyWizardData, isStepComplete, sameWizardData, wizardReducer, type WizardData } from './wizardState'
import { editCharacterBlockedReason } from '../levelUp/levelUpSteps'
import { heldClassPrerequisiteNote } from '../multiclass/multiclassPrerequisites'
import type { Character } from '../storage/character'

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
