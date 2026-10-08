import { describe, expect, it, vi } from 'vitest'
import type { Character } from '../storage/character'
import type { CharacterStore } from '../storage/characterStore'
import { assignHeldPicks, grantSlots, type HeldPickGrant } from './heldClassPicks'
import { activeClassPicks, sameWizardData, saveCharacter, unfinishedHeldClasses, wizardDataFromCharacter, wizardReducer, type WizardControllerState, type WizardData } from './wizardState'

const X = 'XPHB'
const WIZARD = { className: 'Wizard', classSource: X }
const ROGUE = { className: 'Rogue', classSource: X }
const SCHOLAR = ['arcana', 'history', 'investigation', 'medicine', 'nature', 'religion']
// Wizard Scholar: 1 at class level 2. Rogue: 2 at class level 1.
const wizardGrant: HeldPickGrant = { ...WIZARD, countsByLevel: [null, 1, 1], allowed: SCHOLAR }
const rogueGrant: HeldPickGrant = { ...ROGUE, countsByLevel: [2], allowed: null }
const LEVEL_ORDER = [WIZARD, WIZARD, WIZARD, ROGUE]

describe('assignHeldPicks (D335)', () => {
	it('gives a stamped pick to the class that took that character level', () => {
		const owners = assignHeldPicks([{ name: 'arcana', level: 2 }, { name: 'stealth', level: 4 }, { name: 'perception', level: 4 }], LEVEL_ORDER, [wizardGrant, rogueGrant])
		expect(owners).toEqual({ arcana: 'Wizard|XPHB', stealth: 'Rogue|XPHB', perception: 'Rogue|XPHB' })
	})

	it('without a stamp, the first class in levelOrder order that allows the name and has room takes it', () => {
		const owners = assignHeldPicks([{ name: 'stealth' }, { name: 'history' }, { name: 'arcana' }], LEVEL_ORDER, [rogueGrant, wizardGrant])
		// Stealth is not a Scholar skill; History fills the Wizard's one slot, so Arcana goes to the Rogue.
		expect(owners).toEqual({ stealth: 'Rogue|XPHB', history: 'Wizard|XPHB', arcana: 'Rogue|XPHB' })
	})

	it('a stamp on a level of a class that does not grant the pick falls back to the same rule', () => {
		const fighter = { className: 'Fighter', classSource: X }
		const owners = assignHeldPicks([{ name: 'stealth', level: 1 }], [fighter, ROGUE], [{ ...fighter, countsByLevel: [null], allowed: null }, { ...ROGUE, countsByLevel: [2], allowed: null }])
		expect(owners).toEqual({ stealth: 'Rogue|XPHB' })
	})

	it('with no class allowing the name or with room, the first granting class takes it; with no granting class, none does', () => {
		expect(assignHeldPicks([{ name: 'arcana' }, { name: 'stealth' }], LEVEL_ORDER, [wizardGrant])).toEqual({ arcana: 'Wizard|XPHB', stealth: 'Wizard|XPHB' })
		expect(assignHeldPicks([{ name: 'stealth' }], LEVEL_ORDER, [{ ...ROGUE, countsByLevel: [], allowed: null }])).toEqual({})
	})
})

describe('grantSlots (D335)', () => {
	it('maps each new pick of a class level to the character level that class level was taken at', () => {
		expect(grantSlots(wizardGrant, LEVEL_ORDER)).toEqual([2])
		expect(grantSlots(rogueGrant, LEVEL_ORDER)).toEqual([4, 4])
		expect(grantSlots({ ...ROGUE, countsByLevel: [2], allowed: null }, [ROGUE, WIZARD])).toEqual([1, 1])
	})
})

