/*
 * Pure text formatting for a spell's structured detail fields
 * (spellDetailData.ts) into the labels a D&D sheet shows — Casting Time,
 * Range, Components, Duration, Attack/Save. Display-only (D38-style: no
 * calculation, just formatting already-structured data), used by the
 * sheet's spell detail view (build order step 6, slice d4).
 */

import type { SpellComponents, SpellDuration, SpellRange, SpellScalingLevelDiceEntry, SpellTime } from '../spells/spellDetailData'
import type { SpellUsage } from '../spells/subclassPreparedSpells'

const TIME_UNIT_LABELS: Record<string, string> = {
	action: 'action',
	bonus: 'bonus action',
	reaction: 'reaction',
	minute: 'minute',
	hour: 'hour',
}

function pluralize(label: string, count: number): string {
	return count === 1 ? label : `${label}s`
}

export function formatCastingTime(time: SpellTime[]): string {
	if (time.length === 0) return 'Unknown'
	return time
		.map((t) => {
			const label = TIME_UNIT_LABELS[t.unit] ?? t.unit
			const base = `${t.number} ${pluralize(label, t.number)}`
			return t.condition ? `${base} (${t.condition})` : base
		})
		.join(', ')
}

const DISTANCE_UNIT_LABELS: Record<string, string> = {
	feet: 'foot',
	miles: 'mile',
}

function formatDistance(distance: { type: string; amount?: number } | undefined): string {
	if (!distance) return 'Unknown'
	if (distance.type === 'self') return 'Self'
	if (distance.type === 'touch') return 'Touch'
	if (distance.type === 'sight') return 'Sight'
	if (distance.type === 'unlimited') return 'Unlimited'
	const unit = DISTANCE_UNIT_LABELS[distance.type] ?? distance.type
	return `${distance.amount ?? '?'} ${pluralize(unit, distance.amount ?? 0)}`
}

const AREA_RANGE_TYPES = new Set(['radius', 'cone', 'line', 'sphere', 'cube', 'emanation'])

export function formatRange(range: SpellRange | undefined): string {
	if (!range) return 'Unknown'
	if (range.type === 'point' || !AREA_RANGE_TYPES.has(range.type)) return formatDistance(range.distance)

	const distance = range.distance
	if (distance && (distance.type === 'feet' || distance.type === 'miles')) {
		const unit = DISTANCE_UNIT_LABELS[distance.type] ?? distance.type
		return `${distance.amount}-${unit} ${range.type}`
	}
	return `${formatDistance(distance)} ${range.type}`
}

export function formatComponents(components: SpellComponents | undefined): string {
	if (!components) return 'None'
	const parts: string[] = []
	if (components.v) parts.push('V')
	if (components.s) parts.push('S')
	if (components.m) {
		if (typeof components.m === 'string') parts.push(`M (${components.m})`)
		else if (typeof components.m === 'object' && components.m.text) parts.push(`M (${components.m.text})`)
		else parts.push('M')
	}
	return parts.length > 0 ? parts.join(', ') : 'None'
}

export function formatDuration(duration: SpellDuration[]): string {
	if (duration.length === 0) return 'Unknown'
	return duration
		.map((d) => {
			if (d.type === 'instant') return 'Instantaneous'
			if (d.type === 'permanent') return 'Until dispelled'
			if (d.type === 'special') return 'Special'
			// 'timed'
			const inner = d.duration
			if (!inner) return 'Unknown'
			const base = `${inner.amount} ${pluralize(inner.type, inner.amount)}`
			return d.concentration ? `Concentration, up to ${base}` : base
		})
		.join(' or ')
}

const ATTACK_LABELS: Record<string, string> = { M: 'Melee', R: 'Ranged' }
const ABILITY_LABELS: Record<string, string> = {
	strength: 'Strength',
	dexterity: 'Dexterity',
	constitution: 'Constitution',
	intelligence: 'Intelligence',
	wisdom: 'Wisdom',
	charisma: 'Charisma',
}

/** Returns undefined when the spell is neither an attack nor a save — the detail view omits the row entirely rather than showing "None". */
export function formatAttackOrSave(spellAttack: string[] | undefined, savingThrow: string[] | undefined): string | undefined {
	const parts: string[] = []
	if (spellAttack && spellAttack.length > 0) {
		parts.push(`${spellAttack.map((a) => ATTACK_LABELS[a] ?? a).join('/')} spell attack`)
	}
	if (savingThrow && savingThrow.length > 0) {
		parts.push(`${savingThrow.map((a) => ABILITY_LABELS[a] ?? a).join('/')} save`)
	}
	return parts.length > 0 ? parts.join('; ') : undefined
}

/**
 * The wording a player would use for a granted spell's usage (this task).
 * `freePerLongRestByAbility` shows which ability, not a number — no ability
 * score is threaded through the grant modules to compute the actual modifier.
 * `noSlot` (optionalFeatureSpells.ts's bare-invocation default) deliberately
 * carries no frequency, since the data only confirms the spell is slot-free,
 * never how often (docs/REPORT.md). The rest-based terms DO carry the
 * frequency — every source's own rules text states it (`SpellUsage` doc).
 */
export function formatSpellUsage(usage: SpellUsage): string {
	switch (usage.kind) {
		case 'atWill':
			return 'at will'
		case 'onceFreePerLongRest':
			return '1/long rest (no slot)'
		case 'onceFreePerShortOrLongRest':
			return '1/short or long rest (no slot)'
		case 'freePerLongRestByAbility':
			return `${usage.ability.toUpperCase()} mod/long rest (no slot)`
		case 'ritual':
			return 'ritual (no slot)'
		case 'resource':
			return `${usage.cost} ${usage.resourceName}`
		case 'noSlot':
			return 'no spell slot'
	}
}

/** Identity for deduping a spell's usage terms across sources (SpellList.tsx's `combineSpellEntries`) — two sources granting the SAME usage collapse to one label; different terms both survive. */
export function spellUsageKey(usage: SpellUsage): string {
	switch (usage.kind) {
		case 'freePerLongRestByAbility':
			return `freePerLongRestByAbility:${usage.ability}`
		case 'resource':
			return `resource:${usage.cost}:${usage.resourceName}`
		default:
			return usage.kind
	}
}

export function spellLevelLabel(level: number): string {
	return level === 0 ? 'Cantrip' : `Level ${level}`
}

/** One comma-joined line: dice value plus the character-level range it applies at, per threshold (open-ended for the last one). */
function formatDiceThresholds(scaling: Record<string, string>): string {
	const thresholds = Object.keys(scaling)
		.map(Number)
		.sort((a, b) => a - b)
	return thresholds
		.map((level, i) => {
			const dice = scaling[String(level)]
			const next = thresholds[i + 1]
			const range = next !== undefined ? `${level}-${next - 1}` : `${level}+`
			return `${dice} (${range})`
		})
		.join(', ')
}

/** One line per `scalingLevelDice` entry (usually one; Booming Blade-style spells have two). */
export function formatScalingLevelDice(entries: SpellScalingLevelDiceEntry[]): string[] {
	return entries.map((entry) => `${entry.label}: ${formatDiceThresholds(entry.scaling)}`)
}
