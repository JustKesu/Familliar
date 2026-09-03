/*
 * Damage resistances, immunities and vulnerabilities (build order step 7,
 * slice f). A NEW file in this folder per D47.
 *
 * Pure (D38): every source is resolved by the caller
 * (src/sheet/damageResponseData.ts) and handed in as a flat list of grants.
 * Resistance, immunity and vulnerability are one mechanism and share one
 * result — the sheet shows one list, so building three would mean building the
 * collapsing and the precedence rule three times.
 *
 * What the data actually carries, from this slice's survey
 * (scripts/investigate-damage-responses.js over all six files):
 *
 *   resist       items 54, species 32, feats 3
 *   immune       items 3
 *   vulnerable   NOWHERE — no file carries the key at all
 *
 * so `vulnerability` below is reachable only through a future source. The
 * survey also found only TWO value shapes — a plain lowercase damage-type
 * string (103) and `{"choose":{"from":[...]}}` (3) — and none of the
 * `note`/`cond`/`special` object forms 5etools uses for creatures. The 13
 * damage-type strings that occur are the standard 13, all lowercase.
 *
 * Class and subclass features carry NO structured field: every feature-granted
 * resistance is prose, which D21 does not parse. The ones transcribed by hand
 * are in src/damageResponses/featureDamageResponses.ts (D70).
 */

import type { Contribution } from './types'

export type DamageResponseKind = 'resistance' | 'immunity' | 'vulnerability'

/**
 * Immunity outranks the other two for the same damage type. Resistance and
 * vulnerability are deliberately equal: the rules cancel them against each
 * other, but no source in this data grants a vulnerability, so a cancelling
 * branch would be untestable against anything real (docs/REPORT.md).
 */
const RANK: Record<DamageResponseKind, number> = { immunity: 2, resistance: 1, vulnerability: 1 }

/** One source's claim, before collapsing. The caller builds these; nothing here reads a data file. */
export interface DamageResponseGrant {
	kind: DamageResponseKind
	/** The source as the player should see it: "Dwarf", "Ring of Fire Resistance", "Rage (Barbarian)". */
	sourceName: string
	/** Lowercase damage types, as the data spells them. Empty when `choiceFrom` or `withheldReason` is set. */
	damageTypes: string[]
	/**
	 * Stated when the response only applies sometimes. The app cannot see
	 * whether the condition holds until step 9, so a grant carrying one is shown
	 * and never counted (D76, the same treatment Mage Armor gets in the AC
	 * section).
	 */
	condition?: string
	/** The source is owned but not in effect — an unattuned item. Shown as a considered candidate (D76), contributes nothing. */
	withheldReason?: string
	/** The source grants ONE of these and nothing stores which. Shown with the options listed, contributes nothing. */
	choiceFrom?: string[]
	/** The source itself could not be resolved against the data (D43). Named anyway, with the problem stated. */
	unresolvedReason?: string
}

export interface DamageResponse {
	/** Stable key for a list, unique across both lists. */
	key: string
	damageType: string
	kind: DamageResponseKind
	/** Null when it always applies. */
	condition: string | null
	/** Every source granting it — collapsed to one line rather than repeated (this slice's brief). */
	sources: string[]
	/** Set when a higher-ranked response for the same damage type makes this one moot; it is still shown, with this reason. */
	supersededBy: string | null
}

/** A source that is known but contributes nothing, with the reason — D76 for a withheld or unmade choice, D43 for an unresolvable one. */
export interface DamageResponseNote {
	sourceName: string
	reason: string
}

export interface DamageResponses {
	/** Always in effect. An entry carrying `supersededBy` is shown but does not apply. */
	unconditional: DamageResponse[]
	/** Shown with the condition stated, NEVER counted and never merged into the unconditional set. */
	conditional: DamageResponse[]
	notes: DamageResponseNote[]
}

const KIND_LABELS: Record<DamageResponseKind, string> = {
	resistance: 'resistance',
	immunity: 'immunity',
	vulnerability: 'vulnerability',
}

export function damageResponseKindLabel(kind: DamageResponseKind): string {
	return KIND_LABELS[kind]
}

/**
 * The 13 damage types of the 2024 rules, lowercase as the data writes them —
 * slice f's survey (scripts/investigate-damage-responses.js, docs/REPORT.md)
 * found the strings in data/ to be exactly these 13. Listed here because a
 * custom item declares its resistances by picking from them (slice e2b), and a
 * free-text field would let "Fire" and "fire" collapse into two separate lines.
 */
