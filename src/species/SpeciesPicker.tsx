import { useEffect, useState, type ReactNode } from 'react'
import { findSpeciesSelection, loadSpeciesOptions, type SpeciesOption, type SpeciesVariant } from './speciesData'

/*
 * Character creation, species slice (PHASE1.md build order step 3). Lets the
 * player pick exactly one species, and — when the book puts a choice inside
 * that species (D81/D82: Elven Lineage, Draconic Ancestry, ...) — that choice
 * too. Does NOT apply anything the species grants (speed, darkvision, size,
 * traits) to derived numbers — deriving values is build order step 4.
 */

type LoadState =
	| { status: 'loading' }
	| { status: 'ready'; options: SpeciesOption[] }
	| { status: 'error'; message: string }

export interface SpeciesChoice {
	name: string
	source: string
}

function optionKey(entry: { name: string; source: string }): string {
	return `${entry.name}|${entry.source}`
}

/**
 * Lets the player pick exactly one species. Displays `value` — the choice as
 * the caller currently has it — and reports every change upward via
 * `onChange`, matching ClassPicker: the caller owns the selection, so it
 * survives this component unmounting and remounting.
 *
 * Storage holds ONE `{ name, source }`, the variant's own once it is chosen
 * ("Elf; Drow Lineage", "Air"), so both controls are derived from `value`
 * rather than from local state: a character stored on a variant reopens with
 * the species and the choice both filled, and one stored on a bare species
 * (D43/D58 — it was saved before this choice was enforced) reopens with the
 * choice empty and the step incomplete, rather than with a lineage guessed
 * for it.
 */
export function SpeciesPicker({
	value,
	onChange,
}: {
	value: SpeciesChoice | null
	onChange: (choice: SpeciesChoice | null) => void
}): ReactNode {
	const [state, setState] = useState<LoadState>({ status: 'loading' })

	useEffect(() => {
		let cancelled = false
		loadSpeciesOptions()
			.then((options) => {
				if (!cancelled) setState({ status: 'ready', options })
			})
			.catch((error: unknown) => {
				if (!cancelled) {
					setState({
						status: 'error',
						message: error instanceof Error ? error.message : String(error),
					})
				}
			})
		return () => {
			cancelled = true
		}
	}, [])

	if (state.status === 'loading') return <p>Loading species…</p>
	if (state.status === 'error') {
		return <p className="error">Could not load species: {state.message}</p>
	}

	const selection = findSpeciesSelection(state.options, value)
	const selected = selection?.option ?? null

	function handleSelectSpecies(nextKey: string): void {
		const chosen = state.status === 'ready' ? state.options.find((option) => optionKey(option) === nextKey) : undefined
		onChange(chosen ? { name: chosen.name, source: chosen.source } : null)
	}

	/** Clearing the choice reports the species itself, not null: the species stays picked, the step just isn't finished (D81). */
	function handleSelectVariant(option: SpeciesOption, nextKey: string): void {
		const chosen: SpeciesVariant | undefined = option.variants.find((variant) => optionKey(variant) === nextKey)
		onChange(chosen ? { name: chosen.name, source: chosen.source } : { name: option.name, source: option.source })
	}

	return (
		<div className="species-picker">
			<label className="species-picker__field">
				Species
				<select value={selected ? optionKey(selected) : ''} onChange={(event) => handleSelectSpecies(event.target.value)}>
					<option value="">Choose a species…</option>
					{state.options.map((option) => (
						<option key={optionKey(option)} value={optionKey(option)}>
							{option.displayName} ({option.source})
						</option>
					))}
				</select>
			</label>

			{selected && selected.variants.length > 0 && (
				<label className="species-picker__field">
					{selected.choiceLabel}
					<select
						value={selection?.variant ? optionKey(selection.variant) : ''}
						onChange={(event) => handleSelectVariant(selected, event.target.value)}
					>
						<option value="">Choose {selected.choiceLabel}…</option>
						{selected.variants.map((variant) => (
							<option key={optionKey(variant)} value={optionKey(variant)}>
								{variant.optionName}
							</option>
						))}
					</select>
				</label>
			)}

			{!selected && value !== null && (
				<p className="error">
					Saved species “{value.name}” ({value.source}) isn’t in the species list.
				</p>
			)}
			{!selected && value === null && <p className="species-picker__hint">Pick a species to continue.</p>}
			{selected && selected.variants.length > 0 && !selection?.variant && (
				<p className="species-picker__hint">Choose your {selected.choiceLabel} to continue.</p>
			)}
		</div>
	)
}
