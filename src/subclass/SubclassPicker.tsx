import { useEffect, useState, type ReactNode } from 'react'
import { loadSubclassLevelFor, loadSubclassesFor, type SubclassOption } from './subclassData'
import { Entries } from '../markup'

/*
 * Subclass picker. Not wired into the character creation wizard — that is a
 * separate task.
 */

type LoadState =
	| { status: 'loading' }
	| { status: 'ready'; grantLevel: number | null; options: SubclassOption[] }
	| { status: 'error'; message: string }

function optionKey(option: SubclassOption): string {
	return `${option.name}|${option.source}`
}

/**
 * Lets the player pick one subclass, for classes at or above the level they
 * grant one. Displays `value` — the choice as the caller currently has
 * it — and reports every change upward via `onChange` rather than owning
 * the selection itself, matching MasteryPicker and FightingStylePicker
 * (D8): a picker that owns its own state loses the selection when the
 * wizard navigates away from and back to its step.
 *
 * Renders nothing if `level` is below the level the class grants a
 * subclass at.
 */
export function SubclassPicker({
	className,
	classSource,
	level,
	value,
	onChange,
}: {
	className: string
	classSource: string
	level: number
	value: string | null
	onChange: (subclass: string | null) => void
}): ReactNode {
	const [state, setState] = useState<LoadState>({ status: 'loading' })

	useEffect(() => {
		let cancelled = false
		setState({ status: 'loading' })
		Promise.all([loadSubclassLevelFor(className, classSource), loadSubclassesFor(className, classSource)])
			.then(([grantLevel, options]) => {
				if (!cancelled) setState({ status: 'ready', grantLevel, options })
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
	}, [className, classSource])

	if (state.status === 'loading') return <p>Loading subclasses…</p>
	if (state.status === 'error') {
		return <p className="error">Could not load subclasses: {state.message}</p>
	}

	const { grantLevel, options } = state
	if (grantLevel === null || level < grantLevel) return null

	return (
		<div className="subclass-picker">
			<p className="subclass-picker__hint">{value ? 'Subclass chosen.' : 'Choose a subclass.'}</p>
			<ul className="subclass-picker__list">
				{options.map((option) => {
					const key = optionKey(option)
					const checked = value === option.name
					return (
						<li key={key} className="subclass-picker__item">
							<label>
								<input type="radio" name="subclass" checked={checked} onChange={() => onChange(option.name)} />
								<strong>{option.name}</strong>
							</label>
							<div className="subclass-picker__description">
								<Entries entries={option.entries} />
							</div>
						</li>
					)
				})}
			</ul>
		</div>
	)
}
