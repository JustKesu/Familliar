import { useEffect, useState, type ReactNode } from 'react'
import { loadOptionalFeatureChoicesFor, type OptionalFeatureOption } from './optionalFeatureData'
import { Entries } from '../markup'
import { loadResolverData, ResolvedEntries, type ResolverData } from '../featureResolver'

/*
 * General picker for subclass optionalfeatureProgression choices (D21) — one
 * component for all four in-scope subclasses (Battle Master, Rune Knight,
 * Arcane Archer, College of Swords), since all four share the same shape:
 * a count that grows with level, and a fixed pool of named options.
 */

type LoadState =
	| { status: 'loading' }
	| { status: 'ready'; count: number | null; options: OptionalFeatureOption[] }
	| { status: 'error'; message: string }

function optionKey(option: OptionalFeatureOption): string {
	return `${option.name}|${option.source}`
}

/**
 * Lets the player pick from a subclass's optionalfeatureProgression options,
 * for subclasses that grant one at this level. CONTROLLED COMPONENT (D8): it
 * displays `value` — the selection as the caller currently has it — and
 * reports every change upward via `onChange` rather than owning the
 * selection itself.
 *
 * Renders nothing if the subclass has no optionalfeatureProgression, or
 * grants none yet at this level.
 */
export function OptionalFeaturePicker({
	className,
	classSource,
	subclassName,
	subclassSource,
	level,
	value,
	onChange,
}: {
	className: string
	classSource: string
	subclassName: string
	subclassSource: string
	level: number
	value: string[]
	onChange: (choices: string[]) => void
}): ReactNode {
	const [state, setState] = useState<LoadState>({ status: 'loading' })
	const [resolverData, setResolverData] = useState<ResolverData | null>(null)

	useEffect(() => {
		let cancelled = false
		setState({ status: 'loading' })
		loadOptionalFeatureChoicesFor(className, classSource, subclassName, subclassSource, level)
			.then((choice) => {
				if (!cancelled) setState({ status: 'ready', count: choice?.count ?? null, options: choice?.options ?? [] })
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
	}, [className, classSource, subclassName, subclassSource, level])

	useEffect(() => {
		let cancelled = false
		loadResolverData()
			.then((data) => {
				if (!cancelled) setResolverData(data)
			})
			.catch(() => {
				/* Falls back to unexpanded rendering below; the picker still works without it. */
			})
		return () => {
			cancelled = true
		}
	}, [])

	if (state.status === 'loading') return <p>Loading options…</p>
	if (state.status === 'error') {
		return <p className="error">Could not load options: {state.message}</p>
	}

	const { count, options } = state
	if (count === null) return null

	const remaining = count - value.length

	function toggle(optionName: string): void {
		if (value.includes(optionName)) {
			onChange(value.filter((name) => name !== optionName))
		} else if (remaining > 0) {
			onChange([...value, optionName])
		}
	}

	return (
		<div className="optional-feature-picker">
			<p className="optional-feature-picker__hint">
				{remaining > 0 ? `Choose ${remaining} more option${remaining === 1 ? '' : 's'}.` : 'All options chosen.'}
			</p>
			<ul className="optional-feature-picker__list">
				{options.map((option) => {
					const key = optionKey(option)
					const checked = value.includes(option.name)
					const disabled = !checked && remaining <= 0
					return (
						<li key={key} className="optional-feature-picker__item">
							<label>
								<input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggle(option.name)} />
								<strong>{option.name}</strong>
							</label>
							<div className="optional-feature-picker__description">
								{resolverData ? (
									<ResolvedEntries entries={option.entries} data={resolverData} />
								) : (
									<Entries entries={option.entries} />
								)}
							</div>
						</li>
					)
				})}
			</ul>
		</div>
	)
}
