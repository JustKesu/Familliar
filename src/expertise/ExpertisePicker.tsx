import { useEffect, useState, type ReactNode } from 'react'
import { loadExpertiseEligibility } from './expertiseData'
import type { DisabledSkill } from '../classSkills/ClassSkillPicker'

/*
 * Expertise picker. Mirrors SpeciesSkillPicker/ClassSkillPicker (D8): state
 * lives in the wizard, this component only displays `value` and reports
 * changes upward. Renders nothing when the class grants no expertise by
 * `level` — there's nothing to show or pick.
 */

type LoadState =
	| { status: 'loading' }
	| { status: 'ready'; count: number; restrictedTo: readonly string[] | null }
	| { status: 'none' }
	| { status: 'error'; message: string }

function capitalize(word: string): string {
	return word.charAt(0).toUpperCase() + word.slice(1)
}

/**
 * Lets the player name which skill proficiencies (already granted from
 * class, background or species) become Expertise. `proficientSkills` is the
 * full union of proficiencies the character already has, each tagged with
 * where it came from — this picker can never offer anything else (task
 * instructions, point 3).
 *
 * If the class's expertise pool is restricted to a specific skill list
 * (Wizard's Scholar), the offered skills are further narrowed to that list.
 * If fewer proficient skills are available than the count calls for, every
 * available skill is offered and a plain-language note explains the
 * shortfall rather than the picker refusing to render.
 */
export function ExpertisePicker({
	className,
	classSource,
	level,
	proficientSkills,
	value,
	onChange,
}: {
	className: string
	classSource: string
	level: number
	proficientSkills: DisabledSkill[]
	value: string[]
	onChange: (skills: string[]) => void
}): ReactNode {
	const [state, setState] = useState<LoadState>({ status: 'loading' })

	useEffect(() => {
		let cancelled = false
		setState({ status: 'loading' })
		loadExpertiseEligibility(className, classSource, level)
			.then((eligibility) => {
				if (cancelled) return
				setState(
					eligibility
						? { status: 'ready', count: eligibility.count, restrictedTo: eligibility.restrictedTo }
						: { status: 'none' },
				)
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

	if (state.status === 'loading' || state.status === 'none') return null
	if (state.status === 'error') {
		return <p className="error">Could not load expertise: {state.message}</p>
	}

	const { count, restrictedTo } = state
	const pool = restrictedTo ? proficientSkills.filter((p) => restrictedTo.includes(p.skill)) : proficientSkills

	if (pool.length === 0) {
		return <p className="expertise-picker__empty">No skill proficiencies to grant Expertise in yet — choose class, background or species skills first.</p>
	}

	const effectiveCount = Math.min(count, pool.length)
	const remaining = effectiveCount - value.length

	function toggle(skill: string): void {
		if (value.includes(skill)) {
			onChange(value.filter((s) => s !== skill))
			return
		}
		if (remaining <= 0) return
		onChange([...value, skill])
	}

	return (
		<div className="expertise-picker">
			{pool.length < count && (
				<p className="expertise-picker__shortfall">
					Only {pool.length} matching skill proficienc{pool.length === 1 ? 'y is' : 'ies are'} available — fewer
					than the {count} Expertise allows. Choose from what you have.
				</p>
			)}
			<p className="expertise-picker__remaining">
				{remaining > 0
					? `Choose ${remaining} more skill${remaining === 1 ? '' : 's'} for Expertise (${value.length} of ${effectiveCount} chosen).`
					: `All ${effectiveCount} Expertise skill${effectiveCount === 1 ? '' : 's'} chosen.`}
			</p>
			<ul className="expertise-picker__list">
				{pool.map(({ skill, source }) => {
					const checked = value.includes(skill)
					const atLimit = !checked && remaining <= 0
					return (
						<li key={skill} className="expertise-picker__item">
							<label>
								<input type="checkbox" checked={checked} disabled={atLimit} onChange={() => toggle(skill)} />
								{capitalize(skill)}
								<span className="expertise-picker__source"> (from {source})</span>
							</label>
						</li>
					)
				})}
			</ul>
		</div>
	)
}
