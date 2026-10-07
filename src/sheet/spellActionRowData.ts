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
 * - Leveled spells carry their dice only as `{@damage XdY}` tags inside
 *   `entries`; D206 reads those tags (not the prose around them) together with
 *   the `{@scale…}` tags of entriesHigherLevel. Cantrips use `scalingLevelDice`
 *   (24), whose own `label` already names the damage type ("Fire damage",
 *   "thunder damage on hit"), shown as-is at the character's level.
 * - "Half damage on a save" is prose only — no top-level field anywhere marks
 *   it — so the Notes cell stays empty rather than being parsed out of text.
 */

import type { FeatSpellcastingEntry, SpeciesSpellcastingEntry, SpellcastingEntry } from '../calculation/spellcasting'
import type { Contribution } from '../calculation/types'
import type { SpellDetail, SpellScalingLevelDiceEntry } from '../spells/spellDetailData'
import { findSpellDetail } from '../spells/spellDetailData'
import { spellEntryKey, type SheetSpellEntry, type SpellGrant } from './SpellList'
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
	/** Cantrip: dice + type per `scalingLevelDice` entry at the character's level. Leveled: leveledSpellDice at the spell's own level (D206). */
	damage: string[]
	/** D43: set when the spell needs a to-hit/DC but no caster entry could be attributed to it — the row still appears, saying why the number is missing. */
	unresolved: string | null
	/** R14c2: the item a custom item's spell row comes from. */
	origin?: string
}

/**
 * Which caster the spell's numbers come from. A feat- or species-granted spell
 * uses its own source's entry (a Fighter with Magic Initiate, or an Aasimar
 * Fighter, has no casting class at all — computeFeatSpellcasting and
 * computeSpeciesSpellcasting exist for exactly that); anything else uses the
 * character's casting class. A pick casts with the class that chose it, a
 * class or subclass grant with its own class (D325); anything else under more
 * than one casting class resolves to nothing rather than to an arbitrary pick.
 *
 * The race slice adds one case the others don't have: a spell granted ONLY by
 * a species whose spellcasting ability has not been chosen yet (33 of the 34
 * species entries). It must not silently borrow the character's class numbers
 * — that ability is not what the species casts with — so it resolves to the
 * stated reason instead, and the row appears saying so (D43/D58).
 */
export type SpellCaster = { attack: SpellActionAttack; save: SpellActionSave } | { reason: string }

/**
 * A2-4: the one answer to "who casts this spell" for the Actions row, the Spells
 * CAST row (grant null) and the Spells USE row (its own grant). A USE row casts
 * with its granting feat instance or species; everything else goes by where the
 * spell came from — a class grant or class pick with class numbers, a spell only
 * a feat or species grants with that source's numbers (A2-2, D315).
 */
