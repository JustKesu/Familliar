import { useEffect, useState, type ReactNode } from 'react'
import { loadBaseClasses, type BaseClass } from './classData'

/*
 * Character creation, first slice (PHASE1.md build order step 3): choosing a
 * class and a level. No subclass, species, background, ability scores, or
 * derived numbers here — those are later slices.
 */

const LEVELS = Array.from({ length: 20 }, (_, i) => i + 1)

type LoadState =
	| { status: 'loading' }
	| { status: 'ready'; classes: BaseClass[] }
	| { status: 'error'; message: string }

export interface ClassLevelChoice {
	className: string
	classSource: string
	level: number
}

/**
 * Lets the player pick exactly one base class and a level 1-20. Displays
 * `value` — the choice as the caller currently has it, e.g. from the wizard
 * that owns the in-progress character — and reports every change upward via
 * `onChange` rather than owning the selection itself. That is what lets the
 * choice survive this component unmounting and remounting when the wizard
 * navigates away from and back to this step.
 */
export function ClassPicker({
	value,
	onChange,
}: {
	value: ClassLevelChoice | null
	onChange: (choice: ClassLevelChoice | null) => void
}): ReactNode {
	const [state, setState] = useState<LoadState>({ status: 'loading' })
	const [selectedKey, setSelectedKey] = useState(value ? `${value.className}|${value.classSource}` : '')
	const [level, setLevel] = useState(value?.level ?? 1)

	useEffect(() => {
		let cancelled = false
		loadBaseClasses()
			.then((classes) => {
				if (!cancelled) setState({ status: 'ready', classes })
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

	if (state.status === 'loading') return <p>Loading classes…</p>
	if (state.status === 'error') {
		return <p className="error">Could not load classes: {state.message}</p>
	}

	const selected = state.classes.find((c) => `${c.name}|${c.source}` === selectedKey)

	function report(nextKey: string, nextLevel: number): void {
		const chosen = state.status === 'ready' ? state.classes.find((c) => `${c.name}|${c.source}` === nextKey) : undefined
		onChange(chosen ? { className: chosen.name, classSource: chosen.source, level: nextLevel } : null)
	}

	return (
		<div className="class-picker">
			<label className="class-picker__field">
				Class
				<select
					value={selectedKey}
					onChange={(event) => {
						setSelectedKey(event.target.value)
						report(event.target.value, level)
					}}
				>
					<option value="">Choose a class…</option>
					{state.classes.map((c) => (
						<option key={`${c.name}|${c.source}`} value={`${c.name}|${c.source}`}>
							{c.name}
						</option>
					))}
				</select>
			</label>

			<label className="class-picker__field">
				Level
				<select
					value={level}
					onChange={(event) => {
						const nextLevel = Number(event.target.value)
						setLevel(nextLevel)
						report(selectedKey, nextLevel)
					}}
				>
					{LEVELS.map((l) => (
						<option key={l} value={l}>
							{l}
						</option>
					))}
				</select>
			</label>

			{!selected && <p className="class-picker__hint">Pick a class to continue.</p>}
		</div>
	)
}
