import { useEffect, useState, type ReactNode } from 'react'
import { loadClassFeatureChoices, type ClassFeatureChoice } from './classFeatureChoiceData'
import { loadResolverData, ResolvedEntries, type ResolverData } from '../featureResolver'
import { Entries } from '../markup'
import type { CharacterClassFeatureChoice } from '../storage/character'

/*
 * Picker for the "pick one version of this feature" choices a class
 * feature's own text carries (D21) — Divine Order, Primal Order, Elemental
 * Fury. A radio group, not checkboxes: every one of these has count 1 and
 * replaces the feature with exactly one alternative, unlike the
 * optionalfeatureProgression pickers, which accumulate picks with level.
 *
 * Each option shows its own resolved text (D13 — every step shows what the
 * choice grants) through the shared resolver (D51), the same way
 * ClassOptionalFeaturePicker does.
 */

type LoadState = { status: 'loading' } | { status: 'ready'; choices: ClassFeatureChoice[] } | { status: 'error'; message: string }

/**
 * CONTROLLED COMPONENT (D8): displays `value` and reports every change
 * upward. Renders nothing when the class grants no such choice by this level.
 */
export function ClassFeatureChoicePicker({
	className,
	classSource,
	level,
	value,
	onChange,
}: {
	className: string
	classSource: string
	level: number
	value: CharacterClassFeatureChoice[]
	onChange: (selection: CharacterClassFeatureChoice[]) => void
}): ReactNode {
	const [state, setState] = useState<LoadState>({ status: 'loading' })
	const [resolverData, setResolverData] = useState<ResolverData | null>(null)

	useEffect(() => {
		let cancelled = false
		setState({ status: 'loading' })
		loadClassFeatureChoices(className, classSource, level)
			.then((choices) => {
				if (!cancelled) setState({ status: 'ready', choices })
			})
			.catch((error: unknown) => {
				if (!cancelled) setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
			})
		return () => {
			cancelled = true
		}
	}, [className, classSource, level])

	useEffect(() => {
		let cancelled = false
		loadResolverData()
			.then((data) => {
				if (!cancelled) setResolverData(data)
			})
			.catch(() => {
				/* Falls back to unexpanded rendering below; the picker still works without it. */
			})
		return () => {
			cancelled = true
		}
	}, [])

	if (state.status === 'loading') return <p>Loading feature choices…</p>
	if (state.status === 'error') return <p className="error">Could not load feature choices: {state.message}</p>
	if (state.choices.length === 0) return null

	/**
	 * SPREADS the entry being replaced rather than rebuilding it from a subset
	 * of its fields. Slice d5b-1 shipped the opposite and silently dropped
	 * already-recorded picks whenever the player used two controls in the
	 * "wrong" order (docs/STATUS.md's sheet-fix entry); the Pact of the Tome
	 * picker hit the same shape again. Every OTHER feature's pick is carried
	 * through untouched.
	 */
	function select(choice: ClassFeatureChoice, optionName: string): void {
		const others = value.filter((entry) => entry.featureName !== choice.featureName)
		const current = value.find((entry) => entry.featureName === choice.featureName)
		onChange([
			...others,
			{
				...(current ?? {
					className: choice.className,
					classSource: choice.classSource,
					featureName: choice.featureName,
					grantedAtLevel: choice.grantedAtLevel,
				}),
				className: choice.className,
				classSource: choice.classSource,
				featureName: choice.featureName,
				grantedAtLevel: choice.grantedAtLevel,
				optionName,
			},
		])
	}

	return (
		<div className="class-feature-choice-picker">
			{state.choices.map((choice) => {
				const chosen = value.find((entry) => entry.featureName === choice.featureName)?.optionName ?? null
				return (
					<section key={`${choice.featureName}|${choice.grantedAtLevel}`} className="class-feature-choice-picker__group">
						<h3>
							{choice.featureName} (level {choice.grantedAtLevel})
						</h3>
						<p className="class-feature-choice-picker__hint">{chosen === null ? 'Choose one.' : `${chosen} chosen.`}</p>
						<ul className="class-feature-choice-picker__list">
							{choice.options.map((option) => (
								<li key={option.uid} className="class-feature-choice-picker__item">
									<label>
										<input
											type="radio"
											name={`class-feature-choice:${choice.featureName}`}
											checked={chosen === option.name}
											onChange={() => select(choice, option.name)}
										/>
										<strong>{option.name}</strong>
									</label>
									<div className="class-feature-choice-picker__description">
										{option.found ? (
											resolverData ? (
												<ResolvedEntries entries={option.entries} data={resolverData} />
											) : (
												<Entries entries={option.entries} />
											)
										) : (
											// D43: an option whose target text is missing is still offered, with the gap stated.
											<p className="class-feature-choice-picker__not-found">Text pro „{option.name}“ se nepodařilo dohledat.</p>
										)}
									</div>
								</li>
							))}
						</ul>
					</section>
				)
			})}
		</div>
	)
}
