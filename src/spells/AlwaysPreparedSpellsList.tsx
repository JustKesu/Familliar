import { useEffect, useState, type ReactNode } from 'react'
import { loadSubclassAlwaysPreparedSpells, type AlwaysPreparedSpell } from './subclassPreparedSpells'

/*
 * Read-only display of a subclass's always-prepared spells (slice d2b),
 * shown alongside the class spell picker so the player can see what their
 * subclass grants for free. These are NOT selectable, NOT stored, and do
 * NOT count against the picker's cantrip/leveled counts — the sheet's own
 * "always prepared (subclass)" labelling is slice d4, not this component.
 */

type LoadState =
	| { status: 'loading' }
	| { status: 'ready'; spells: AlwaysPreparedSpell[] }
	| { status: 'error'; message: string }

export function AlwaysPreparedSpellsList({
	subclassName,
	subclassSource,
	className,
	classSource,
	classLevel,
}: {
	subclassName: string
	subclassSource: string
	className: string
	classSource: string
	classLevel: number
}): ReactNode {
	const [state, setState] = useState<LoadState>({ status: 'loading' })

	useEffect(() => {
		let cancelled = false
		setState({ status: 'loading' })
		loadSubclassAlwaysPreparedSpells(subclassName, subclassSource, className, classSource, classLevel)
			.then((spells) => {
				if (!cancelled) setState({ status: 'ready', spells })
			})
			.catch((error: unknown) => {
				if (!cancelled) {
					setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
				}
			})
		return () => {
			cancelled = true
		}
	}, [subclassName, subclassSource, className, classSource, classLevel])

	if (state.status === 'loading') return null
	if (state.status === 'error') {
		return <p className="error">Could not load subclass spells: {state.message}</p>
	}
	if (state.spells.length === 0) return null

	return (
		<div className="spell-picker__section spell-picker__section--always-prepared">
			<p className="spell-picker__remaining">Always prepared from {subclassName} (free, not counted against the choices above):</p>
			<ul className="spell-picker__list">
				{state.spells.map((spell) => (
					<li key={`${spell.name}|${spell.source}`} className="spell-picker__item">
						{spell.name}
						{spell.ritual && <span className="spell-picker__flag"> (ritual)</span>}
						{spell.concentration && <span className="spell-picker__flag"> (concentration)</span>}
					</li>
				))}
			</ul>
		</div>
	)
}
