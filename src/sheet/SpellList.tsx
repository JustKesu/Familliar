import type { ReactNode } from 'react'
import type { ResolverData } from '../featureResolver'
import { ResolvedEntries } from '../featureResolver'
import type { SpellDetail } from '../spells/spellDetailData'
import type { SpellUsage } from '../spells/subclassPreparedSpells'
import { formatAttackOrSave, formatCastingTime, formatComponents, formatDuration, formatRange, formatScalingLevelDice, formatSpellUsage, spellUsageKey } from './spellFormatting'

/*
 * The character's spells (build order step 6, slice d4, sheet items 3+4):
 * the player's chosen spells (Character.spellChoices) and the subclass's
 * always-prepared spells (subclassPreparedSpells.ts) shown TOGETHER, grouped
 * by spell level. A spell present in both is shown once with both sources
 * named (the "counted once, sources joined" spirit of D44's skill
 * provenance) — `chosen` and `subclassOrigins` are independent flags on the
 * same entry rather than two rows.
 *
 * R7a (D189): the rows are the Spells tab in CharacterSheet.tsx
 * (spellsTabData.ts); this module keeps the merge, the provenance label and
 * the expanded text.
 *
 * d5a adds feat-granted spells (featSpells.ts) as a third source, merged the
 * same way — `featOrigins` names the granting feat(s), distinct from
 * `subclassOrigins`'s "always prepared (subclass)" label per the user's
 * explicit "from feat (Feat Name)" wording.
 *
 * Step 6a's final slice adds chosen optional features (optionalFeatureSpells.ts)
 * as a fourth source — `optionalFeatureOrigins` names the granting option
 * (an Eldritch Invocation today). Two options CAN grant the same spell
 * (Invisibility, via One with Shadows and Shroud of Shadow), which is exactly
 * the overlap this merge already handles for the other three sources.
 *
 * The race slice adds species grants (raceSpells.ts) as a fifth source —
 * `speciesOrigins` names the species, and `unresolvedAbilityReasons` carries
 * the one thing no other source has: a grant whose spellcasting ability the
 * character has not chosen yet (33 of the 34 species entries), which is stated
 * on the spell rather than left as a missing actions-table row (D58).
 *
 * Slice d4 added `usages` — HOW a granted spell is cast (subclassPreparedSpells.ts's
 * `SpellUsage`), shown next to the provenance rather than replacing it. A list,
 * not a single value, for the same reason origins are lists: if two sources
 * grant the same spell with DIFFERENT usage terms, both survive rather than
 * one being picked arbitrarily (the D44 "counted once, sources joined" spirit
 * applied to usage instead of provenance) — deduped by `spellUsageKey` so the
 * SAME term from two sources doesn't print twice. No real case in the data
 * has two sources disagree on a spell's usage (docs/REPORT.md); the merge
 * still handles it rather than assuming it can't happen.
 */

export type SpellGrantOrigin = 'class' | 'subclass' | 'feat' | 'optionalFeature' | 'species'

/** One source's grant of a spell, with its own usage term (D190) — the player's pick is `chosen`, not a grant. */
export interface SpellGrant {
	origin: SpellGrantOrigin
	originName: string
	usage: SpellUsage | null
}

export interface SheetSpellEntry {
	name: string
	source: string
	chosen: boolean
	/** Subclass name(s) that grant this spell as always-prepared. Almost always 0 or 1 entry; a list only to cover a character with more than one subclass-granting class at once. */
	subclassOrigins: string[]
	/** D192: class(es) whose class record grants this spell as always-prepared (Ranger's Hunter's Mark). */
	classOrigins: string[]
	/** Feat name(s) that grant this spell (featSpells.ts, d5a). Almost always 0 or 1 entry. */
	featOrigins: string[]
	/** Optional-feature name(s) that grant this spell (optionalFeatureSpells.ts, step 6a). More than one is real — see the module comment. */
	optionalFeatureOrigins: string[]
	/** Species name(s) that grant this spell (raceSpells.ts). A character has one species, so 0 or 1 — a list only to keep the five sources one shape. */
	speciesOrigins: string[]
	/**
	 * Why this spell has no attack bonus / save DC yet, when a source granted it
	 * without a resolved spellcasting ability (raceSpells.ts's 33 choice-ability
	 * species). Shown next to the provenance so the gap is visible where the
	 * spell is, not only missing from the actions table (D58).
	 */
	unresolvedAbilityReasons: string[]
	/** How this spell is cast, from every contributing source (this task) — empty for an ordinary, silently-slot-cast spell. */
	usages: SpellUsage[]
	/** Every source grant, each usage tied to its source (D190); `usages` is these usages deduped. */
	grants: SpellGrant[]
}

