import { useEffect, useState, type ReactNode } from 'react'
import { loadClassSkillChoice, type ClassSkillChoice } from './classSkillData'

/*
 * Class skill proficiency picker. Not wired into the character creation
 * wizard — that is a separate task.
 */

type LoadState =
	| { status: 'loading' }
	| { status: 'ready'; choice: ClassSkillChoice }
	| { status: 'error'; message: string }

export interface DisabledSkill {
	skill: string
	source: string
}

function capitalize(word: string): string {
	return word.charAt(0).toUpperCase() + word.slice(1)
}

function findDisabled(skill: string, disabledSkills: DisabledSkill[]): DisabledSkill | undefined {
	return disabledSkills.find((d) => d.skill.toLowerCase() === skill.toLowerCase())
}

/**
 * Lets the player pick skill proficiencies for a class. Displays `value` —
 * the selection as the caller currently has it — and reports every change
 * upward via `onChange` rather than owning the selection itself, matching
 * ClassPicker, SpeciesPicker and BackgroundPicker (see D8): a picker that
 * owns its own state loses the selection when the wizard navigates away
 * from and back to its step.
 *
 * `disabledSkills` (D18) lists skills already granted from elsewhere (e.g.
 * the chosen background) — they are shown, not hidden, but cannot be
 * selected here, each labelled with where it comes from.
 */
export function ClassSkillPicker({
	className,
	classSource,
	value,
	onChange,
	disabledSkills = [],
}: {
	className: string
	classSource: string
	value: string[]
	onChange: (skills: string[]) => void
	disabledSkills?: DisabledSkill[]
}): ReactNode {
	const [state, setState] = useState<LoadState>({ status: 'loading' })

	useEffect(() => {
		let cancelled = false
		setState({ status: 'loading' })
		loadClassSkillChoice(className, classSource)
			.then((choice) => {
				if (!cancelled) setState({ status: 'ready', choice })
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
	}, [className, classSource])

	if (state.status === 'loading') return <p>Loading skills…</p>
	if (state.status === 'error') {
		return <p className="error">Could not load class skills: {state.message}</p>
	}

	const { count, options } = state.choice
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
		<div className="class-skill-picker">
			<p className="class-skill-picker__remaining">
				{remaining > 0
					? `Choose ${remaining} more skill${remaining === 1 ? '' : 's'} (${value.length} of ${count} chosen).`
					: `All ${count} skill${count === 1 ? '' : 's'} chosen.`}
			</p>
			<ul className="class-skill-picker__list">
				{options.map((skill) => {
					const disabled = findDisabled(skill, disabledSkills)
					const checked = value.includes(skill)
					const atLimit = !checked && remaining <= 0
					return (
						<li key={skill} className="class-skill-picker__item">
							<label>
								<input
									type="checkbox"
									checked={checked}
									disabled={Boolean(disabled) || atLimit}
									onChange={() => toggle(skill)}
								/>
								{capitalize(skill)}
								{disabled && (
									<span className="class-skill-picker__disabled-reason">
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