describe('multiclass Edit per-class Expertise (D335)', () => {
	function stored(expertiseSkills: Character['expertiseSkills']): Character {
		return {
			id: 'w1',
			name: 'Wren',
			classes: [
				{ ...WIZARD, subclass: 'Evoker', level: 3 },
				{ ...ROGUE, subclass: null, level: 1 },
			],
			levelOrder: LEVEL_ORDER,
			abilityScores: { method: 'standardArray', scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 15, wisdom: 12, charisma: 10 } },
			species: { name: 'Elf', source: X },
			background: { name: 'Sage', source: X, skillProficiencies: ['arcana', 'history'], toolProficiency: "Calligrapher's Supplies" },
			abilityBonus: { intelligence: 2, constitution: 1 },
			languages: [
				{ name: 'Common', source: X, grantedBy: 'automatic' },
				{ name: 'Draconic', source: X, grantedBy: 'creation' },
				{ name: 'Dwarvish', source: X, grantedBy: 'creation' },
			],
			classSkills: ['investigation', 'medicine'],
			multiclassPicks: [{ ...ROGUE, kind: 'skill', name: 'stealth' }],
			expertiseSkills,
			grantedFeats: [{ origin: 'background', name: 'Magic Initiate', source: X }],
			hitPointLevels: [2, 3, 4].map((level) => ({ level, kind: 'average' as const, dieResult: 4 })),
		}
	}
	const lookups = {
		subclasses: [],
		spellLevels: [],
		heldClasses: [
			{ ...WIZARD, subclasses: [], featureTypes: [], expertiseGrant: { countsByLevel: wizardGrant.countsByLevel, allowed: SCHOLAR } },
			{ ...ROGUE, subclasses: [], featureTypes: [], expertiseGrant: { countsByLevel: rogueGrant.countsByLevel, allowed: null } },
		],
	}
	const save = (data: WizardData, existing: Character): Character['expertiseSkills'] => {
		const store = { update: vi.fn((id: string) => ({ id, name: 'Wren', classes: [] })) } as unknown as CharacterStore
		saveCharacter(store, data, ['arcana', 'history'], { characterLevel: 1, editingExistingCharacter: true }, undefined, existing)
		return vi.mocked(store.update).mock.calls[0]![1].expertiseSkills
	}
	const STAMPED = [{ name: 'history', level: 2 }, { name: 'stealth', level: 4 }, { name: 'investigation', level: 4 }]

	it('seeds each pick to its class; the active class sees only its own', () => {
		const data = wizardDataFromCharacter(stored(STAMPED), lookups)
		expect(activeClassPicks(data, 'expertiseSkills')).toEqual(['history'])
		const rogue = wizardReducer({ step: 'class', data }, { type: 'switchClass', to: ROGUE }).data
		expect(activeClassPicks(rogue, 'expertiseSkills')).toEqual(['stealth', 'investigation'])
	})

	it('an unchanged save keeps every stamp', () => {
		const existing = stored(STAMPED)
		expect(save(wizardDataFromCharacter(existing, lookups), existing)).toEqual(STAMPED)
	})

	it('a replaced pick inherits a stamp of its own class, not of the other class', () => {
		const existing = stored(STAMPED)
		const data = wizardReducer({ step: 'class', data: wizardDataFromCharacter(existing, lookups) }, { type: 'setActiveClassPicks', field: 'expertiseSkills', picks: ['arcana'] }).data
		expect(save(data, existing)).toEqual([{ name: 'stealth', level: 4 }, { name: 'investigation', level: 4 }, { name: 'arcana', level: 2 }])
	})

	it('a legacy pick without a stamp, replaced, takes the class grant level', () => {
		const existing = stored([{ name: 'history' }, { name: 'stealth' }, { name: 'investigation' }])
		const data = wizardReducer({ step: 'class', data: wizardDataFromCharacter(existing, lookups) }, { type: 'setActiveClassPicks', field: 'expertiseSkills', picks: ['arcana'] }).data
		expect(save(data, existing)).toEqual([{ name: 'stealth' }, { name: 'investigation' }, { name: 'arcana', level: 2 }])
	})

	it('D337: a kept pick without a stamp holds the lowest slot of its class, so a new pick takes the next one', () => {
		const existing: Character = {
			...stored([{ name: 'history', level: 2 }, { name: 'stealth' }]),
			classes: [
				{ ...WIZARD, subclass: 'Evoker', level: 3 },
				{ ...ROGUE, subclass: null, level: 2 },
			],
			levelOrder: [...LEVEL_ORDER, ROGUE],
			hitPointLevels: [2, 3, 4, 5].map((level) => ({ level, kind: 'average' as const, dieResult: 4 })),
		}
		// Rogue slots at character levels 4 and 5.
		const twoLevelLookups = { ...lookups, heldClasses: [lookups.heldClasses[0]!, { ...lookups.heldClasses[1]!, expertiseGrant: { countsByLevel: [1, 2], allowed: null } }] }
		let state: WizardControllerState = { step: 'class', data: wizardDataFromCharacter(existing, twoLevelLookups) }
		state = wizardReducer(wizardReducer(state, { type: 'switchClass', to: ROGUE }), { type: 'setActiveClassPicks', field: 'expertiseSkills', picks: ['stealth', 'perception'] })
		state = wizardReducer(state, { type: 'switchClass', to: WIZARD })
		expect(save(state.data, existing)).toEqual([{ name: 'history', level: 2 }, { name: 'stealth' }, { name: 'perception', level: 5 }])
	})

	it('D337: a pick added and removed again leaves the data equal to its seed', () => {
		const seed = wizardDataFromCharacter(stored(STAMPED), lookups)
		const added = wizardReducer({ step: 'class', data: seed }, { type: 'setActiveClassPicks', field: 'expertiseSkills', picks: ['history', 'arcana'] })
		const removed = wizardReducer(added, { type: 'setActiveClassPicks', field: 'expertiseSkills', picks: ['history'] })
		expect(sameWizardData(added.data, seed)).toBe(false)
		expect(sameWizardData(removed.data, seed)).toBe(true)
	})

	it('D337: a class whose grant failed to load keeps the picks stamped with its levels', () => {
		const failed = { ...lookups, heldClasses: [lookups.heldClasses[0]!, { ...ROGUE, subclasses: [], featureTypes: [], grantLoadFailed: true }] }
		const data = wizardDataFromCharacter(stored(STAMPED), failed)
		expect(data.pickOwners?.expertiseSkills.owners).toEqual({ history: 'Wizard|XPHB', stealth: 'Rogue|XPHB', investigation: 'Rogue|XPHB' })
	})

	it('a stashed class short of its Expertise is unfinished', () => {
		const existing = stored(STAMPED)
		let state: WizardControllerState = { step: 'class', data: wizardDataFromCharacter(existing, lookups) }
		state = wizardReducer(wizardReducer(state, { type: 'switchClass', to: ROGUE }), { type: 'setActiveClassPicks', field: 'expertiseSkills', picks: ['stealth'] })
		state = wizardReducer(state, { type: 'switchClass', to: WIZARD })
		const unfinished = unfinishedHeldClasses(state.data, (cls) => (cls.classChoice.className === 'Rogue' ? { expertise: { count: 2, stale: 0 } } : {}))
		expect(unfinished).toEqual([{ ...ROGUE, missing: ['choose 1 more Expertise skill'] }])
	})
})
