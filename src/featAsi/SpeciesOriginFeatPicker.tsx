import type { ReactNode } from 'react'
import { ResolvedEntries, type ResolverData } from '../featureResolver'
import { Entries } from '../markup'
import type { KnownSpell } from '../spells/knownSpells'
import type { CharacterGrantedFeat, FeatChoiceDetails } from '../storage/character'
import type { GrantedFeat } from './featAsiLevels'
import type { FeatRef } from './featInstances'
import { FeatSubChoicePicker, type FeatChoiceHeld } from './FeatSubChoicePicker'
import { speciesOriginFeatProblem, speciesOriginFeatTaker, type SpeciesOriginFeatLoad } from './speciesOriginFeat'

/** D271/D272: the Background step's card for the origin feat the species grants (Human Versatile). Renders nothing for a species without one. */
export function SpeciesOriginFeatPicker({
	load,
	speciesName,
	value,
	takenFeats,
	backgroundFeatError,
	onChange,
	held,
	alreadyKnown,
	laterNote,
	resolverData,
}: {
	load: SpeciesOriginFeatLoad
	speciesName: string
	value: CharacterGrantedFeat | undefined
	/** Every other feat the character holds, labelled by origin (grantedFeatsOf + ASI levels). */
	takenFeats: readonly GrantedFeat[]
	/** The background feat links failed to load, so a clash with the background feat cannot be ruled out. */
	backgroundFeatError: string | null
	onChange: (feat: FeatRef & FeatChoiceDetails) => void
	/** Called only once a feat is chosen — what the character holds apart from it (D160). */
	held: () => FeatChoiceHeld
	alreadyKnown: readonly KnownSpell[]
	laterNote: boolean
	resolverData?: ResolverData
}): ReactNode {
	if (load.status === 'error') return <p className="error">Could not load the species feat: {load.message}</p>
	if (load.status !== 'ready' || !load.grants) return null
	const selected = value && load.originFeats.find((feat) => feat.name === value.name && feat.source === value.source)
	const problem = selected ? speciesOriginFeatProblem(selected, takenFeats)?.text : null
	const line = backgroundFeatError !== null ? `Could not load the background feats: ${backgroundFeatError}` : (problem ?? (selected ? null : 'Choose an origin feat.'))

	function select(option: string): void {
		const split = option.lastIndexOf('|')
		onChange({ name: option.slice(0, split), source: option.slice(split + 1) })
	}

	return (
		<fieldset className="feat-asi-picker__level">
			<legend>Species feat: Versatile ({speciesName})</legend>
			<label className="feat-asi-card__field">
				<span aria-hidden="true">Origin feat</span>
				<select
					className="feat-asi-card__select"
					aria-label="Species origin feat"
					aria-describedby={line ? 'species-feat-missing' : undefined}
					value={value ? `${value.name}|${value.source}` : ''}
					onChange={(event) => select(event.target.value)}
				>
					<option value="" disabled>
						Choose an origin feat…
					</option>
					{load.originFeats.map((feat) => {
						const taker = speciesOriginFeatTaker(feat, takenFeats)
						return (
							<option key={`${feat.name}|${feat.source}`} value={`${feat.name}|${feat.source}`} disabled={taker !== undefined}>
								{feat.name} · {feat.source}
								{taker ? ` (already taken: ${taker.origin})` : ''}
							</option>
						)
					})}
				</select>
			</label>
			{line && (
				<p className="feat-asi-card__missing" id="species-feat-missing">
					{line}
				</p>
			)}
			{selected?.entries && (
				<div className="feat-asi-card__text">{resolverData ? <ResolvedEntries entries={selected.entries} data={resolverData} /> : <Entries entries={selected.entries} />}</div>
			)}
			{value && (
				<FeatSubChoicePicker
					key={`${value.name}|${value.source}`}
					feat={value}
					value={value}
					onChange={(details) => onChange({ ...details, name: value.name, source: value.source })}
					held={held()}
					alreadyKnown={alreadyKnown}
					laterNote={laterNote}
					idPrefix="species"
				/>
			)}
		</fieldset>
	)
}
