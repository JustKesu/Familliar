import { useEffect, useState, type ReactNode } from 'react'
import { loadSpeciesSkillProficiencies, type SpeciesSkillProficiencies } from './speciesSkillData'
import type { DisabledSkill } from '../classSkills/ClassSkillPicker'

/*
 * Species skill proficiency picker. Mirrors ClassSkillPicker (D8): state
 * lives in the wizard, this component only displays `value` and reports
 * changes upward. Renders nothing at all when the species grants no skill
 * (task instructions, point 2) — there's nothing to show or pick.
 */

type LoadState =
	| { status: 'loading' }
	| { status: 'ready'; proficiencies: SpeciesSkillProficiencies | null }
	| { status: 'error'; message: string }

function capitalize(word: string): string {
	return word.charAt(0).toUpperCase() + word.slice(1)
}

function findDisabled(skill: string, disabledSkills: DisabledSkill[]): DisabledSkill | undefined {
	return disabledSkills.find((d) => d.skill.toLowerCase() === skill.toLowerCase())
}

function sameSkills(a: string[], b: string[]): boolean {
	return a.length === b.length && a.every((skill, i) => skill === b[i])
}

/**
 * Lets the player pick species skill proficiencies. For a fixed grant
 * (`{ stealth: true }`, or two such keys) there's no choice — this reports
 * the fixed skills upward itself as soon as they're known, so the wizard's
 * saved character carries them without the player doing anything.
 *
 * `disabledSkills` (D18, D44) lists skills already granted from elsewhere
 * (class skills chosen so far, or the background's fixed pair if already
 * chosen) — shown, not hidden, and not selectable, each labelled with its
 * source.
 */
export function SpeciesSkillPicker({
	speciesName,
	speciesSource,
	value,
	onChange,
	disabledSkills = [],
}: {
	speciesName: string
	speciesSource: string
	value: string[]
	onChange: (skills: string[]) => void
	disabledSkills?: DisabledSkill[]
}): ReactNode {
	const [state, setState] = useState<LoadState>({ status: 'loading' })

	useEffect(() => {
		let cancelled = false
		setState({ status: 'loading' })
		loadSpeciesSkillProficiencies(speciesName, speciesSource)
			.then((proficiencies) => {
				if (!cancelled) setState({ status: 'ready', proficiencies })
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
	}, [speciesName, speciesSource])

	useEffect(() => {
		if (state.status !== 'ready' || !state.proficiencies || state.proficiencies.kind !== 'fixed') return
		if (!sameSkills(value, state.proficiencies.skills)) {
			onChange(state.proficiencies.skills)
		}
	}, [state, value, onChange])

	if (state.status === 'loading') return null
	if (state.status === 'error') {
		return <p className="error">Could not load species skills: {state.message}</p>
	}
	if (state.proficiencies === null) return null

	if (state.proficiencies.kind === 'fixed') {
		return (
			<div className="species-skill-picker">
				<p className="species-skill-picker__fixed">
					Species grants: {state.proficiencies.skills.map((skill) => capitalize(skill)).join(', ')}
				</p>
			</div>
		)
	}

	const { count, options } = state.proficiencies
	const remaining = count - value.length

	function toggle(skill: string): void {
		if (value.includes(skill)) {
			onChange(value.filter((s) => s !== skill))
			return
		}
		if (remaining <= 0) return
		onChange([...value, skill])
	}

	return (
		<div className="species-skill-picker">
			<p className="species-skill-picker__remaining">
				{remaining > 0
					? `Choose ${remaining} more skill${remaining === 1 ? '' : 's'} (${value.length} of ${count} chosen).`
					: `All ${count} skill${count === 1 ? '' : 's'} chosen.`}
			</p>
			<ul className="species-skill-picker__list">
				{options.map((skill) => {
					const disabled = findDisabled(skill, disabledSkills)
					const checked = value.includes(skill)
					const atLimit = !checked && remaining <= 0
					return (
						<li key={skill} className="species-skill-picker__item">
							<label>
								<input
									type="checkbox"
									checked={checked}
									disabled={Boolean(disabled) || atLimit}
									onChange={() => toggle(skill)}
								/>
								{capitalize(skill)}
								{disabled && (
									<span className="species-skill-picker__disabled-reason">
										{' '}
										(already granted by {disabled.source})
									</span>
								)}
							</label>
						</li>
					)
				})}
			</ul>
		</div>
	)
}
