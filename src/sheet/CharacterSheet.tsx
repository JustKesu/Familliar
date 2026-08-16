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
import { computeSpellcasting, type ClassSpellcastingAbility } from '../calculation/spellcasting'
import { computeSpellSlots, type ClassSpellSlotsData } from '../calculation/spellSlots'
import { computeDarkvision, computeSize, computeSpeed, type SpeciesTraitsData, type SpeedValue } from '../calculation/speciesTraits'
import { type Calculated } from '../calculation/types'
import { loadResolverData, ResolvedEntries, type ResolverData } from '../featureResolver'
import { loadFeatGrantedSpells, type FeatGrantedSpell } from '../spells/featSpells'
import { loadSpellDetails, type SpellDetail } from '../spells/spellDetailData'
import { loadSpellSlotsClassData } from '../spells/spellSlotsClassData'
import { loadSubclassAlwaysPreparedSpells, type AlwaysPreparedSpell } from '../spells/subclassPreparedSpells'
import { loadSubclassChosenSpells } from '../spells/subclassSpellChoiceData'
import {
	loadFeatEffectEntries,
	loadFeatTextEntries,
	loadHitDiceClassData,
	loadSavingThrowClassData,
	loadSpeciesTraitsData,
	loadSpellcastingAbilityClassData,
	loadSubclassSource,
	type FeatTextEntry,
} from './sheetData'
import { combineSpellEntries, SpellList } from './SpellList'
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
	const [spellcastingAbilityData, setSpellcastingAbilityData] = useState<ClassSpellcastingAbility[] | null>(null)
	const [spellSlotsClassData, setSpellSlotsClassData] = useState<ClassSpellSlotsData[] | null>(null)
	const [spellDetails, setSpellDetails] = useState<SpellDetail[] | null>(null)
	const [loadError, setLoadError] = useState<string | null>(null)

	/** One entry per class carrying a subclass — resolved and fetched separately from the main load (it depends on `character`, not just static data), starts empty rather than blocking the rest of the sheet on the D46-style subclass source resolution (sheetData.ts). */
	const [subclassSpellInfo, setSubclassSpellInfo] = useState<{ subclassName: string; alwaysPrepared: AlwaysPreparedSpell[] }[]>([])
	/** Fixed feat-granted spells (d5a) — depends on `character.featAsiChoices`, fetched separately from the main load same as subclassSpellInfo. */
	const [featSpells, setFeatSpells] = useState<FeatGrantedSpell[]>([])

	useEffect(() => {
		let cancelled = false
		Promise.all([
			loadSavingThrowClassData(),
			loadHitDiceClassData(),
			loadSpeciesTraitsData(),
			loadFeatEffectEntries(),
			loadFeatTextEntries(),
			loadResolverData(),
			loadSpellcastingAbilityClassData(),
			loadSpellSlotsClassData(),
			loadSpellDetails(),
		])
			.then(([classData, hitDiceData, speciesData, featData, featTexts, resolver, spellcastingData, spellSlotsData, spellDetailData]) => {
				if (cancelled) return
				setSavingThrowClassData(classData)
				setHitDiceClassData(hitDiceData)
				setSpeciesTraitsData(speciesData)
				setFeats(featData)
				setFeatTextEntries(featTexts)
				setResolverData(resolver)
				setSpellcastingAbilityData(spellcastingData)
				setSpellSlotsClassData(spellSlotsData)
				setSpellDetails(spellDetailData)
			})
			.catch((error: unknown) => {
				if (cancelled) return
				setLoadError(error instanceof Error ? error.message : String(error))
			})
		return () => {
			cancelled = true
		}
	}, [])

	useEffect(() => {
		let cancelled = false
		const classesWithSubclass = character.classes.filter((c): c is typeof c & { subclass: string } => c.subclass !== null)
		if (classesWithSubclass.length === 0) {
			setSubclassSpellInfo([])
			return
		}
		Promise.all(
			classesWithSubclass.map(async (c) => {
				const source = await loadSubclassSource(c.className, c.classSource, c.subclass)
				// Only Warlock's own Pact Magic table applies to a rank-keyed patron grant (subclassPreparedSpells.ts) — any other class's table would be the wrong shape's numbers entirely.
				// spellSlotsClassData loads in parallel via a separate effect — undefined here on an early run just means no rank grant yet; this effect re-runs (dep below) once it's in, same as any other race in this file.
				const pactSlotsByLevel = spellSlotsClassData?.find((d) => d.className === c.className && d.classSource === c.classSource)?.pactSlotsByLevel ?? undefined
				const alwaysPrepared = source ? await loadSubclassAlwaysPreparedSpells(c.subclass, source, c.className, c.classSource, c.level, pactSlotsByLevel) : []
				/** The subclass filter-choice spell picker's own picks (d6b) — same "always prepared (subclass)" provenance label as the fixed grants above, merged into the same group rather than a separate one (CharacterSheet.tsx module comment, SpellList.tsx). */
				const matchingChoices = (character.subclassSpellChoices ?? []).filter(
					(choice) => choice.className === c.className && choice.classSource === c.classSource && choice.subclassName === c.subclass && choice.subclassSource === source,
				)
				const chosen = matchingChoices.length > 0 ? await loadSubclassChosenSpells(matchingChoices) : []
				return { subclassName: c.subclass, alwaysPrepared: [...alwaysPrepared, ...chosen] }
			}),
		).then((infos) => {
			if (!cancelled) setSubclassSpellInfo(infos)
		})
		return () => {
			cancelled = true
		}
	}, [character, spellSlotsClassData])

	useEffect(() => {
		let cancelled = false
		loadFeatGrantedSpells(character).then((spells) => {
			if (!cancelled) setFeatSpells(spells)
		})
		return () => {
			cancelled = true
		}
	}, [character])

	if (loadError) {
		return (
			<article className="sheet">
				<p className="error">Could not load the data this sheet needs: {loadError}</p>
			</article>
		)
	}

	if (
		!savingThrowClassData ||
		!hitDiceClassData ||
		!speciesTraitsData ||
		!feats ||
		!featTextEntries ||
		!resolverData ||
		!spellcastingAbilityData ||
		!spellSlotsClassData ||
		!spellDetails
	) {
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

	const spellcasting = computeSpellcasting(character, spellcastingAbilityData, feats)
	const spellcastingEntries = spellcasting.status === 'known' ? spellcasting.value : []
	const spellSlots = computeSpellSlots(character, spellSlotsClassData)
	const spellSlotsEntries = spellSlots.status === 'known' ? spellSlots.value : []
	// D46-style: a class with no spellcasting ability (spellcasting.ts) but slots via a subclass table (spellSlots.ts's EK/AT fallback) still counts as a caster for section visibility, even though its attack/DC entry is empty — see docs/REPORT.md.
	const isCaster = spellcastingEntries.length > 0 || spellSlotsEntries.length > 0
	const combinedSpells = combineSpellEntries(
		character.spellChoices ?? [],
		subclassSpellInfo.map((info) => ({ subclassName: info.subclassName, spells: info.alwaysPrepared })),
		featSpells,
	)

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

			{isCaster && (
				<>
					{spellcastingEntries.length > 0 && (
						<section className="sheet__spell-attacks">
							<h2>Spellcasting</h2>
							<ul>
								{spellcastingEntries.map((entry) => (
									<li key={`${entry.className}|${entry.classSource}`}>
										<h3>
											{entry.className} ({ABILITY_LABELS[entry.ability]})
										</h3>
										<p>
											Spell attack bonus: <span>{formatModifier(entry.spellAttackBonus)}</span>{' '}
											<ValueBreakdown breakdown={entry.spellAttackBreakdown} />
										</p>
										<p>
											Spell save DC: <span>{entry.spellSaveDC}</span> <ValueBreakdown breakdown={entry.spellSaveDCBreakdown} />
										</p>
									</li>
								))}
							</ul>
						</section>
					)}

					{spellSlotsEntries.length > 0 && (
						<section className="sheet__spell-slots">
							<h2>Spell slots</h2>
							<ul>
								{spellSlotsEntries.map((entry) => (
									<li key={`${entry.className}|${entry.classSource}`}>
										<h3>{entry.className}</h3>
										{entry.ordinarySlots && (
											<>
												<ul>
													{entry.ordinarySlots.map(
														(count, index) => count > 0 && <li key={index}>Level {index + 1}: {count}</li>,
													)}
												</ul>
												<ValueBreakdown breakdown={entry.ordinarySlotsBreakdown ?? []} />
											</>
										)}
										{entry.pactSlots && (
											<p>
												Pact Magic: {entry.pactSlots.count} slot{entry.pactSlots.count === 1 ? '' : 's'} (level {entry.pactSlots.slotLevel})
												<ValueBreakdown breakdown={entry.pactSlotsBreakdown ?? []} />
											</p>
										)}
									</li>
								))}
							</ul>
						</section>
					)}
				</>
			)}

			{combinedSpells.length > 0 && (
				<section className="sheet__spells">
					<h2>Spells</h2>
					<SpellList entries={combinedSpells} spellDetails={spellDetails} resolverData={resolverData} />
				</section>
			)}
		</article>
	)
}

export default CharacterSheet
