import { useEffect, useState, type ReactNode } from 'react'
import { loadToolCategoryOptions } from './toolProficiencyData'
import type { BackgroundToolProficiency } from '../backgrounds/backgroundData'

/*
 * Background tool proficiency picker. Mirrors SpeciesSkillPicker (D8): state
 * lives in the wizard, this component only displays `value` and reports
 * changes upward.
 *
 * A named tool (`kind: 'named'`) isn't a choice — BackgroundGrants already
 * displays it, so this reports it upward itself and renders nothing.
 * A category choice (`kind: 'category'`) always offers exactly 1 pick
 * (confirmed for all three category keys against backgrounds.json — see
 * toolProficiencyData.ts), so this renders a single-choice list built from
 * the options items.json can filter structurally.
 */

type LoadState =
	| { status: 'loading' }
	| { status: 'ready'; options: string[] }
	| { status: 'error'; message: string }

export function ToolProficiencyPicker({
	toolProficiency,
	value,
	onChange,
}: {
	toolProficiency: BackgroundToolProficiency
	value: string | null
	onChange: (tool: string | null) => void
}): ReactNode {
	const [state, setState] = useState<LoadState>({ status: 'loading' })

	useEffect(() => {
		if (toolProficiency.kind !== 'category') return
		let cancelled = false
		setState({ status: 'loading' })
		loadToolCategoryOptions(toolProficiency.category)
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
	}, [toolProficiency])

	useEffect(() => {
		if (toolProficiency.kind === 'named' && value !== toolProficiency.name) {
			onChange(toolProficiency.name)
		}
	}, [toolProficiency, value, onChange])

	if (toolProficiency.kind === 'named') return null
	if (state.status === 'loading') return <p>Loading tools…</p>
	if (state.status === 'error') {
		return <p className="error">Could not load tool options: {state.message}</p>
	}

	return (
		<div className="tool-proficiency-picker">
			<p className="tool-proficiency-picker__hint">Choose {toolProficiency.label}:</p>
			<ul className="tool-proficiency-picker__list">
				{state.options.map((tool) => (
					<li key={tool} className="tool-proficiency-picker__item">
						<label>
							<input
								type="radio"
								name="tool-proficiency"
								checked={value === tool}
								onChange={() => onChange(tool)}
							/>
							{tool}
						</label>
					</li>
				))}
			</ul>
		</div>
	)
}
