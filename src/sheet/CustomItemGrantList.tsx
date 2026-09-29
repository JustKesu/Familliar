import { useEffect, useState, type ReactNode } from 'react'

interface GrantRef {
	name: string
	source: string
}

const keyOf = (ref: GrantRef): string => `${ref.name}|${ref.source}`

/** One row per granted feat or invocation, as its `name|source` key; '' is a row not chosen yet (D116: nothing reaches the character until submit). */
export function grantRowsFrom(entries: readonly GrantRef[] | undefined): string[] {
	return (entries ?? []).map(keyOf)
}

/** Blank rows are dropped and a repeat keeps its first row; an entry already in `previous` keeps its stored sub-choices (D218: they live on the item). */
export function grantsFromRows<T extends GrantRef>(rows: readonly string[], previous: readonly T[] | undefined): (T | GrantRef)[] {
	return [...new Set(rows.filter((row) => row !== ''))].map((row) => {
		const kept = previous?.find((entry) => keyOf(entry) === row)
		if (kept) return kept
		const [name, source] = row.split('|')
		return { name, source }
	})
}

/** A plain code-unit comparison: localeCompare would follow the system locale (R14b: Czech puts "Ch" after "H"). */
export function englishOrder(a: string, b: string): number {
	const [x, y] = [a.toLowerCase(), b.toLowerCase()]
	return x < y ? -1 : x > y ? 1 : 0
}

/**
 * R14c1 (D218): the feats or invocations a custom item grants — row = select · Remove, like the proficiency rows.
 * A plain <select> rather than SearchableOptionList: that one is a collapsible panel, not a control that fits a row.
 */
export function CustomItemGrantList({
	title,
	noun,
	rows,
	load,
	onChange,
}: {
	title: string
	/** "feat" / "invocation" — the accessible names and the add button. */
	noun: string
	rows: readonly string[]
	load: () => Promise<GrantRef[]>
	onChange: (rows: string[]) => void
}): ReactNode {
	const [options, setOptions] = useState<{ value: string; label: string }[] | null>(null)
	const needed = rows.length > 0
	useEffect(() => {
		if (!needed || options !== null) return
		let cancelled = false
		load()
			.then((refs) => {
				if (cancelled) return
				const repeated = new Set(refs.filter((ref, i) => refs.findIndex((other) => other.name === ref.name) !== i).map((ref) => ref.name))
				const labelled = refs.map((ref) => ({ value: keyOf(ref), label: repeated.has(ref.name) ? `${ref.name} (${ref.source})` : ref.name }))
				setOptions([...new Map(labelled.map((option) => [option.value, option])).values()].sort((a, b) => englishOrder(a.label, b.label)))
			})
			.catch(() => {
				if (!cancelled) setOptions([])
			})
		return () => {
			cancelled = true
		}
	}, [needed, options, load])

	return (
		<div className="sheet__custom-item-proficiencies" role="group" aria-label={`Custom item ${noun}s`}>
			<p>{title}</p>
			{rows.map((row, index) => {
				const number = index + 1
				const usedElsewhere = new Set(rows.filter((_, i) => i !== index))
				const all = options ?? []
				// A stored value stays selectable while the list is loading or if the data no longer has it.
				const listed = row === '' || all.some((option) => option.value === row) ? all : [...all, { value: row, label: row.split('|')[0] }]
				return (
					<p key={index}>
						<label>
							{title.slice(0, -1)}{' '}
							<select aria-label={`Custom item ${noun} ${number}`} value={row} onChange={(event) => onChange(rows.map((other, i) => (i === index ? event.target.value : other)))}>
								<option value="">choose…</option>
								{listed
									.filter((option) => option.value === row || !usedElsewhere.has(option.value))
									.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
							</select>
						</label>{' '}
						<button type="button" aria-label={`Remove custom item ${noun} ${number}`} onClick={() => onChange(rows.filter((_, i) => i !== index))}>
							Remove
						</button>
					</p>
				)
			})}
			<p>
				<button type="button" onClick={() => onChange([...rows, ''])}>
					+ Add {noun}
				</button>
			</p>
		</div>
	)
}
