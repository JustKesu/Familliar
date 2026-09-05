import { useEffect, useState, type ReactNode } from 'react'
import { loadSubclassLevelFor, loadSubclassesFor, type SubclassOption } from './subclassData'
import { loadResolverData, ResolvedEntries, type ResolverData } from '../featureResolver'
import { Entries } from '../markup'
import { SearchableOptionList, type SearchableOption } from '../pickers/SearchableOptionList'

/*
 * Subclass picker. A class offers 5-10 subclasses, each carrying its whole
 * level-3(+) feature text (up to ~2200 chars of entries JSON, longer per
 * option on average than a Battle Master maneuver) — SearchableOptionList
 * (collapsing + search), same as BackgroundPicker's single-choice usage.
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
	const [resolverData, setResolverData] = useState<ResolverData | null>(null)

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

	if (state.status === 'loading') return <p>Loading subclasses…</p>
	if (state.status === 'error') {
		return <p className="error">Could not load subclasses: {state.message}</p>
	}

	const { grantLevel, options } = state
	if (grantLevel === null || level < grantLevel) return null

	const searchableOptions: SearchableOption[] = options.map((option) => ({
		key: optionKey(option),
		name: option.name,
		label: <strong>{option.name}</strong>,
		detail: resolverData ? <ResolvedEntries entries={option.entries} data={resolverData} /> : <Entries entries={option.entries} />,
		selected: value === option.name,
	}))

	return (
		<div className="subclass-picker">
			<SearchableOptionList
				legend="Subclass"
				name="subclass"
				inputType="radio"
				options={searchableOptions}
				required={1}
				renderCount={({ chosen }) => (chosen === 0 ? 'Choose a subclass.' : 'Subclass chosen.')}
				onToggle={(key) => {
					const option = options.find((candidate) => optionKey(candidate) === key)
					if (option) onChange(option.name)
				}}
			/>
		</div>
	)
}
