/*
 * What a Short Rest and a Long Rest do to everything Character.play tracks
 * (build order step 9, slice 9b5). Pure (D38): the caller resolves the resource
 * list, the two slot pools' recovery and the hit-point maximum before asking.
 *
 * WHAT A SHORT REST RETURNS is not uniform, and the data is what says so
 * (scripts/investigate-rest-recovery*.js, DATA.md): Channel Divinity, Rage,
 * Second Wind, Wild Shape and the Psionic Energy Die give back ONE use, Focus
 * Points and Pact Magic slots give back ALL, and Favored Enemy and Sorcery
 * Points give back nothing until a Long Rest. A rest that emptied every
 * short-rest pool would hand back uses the rules withhold.
 *
 * Spending a hit die during a Short Rest is not here: it needs the dice panel
 * (build order step 9c), and nothing can spend one yet. A Long Rest still
 * returns every spent hit die, so the reset exists and is correct the moment
 * 9c ships the spend control.
 *
 * Temporary hit points are in neither function. The 2024 rules do not end them
 * on a rest — they are lost at 0 hit points or replaced by a new grant (D110) —
 * and leaving the field out of RestFields is what keeps a rest from touching it.
 */

import type { RestRecovery } from '../calculation/resources'
import { applyHealing } from '../hitPoints/damageHealing'
import type { CharacterPlayState } from '../storage/character'
import type { RestFields } from '../storage/characterStore'

/** The part of a resource a rest cares about — CharacterResource satisfies it, so the sheet passes its own list through. */
export interface RestingResource {
	name: string
	shortRest: RestRecovery | null
}

/**
 * A Short Rest. Only what the feature text returns on one moves: every resource
 * whose recovery is 'all' is emptied, every 'one' has a single use returned, and
 * Pact Magic slots follow their own feature the same way. Ordinary spell slots
 * (D11), hit dice, current and temporary hit points are passed through untouched.
 */
export function afterShortRest(
	currentHp: number | undefined,
	play: CharacterPlayState | undefined,
	resources: readonly RestingResource[],
	pactRecovery: RestRecovery | null,
): RestFields {
	const recoveries = new Map(resources.map((resource) => [resource.name, resource.shortRest]))
	const resourceUses: Record<string, number> = {}
	for (const [name, spent] of Object.entries(play?.resourceUses ?? {})) {
		const recovery = recoveries.get(name) ?? null
		// A key no resource in the list claims is left alone, the same reasoning resourceUsesWithinMaxima gives.
		const next = recovery === 'all' ? 0 : recovery === 'one' ? Math.max(0, spent - 1) : spent
		if (next > 0) resourceUses[name] = next
	}

	const spentSpellSlots = { ...play?.spentSpellSlots }
	if (pactRecovery !== null) spentSpellSlots.pact = pactRecovery === 'all' ? 0 : Math.max(0, (spentSpellSlots.pact ?? 0) - 1)

	return {
		currentHp,
		resourceUses,
		spentSpellSlots,
		spentHitDice: play?.spentHitDice,
	}
}

/**
 * A Long Rest. Every pool the app tracks comes back — resources, both slot pools
 * and every spent hit die (the 2024 rules return all of them, not half) — and the
 * character heals to full through the same applyHealing the damage/healing panel
 * uses, so a current sitting above a lowered maximum is not pulled down (D110).
 *
 * `maxHitPoints` is null when the maximum cannot be computed: the hit points are
 * then left exactly as they are rather than healed to a guessed number (D43).
 */
export function afterLongRest(currentHp: number | undefined, play: CharacterPlayState | undefined, maxHitPoints: number | null): RestFields {
	const healed =
		currentHp === undefined || maxHitPoints === null
			? currentHp
			: applyHealing({ currentHp, temporaryHitPoints: play?.temporaryHitPoints ?? 0 }, maxHitPoints, maxHitPoints).currentHp

	return { currentHp: healed, resourceUses: {}, spentSpellSlots: {}, spentHitDice: {} }
}
