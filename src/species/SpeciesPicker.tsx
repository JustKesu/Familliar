import { useEffect, useState, type ReactNode } from 'react'
import { loadSpecies, speciesDisplayName, type SpeciesEntry } from './speciesData'

/*
 * Character creation, species slice (PHASE1.md build order step 3). Lets the
 * player pick exactly one species. Does NOT apply anything the species
 * grants (speed, darkvision, size, traits) to derived numbers — deriving
 * values is build order step 4.
 */

type LoadState =
	| { status: 'loading' }
	| { status: 'ready'; species: SpeciesEntry[] }
	| { status: 'error'; message: string }

export interface SpeciesChoice {
	name: string
	source: string
}

function speciesKey(entry: SpeciesEntry): string {
	return `${entry.name}|${entry.source}`
}

/**
 * Lets the player pick exactly one species. Reports the current choice to
 * the parent on every change — `null` while nothing is selected yet —
 * rather than owning a submit action itself, matching ClassPicker and
 * AbilityScorePicker.
 */
export function SpeciesPicker({
	onChange,
}: {
	onChange: (choice: SpeciesChoice | null) => void
}): ReactNode {
	const [state, setState] = useState<LoadState>({ status: 'loading' })
	const [selectedKey, setSelectedKey] = useState('')

	useEffect(() => {
		let cancelled = false
		loadSpecies()
			.then((species) => {
				if (!cancelled) setState({ status: 'ready', species })
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

	const selected = state.species.find((s) => speciesKey(s) === selectedKey)

	function handleSelect(nextKey: string): void {
		setSelectedKey(nextKey)
		const chosen = state.status === 'ready' ? state.species.find((s) => speciesKey(s) === nextKey) : undefined
		onChange(chosen ? { name: chosen.name, source: chosen.source } : null)
	}

	return (
		<div className="species-picker">
			<label className="species-picker__field">
				Species
				<select value={selectedKey} onChange={(event) => handleSelect(event.target.value)}>
					<option value="">Choose a species…</option>
					{state.species.map((entry) => (
						<option key={speciesKey(entry)} value={speciesKey(entry)}>
							{speciesDisplayName(entry)} ({entry.source})
						</option>
					))}
				</select>
			</label>

			{!selected && <p className="species-picker__hint">Pick a species to continue.</p>}
		</div>
	)
}