export function provenanceLabel(entry: SheetSpellEntry): string {
	const parts: string[] = []
	if (entry.chosen) parts.push('player pick')
	for (const className of entry.classOrigins) parts.push(`always prepared (${className})`)
	for (const subclassName of entry.subclassOrigins) parts.push(`always prepared (${subclassName})`)
	for (const featName of entry.featOrigins) parts.push(`from feat (${featName})`)
	for (const optionName of entry.optionalFeatureOrigins) parts.push(`from invocation (${optionName})`)
	for (const speciesName of entry.speciesOrigins) parts.push(`from species (${speciesName})`)
	let label = parts.join('; ')
	if (entry.usages.length > 0) label += ` — ${entry.usages.map(formatSpellUsage).join('; ')}`
	for (const reason of entry.unresolvedAbilityReasons) label += ` — ${reason}`
	return label
}

function keyOf(name: string, source: string): string {
	return `${name.toLowerCase()}|${source.toUpperCase()}`
}

function emptyEntry(name: string, source: string, chosen: boolean): SheetSpellEntry {
	return { name, source, chosen, subclassOrigins: [], classOrigins: [], featOrigins: [], optionalFeatureOrigins: [], speciesOrigins: [], usages: [], unresolvedAbilityReasons: [], grants: [] }
}

/** Records the grant, and adds `usage` to `entry.usages` unless it's absent or already present (by `spellUsageKey`) — an ordinary grant (undefined/null) leaves that list untouched. */
function mergeUsage(entry: SheetSpellEntry, origin: SpellGrantOrigin, originName: string, usage: SpellUsage | null | undefined): void {
	const grantKey = usage ? spellUsageKey(usage) : 'slot'
	if (!entry.grants.some((g) => g.origin === origin && g.originName === originName && (g.usage ? spellUsageKey(g.usage) : 'slot') === grantKey)) {
		entry.grants.push({ origin, originName, usage: usage ?? null })
	}
	if (!usage) return
	const key = spellUsageKey(usage)
	if (!entry.usages.some((u) => spellUsageKey(u) === key)) entry.usages.push(usage)
}

