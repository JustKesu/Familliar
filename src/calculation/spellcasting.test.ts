import { describe, expect, it } from 'vitest'
import type { Character } from '../storage/character'
import type { FeatEffectEntry } from './featEffects'
import { type ClassSpellcastingAbility, computeSpellcasting } from './spellcasting'

const wizardAbility: ClassSpellcastingAbility = { className: 'Wizard', classSource: 'XPHB', ability: 'int' }
const paladinAbility: ClassSpellcastingAbility = { className: 'Paladin', classSource: 'XPHB', ability: 'cha' }
const clericAbility: ClassSpellcastingAbility = { className: 'Cleric', classSource: 'XPHB', ability: 'wis' }
const fighterAbility: ClassSpellcastingAbility = { className: 'Fighter', classSource: 'XPHB', ability: null }

// D46: Eldritch Knight/Arcane Trickster keep their ability on the subclass entry (classes.json),
// not the base class — confirmed by scripts/investigate-subclass-spellcasting-ability.js.
const fighterWithEkAbility: ClassSpellcastingAbility = {
	className: 'Fighter',
	classSource: 'XPHB',
	ability: null,
	subclasses: [{ subclassName: 'Eldritch Knight', ability: 'int' }],
}
const rogueWithAtAbility: ClassSpellcastingAbility = {
	className: 'Rogue',
	classSource: 'XPHB',
	ability: null,
	subclasses: [{ subclassName: 'Arcane Trickster', ability: 'int' }],
	// Champion (Fighter) and other non-spellcasting subclasses carry no entry here — confirms a non-spellcasting subclass yields no ability, not an error.
}

const classData = [wizardAbility, paladinAbility, clericAbility, fighterAbility]
const thirdCasterClassData = [wizardAbility, paladinAbility, clericAbility, fighterWithEkAbility, rogueWithAtAbility]

const wizard5: Character = {
	id: '1',
	name: 'Wizard5',
	classes: [{ className: 'Wizard', classSource: 'XPHB', subclass: null, level: 5 }],
	abilityScores: {
		method: 'standardArray',
		scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 16, wisdom: 12, charisma: 10 },
	},
}

const paladin5: Character = {
	id: '2',
	name: 'Paladin5',
	classes: [{ className: 'Paladin', classSource: 'XPHB', subclass: null, level: 5 }],
	abilityScores: {
		method: 'standardArray',
		scores: { strength: 15, dexterity: 10, constitution: 14, intelligence: 8, wisdom: 12, charisma: 16 },
	},
}

const fighter5: Character = {
	id: '3',
	name: 'Fighter5',
	classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 5 }],
	abilityScores: {
		method: 'standardArray',
		scores: { strength: 16, dexterity: 14, constitution: 14, intelligence: 10, wisdom: 10, charisma: 8 },
	},
}

const eldritchKnight5: Character = {
	id: '7',
	name: 'EldritchKnight5',
	classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Eldritch Knight', level: 5 }],
	abilityScores: {
		method: 'standardArray',
		scores: { strength: 15, dexterity: 14, constitution: 14, intelligence: 13, wisdom: 10, charisma: 8 },
	},
}

const arcaneTrickster5: Character = {
	id: '8',
	name: 'ArcaneTrickster5',
	classes: [{ className: 'Rogue', classSource: 'XPHB', subclass: 'Arcane Trickster', level: 5 }],
	abilityScores: {
		method: 'standardArray',
		scores: { strength: 8, dexterity: 16, constitution: 14, intelligence: 15, wisdom: 10, charisma: 10 },
	},
}

const champion5: Character = {
	id: '9',
	name: 'Champion5',
	classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: 'Champion', level: 5 }],
	abilityScores: fighter5.abilityScores,
}

