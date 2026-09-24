import { speciesSizeOptions } from '../calculation/speciesTraits'
import { loadDataFile } from '../dataLoader/dataLoader'
import { extractSpeciesTraitsData } from '../sheet/sheetData'

/** D175: the sizes species.json offers the stored species (parent fallback included). More than one is a choice the player makes. */
export async function loadSpeciesSizeOptions(name: string, source: string): Promise<string[]> {
	return speciesSizeOptions(extractSpeciesTraitsData(await loadDataFile('data/species.json')), name, source)
}
