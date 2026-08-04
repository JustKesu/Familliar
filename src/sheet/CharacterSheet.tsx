/*
 * Character sheet (build order step 5, complete). 5a (skeleton, header, top
 * value block) plus 5b: skills, passive values, speed/size/darkvision, hit
 * dice pool, and the feat list — see docs/STATUS.md.
 *
 * Read-only. Replaces CharacterInspector.tsx (D14) in function — the wiring
 * to it (import, "Inspect" button, inspectedId state) is removed from
 * CharacterManager.tsx in this task, but the file itself is still on disk:
 * a settings deny rule blocks deleting it here (see docs/REPORT.md).
 *
 * Every number comes from src/calculation/ (D38: pure functions, data
 * fetched here and passed in, never fetched by the calculation layer
 * itself). Data acquisition goes through the shared loader (D39).
 */

import { useEffect, useState, type ReactNode } from 'react'
import { ABILITIES, type Ability } from '../abilities/abilityScores'
import { computeAbilityScores } from '../calculation/abilityScores'
import type { FeatEffectEntry } from '../calculation/featEffects'
import { computeHitDicePool, type ClassHitDie } from '../calculation/hitDice'
import { computeInitiative } from '../calculation/initiative'
import { computeProficiencyBonus } from '../calculation/proficiencyBonus'
import { computeSavingThrows, type ClassSavingThrowProficiencies, type SavingThrowValue } from '../calculation/savingThrows'
import { computePassiveInsight, computePassiveInvestigation, computePassivePerception, computeSkills, SKILLS, type Skill, type SkillValue } from '../calculation/skills'
import { computeDarkvision, computeSize, computeSpeed, type SpeciesTraitsData, type SpeedValue } from '../calculation/speciesTraits'
import { type Calculated } from '../calculation/types'
import { loadResolverData, ResolvedEntries, type ResolverData } from '../featureResolver'
import {
	loadFeatEffectEntries,
	loadFeatTextEntries,
	loadHitDiceClassData,
	loadSavingThrowClassData,
	loadSpeciesTraitsData,
	type FeatTextEntry,
} from './sheetData'
import type { Character } from '../storage/character'
import { UnresolvedValue, ValueBreakdown } from './ValueBreakdown'

const SKILL_LABELS: Record<Skill, string> = {
	acrobatics: 'Acrobatics',
	'animal handling': 'Animal Handling',
	arcana: 'Arcana',
	athletics: 'Athletics',
	deception: 'Deception',
	history: 'History',
	insight: 'Insight',
	intimidation: 'Intimidation',
	investigation: 'Investigation',
	medicine: 'Medicine',
	nature: 'Nature',
	perception: 'Perception',
	performance: 'Performance',
	persuasion: 'Persuasion',
	religion: 'Religion',
	'sleight of hand': 'Sleight of Hand',
	stealth: 'Stealth',
	survival: 'Survival',
}

/** D45 — a mark per proficiency status, never a number standing in for it. */
const SKILL_STATUS_MARKS: Record<SkillValue['status'], string> = {
	none: '○',
	half: '◐',
	proficient: '●',
	expertise: '★',
}

/** Same pattern as SKILL_STATUS_MARKS — a mark per status, not a breakdown-length check. */
const SAVE_STATUS_MARKS: Record<SavingThrowValue['status'], string> = {
	none: '○',
	proficient: '●',
}

const SIZE_LABELS: Record<string, string> = {
	T: 'Tiny',
	S: 'Small',
	M: 'Medium',
	L: 'Large',
	H: 'Huge',
	G: 'Gargantuan',
}

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