export function casterFor(
	entry: SheetSpellEntry,
	classEntries: SpellcastingEntry[],
	featEntries: FeatSpellcastingEntry[],
	speciesEntries: SpeciesSpellcastingEntry[],
	grant: SpellGrant | null = null,
): SpellCaster {
	if (grant?.origin === 'feat') {
		const own = featEntries.find((f) => f.featKey === (grant.instanceKey ?? grant.originName))
		if (own) return toCaster(own)
		if (entry.unresolvedAbilityReasons.length > 0) return unresolvedCaster(entry)
	}
	if (grant?.origin === 'species') {
		const own = speciesEntries.find((s) => s.speciesName === grant.originName)
		if (own) return toCaster(own)
		if (entry.unresolvedAbilityReasons.length > 0) return unresolvedCaster(entry)
	}
	const featKeys = entry.grants.filter((g) => g.origin === 'feat').map((g) => g.instanceKey ?? g.originName)
	const featEntry = featEntries.find((f) => featKeys.includes(f.featKey)) ?? featEntries.find((f) => entry.featOrigins.includes(f.featName) && f.featKey === f.featName)
	const speciesEntry = speciesEntries.find((s) => entry.speciesOrigins.includes(s.speciesName))
	// R14c1: an item's invocation casts with a Warlock's numbers; without a Warlock level there are none to borrow (D43).
	const itemInvocationAsWarlock = entry.itemInvocationOrigins.length > 0 && classEntries.some((c) => c.className === 'Warlock')
	const grantedByClass = entry.chosen || entry.classOrigins.length > 0 || entry.subclassOrigins.length > 0 || entry.optionalFeatureOrigins.length > 0 || itemInvocationAsWarlock
	// D325: a pick casts with the class that chose it.
	if (entry.chosen && entry.chosenBy) {
		const chooser = entry.chosenBy
		const own = classEntries.find((c) => c.className === chooser.className && c.classSource === chooser.classSource)
		if (own) return toCaster(own)
		if (classEntries.length > 1) return { reason: `No spellcasting ability is known for ${chooser.className}, the class that chose "${entry.name}".` }
	}
	// D192: a class-record grant casts with that class's own ability, also in a multiclass; D325: a subclass grant with the class owning the subclass.
	const owners = entry.subclassOwners ?? []
	if (!entry.chosen && (entry.classOrigins.length > 0 || owners.length > 0)) {
		const own = classEntries.filter(
			(c) => entry.classOrigins.includes(c.className) || owners.some((owner) => owner.className === c.className && owner.classSource === c.classSource),
		)
		if (own.length === 1) return toCaster(own[0]!)
	}
	if (featEntry && !grantedByClass) return toCaster(featEntry)
	if (speciesEntry && !grantedByClass) return toCaster(speciesEntry)
	if (!grantedByClass && !featEntry && entry.unresolvedAbilityReasons.length > 0) return unresolvedCaster(entry)
	if (!grantedByClass && !featEntry && !speciesEntry && entry.itemInvocationOrigins.length > 0) {
		return { reason: `"${entry.name}" is granted by the invocation ${entry.itemInvocationOrigins.join(' / ')}, cast with a Warlock's spellcasting ability — this character has no Warlock level, so no spell attack bonus or save DC.` }
	}
	if (classEntries.length === 1) return toCaster(classEntries[0]!)
	if (featEntry) return toCaster(featEntry)
	if (speciesEntry) return toCaster(speciesEntry)
	if (classEntries.length === 0) {
		return { reason: `No spellcasting ability is known for "${entry.name}" — nothing grants this character a spell attack bonus or save DC.` }
	}
	return { reason: `"${entry.name}" could belong to more than one casting class, and the spell list does not record which class holds it.` }
}

export function unresolvedCaster(entry: SheetSpellEntry): { reason: string } {
	const grantedBy = entry.speciesOrigins.length > 0 ? 'your species' : `the feat ${entry.featOrigins.join(' / ')}`
	return { reason: `"${entry.name}" is granted by ${grantedBy}, and its ${entry.unresolvedAbilityReasons.join('; ')} — no spell attack bonus or save DC yet.` }
}

export function toCaster(
	source: Pick<SpellcastingEntry, 'spellAttackBonus' | 'spellAttackBreakdown' | 'spellSaveDC' | 'spellSaveDCBreakdown'>,
): { attack: SpellActionAttack; save: SpellActionSave } {
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

const SCALE_TAG = /\{@scale(damage|dice) ([^}]*)\}/g

/** "3-9" or Spirit Shroud's "3,5,7,9": the slot levels at which one more INC applies (the first adds none). */
function scaleLevels(range: string): number[] {
	const [min, max] = range.split('-').map(Number)
	if (max !== undefined) return Array.from({ length: max - min! + 1 }, (_, index) => min! + index)
	return range.split(',').map(Number)
}

/** "10d6 + 40" plus k×"3d6" bumps the d6 term; flat INC bumps the flat term; anything else stays readable text. */
function addIncrements(base: string, increment: string, times: number): string {
	if (times <= 0) return base
	const terms = base.split('+').map((term) => term.trim())
	const incDice = /^(\d+)d(\d+)$/.exec(increment)
	const incFlat = /^\d+$/.test(increment)
	const index = terms.findIndex((term) => (incDice ? new RegExp(`^\\d+d${incDice[2]}$`).test(term) : incFlat && /^\d+$/.test(term)))
	if (index === -1) return `${base} + ${times}×${increment}`
	const term = terms[index]!
	terms[index] = incDice ? `${parseInt(term, 10) + times * Number(incDice[1])}d${incDice[2]}` : String(Number(term) + times * Number(increment))
	return terms.join(' + ')
}

