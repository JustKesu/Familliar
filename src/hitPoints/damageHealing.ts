/*
 * D110: what damage, healing and a grant of temporary hit points do to the two
 * hit-point piles. Pure arithmetic over numbers — the caller resolves "not set"
 * and the maximum (computeMaxHitPoints, never a stored number, because
 * maxHpOverride exists) before asking.
 */

export interface HitPointPools {
	readonly currentHp: number
	/** 0 is none — the storage layer writes that as the field's absence. */
	readonly temporaryHitPoints: number
}

/** Damage spends temporary hit points first and only the remainder off current hit points, which stops at 0 (D110). */
export function applyDamage(pools: HitPointPools, amount: number): HitPointPools {
	const damage = Math.max(0, amount)
	const temporaryHitPoints = Math.max(0, pools.temporaryHitPoints - damage)
	const remainder = damage - (pools.temporaryHitPoints - temporaryHitPoints)
	return { currentHp: Math.max(0, pools.currentHp - remainder), temporaryHitPoints }
}

/** Healing stops at `maxHitPoints` and never restores temporary hit points — they are not damage taken (D110). */
export function applyHealing(pools: HitPointPools, amount: number, maxHitPoints: number): HitPointPools {
	const healed = Math.min(maxHitPoints, pools.currentHp + Math.max(0, amount))
	// The outer max keeps healing from LOWERING a current that already sits above the maximum, which a lowered maximum leaves behind.
	return { ...pools, currentHp: Math.max(pools.currentHp, healed) }
}

/** Temporary hit points never stack: a grant replaces what is there, and the higher value wins (D110). */
export function grantTemporaryHitPoints(pools: HitPointPools, amount: number): HitPointPools {
	return { ...pools, temporaryHitPoints: Math.max(pools.temporaryHitPoints, Math.max(0, amount)) }
}
