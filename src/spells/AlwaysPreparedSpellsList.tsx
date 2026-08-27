import { type ReactNode } from 'react'
import { type AlwaysPreparedSpell } from './subclassPreparedSpells'

/*
 * Read-only display of a subclass's always-prepared spells (slice d2b),
 * shown alongside the class spell picker so the player can see what their
 * subclass grants for free. These are NOT selectable, NOT stored, and do
 * NOT count against the picker's cantrip/leveled counts — the sheet's own
 * "always prepared (subclass)" labelling is slice d4, not this component.
 *
 * The list is computed by the wizard (one place, so the D71 disabled set
 * and this list can never disagree about a pact-slot-rank grant) and handed
 * in as a prop — this component only renders it.
 */

export function AlwaysPreparedSpellsList({
	subclassName,
	spells,
}: {
	subclassName: string
	spells: AlwaysPreparedSpell[]
}): ReactNode {
	if (spells.length === 0) return null

	return (
		<div className="spell-picker__section spell-picker__section--always-prepared">
			<p className="spell-picker__remaining">Always prepared from {subclassName} (free, not counted against the choices above):</p>
			<ul className="spell-picker__list">
				{spells.map((spell) => (
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
