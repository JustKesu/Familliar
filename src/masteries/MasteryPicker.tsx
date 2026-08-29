import { useEffect, useState, type ReactNode } from 'react'
import { loadMasteryCountFor, loadMasteryWeaponsFor, MASTERY_DESCRIPTIONS, type MasteryWeapon } from './masteryData'
import { SearchableOptionList, type SearchableOption } from '../pickers/SearchableOptionList'
import type { FeatAsiChoice } from '../storage/character'

/** Stable empty default so an omitted `featAsiChoices` prop doesn't re-trigger the load effect. */
const NO_FEAT_CHOICES: FeatAsiChoice[] = []

/*
 * Weapon mastery picker. Not wired into the character creation wizard —
 * that is a separate task.
 */

type LoadState =
	| { status: 'loading' }
	| { status: 'ready'; count: number | null; weapons: MasteryWeapon[] }
	| { status: 'error'; message: string }

function weaponKey(weapon: MasteryWeapon): string {
	return `${weapon.name}|${weapon.source}|${weapon.masteryFull}`
}

/**
 * Lets the player choose which weapons benefit from their Weapon Mastery
 * feature, for classes that grant one. CONTROLLED COMPONENT (see D8): it
 * displays `value` — the selection as the caller currently has it — and
 * reports every change upward via `onChange` rather than owning the
 * selection itself. The long weapon list is shown through
 * SearchableOptionList (collapsing + search + count).
 *
 * Renders nothing if the class grants no weapon mastery choice at this
 * level (masteryCountFor returned null — see masteryData.ts for which
 * classes that covers).
 *
 * `featAsiChoices` is the character's stored feat/ASI picks; a feat that
 * grants weapon proficiency (Martial Weapon Training, Gunner) widens the
 * offered pool. It flows through the shared weaponProficiency.ts functions.
 */
export function MasteryPicker({
	className,
	classSource,
	level,
	value,
	onChange,
	featAsiChoices = NO_FEAT_CHOICES,
}: {
	className: string
	classSource: string
	level: number
	value: string[]
	onChange: (weapons: string[]) => void
	featAsiChoices?: FeatAsiChoice[]
}): ReactNode {
	const [state, setState] = useState<LoadState>({ status: 'loading' })

	useEffect(() => {
		let cancelled = false
		setState({ status: 'loading' })
		Promise.all([
			loadMasteryCountFor(className, classSource, level),
			loadMasteryWeaponsFor(className, classSource, featAsiChoices),
		])
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
	}, [className, classSource, level, featAsiChoices])

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

	const options: SearchableOption[] = weapons.map((weapon) => {
		const selected = value.includes(weapon.name)
		return {
			key: weaponKey(weapon),
			name: weapon.name,
			label: (
				<>
					<strong>{weapon.name}</strong> — {weapon.masteryFull}
				</>
			),
			detail: MASTERY_DESCRIPTIONS[weapon.masteryFull] ?? weapon.masteryFull,
			selected,
			disabled: !selected && remaining <= 0,
		}
	})

	return (
		<SearchableOptionList
			legend="Weapon masteries"
			name="weapon-mastery"
			inputType="checkbox"
			options={options}
			required={count}
			renderCount={({ chosen, required }) => {
				const left = required - chosen
				return left > 0
					? `Choose ${left} more weapon master${left === 1 ? 'y' : 'ies'} (${chosen} of ${required}).`
					: `All ${required} weapon masteries chosen.`
			}}
			onToggle={(key) => {
				const weapon = weapons.find((candidate) => weaponKey(candidate) === key)
				if (weapon) toggle(weapon.name)
			}}
		/>
	)
}
