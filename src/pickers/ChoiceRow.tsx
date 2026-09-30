import { useState, type ReactNode } from 'react'

/*
 * W5 (D-W5): one CHOOSE / CHOSEN row of the wizard's Class step — the look of a
 * Manage Spells / Manage Feats row. The rule text is collapsed behind ▸.
 * Never owns the selection (D8) and its open state is local only (D116).
 */

export interface ChoiceRowProps {
	name: string
	/** Defaults to `name`. */
	label?: ReactNode
	/** Source book, shown small next to the name. */
	book?: string
	/** Rule text; only mounted while the row is expanded. */
	detail?: ReactNode
	/** Always visible under the row, expanded or not (a sub-choice a chosen option still needs). */
	extra?: ReactNode
	/** Why the row cannot be chosen; always visible. */
	reason?: ReactNode
	chosen: boolean
	/** Cannot be newly chosen (cap reached, unmet prerequisite). A chosen row is never disabled by this. */
	disabled?: boolean
	/** D108: an earlier level's pick, shown CHOSEN and not clickable. */
	locked?: boolean
	/** Single choice: clicking CHOSEN does nothing, like a radio. */
	single: boolean
	onPick: () => void
}

export function ChoiceRow({ name, label, book, detail, extra, reason, chosen, disabled, locked, single, onPick }: ChoiceRowProps): ReactNode {
	const [open, setOpen] = useState(false)
	const inactive = Boolean(locked) || (Boolean(disabled) && !chosen)
	return (
		<li className="choice-row">
			<div className="choice-row__line">
				<button type="button" className="choice-row__head" aria-expanded={open} aria-label={`${name} text`} onClick={() => setOpen(!open)}>
					<span className="choice-row__arrow" aria-hidden="true">
						{open ? '▾' : '▸'}
					</span>
					<span className={inactive && !chosen ? 'choice-row__name choice-row__name--off' : 'choice-row__name'}>{label ?? name}</span>
					{book && <span className="choice-row__book">{book}</span>}
				</button>
				<button
					type="button"
					className={chosen ? 'manage-spells__button manage-spells__button--on choice-row__button' : 'manage-spells__button choice-row__button'}
					aria-label={`Choose ${name}`}
					aria-pressed={chosen}
					disabled={inactive}
					onClick={() => {
						if (!(single && chosen)) onPick()
					}}
				>
					{chosen ? 'Chosen' : 'Choose'}
				</button>
			</div>
			{locked && <div className="choice-row__reason">(chosen at an earlier level)</div>}
			{reason != null && <div className="choice-row__reason">{reason}</div>}
			{extra}
			{open && detail != null && <div className="choice-row__text">{detail}</div>}
		</li>
	)
}