describe('computeSpellcasting', () => {
	it('a full caster (Wizard 5, INT): attack = INT mod + PB, DC = 8 + PB + INT mod', () => {
		const result = computeSpellcasting(wizard5, classData)
		expect(result.status).toBe('known')
		if (result.status !== 'known') return
		expect(result.value).toEqual([
			{
				className: 'Wizard',
				classSource: 'XPHB',
				ability: 'intelligence',
				spellAttackBonus: 6,
				spellAttackBreakdown: [
					{ source: 'intelligence modifier', amount: 3 },
					{ source: 'proficiency bonus', amount: 3 },
				],
				spellSaveDC: 14,
				spellSaveDCBreakdown: [
					{ source: 'base', amount: 8 },
					{ source: 'intelligence modifier', amount: 3 },
					{ source: 'proficiency bonus', amount: 3 },
				],
			},
		])
	})

	it('a half caster (Paladin 5, CHA): correct ability picked, correct numbers', () => {
		const result = computeSpellcasting(paladin5, classData)
		expect(result.status).toBe('known')
		if (result.status !== 'known') return
		expect(result.value).toEqual([
			{
				className: 'Paladin',
				classSource: 'XPHB',
				ability: 'charisma',
				spellAttackBonus: 6,
				spellAttackBreakdown: [
					{ source: 'charisma modifier', amount: 3 },
					{ source: 'proficiency bonus', amount: 3 },
				],
				spellSaveDC: 14,
				spellSaveDCBreakdown: [
					{ source: 'base', amount: 8 },
					{ source: 'charisma modifier', amount: 3 },
					{ source: 'proficiency bonus', amount: 3 },
				],
			},
		])
	})

	it('a non-caster (Fighter) contributes no entry — empty list, not a zero and not an error', () => {
		const result = computeSpellcasting(fighter5, classData)
		expect(result.status).toBe('known')
		if (result.status !== 'known') return
		expect(result.value).toEqual([])
	})

	it('D11: a two-class character with two different casting abilities gets two entries, each with its own ability and numbers', () => {
		const multiclass: Character = {
			id: '4',
			name: 'WizardCleric',
			classes: [
				{ className: 'Wizard', classSource: 'XPHB', subclass: null, level: 3 },
				{ className: 'Cleric', classSource: 'XPHB', subclass: null, level: 2 },
			],
			abilityScores: {
				method: 'standardArray',
				scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 16, wisdom: 15, charisma: 10 },
			},
		}
		const result = computeSpellcasting(multiclass, classData)
		expect(result.status).toBe('known')
		if (result.status !== 'known') return
		expect(result.value).toHaveLength(2)
		expect(result.value[0]).toMatchObject({ className: 'Wizard', ability: 'intelligence', spellAttackBonus: 6, spellSaveDC: 14 })
		expect(result.value[1]).toMatchObject({ className: 'Cleric', ability: 'wisdom', spellAttackBonus: 5, spellSaveDC: 13 })
	})

	it('returns unknown when a class is not in the supplied data (D43)', () => {
		const unknownClass: Character = {
			id: '5',
			name: 'Mystery',
			classes: [{ className: 'Made Up Class', classSource: 'XPHB', subclass: null, level: 1 }],
			abilityScores: wizard5.abilityScores,
		}
		const result = computeSpellcasting(unknownClass, classData)
		expect(result.status).toBe('unknown')
	})

	it('returns unknown when ability scores are missing', () => {
		const noScores: Character = { id: '6', name: 'Blank', classes: wizard5.classes }
		expect(computeSpellcasting(noScores, classData).status).toBe('unknown')
	})

	it('an ability-boosting feat raises the casting ability modifier, flowing into both attack and DC', () => {
		const featOfIntellect: FeatEffectEntry = {
			name: 'Fey Touched',
			source: 'XPHB',
			ability: [{ choose: { from: ['int', 'wis', 'cha'] } }],
		}
		const withFeat: Character = {
			...wizard5,
			abilityScores: {
				method: 'standardArray',
				scores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 13, wisdom: 12, charisma: 10 },
			},
			featAsiChoices: [{ level: 4, kind: 'feat', name: 'Fey Touched', source: 'XPHB', chosenAbility: 'intelligence' }],
		}
		const withoutFeat = computeSpellcasting({ ...withFeat, featAsiChoices: [] }, classData)
		const result = computeSpellcasting(withFeat, classData, [featOfIntellect])
		expect(withoutFeat.status).toBe('known')
		expect(result.status).toBe('known')
		if (withoutFeat.status !== 'known' || result.status !== 'known') return
		expect(result.value[0].spellAttackBonus).toBe(withoutFeat.value[0].spellAttackBonus + 1)
		expect(result.value[0].spellSaveDC).toBe(withoutFeat.value[0].spellSaveDC + 1)
	})

	it('D46: an Eldritch Knight (Fighter 5) gets its spellcasting ability (INT) from the subclass, not the base class', () => {
		const result = computeSpellcasting(eldritchKnight5, thirdCasterClassData)
		expect(result.status).toBe('known')
		if (result.status !== 'known') return
		expect(result.value).toEqual([
			{
				className: 'Fighter',
				classSource: 'XPHB',
				ability: 'intelligence',
				spellAttackBonus: 4,
				spellAttackBreakdown: [
					{ source: 'intelligence modifier', amount: 1 },
					{ source: 'proficiency bonus', amount: 3 },
				],
				spellSaveDC: 12,
				spellSaveDCBreakdown: [
					{ source: 'base', amount: 8 },
					{ source: 'intelligence modifier', amount: 1 },
					{ source: 'proficiency bonus', amount: 3 },
				],
			},
		])
	})

	it('D46: an Arcane Trickster (Rogue 5) gets its spellcasting ability (INT) from the subclass, not the base class', () => {
		const result = computeSpellcasting(arcaneTrickster5, thirdCasterClassData)
		expect(result.status).toBe('known')
		if (result.status !== 'known') return
		expect(result.value).toEqual([
			{
				className: 'Rogue',
				classSource: 'XPHB',
				ability: 'intelligence',
				spellAttackBonus: 5,
				spellAttackBreakdown: [
					{ source: 'intelligence modifier', amount: 2 },
					{ source: 'proficiency bonus', amount: 3 },
				],
				spellSaveDC: 13,
				spellSaveDCBreakdown: [
					{ source: 'base', amount: 8 },
					{ source: 'intelligence modifier', amount: 2 },
					{ source: 'proficiency bonus', amount: 3 },
				],
			},
		])
	})

	it('D46: a Fighter with a non-spellcasting subclass (Champion) contributes no entry — not an error, not a zero', () => {
		const result = computeSpellcasting(champion5, thirdCasterClassData)
		expect(result.status).toBe('known')
		if (result.status !== 'known') return
		expect(result.value).toEqual([])
	})
})
