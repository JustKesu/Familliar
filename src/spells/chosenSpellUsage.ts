import type { SpellUsage } from './subclassPreparedSpells'

/*
 * D21/D70 hand table: how a spell the PLAYER PICKED for a feat or a pact boon
 * is cast. The data's `additionalSpells` wrappers describe fixed grants; a
 * chosen spell arrives from storage with no wrapper, so the term has to be
 * read from each source's own rules text. A closed handful of sources checked
 * once (scripts/investigate-chosen-spell-usage-terms.js), each entry quoting
 * the sentence it came from — not regex over prose.
 *
 * Applies to a source's LEVELED picks only: a chosen cantrip is slot-free by
 * the ordinary cantrip rule and never carries a usage label (same as a
 * granted cantrip — featSpells.ts).
 *
 * `null` means the source's text establishes no special term — the pick is an
 * ordinary prepared spell, cast with a slot. Shown with no label, the same
 * reason "at will" was rejected for invocations (docs/REPORT.md, spell-usage
 * -terms task): a label that claims more than the source grants is worse than
 * none.
 */
const USAGE_BY_SOURCE: Record<string, SpellUsage | null> = {
	// "While the book is on your person, you have the chosen spells prepared, and they function as Warlock spells for you." — ordinary prepared spells; a ritual-tag pick already shows "(ritual)" from the spell's own data.
	'Pact of the Tome': null,

	// "You can cast it once without a spell slot, and you regain the ability to cast it in that way when you finish a Long Rest. You can also cast the spell using any spell slots you have."
	// Only base "Magic Initiate" is ever picked (the "; Class" variants are hidden — featAsiData.ts); listed too since their text is identical.
	'Magic Initiate': { kind: 'onceFreePerLongRest' },
	'Magic Initiate; Cleric': { kind: 'onceFreePerLongRest' },
	'Magic Initiate; Druid': { kind: 'onceFreePerLongRest' },
	'Magic Initiate; Wizard': { kind: 'onceFreePerLongRest' },

	// "You can cast this feat's 1st-level spell without a spell slot, and you must finish a long rest before you can cast it in this way again. You can also cast the spell using any spell slots you have."
	'Artificer Initiate': { kind: 'onceFreePerLongRest' },

	// "You can cast each of these spells without expending a spell slot. Once you cast either spell in this way, you can't cast that spell in this way again until you finish a Long Rest. You can also cast these spells using spell slots you have of the appropriate level." (covers the chosen spell AND the fixed companion — Misty Step / Invisibility)
	'Fey-Touched': { kind: 'onceFreePerLongRest' },
	'Shadow-Touched': { kind: 'onceFreePerLongRest' },

	// "You always have those spells prepared, and you can cast them with any spell slots you have." — the feat adds no per-spell term; every pick has the Ritual tag, so "(ritual)" is already shown from the spell's own data.
	'Ritual Caster': null,

	// Cantrip-only picks — nothing to label (a chosen cantrip never carries a usage term). Listed so "checked, nothing to add" is on the record.
	// Blessed Warrior: "You learn two Cleric cantrips of your choice."
	'Blessed Warrior': null,
	// Druidic Warrior: "You learn two Druid cantrips of your choice."
	'Druidic Warrior': null,
	// Wood Elf Magic: "You learn one druid cantrip of your choice." (its fixed Longstrider / Pass Without Trace are not picks — see docs/REPORT.md)
	'Wood Elf Magic': null,
	// Aberrant Dragonmark: "You know one cantrip of your choice from the Sorcerer spell list."
	'Aberrant Dragonmark': null,
}

/**
 * Usage term for a LEVELED spell the player picked for `sourceName` (a feat
 * name or a pact-boon option name), or null when the source establishes none
 * or isn't in the table. Callers must not call this for a cantrip pick.
 */
export function chosenSpellUsageFor(sourceName: string): SpellUsage | null {
	return USAGE_BY_SOURCE[sourceName] ?? null
}
