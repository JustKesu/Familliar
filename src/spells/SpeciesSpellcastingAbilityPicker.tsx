import { useEffect, useState, type ReactNode } from 'react'
import type { Ability } from '../abilities/abilityScores'
import { ABILITY_ABBREVIATIONS, type AbilityAbbreviation } from '../calculation/abilityAbbreviations'
import { loadSpeciesSpellcastingAbilityChoice } from './speciesSpellcastingAbilityData'

/*
 * D89 follow-up. Mirrors SpeciesSkillPicker (D8/D81): state lives in the
 * wizard, this component only displays `value` and reports changes upward.
 * Renders nothing when the species has nothing to choose — no granted spell
 * at all, or a fixed ability (Aasimar) — same "nothing to show" convention.
 */

const ABILITY_BY_ABBREVIATION: Record<AbilityAbbreviation, Ability> = Object.fromEntries(
	(Object.entries(ABILITY_ABBREVIATIONS) as [Ability, AbilityAbbreviation][]).map(([ability, abbreviation]) => [abbreviation, ability]),
) as Record<AbilityAbbreviation, Ability>

const ABILITY_LABELS: Record<Ability, string> = {
	strength: 'Strength',
	dexterity: 'Dexterity',
	constitution: 'Constitution',
	intelligence: 'Intelligence',
	wisdom: 'Wisdom',
	charisma: 'Charisma',
}

type LoadState =
	| { status: 'loading' }
	| { status: 'ready'; options: Ability[] | null }
	| { status: 'error'; message: string }

/**
 * Lets the player pick which ability the species' own granted spells are cast
 * with, when `additionalSpells.ability` is the `{choose:[...]}` shape (33 of
 * the 34 species entries that grant a spell at all).
 */
export function SpeciesSpellcastingAbilityPicker({
	speciesName,
	speciesSource,
	value,
	onChange,
}: {
	speciesName: string
	speciesSource: string
	value: Ability | null
	onChange: (ability: Ability | null) => void
}): ReactNode {
	const [state, setState] = useState<LoadState>({ status: 'loading' })

	useEffect(() => {
		let cancelled = false
		setState({ status: 'loading' })
		loadSpeciesSpellcastingAbilityChoice(speciesName, speciesSource)
			.then((choices) => {
				if (!cancelled) setState({ status: 'ready', options: choices ? choices.map((abbr) => ABILITY_BY_ABBREVIATION[abbr]) : null })
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

	if (state.status === 'loading') return null
	if (state.status === 'error') {
		return <p className="error">Could not load the species spellcasting ability: {state.message}</p>
	}
	if (state.options === null) return null

	return (
		<div className="species-spellcasting-ability-picker">
			<label className="species-spellcasting-ability-picker__field">
				Spellcasting ability
				<select value={value ?? ''} onChange={(event) => onChange((event.target.value || null) as Ability | null)}>
					<option value="" disabled>
						Choose an ability…
					</option>
					{state.options.map((ability) => (
						<option key={ability} value={ability}>
							{ABILITY_LABELS[ability]}
						</option>
					))}
				</select>
			</label>
			{value === null && <p className="species-spellcasting-ability-picker__hint">Choose your species spellcasting ability to continue.</p>}
		</div>
	)
}
