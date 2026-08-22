import { useEffect, useState, type ReactNode } from 'react'
import { loadBeasts, type Beast } from './beastData'
import { wildShapeForms, wildShapeLimits } from './wildShapeData'
import { BeastStatBlock } from '../sheet/BeastStatBlock'

/*
 * Picker for the Beast forms a Druid knows for Wild Shape (step 6b slice 3).
 *
 * Checkboxes, not radios: the character knows SEVERAL forms at once (4, 6 or
 * 8 by level — wildShapeData.ts's Beast Shapes table), unlike the D21
 * pick-one-alternative choices.
 *
 * Lives on the class step (D13). Nothing here depends on spells, so D64's
 * exception does not apply. Renders nothing at all for a character without
 * Wild Shape — not a Druid, or below level 2.
 *
 * Each offered beast shows its own stat block through the sheet's
 * BeastStatBlock (D13 — every step shows what the choice grants); this is
 * the only beast renderer in the project and stays that way.
 */

type LoadState = { status: 'loading' } | { status: 'ready'; beasts: Beast[] } | { status: 'error'; message: string }

function formKey(form: { name: string; source: string }): string {
	return `${form.name}|${form.source}`
}

/**
 * CONTROLLED COMPONENT (D8): displays `value` and reports every change upward.
 */
export function WildShapeFormPicker({
	className,
	classSource,
	level,
	subclassName,
	value,
	onChange,
}: {
	className: string
	classSource: string
	level: number
	subclassName: string | null
	value: { name: string; source: string }[]
	onChange: (forms: { name: string; source: string }[]) => void
}): ReactNode {
	const [state, setState] = useState<LoadState>({ status: 'loading' })

	const limits = wildShapeLimits(className, level, subclassName)

	useEffect(() => {
		if (!limits) return
		let cancelled = false
		setState({ status: 'loading' })
		loadBeasts()
			.then((beasts) => {
				if (!cancelled) setState({ status: 'ready', beasts })
			})
			.catch((error: unknown) => {
				if (!cancelled) setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
			})
		return () => {
			cancelled = true
		}
		// `limits` is recomputed every render; the inputs it derives from are the real dependencies.
	}, [className, classSource, level, subclassName, Boolean(limits)])

	if (!limits) return null
	if (state.status === 'loading') return <p>Loading Beast forms…</p>
	if (state.status === 'error') return <p className="error">Could not load Beast forms: {state.message}</p>

	const offered = wildShapeForms(state.beasts, limits)
	const chosen = new Set(value.map(formKey))
	const atLimit = value.length >= limits.knownForms

	/**
	 * SPREADS the picks already made rather than rebuilding the list from the
	 * beast being toggled. The opposite shape has shipped three times in this
	 * project (slice d5b-1's sheet fix, Pact of the Tome, and the D21 picker
	 * that guards against it now), each time silently dropping earlier picks
	 * when the player used the controls in the "wrong" order.
	 */
	function toggle(beast: Beast, checked: boolean): void {
		const key = formKey(beast)
		if (!checked) {
			onChange(value.filter((form) => formKey(form) !== key))
			return
		}
		if (chosen.has(key) || atLimit) return
		onChange([...value, { name: beast.name, source: beast.source }])
	}

	return (
		<div className="wild-shape-form-picker">
			<h3>Wild Shape forms</h3>
			<p className="wild-shape-form-picker__hint">
				Choose {limits.knownForms} Beast form{limits.knownForms === 1 ? '' : 's'} (chosen {value.length}). Maximum Challenge
				Rating {limits.maxCrLabel}
				{limits.moonCap ? ' (Circle of the Moon)' : ''};{' '}
				{limits.flyAllowed ? 'a form with a Fly Speed is allowed' : 'no form with a Fly Speed yet'}.
			</p>
			<ul className="wild-shape-form-picker__list">
				{offered.map((beast) => {
					const key = formKey(beast)
					const isChosen = chosen.has(key)
					return (
						<li key={key} className="wild-shape-form-picker__item">
							<label>
								<input
									type="checkbox"
									checked={isChosen}
									disabled={!isChosen && atLimit}
									onChange={(event) => toggle(beast, event.target.checked)}
								/>
								<strong>{beast.name}</strong> (CR {beast.cr})
							</label>
							<BeastStatBlock beast={beast} />
						</li>
					)
				})}
			</ul>
		</div>
	)
}
