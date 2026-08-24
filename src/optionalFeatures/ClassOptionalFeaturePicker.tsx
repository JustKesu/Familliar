import { useEffect, useState, type ReactNode } from 'react'
import {
	evaluateClassOptionalFeatureGroups,
	loadClassOptionalFeatureGroups,
	type ClassOptionalFeatureContextBase,
	type ClassOptionalFeatureGroup,
} from './optionalFeatureData'
import { Entries } from '../markup'
import { loadResolverData, ResolvedEntries, type ResolverData } from '../featureResolver'
import {
	loadOptionalFeatureSlotCandidates,
	loadOptionalFeatureSpellChoiceShape,
	offersSpellChoice,
	type OptionalFeatureSpellChoiceShape,
	type OptionalFeatureSpellChoiceSlot,
} from '../spells/optionalFeatureSpellChoiceData'
import { knownSpellNote, knownSpellReason, optionalFeatureSpellPickerKey, type KnownSpell } from '../spells/knownSpells'
import type { FilterChoiceCandidateSpell } from '../spells/featSpellChoiceData'
import type { CharacterOptionalFeatureChoice, OptionalFeatureSpellChoice } from '../storage/character'

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
 * `damagingCantripNames`/`damagingAttackCantripNames` are null when the
 * caller cannot say which of the character's cantrips deal damage (resp.
 * deal it via an attack roll) — the `choose` prerequisites then stay unmet
 * with their own text rather than being guessed at either way.
 */
export function ClassOptionalFeaturePicker({
	className,
	classSource,
	subclassName,
	level,
	knownSpellNames,
	damagingCantripNames,
	damagingAttackCantripNames,
	hasFightingStyleFeature,
	alreadyKnown = [],
	value,
	onChange,
}: {
	className: string
	classSource: string
	subclassName: string | null
	level: number
	knownSpellNames: string[]
	damagingCantripNames: string[] | null
	damagingAttackCantripNames: string[] | null
	hasFightingStyleFeature: boolean
	/** Spells the character already has from elsewhere (knownSpells.ts) — an option's spell sub-picker shows them but does not offer them. That option's own picks are excluded by key. */
	alreadyKnown?: readonly KnownSpell[]
	value: CharacterOptionalFeatureChoice[]
	onChange: (selection: CharacterOptionalFeatureChoice[]) => void
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
		...(damagingAttackCantripNames === null ? {} : { damagingAttackCantripsByClass: { [className]: damagingAttackCantripNames } }),
	}
	const groups = evaluateClassOptionalFeatureGroups(state.groups, value, contextBase)

	/**
	 * Every writer here SPREADS the current entry instead of rebuilding it from
	 * a subset of its fields. Slice d5b-1 shipped the opposite (FeatAsiPicker's
	 * ability callback reconstructed the choice and silently dropped the
	 * already-recorded spell picks whenever the player used the two controls in
	 * the "wrong" order) — see docs/STATUS.md's sheet-fix entry.
	 */
	function toggle(featureType: string, optionName: string, chosen: string[], remaining: number): void {
		const next = chosen.includes(optionName) ? chosen.filter((name) => name !== optionName) : remaining > 0 ? [...chosen, optionName] : chosen
		if (next === chosen) return
		const others = value.filter((entry) => entry.featureType !== featureType)
		if (next.length === 0) {
			onChange(others)
			return
		}
		const current = value.find((entry) => entry.featureType === featureType)
		const updated: CharacterOptionalFeatureChoice = { ...(current ?? { featureType, choices: [] }), featureType, choices: next }
		// Deselecting an option deliberately drops that option's own spell picks — they describe a
		// choice the character no longer has. Every OTHER option's picks survive untouched.
		const keptPicks = (current?.spellChoices ?? []).filter((pick) => next.some((name) => name.toLowerCase() === pick.optionName.toLowerCase()))
		if (keptPicks.length > 0) updated.spellChoices = keptPicks
		else delete updated.spellChoices
		onChange([...others, updated])
	}

	/** Records one option's spell picks, leaving `choices` and every other option's picks exactly as they were. */
	function setSpellChoice(featureType: string, pick: OptionalFeatureSpellChoice): void {
		const current = value.find((entry) => entry.featureType === featureType)
		if (!current) return
		const others = value.filter((entry) => entry.featureType !== featureType)
		const otherPicks = (current.spellChoices ?? []).filter((existing) => existing.optionName.toLowerCase() !== pick.optionName.toLowerCase())
		onChange([...others, { ...current, spellChoices: [...otherPicks, pick] }])
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
									{/* Revealed once the option is taken, the same way the feat step reveals its own spell sub-picker. */}
									{checked && (
										<OptionalFeatureSpellSubPicker
											featureType={group.featureType}
											optionName={option.name}
											alreadyKnown={alreadyKnown}
											value={value.find((entry) => entry.featureType === group.featureType)?.spellChoices?.find((p) => p.optionName === option.name)}
											onChange={(pick) => setSpellChoice(group.featureType, pick)}
										/>
									)}
								</li>
							)
						})}
					</ul>
				</section>
			))}
		</div>
	)
}

