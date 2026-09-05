import { useEffect, useState, type ReactNode } from 'react'
import { loadFightingStyleGrantLevel, fightingStyleOptions, type FightingStyleOption } from './fightingStyleData'
import { Entries } from '../markup'
import { SearchableOptionList, type SearchableOption } from '../pickers/SearchableOptionList'
import { loadResolverData, ResolvedEntries, type ResolverData } from '../featureResolver'

/*
 * Fighting style picker. Its 10 options are the same feats.json category-FS
 * pool College of Swords offers through OptionalFeaturePicker — kept on
 * SearchableOptionList too, so the same 10 options don't render as a plain
 * checkbox wall via one path and a searchable list via the other.
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
	const [resolverData, setResolverData] = useState<ResolverData | null>(null)

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

	if (state.status === 'loading') return <p>Loading fighting styles…</p>
	if (state.status === 'error') {
		return <p className="error">Could not load fighting styles: {state.message}</p>
	}

	const { grantLevel, options } = state.grantLevel !== null ? state : { grantLevel: null, options: [] }
	if (grantLevel === null || level < grantLevel) return null

	const searchableOptions: SearchableOption[] = options.map((option) => ({
		key: optionKey(option),
		name: option.name,
		label: <strong>{option.name}</strong>,
		detail: resolverData ? <ResolvedEntries entries={option.entries} data={resolverData} /> : <Entries entries={option.entries} />,
		selected: value === option.name,
	}))

	return (
		<div className="fighting-style-picker">
			<SearchableOptionList
				legend="Fighting style"
				name="fighting-style"
				inputType="radio"
				options={searchableOptions}
				required={1}
				renderCount={({ chosen }) => (chosen === 0 ? 'Choose a fighting style.' : 'Fighting style chosen.')}
				onToggle={(key) => {
					const option = options.find((candidate) => optionKey(candidate) === key)
					if (option) onChange(option.name)
				}}
			/>
		</div>
	)
}
