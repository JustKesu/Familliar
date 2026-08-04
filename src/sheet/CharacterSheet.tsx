/*
 * Character sheet (build order step 5a) — skeleton, header, and the top
 * block of computed values: ability scores/modifiers, proficiency bonus,
 * saving throws, initiative. Everything else (skills, passive values,
 * speed/size/darkvision, hit dice, the feat list) is 5b — see docs/STATUS.md.
 *
 * Read-only. Replaces CharacterInspector.tsx once 5b is also done (D14) —
 * not yet, this task leaves that file alone.
 *
 * Every number comes from src/calculation/ (D38: pure functions, data
 * fetched here and passed in, never fetched by the calculation layer
 * itself). Data acquisition goes through the shared loader (D39).
 */

import { useEffect, useState, type ReactNode } from 'react'
import { ABILITIES, type Ability } from '../abilities/abilityScores'
import { computeAbilityScores } from '../calculation/abilityScores'
import type { FeatEffectEntry } from '../calculation/featEffects'
import { computeInitiative } from '../calculation/initiative'
import { computeProficiencyBonus } from '../calculation/proficiencyBonus'
import { computeSavingThrows, type ClassSavingThrowProficiencies } from '../calculation/savingThrows'
import type { Calculated } from '../calculation/types'
import { loadFeatEffectEntries, loadSavingThrowClassData } from './sheetData'
import type { Character } from '../storage/character'
import { UnresolvedValue, ValueBreakdown } from './ValueBreakdown'

const ABILITY_LABELS: Record<Ability, string> = {
	strength: 'Strength',
	dexterity: 'Dexterity',
	constitution: 'Constitution',
	intelligence: 'Intelligence',
	wisdom: 'Wisdom',
	charisma: 'Charisma',
}

function formatModifier(modifier: number): string {
	return modifier >= 0 ? `+${modifier}` : `${modifier}`
}

/** Renders any Calculated<number> as its value plus breakdown, or D43's visible "unresolved" state. */
function CalculatedNumber({ result, format }: { result: Calculated<number>; format?: (value: number) => string }): ReactNode {
	if (result.status === 'unknown') return <UnresolvedValue reason={result.reason} />
	return (
		<>
			<span>{format ? format(result.value) : result.value}</span> <ValueBreakdown breakdown={result.breakdown} />
		</>
	)
}

/** Whether a saving throw's breakdown shows a proficiency contribution — the breakdown always starts with the ability modifier, so anything past index 0 means a source (class or feat) granted it. */
function isProficientSave(result: Calculated<number>): boolean {
	return result.status === 'known' && result.breakdown.length > 1
}

export function CharacterSheet({ character }: { character: Character }): ReactNode {
	const [savingThrowClassData, setSavingThrowClassData] = useState<ClassSavingThrowProficiencies[] | null>(null)
	const [feats, setFeats] = useState<FeatEffectEntry[] | null>(null)
	const [loadError, setLoadError] = useState<string | null>(null)

	useEffect(() => {
		let cancelled = false
		Promise.all([loadSavingThrowClassData(), loadFeatEffectEntries()])
			.then(([classData, featData]) => {
				if (cancelled) return
				setSavingThrowClassData(classData)
				setFeats(featData)
			})
			.catch((error: unknown) => {
				if (cancelled) return
				setLoadError(error instanceof Error ? error.message : String(error))
			})
		return () => {
			cancelled = true
		}
	}, [])

	if (loadError) {
		return (
			<article className="sheet">
				<p className="error">Could not load the data this sheet needs: {loadError}</p>
			</article>
		)
	}

	if (!savingThrowClassData || !feats) {
		return (
			<article className="sheet">
				<p>Loading…</p>
			</article>
		)
	}

	const abilityScores = computeAbilityScores(character, feats)
	const proficiencyBonus = computeProficiencyBonus(character.classes)
	const savingThrows = computeSavingThrows(character, savingThrowClassData, feats)
	const initiative = computeInitiative(character, feats)

	return (
		<article className="sheet">
			<header className="sheet__header">
				<h1>{character.name}</h1>

				<p className="sheet__classes">
					{character.classes.length === 0 ? (
						<UnresolvedValue reason="No class chosen yet." />
					) : (
						character.classes.map((c, index) => (
							<span key={index}>
								{index > 0 ? ', ' : ''}
								{c.className} {c.level}
								{c.subclass ? ` (${c.subclass})` : ''}
							</span>
						))
					)}
				</p>

				<p className="sheet__species">{character.species ? character.species.name : <UnresolvedValue reason="No species chosen yet." />}</p>

				<p className="sheet__background">
					{character.background ? character.background.name : <UnresolvedValue reason="No background chosen yet." />}
				</p>
			</header>

			<section className="sheet__abilities">
				<h2>Ability scores</h2>
				<ul>
					{ABILITIES.map((ability) => {
						const result = abilityScores[ability]
						return (
							<li key={ability}>
								{ABILITY_LABELS[ability]}:{' '}
								{result.status === 'unknown' ? (
									<UnresolvedValue reason={result.reason} />
								) : (
									<>
										<span>
											{result.value.score} ({formatModifier(result.value.modifier)})
										</span>{' '}
										<ValueBreakdown breakdown={result.breakdown} />
									</>
								)}
							</li>
						)
					})}
				</ul>
			</section>

			<section className="sheet__proficiency-bonus">
				<h2>Proficiency bonus</h2>
				<p>
					<CalculatedNumber result={proficiencyBonus} format={formatModifier} />
				</p>
			</section>

			<section className="sheet__saving-throws">
				<h2>Saving throws</h2>
				<ul>
					{ABILITIES.map((ability) => {
						const result = savingThrows[ability]
						return (
							<li key={ability}>
								{isProficientSave(result) ? '● ' : '○ '}
								{ABILITY_LABELS[ability]}: <CalculatedNumber result={result} format={formatModifier} />
							</li>
						)
					})}
				</ul>
			</section>

			<section className="sheet__initiative">
				<h2>Initiative</h2>
				<p>
					<CalculatedNumber result={initiative} format={formatModifier} />
				</p>
			</section>
		</article>
	)
}

export default CharacterSheet