type ShapeState = { status: 'loading' } | { status: 'ready'; shape: OptionalFeatureSpellChoiceShape }

/**
 * The spell picks a chosen option offers (build order step 6a — Pact of the
 * Tome is the only one in the data). Renders nothing at all for an option
 * that grants literal spells or none, so it can be mounted unconditionally
 * under every checked option without the caller knowing which is which.
 *
 * CONTROLLED (D8) like its parent: it never holds the picks itself, and its
 * onChange reports a WHOLE OptionalFeatureSpellChoice so the parent can
 * splice it in beside any other option's picks.
 */
function OptionalFeatureSpellSubPicker({
	featureType,
	optionName,
	alreadyKnown,
	value,
	onChange,
}: {
	featureType: string
	optionName: string
	alreadyKnown: readonly KnownSpell[]
	value: OptionalFeatureSpellChoice | undefined
	onChange: (pick: OptionalFeatureSpellChoice) => void
}): ReactNode {
	const [state, setState] = useState<ShapeState>({ status: 'loading' })

	useEffect(() => {
		let cancelled = false
		setState({ status: 'loading' })
		loadOptionalFeatureSpellChoiceShape(optionName, featureType)
			.then((shape) => {
				if (!cancelled) setState({ status: 'ready', shape })
			})
			.catch(() => {
				/* Leaves the sub-picker in its loading state; the option itself still works. */
			})
		return () => {
			cancelled = true
		}
	}, [optionName, featureType])

	if (state.status !== 'ready' || !offersSpellChoice(state.shape)) return null

	const cantrips = value?.cantrips ?? []
	const spells = value?.spells ?? []

	return (
		<div className="class-optional-feature-picker__spells">
			{state.shape.cantripSlot && (
				<SlotPicker
					slot={state.shape.cantripSlot}
					label="cantrips"
					picked={cantrips}
					alreadyKnown={alreadyKnown}
					ownPickerKey={optionalFeatureSpellPickerKey(optionName)}
					// Spread the current pick so writing one slot never clears the other.
					onChange={(next) => onChange({ optionName, cantrips: next, spells })}
				/>
			)}
			{state.shape.spellSlot && (
				<SlotPicker
					slot={state.shape.spellSlot}
					label="spells"
					picked={spells}
					alreadyKnown={alreadyKnown}
					ownPickerKey={optionalFeatureSpellPickerKey(optionName)}
					onChange={(next) => onChange({ optionName, cantrips, spells: next })}
				/>
			)}
		</div>
	)
}

/** One slot's candidate list with its own independent count, mirroring how SpellPicker counts cantrips and leveled spells separately. */
function SlotPicker({
	slot,
	label,
	picked,
	alreadyKnown,
	ownPickerKey,
	onChange,
}: {
	slot: OptionalFeatureSpellChoiceSlot
	label: string
	picked: { name: string; source: string }[]
	alreadyKnown: readonly KnownSpell[]
	ownPickerKey: string
	onChange: (next: { name: string; source: string }[]) => void
}): ReactNode {
	const [candidates, setCandidates] = useState<FilterChoiceCandidateSpell[] | null>(null)

	useEffect(() => {
		let cancelled = false
		loadOptionalFeatureSlotCandidates(slot)
			.then((offered) => {
				if (!cancelled) setCandidates(offered)
			})
			.catch(() => {
				/* Leaves the list unrendered rather than showing an unfiltered pool. */
			})
		return () => {
			cancelled = true
		}
	}, [slot])

	if (candidates === null) return null

	const isPicked = (spell: FilterChoiceCandidateSpell): boolean =>
		picked.some((p) => p.name.toLowerCase() === spell.name.toLowerCase() && p.source.toUpperCase() === spell.source.toUpperCase())

	function toggle(spell: FilterChoiceCandidateSpell): void {
		if (isPicked(spell)) {
			onChange(picked.filter((p) => !(p.name.toLowerCase() === spell.name.toLowerCase() && p.source.toUpperCase() === spell.source.toUpperCase())))
			return
		}
		if (picked.length >= slot.count) return
		onChange([...picked, { name: spell.name, source: spell.source }])
	}

	return (
		<div className="class-optional-feature-picker__slot">
			<p className="class-optional-feature-picker__hint">
				{picked.length} of {slot.count} {label} chosen.
			</p>
			<ul className="class-optional-feature-picker__slot-list">
				{candidates.map((spell) => {
					const checked = isPicked(spell)
					const known = knownSpellReason(alreadyKnown, spell, ownPickerKey)
					return (
						<li key={`${spell.name}|${spell.source}`}>
							<label>
								<input
									type="checkbox"
									checked={checked}
									disabled={!checked && (picked.length >= slot.count || known !== null)}
									onChange={() => toggle(spell)}
								/>
								{spell.name}
								{known !== null && <span className="class-optional-feature-picker__already-known"> {knownSpellNote(known)}</span>}
							</label>
						</li>
					)
				})}
			</ul>
		</div>
	)
}
