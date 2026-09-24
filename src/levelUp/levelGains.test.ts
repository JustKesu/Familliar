import { describe, expect, it } from 'vitest'
import { levelGainsFor, type LevelGain } from './levelGains'
import { CLASSES, RESOLVER } from './levelGains.fixtures'
import type { Character } from '../storage/character'
import { unknownLevelUpSteps } from './levelUpSteps'
import { emptyWizardData, wizardToolGrants } from '../creation/wizardState'

function character(classes: Character['classes']): Character {
	return { id: 'c1', name: 'Test', classes }
}

const fighter = character([{ className: 'Fighter', classSource: 'XPHB', subclass: 'Champion', level: 7 }])
const rogue = character([{ className: 'Rogue', classSource: 'XPHB', subclass: 'Thief', level: 6 }])
const sorcerer = character([{ className: 'Sorcerer', classSource: 'XPHB', subclass: 'Draconic Sorcery', level: 10 }])
const cleric = character([{ className: 'Cleric', classSource: 'XPHB', subclass: 'Life Domain', level: 3 }])

function partCount(gain: LevelGain, name: string): number {
	return gain.parts.find((part) => part.name === name)?.count ?? 0
}

describe('levelGainsFor', () => {
	it('reports the ASI a Fighter gains at level 4, named as the data names the feature', () => {
		const gains = levelGainsFor(fighter, 4, CLASSES, RESOLVER)
		expect(gains.steps.featAsi).toMatchObject({ status: 'adds', count: 1 })
		expect(gains.steps.featAsi.parts).toEqual([{ name: 'Ability Score Improvement', count: 1 }])
		// The same level also raises Fighter's weapon-mastery column from 3 to 4.
		expect(partCount(gains.steps.class, 'Weapon Mastery')).toBe(1)
	})

	it('reports no ASI at Fighter 5, but does report Extra Attack as a feature the level grants', () => {
		const gains = levelGainsFor(fighter, 5, CLASSES, RESOLVER)
		expect(gains.steps.featAsi.status).toBe('none')
		expect(gains.steps.class.status).toBe('none')
		expect(gains.newFeatures.map((feature) => feature.name)).toEqual(['Extra Attack'])
	})

	it('reports a level that asks for nothing but the hit points every level asks for', () => {
		const gains = levelGainsFor(fighter, 7, CLASSES, RESOLVER)
		expect(gains.newFeatures).toEqual([])
		expect(gains.steps.hitPoints).toMatchObject({ status: 'adds', count: 1 })
		const others = Object.entries(gains.steps).filter(([step]) => step !== 'hitPoints')
		expect(others.filter(([, gain]) => gain.status === 'adds')).toEqual([])
		expect(others.filter(([, gain]) => gain.status === 'unknown')).toEqual([])
	})

	it('reports the two extra Expertise skills a Rogue gains at level 6', () => {
		const gains = levelGainsFor(rogue, 6, CLASSES, RESOLVER)
		expect(gains.steps.expertise).toMatchObject({ status: 'adds', count: 2 })
		expect(gains.steps.expertise.parts).toEqual([{ name: 'Expertise', count: 2 }])
	})

	it('reports no further Expertise at Rogue 5, where the cumulative count is unchanged', () => {
		expect(levelGainsFor(rogue, 5, CLASSES, RESOLVER).steps.expertise.status).toBe('none')
	})

	it('reports the third Metamagic a Sorcerer gains at level 10, alongside that level\'s spell counts', () => {
		const gains = levelGainsFor(sorcerer, 10, CLASSES, RESOLVER)
		expect(gains.steps.classOptionalFeatures).toMatchObject({ status: 'adds', count: 1 })
		expect(gains.steps.classOptionalFeatures.parts).toEqual([{ name: 'Metamagic', count: 1 }])
		expect(partCount(gains.steps.spells, 'Cantrips')).toBe(1)
		expect(partCount(gains.steps.spells, 'Leveled spells')).toBe(1)
	})

	it('reports no further Metamagic at Sorcerer 9', () => {
		expect(levelGainsFor(sorcerer, 9, CLASSES, RESOLVER).steps.classOptionalFeatures.status).toBe('none')
	})

	it('reports the subclass choice at the level the class chooses one, under the title the data gives it', () => {
		const gains = levelGainsFor(cleric, 3, CLASSES, RESOLVER)
		expect(partCount(gains.steps.class, 'Cleric Subclass')).toBe(1)
		// The subclass's own level-1 feature arrives at 3 with it — the downward drift the survey found.
		// "Cleric Subclass" itself is the gainSubclassFeature placeholder and is never listed as a granted feature (D87 rule 4).
		expect(gains.newFeatures.map((feature) => feature.name).sort()).toEqual(['Disciple of Life', 'Life Domain'])
	})

	it('does not credit a not-yet-chosen subclass\'s level-1 features to the level before the subclass is taken', () => {
		const gains = levelGainsFor(cleric, 2, CLASSES, RESOLVER)
		expect(gains.newFeatures).toEqual([])
		expect(gains.steps.class.status).toBe('none')
	})

	it('returns a visible unresolved state for a multiclass character rather than guessing a class', () => {
		const multiclass = character([
			{ className: 'Fighter', classSource: 'XPHB', subclass: 'Champion', level: 3 },
			{ className: 'Rogue', classSource: 'XPHB', subclass: 'Thief', level: 2 },
		])
		const gains = levelGainsFor(multiclass, 4, CLASSES, RESOLVER)
		expect(gains.unresolved).toContain('Multiclass')
		expect(gains.newFeatures).toEqual([])
		expect(Object.values(gains.steps).every((gain) => gain.status === 'unknown')).toBe(true)
	})

	it('says which steps can never add anything after creation rather than leaving them out', () => {
		const gains = levelGainsFor(fighter, 5, CLASSES, RESOLVER)
		for (const step of ['species', 'background', 'abilities', 'equipment', 'review'] as const) {
			expect(gains.steps[step].status).toBe('never')
			expect(gains.steps[step].reason).toBeTruthy()
		}
		expect(gains.steps.languages.status).toBe('none')
	})

	it("D172: Ranger level 2 adds Deft Explorer's two languages, level 3 none", () => {
		const ranger = character([{ className: 'Ranger', classSource: 'XPHB', subclass: null, level: 1 }])
		const classes = [...CLASSES, { entryType: 'class', name: 'Ranger', source: 'XPHB' }]
		expect(levelGainsFor(ranger, 2, classes, RESOLVER).steps.languages).toMatchObject({ status: 'adds', count: 2, parts: [{ name: 'Deft Explorer', count: 2 }] })
		expect(levelGainsFor(ranger, 3, classes, RESOLVER).steps.languages.status).toBe('none')
	})

	it("D174: Battle Master's tool pick is level 3 — unknown while the subclass is still to be chosen, adds once it is, none at 2", () => {
		const unchosen = character([{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 2 }])
		const languages = levelGainsFor(unchosen, 3, CLASSES, RESOLVER).steps.languages
		expect(languages.status).toBe('unknown')
		expect(languages.reason).toContain('Battle Master')
		expect(levelGainsFor(unchosen, 2, CLASSES, RESOLVER).steps.languages.status).toBe('none')
		const chosen = character([{ className: 'Fighter', classSource: 'XPHB', subclass: 'Battle Master', level: 2 }])
		expect(levelGainsFor(chosen, 3, CLASSES, RESOLVER).steps.languages).toMatchObject({ status: 'adds', count: 1, parts: [{ name: 'Battle Master tool', count: 1 }] })
		expect(levelGainsFor(fighter, 3, CLASSES, RESOLVER).steps.languages.status).toBe('none')
	})

	describe('D176: the languages step at the subclass level', () => {
		const withClass = (name: string, source: string) => ({
			classes: [...CLASSES, { entryType: 'class', name, source, subclassTitle: `${name} Subclass`, hd: { number: 1, faces: 8 }, classFeatureIds: [], classFeatures: [] }],
			resolver: { ...RESOLVER, classFeatures: [...(RESOLVER.classFeatures as unknown[]), { id: `cf|${name}`, name: `${name} Subclass`, className: name, classSource: source, level: 3, entries: [] }] },
		})
		const unchosenAt2 = (className: string, classSource = 'XPHB') => character([{ className, classSource, subclass: null, level: 2 }])

		it('Fighter 2→3: the banner names Battle Master until the class step chooses; then Champion leaves none, Battle Master a real slot', () => {
			const gains = levelGainsFor(unchosenAt2('Fighter'), 3, CLASSES, RESOLVER)
			expect(unknownLevelUpSteps(gains).languages).toContain('Battle Master')
			expect(unknownLevelUpSteps(gains, 'Champion').languages).toBeUndefined()
			expect(unknownLevelUpSteps(gains, 'Battle Master').languages).toBeUndefined()
			const data = (subclass: string) => ({ ...emptyWizardData(), classChoice: { className: 'Fighter', classSource: 'XPHB', level: 3 }, subclass: { name: subclass, source: 'XPHB', featureType: null } })
			expect(wizardToolGrants(data('Champion'), 3)).toEqual([])
			expect(wizardToolGrants(data('Battle Master'), 3)).toMatchObject([{ grantedBy: 'battleMaster', count: 1 }])
		})

		it('Rogue 2→3 names Mastermind; Cleric 2→3 has nothing to pick', () => {
			expect(levelGainsFor(unchosenAt2('Rogue'), 3, CLASSES, RESOLVER).steps.languages.reason).toContain('Mastermind')
			expect(levelGainsFor(unchosenAt2('Cleric'), 3, CLASSES, RESOLVER).steps.languages.status).toBe('none')
		})

		it('Monk 2→3 names Kensei; Artificer 2→3 names every subclass as conditional', () => {
			const monk = withClass('Monk', 'XPHB')
			expect(levelGainsFor(unchosenAt2('Monk'), 3, monk.classes, monk.resolver).steps.languages.reason).toContain('Way of the Kensei')
			const artificer = withClass('Artificer', 'EFA')
			const reason = levelGainsFor(unchosenAt2('Artificer', 'EFA'), 3, artificer.classes, artificer.resolver).steps.languages.reason
			expect(reason).toContain('Armorer (only for a subclass tool already held)')
		})

		it('Rogue 3 Mastermind chosen before the level: 2 languages and 1 gaming set', () => {
			const chosen = character([{ className: 'Rogue', classSource: 'XPHB', subclass: 'Mastermind', level: 2 }])
			expect(levelGainsFor(chosen, 3, CLASSES, RESOLVER).steps.languages).toMatchObject({ status: 'adds', count: 3 })
		})
	})

	it('reports unknown, not zero, for a class the supplied data does not have', () => {
		const gains = levelGainsFor(character([{ className: 'Artificer', classSource: 'TCE', subclass: null, level: 4 }]), 4, CLASSES, RESOLVER)
		expect(gains.unresolved).toContain('Artificer')
		expect(gains.steps.featAsi.status).toBe('unknown')
	})

	it('reports unknown for a stored subclass the supplied data does not have', () => {
		const gains = levelGainsFor(character([{ className: 'Fighter', classSource: 'XPHB', subclass: 'Psi Warrior', level: 4 }]), 4, CLASSES, RESOLVER)
		expect(gains.unresolved).toBeNull()
		expect(gains.steps.class.status).toBe('unknown')
		expect(gains.steps.spells.status).toBe('unknown')
	})
})
