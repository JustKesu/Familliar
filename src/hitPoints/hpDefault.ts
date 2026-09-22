/*
 * D107: currentHp's computed default at creation and its increase/decrease at
 * a level up/removal. The maximum itself is computeMaxHitPoints (D107 changes
 * only when currentHp defaults to it, not how it's computed) — this module
 * exists because computing it needs the same four data/ files
 * HitPointsPicker/CharacterSheet already load, and both write paths
 * (CharacterWizard's save, CharacterManager's remove-level write) need that
 * load done the same way.
 */

import { characterFeats } from '../calculation/featEffects'
import { computeMaxHitPoints } from '../calculation/maxHitPoints'
import type { Calculated } from '../calculation/types'
import type { Character } from '../storage/character'
import { loadFeatEffectEntries, loadHitDiceClassData } from '../sheet/sheetData'
import { loadGrantedClassFeatures } from '../sheet/grantedClassFeatures'
import { loadSpeciesTraitNames } from '../sheet/speciesTraitNames'

/** `character`'s maximum hit points, loading the same four files HitPointsPicker/CharacterSheet load for computeMaxHitPoints' bonus table. */
export async function loadCharacterMaxHp(character: Character): Promise<Calculated<number>> {
	const [classData, feats, grantedFeatures, speciesTraitNames] = await Promise.all([
		loadHitDiceClassData(),
		loadFeatEffectEntries(),
		loadGrantedClassFeatures(character),
		loadSpeciesTraitNames(character),
	])
	const bonusFeatureNames = [...grantedFeatures.map((feature) => feature.name), ...characterFeats(character, feats).map((choice) => choice.name), ...speciesTraitNames]
	return computeMaxHitPoints(character, classData, bonusFeatureNames, feats)
}
