import { useEffect, useState, type ReactNode } from 'react'
import type { CharacterKenseiWeapon } from '../storage/character'
import { loadKenseiWeaponOptions, type KenseiSlot, type KenseiWeaponOption } from './kensei'

/**
 * D344: one select per Kensei weapon slot in `slots`. `value` holds every stored pick, including slots this run
 * does not show (an earlier level in a level up), which pass through unchanged.
 */
export function KenseiWeaponSlots({
	slots,
	value,
	onChange,
}: {
	slots: readonly KenseiSlot[]
	value: readonly CharacterKenseiWeapon[]
	onChange: (picks: CharacterKenseiWeapon[]) => void
}): ReactNode {
	const [options, setOptions] = useState<KenseiWeaponOption[] | null>(null)
	const [error, setError] = useState<string | null>(null)
	const wanted = slots.length > 0

	useEffect(() => {
		if (!wanted) return
		let cancelled = false
		loadKenseiWeaponOptions()
			.then((loaded) => {
				if (!cancelled) setOptions(loaded)
			})
			.catch((reason: unknown) => {
				if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason))
			})
		return () => {
			cancelled = true
		}
	}, [wanted])

	if (!wanted) return null
	if (error) return <p className="error">Could not load the Kensei weapons: {error}</p>
	if (!options) return <p>Loading the Kensei weapons…</p>

	const isRanged = (name: string): boolean => options.some((option) => option.name === name && option.ranged)
	// Level 3 holds one melee and one ranged pick; every later level holds one pick of either kind.
	const pickFor = (slot: KenseiSlot): CharacterKenseiWeapon | undefined =>
		value.find((pick) => pick.level === slot.level && (slot.kind === 'any' || isRanged(pick.name) === (slot.kind === 'ranged')))

	return (
		<ul className="language-picker__list">
			{slots.map((slot) => {
				const current = pickFor(slot)
				const taken = new Set(value.filter((pick) => pick !== current).map((pick) => pick.name))
				const offered = options.filter((option) => !taken.has(option.name) && (slot.kind === 'any' || option.ranged === (slot.kind === 'ranged')))
				const choose = (name: string): void => onChange([...value.filter((pick) => pick !== current), ...(name ? [{ name, level: slot.level }] : [])])
				return (
					<li key={`${slot.level}:${slot.kind}`}>
						<label>
							Kensei {slot.kind === 'any' ? '' : `${slot.kind} `}weapon (Monk {slot.level}):{' '}
							<select value={current?.name ?? ''} onChange={(event) => choose(event.target.value)}>
								<option value="">— not chosen —</option>
								{offered.map((option) => (
									<option key={option.name} value={option.name}>
										{option.name}
									</option>
								))}
							</select>
						</label>
					</li>
				)
			})}
		</ul>
	)
}
