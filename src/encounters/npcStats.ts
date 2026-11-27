import { ABILITIES } from '../abilities/abilityScores'
import { computeArmourClass } from '../calculation/armourClass'
import { computeInitiative } from '../calculation/initiative'
import { flatBonusesByTarget } from '../calculation/itemFlatBonuses'
import { totalCharacterLevel } from '../calculation/characterLevel'
import { computeSavingThrows } from '../calculation/savingThrows'
import { loadCharacterMaxHp } from '../hitPoints/hpDefault'
import { loadItemRefs } from '../inventory/inventoryData'
import type { AbilityKey } from '../monsters/monsterData'
import { buildEquippedGear, hasMageArmor, loadAcFormulaKeys } from '../sheet/armourClassData'
import { loadCombinedSpells } from '../sheet/combinedSpells'
import { buildItemAbilityGrants } from '../sheet/itemAbilityScoreData'
import { buildItemFlatBonusGrants } from '../sheet/itemFlatBonusData'
import { buildItemProficiencyGrants } from '../sheet/itemProficiencyData'
import { loadFeatEffectEntries, loadSavingThrowClassData } from '../sheet/sheetData'
import type { Character } from '../storage/character'
import { SAVE_ABILITIES } from './combat'

export interface NpcSave {
	bonus: number
	proficient: boolean
}

/** D438: the sheet's own numbers, from the same calculation calls CharacterSheet makes. null = the sheet cannot compute it either. */
export interface NpcStats {
	ac: number | null
	initiative: number
	saves: Record<AbilityKey, NpcSave>
	maxHp: number | null
}

export async function loadNpcStats(character: Character): Promise<NpcStats> {
	const [itemRefs, classData, feats, spells, maxHp] = await Promise.all([
		loadItemRefs(),
		loadSavingThrowClassData(),
		loadFeatEffectEntries(),
		loadCombinedSpells(character),
		loadCharacterMaxHp(character),
	])
	const inventory = character.inventory ?? []
	const acFormulaKeys = await loadAcFormulaKeys(character, hasMageArmor(spells))
	const itemAbilityGrants = buildItemAbilityGrants(inventory, itemRefs)
	const itemFlatBonuses = flatBonusesByTarget(buildItemFlatBonusGrants(inventory, itemRefs), totalCharacterLevel(character.classes))
	const savingThrows = computeSavingThrows(
		character,
		classData,
		feats,
		itemFlatBonuses.savingThrow,
		itemFlatBonuses.savingThrowFor,
		buildItemProficiencyGrants(inventory, itemRefs),
		itemAbilityGrants,
	)
	const initiative = computeInitiative(character, feats, itemFlatBonuses.initiative, itemAbilityGrants)
	const ac = computeArmourClass(character, buildEquippedGear(inventory, itemRefs), acFormulaKeys, feats, itemFlatBonuses.armourClass, itemAbilityGrants)
	const saves = Object.fromEntries(
		SAVE_ABILITIES.map((key, index) => {
			const save = savingThrows[ABILITIES[index]]
			return [key, save.status === 'known' ? { bonus: save.value.modifier, proficient: save.value.status === 'proficient' } : { bonus: 0, proficient: false }]
		}),
	) as Record<AbilityKey, NpcSave>
	return {
		ac: ac.status === 'known' ? ac.value.value : null,
		initiative: initiative.status === 'known' ? initiative.value : 0,
		saves,
		maxHp: maxHp.status === 'known' ? maxHp.value : null,
	}
}

/** "Fighter 3 / Wizard 2". */
export function classLine(character: Character): string {
	return character.classes.map((c) => `${c.className} ${c.level}`).join(' / ')
}
