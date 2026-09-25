/*
 * The Spells tab's sections, filters and cell texts (R7a, D189). Pure (D38)
 * over the combined spell list (SpellList.tsx), spells.json details and the
 * slot counts the sheet already computes.
 */

import { freeCastCounter } from '../calculation/freeCastResources'
import { resolveResourceName } from '../calculation/resources'
import type { FeatSpellcastingEntry, SpeciesSpellcastingEntry, SpellcastingEntry } from '../calculation/spellcasting'
import { alsoCastableWithSlot } from '../spells/alsoCastableWithSlot'
import type { SpellDetail } from '../spells/spellDetailData'
import { findSpellDetail } from '../spells/spellDetailData'
import type { SpellUsage } from '../spells/subclassPreparedSpells'
import type { SheetSpellEntry, SpellGrant } from './SpellList'
import { cantripDamageAtLevel, casterFor, type SpellCaster, toCaster } from './spellActionRowData'
import { formatCastingTime, formatDuration, formatSpellUsage } from './spellFormatting'

export const UNRESOLVED_SECTION = 'unresolved'
export type SpellSectionKey = number | typeof UNRESOLVED_SECTION

export interface SpellsTabRow {
	key: string
	entry: SheetSpellEntry
	detail: SpellDetail | undefined
	/** The spell's own level, set only when it stands in a pact section above that level. */
	badgeLevel: number | null
	castWithSlot: boolean
	/** D106: a chosen spell above what the character can cast now. */
	unavailable: boolean
}

export interface SpellsTabSection {
	key: SpellSectionKey
	ordinarySlots: number
	pactSlots: number
	rows: SpellsTabRow[]
}

export type SpellsTabFilter = 'all' | 'concentration' | 'ritual' | number

/** A class grant is cast with a slot unless its own usage term says otherwise; feat/species grants never here (R7a rendering). */
export function castsWithSlot(entry: SheetSpellEntry): boolean {
	return entry.chosen || entry.grants.some(isPlainClassGrant)
}

function isPlainClassGrant(grant: SpellGrant): boolean {
	return (grant.origin === 'subclass' || grant.origin === 'optionalFeature') && grant.usage === null
}

function keyOf(entry: SheetSpellEntry): string {
	return `${entry.name.toLowerCase()}|${entry.source.toUpperCase()}`
}

/**
 * One section per level that has a spell or a slot, cantrips first, Unresolved last.
 * D189: with pact slots and no ordinary slots, every slot-cast spell up to the pact
 * level stands in the pact level's section (2024 Pact Magic casts at slot level).
 */
export function spellsTabSections({
	entries,
	details,
	ordinarySlots,
	pact,
	unavailableAboveLevel,
}: {
	entries: SheetSpellEntry[]
	details: SpellDetail[]
	/** Index 0 = level 1. */
	ordinarySlots: number[]
	pact: { count: number; slotLevel: number } | null
	unavailableAboveLevel?: number
}): SpellsTabSection[] {
	const pactLevel = pactOnlyLevel(ordinarySlots, pact)
	const placed: { key: SpellSectionKey; row: SpellsTabRow }[] = []
	for (const entry of entries) {
		const detail = findSpellDetail(details, entry.name, entry.source)
		const castWithSlot = castsWithSlot(entry)
		const unavailable = entry.chosen && detail !== undefined && unavailableAboveLevel !== undefined && detail.level > unavailableAboveLevel
		const row: SpellsTabRow = { key: keyOf(entry), entry, detail, badgeLevel: null, castWithSlot, unavailable }
		if (!detail) {
			placed.push({ key: UNRESOLVED_SECTION, row })
		} else if (pactLevel !== null && castWithSlot && detail.level > 0 && detail.level <= pactLevel) {
			if (detail.level !== pactLevel) row.badgeLevel = detail.level
			placed.push({ key: pactLevel, row })
		} else {
			placed.push({ key: detail.level, row })
		}
	}
	return buildSections(ordinarySlots, pact, placed)
}

/** D189: with pact slots and no ordinary slots, slot casts up to the pact level stand in the pact level's section. */
function pactOnlyLevel(ordinarySlots: number[], pact: { count: number; slotLevel: number } | null): number | null {
	return pact !== null && pact.count > 0 && ordinarySlots.every((count) => count === 0) ? pact.slotLevel : null
}

