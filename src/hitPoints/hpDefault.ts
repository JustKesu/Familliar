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
import type { Calculated, Contribution } from '../calculation/types'
import { loadItemRefs } from '../inventory/inventoryData'
import type { Character } from '../storage/character'
import { buildItemFlatBonusGrants } from '../sheet/itemFlatBonusData'
import { flatBonusesByTarget } from '../calculation/itemFlatBonuses'
import { loadFeatEffectEntries, loadHitDiceClassData } from '../sheet/sheetData'
import { loadGrantedClassFeatures } from '../sheet/grantedClassFeatures'
import { loadSpeciesTraitNames } from '../sheet/speciesTraitNames'

/**
 * R14a2: the sheet's own item grants and level count, so the level-up / removal shift equals the change in the maximum the sheet shows.
 * Also read by HitPointsPicker (R14b), so the wizard's "Maximum hit points" is that same number.
 */
export async function loadItemMaxHpBonuses(character: Character): Promise<Contribution[]> {
	/* Nothing carried means nothing to read: creation never waits on items.json for a maximum it does not need. */
	const itemRefs = character.inventory?.length ? await loadItemRefs() : []
	return flatBonusesByTarget(
		buildItemFlatBonusGrants(character.inventory ?? [], itemRefs),
		character.classes.reduce((sum, c) => sum + c.level, 0),
	).maxHitPoints
}

/** `character`'s maximum hit points, loading the same four files HitPointsPicker/CharacterSheet load for computeMaxHitPoints' bonus table. */
export async function loadCharacterMaxHp(character: Character): Promise<Calculated<number>> {
	const [classData, feats, grantedFeatures, speciesTraitNames, itemBonuses] = await Promise.all([
		loadHitDiceClassData(),
		loadFeatEffectEntries(),
		loadGrantedClassFeatures(character),
		loadSpeciesTraitNames(character),
		loadItemMaxHpBonuses(character),
	])
	const bonusFeatureNames = [...grantedFeatures.map((feature) => feature.name), ...characterFeats(character, feats).map((choice) => choice.name), ...speciesTraitNames]
	return computeMaxHitPoints(character, classData, bonusFeatureNames, feats, itemBonuses)
}
