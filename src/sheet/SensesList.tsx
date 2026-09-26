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
	classFeatureOrigins: string[]
}

function senseProvenanceLabel(entry: SheetSenseEntry): string {
	const parts: string[] = []
	for (const optionName of entry.optionalFeatureOrigins) parts.push(`from invocation (${optionName})`)
	for (const featName of entry.featOrigins) parts.push(`from feat (${featName})`)
	for (const featureName of entry.classFeatureOrigins) parts.push(`from class feature (${featureName})`)
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
		let entry = map.get(key)
		if (entry) {
			entry.range = Math.max(entry.range, grant.range)
		} else {
			entry = { senseType: grant.senseType, range: grant.range, featOrigins: [], optionalFeatureOrigins: [], classFeatureOrigins: [] }
			map.set(key, entry)
		}
		const origins = grant.origin === 'feat' ? entry.featOrigins : grant.origin === 'classFeature' ? entry.classFeatureOrigins : entry.optionalFeatureOrigins
		if (!origins.includes(grant.name)) origins.push(grant.name)
	}

	return [...map.values()]
}

/**
 * Renders nothing (not even the heading) when there are no granted senses —
 * same "no empty heading" rule the class-optional-features sections above it
 * already follow. `error` overrides that: a grant load that failed must not
 * look like a character with no granted senses (D43). The same load feeds the
 * Darkvision row in the traits section above, so the message covers both.
 */
export function SensesList({ entries, error }: { entries: SheetSenseEntry[]; error?: string | null }): ReactNode {
	if (entries.length === 0 && !error) return null

	return (
		<section className="sheet__senses">
			{/* R4 (D163): nested in the left column's Senses card, so this is the card's sub-heading, not a second block called "Senses". */}
			<h3>Granted senses</h3>
			{error && <p className="error">Could not load senses granted by feats and invocations: {error}. Darkvision above may be short for the same reason.</p>}
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