function buildSections<R extends SpellsTabRow>(
	ordinarySlots: number[],
	pact: { count: number; slotLevel: number } | null,
	placed: { key: SpellSectionKey; row: R }[],
): (Omit<SpellsTabSection, 'rows'> & { rows: R[] })[] {
	const sections = new Map<SpellSectionKey, Omit<SpellsTabSection, 'rows'> & { rows: R[] }>()
	const section = (key: SpellSectionKey) => {
		let found = sections.get(key)
		if (!found) {
			const level = typeof key === 'number' ? key : 0
			found = {
				key,
				ordinarySlots: level > 0 ? (ordinarySlots[level - 1] ?? 0) : 0,
				pactSlots: pact !== null && level > 0 && pact.slotLevel === level ? pact.count : 0,
				rows: [],
			}
			sections.set(key, found)
		}
		return found
	}

	ordinarySlots.forEach((count, index) => {
		if (count > 0) section(index + 1)
	})
	if (pact !== null && pact.count > 0) section(pact.slotLevel)
	for (const { key, row } of placed) section(key).rows.push(row)

	for (const found of sections.values()) found.rows.sort((a, b) => a.entry.name.localeCompare(b.entry.name) || a.key.localeCompare(b.key))
	return [...sections.values()].sort((a, b) => {
		if (a.key === UNRESOLVED_SECTION) return 1
		if (b.key === UNRESOLVED_SECTION) return -1
		return a.key - b.key
	})
}

// --- R7b rows: CAST / USE / label (D190) --------------------------------------

export type SpellRowAction =
	| { kind: 'cast' }
	| { kind: 'use'; grant: SpellGrant; counterKey: string; cost: number; max: number | null; label: string }
	| { kind: 'label'; label: string }

export interface SpellsTabActionRow extends SpellsTabRow {
	action: SpellRowAction
}

export type SpellsTabActionSection = Omit<SpellsTabSection, 'rows'> & { rows: SpellsTabActionRow[] }

function useLabel(usage: SpellUsage): string {
	if (usage.kind !== 'resource') return shortUsageLabel(usage)
	const initials = resolveResourceName(usage.resourceName)
		.split(/\s+/)
		.map((word) => word.charAt(0).toUpperCase())
		.join('')
	return `${usage.cost} ${initials}`
}

/**
 * Additive to spellsTabSections until R7b-2 renders it: each spell expands into a
 * CAST row (chosen, a plain class grant, or a grant from a source that is also
 * slot-castable — only with any spell slots), one USE row per counted grant, and a
 * label row only when it has neither. CAST follows D189's pact placement; USE and
 * label rows stay in the spell's own level (D190).
 */
export function spellsTabActionSections({
	entries,
	details,
	ordinarySlots,
	pact,
	unavailableAboveLevel,
	resourceMaxima,
}: {
	entries: SheetSpellEntry[]
	details: SpellDetail[]
	/** Index 0 = level 1. */
	ordinarySlots: number[]
	pact: { count: number; slotLevel: number } | null
	unavailableAboveLevel?: number
	/** The sheet's known resource maxima, free-cast counters included. */
	resourceMaxima: ReadonlyMap<string, number>
}): SpellsTabActionSection[] {
	const pactLevel = pactOnlyLevel(ordinarySlots, pact)
	const hasSlots = ordinarySlots.some((count) => count > 0) || (pact?.count ?? 0) > 0
	const placed: { key: SpellSectionKey; row: SpellsTabActionRow }[] = []

	for (const entry of entries) {
		const detail = findSpellDetail(details, entry.name, entry.source)
		const spellKey = keyOf(entry)
		const unavailable = entry.chosen && detail !== undefined && unavailableAboveLevel !== undefined && detail.level > unavailableAboveLevel
		const base = { entry, detail, badgeLevel: null, castWithSlot: false, unavailable }
		const labelRow = (key: SpellSectionKey, label: string) =>
			placed.push({ key, row: { ...base, key: `${spellKey}#label`, action: { kind: 'label', label } } })

		if (!detail) {
			labelRow(UNRESOLVED_SECTION, entry.usages.map(shortUsageLabel).join(' · '))
			continue
		}
		if (detail.level === 0) {
			labelRow(0, 'At will')
			continue
		}

		const cast = hasSlots && (entry.chosen || entry.grants.some((grant) => isPlainClassGrant(grant) || alsoCastableWithSlot(grant.originName)))
		if (cast) {
			const inPact = pactLevel !== null && detail.level <= pactLevel
			placed.push({
				key: inPact ? pactLevel : detail.level,
				row: { ...base, key: `${spellKey}#cast`, badgeLevel: inPact && detail.level !== pactLevel ? detail.level : null, castWithSlot: true, action: { kind: 'cast' } },
			})
		}

		const counterKeys = new Set<string>()
		for (const grant of entry.grants) {
			const counter = freeCastCounter(entry, grant)
			if (!counter || !grant.usage || counterKeys.has(counter.key)) continue
			counterKeys.add(counter.key)
			placed.push({
				key: detail.level,
				row: {
					...base,
					unavailable: false,
					key: `${spellKey}#use:${counter.key}`,
					action: { kind: 'use', grant, counterKey: counter.key, cost: counter.cost, max: resourceMaxima.get(counter.key) ?? null, label: useLabel(grant.usage) },
				},
			})
		}

		if (!cast && counterKeys.size === 0) labelRow(detail.level, entry.usages.map(shortUsageLabel).join(' · '))
	}
	return buildSections(ordinarySlots, pact, placed)
}

/**
 * Spells tab only (D190): a USE row casts with its granting feat's or species'
 * numbers, a CAST row with the casting class; Actions keeps casterFor per spell.
 */
