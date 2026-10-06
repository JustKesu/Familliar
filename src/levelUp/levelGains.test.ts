import { describe, expect, it } from 'vitest'
import { levelGainsFor, type LevelGain, type LevelGains } from './levelGains'
import { CLASSES, RESOLVER } from './levelGains.fixtures'
import type { Character } from '../storage/character'
import type { ResolverData } from '../featureResolver'
import { levelUpStepConditions, levelUpTarget, unknownLevelUpSteps } from './levelUpSteps'
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

/** A single-class character levelled into `level` of its one class: stored one level below. */
function gainsAt(c: Character, level: number, classes: unknown, resolver: ResolverData): LevelGains {
	const [only] = c.classes
	return levelGainsFor({ ...c, classes: [{ ...only, level: level - 1 }] }, only, classes, resolver)
}

describe('levelGainsFor', () => {
	it('reports the ASI a Fighter gains at level 4, named as the data names the feature', () => {
		const gains = gainsAt(fighter, 4, CLASSES, RESOLVER)
		expect(gains.steps.featAsi).toMatchObject({ status: 'adds', count: 1 })
		expect(gains.steps.featAsi.parts).toEqual([{ name: 'Ability Score Improvement', count: 1 }])
		// The same level also raises Fighter's weapon-mastery column from 3 to 4.
		expect(partCount(gains.steps.class, 'Weapon Mastery')).toBe(1)
	})

	it('reports no ASI at Fighter 5, but does report Extra Attack as a feature the level grants', () => {
		const gains = gainsAt(fighter, 5, CLASSES, RESOLVER)
		expect(gains.steps.featAsi.status).toBe('none')
		expect(gains.steps.class.status).toBe('none')
		expect(gains.newFeatures.map((feature) => feature.name)).toEqual(['Extra Attack'])
	})

	it('reports a level that asks for nothing but the hit points every level asks for', () => {
		const gains = gainsAt(fighter, 7, CLASSES, RESOLVER)
		expect(gains.newFeatures).toEqual([])
		expect(gains.steps.hitPoints).toMatchObject({ status: 'adds', count: 1 })
		const others = Object.entries(gains.steps).filter(([step]) => step !== 'hitPoints')
		expect(others.filter(([, gain]) => gain.status === 'adds')).toEqual([])
		expect(others.filter(([, gain]) => gain.status === 'unknown')).toEqual([])
	})

	it('reports the two extra Expertise skills a Rogue gains at level 6', () => {
		const gains = gainsAt(rogue, 6, CLASSES, RESOLVER)
		expect(gains.steps.expertise).toMatchObject({ status: 'adds', count: 2 })
		expect(gains.steps.expertise.parts).toEqual([{ name: 'Expertise', count: 2 }])
	})

	it('reports no further Expertise at Rogue 5, where the cumulative count is unchanged', () => {
		expect(gainsAt(rogue, 5, CLASSES, RESOLVER).steps.expertise.status).toBe('none')
	})

	it('reports the third Metamagic a Sorcerer gains at level 10, alongside that level\'s spell counts', () => {
		const gains = gainsAt(sorcerer, 10, CLASSES, RESOLVER)
		expect(gains.steps.classOptionalFeatures).toMatchObject({ status: 'adds', count: 1 })
		expect(gains.steps.classOptionalFeatures.parts).toEqual([{ name: 'Metamagic', count: 1 }])
		expect(partCount(gains.steps.spells, 'Cantrips')).toBe(1)
		expect(partCount(gains.steps.spells, 'Leveled spells')).toBe(1)
	})

	it('reports no further Metamagic at Sorcerer 9', () => {
		expect(gainsAt(sorcerer, 9, CLASSES, RESOLVER).steps.classOptionalFeatures.status).toBe('none')
	})

	it('reports the subclass choice at the level the class chooses one, under the title the data gives it', () => {
		const gains = gainsAt(cleric, 3, CLASSES, RESOLVER)
		expect(partCount(gains.steps.class, 'Cleric Subclass')).toBe(1)
		// The subclass's own level-1 feature arrives at 3 with it — the downward drift the survey found.
		// "Cleric Subclass" itself is the gainSubclassFeature placeholder and is never listed as a granted feature (D87 rule 4).
		expect(gains.newFeatures.map((feature) => feature.name).sort()).toEqual(['Disciple of Life', 'Life Domain'])
	})

	it('does not credit a not-yet-chosen subclass\'s level-1 features to the level before the subclass is taken', () => {
		const gains = gainsAt(cleric, 2, CLASSES, RESOLVER)
		expect(gains.newFeatures).toEqual([])
		expect(gains.steps.class.status).toBe('none')
	})

	it('D316/D328: Level up refuses a multiclass character at levelUpTarget, while levelGainsFor answers the named class', () => {
		const multiclass = character([
			{ className: 'Fighter', classSource: 'XPHB', subclass: 'Champion', level: 3 },
			{ className: 'Rogue', classSource: 'XPHB', subclass: 'Thief', level: 2 },
		])
		expect(levelUpTarget(multiclass)).toEqual({ reason: expect.stringContaining('Multiclass') })
		const gains = levelGainsFor(multiclass, { className: 'Rogue', classSource: 'XPHB' }, CLASSES, RESOLVER)
		expect(gains).toMatchObject({ level: 6, classLevel: 3, className: 'Rogue', unresolved: null })
	})

	it('says which steps can never add anything after creation rather than leaving them out', () => {
		const gains = gainsAt(fighter, 5, CLASSES, RESOLVER)
		for (const step of ['species', 'background', 'abilities', 'equipment', 'review'] as const) {
			expect(gains.steps[step].status).toBe('never')
			expect(gains.steps[step].reason).toBeTruthy()
		}
		expect(gains.steps.languages.status).toBe('none')
	})

	it("D172: Ranger level 2 adds Deft Explorer's two languages, level 3 none", () => {
		const ranger = character([{ className: 'Ranger', classSource: 'XPHB', subclass: null, level: 1 }])
		const classes = [...CLASSES, { entryType: 'class', name: 'Ranger', source: 'XPHB' }]
		expect(gainsAt(ranger, 2, classes, RESOLVER).steps.languages).toMatchObject({ status: 'adds', count: 2, parts: [{ name: 'Deft Explorer', count: 2 }] })
		expect(gainsAt(ranger, 3, classes, RESOLVER).steps.languages.status).toBe('none')
	})

	it("D174: Battle Master's tool pick is level 3 — unknown while the subclass is still to be chosen, adds once it is, none at 2", () => {
		const unchosen = character([{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 2 }])
		const languages = gainsAt(unchosen, 3, CLASSES, RESOLVER).steps.languages
		expect(languages.status).toBe('unknown')
		expect(languages.reason).toContain('Battle Master')
		expect(gainsAt(unchosen, 2, CLASSES, RESOLVER).steps.languages.status).toBe('none')
		const chosen = character([{ className: 'Fighter', classSource: 'XPHB', subclass: 'Battle Master', level: 2 }])
		expect(gainsAt(chosen, 3, CLASSES, RESOLVER).steps.languages).toMatchObject({
			status: 'adds',
			count: 2,
			parts: [
				{ name: 'Battle Master tool', count: 1 },
				{ name: 'Battle Master skill', count: 1 },
			],
		})
		expect(gainsAt(fighter, 3, CLASSES, RESOLVER).steps.languages.status).toBe('none')
	})

	describe('D176: the languages step at the subclass level', () => {
		const withClass = (name: string, source: string) => ({
			classes: [...CLASSES, { entryType: 'class', name, source, subclassTitle: `${name} Subclass`, hd: { number: 1, faces: 8 }, classFeatureIds: [], classFeatures: [] }],
			resolver: { ...RESOLVER, classFeatures: [...(RESOLVER.classFeatures as unknown[]), { id: `cf|${name}`, name: `${name} Subclass`, className: name, classSource: source, level: 3, entries: [] }] },
		})
		const unchosenAt2 = (className: string, classSource = 'XPHB') => character([{ className, classSource, subclass: null, level: 2 }])

		it('Fighter 2→3: the banner names Battle Master until the class step chooses; then Champion leaves none, Battle Master a real slot', () => {
			const gains = gainsAt(unchosenAt2('Fighter'), 3, CLASSES, RESOLVER)
			expect(unknownLevelUpSteps(gains).languages).toContain('Battle Master')
			expect(unknownLevelUpSteps(gains, 'Champion').languages).toBeUndefined()
			expect(unknownLevelUpSteps(gains, 'Battle Master').languages).toBeUndefined()
			const data = (subclass: string) => ({ ...emptyWizardData(), classChoice: { className: 'Fighter', classSource: 'XPHB', level: 3 }, subclass: { name: subclass, source: 'XPHB', featureType: null } })
			expect(wizardToolGrants(data('Champion'), 3)).toEqual([])
			expect(wizardToolGrants(data('Battle Master'), 3)).toMatchObject([{ grantedBy: 'battleMaster', count: 1 }])
		})

		it('Rogue 2→3 names Mastermind; D177: Cleric 2→3 names Order Domain and Peace Domain; D203: and Knowledge Domain', () => {
			expect(gainsAt(unchosenAt2('Rogue'), 3, CLASSES, RESOLVER).steps.languages.reason).toContain('Mastermind')
			expect(gainsAt(unchosenAt2('Cleric'), 3, CLASSES, RESOLVER).steps.languages).toMatchObject({ status: 'unknown', owingSubclasses: ['Knowledge Domain', 'Order Domain', 'Peace Domain'] })
		})

		describe('D177: the languages step is walked only when the chosen subclass owes a pick', () => {
			const walks = (gains: LevelGains, subclass: string | null) => levelUpStepConditions(gains, subclass).levelUpSteps?.has('languages')

			it('Fighter 2→3: walked before the choice and for Battle Master, hidden for Champion', () => {
				const gains = gainsAt(unchosenAt2('Fighter'), 3, CLASSES, RESOLVER)
				expect(walks(gains, null)).toBe(true)
				expect(walks(gains, 'Battle Master')).toBe(true)
				expect(walks(gains, 'Champion')).toBe(false)
			})

			it('Cleric 2→3: walked for Order Domain, hidden for Life Domain', () => {
				const gains = gainsAt(unchosenAt2('Cleric'), 3, CLASSES, RESOLVER)
				expect(walks(gains, 'Order Domain')).toBe(true)
				expect(walks(gains, 'Life Domain')).toBe(false)
			})
		})

		it('Monk 2→3 names Kensei; Artificer 2→3 names every subclass as conditional', () => {
			const monk = withClass('Monk', 'XPHB')
			expect(gainsAt(unchosenAt2('Monk'), 3, monk.classes, monk.resolver).steps.languages.reason).toContain('Way of the Kensei')
			const artificer = withClass('Artificer', 'EFA')
			const reason = gainsAt(unchosenAt2('Artificer', 'EFA'), 3, artificer.classes, artificer.resolver).steps.languages.reason
			expect(reason).toContain('Armorer (only for a subclass tool already held)')
		})

		it('Rogue 3 Mastermind chosen before the level: 2 languages and 1 gaming set', () => {
			const chosen = character([{ className: 'Rogue', classSource: 'XPHB', subclass: 'Mastermind', level: 2 }])
			expect(gainsAt(chosen, 3, CLASSES, RESOLVER).steps.languages).toMatchObject({ status: 'adds', count: 3 })
		})
	})

	it('reports unknown, not zero, for a class the supplied data does not have', () => {
		const gains = gainsAt(character([{ className: 'Artificer', classSource: 'TCE', subclass: null, level: 4 }]), 4, CLASSES, RESOLVER)
		expect(gains.unresolved).toContain('Artificer')
		expect(gains.steps.featAsi.status).toBe('unknown')
	})

	it('reports unknown for a stored subclass the supplied data does not have', () => {
		const gains = gainsAt(character([{ className: 'Fighter', classSource: 'XPHB', subclass: 'Psi Warrior', level: 4 }]), 4, CLASSES, RESOLVER)
		expect(gains.unresolved).toBeNull()
		expect(gains.steps.class.status).toBe('unknown')
		expect(gains.steps.spells.status).toBe('unknown')
	})
})

