/*
 * Which of the character's spells belong in the actions table, and what each
 * one's cells hold (sheet rebuild, slice 4). Pure selection and formatting
 * (D38) over data that already exists: the combined spell list the Kouzla tab
 * shows (SpellList.ts's SheetSpellEntry), spells.json details
 * (spellDetailData.ts) and the already-computed attack bonus / save DC
 * (calculation/spellcasting.ts). Nothing here recomputes a number.
 *
 * Established by scripts/investigate-spell-action-rows.js (D46), over all 489
 * spells in data/spells.json:
 * - `spellAttack` (34 spells, always ["M"] or ["R"], never both letters) marks
 *   an attack roll; `savingThrow` (208, lowercase full ability names, 12 of
 *   them listing two abilities) marks a save. They are NOT exclusive — 5
 *   spells carry both (Storm Sphere, Wall of Light, Wrath of Nature, …), so a
 *   row can show a to-hit AND a DC. 252 spells have neither and get no row.
 * - Damage dice are NOT structured for leveled spells: 136 of the 237 rowable
 *   spells carry their dice only as `{@damage XdY}` inside `entries` prose, and
 *   `damageInflict` is damage TYPES with no dice. Per D21 that prose is not
 *   parsed — those rows leave the Damage cell empty. The one structured
 *   exception is `scalingLevelDice` (24 cantrips), whose own `label` already
 *   names the damage type ("Fire damage", "thunder damage on hit"), so it is
 *   shown as-is at the character's level.
 * - "Half damage on a save" is prose only — no top-level field anywhere marks
 *   it — so the Notes cell stays empty rather than being parsed out of text.
 */

import type { FeatSpellcastingEntry, SpeciesSpellcastingEntry, SpellcastingEntry } from '../calculation/spellcasting'
import type { Contribution } from '../calculation/types'
import type { SpellDetail, SpellScalingLevelDiceEntry } from '../spells/spellDetailData'
import { findSpellDetail } from '../spells/spellDetailData'
import type { SheetSpellEntry } from './SpellList'
import { formatRange } from './spellFormatting'

export interface SpellActionAttack {
	bonus: number
	breakdown: Contribution[]
}

export interface SpellActionSave {
	dc: number
	/** Lowercase full ability names as spells.json writes them; more than one for the 12 either-or spells. */
	abilities: string[]
	breakdown: Contribution[]
}

export interface SpellActionData {
	key: string
	name: string
	level: number
	ritual: boolean
	concentration: boolean
	range: string
	attack: SpellActionAttack | null
	save: SpellActionSave | null
	/** Dice + type per `scalingLevelDice` entry at the character's level; empty for every spell without that structured field. */
	damage: string[]
	/** D43: set when the spell needs a to-hit/DC but no caster entry could be attributed to it — the row still appears, saying why the number is missing. */
	unresolved: string | null
}

/** Matches SpellList.ts's own key, so a row and its Kouzla-tab entry identify a spell the same way. */
function keyOf(name: string, source: string): string {
	return `${name.toLowerCase()}|${source.toUpperCase()}`
}

/**
 * Which caster the spell's numbers come from. A feat- or species-granted spell
 * uses its own source's entry (a Fighter with Magic Initiate, or an Aasimar
 * Fighter, has no casting class at all — computeFeatSpellcasting and
 * computeSpeciesSpellcasting exist for exactly that); anything else uses the
 * character's casting class. More than one casting class is a multiclass
 * question (build order step 10) and the entry carries no class attribution,
 * so it resolves to nothing rather than to an arbitrary pick.
 *
 * The race slice adds one case the others don't have: a spell granted ONLY by
 * a species whose spellcasting ability has not been chosen yet (33 of the 34
 * species entries). It must not silently borrow the character's class numbers
 * — that ability is not what the species casts with — so it resolves to the
 * stated reason instead, and the row appears saying so (D43/D58).
 */
function casterFor(
	entry: SheetSpellEntry,
	classEntries: SpellcastingEntry[],
	featEntries: FeatSpellcastingEntry[],
	speciesEntries: SpeciesSpellcastingEntry[],
): { attack: SpellActionAttack; save: SpellActionSave } | { reason: string } {
	const featEntry = featEntries.find((f) => entry.featOrigins.includes(f.featName))
	const speciesEntry = speciesEntries.find((s) => entry.speciesOrigins.includes(s.speciesName))
	const grantedByClass = entry.chosen || entry.subclassOrigins.length > 0 || entry.optionalFeatureOrigins.length > 0
	if (featEntry && !grantedByClass) return toCaster(featEntry)
	if (speciesEntry && !grantedByClass) return toCaster(speciesEntry)
	if (!grantedByClass && !featEntry && entry.unresolvedAbilityReasons.length > 0) {
		return { reason: `"${entry.name}" is granted by your species, and its ${entry.unresolvedAbilityReasons.join('; ')} — no spell attack bonus or save DC yet.` }
	}
	if (classEntries.length === 1) return toCaster(classEntries[0]!)
	if (featEntry) return toCaster(featEntry)
	if (speciesEntry) return toCaster(speciesEntry)
	if (classEntries.length === 0) {
		return { reason: `No spellcasting ability is known for "${entry.name}" — nothing grants this character a spell attack bonus or save DC.` }
	}
	return { reason: `"${entry.name}" could belong to more than one casting class, and the spell list does not record which — multiclass is build order step 10.` }
}

