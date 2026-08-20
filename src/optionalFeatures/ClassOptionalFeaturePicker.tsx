import { useEffect, useState, type ReactNode } from 'react'
import {
	evaluateClassOptionalFeatureGroups,
	loadClassOptionalFeatureGroups,
	type ClassOptionalFeatureContextBase,
	type ClassOptionalFeatureGroup,
	type OptionalFeatureSelection,
} from './optionalFeatureData'
import { Entries } from '../markup'
import { loadResolverData, ResolvedEntries, type ResolverData } from '../featureResolver'

/*
 * Picker for a CLASS's own optionalfeatureProgression (Sorcerer Metamagic,
 * Warlock Eldritch Invocations) — forked from OptionalFeaturePicker rather
 * than shared with it: that one has a single count keyed to a subclass, a
 * `string[]` value and no prerequisites at all, while this one carries one
 * independently-counted group per granted featureType, a per-featureType
 * value shaped like storage, and prerequisites that must be re-evaluated on
 * every change (6 invocations depend on a sibling invocation). Only the
 * ResolvedEntries/Entries description fallback survives unchanged.
 */

type LoadState =
	| { status: 'loading' }
	| { status: 'ready'; groups: ClassOptionalFeatureGroup[] }
	| { status: 'error'; message: string }

/**
 * CONTROLLED COMPONENT (D8): displays `value` and reports every change
 * upward. Renders nothing when the class grants no class-level options at
 * this level.
 *
 * `damagingCantripNames` is null when the caller cannot say which of the
 * character's cantrips deal damage — the `choose` prerequisites then stay
 * unmet with their own text rather than being guessed at either way.
 */
export function ClassOptionalFeaturePicker({
	className,
	classSource,
	subclassName,
	level,
	knownSpellNames,
	damagingCantripNames,
	hasFightingStyleFeature,
	value,
	onChange,
}: {
	className: string
	classSource: string
	subclassName: string | null
	level: number
	knownSpellNames: string[]
	damagingCantripNames: string[] | null
	hasFightingStyleFeature: boolean
	value: OptionalFeatureSelection[]
	onChange: (selection: OptionalFeatureSelection[]) => void
}): ReactNode {
	const [state, setState] = useState<LoadState>({ status: 'loading' })
	const [resolverData, setResolverData] = useState<ResolverData | null>(null)

	useEffect(() => {
		let cancelled = false
		setState({ status: 'loading' })
		loadClassOptionalFeatureGroups(className, classSource, level)
			.then((groups) => {
				if (!cancelled) setState({ status: 'ready', groups })
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

	if (state.status === 'loading') return <p>Loading options…</p>
	if (state.status === 'error') return <p className="error">Could not load options: {state.message}</p>
	if (state.groups.length === 0) return null

	const contextBase: ClassOptionalFeatureContextBase = {
		classLevels: [{ className, level, subclassName }],
		knownSpellNames,
		hasFightingStyleFeature,
		...(damagingCantripNames === null ? {} : { damagingCantripsByClass: { [className]: damagingCantripNames } }),
	}
	const groups = evaluateClassOptionalFeatureGroups(state.groups, value, contextBase)

	function toggle(featureType: string, optionName: string, chosen: string[], remaining: number): void {
		const next = chosen.includes(optionName) ? chosen.filter((name) => name !== optionName) : remaining > 0 ? [...chosen, optionName] : chosen
		if (next === chosen) return
		const others = value.filter((entry) => entry.featureType !== featureType)
		onChange(next.length > 0 ? [...others, { featureType, choices: next }] : others)
	}

	return (
		<div className="class-optional-feature-picker">
			{groups.map((group) => (
				<section key={group.featureType} className="class-optional-feature-picker__group">
					<h3>{group.name ?? group.featureType}</h3>
					<p className="class-optional-feature-picker__hint">
						{group.remaining > 0 ? `Choose ${group.remaining} more option${group.remaining === 1 ? '' : 's'}.` : 'All options chosen.'}
					</p>
					{group.invalidChosen.length > 0 && (
						<ul className="class-optional-feature-picker__warnings">
							{group.invalidChosen.map((invalid) => (
								<li key={invalid.name} className="warning">
									{invalid.name} no longer qualifies: {invalid.reasons.join(' ')} It is still selected — remove it or restore what it needs.
								</li>
							))}
						</ul>
					)}
					<ul className="class-optional-feature-picker__list">
						{group.evaluated.map(({ option, eligible, reasons }) => {
							const checked = group.chosen.includes(option.name)
							// D19: an ineligible option is disabled and reasoned, never hidden — including the 3
							// Talisman invocations, whose boon this data has no option for. An already-chosen one
							// stays toggleable so the player can undo it themselves.
							const disabled = !checked && (!eligible || group.remaining <= 0)
							return (
								<li key={`${option.name}|${option.source}`} className={eligible ? 'class-optional-feature-picker__item' : 'class-optional-feature-picker__item class-optional-feature-picker__item--ineligible'}>
									<label>
										<input
											type="checkbox"
											checked={checked}
											disabled={disabled}
											onChange={() => toggle(group.featureType, option.name, group.chosen, group.remaining)}
										/>
										<strong>{option.name}</strong>
									</label>
									{reasons.length > 0 && (
										<ul className="class-optional-feature-picker__reasons">
											{reasons.map((reason, index) => (
												<li key={index}>{reason}</li>
											))}
										</ul>
									)}
									<div className="class-optional-feature-picker__description">
										{resolverData ? <ResolvedEntries entries={option.entries} data={resolverData} /> : <Entries entries={option.entries} />}
									</div>
								</li>
							)
						})}
					</ul>
				</section>
			))}
		</div>
	)
}