function formatSpeed(speed: SpeedValue): string {
	const parts = [`${speed.walk} ft.`]
	if (speed.fly) parts.push(`fly ${speed.fly} ft.`)
	if (speed.swim) parts.push(`swim ${speed.swim} ft.`)
	if (speed.climb) parts.push(`climb ${speed.climb} ft.`)
	return parts.join(', ')
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

export function CharacterSheet({ character }: { character: Character }): ReactNode {
	const [savingThrowClassData, setSavingThrowClassData] = useState<ClassSavingThrowProficiencies[] | null>(null)
	const [hitDiceClassData, setHitDiceClassData] = useState<ClassHitDie[] | null>(null)
	const [speciesTraitsData, setSpeciesTraitsData] = useState<SpeciesTraitsData[] | null>(null)
	const [feats, setFeats] = useState<FeatEffectEntry[] | null>(null)
	const [featTextEntries, setFeatTextEntries] = useState<FeatTextEntry[] | null>(null)
	const [resolverData, setResolverData] = useState<ResolverData | null>(null)
	const [loadError, setLoadError] = useState<string | null>(null)

	useEffect(() => {
		let cancelled = false
		Promise.all([
			loadSavingThrowClassData(),
			loadHitDiceClassData(),
			loadSpeciesTraitsData(),
			loadFeatEffectEntries(),
			loadFeatTextEntries(),
			loadResolverData(),
		])
			.then(([classData, hitDiceData, speciesData, featData, featTexts, resolver]) => {
				if (cancelled) return
				setSavingThrowClassData(classData)
				setHitDiceClassData(hitDiceData)
				setSpeciesTraitsData(speciesData)
				setFeats(featData)
				setFeatTextEntries(featTexts)
				setResolverData(resolver)
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

	if (!savingThrowClassData || !hitDiceClassData || !speciesTraitsData || !feats || !featTextEntries || !resolverData) {
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
	const skills = computeSkills(character, feats)
	const passivePerception = computePassivePerception(character, feats)
	const passiveInvestigation = computePassiveInvestigation(character, feats)
	const passiveInsight = computePassiveInsight(character, feats)
	const speed = computeSpeed(character, speciesTraitsData)
	const size = computeSize(character, speciesTraitsData)
	const darkvision = computeDarkvision(character, speciesTraitsData)
	const hitDice = computeHitDicePool(character.classes, hitDiceClassData)
	const chosenFeats = (character.featAsiChoices ?? []).filter((choice) => choice.kind === 'feat')

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
								{result.status === 'known' ? SAVE_STATUS_MARKS[result.value.status] : '?'} {ABILITY_LABELS[ability]}:{' '}
								{result.status === 'unknown' ? (
									<UnresolvedValue reason={result.reason} />
								) : (
									<>
										<span>{formatModifier(result.value.modifier)}</span> <ValueBreakdown breakdown={result.breakdown} />
									</>
								)}
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

			<section className="sheet__skills">
				<h2>Skills</h2>
				<ul>
					{SKILLS.map((skill) => {
						const result = skills[skill]
						return (
							<li key={skill}>
								{result.status === 'known' ? SKILL_STATUS_MARKS[result.value.status] : '?'} {SKILL_LABELS[skill]}:{' '}
								{result.status === 'unknown' ? (
									<UnresolvedValue reason={result.reason} />
								) : (
									<>
										<span>{formatModifier(result.value.modifier)}</span> <ValueBreakdown breakdown={result.breakdown} />
									</>
								)}
							</li>
						)
					})}
				</ul>
			</section>

			<section className="sheet__passive-values">
				<h2>Passive values</h2>
				<ul>
					<li>
						Passive Perception: <CalculatedNumber result={passivePerception} />
					</li>
					<li>
						Passive Investigation: <CalculatedNumber result={passiveInvestigation} />
					</li>
					<li>
						Passive Insight: <CalculatedNumber result={passiveInsight} />
					</li>
				</ul>
			</section>

			<section className="sheet__traits">
				<h2>Speed, size, darkvision</h2>
				<ul>
					<li>
						Speed:{' '}
						{speed.status === 'unknown' ? (
							<UnresolvedValue reason={speed.reason} />
						) : (
							<>
								<span>{formatSpeed(speed.value)}</span> <ValueBreakdown breakdown={speed.breakdown} />
							</>
						)}
					</li>
					<li>
						Size:{' '}
						{size.status === 'unknown' ? (
							<UnresolvedValue reason={size.reason} />
						) : (
							<>
								<span>{SIZE_LABELS[size.value] ?? size.value}</span> <ValueBreakdown breakdown={size.breakdown} />
							</>
						)}
					</li>
					<li>
						Darkvision:{' '}
						{darkvision.status === 'unknown' ? (
							<UnresolvedValue reason={darkvision.reason} />
						) : (
							<>
								<span>{darkvision.value > 0 ? `${darkvision.value} ft.` : 'None'}</span>{' '}
								<ValueBreakdown breakdown={darkvision.breakdown} />
							</>
						)}
					</li>
				</ul>
			</section>

			<section className="sheet__hit-dice">
				<h2>Hit dice</h2>
				{hitDice.status === 'unknown' ? (
					<UnresolvedValue reason={hitDice.reason} />
				) : (
					<>
						<ul>
							{hitDice.value.map((entry, index) => (
								<li key={index}>
									{entry.count}d{entry.faces} ({entry.className})
								</li>
							))}
						</ul>
						<ValueBreakdown breakdown={hitDice.breakdown} />
					</>
				)}
			</section>

			<section className="sheet__feats">
				<h2>Feats</h2>
				{chosenFeats.length === 0 ? (
					<p>No feats chosen yet.</p>
				) : (
					<ul>
						{chosenFeats.map((choice, index) => {
							const featText = featTextEntries.find((f) => f.name === choice.name && f.source === choice.source)
							return (
								<li key={index}>
									<details>
										<summary>
											{choice.name} (level {choice.level})
										</summary>
										{featText ? (
											<ResolvedEntries entries={featText.entries} data={resolverData} />
										) : (
											<UnresolvedValue reason={`No text found for feat "${choice.name}" (${choice.source}).`} />
										)}
									</details>
								</li>
							)
						})}
					</ul>
				)}
			</section>
		</article>
	)
}

export default CharacterSheet
