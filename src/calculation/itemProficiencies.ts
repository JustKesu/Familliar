/*
 * What a custom item's proficiencies add to the numbers (R14b, D217). Pure
 * (D38): src/sheet/itemProficiencyData.ts resolves the inventory into grants.
 * The Proficiencies card reads the same grants in proficiencies.ts.
 *
 * An item that requires attunement and is not attuned still yields its grant,
 * marked with `withheldReason`; the numbers below show it as a zero-amount
 * "considered … not applied" line (D76) and count nothing from it.
 */

import type { Ability } from '../abilities/abilityScores'
import type { CustomItemProficiency } from '../storage/character'
import type { WeaponProficiencyGrant } from '../weapons/weaponProficiency'
import type { Contribution } from './types'

export interface ItemProficiencyGrant {
	/** The item as the player should see it: "Ring of Skill". */
	sourceName: string
	proficiency: CustomItemProficiency
	withheldReason?: string
}

/** The weapon grants isProficientWithWeapon reads. Only the applied ones. */
export function itemWeaponGrants(grants: readonly ItemProficiencyGrant[]): WeaponProficiencyGrant[] {
	return grants.flatMap(({ proficiency, withheldReason }): WeaponProficiencyGrant[] => {
		if (withheldReason !== undefined) return []
		if (proficiency.kind === 'weaponCategory') return [{ kind: 'category', category: proficiency.category }]
		if (proficiency.kind === 'weapon') return [{ kind: 'named', name: proficiency.name }]
		return []
	})
}

function consideredLine(grant: ItemProficiencyGrant, what: string): Contribution {
	return { source: grant.sourceName, amount: 0, note: `considered (${what}) — not applied: ${grant.withheldReason}` }
}

/** The items that make `ability` a proficient save, and the D76 lines for the ones that would but are not attuned. */
export function itemSaveProficiency(grants: readonly ItemProficiencyGrant[], ability: Ability): { sources: string[]; withheld: Contribution[] } {
	const own = grants.filter(({ proficiency }) => proficiency.kind === 'savingThrow' && proficiency.ability === ability)
	return {
		sources: own.filter((grant) => grant.withheldReason === undefined).map((grant) => grant.sourceName),
		withheld: own.filter((grant) => grant.withheldReason !== undefined).map((grant) => consideredLine(grant, 'saving throw proficiency')),
	}
}

/** Same for a skill; `expertise` is true when any applied item grants it. */
export function itemSkillProficiency(grants: readonly ItemProficiencyGrant[], skill: string): { sources: string[]; expertise: boolean; withheld: Contribution[] } {
	const own = grants.filter(({ proficiency }) => proficiency.kind === 'skill' && proficiency.skill === skill)
	const isExpertise = ({ proficiency }: ItemProficiencyGrant): boolean => proficiency.kind === 'skill' && proficiency.expertise === true
	const applied = own.filter((grant) => grant.withheldReason === undefined)
	return {
		sources: applied.map((grant) => grant.sourceName),
		expertise: applied.some(isExpertise),
		withheld: own.filter((grant) => grant.withheldReason !== undefined).map((grant) => consideredLine(grant, isExpertise(grant) ? 'expertise' : 'proficiency')),
	}
}