export function spellsTabRowCaster(
	row: SpellsTabActionRow,
	classEntries: SpellcastingEntry[],
	featEntries: FeatSpellcastingEntry[],
	speciesEntries: SpeciesSpellcastingEntry[],
): SpellCaster {
	const grant = row.action.kind === 'use' ? row.action.grant : null
	if (grant?.origin === 'feat') {
		const own = featEntries.find((entry) => entry.featName === grant.originName)
		if (own) return toCaster(own)
	}
	if (grant?.origin === 'species') {
		const own = speciesEntries.find((entry) => entry.speciesName === grant.originName)
		if (own) return toCaster(own)
		if (row.entry.unresolvedAbilityReasons.length > 0) {
			return { reason: `"${row.entry.name}" is granted by your species, and its ${row.entry.unresolvedAbilityReasons.join('; ')} — no spell attack bonus or save DC yet.` }
		}
	}
	if (row.action.kind === 'cast' && classEntries.length === 1) return toCaster(classEntries[0]!)
	return casterFor(row.entry, classEntries, featEntries, speciesEntries)
}

/** Search (name contains, any case) and the single-select pill combine; a level pill picks a section. */
export function filterSpellsTabSections(sections: SpellsTabSection[], filter: SpellsTabFilter, search: string): SpellsTabSection[] {
	const needle = search.trim().toLowerCase()
	return sections
		.filter((section) => typeof filter !== 'number' || section.key === filter)
		.map((section) => ({
			...section,
			rows: section.rows.filter(
				(row) =>
					(filter !== 'concentration' || row.detail?.concentration === true) &&
					(filter !== 'ritual' || row.detail?.ritual === true) &&
					row.entry.name.toLowerCase().includes(needle),
			),
		}))
		.filter((section) => section.rows.length > 0 || (needle === '' && (filter === 'all' || filter === section.key)))
}

export function ordinalLevel(level: number): string {
	const suffix = level === 1 ? 'st' : level === 2 ? 'nd' : level === 3 ? 'rd' : 'th'
	return `${level}${suffix}`
}

export function sectionLabel(key: SpellSectionKey): string {
	if (key === UNRESOLVED_SECTION) return 'Unresolved'
	return key === 0 ? 'Cantrips' : `${ordinalLevel(key)} Level`
}

export function shortUsageLabel(usage: SpellUsage): string {
	switch (usage.kind) {
		case 'atWill':
			return 'At will'
		case 'onceFreePerLongRest':
			return '1/LR'
		case 'onceFreePerShortOrLongRest':
			return '1/SR'
		case 'freePerLongRestByAbility':
			return `${usage.ability.toUpperCase()}/LR`
		case 'freePerLongRestByProficiencyBonus':
			return 'PB/LR'
		case 'ritual':
			return 'Ritual'
		case 'resource':
			return `${usage.cost} ${usage.resourceName}`
		case 'noSlot':
			return 'No slot'
	}
}

function capitalise(word: string): string {
	return word.charAt(0).toUpperCase() + word.slice(1)
}

/**
 * The Effect column: a cantrip's structured dice at the character's level;
 * otherwise damage types, else conditions. Leveled dice live only in prose (D21, R8).
 */
export function spellEffect(detail: SpellDetail, characterLevel: number): { dice: string[] } | { text: string } | null {
	if (detail.level === 0) {
		const dice = cantripDamageAtLevel(detail.scalingLevelDice, characterLevel)
		if (dice.length > 0) return { dice }
	}
	const names = detail.damageInflict.length > 0 ? detail.damageInflict : detail.conditionInflict
	return names.length > 0 ? { text: names.map(capitalise).join(', ') } : null
}

/** Without the reaction trigger — the expanded text carries it. */
export function shortCastingTime(detail: SpellDetail): string {
	return formatCastingTime(detail.time.map((time) => ({ ...time, condition: undefined })))
}

/** Usage terms · "V, S, M" · duration without the concentration prefix (the subtitle names it). */
export function spellNotes(entry: SheetSpellEntry, detail: SpellDetail): string {
	const components = detail.components
	const letters = components ? [components.v && 'V', components.s && 'S', components.m && 'M'].filter(Boolean).join(', ') : ''
	const duration = formatDuration(detail.duration.map((d) => ({ ...d, concentration: false })))
	return [...entry.usages.map(formatSpellUsage), letters, duration].filter((part) => part !== '').join(' · ')
}

/** Short sources plus the flags; the chosen source is the casting class when there is exactly one. */
export function spellSubtitle(row: SpellsTabRow, castingClassName: string | null): string {
	const { entry, detail } = row
	const parts = [
		...(entry.chosen ? [castingClassName ?? 'Chosen'] : []),
		...entry.subclassOrigins,
		...entry.featOrigins,
		...entry.optionalFeatureOrigins,
		...entry.speciesOrigins,
	]
	if (detail?.concentration) parts.push('Concentration')
	if (detail?.ritual) parts.push('Ritual')
	if (row.unavailable) parts.push('Unavailable at this level')
	return [...new Set(parts)].join(' · ')
}
