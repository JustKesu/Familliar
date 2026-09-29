import type { ReactNode } from 'react'
import { Entries } from '../markup/Markup'
import { findRuleText, type RuleTexts } from '../rules/ruleTexts'
import { DrawerRow, DrawerSection } from './Drawer'
import { senseLabel, senseProvenanceLabel, type SheetSenseEntry } from './SensesList'

/** A collapsed rule text inside a detail drawer (R15, D223). */
export function RuleTextRow({ texts, kind, name, label = name }: { texts: RuleTexts | null; kind: keyof RuleTexts; name: string; label?: string }): ReactNode {
	const text = findRuleText(texts, kind, name)
	return (
		<DrawerRow label={label}>
			<div className="rule-text">{texts === null ? <p>Loading…</p> : text ? <Entries entries={text.entries} /> : <p>No rule text.</p>}</div>
		</DrawerRow>
	)
}

export function CustomItemHint(): ReactNode {
	return <p className="rule-text">Need an extra bonus (a DM gift, homebrew)? Add it as a custom item in Manage Inventory.</p>
}

/** Every granted sense other than Darkvision, the same rows the Senses card lists (D223: senses the character lacks are not shown). */
export function GrantedSenseSections({ entries, texts }: { entries: SheetSenseEntry[]; texts: RuleTexts | null }): ReactNode {
	return entries.map((entry) => (
		<DrawerSection key={entry.senseType.toLowerCase()} title={senseLabel(entry.senseType)}>
			<p>
				{entry.range > 0 && <><span>{entry.range} ft.</span> — </>}
				{senseProvenanceLabel(entry)}
			</p>
			<RuleTextRow texts={texts} kind="sense" name={entry.senseType} label={`${senseLabel(entry.senseType)} rule`} />
		</DrawerSection>
	))
}
