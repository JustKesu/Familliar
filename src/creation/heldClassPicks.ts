import type { LeveledChoice } from '../storage/character'

interface ClassRef {
	className: string
	classSource: string
}

/** D335: one held class's grant of Expertise or weapon masteries. */
export interface HeldPickGrantData {
	/** The class's own count at each class level up to the one it holds; index 0 = class level 1, null = no grant yet. */
	countsByLevel: readonly (number | null)[]
	/** null = any name; otherwise the only names the class may pick (Scholar). */
	allowed: readonly string[] | null
	/** D337: the grant could not be loaded; the class still keeps the picks stamped with its own levels. */
	loadFailed?: boolean
}

export type HeldPickGrant = ClassRef & HeldPickGrantData

/** D335: which held class of a multiclass Edit each Expertise or mastery pick belongs to. */
export interface HeldPickOwners {
	/** Pick name → class key. A name without an entry belongs to no held class (none grants the pick) and passes through save. */
	owners: Record<string, string>
	/** The owners at seed — whose stamp each stored pick carries; the save pairs within one class by it. */
	seeded: Record<string, string>
	/** Class key → the character levels its grant slots came at, ascending, one per pick. */
	slots: Record<string, number[]>
}

export const classKey = (cls: ClassRef): string => `${cls.className}|${cls.classSource}`

const sameClass = (a: ClassRef, b: ClassRef): boolean => a.className === b.className && a.classSource === b.classSource

const grantCount = (grant: HeldPickGrantData): number => grant.countsByLevel[grant.countsByLevel.length - 1] ?? 0

/**
 * D335: a stored pick belongs to the class that took the character level stamped on it, when that class grants the pick.
 * Any other pick goes to the first granting class in levelOrder order that allows the name and has room, else to the
 * first granting class. With no granting class it belongs to none.
 */
export function assignHeldPicks(picks: readonly LeveledChoice[], levelOrder: readonly ClassRef[], grants: readonly HeldPickGrant[]): Record<string, string> {
	const granting = grants.filter((grant) => grantCount(grant) > 0)
	const firstLevel = (grant: ClassRef): number => {
		const index = levelOrder.findIndex((entry) => sameClass(entry, grant))
		return index === -1 ? Number.MAX_SAFE_INTEGER : index
	}
	const ordered = [...granting].sort((a, b) => firstLevel(a) - firstLevel(b))
	const owners: Record<string, string> = {}
	const used = new Map<string, number>()
	const take = (name: string, grant: HeldPickGrant): void => {
		owners[name] = classKey(grant)
		used.set(classKey(grant), (used.get(classKey(grant)) ?? 0) + 1)
	}
	const unstamped: LeveledChoice[] = []
	for (const pick of picks) {
		const taker = pick.level === undefined ? undefined : levelOrder[pick.level - 1]
		const grant = taker && (granting.find((candidate) => sameClass(candidate, taker)) ?? grants.find((candidate) => candidate.loadFailed && sameClass(candidate, taker)))
		if (grant) take(pick.name, grant)
		else unstamped.push(pick)
	}
	for (const pick of unstamped) {
		const grant =
			ordered.find((candidate) => (candidate.allowed === null || candidate.allowed.includes(pick.name)) && (used.get(classKey(candidate)) ?? 0) < grantCount(candidate)) ?? ordered[0]
		if (grant) take(pick.name, grant)
	}
	return owners
}

/** D335: the character level of each pick slot the class's grant opened, ascending — the class's k-th level is its k-th entry in levelOrder. */
export function grantSlots(grant: HeldPickGrant, levelOrder: readonly ClassRef[]): number[] {
	const characterLevels = levelOrder.flatMap((entry, index) => (sameClass(entry, grant) ? [index + 1] : []))
	const slots: number[] = []
	let opened = 0
	grant.countsByLevel.forEach((count, index) => {
		const at = characterLevels[index]
		for (; opened < (count ?? 0); opened++) if (at !== undefined) slots.push(at)
	})
	return slots
}

export function heldPickOwners(picks: readonly LeveledChoice[], levelOrder: readonly ClassRef[], grants: readonly HeldPickGrant[]): HeldPickOwners {
	const owners = assignHeldPicks(picks, levelOrder, grants)
	return { owners, seeded: { ...owners }, slots: Object.fromEntries(grants.map((grant) => [classKey(grant), grantSlots(grant, levelOrder)])) }
}

export function ownedPicks(names: readonly string[], owners: Readonly<Record<string, string>>, cls: ClassRef): string[] {
	return names.filter((name) => owners[name] === classKey(cls))
}

/** D335: replaces one class's picks; the other classes' keep their place in the list. */
export function withOwnedPicks(
	names: readonly string[],
	held: Pick<HeldPickOwners, 'owners' | 'seeded'>,
	cls: ClassRef,
	picks: readonly string[],
): { names: string[]; owners: Record<string, string> } {
	const key = classKey(cls)
	const kept = names.filter((name) => held.owners[name] !== key || picks.includes(name))
	const nextNames = [...kept, ...picks.filter((name) => !kept.includes(name))]
	const owners = { ...held.owners, ...Object.fromEntries(picks.map((name) => [name, key])) }
	// D337: an owner entry for a pick added and removed again in this run goes, so the data matches its seed again.
	for (const name of Object.keys(owners)) if (!nextNames.includes(name) && !(name in held.seeded)) delete owners[name]
	return { names: nextNames, owners }
}
