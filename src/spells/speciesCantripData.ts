import { loadDataFile } from '../dataLoader/dataLoader'
import { extractClassSpellList } from './classSpellListData'
import { findChooseNodes, parseChooseString } from './featSpellChoiceData'
import { isRecord } from './subclassPreparedSpells'

/** S2: the class list(s) a species' cantrip `choose` grant draws from (DATA.md: only "level=0|class=..." occurs, count 1). */
export interface SpeciesCantripSlot {
	classes: { className: string; classSource: string }[]
}

export interface SpeciesCantripOption {
	name: string
	source: string
	/** Every named class list the cantrip is on, for Khoravar's merged Cleric/Druid/Wizard list. */
	classNames: string[]
}

/** Null when the species has no cantrip choice or is Elf's family base (named block). Kobold|MPMM's base has an unnamed block and does return a slot; the wizard never stores a base (D81). */
export function extractSpeciesCantripSlot(parsedSpecies: unknown, speciesName: string, speciesSource: string): SpeciesCantripSlot | null {
	if (!Array.isArray(parsedSpecies)) throw new Error('species.json: expected a top-level array.')
	const entry = parsedSpecies.find((candidate) => isRecord(candidate) && candidate['name'] === speciesName && candidate['source'] === speciesSource)
	if (!isRecord(entry) || !Array.isArray(entry['additionalSpells'])) return null
	for (const block of entry['additionalSpells']) {
		if (!isRecord(block) || typeof block['name'] === 'string') continue
		for (const node of findChooseNodes(block['known'])) {
			const parsed = parseChooseString(node.choose)
			if (parsed && parsed.filter.kind === 'class' && parsed.levels.length === 1 && parsed.levels[0] === 0) return { classes: parsed.filter.classes }
		}
	}
	return null
}

export function speciesCantripOptions(parsedSpells: unknown, slot: SpeciesCantripSlot): SpeciesCantripOption[] {
	const byKey = new Map<string, SpeciesCantripOption>()
	for (const { className, classSource } of slot.classes) {
		for (const spell of extractClassSpellList(parsedSpells, className, classSource)) {
			if (spell.level !== 0) continue
			const key = `${spell.name.toLowerCase()}|${spell.source.toUpperCase()}`
			const existing = byKey.get(key)
			if (existing) existing.classNames.push(className)
			else byKey.set(key, { name: spell.name, source: spell.source, classNames: [className] })
		}
	}
	return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** The slot plus its options, or null for a species without the grant. */
export async function loadSpeciesCantripChoice(speciesName: string, speciesSource: string): Promise<{ slot: SpeciesCantripSlot; options: SpeciesCantripOption[] } | null> {
	const slot = extractSpeciesCantripSlot(await loadDataFile('data/species.json'), speciesName, speciesSource)
	// A spells.json failure must lock only the species that has the grant (D281).
	return slot ? { slot, options: speciesCantripOptions(await loadDataFile('data/spells.json'), slot) } : null
}
