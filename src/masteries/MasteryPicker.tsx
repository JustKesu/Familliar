import { useEffect, useState, type ReactNode } from 'react'
import { loadMasteryCountFor, loadMasteryWeaponsFor, MASTERY_DESCRIPTIONS, type MasteryWeapon } from './masteryData'
import { SearchableOptionList, type SearchableOption } from '../pickers/SearchableOptionList'
import type { FeatRef } from '../featAsi/featInstances'
import type { Character } from '../storage/character'

/** Stable empty default so an omitted `feats` prop doesn't re-trigger the load effect. */
const NO_FEATS: readonly FeatRef[] = []
const NO_LOCKED_VALUES: readonly string[] = []

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
 * `feats` is every feat the character has (featInstances, D156) — pass a
 * stable array, it keys the load; a feat that grants weapon proficiency
 * (Martial Weapon Training, Gunner) widens the offered pool. It flows through
 * the shared weaponProficiency.ts functions.
 */
export function MasteryPicker({
	className,
	classSource,
	level,
	value,
	onChange,
	feats = NO_FEATS,
	lockedValues = NO_LOCKED_VALUES,
	multiclass,
	countOffset = 0,
	excluded = NO_LOCKED_VALUES,
}: {
	className: string
	classSource: string
	level: number
	value: string[]
	onChange: (weapons: string[]) => void
	feats?: readonly FeatRef[]
	/** D108: during a level up, the picks the character already had — shown selected and not removable. */
	lockedValues?: readonly string[]
	/** D329: a multiclass level up's classes and history — the pool reads every class's weapon proficiencies. */
	multiclass?: Pick<Character, 'classes' | 'levelOrder'>
	/** D329: masteries held from the character's other classes, added to this class's own count. */
	countOffset?: number
	/** D335: weapons another held class of a multiclass Edit already masters — not offered here. */
	excluded?: readonly string[]
}): ReactNode {
	const [state, setState] = useState<LoadState>({ status: 'loading' })
	const multiclassKey = multiclass ? JSON.stringify([multiclass.classes, multiclass.levelOrder]) : null

	useEffect(() => {
		let cancelled = false
		setState({ status: 'loading' })
		Promise.all([
			loadMasteryCountFor(className, classSource, level),
			multiclass ? loadMasteryWeaponsFor(className, classSource, feats, multiclass) : loadMasteryWeaponsFor(className, classSource, feats),
		])
			.then(([count, weapons]) => {
				if (!cancelled) setState({ status: 'ready', count: count === null ? null : count + countOffset, weapons })
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
		// `multiclass` is read through multiclassKey; the draft object is rebuilt on every render.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [className, classSource, level, feats, multiclassKey, countOffset])

	if (state.status === 'loading') return <p>Loading weapon masteries…</p>
	if (state.status === 'error') {
		return <p className="error">Could not load weapon masteries: {state.message}</p>
	}

	const { count, weapons } = state
	if (count === null) return null

	const remaining = count - value.length

	function toggle(weaponName: string): void {
		if (lockedValues.includes(weaponName)) return
		if (value.includes(weaponName)) {
			onChange(value.filter((name) => name !== weaponName))
		} else if (remaining > 0) {
			onChange([...value, weaponName])
		}
	}

	const options: SearchableOption[] = weapons.filter((weapon) => !excluded.includes(weapon.name)).map((weapon) => {
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
			locked: selected && lockedValues.includes(weapon.name),
		}
	})

	return (
		<SearchableOptionList
			legend="Weapon masteries"
			name="weapon-mastery"
			inputType="checkbox"
				variant="choose"
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
