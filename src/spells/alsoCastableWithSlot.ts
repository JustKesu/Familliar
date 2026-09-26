/*
 * D190 hand table (D21/D70 style, like chosenSpellUsage.ts): may a spell a
 * source grants as a free cast ALSO be cast with a spell slot? The data has no
 * field for it — the same `daily:{"1":…}` wrapper sits on sources that say yes
 * and on ones that say nothing (docs/DATA.md, "Free casts"). Keyed by the
 * granting source's name as the spell grant carries it (subclass, feat,
 * optional-feature or stored species name); each entry quotes its rules text.
 * A source not listed is NO. spellsTabData.test.ts lists every reachable
 * free-use source, so a new one fails the test instead of reading as NO.
 */
const ALSO_CASTABLE_WITH_SLOT: Record<string, boolean> = {
	// "You can also cast it/these spells using any spell slots you have (of the appropriate level)." (all 12 marks, EFA)
	'Mark of Detection': true,
	'Mark of Finding': true,
	'Mark of Handling': true,
	'Mark of Healing': true,
	'Mark of Hospitality': true,
	'Mark of Making': true,
	'Mark of Passage': true,
	'Mark of Scribing': true,
	'Mark of Sentinel': true,
	'Mark of Shadow': true,
	'Mark of Storm': true,
	'Mark of Warding': true,

	// "You can also cast the spell using any spell slots you have." (the "; Class" variants are hidden but carry the same text — chosenSpellUsage.ts)
	'Magic Initiate': true,
	'Magic Initiate; Cleric': true,
	'Magic Initiate; Druid': true,
	'Magic Initiate; Wizard': true,
	// "You can also cast the spell using any spell slots you have."
	'Artificer Initiate': true,
	// "You can also cast these spells using spell slots you have of the appropriate level."
	'Fey-Touched': true,
	'Shadow-Touched': true,

	// "You can also cast the spell using any spell slots you have of the appropriate level." (XPHB Tiefling legacies, Elf lineages)
	'Tiefling; Abyssal Legacy': true,
	'Tiefling; Chthonic Legacy': true,
	'Tiefling; Infernal Legacy': true,
	'Elf; Drow Lineage': true,
	'Elf; High Elf Lineage': true,
	'Elf; Wood Elf Lineage': true,
	// "You can also cast these spells using any spell slots you have of the appropriate level." / "…using spell slots you have…"
	Duergar: true,
	Triton: true,
	// "You can also cast it using any spell slots you have of 2nd level or higher."
	'Yuan-Ti': true,
	// "You also always have the Speak with Animals spell prepared." — prepared, so slot-castable (accepted by Daniel).
	'Gnome; Forest Gnome Lineage': true,
	// Misty Step is also an ordinary Archfey Spells grant (prepared["3"]) — "always prepared".
	'Archfey Patron': true,
	// "You learn the spell … You can also cast it once without a spell slot…" — a learned spell.
	'The Fathomless': true,
	// "You always have the Telekinesis spell prepared."
	'Psi Warrior': true,

	// D193, class-record grants (2024 PHB, decided by Daniel): "always prepared" spells, so slot-castable too. Keyed by class name.
	Druid: true,
	Paladin: true,
	Ranger: true,
	Warlock: true,

	// Only "without expending a spell slot …"; nothing says it is prepared or slot-castable.
	Alchemist: false,
	// "You learn the … spell and can cast it once without expending a spell slot."
	'Drow High Magic': false,
	'Fey Teleportation': false,
	// "… each of which you can cast once without expending a spell slot."
	'Wood Elf Magic': false,
	// "you can cast the … spell with this trait" — nothing about slots (MPMM).
	'Deep Gnome': false,
	Fairy: false,
	Githyanki: false,
	Githzerai: false,
	Air: false,
	Fire: false,
	Water: false,
	// "… once without expending a spell slot."
	'Gift of the Depths': false,
	"Trickster's Escape": false,
	'Undying Servitude': false,
	// "You can cast X without expending a spell slot." — no limit, no slot.
	'Armor of Shadows': false,
	'Ascendant Step': false,
	'Far Scribe': false,
	'Fiendish Vigor': false,
	'Mask of Many Faces': false,
	'Master of Myriad Forms': false,
	'Misty Visions': false,
	'One with Shadows': false,
	'Otherworldly Leap': false,
	'Shroud of Shadow': false,
	'Visions of Distant Realms': false,
	'Whispers of the Grave': false,
	// "… but only as a Ritual."
	'Path of the Wild Heart': false,
	// "without expending a spell slot" (Find Familiar as a Magic action)
	'Pact of the Chain': false,
	// "spend 2 ki points to cast …" / Focus Points
	'Way of the Sun Soul': false,
	'Warrior of Shadow': false,
}

export function alsoCastableWithSlot(sourceName: string): boolean {
	return ALSO_CASTABLE_WITH_SLOT[sourceName] === true
}

/** For the coverage test only. */
export const ALSO_CASTABLE_WITH_SLOT_SOURCES = Object.keys(ALSO_CASTABLE_WITH_SLOT)
