/*
 * D70 hand table: how many attacks the Attack action gives. The number is
 * carried in the FEATURE NAME and nowhere else — confirmed by
 * scripts/investigate-d70-prose-counts.js, which found no numeric field on any
 * of the 14 Extra Attack features (only `page`) and no class table column with
 * an attack count (Rogue's "Sneak Attack" column is dice, not attacks).
 *
 * The table is keyed by the exact feature name, not by pulling the number word
 * out of it: D70 rejects parsing, so "Two Extra Attacks" is looked up, never
 * decoded. A name not in the table gets null — a made-up attack count is worse
 * than none (D43-style silence, same rule the usage labels follow under D73).
 *
 * Nothing consumes this yet. Attacks are build order step 7; this exists so
 * that step starts from a checked table rather than re-deriving it.
 */

/**
 * Feature name -> TOTAL attacks per Attack action (not the number of EXTRA
 * attacks — "Extra Attack" grants one extra, for two total). Each value is the
 * feature's own sentence, PHB 2024 (XPHB):
 *
 *  "Extra Attack":       "You can attack twice instead of once whenever you take the Attack action on your turn."
 *  "Two Extra Attacks":  "You can attack three times instead of once whenever you take the Attack action on your turn."
 *  "Three Extra Attacks":"You can attack four times instead of once whenever you take the Attack action on your turn."
 *
 * "Extra Attack" is held by 12 features (Barbarian/Fighter/Monk/Paladin/Ranger
 * at 5, Artificer Armorer and Battle Smith at 5, Bard Swords and Valor at 6,
 * Wizard Bladesinging at 6); the other two names are Fighter's alone, at 11
 * and 20.
 */
export const TOTAL_ATTACKS_BY_FEATURE_NAME: Record<string, number> = {
	'Extra Attack': 2,
	'Two Extra Attacks': 3,
	'Three Extra Attacks': 4,
}

/** Total attacks the named feature grants per Attack action, or null when the name isn't one this table records. */
export function totalAttacksForFeatureName(featureName: string): number | null {
	return TOTAL_ATTACKS_BY_FEATURE_NAME[featureName] ?? null
}

/**
 * The attack count that applies to a character holding all of `featureNames`.
 * A Fighter at 11 holds both "Extra Attack" and "Two Extra Attacks"; the
 * features replace each other rather than stacking, so the highest wins.
 * Returns 1 — the ordinary single attack — when none of the names grants any,
 * since every character can take the Attack action.
 */
export function totalAttacksAmong(featureNames: readonly string[]): number {
	let total = 1
	for (const name of featureNames) {
		const attacks = totalAttacksForFeatureName(name)
		if (attacks !== null && attacks > total) total = attacks
	}
	return total
}
