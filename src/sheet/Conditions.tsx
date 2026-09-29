/*
 * The status row's Conditions card and the drawer panels behind it (R12, D214).
 * Play tracking only: nothing here changes a roll, a speed or a hit point.
 */

import { useState, type ReactNode } from 'react'
import { CONDITION_NAMES, EXHAUSTION, MAX_EXHAUSTION, exhaustionPenaltyText, type ConditionRule } from '../conditions/conditions'
import { Entries } from '../markup/Markup'

export function ConditionsCard({
	conditions,
	exhaustion,
	onAdd,
	onOpen,
	onRemoveCondition,
	onClearExhaustion,
}: {
	conditions: readonly string[]
	exhaustion: number
	/** Absent on a read-only sheet: the button stays, disabled, and the chips lose their ×. */
	onAdd?: () => void
	onOpen: (name: string) => void
	onRemoveCondition?: (name: string) => void
	onClearExhaustion?: () => void
}): ReactNode {
	const chips = [
		...conditions.map((name) => ({ name, label: name, remove: onRemoveCondition && (() => onRemoveCondition(name)) })),
		...(exhaustion > 0
			? [{ name: EXHAUSTION, label: `${EXHAUSTION} ${exhaustion} ${exhaustionPenaltyText(exhaustion)}`, remove: onClearExhaustion }]
			: []),
	]
	return (
		<section className="sheet__status-card sheet__status-conditions">
			<h2>Conditions</h2>
			{chips.length > 0 && (
				<span className="sheet__chips">
					{chips.map(({ name, label, remove }) => (
						<span key={name} className="sheet__chip">
							<button type="button" className="sheet__chip-name" onClick={() => onOpen(name)}>
								{label}
							</button>
							{remove && (
								<button type="button" className="sheet__chip-remove" aria-label={`Remove ${name}`} onClick={remove}>
									×
								</button>
							)}
						</span>
					))}
				</span>
			)}
			<button type="button" className="sheet__add-condition" disabled={!onAdd} onClick={onAdd}>
				+ Add condition
			</button>
		</section>
	)
}

function ConditionRow({ name, rule, action, note }: { name: string; rule: ConditionRule | undefined; action: ReactNode; note?: string }): ReactNode {
	const [open, setOpen] = useState(false)
	return (
		<li className="manage-spells__row">
			<div className="manage-spells__line">
				<span className="manage-spells__name-cell">
					<span className="manage-spells__name">{name}</span>
					{note && <span className="manage-spells__meta manage-spells__note">{note}</span>}
				</span>
				{action}
				<button type="button" className="manage-spells__expand" aria-expanded={open} aria-label={`${name} rule text`} onClick={() => setOpen(!open)}>
					{open ? '▾' : '▸'}
				</button>
			</div>
			{open && <div className="manage-spells__text">{rule ? <Entries entries={rule.entries} /> : <p>Loading…</p>}</div>}
		</li>
	)
}

/** The "Conditions" drawer: the 15 conditions alphabetically, each a switch, Exhaustion a 0–6 stepper. */
export function ConditionsPanel({
	rules,
	conditions,
	exhaustion,
	immunities = [],
	onEditConditions,
	onEditExhaustion,
}: {
	rules: readonly ConditionRule[] | null
	conditions: readonly string[]
	exhaustion: number
	/** R14b (D217): conditions an item makes the character immune to. A note only — the switch still works. */
	immunities?: readonly { condition: string; sources: string[] }[]
	onEditConditions?: (conditions: string[]) => void
	onEditExhaustion?: (level: number) => void
}): ReactNode {
	const ruleOf = (name: string): ConditionRule | undefined => rules?.find((rule) => rule.name === name)
	const noteOf = (name: string): string | undefined => {
		const entry = immunities.find((immunity) => immunity.condition === name)
		return entry ? `immune (${entry.sources.join(', ')})` : undefined
	}
	const names = [...CONDITION_NAMES, EXHAUSTION].sort((a, b) => a.localeCompare(b))
	return (
		<section aria-label="Conditions list" className="manage-spells__list">
		<ul>
			{names.map((name) =>
				name === EXHAUSTION ? (
					<ConditionRow
						key={name}
						name={name}
						rule={ruleOf(name)}
						note={noteOf(name)}
						action={
							<span className="conditions__stepper">
								<button
									type="button"
									className="manage-spells__button conditions__step"
									aria-label="Decrease Exhaustion"
									disabled={!onEditExhaustion || exhaustion <= 0}
									onClick={() => onEditExhaustion?.(exhaustion - 1)}
								>
									−
								</button>
								<span className="conditions__level" aria-label="Exhaustion level">
									{exhaustion}
								</span>
								<button
									type="button"
									className="manage-spells__button conditions__step"
									aria-label="Increase Exhaustion"
									disabled={!onEditExhaustion || exhaustion >= MAX_EXHAUSTION}
									onClick={() => onEditExhaustion?.(exhaustion + 1)}
								>
									+
								</button>
							</span>
						}
					/>
				) : (
					<ConditionRow
						key={name}
						name={name}
						rule={ruleOf(name)}
						note={noteOf(name)}
						action={
							<button
								type="button"
								className={conditions.includes(name) ? 'manage-spells__button manage-spells__button--on' : 'manage-spells__button'}
								aria-label={`Toggle ${name}`}
								aria-pressed={conditions.includes(name)}
								disabled={!onEditConditions}
								onClick={() =>
									onEditConditions?.(conditions.includes(name) ? conditions.filter((active) => active !== name) : [...conditions, name])
								}
							>
								{conditions.includes(name) ? 'On' : 'Off'}
							</button>
						}
					/>
				),
			)}
		</ul>
		</section>
	)
}

/** The drawer behind a chip's name: that condition's rule text only. */
export function ConditionRuleText({ rules, name }: { rules: readonly ConditionRule[] | null; name: string }): ReactNode {
	if (rules === null) return <p>Loading…</p>
	const rule = rules.find((candidate) => candidate.name === name)
	return rule ? <Entries entries={rule.entries} /> : <p>No rule text.</p>
}
