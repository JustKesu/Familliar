import type { ReactNode } from 'react'
import type { ClassOptionalFeatureContextBase, ClassOptionalFeatureGroup } from './optionalFeatureData'
import { droppedName, swapBlockedBy, swapOut, swappedOut, undoNameSwap, undoSwap } from './optionSwap'
import type { CharacterOptionalFeatureChoice } from '../storage/character'

/**
 * D345 (F-20b): the same "Replace one" for picks held as bare names — maneuvers, runes, the Fighter style.
 * None of them has a prerequisite or sub-choice, so there is nothing that blocks a swap.
 */
export function ReplaceNamedPickControl({
	label,
	held,
	value,
	count,
	onChange,
}: {
	label: string
	held: readonly string[]
	value: readonly string[]
	count: number
	onChange: (names: string[]) => void
}): ReactNode {
	if (held.length === 0) return null
	const dropped = droppedName(value, held)
	return (
		<fieldset className="replace-option">
			<legend>Replace one</legend>
			{dropped ? (
				<p>
					Replacing {dropped}. Pick the new option in the list below.{' '}
					<button type="button" onClick={() => onChange(undoNameSwap(value, held, count))}>
						Keep {dropped}
					</button>
				</p>
			) : (
				<>
					<p>You may replace one of your {label} with another one.</p>
					<ul className="replace-option__list">
						{held.map((name) => (
							<li key={name}>
								<button type="button" onClick={() => onChange(value.filter((entry) => entry !== name))}>
									Replace {name}
								</button>
							</li>
						))}
					</ul>
				</>
			)}
		</fieldset>
	)
}

/**
 * D345: during a level up, drops one held option of `group` so the normal list beside it can take its replacement.
 * CONTROLLED (D8) like ClassOptionalFeaturePicker: the swap lives only in `value`.
 */
export function ReplaceOptionControl({
	group,
	value,
	held,
	contextBase,
	onChange,
}: {
	group: ClassOptionalFeatureGroup
	value: CharacterOptionalFeatureChoice[]
	held: readonly CharacterOptionalFeatureChoice[]
	contextBase: ClassOptionalFeatureContextBase
	onChange: (selection: CharacterOptionalFeatureChoice[]) => void
}): ReactNode {
	const heldChoices = held.find((entry) => entry.featureType === group.featureType)?.choices ?? []
	if (heldChoices.length === 0) return null
	const dropped = swappedOut(value, held, group.featureType)
	const label = group.name ?? group.featureType

	return (
		<fieldset className="replace-option">
			<legend>Replace one</legend>
			{dropped ? (
				<p>
					Replacing {dropped.name}. Pick the new option in the list below.{' '}
					<button type="button" onClick={() => onChange(undoSwap(value, held, group.featureType, group.count))}>
						Keep {dropped.name}
					</button>
				</p>
			) : (
				<>
					<p>You may replace one of your {label} options with another one you qualify for.</p>
					<ul className="replace-option__list">
						{/* D382: one button per name; a repeated invocation is replaced one copy at a time. */}
						{heldChoices.filter((choice, index) => heldChoices.findIndex((other) => other.name === choice.name) === index).map((choice) => {
							const blockers = swapBlockedBy(group, value, contextBase, choice.name)
							return (
								<li key={choice.name}>
									<button type="button" disabled={blockers.length > 0} onClick={() => onChange(swapOut(value, group.featureType, choice.name))}>
										Replace {choice.name}
									</button>
									{blockers.length > 0 && <span className="replace-option__reason"> Required by {blockers.join(', ')}.</span>}
								</li>
							)
						})}
					</ul>
				</>
			)}
		</fieldset>
	)
}