function toCaster(source: SpellcastingEntry | FeatSpellcastingEntry | SpeciesSpellcastingEntry): { attack: SpellActionAttack; save: SpellActionSave } {
	return {
		attack: { bonus: source.spellAttackBonus, breakdown: source.spellAttackBreakdown },
		save: { dc: source.spellSaveDC, breakdown: source.spellSaveDCBreakdown, abilities: [] },
	}
}

/**
 * The dice a cantrip does at `characterLevel`, one string per
 * `scalingLevelDice` entry. Thresholds are character level (1/5/11/17, or
 * 5/11/17 for a second entry that only starts existing at 5) — an entry whose
 * lowest threshold is above the character's level contributes nothing.
 */
export function cantripDamageAtLevel(scalingLevelDice: SpellScalingLevelDiceEntry[], characterLevel: number): string[] {
	const lines: string[] = []
	for (const entry of scalingLevelDice) {
		const reached = Object.keys(entry.scaling)
			.map(Number)
			.filter((threshold) => threshold <= characterLevel)
			.sort((a, b) => a - b)
		const at = reached[reached.length - 1]
		if (at === undefined) continue
		lines.push(`${entry.scaling[String(at)]} ${entry.label}`)
	}
	return lines
}

export interface SpellGroupData {
	key: string
	entry: SheetSpellEntry
	detail: SpellDetail
	actionType: 'bonus' | 'reaction'
}

/**
 * The spells that go into the Bonus Action / Reaction groups (D182): no attack
 * roll and no save (those are table rows above), cast by the structured
 * `time[0].unit`. An action/minute/hour spell without either is not listed.
 * One row per Spells-tab entry.
 */
export function spellGroupRows(entries: SheetSpellEntry[], details: SpellDetail[]): SpellGroupData[] {
	const rows: SpellGroupData[] = []
	for (const entry of entries) {
		const detail = findSpellDetail(details, entry.name, entry.source)
		if (!detail || (detail.spellAttack?.length ?? 0) > 0 || (detail.savingThrow?.length ?? 0) > 0) continue
		const unit = detail.time[0]?.unit
		if (unit === 'bonus' || unit === 'reaction') rows.push({ key: keyOf(entry.name, entry.source), entry, detail, actionType: unit })
	}
	return rows.sort((a, b) => a.detail.level - b.detail.level || a.entry.name.localeCompare(b.entry.name))
}

/**
 * One entry per spell that has an attack roll or a saving throw, sorted by
 * level then name. A spell with neither (Mage Armor, Detect Magic) is left out
 * — it stays in the Kouzla tab rather than being duplicated here. So is a
 * spell whose text could not be found at all: without its data there is no way
 * to know it has an attack or a save, and the Kouzla tab already reports the
 * missing text (D43).
 */
export function spellActionRows(
	entries: SheetSpellEntry[],
	details: SpellDetail[],
	characterLevel: number,
	classEntries: SpellcastingEntry[],
	featEntries: FeatSpellcastingEntry[],
	speciesEntries: SpeciesSpellcastingEntry[] = [],
): SpellActionData[] {
	const rows: SpellActionData[] = []

	for (const entry of entries) {
		const detail = findSpellDetail(details, entry.name, entry.source)
		if (!detail) continue
		const hasAttack = (detail.spellAttack?.length ?? 0) > 0
		const saveAbilities = detail.savingThrow ?? []
		if (!hasAttack && saveAbilities.length === 0) continue

		const caster = casterFor(entry, classEntries, featEntries, speciesEntries)
		const resolved = 'reason' in caster ? null : caster

		rows.push({
			key: keyOf(entry.name, entry.source),
			name: entry.name,
			level: detail.level,
			ritual: detail.ritual,
			concentration: detail.concentration,
			range: formatRange(detail.range),
			attack: hasAttack && resolved ? resolved.attack : null,
			save: saveAbilities.length > 0 && resolved ? { ...resolved.save, abilities: saveAbilities } : null,
			damage: cantripDamageAtLevel(detail.scalingLevelDice, characterLevel),
			unresolved: 'reason' in caster ? caster.reason : null,
		})
	}

	return rows.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
}
