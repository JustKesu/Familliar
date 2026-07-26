import { useReducer, useState, type ReactNode } from 'react'
import { ClassPicker } from '../classes/ClassPicker'
import { SpeciesPicker } from '../species/SpeciesPicker'
import { BackgroundPicker } from '../backgrounds/BackgroundPicker'
import { AbilityScorePicker } from '../abilities/AbilityScorePicker'
import type { Character } from '../storage/character'
import type { CharacterStore } from '../storage/characterStore'
import {
	WIZARD_STEPS,
	initialControllerState,
	isReadyToSave,
	isStepComplete,
	saveCharacter,
	stepIndex,
	wizardReducer,
	type WizardStep,
} from './wizardState'

/*
 * The wizard shell (PHASE1.md build order step 3, section D — "Character
 * creation is a multi-step wizard, organised by category"). Walks the
 * player through the four categories built so far, in the order that
 * decision records: class and level, species, background, ability scores.
 * Reuses the existing pickers unchanged; each already reports its
 * selection upward via onChange rather than saving directly.
 *
 * Nothing reaches CharacterStore until the review step's save button runs.
 * Every other step only dispatches to the in-memory reducer in
 * wizardState.ts.
 */

const STEP_LABELS: Record<WizardStep, string> = {
	class: 'Class and level',
	species: 'Species',
	background: 'Background',
	abilities: 'Ability scores',
	review: 'Review and save',
}

export function CharacterWizard({
	store,
	onSaved,
	onCancel,
}: {
	store: CharacterStore
	onSaved: (character: Character) => void
	onCancel: () => void
}): ReactNode {
	const [state, dispatch] = useReducer(wizardReducer, undefined, initialControllerState)
	const [saveError, setSaveError] = useState<string | null>(null)

	function handleSave(): void {
		try {
			const character = saveCharacter(store, state.data)
			setSaveError(null)
			onSaved(character)
		} catch (error) {
			setSaveError(error instanceof Error ? error.message : String(error))
		}
	}

	const canGoNext = isStepComplete(state.step, state.data)

	return (
		<div className="wizard">
			<ol className="wizard__steps">
				{WIZARD_STEPS.map((step, index) => (
					<li
						key={step}
						className={step === state.step ? 'wizard__step wizard__step--active' : 'wizard__step'}
					>
						{index + 1}. {STEP_LABELS[step]}
					</li>
				))}
			</ol>

			{state.step === 'class' && (
				<div className="wizard__panel">
					<label className="wizard__field">
						Character name
						<input
							type="text"
							value={state.data.name}
							onChange={(event) => dispatch({ type: 'setName', name: event.target.value })}
						/>
					</label>
					<ClassPicker onChange={(choice) => dispatch({ type: 'setClassChoice', choice })} />
				</div>
			)}

			{state.step === 'species' && (
				<div className="wizard__panel">
					<SpeciesPicker onChange={(choice) => dispatch({ type: 'setSpeciesChoice', choice })} />
				</div>
			)}

			{state.step === 'background' && (
				<div className="wizard__panel">
					<BackgroundPicker onChange={(choice) => dispatch({ type: 'setBackgroundChoice', choice })} />
				</div>
			)}

			{state.step === 'abilities' && (
				<div className="wizard__panel">
					<AbilityScorePicker onChange={(scores) => dispatch({ type: 'setAbilityScores', scores })} />
				</div>
			)}

			{state.step === 'review' && (
				<div className="wizard__panel">
					<p>Name: {state.data.name}</p>
					<p>
						Class: {state.data.classChoice ? `${state.data.classChoice.className} (level ${state.data.classChoice.level})` : '—'}
					</p>
					<p>Species: {state.data.speciesChoice?.name ?? '—'}</p>
					<p>Background: {state.data.backgroundChoice?.name ?? '—'}</p>
					<p>Ability score method: {state.data.abilityScores?.method ?? '—'}</p>
					{saveError && <p className="error">{saveError}</p>}
				</div>
			)}

			<div className="wizard__nav">
				<button type="button" onClick={onCancel}>
					Cancel
				</button>
				<button type="button" onClick={() => dispatch({ type: 'back' })} disabled={stepIndex(state.step) === 0}>
					Back
				</button>
				{state.step === 'review' ? (
					<button type="button" onClick={handleSave} disabled={!isReadyToSave(state.data)}>
						Create character
					</button>
				) : (
					<button type="button" onClick={() => dispatch({ type: 'next' })} disabled={!canGoNext}>
						Next
					</button>
				)}
			</div>
		</div>
	)
}

export default CharacterWizard
