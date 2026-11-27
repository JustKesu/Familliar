import { ABILITIES } from '../abilities/abilityScores'
import { ABILITY_ABBREVIATIONS } from '../calculation/abilityAbbreviations'
import { totalCharacterLevel } from '../calculation/characterLevel'
import { flatBonusesByTarget } from '../calculation/itemFlatBonuses'
import { computeAbilitySpellcasting, computeFeatSpellcasting, computeSpeciesSpellcasting, computeSpellcasting } from '../calculation/spellcasting'
import { averageOf, computeAttacksPerAction, computeWeaponAttacks, type AttackDamage } from '../calculation/weaponAttacks'
import { loadDataFile } from '../dataLoader/dataLoader'
import { heldInvocations } from '../featAsi/featInstances'
import { itemSpellGrants } from '../inventory/customItemGrants'
import { loadItemRefs } from '../inventory/inventoryData'
import { loadCombinedSpellParts } from '../sheet/combinedSpells'
import { buildItemAbilityGrants } from '../sheet/itemAbilityScoreData'
import { buildBracersOfArcheryBonus, buildItemFlatBonusGrants } from '../sheet/itemFlatBonusData'
import { itemSpellActionRows, itemSpells as buildItemSpells } from '../sheet/itemSpellRows'
import { pactWeaponInvocations } from '../sheet/pactWeapon'
import { hasAgonizingBlast, spellActionRows, toCaster, type SpellActionData } from '../sheet/spellActionRowData'
import { loadFeatEffectEntries, loadSpellcastingAbilityClassData } from '../sheet/sheetData'
import { buildHeldWeapons, loadWeaponAttackData } from '../sheet/weaponAttackData'
import type { Character } from '../storage/character'
import { loadNpcStats } from './npcStats'

/** One row of DMG 2014 "Monster Statistics by Challenge Rating" (data/cr-statistics.json, D439). */
export interface CrStatRow {
	cr: string
	crNumber: number
	ac: number
	hpMin: number
	hpMax: number
	attackBonus: number
	dprMin: number
	dprMax: number
	saveDc: number
}

/** The strongest option's damage per round and what it rolls against: an attack bonus, or a save DC for a save cantrip. */
export interface NpcOffence {
	dpr: number
	bonus: number
	kind: 'attack' | 'save'
}

export interface CrEstimate {
	cr: string
	defence: string
	offence: string
}

const FIELDS = ['crNumber', 'ac', 'hpMin', 'hpMax', 'attackBonus', 'dprMin', 'dprMax', 'saveDc'] as const

export function extractCrStatistics(parsed: unknown): CrStatRow[] {
	if (!Array.isArray(parsed)) throw new Error('cr-statistics.json: expected an array.')
	return parsed.filter(
		(row): row is CrStatRow => typeof row === 'object' && row !== null && typeof (row as CrStatRow).cr === 'string' && FIELDS.every((field) => typeof (row as Record<string, unknown>)[field] === 'number'),
	)
}

export async function loadCrStatistics(): Promise<CrStatRow[]> {
	return extractCrStatistics(await loadDataFile('data/cr-statistics.json'))
}

/** The last row whose minimum the value reaches: a fractional DPR between two rows counts in the lower one, anything below the table in the first. */
function rowFor(rows: CrStatRow[], value: number, min: (row: CrStatRow) => number): number {
	let index = 0
	rows.forEach((row, i) => {
		if (min(row) <= value) index = i
	})
	return index
}

/** DMG 2014: one CR step per full 2 points above or below the row's value, clamped to the table. */
function adjusted(rows: CrStatRow[], index: number, difference: number): number {
	return Math.min(rows.length - 1, Math.max(0, index + Math.trunc(difference / 2)))
}

export function estimateCr(rows: CrStatRow[], maxHp: number | null, ac: number | null, offence: NpcOffence | null): CrEstimate | null {
	if (rows.length === 0 || maxHp === null || ac === null || offence === null) return null
	const hpRow = rowFor(rows, maxHp, (row) => row.hpMin)
	const defence = rows[adjusted(rows, hpRow, ac - rows[hpRow]!.ac)]!
	const dprRow = rowFor(rows, offence.dpr, (row) => row.dprMin)
	const target = offence.kind === 'save' ? rows[dprRow]!.saveDc : rows[dprRow]!.attackBonus
	const attack = rows[adjusted(rows, dprRow, offence.bonus - target)]!
	const average = (defence.crNumber + attack.crNumber) / 2
	// Equally near two CRs rounds up.
	const nearest = rows.reduce((best, row) => (Math.abs(row.crNumber - average) <= Math.abs(best.crNumber - average) ? row : best))
	return { cr: nearest.cr, defence: defence.cr, offence: attack.cr }
}

export const crTitle = (estimate: CrEstimate): string =>
	`Estimate (DMG 2014 method): defence CR ${estimate.defence}, offence CR ${estimate.offence}. Spells of level 1+ and other features are not counted.`

function weaponAverage(damage: AttackDamage): number {
	return damage.dice === null ? Math.max(0, 1 + damage.modifier) : averageOf(damage.dice) + damage.modifier
}

