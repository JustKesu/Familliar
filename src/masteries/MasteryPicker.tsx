import { useEffect, useState, type ReactNode } from 'react'
import { loadMasteryCountFor, loadMasteryWeaponsFor, MASTERY_DESCRIPTIONS, type MasteryWeapon } from './masteryData'

/*
 * Weapon mastery picker. Not wired into the character creation wizard —
 * that is a separate task.
 */

type LoadState =
	| { status: 'loading' }
	| { status: 'ready'; count: number | null; weapons: MasteryWeapon[] }
	| { status: 'error'; message: string }

function weaponKey(weapon: MasteryWeapon): string {
	return `${weapon.name}|${weapon.source}`
}

/**
 * Lets the player choose which weapons benefit from their Weapon Mastery
 * feature, for classes that grant one. CONTROLLED COMPONENT (see D8): it
 * displays `value` — the selection as the caller currently has it — and
 * reports every change upward via `onChange` rather than owning the
 * selection itself.
 *
 * Renders nothing if the class grants no weapon mastery choice at this
 * level (masteryCountFor returned null — see masteryData.ts for which
 * classes that covers).
 */
export function MasteryPicker({
	className,
	classSource,
	level,
	value,
	onChange,
}: {
	className: string
	classSource: string
	level: number
	value: string[]
	onChange: (weapons: string[]) => void
}): ReactNode {
	const [state, setState] = useState<LoadState>({ status: 'loading' })

	useEffect(() => {
		let cancelled = false
		setState({ status: 'loading' })
		Promise.all([loadMasteryCountFor(className, classSource, level), loadMasteryWeaponsFor(className, classSource)])
			.then(([count, weapons]) => {
				if (!cancelled) setState({ status: 'ready', count, weapons })
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
	}, [className, classSource, level])

	if (state.status === 'loading') return <p>Loading weapon masteries…</p>
	if (state.status === 'error') {
		return <p className="error">Could not load weapon masteries: {state.message}</p>
	}

	const { count, weapons } = state
	if (count === null) return null

	const remaining = count - value.length

	function toggle(weaponName: string): void {
		if (value.includes(weaponName)) {
			onChange(value.filter((name) => name !== weaponName))
		} else if (remaining > 0) {
			onChange([...value, weaponName])
		}
	}

	return (
		<div className="mastery-picker">
			<p className="mastery-picker__hint">
				{remaining > 0 ? `Choose ${remaining} more weapon mastery${remaining === 1 ? '' : 'ies'}.` : 'All weapon masteries chosen.'}
			</p>
			<ul className="mastery-picker__list">
				{weapons.map((weapon) => {
					const key = weaponKey(weapon)
					const checked = value.includes(weapon.name)
					const disabled = !checked && remaining <= 0
					return (
						<li key={key} className="mastery-picker__item">
							<label>
								<input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggle(weapon.name)} />
								<strong>{weapon.name}</strong> — {weapon.masteryFull}
							</label>
							<div className="mastery-picker__description">
								{MASTERY_DESCRIPTIONS[weapon.masteryFull] ?? weapon.masteryFull}
							</div>
						</li>
					)
				})}
			</ul>
		</div>
	)
}