const sameDice = (a: string, b: string) => a.replace(/\s+/g, '') === b.replace(/\s+/g, '')

/**
 * D206: a leveled spell's Effect dice at `slotLevel`, one line per `{@damage}`
 * tag of its entries in text order (plus `{@dice}` for `{@scaledice}` spells),
 * each raised by the `{@scale…}` tags of entriesHigherLevel (DATA.md).
 */
export function leveledSpellDice(detail: SpellDetail, slotLevel: number): string[] {
	const scales = [...JSON.stringify(detail.entriesHigherLevel).matchAll(SCALE_TAG)].flatMap((match) => {
		const [bases = '', range = '', increment = ''] = match[2]!.split('|')
		const times = scaleLevels(range).filter((level) => level <= slotLevel).length - 1
		return bases.split(';').map((base) => ({ base: base.trim(), value: addIncrements(base.trim(), increment.trim(), times), kind: match[1] }))
	})
	const withDice = scales.some((scale) => scale.kind === 'dice')
	const lines = [...JSON.stringify(detail.entries).matchAll(/\{@(damage|dice) ([^}|]*)[^}]*\}/g)]
		.filter((match) => match[1] === 'damage' || withDice)
		.map((match) => match[2]!.trim())
	const scaled = lines.map((line) => scales.find((scale) => sameDice(scale.base, line))?.value ?? line)
	const unmatched = scales.filter((scale) => !lines.some((line) => sameDice(scale.base, line))).map((scale) => scale.value)
	// D207: the same dice named twice in entries (Backlash, Wall of Light) scale identically — one line, not two.
	return [...new Set([...scaled, ...unmatched])]
}

/** D206: healing text only where the healing dice are shown, i.e. `{@scaledice}` spells tagged HL. */
export function isScaledHealing(detail: SpellDetail): boolean {
	return (detail.miscTags ?? []).includes('HL') && /\{@scaledice /.test(JSON.stringify(detail.entriesHigherLevel))
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
		if (unit === 'bonus' || unit === 'reaction') rows.push({ key: spellEntryKey(entry), entry, detail, actionType: unit })
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
	/** R14c2: rows built elsewhere (a custom item's spells) sorted in with these. */
	extraRows: SpellActionData[] = [],
): SpellActionData[] {
	const rows: SpellActionData[] = [...extraRows]

	for (const entry of entries) {
		const detail = findSpellDetail(details, entry.name, entry.source)
		if (!detail) continue
		const row = spellActionData(spellEntryKey(entry), entry.name, detail, () => casterFor(entry, classEntries, featEntries, speciesEntries), characterLevel)
		// D325: with two casting classes a pick's row names its class, so a spell both chose reads as two rows.
		if (row && entry.chosen && entry.chosenBy && classEntries.length > 1) row.origin = entry.chosenBy.className
		if (row) rows.push(row)
	}

	return rows.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
}

/** One actions-table row, or null for a spell with neither an attack roll nor a save; leveled dice at `castLevel` (D206). */
export function spellActionData(
	key: string,
	name: string,
	detail: SpellDetail,
	casterOf: () => SpellCaster,
	characterLevel: number,
	castLevel = detail.level,
): SpellActionData | null {
	const hasAttack = (detail.spellAttack?.length ?? 0) > 0
	const saveAbilities = detail.savingThrow ?? []
	if (!hasAttack && saveAbilities.length === 0) return null

	const caster = casterOf()
	const resolved = 'reason' in caster ? null : caster
	return {
		key,
		name,
		level: detail.level,
		ritual: detail.ritual,
		concentration: detail.concentration,
		range: formatRange(detail.range),
		attack: hasAttack && resolved ? resolved.attack : null,
		save: saveAbilities.length > 0 && resolved ? { ...resolved.save, abilities: saveAbilities } : null,
		damage: detail.level === 0 ? cantripDamageAtLevel(detail.scalingLevelDice, characterLevel) : leveledSpellDice(detail, castLevel),
		unresolved: 'reason' in caster ? caster.reason : null,
	}
}
