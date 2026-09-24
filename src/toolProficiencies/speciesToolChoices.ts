import type { CharacterSpecies, CharacterToolChoice, ToolChoiceSource } from '../storage/character'
import type { ToolSlotGrant } from './classToolChoices'
import type { ToolCategory } from './toolProficiencyData'

export const ANY_TOOL_CATEGORIES: ToolCategory[] = ['anyArtisansTool', 'anyGamingSet', 'anyMusicalInstrument', 'anyOtherTool']

// D177: species.json `toolProficiencies` — Warforged `{any: 1}`, Satyr `{anyMusicalInstrument: 1}`. Temporary grants (Githyanki, Trance) are not shown.
const SPECIES_TOOL_GRANTS: readonly (CharacterSpecies & { grant: ToolSlotGrant })[] = [
	{ name: 'Warforged', source: 'EFA', grant: { owner: 'Warforged', count: 1, categories: ANY_TOOL_CATEGORIES, grantedBy: 'warforged' } },
	{ name: 'Satyr', source: 'MPMM', grant: { owner: 'Satyr', count: 1, categories: ['anyMusicalInstrument'], grantedBy: 'satyr' } },
]

/** D177: Khoravar's one skill or tool — prose only (DATA.md). The skill lives in speciesSkills, the tool in toolChoices. */
export const KHORAVAR: CharacterSpecies = { name: 'Khoravar', source: 'EFA' }

const SPECIES_TOOL_SOURCES: ReadonlySet<ToolChoiceSource> = new Set(['warforged', 'satyr', 'khoravar'])

const sameSpecies = (a: CharacterSpecies | null | undefined, b: CharacterSpecies): boolean => a?.name === b.name && a.source === b.source

export function isKhoravar(species: CharacterSpecies | null | undefined): boolean {
	return sameSpecies(species, KHORAVAR)
}

export function speciesToolGrantsFor(species: CharacterSpecies | null | undefined): ToolSlotGrant[] {
	return SPECIES_TOOL_GRANTS.filter((entry) => sameSpecies(species, entry)).map((entry) => entry.grant)
}

export function isSpeciesToolChoice(choice: CharacterToolChoice): boolean {
	return SPECIES_TOOL_SOURCES.has(choice.grantedBy)
}

/** Species picks the current species still grants; every other species pick is dropped. */
export function keepHeldSpeciesToolChoices(choices: readonly CharacterToolChoice[], species: CharacterSpecies | null | undefined): CharacterToolChoice[] {
	const held = new Set<ToolChoiceSource>([...speciesToolGrantsFor(species).map((grant) => grant.grantedBy), ...(isKhoravar(species) ? ['khoravar' as const] : [])])
	return choices.filter((choice) => held.has(choice.grantedBy))
}