describe('levelGainsFor on two level axes (D328)', () => {
	const WARLOCK = { className: 'Warlock', classSource: 'XPHB' }
	const SORCERER = { className: 'Sorcerer', classSource: 'XPHB' }
	const WIZARD = { className: 'Wizard', classSource: 'XPHB' }
	const warlockSorcerer = character([
		{ ...WARLOCK, subclass: null, level: 6 },
		{ ...SORCERER, subclass: null, level: 3 },
	])

	it('Warlock 6 / Sorcerer 3 levelling Sorcerer to 4 (character level 10) gets the Sorcerer ASI', () => {
		const gains = levelGainsFor(warlockSorcerer, SORCERER, CLASSES, RESOLVER)
		expect(gains).toMatchObject({ level: 10, classLevel: 4, className: 'Sorcerer', unresolved: null })
		expect(gains.steps.featAsi).toMatchObject({ status: 'adds', count: 1, parts: [{ name: 'Ability Score Improvement', count: 1 }] })
		// Sorcerer 3 → 4: one more cantrip and one more prepared spell; Warlock's counts are not part of the delta.
		expect(partCount(gains.steps.spells, 'Cantrips')).toBe(1)
		expect(partCount(gains.steps.spells, 'Leveled spells')).toBe(1)
	})

	it('Warlock 6 / Sorcerer 3 levelling Warlock to 7 gets no ASI', () => {
		const gains = levelGainsFor(warlockSorcerer, WARLOCK, CLASSES, RESOLVER)
		expect(gains).toMatchObject({ level: 10, classLevel: 7, className: 'Warlock' })
		expect(gains.steps.featAsi.status).toBe('none')
	})

	it('Warlock 6 taking Sorcerer 1: Sorcerer 1 cantrips and spells, hit points, no ASI', () => {
		const warlock = character([{ ...WARLOCK, subclass: null, level: 6 }])
		const gains = levelGainsFor(warlock, SORCERER, CLASSES, RESOLVER)
		expect(gains).toMatchObject({ level: 7, classLevel: 1, className: 'Sorcerer', unresolved: null })
		expect(gains.steps.spells.parts).toEqual([
			{ name: 'Cantrips', count: 4 },
			{ name: 'Leveled spells', count: 2 },
		])
		expect(gains.steps.hitPoints).toMatchObject({ status: 'adds', count: 1 })
		expect(gains.steps.featAsi.status).toBe('none')
		expect(gains.steps.languages.status).toBe('none')
	})

	it('a class joined later never gets its starting tool picks (Bard instruments), which a Bard of its own level 1 has', () => {
		const classes = [...CLASSES, { entryType: 'class', name: 'Bard', source: 'XPHB', subclassTitle: 'Bard Subclass', hd: { number: 1, faces: 8 }, classFeatureIds: [], classFeatures: [] }]
		const resolver = { ...RESOLVER, classFeatures: [...(RESOLVER.classFeatures as unknown[]), { id: 'cf|bard', name: 'Bard Subclass', className: 'Bard', classSource: 'XPHB', level: 3, entries: [] }] }
		const warlock = character([{ ...WARLOCK, subclass: null, level: 6 }])
		const gains = levelGainsFor(warlock, { className: 'Bard', classSource: 'XPHB' }, classes, resolver)
		expect(gains.classLevel).toBe(1)
		expect(gains.steps.languages.status).toBe('none')
		expect(gains.steps.equipment.status).toBe('never')
	})

	it('Fighter 4 taking Wizard 1: no Fighter weapon mastery, fighting style or features', () => {
		const fighter4 = character([{ className: 'Fighter', classSource: 'XPHB', subclass: 'Champion', level: 4 }])
		const gains = levelGainsFor(fighter4, WIZARD, CLASSES, RESOLVER)
		expect(gains).toMatchObject({ level: 5, classLevel: 1, className: 'Wizard' })
		expect(partCount(gains.steps.class, 'Weapon Mastery')).toBe(0)
		expect(gains.steps.class.status).toBe('none')
		expect(gains.newFeatures).toEqual([])
		expect(partCount(gains.steps.spells, 'Cantrips')).toBe(3)
		expect(partCount(gains.steps.spells, 'Leveled spells')).toBe(4)
	})

	it('a class level or character level above 20 is unresolved', () => {
		const high = character([
			{ ...WARLOCK, subclass: null, level: 17 },
			{ ...SORCERER, subclass: null, level: 3 },
		])
		expect(levelGainsFor(high, WARLOCK, CLASSES, RESOLVER).unresolved).toContain('Level 21')
	})
})