/** Merges the player's chosen spells, every class's subclass always-prepared spells, fixed feat-granted spells (d5a), chosen-optional-feature grants (step 6a) and species grants (raceSpells.ts) into one list, counting an overlap once (D44 spirit). */
export function combineSpellEntries(
	spellChoices: { spells: { name: string; source: string }[] }[],
	subclassAlwaysPrepared: { subclassName: string; spells: { name: string; source: string; usage?: SpellUsage | null }[] }[],
	featGrantedSpells: { featName: string; name: string; source: string; usage?: SpellUsage | null }[] = [],
	optionalFeatureGrantedSpells: { optionName: string; name: string; source: string; usage?: SpellUsage | null }[] = [],
	raceGrantedSpells: { speciesName: string; name: string; source: string; usage?: SpellUsage | null; unresolvedAbilityReason?: string }[] = [],
	classAlwaysPrepared: { className: string; spells: { name: string; source: string; usage?: SpellUsage | null }[] }[] = [],
): SheetSpellEntry[] {
	const map = new Map<string, SheetSpellEntry>()

	for (const group of classAlwaysPrepared) {
		for (const spell of group.spells) {
			const key = keyOf(spell.name, spell.source)
			const entry = map.get(key) ?? emptyEntry(spell.name, spell.source, false)
			if (!entry.classOrigins.includes(group.className)) entry.classOrigins.push(group.className)
			mergeUsage(entry, 'class', group.className, spell.usage)
			map.set(key, entry)
		}
	}

	for (const choice of spellChoices) {
		for (const spell of choice.spells) {
			const key = keyOf(spell.name, spell.source)
			const existing = map.get(key)
			if (existing) existing.chosen = true
			else map.set(key, emptyEntry(spell.name, spell.source, true))
		}
	}

	for (const group of subclassAlwaysPrepared) {
		for (const spell of group.spells) {
			const key = keyOf(spell.name, spell.source)
			const entry = map.get(key) ?? emptyEntry(spell.name, spell.source, false)
			if (!entry.subclassOrigins.includes(group.subclassName)) entry.subclassOrigins.push(group.subclassName)
			mergeUsage(entry, 'subclass', group.subclassName, spell.usage)
			map.set(key, entry)
		}
	}

	for (const spell of featGrantedSpells) {
		const key = keyOf(spell.name, spell.source)
		const entry = map.get(key) ?? emptyEntry(spell.name, spell.source, false)
		if (!entry.featOrigins.includes(spell.featName)) entry.featOrigins.push(spell.featName)
		mergeUsage(entry, 'feat', spell.featName, spell.usage)
		map.set(key, entry)
	}

	for (const spell of optionalFeatureGrantedSpells) {
		const key = keyOf(spell.name, spell.source)
		const entry = map.get(key) ?? emptyEntry(spell.name, spell.source, false)
		if (!entry.optionalFeatureOrigins.includes(spell.optionName)) entry.optionalFeatureOrigins.push(spell.optionName)
		mergeUsage(entry, 'optionalFeature', spell.optionName, spell.usage)
		map.set(key, entry)
	}

	for (const spell of raceGrantedSpells) {
		const key = keyOf(spell.name, spell.source)
		const entry = map.get(key) ?? emptyEntry(spell.name, spell.source, false)
		if (!entry.speciesOrigins.includes(spell.speciesName)) entry.speciesOrigins.push(spell.speciesName)
		mergeUsage(entry, 'species', spell.speciesName, spell.usage)
		// A spell the player ALSO picked, or that a class source grants, already has numbers — the species' unmade ability choice is not a gap there.
		if (spell.unresolvedAbilityReason && !entry.unresolvedAbilityReasons.includes(spell.unresolvedAbilityReason)) {
			entry.unresolvedAbilityReasons.push(spell.unresolvedAbilityReason)
		}
		map.set(key, entry)
	}

	return [...map.values()]
}

/** A spell's text as the Spells tab shows it — also the Actions tab's expanded spell row (R5c). */
export function SpellDetailBody({ detail, resolverData }: { detail: SpellDetail; resolverData: ResolverData }): ReactNode {
	const attackOrSave = formatAttackOrSave(detail.spellAttack, detail.savingThrow)
	return (
		<>
			<dl className="spell-list__detail">
				<dt>Casting Time</dt>
				<dd>{formatCastingTime(detail.time)}</dd>
				<dt>Range</dt>
				<dd>{formatRange(detail.range)}</dd>
				<dt>Components</dt>
				<dd>{formatComponents(detail.components)}</dd>
				<dt>Duration</dt>
				<dd>{formatDuration(detail.duration)}</dd>
				{attackOrSave && (
					<>
						<dt>Attack/Save</dt>
						<dd>{attackOrSave}</dd>
					</>
				)}
				<dt>Source</dt>
				<dd>{detail.source}</dd>
			</dl>
			<ResolvedEntries entries={detail.entries} data={resolverData} />
			{detail.entriesHigherLevel.length > 0 && (
				<div className="spell-list__higher-level">
					<strong>At Higher Levels</strong>
					<ResolvedEntries entries={detail.entriesHigherLevel} data={resolverData} />
				</div>
			)}
			{detail.scalingLevelDice.length > 0 && (
				<div className="spell-list__scaling">
					<strong>Cantrip scaling</strong>
					<ul>
						{formatScalingLevelDice(detail.scalingLevelDice).map((line) => (
							<li key={line}>{line}</li>
						))}
					</ul>
				</div>
			)}
		</>
	)
}
