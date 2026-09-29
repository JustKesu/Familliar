import type { Ability } from '../abilities/abilityScores'
import { itemSpellKey, type ItemSpellGrant } from '../inventory/customItemGrants'
import { findSpellDetail, type SpellDetail } from '../spells/spellDetailData'
import type { SpellUsage } from '../spells/subclassPreparedSpells'
import type { CustomItemSpell, CustomItemSpellAbility } from '../storage/character'
import type { SheetSpellEntry } from './SpellList'
import { spellActionData, type SpellActionData, type SpellCaster } from './spellActionRowData'

/** One spell a custom item grants, as the Spells and Actions tabs show it (R14c2, D219). Never merged with the character's own entry of the same spell. */
export interface ItemSpell {
	/** `item:<row>:<name|source>`: the counter's key for this render only — the spent count is stored on the inventory row. */
	key: string
	grant: ItemSpellGrant
	entry: SheetSpellEntry
	detail: SpellDetail | undefined
	usage: SpellUsage
	/** 0 for a cantrip; otherwise the stored castLevel, never below the spell's own level. */
	castLevel: number
	/** The USE row's box count; null for at will. */
	max: number | null
	caster: SpellCaster
}

function fixedCaster(spell: CustomItemSpell, fixed: { saveDc?: number; attackBonus?: number }, itemName: string, detail: SpellDetail | undefined): SpellCaster {
	// D43: a number the spell needs and the item does not state is a reason, not a 0.
	if ((detail?.spellAttack?.length ?? 0) > 0 && fixed.attackBonus === undefined) return { reason: `The item does not state an attack bonus for ${spell.name}.` }
	if ((detail?.savingThrow?.length ?? 0) > 0 && fixed.saveDc === undefined) return { reason: `The item does not state a save DC for ${spell.name}.` }
	const source = `${itemName} (fixed)`
	return {
		attack: { bonus: fixed.attackBonus ?? 0, breakdown: [{ source, amount: fixed.attackBonus ?? 0 }] },
		save: { dc: fixed.saveDc ?? 0, abilities: [], breakdown: [{ source, amount: fixed.saveDc ?? 0 }] },
	}
}

const ABILITY_OF: Record<CustomItemSpellAbility, Ability> = { int: 'intelligence', wis: 'wisdom', cha: 'charisma' }

/** The form's preselection from a casting class's ability; null for one the item cannot name. */
export function itemSpellAbilityOf(ability: Ability): CustomItemSpellAbility | null {
	return (Object.keys(ABILITY_OF) as CustomItemSpellAbility[]).find((key) => ABILITY_OF[key] === ability) ?? null
}

export function itemSpells(grants: readonly ItemSpellGrant[], details: SpellDetail[], ownCaster: (ability: Ability) => SpellCaster): ItemSpell[] {
	return grants.map((grant) => {
		const { spell, itemName } = grant
		const detail = findSpellDetail(details, spell.name, spell.source)
		const cantrip = detail?.level === 0
		const usage: SpellUsage = cantrip ? { kind: 'atWill' } : spell.uses
		const level = detail?.level ?? spell.castLevel ?? 0
		return {
			key: `item:${grant.row}:${itemSpellKey(spell)}`,
			grant,
			entry: {
				name: spell.name,
				source: spell.source,
				chosen: false,
				subclassOrigins: [],
				classOrigins: [],
				featOrigins: [],
				optionalFeatureOrigins: [],
				itemInvocationOrigins: [],
				speciesOrigins: [],
				unresolvedAbilityReasons: [],
				usages: [usage],
				grants: [{ origin: 'item', originName: itemName, usage }],
			},
			detail,
			usage,
			castLevel: cantrip ? 0 : Math.max(level, spell.castLevel ?? level),
			max: usage.kind === 'perLongRest' || usage.kind === 'perShortRest' ? usage.count : null,
			caster: spell.caster.kind === 'own' ? ownCaster(ABILITY_OF[spell.caster.ability]) : fixedCaster(spell, spell.caster, itemName, detail),
		}
	})
}

/** The Actions table rows: the Spells tab's numbers and dice at the cast level. */
export function itemSpellActionRows(spells: readonly ItemSpell[], characterLevel: number): SpellActionData[] {
	return spells.flatMap(({ key, entry, detail, caster, castLevel, grant }) => {
		const row = detail ? spellActionData(key, entry.name, detail, () => caster, characterLevel, castLevel) : null
		return row ? [{ ...row, origin: grant.itemName }] : []
	})
}
