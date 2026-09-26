import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Character } from '../storage/character'
import { ALSO_CASTABLE_WITH_SLOT_SOURCES, alsoCastableWithSlot } from './alsoCastableWithSlot'
import { CHOSEN_SPELL_USAGE_SOURCES } from './chosenSpellUsage'
import { extractFixedFeatSpells } from './featSpells'
import { extractOptionalFeatureGrantedSpells } from './optionalFeatureSpells'
import { raceSpellsFor } from './raceSpells'
import { extractClassAlwaysPreparedSpells, extractSubclassAlwaysPreparedSpells, isRecord, type SpellUsage } from './subclassPreparedSpells'

function read(name: string): Record<string, unknown>[] {
	const parsed: unknown = JSON.parse(readFileSync(`data/${name}`, 'utf8'))
	if (!Array.isArray(parsed)) throw new Error(`data/${name}: expected a top-level array.`)
	return parsed.filter(isRecord)
}

/*
 * Every source that grants a LEVELED spell with a usage term, run through the
 * app's own extractors at level 20 — so a source the extractors start reaching
 * must be ruled on in the table, not silently read as NO (D190).
 */
describe('alsoCastableWithSlot — against the generated data (D190)', () => {
	const spells = read('spells.json')
	const withSpells = (rows: Record<string, unknown>[]) => rows.filter((row) => Array.isArray(row['additionalSpells']) && !row['reprintedAs'])
	const free = (granted: { level: number; usage?: SpellUsage | null }[]) => granted.some((spell) => spell.level > 0 && spell.usage)
	const sources = new Set<string>(CHOSEN_SPELL_USAGE_SOURCES)

	const classes = read('classes.json')
	for (const cls of withSpells(classes.filter((row) => row['entryType'] === 'class'))) {
		if (free(extractClassAlwaysPreparedSpells(classes, spells, String(cls['name']), String(cls['source']), 20))) sources.add(String(cls['name']))
	}
	for (const subclass of withSpells(classes.filter((row) => row['entryType'] === 'subclass'))) {
		const granted = extractSubclassAlwaysPreparedSpells(classes, spells, String(subclass['name']), String(subclass['source']), String(subclass['className']), String(subclass['classSource']), 20, undefined, 3)
		if (free(granted)) sources.add(String(subclass['name']))
	}
	const feats = read('feats.json')
	for (const feat of withSpells(feats)) {
		if (free(extractFixedFeatSpells(feats, spells, String(feat['name']), String(feat['source']), 20, 'int'))) sources.add(String(feat['name']))
	}
	const species = read('species.json')
	for (const entry of withSpells(species)) {
		const character = {
			species: { name: entry['name'], source: entry['source'] },
			classes: [{ className: 'Fighter', classSource: 'XPHB', subclass: null, level: 20 }],
			speciesSpellcastingAbility: 'charisma',
		} as unknown as Character
		if (free(raceSpellsFor(character, species, spells).spells)) sources.add(String(entry['name']))
	}
	const options = read('optional-features.json')
	const invocations = withSpells(options).filter((option) => Array.isArray(option['featureType']) && option['featureType'].includes('EI'))
	const optionSpells = extractOptionalFeatureGrantedSpells(options, spells, [{ featureType: 'EI', choices: invocations.map((option) => ({ name: String(option['name']) })) }])
	for (const spell of optionSpells) if (free([spell])) sources.add(spell.optionName)

	it('rules on exactly the reachable free-use sources', () => {
		expect([...ALSO_CASTABLE_WITH_SLOT_SOURCES].sort()).toEqual([...sources].sort())
	})

	it('reads YES for the stated and accepted sources and NO for the rest', () => {
		expect(['Mark of Storm', 'Magic Initiate', 'Fey-Touched', 'Tiefling; Infernal Legacy', 'Yuan-Ti', 'Gnome; Forest Gnome Lineage', 'Archfey Patron', 'Psi Warrior', 'Ranger', 'Paladin', 'Warlock', 'Druid'].every(alsoCastableWithSlot)).toBe(true)
		expect(['Alchemist', 'Drow High Magic', 'Fey Teleportation', 'Githyanki', 'Gift of the Depths', 'Armor of Shadows', 'Pact of the Chain', 'Warrior of Shadow', 'Nowhere'].some(alsoCastableWithSlot)).toBe(false)
	})
})
