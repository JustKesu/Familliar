import type { CharacterResource } from './resources'

type PoolResource = Pick<CharacterResource, 'name' | 'max' | 'pool' | 'className'>

/** D336: the play.resourceUses key of one class's share of a pool, used only while two or more held classes grant it. */
export function classPoolKey(pool: string, className: string): string {
	return `${pool} (${className})`
}

/** The key a feature of `className` spends `candidate` under: that class's own pool while the pool is split (D336), else the candidate unchanged. */
export function resourceKeyFor(candidate: string, className: string | null, resources: readonly PoolResource[]): string {
	if (className === null) return candidate
	return resources.find((resource) => resource.pool === candidate && resource.className === className)?.name ?? candidate
}

/**
 * D336 rule 6: a count saved under the plain pool name while the pool is split
 * goes to the pool of the first class in `classOrder` that has one, capped at its
 * maximum. Read-time only; the next write stores the moved key. Level removal
 * passes `capAtMax` false and clamps afterwards, so its dropped list reports the cut.
 */
export function withLegacyPoolUses(
	uses: Record<string, number>,
	resources: readonly PoolResource[],
	classOrder: readonly string[],
	capAtMax = true,
): Record<string, number> {
	let result = uses
	for (const pool of new Set(resources.flatMap((resource) => (resource.pool ? [resource.pool] : [])))) {
		const spent = result[pool]
		if (spent === undefined) continue
		const shares = resources.filter((resource) => resource.pool === pool)
		const target = classOrder.map((className) => shares.find((share) => share.className === className)).find((share) => share !== undefined) ?? shares[0]
		const { [pool]: _legacy, ...rest } = result
		const total = (rest[target.name] ?? 0) + spent
		const next = capAtMax && target.max.status === 'known' ? Math.min(total, target.max.value) : total
		result = next > 0 ? { ...rest, [target.name]: next } : rest
	}
	return result
}

/**
 * D336 rule 2 after a level change: a split pool that only one class still
 * grants goes back to its plain key, carrying that class's spent count. Another
 * class's key is left as it is, for resourceUsesWithinMaxima and D332 to treat
 * like any key the new list no longer claims.
 */
export function poolUsesAfterLevelChange(
	uses: Record<string, number>,
	before: readonly PoolResource[],
	after: readonly PoolResource[],
	grantersAfter: (pool: string) => readonly string[],
): Record<string, number> {
	const result = { ...uses }
	const afterNames = new Set(after.map((resource) => resource.name))
	for (const share of before) {
		if (!share.pool || !share.className || afterNames.has(share.name) || !afterNames.has(share.pool)) continue
		const granters = grantersAfter(share.pool)
		if (granters.length !== 1 || granters[0] !== share.className) continue
		const spent = result[share.name]
		delete result[share.name]
		if (spent !== undefined) result[share.pool] = spent
	}
	return result
}
