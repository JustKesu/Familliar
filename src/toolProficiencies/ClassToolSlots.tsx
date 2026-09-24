import { useEffect, useState, type ReactNode } from 'react'
import type { CharacterToolChoice } from '../storage/character'
import { toolChoiceOptions, type ClassToolChoiceGrant } from './classToolChoices'
import { loadToolCategoryOptions } from './toolProficiencyData'

/**
 * One select per tool a class or subclass lets the player pick (D174), the
 * same shape as FeatureLanguageSlots. `value` holds every class-tool pick;
 * `known` names the tools the character has from anywhere else, which are never
 * offered.
 */
export function ClassToolSlots({
	grants,
	value,
	known,
	onChange,
}: {
	grants: readonly ClassToolChoiceGrant[]
	value: readonly CharacterToolChoice[]
	known: readonly string[]
	onChange: (choices: CharacterToolChoice[]) => void
}): ReactNode {
	const [options, setOptions] = useState<Record<string, string[]> | null>(null)
	const [error, setError] = useState<string | null>(null)
	const categoryKey = [...new Set(grants.flatMap((grant) => grant.categories))].sort().join(',')

	useEffect(() => {
		if (categoryKey === '') return
		let cancelled = false
		Promise.all(categoryKey.split(',').map(async (category) => [category, await loadToolCategoryOptions(category)] as const))
			.then((loaded) => {
				if (!cancelled) setOptions(Object.fromEntries(loaded))
			})
			.catch((reason: unknown) => {
				if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason))
			})
		return () => {
			cancelled = true
		}
	}, [categoryKey])

	if (grants.length === 0) return null
	if (error) return <p className="error">Could not load tools: {error}</p>
	if (categoryKey !== '' && !options) return <p>Loading tools…</p>

	const taken = new Set([...known, ...grants.flatMap((grant) => grant.fixedTools ?? []), ...value.map((choice) => choice.name)].map((name) => name.toLowerCase()))

	return (
		<ul className="language-picker__list">
			{grants.flatMap((grant) => {
				const picks = value.filter((choice) => choice.grantedBy === grant.grantedBy)
				const all = grant.options ?? [...new Set(grant.categories.flatMap((category) => options?.[category] ?? []))].sort((a, b) => a.localeCompare(b))
				const choose = (slot: number, name: string): void => {
					const next: (CharacterToolChoice | undefined)[] = [...picks]
					next[slot] = name ? { grantedBy: grant.grantedBy, name } : undefined
					onChange([...value.filter((choice) => choice.grantedBy !== grant.grantedBy), ...next.filter((pick) => pick !== undefined)])
				}
				// D176: a pick beyond the count (an Artificer replacement whose duplicate went away) stays visible so the player can clear it.
				return Array.from({ length: Math.max(grant.count, picks.length) }, (_, slot) => {
					const current = picks[slot]
					return (
						<li key={`${grant.grantedBy}:${slot}`}>
							<label>
								{grant.owner} tool{grant.count > 1 ? ` ${slot + 1}` : ''}
								{slot >= grant.count ? ' (no longer owed — not counted)' : ''}:{' '}
								<select value={current?.name ?? ''} onChange={(event) => choose(slot, event.target.value)}>
									<option value="">— not chosen —</option>
									{toolChoiceOptions(all, taken, current?.name).map((name) => (
										<option key={name} value={name}>
											{name}
										</option>
									))}
								</select>
							</label>
						</li>
					)
				})
			})}
		</ul>
	)
}
