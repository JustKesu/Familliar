import type { ReactNode } from 'react'
import type { ResolverData } from '../featureResolver'
import { ResolvedEntries } from '../featureResolver'
import type { SpellDetail } from '../spells/spellDetailData'
import { findSpellDetail } from '../spells/spellDetailData'
import { formatAttackOrSave, formatCastingTime, formatComponents, formatDuration, formatRange, spellLevelLabel } from './spellFormatting'
import { UnresolvedValue } from './ValueBreakdown'

/*
 * The character's spells (build order step 6, slice d4, sheet items 3+4):
 * the player's chosen spells (Character.spellChoices) and the subclass's
 * always-prepared spells (subclassPreparedSpells.ts) shown TOGETHER, grouped
 * by spell level. A spell present in both is shown once with both sources
 * named (the "counted once, sources joined" spirit of D44's skill
 * provenance) — `chosen` and `subclassOrigins` are independent flags on the
 * same entry rather than two rows.
 *
 * Collapsed by default (a <details> per spell, same pattern as the sheet's
 * feat list); expanding shows the fields a paper sheet shows, read from the
 * spell's own data rather than hand-formatted prose (spellFormatting.ts).
 *
 * d5a adds feat-granted spells (featSpells.ts) as a third source, merged the
 * same way — `featOrigins` names the granting feat(s), distinct from
 * `subclassOrigins`'s "always prepared (subclass)" label per the user's
 * explicit "from feat (Feat Name)" wording.
 */

export interface SheetSpellEntry {
	name: string
	source: string
	chosen: boolean
	/** Subclass name(s) that grant this spell as always-prepared. Almost always 0 or 1 entry; a list only to cover a character with more than one subclass-granting class at once. */
	subclassOrigins: string[]
	/** Feat name(s) that grant this spell (featSpells.ts, d5a). Almost always 0 or 1 entry. */
	featOrigins: string[]
}

function provenanceLabel(entry: SheetSpellEntry): string {
	const parts: string[] = []
	if (entry.chosen) parts.push('player pick')
	for (const subclassName of entry.subclassOrigins) parts.push(`always prepared (${subclassName})`)
	for (const featName of entry.featOrigins) parts.push(`from feat (${featName})`)
	return parts.join('; ')
}

function keyOf(name: string, source: string): string {
	return `${name.toLowerCase()}|${source.toUpperCase()}`
}

/** Merges the player's chosen spells, every class's subclass always-prepared spells, and fixed feat-granted spells (d5a) into one list, counting an overlap once (D44 spirit). */
export function combineSpellEntries(
	spellChoices: { spells: { name: string; source: string }[] }[],
	subclassAlwaysPrepared: { subclassName: string; spells: { name: string; source: string }[] }[],
	featGrantedSpells: { featName: string; name: string; source: string }[] = [],
): SheetSpellEntry[] {
	const map = new Map<string, SheetSpellEntry>()

	for (const choice of spellChoices) {
		for (const spell of choice.spells) {
			const key = keyOf(spell.name, spell.source)
			const existing = map.get(key)
			if (existing) existing.chosen = true
			else map.set(key, { name: spell.name, source: spell.source, chosen: true, subclassOrigins: [], featOrigins: [] })
		}
	}

	for (const group of subclassAlwaysPrepared) {
		for (const spell of group.spells) {
			const key = keyOf(spell.name, spell.source)
			const existing = map.get(key)
			if (existing) {
				if (!existing.subclassOrigins.includes(group.subclassName)) existing.subclassOrigins.push(group.subclassName)
			} else {
				map.set(key, { name: spell.name, source: spell.source, chosen: false, subclassOrigins: [group.subclassName], featOrigins: [] })
			}
		}
	}

	for (const spell of featGrantedSpells) {
		const key = keyOf(spell.name, spell.source)
		const existing = map.get(key)
		if (existing) {
			if (!existing.featOrigins.includes(spell.featName)) existing.featOrigins.push(spell.featName)
		} else {
			map.set(key, { name: spell.name, source: spell.source, chosen: false, subclassOrigins: [], featOrigins: [spell.featName] })
		}
	}

	return [...map.values()]
}

const UNRESOLVED_LEVEL = -1

export function SpellList({ entries, spellDetails, resolverData }: { entries: SheetSpellEntry[]; spellDetails: SpellDetail[]; resolverData: ResolverData }): ReactNode {
	if (entries.length === 0) return <p>No spells chosen yet.</p>

	const withDetail = entries.map((entry) => ({ entry, detail: findSpellDetail(spellDetails, entry.name, entry.source) }))

	const byLevel = new Map<number, typeof withDetail>()
	for (const item of withDetail) {
		const level = item.detail?.level ?? UNRESOLVED_LEVEL
		const bucket = byLevel.get(level) ?? []
		bucket.push(item)
		byLevel.set(level, bucket)
	}

	const levels = [...byLevel.keys()].sort((a, b) => {
		if (a === UNRESOLVED_LEVEL) return 1
		if (b === UNRESOLVED_LEVEL) return -1
		return a - b
	})

	return (
		<>
			{levels.map((level) => (
				<div key={level} className="spell-list__level-group">
					<h3>{level === UNRESOLVED_LEVEL ? 'Unresolved' : spellLevelLabel(level)}</h3>
					<ul>
						{byLevel.get(level)!.map(({ entry, detail }) => (
							<SpellRow key={keyOf(entry.name, entry.source)} entry={entry} detail={detail} resolverData={resolverData} />
						))}
					</ul>
				</div>
			))}
		</>
	)
}

function SpellRow({ entry, detail, resolverData }: { entry: SheetSpellEntry; detail: SpellDetail | undefined; resolverData: ResolverData }): ReactNode {
	if (!detail) {
		return (
			<li>
				<strong>{entry.name}</strong> ({entry.source}) — {provenanceLabel(entry)}
				<div>
					<UnresolvedValue reason={`Spell text not found for "${entry.name}" (${entry.source}).`} />
				</div>
			</li>
		)
	}

	const attackOrSave = formatAttackOrSave(detail.spellAttack, detail.savingThrow)

	return (
		<li>
			<details>
				<summary>
					{entry.name}
					{detail.ritual && <span className="spell-list__flag"> (ritual)</span>}
					{detail.concentration && <span className="spell-list__flag"> (concentration)</span>}
					{' — '}
					{provenanceLabel(entry)}
				</summary>
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
			</details>
		</li>
	)
}