/** "2d10 Fire damage", "1d10 + 3 Force"; "+ mod" (no known modifier) counts the dice only. */
function cantripAverage(spell: SpellActionData): number | null {
	const match = /^(\d+)d(\d+)(?:\s*([+−])\s*(\d+))?/.exec(spell.damage[0] ?? '')
	if (!match) return null
	const flat = match[4] === undefined ? 0 : (match[3] === '−' ? -1 : 1) * Number(match[4])
	const beams = Number(/^(\d+) beams$/.exec(spell.notes ?? '')?.[1] ?? 1)
	return (averageOf(`${match[1]}d${match[2]}`) + flat) * beams
}

/** D439: the attack lines and cantrip rows from the same calls CharacterSheet makes; spells of level 1+ are left out. */
export async function loadNpcOffence(character: Character): Promise<NpcOffence | null> {
	const [itemRefs, feats, weaponData, spellcastingData, spells] = await Promise.all([
		loadItemRefs(),
		loadFeatEffectEntries(),
		loadWeaponAttackData(character),
		loadSpellcastingAbilityClassData(),
		loadCombinedSpellParts(character),
	])
	const inventory = character.inventory ?? []
	const level = totalCharacterLevel(character.classes)
	const itemAbilityGrants = buildItemAbilityGrants(inventory, itemRefs)
	const bonuses = flatBonusesByTarget(buildItemFlatBonusGrants(inventory, itemRefs), level)
	const options: NpcOffence[] = []

	const attacks = computeWeaponAttacks(character, buildHeldWeapons(inventory, itemRefs), weaponData.grants, feats, weaponData.martialArtsDie, { attack: bonuses.weaponAttack, damage: bonuses.weaponDamage }, itemAbilityGrants, pactWeaponInvocations(character), buildBracersOfArcheryBonus(inventory, itemRefs))
	const perAction = computeAttacksPerAction(weaponData.featureNames, heldInvocations(character).map((pick) => pick.name))
	const count = perAction.status === 'known' ? perAction.value : 1
	for (const attack of attacks) {
		if (attack.toHit.status !== 'known' || attack.damage.status !== 'known') continue
		options.push({ dpr: weaponAverage(attack.damage.value) * count, bonus: attack.toHit.value, kind: 'attack' })
	}

	const known = <T>(result: { status: 'known'; value: T[] } | { status: 'unknown' }): T[] => (result.status === 'known' ? result.value : [])
	const classEntries = known(computeSpellcasting(character, spellcastingData, feats, bonuses.spellAttack, bonuses.spellSaveDc, itemAbilityGrants))
	const subclassEntries = spells.subclassInfos.flatMap((info) => {
		if (info.ability === null || classEntries.some((e) => e.className === info.className && e.classSource === info.classSource)) return []
		const ability = ABILITIES.find((a) => ABILITY_ABBREVIATIONS[a] === info.ability)!
		const own = computeAbilitySpellcasting(character, ability, feats, bonuses.spellAttack, bonuses.spellSaveDc, itemAbilityGrants)
		return own.status === 'known' ? [{ className: info.className, classSource: info.classSource, ...own.value }] : []
	})
	const agonizingBlast = hasAgonizingBlast(heldInvocations(character))
	const itemRows = itemSpellActionRows(
		buildItemSpells(itemSpellGrants(character.inventory), spells.spellDetails, (ability) => {
			const own = computeAbilitySpellcasting(character, ability, feats, bonuses.spellAttack, bonuses.spellSaveDc, itemAbilityGrants)
			return own.status === 'known' ? toCaster(own.value) : { reason: own.reason }
		}),
		level,
		agonizingBlast,
	)
	const rows = spellActionRows(
		spells.entries,
		spells.spellDetails,
		level,
		classEntries,
		known(computeFeatSpellcasting(character, spells.featSpells, feats, bonuses.spellAttack, bonuses.spellSaveDc, itemAbilityGrants)),
		known(computeSpeciesSpellcasting(character, spells.raceSpells, feats, bonuses.spellAttack, bonuses.spellSaveDc, itemAbilityGrants)),
		itemRows,
		subclassEntries,
		agonizingBlast,
	)
	for (const spell of rows) {
		if (spell.level !== 0 || spell.unresolved) continue
		const average = cantripAverage(spell)
		if (average === null) continue
		if (spell.attack) options.push({ dpr: average, bonus: spell.attack.bonus, kind: 'attack' })
		else if (spell.save) options.push({ dpr: average, bonus: spell.save.dc, kind: 'save' })
	}

	return options.reduce<NpcOffence | null>((best, option) => (best === null || option.dpr > best.dpr ? option : best), null)
}

/** null when the sheet cannot give max HP, AC or any damage option, or a data file fails to load. */
export async function loadNpcCr(character: Character): Promise<CrEstimate | null> {
	try {
		const [rows, stats, offence] = await Promise.all([loadCrStatistics(), loadNpcStats(character), loadNpcOffence(character)])
		return estimateCr(rows, stats.maxHp, stats.ac, offence)
	} catch {
		return null
	}
}
