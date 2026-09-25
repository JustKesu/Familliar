import { describe, expect, it } from 'vitest'
import type { Ability } from '../abilities/abilityScores'
import type { SpellUsage } from '../spells/subclassPreparedSpells'
import type { AbilityScoreValue } from './abilityScores'
import { canSpendResource, freeCastCounter, freeCastResources, remainingUses, withFreeCastResources, type FreeCastSpell } from './freeCastResources'
import type { CharacterResource } from './resources'
import { type Calculated, known, unknown } from './types'

function scores(over: Partial<Record<Ability, number>> = {}): Record<Ability, Calculated<AbilityScoreValue>> {
	const abilities: Ability[] = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']
	return Object.fromEntries(
		abilities.map((ability) => {
			const score = over[ability] ?? 10
			return [ability, known({ score, modifier: Math.floor((score - 10) / 2) }, [])]
		}),
	) as Record<Ability, Calculated<AbilityScoreValue>>
}

function spell(name: string, origin: string, originName: string, usage: SpellUsage | null): FreeCastSpell {
	return { name, source: 'XPHB', grants: [{ origin, originName, usage }] }
}

function summary(resources: CharacterResource[]) {
	return resources.map((r) => [r.name, r.max.status === 'known' ? r.max.value : r.max.reason, r.shortRest])
}

describe('freeCastResources (D190)', () => {
	it('one counter per counted kind: 1/LR, 1/SR with a Short Rest flag, ability modifier, Proficiency Bonus', () => {
		const resources = freeCastResources(
			[
				spell('Hellish Rebuke', 'species', 'Tiefling; Infernal Legacy', { kind: 'onceFreePerLongRest' }),
				spell('Misty Step', 'feat', 'Fey Teleportation', { kind: 'onceFreePerShortOrLongRest' }),
				spell('Lesser Restoration', 'subclass', 'Some Patron', { kind: 'freePerLongRestByAbility', ability: 'int' }),
				spell('Speak with Animals', 'species', 'Some Gnome', { kind: 'freePerLongRestByProficiencyBonus', casts: 3 }),
			],
			scores({ intelligence: 18 }),
		)
		expect(summary(resources)).toEqual([
			['spell:species:Tiefling; Infernal Legacy:hellish rebuke|XPHB', 1, null],
			['spell:feat:Fey Teleportation:misty step|XPHB', 1, 'all'],
			['spell:subclass:Some Patron:lesser restoration|XPHB', 4, null],
			['spell:species:Some Gnome:speak with animals|XPHB', 3, null],
		])
	})

	it('an ability modifier below 1 still gives one cast ("minimum of once"); an unknown score gives no maximum', () => {
		const archfey = spell('Misty Step', 'subclass', 'Archfey Patron', { kind: 'freePerLongRestByAbility', ability: 'cha' })
		expect(summary(freeCastResources([archfey], scores({ charisma: 8 })))).toEqual([['Steps of the Fey', 1, null]])
		const noScores = { ...scores(), charisma: unknown<AbilityScoreValue>('Ability scores have not been set for this character yet.') }
		expect(summary(freeCastResources([archfey], noScores))).toEqual([['Steps of the Fey', 'Ability scores have not been set for this character yet.', null]])
	})

	it('grants with no counter add nothing: a slot cast, no slot, ritual, at will, and a resource cost', () => {
		const spells = [
			spell('Hex', 'subclass', 'Fiend Patron', null),
			spell('Mage Armor', 'optionalFeature', 'Armor of Shadows', { kind: 'noSlot' }),
			spell('Find Familiar', 'optionalFeature', 'Pact of the Chain', { kind: 'ritual' }),
			spell('Detect Magic', 'feat', 'Drow High Magic', { kind: 'atWill' }),
			spell('Darkness', 'subclass', 'Warrior of Shadow', { kind: 'resource', cost: 1, resourceName: 'Focus Point' }),
		]
		expect(freeCastResources(spells, scores())).toEqual([])
		expect(freeCastCounter(spells[4]!, spells[4]!.grants[0]!)).toEqual({ key: 'Focus Point', cost: 1 })
		expect(freeCastCounter({ name: 'Burning Hands', source: 'XGE' }, { origin: 'subclass', originName: 'Way of the Sun Soul', usage: { kind: 'resource', cost: 2, resourceName: 'Ki' } })).toEqual({
			key: 'Focus Point',
			cost: 2,
		})
	})

	it('shared owners use the existing resource name', () => {
		const owners = freeCastResources(
			[
				spell('Speak with Animals', 'species', 'Gnome; Forest Gnome Lineage', { kind: 'freePerLongRestByProficiencyBonus', casts: 2 }),
				spell('Suggestion', 'species', 'Yuan-Ti', { kind: 'onceFreePerLongRest' }),
				spell("Tasha's Bubbling Cauldron", 'subclass', 'Alchemist', { kind: 'onceFreePerLongRest' }),
				spell('Lesser Restoration', 'subclass', 'Alchemist', { kind: 'freePerLongRestByAbility', ability: 'int' }),
				spell('Misty Step', 'subclass', 'Archfey Patron', { kind: 'freePerLongRestByAbility', ability: 'cha' }),
			],
			scores({ intelligence: 14, charisma: 16 }),
		)
		expect(summary(owners)).toEqual([
			['Gnomish Lineage (Forest Gnome)', 2, null],
			['Serpentine Spellcasting', 1, null],
			['Chemical Mastery', 1, null],
			['Restorative Reagents', 2, null],
			['Steps of the Fey', 3, null],
		])
	})

	it('the same spell from the same source twice (Magic Initiate taken twice) shares one counter', () => {
		const bless = spell('Bless', 'feat', 'Magic Initiate', { kind: 'onceFreePerLongRest' })
		expect(freeCastResources([bless, bless], scores())).toHaveLength(1)
	})
})

