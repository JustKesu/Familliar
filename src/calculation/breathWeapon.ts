import type { DamageResponseGrant } from './damageResponses'
import { type Calculated, known, unknown } from './types'

export const BREATH_WEAPON = 'Breath Weapon'

/** Both areas the player picks between per use (PHB 2024, Dragonborn). */
export const BREATH_WEAPON_AREAS = [
	{ type: 'cone', distance: { type: 'feet', amount: 15 } },
	{ type: 'line', distance: { type: 'feet', amount: 30 } },
] as const

// PHB 2024 Dragonborn, Breath Weapon: 1d10, +1d10 at character levels 5, 11 and 17. The data states it in prose only (D313).
export function breathWeaponDiceCount(characterLevel: number): number {
	return characterLevel >= 17 ? 4 : characterLevel >= 11 ? 3 : characterLevel >= 5 ? 2 : 1
}

export interface BreathWeapon {
	/** Dexterity save DC. */
	dc: Calculated<number>
	/** "2d10 Acid" — the dice and the damage type, the shape a spell row's damage line has. */
	damage: Calculated<string>
}

/**
 * `speciesGrants` are the species' damage-response grants (damageResponseData.ts):
 * the Draconic Ancestry's `resist` names the same type the breath deals (DATA.md),
 * so a concrete ancestry is one resistance with one type and the bare Dragonborn
 * record an unmade choice. Null while those grants are still loading.
 */
export function computeBreathWeapon(
	characterLevel: number,
	constitution: Calculated<{ modifier: number }>,
	proficiencyBonus: Calculated<number>,
	speciesGrants: readonly DamageResponseGrant[] | null,
): BreathWeapon {
	// PHB 2024: DC = 8 + Constitution modifier + Proficiency Bonus (D313).
	const dc: Calculated<number> =
		constitution.status === 'unknown'
			? unknown(constitution.reason)
			: proficiencyBonus.status === 'unknown'
				? unknown(proficiencyBonus.reason)
				: known(8 + constitution.value.modifier + proficiencyBonus.value, [
						{ source: 'base', amount: 8 },
						{ source: 'Constitution modifier', amount: constitution.value.modifier },
						{ source: 'Proficiency Bonus', amount: proficiencyBonus.value },
					])

	const dice = `${breathWeaponDiceCount(characterLevel)}d10`
	const resistance = speciesGrants?.find((grant) => grant.kind === 'resistance')
	let damage: Calculated<string>
	if (speciesGrants === null) damage = unknown('The species data is still loading.')
	else if (resistance?.choiceFrom) damage = unknown('The Draconic Ancestry has not been chosen, and the damage type comes from it.')
	else if (resistance?.damageTypes.length === 1) {
		const type = resistance.damageTypes[0]
		damage = known(`${dice} ${type.charAt(0).toUpperCase()}${type.slice(1)}`, [{ source: resistance.sourceName, amount: 0 }])
	} else damage = unknown(resistance?.unresolvedReason ?? 'No Draconic Ancestry damage type found for this species.')

	return { dc, damage }
}
