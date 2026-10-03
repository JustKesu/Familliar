export interface SpeciesSaveAdvantage {
	/** Species record keys, "name|source", including every lineage/variant that carries the trait. */
	records: readonly string[]
	/** The trait's name in species.json. */
	trait: string
	/** Shown in the bracket when the trait's own name reads badly there. */
	label?: string
	text: string
}

// PHB 2024 / MPMM / EFA / RHW species traits, hand-copied from prose (D21, D314).
export const SPECIES_SAVE_ADVANTAGES: readonly SpeciesSaveAdvantage[] = [
	{
		trait: 'Fey Ancestry',
		text: 'Advantage on saves to avoid or end Charmed',
		records: [
			'Elf|XPHB',
			'Elf; Drow Lineage|XPHB',
			'Elf; High Elf Lineage|XPHB',
			'Elf; Wood Elf Lineage|XPHB',
			'Khoravar|EFA',
			'Bugbear|MPMM',
			'Eladrin|MPMM',
			'Goblin|MPMM',
			'Hobgoblin|MPMM',
			'Sea Elf|MPMM',
			'Shadar-Kai|MPMM',
		],
	},
	{ trait: 'Dwarven Resilience', text: 'Advantage on saves to avoid or end Poisoned', records: ['Dwarf|XPHB', 'Duergar|MPMM'] },
	{ trait: 'Psionic Fortitude', text: 'Advantage on saves to avoid or end Charmed or Stunned', records: ['Duergar|MPMM'] },
	{ trait: 'Construct Resilience', text: 'Advantage on saves to avoid or end Poisoned', records: ['Warforged|EFA'] },
	{ trait: 'Poison Resilience', text: 'Advantage on saves to avoid or end Poisoned', records: ['Yuan-Ti|MPMM'] },
	{ trait: 'Magic Resistance', text: 'Advantage on saves against spells', records: ['Satyr|MPMM', 'Yuan-Ti|MPMM'] },
	{ trait: 'Gnomish Magic Resistance', text: 'Advantage on Intelligence, Wisdom and Charisma saves against spells', records: ['Deep Gnome|MPMM'] },
	{ trait: 'Brave', text: 'Advantage on saves to avoid or end Frightened', records: ['Halfling|XPHB'] },
	{ trait: 'Kobold Legacy (Defiance)', label: 'Defiance', text: 'Advantage on saves to avoid or end Frightened', records: ['Kobold; Defiance|MPMM'] },
	{ trait: 'Mental Discipline', text: 'Advantage on saves to avoid or end Charmed or Frightened', records: ['Githzerai|MPMM'] },
	{ trait: 'Gnomish Cunning', text: 'Advantage on Intelligence, Wisdom and Charisma saves', records: ['Gnome|XPHB', 'Gnome; Forest Gnome Lineage|XPHB', 'Gnome; Rock Gnome Lineage|XPHB'] },
	{ trait: 'Dual Mind', text: 'Advantage on Wisdom and Charisma saves', records: ['Kalashtar|EFA'] },
	{ trait: 'Shell Defense', text: 'Advantage on Strength and Constitution saves while in your shell', records: ['Tortle|MPMM'] },
	{ trait: 'Escaped Death', text: 'Advantage on Death Saving Throws', records: ['Reborn|RHW'] },
]

/** "Advantage on saves to avoid or end Charmed (Fey Ancestry)" — one line per trait of the character's species record. */
export function speciesSaveAdvantageLines(species: { name: string; source: string } | null | undefined): string[] {
	if (!species) return []
	const key = `${species.name}|${species.source}`
	return SPECIES_SAVE_ADVANTAGES.filter((entry) => entry.records.includes(key)).map((entry) => `${entry.text} (${entry.label ?? entry.trait})`)
}