export const DAMAGE_TYPES: readonly string[] = [
	'acid',
	'bludgeoning',
	'cold',
	'fire',
	'force',
	'lightning',
	'necrotic',
	'piercing',
	'poison',
	'psychic',
	'radiant',
	'slashing',
	'thunder',
]

/** The one place a damage type is spelled for display; the data stores them lowercase. */
export function damageTypeLabel(damageType: string): string {
	return damageType.charAt(0).toUpperCase() + damageType.slice(1)
}

function collapseKey(kind: DamageResponseKind, damageType: string, condition: string | null): string {
	// The condition is part of the key: a conditional entry must never merge into the unconditional set.
	return `${kind}|${damageType}|${condition ?? ''}`
}

function listSources(sources: string[]): string {
	return sources.join(', ')
}

/**
 * Collapse the grants into one entry per (kind, damage type, condition), then
 * apply the precedence rule. Two sources granting the same resistance become
 * one line naming both.
 *
 * Supersession is only ever caused by an UNCONDITIONAL higher-ranked entry: a
 * conditional immunity the app cannot see the state of must not silence a
 * resistance that always applies.
 */
export function computeDamageResponses(grants: readonly DamageResponseGrant[]): DamageResponses {
	const notes: DamageResponseNote[] = []
	const collapsed = new Map<string, DamageResponse>()

	for (const grant of grants) {
		if (grant.unresolvedReason !== undefined) {
			notes.push({ sourceName: grant.sourceName, reason: grant.unresolvedReason })
			continue
		}
		if (grant.withheldReason !== undefined) {
			notes.push({ sourceName: grant.sourceName, reason: grant.withheldReason })
			continue
		}
		if (grant.choiceFrom !== undefined) {
			notes.push({
				sourceName: grant.sourceName,
				reason: `grants ${damageResponseKindLabel(grant.kind)} to one of ${grant.choiceFrom.map(damageTypeLabel).join(', ')} — the choice is not recorded, so it is not counted`,
			})
			continue
		}

		const condition = grant.condition ?? null
		for (const damageType of grant.damageTypes) {
			const key = collapseKey(grant.kind, damageType, condition)
			const existing = collapsed.get(key)
			if (existing) {
				if (!existing.sources.includes(grant.sourceName)) existing.sources.push(grant.sourceName)
				continue
			}
			collapsed.set(key, { key, damageType, kind: grant.kind, condition, sources: [grant.sourceName], supersededBy: null })
		}
	}

	const all = [...collapsed.values()]
	const unconditional = all.filter((entry) => entry.condition === null)

	for (const entry of all) {
		const better = unconditional.find((other) => other !== entry && other.damageType === entry.damageType && RANK[other.kind] > RANK[entry.kind])
		if (better) {
			entry.supersededBy = `${damageResponseKindLabel(better.kind)} to ${damageTypeLabel(better.damageType)} from ${listSources(better.sources)}`
		}
	}

	const byType = (a: DamageResponse, b: DamageResponse): number => a.damageType.localeCompare(b.damageType) || a.kind.localeCompare(b.kind)

	return {
		unconditional: unconditional.sort(byType),
		conditional: all.filter((entry) => entry.condition !== null).sort(byType),
		notes,
	}
}

/**
 * The D40 breakdown for the section. Not a sum — there is no number here — so
 * every contribution carries 0 and says its piece in the note (D60's
 * mechanism, used the same way the darkvision reconciliation uses it).
 */
export function damageResponseBreakdown(responses: DamageResponses): Contribution[] {
	const contributions: Contribution[] = []
	for (const entry of responses.unconditional) {
		contributions.push({
			source: `${damageTypeLabel(entry.damageType)} — ${damageResponseKindLabel(entry.kind)} (${listSources(entry.sources)})`,
			amount: 0,
			note: entry.supersededBy ? `not applied: superseded by ${entry.supersededBy}` : 'applies',
		})
	}
	for (const entry of responses.conditional) {
		contributions.push({
			source: `${damageTypeLabel(entry.damageType)} — ${damageResponseKindLabel(entry.kind)} (${listSources(entry.sources)})`,
			amount: 0,
			note: `not counted: only ${entry.condition}`,
		})
	}
	for (const note of responses.notes) {
		contributions.push({ source: note.sourceName, amount: 0, note: note.reason })
	}
	return contributions
}
