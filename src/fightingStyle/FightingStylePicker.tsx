import { useEffect, useState, type ReactNode } from 'react'
import { loadFightingStyleGrantLevel, fightingStyleOptions, type FightingStyleOption } from './fightingStyleData'
import { Entries } from '../markup'

/*
 * Fighting style picker. Not wired into the character creation wizard —
 * that is a separate task.
 */

type LoadState =
	| { status: 'loading' }
	| { status: 'ready'; grantLevel: number | null; options: FightingStyleOption[] }
	| { status: 'error'; message: string }

function optionKey(option: FightingStyleOption): string {
	return `${option.name}|${option.source}`
}

/**
 * Lets the player pick one fighting style, for classes that grant one.
 * Displays `value` — the choice as the caller currently has it — and
 * reports every change upward via `onChange` rather than owning the
 * selection itself, matching ClassSkillPicker, ClassPicker, SpeciesPicker
 * and BackgroundPicker (see D8): a picker that owns its own state loses the
 * selection when the wizard navigates away from and back to its step.
 *
 * Renders nothing if the class grants no Fighting Style, or if `level` is
 * below the level it's granted at.
 */
export function FightingStylePicker({
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
	onChange: (style: string | null) => void
}): ReactNode {
	const [state, setState] = useState<LoadState>({ status: 'loading' })

	useEffect(() => {
		let cancelled = false
		setState({ status: 'loading' })
		Promise.all([loadFightingStyleGrantLevel(className, classSource), fightingStyleOptions()])
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

	if (state.status === 'loading') return <p>Loading fighting styles…</p>
	if (state.status === 'error') {
		return <p className="error">Could not load fighting styles: {state.message}</p>
	}

	const { grantLevel, options } = state.grantLevel !== null ? state : { grantLevel: null, options: [] }
	if (grantLevel === null || level < grantLevel) return null

	return (
		<div className="fighting-style-picker">
			<p className="fighting-style-picker__hint">
				{value ? 'Fighting style chosen.' : 'Choose a fighting style.'}
			</p>
			<ul className="fighting-style-picker__list">
				{options.map((option) => {
					const key = optionKey(option)
					const checked = value === option.name
					return (
						<li key={key} className="fighting-style-picker__item">
							<label>
								<input
									type="radio"
									name="fighting-style"
									checked={checked}
									onChange={() => onChange(option.name)}
								/>
								<strong>{option.name}</strong>
							</label>
							<div className="fighting-style-picker__description">
								<Entries entries={option.entries} />
							</div>
						</li>
					)
				})}
			</ul>
		</div>
	)
}