describe('withFreeCastResources', () => {
	const owner = (name: string, max: Calculated<number>): CharacterResource => ({ name, dataNames: [name], max, shortRest: null })

	it('an owner with a known maximum keeps its record; one without takes the free-cast maximum; the rest are appended', () => {
		const existing = [
			owner('Gnomish Lineage (Forest Gnome)', known(3, [{ source: 'trait', amount: 3 }])),
			owner('Steps of the Fey', unknown('"Steps of the Fey" has no column')),
			owner('Rage', known(3, [])),
		]
		const free = freeCastResources(
			[
				spell('Speak with Animals', 'species', 'Gnome; Forest Gnome Lineage', { kind: 'freePerLongRestByProficiencyBonus', casts: 3 }),
				spell('Misty Step', 'subclass', 'Archfey Patron', { kind: 'freePerLongRestByAbility', ability: 'cha' }),
				spell('Bless', 'feat', 'Magic Initiate', { kind: 'onceFreePerLongRest' }),
			],
			scores({ charisma: 14 }),
		)
		const merged = withFreeCastResources(existing, free)
		expect(summary(merged)).toEqual([
			['Gnomish Lineage (Forest Gnome)', 3, null],
			['Steps of the Fey', 2, null],
			['Rage', 3, null],
			['spell:feat:Magic Initiate:bless|XPHB', 1, null],
		])
		expect(merged[0]).toBe(existing[0])
	})
})

describe('remainingUses / canSpendResource', () => {
	it('clamps at display and allows a spend only when enough remains', () => {
		expect(remainingUses(3, 5)).toBe(0)
		expect(remainingUses(3, 1)).toBe(2)
		expect(canSpendResource(5, 3, 2)).toBe(true)
		expect(canSpendResource(5, 4, 2)).toBe(false)
		expect(canSpendResource(undefined, 0, 1)).toBe(false)
	})
})
