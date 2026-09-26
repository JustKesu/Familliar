import type { Ability } from '../abilities/abilityScores'
import type { SpellUsage } from '../spells/subclassPreparedSpells'
import { ABILITY_ABBREVIATIONS } from './abilityAbbreviations'
import type { AbilityScoreValue } from './abilityScores'
import { type CharacterResource, resolveResourceName } from './resources'
import { type Calculated, known, unknown } from './types'

/** One source's grant of a spell (SpellList.tsx's SpellGrant). */
export interface FreeCastGrant {
	origin: string
	originName: string
	usage: SpellUsage | null
}

export interface FreeCastSpell {
	name: string
	source: string
	grants: readonly FreeCastGrant[]
}

/*
 * D190: where a feature or species trait already has use boxes for these very
 * casts, the free cast spends that record (one record, shown in several places)
 * instead of a spell: key. Source name -> lowercase spell name -> resource name.
 */
const SHARED_OWNERS: Record<string, Record<string, string>> = {
	'Gnome; Forest Gnome Lineage': { 'speak with animals': 'Gnomish Lineage (Forest Gnome)' },
	'Yuan-Ti': { suggestion: 'Serpentine Spellcasting' },
	// EFA Chemical Mastery: "Once you use this feature, you can't use it again until you finish a Long Rest." sits inside its Conjured Cauldron benefit.
	Alchemist: { "tasha's bubbling cauldron": 'Chemical Mastery', 'lesser restoration': 'Restorative Reagents' },
	'Archfey Patron': { 'misty step': 'Steps of the Fey' },
	// D193: class-record grants; the origin name is the class.
	Paladin: { 'divine smite': "Paladin's Smite", 'find steed': 'Faithful Steed' },
	Warlock: { 'contact other plane': 'Contact Patron' },
}

const ABILITY_BY_ABBREVIATION = Object.fromEntries(Object.entries(ABILITY_ABBREVIATIONS).map(([ability, abbreviation]) => [abbreviation, ability])) as Record<
	string,
	Ability
>

export interface FreeCastCounter {
	/** The `play.resourceUses` key the free cast spends. */
	key: string
	cost: number
}

/** What one grant's free cast spends, or null when it has no counter (a slot cast, at will, no slot, ritual). */
export function freeCastCounter(spell: { name: string; source: string }, grant: FreeCastGrant): FreeCastCounter | null {
	switch (grant.usage?.kind) {
		case 'resource':
			return { key: resolveResourceName(grant.usage.resourceName), cost: grant.usage.cost }
		case 'onceFreePerLongRest':
		case 'onceFreePerShortOrLongRest':
		case 'freePerLongRestByAbility':
		case 'freePerLongRestByProficiencyBonus': {
			const spellName = spell.name.toLowerCase()
			const key = SHARED_OWNERS[grant.originName]?.[spellName] ?? `spell:${grant.origin}:${grant.originName}:${spellName}|${spell.source.toUpperCase()}`
			return { key, cost: 1 }
		}
		default:
			return null
	}
}

function freeCastMax(usage: SpellUsage, label: string, abilityScores: Record<Ability, Calculated<AbilityScoreValue>>): Calculated<number> {
	if (usage.kind === 'freePerLongRestByAbility') {
		const score = abilityScores[ABILITY_BY_ABBREVIATION[usage.ability]]
		if (score.status === 'unknown') return unknown(score.reason)
		// Both texts: "a number of times equal to your … modifier (minimum of once)".
		const value = Math.max(1, score.value.modifier)
		return known(value, [{ source: `${label}: ${usage.ability.toUpperCase()} modifier (minimum 1)`, amount: value }])
	}
	if (usage.kind === 'freePerLongRestByProficiencyBonus') return known(usage.casts, [{ source: `${label}: Proficiency Bonus`, amount: usage.casts }])
	return known(1, [{ source: `${label}: once per rest`, amount: 1 }])
}

/**
 * One counter per counted free-cast grant (D190), per spell per source. A `resource`
 * grant spends an existing pool and adds nothing here. Pure (D38).
 */
export function freeCastResources(spells: readonly FreeCastSpell[], abilityScores: Record<Ability, Calculated<AbilityScoreValue>>): CharacterResource[] {
	const byKey = new Map<string, CharacterResource>()
	for (const spell of spells) {
		for (const grant of spell.grants) {
			const counter = freeCastCounter(spell, grant)
			if (!counter || !grant.usage || grant.usage.kind === 'resource' || byKey.has(counter.key)) continue
			byKey.set(counter.key, {
				name: counter.key,
				dataNames: [counter.key],
				max: freeCastMax(grant.usage, `${grant.originName}: ${spell.name}`, abilityScores),
				shortRest: grant.usage.kind === 'onceFreePerShortOrLongRest' ? 'all' : null,
			})
		}
	}
	return [...byKey.values()]
}

/** Appends the free-cast counters; a shared owner already in the list keeps its record, and takes the free-cast maximum only where its own is not in the data (Steps of the Fey, Restorative Reagents). */
export function withFreeCastResources(resources: readonly CharacterResource[], freeCast: readonly CharacterResource[]): CharacterResource[] {
	const pending = new Map(freeCast.map((resource) => [resource.name, resource]))
	const merged = resources.map((resource) => {
		const free = pending.get(resource.name)
		if (!free) return resource
		pending.delete(resource.name)
		return resource.max.status === 'known' ? resource : { ...resource, max: free.max }
	})
	return [...merged, ...pending.values()]
}

/** Display clamp after a level or score drop (D190): a spent count above the maximum shows as none left. */
export function remainingUses(max: number, spent: number): number {
	return Math.max(0, max - spent)
}

export function canSpendResource(max: number | undefined, spent: number, cost: number): boolean {
	return max !== undefined && remainingUses(max, spent) >= cost
}
