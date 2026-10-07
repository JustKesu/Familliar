import { useEffect, useState, type ReactNode } from 'react'
import type { CharacterMulticlassPick } from '../storage/character'
import { toolChoiceOptions } from '../toolProficiencies/classToolChoices'
import { loadToolCategoryOptions } from '../toolProficiencies/toolProficiencyData'
import { isPickOf, type MulticlassPickShape } from './multiclassPicks'

function capitalize(word: string): string {
	return word.charAt(0).toUpperCase() + word.slice(1)
}

/**
 * D330: one select per multiclass skill/tool pick of the class entered in this level up. `picks` holds every
 * class's picks; only the entered class's are edited. `heldSkills` / `heldTools` are never offered.
 */
export function MulticlassPickSlots({
	className,
	classSource,
	shape,
	error,
	picks,
	heldSkills,
	heldTools,
	onChange,
}: {
	className: string
	classSource: string
	/** null while loading. */
	shape: MulticlassPickShape | null
	error: string | null
	picks: readonly CharacterMulticlassPick[]
	heldSkills: readonly string[]
	heldTools: readonly string[]
	onChange: (picks: CharacterMulticlassPick[]) => void
}): ReactNode {
	const category = shape?.tools?.category ?? null
	const [tools, setTools] = useState<{ category: string; names: string[] } | null>(null)
	const [toolError, setToolError] = useState<string | null>(null)
	useEffect(() => {
		if (category === null) return
		let cancelled = false
		loadToolCategoryOptions(category)
			.then((names) => {
				if (!cancelled) setTools({ category, names: [...names].sort((a, b) => a.localeCompare(b)) })
			})
			.catch((reason: unknown) => {
				if (!cancelled) setToolError(reason instanceof Error ? reason.message : String(reason))
			})
		return () => {
			cancelled = true
		}
	}, [category])

	if (error) return <p className="error">Could not read the {className} multiclass proficiencies: {error}</p>
	if (!shape) return <p>Loading the {className} multiclass proficiencies…</p>
	if (!shape.skills && !shape.tools) return null
	if (toolError) return <p className="error">Could not load tools: {toolError}</p>
	if (shape.tools && tools?.category !== category) return <p>Loading tools…</p>

	const target = { className, classSource }
	const others = picks.filter((pick) => !isPickOf(pick, target))
	const own = (kind: CharacterMulticlassPick['kind']): CharacterMulticlassPick[] => picks.filter((pick) => isPickOf(pick, target) && pick.kind === kind)
	const choose = (kind: CharacterMulticlassPick['kind'], slot: number, name: string): void => {
		const next: (CharacterMulticlassPick | undefined)[] = [...own(kind)]
		next[slot] = name ? { className, classSource, kind, name } : undefined
		const otherKind = kind === 'skill' ? own('tool') : own('skill')
		onChange([...others, ...(kind === 'skill' ? next : otherKind), ...(kind === 'skill' ? otherKind : next)].filter((pick) => pick !== undefined))
	}

	const takenSkills = new Set([...heldSkills, ...picks.filter((pick) => pick.kind === 'skill').map((pick) => pick.name)])
	const takenTools = new Set([...heldTools, ...picks.filter((pick) => pick.kind === 'tool').map((pick) => pick.name)].map((name) => name.toLowerCase()))

	return (
		<ul className="language-picker__list">
			{Array.from({ length: shape.skills?.count ?? 0 }, (_, slot) => {
				const current = own('skill')[slot]?.name
				return (
					<li key={`skill:${slot}`}>
						<label>
							{className} multiclass skill{(shape.skills?.count ?? 0) > 1 ? ` ${slot + 1}` : ''}:{' '}
							<select value={current ?? ''} onChange={(event) => choose('skill', slot, event.target.value)}>
								<option value="">— not chosen —</option>
								{shape.skills!.from.filter((name) => name === current || !takenSkills.has(name)).map((name) => (
									<option key={name} value={name}>
										{capitalize(name)}
									</option>
								))}
							</select>
						</label>
					</li>
				)
			})}
			{Array.from({ length: shape.tools?.count ?? 0 }, (_, slot) => {
				const current = own('tool')[slot]?.name
				return (
					<li key={`tool:${slot}`}>
						<label>
							{className} multiclass instrument{(shape.tools?.count ?? 0) > 1 ? ` ${slot + 1}` : ''}:{' '}
							<select value={current ?? ''} onChange={(event) => choose('tool', slot, event.target.value)}>
								<option value="">— not chosen —</option>
								{toolChoiceOptions(tools?.names ?? [], takenTools, current).map((name) => (
									<option key={name} value={name}>
										{name}
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
