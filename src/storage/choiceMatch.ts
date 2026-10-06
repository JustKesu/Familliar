/** D318: the one matching rule for a stored option pick (fighting style, optional-feature pick) against a data row. */
export interface StoredPick {
	name: string
	source?: string
}

/** D318: with a source, name AND source must match; without one (saved before schema 58), the name alone — as before. */
export function matchesPick(pick: StoredPick, candidate: { name: string; source: string }): boolean {
	return pick.name.trim().toLowerCase() === candidate.name.trim().toLowerCase() && (pick.source === undefined || pick.source === candidate.source)
}

/** D319: D318's rule for play.concentratingOn, but the name compared exactly, as the sheet did before schema 59. */
export function matchesConcentration(stored: StoredPick, spell: { name: string; source: string }): boolean {
	return stored.name === spell.name && (stored.source === undefined || stored.source === spell.source)
}

/** The first row the pick matches — for a sourceless pick, the first same-named row, exactly as before schema 58. */
export function findPicked<T extends { name: string; source: string }>(candidates: readonly T[], pick: StoredPick): T | undefined {
	return candidates.find((candidate) => matchesPick(pick, candidate))
}
