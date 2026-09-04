import { useState, type ReactNode } from 'react'

/*
 * One shared control for pickers whose option list is long enough to be
 * unusable inline (weapon mastery, background, and the item pickers of build
 * order step 7). It adds three things to a plain list of checkboxes/radios:
 * collapsing, search-by-name, and a required/chosen count.
 *
 * D8: this control NEVER owns the selection. It is told, per option, whether
 * that option is `selected`, and it reports every toggle upward via
 * `onToggle`. The caller holds the value and passes it back down, so a pick
 * survives this component unmounting and remounting.
 *
 * It also never computes a limit: `required` is handed in (the caller already
 * computed it) and `renderCount` turns it into the player's wording. The
 * control only counts how many of the given options are currently `selected`.
 */

export interface SearchableOption {
	/** Stable unique key. */
	key: string
	/** Primary name; the search filter matches against this, case- and diacritic-insensitively. */
	name: string
	/** Full rendered label. Defaults to `name`. */
	label?: ReactNode
	/** Extra content shown under the label (e.g. a mastery's rule text). */
	detail?: ReactNode
	selected: boolean
	/** Disabled for any reason: cap reached, or D71 "the character already has it". */
	disabled?: boolean
	/** D71: why the option is unavailable. Shown whenever set, including while a search is active. */
	disabledReason?: ReactNode
}

/** Lowercase and strip diacritics, so "à" matches "a". */
function fold(value: string): string {
	return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

export function SearchableOptionList({
	legend,
	name,
	inputType,
	options,
	required,
	renderCount,
	onToggle,
	searchPlaceholder = 'Search by name…',
	defaultOpen,
	emptyLabel,
	pinSelected = true,
}: {
	/** Group heading, also the basis of the search field's accessible name. */
	legend: string
	/** `name=` for the inputs — groups the radios of a single-choice picker. */
	name: string
	inputType: 'checkbox' | 'radio'
	options: SearchableOption[]
	/** How many must be chosen. Handed in, never computed here. */
	required: number
	/** Turns the counts into the player's words, e.g. "Choose 2 more weapons." */
	renderCount: (info: { chosen: number; required: number }) => ReactNode
	/** Reports a toggle upward by option key. The caller updates the value. */
	onToggle: (key: string) => void
	searchPlaceholder?: string
	/** Overrides the default (open until the required count is met). */
	defaultOpen?: boolean
	/** Shown when a search matches nothing. */
	emptyLabel?: ReactNode
	/**
	 * Whether a selected option stays visible when the search text would
	 * otherwise hide it. Default true, for a picker with a `required` count the
	 * player must keep track of while still browsing for more (masteries,
	 * background). A plain browse-and-toggle catalogue (the inventory's "Add an
	 * item" list, where `selected` just means "already carried") sets this
	 * false, so the filter applies to everything the list shows.
	 */
	pinSelected?: boolean
}): ReactNode {
	const chosen = options.filter((option) => option.selected).length
	const [open, setOpen] = useState(defaultOpen ?? chosen < required)
	const [query, setQuery] = useState('')

	const folded = fold(query.trim())
	const searching = folded !== ''
	const matches = (option: SearchableOption): boolean => !searching || fold(option.name).includes(folded)

	// A selected option is never hidden by the filter — the player must be able
	// to see a pick to remove it. While searching, selected options that don't
	// match the query are pinned above the results rather than left in place
	// where a long result list could push them off screen.
	const pinned = pinSelected && searching ? options.filter((option) => option.selected && !matches(option)) : []
	const listed = options.filter((option) => matches(option) || (pinSelected && !searching && option.selected))

	// The panel is reopened fresh, not mid-search — otherwise the box shows a
	// filter for a query the player can no longer see they typed.
	function toggleOpen(): void {
		setOpen((wasOpen) => {
			if (!wasOpen) return true
			setQuery('')
			return false
		})
	}

	function item(option: SearchableOption): ReactNode {
		return (
			<li key={option.key} className="option-list__item">
				<label
					className={option.disabled ? 'option-list__label option-list__label--disabled' : 'option-list__label'}
				>
					<input
						type={inputType}
						name={name}
						checked={option.selected}
						/* D71: a selected option is never disabled, or it could get stuck picked and unremovable. */
						disabled={Boolean(option.disabled) && !option.selected}
						onChange={() => onToggle(option.key)}
					/>
					<span>{option.label ?? option.name}</span>
				</label>
				{option.disabled && option.disabledReason != null && (
					<div className="option-list__reason">{option.disabledReason}</div>
				)}
				{option.detail != null && <div className="option-list__detail">{option.detail}</div>}
			</li>
		)
	}

	return (
		<div className="option-list">
			<button
				type="button"
				className="option-list__toggle"
				aria-expanded={open}
				onClick={toggleOpen}
			>
				<span className="option-list__legend">{legend}</span>
				<span className="option-list__count">{renderCount({ chosen, required })}</span>
			</button>
			<div className="option-list__body" hidden={!open}>
				<input
					type="search"
					className="option-list__search"
					aria-label={`Search ${legend}`}
					placeholder={searchPlaceholder}
					value={query}
					onChange={(event) => setQuery(event.target.value)}
				/>
				{pinned.length > 0 && (
					<>
						<p className="option-list__pinned-label">Selected</p>
						<ul className="option-list__list">{pinned.map(item)}</ul>
					</>
				)}
				{listed.length > 0 ? (
					<ul className="option-list__list">{listed.map(item)}</ul>
				) : (
					pinned.length === 0 && <p className="option-list__empty">{emptyLabel ?? `No matches for “${query}”.`}</p>
				)}
			</div>
		</div>
	)
}
