import type { ReactNode } from 'react'
import type { GrantedSense } from './grantedSenses'

/*
 * The sheet's "Senses" section (build order step 6a, final piece): senses
 * granted by a chosen optional feature and by a chosen feat, merged the same
 * way SpellList.tsx's combineSpellEntries merges its four sources — a sense
 * TYPE granted by more than one source is shown once, both sources named,
 * range set to the LARGER of the two rather than duplicated (D&D 5e senses
 * of the same type don't stack; the character simply sees that far). No
 * confirmed real case shares a type across the 5 reachable grants today, but
 * the join exists on the same principle as the spell list's, not only for a
 * case that happens to occur now.
 *
 * Darkvision no longer reaches this component: CharacterSheet.tsx filters
 * any `senseType === 'darkvision'` entry out before calling
 * combineSenseEntries, since a darkvision grant now reconciles with the
 * species value in speciesTraits.ts's computeDarkvision instead (largest of
 * the two, breakdown names both — the darkvision-reconciliation follow-up
 * task, docs/REPORT.md). This component still merges by type generically,
 * on the same principle, for whatever other sense types do get here.
 */

export interface SheetSenseEntry {
	senseType: string
	range: number
	featOrigins: string[]
	optionalFeatureOrigins: string[]
}

function senseProvenanceLabel(entry: SheetSenseEntry): string {
	const parts: string[] = []
	for (const optionName of entry.optionalFeatureOrigins) parts.push(`from invocation (${optionName})`)
	for (const featName of entry.featOrigins) parts.push(`from feat (${featName})`)
	return parts.join('; ')
}

function senseLabel(senseType: string): string {
	return senseType.length === 0 ? senseType : senseType[0].toUpperCase() + senseType.slice(1)
}

/** Merges granted senses from both sources into one row per sense type, counting an overlap once and keeping the larger range (D44 spirit, same join shape as combineSpellEntries). */
export function combineSenseEntries(grantedSenses: GrantedSense[]): SheetSenseEntry[] {
	const map = new Map<string, SheetSenseEntry>()

	for (const grant of grantedSenses) {
		const key = grant.senseType.toLowerCase()
		const existing = map.get(key)
		if (existing) {
			existing.range = Math.max(existing.range, grant.range)
			if (grant.origin === 'feat') {
				if (!existing.featOrigins.includes(grant.name)) existing.featOrigins.push(grant.name)
			} else {
				if (!existing.optionalFeatureOrigins.includes(grant.name)) existing.optionalFeatureOrigins.push(grant.name)
			}
		} else {
			map.set(key, {
				senseType: grant.senseType,
				range: grant.range,
				featOrigins: grant.origin === 'feat' ? [grant.name] : [],
				optionalFeatureOrigins: grant.origin === 'optionalFeature' ? [grant.name] : [],
			})
		}
	}

	return [...map.values()]
}

/** Renders nothing (not even the heading) when there are no granted senses — same "no empty heading" rule the class-optional-features sections above it already follow. */
export function SensesList({ entries }: { entries: SheetSenseEntry[] }): ReactNode {
	if (entries.length === 0) return null

	return (
		<section className="sheet__senses">
			<h2>Senses</h2>
			<ul>
				{entries.map((entry) => (
					<li key={entry.senseType.toLowerCase()}>
						{senseLabel(entry.senseType)}: <span>{entry.range} ft.</span> — {senseProvenanceLabel(entry)}
					</li>
				))}
			</ul>
		</section>
	)
}
