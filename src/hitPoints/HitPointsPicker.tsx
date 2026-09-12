import { useEffect, useState, type ReactNode } from 'react'
import { computeHitDicePool, type ClassHitDie } from '../calculation/hitDice'
import { computeMaxHitPoints, fixedAverage } from '../calculation/maxHitPoints'
import type { FeatEffectEntry } from '../calculation/featEffects'
import { loadFeatEffectEntries, loadHitDiceClassData } from '../sheet/sheetData'
import { loadGrantedClassFeatures } from '../sheet/grantedClassFeatures'
import { loadSpeciesTraitNames } from '../sheet/speciesTraitNames'
import { CalculatedNumber } from '../sheet/calculatedValue'
import type { Character, CharacterHitPointLevel, HitPointLevelKind } from '../storage/character'

/*
 * Hit points wizard step (build order step 8, slice 8b). Level 1 is never
 * shown here — the wizard hides the whole step at level 1 (D92) — so this
 * component only ever renders levels 2 and up, plus a read-only level-1 row
 * so the running total visibly adds up.
 *
 * The running total is computeMaxHitPoints itself, called against a draft
 * Character carrying the in-progress picks — never a second sum written here
 * (task instructions): two implementations of one number would drift.
 * bonusFeatureNames/feats are loaded the same way the sheet header loads them
 * (D91-94), so the total shown here matches what the header will show for the
 * same character once saved.
 */

interface LoadedData {
	classData: ClassHitDie[]
	feats: FeatEffectEntry[]
	bonusFeatureNames: string[]
}

function rollDie(faces: number): number {
	return Math.floor(Math.random() * faces) + 1
}

export function HitPointsPicker({
	character,
	value,
	onChange,
	levelUpLevel,
}: {
	/** A draft Character carrying classes (single class, D11), species and featAsiChoices — everything computeMaxHitPoints and its bonus-feature lookup need. */
	character: Character
	value: CharacterHitPointLevel[]
	onChange: (levels: CharacterHitPointLevel[]) => void
	/**
	 * Slice 8d5: set during a LEVEL-UP walk to the level being gained. The step
	 * then shows and asks about that one level only — every level below it is
	 * left exactly as stored, D92 defaults included (D103) — and the
	 * apply-to-every-level control is hidden, since it has nothing to apply to
	 * beyond the one row shown. `undefined` in creation and edit walks, which
	 * still show every level from 2 up.
	 */
	levelUpLevel?: number
}): ReactNode {
	const [loaded, setLoaded] = useState<LoadedData | null>(null)
	const [loadError, setLoadError] = useState<string | null>(null)

	useEffect(() => {
		let cancelled = false
		Promise.all([loadHitDiceClassData(), loadFeatEffectEntries(), loadGrantedClassFeatures(character), loadSpeciesTraitNames(character)])
			.then(([classData, feats, grantedFeatures, speciesTraitNames]) => {
				if (cancelled) return
				const chosenFeats = (character.featAsiChoices ?? []).filter((choice) => choice.kind === 'feat')
				setLoaded({
					classData,
					feats,
					bonusFeatureNames: [...grantedFeatures.map((feature) => feature.name), ...chosenFeats.map((choice) => choice.name), ...speciesTraitNames],
				})
			})
			.catch((error: unknown) => {
				if (!cancelled) setLoadError(error instanceof Error ? error.message : String(error))
			})
		return () => {
			cancelled = true
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the class/species/feat identity via the parent's own draft-character rebuild, not on every keystroke.
	}, [character.classes[0]?.className, character.classes[0]?.classSource, character.classes[0]?.level, character.species?.name, character.featAsiChoices])

	if (loadError) return <p className="error">Could not load hit points: {loadError}</p>
	if (!loaded) return <p>Loading…</p>

	const pool = computeHitDicePool(character.classes, loaded.classData)
	if (pool.status === 'unknown') return <p className="error">Could not determine your hit die: {pool.reason}</p>
	if (pool.value.length > 1) return <p className="error">Hit points across more than one class is build order step 10 (multiclass).</p>

	const { faces, count: totalLevel } = pool.value[0]

	function setLevel(level: number, kind: HitPointLevelKind, dieResult: number): void {
		onChange([...value.filter((entry) => entry.level !== level), { level, kind, dieResult }])
	}

	function applyAverageToAll(): void {
		const average = fixedAverage(faces)
		const levels: CharacterHitPointLevel[] = []
		for (let level = 2; level <= totalLevel; level++) levels.push({ level, kind: 'average', dieResult: average })
		onChange(levels)
	}

	const draftCharacter: Character = { ...character, hitPointLevels: value }
	const maxHitPoints = computeMaxHitPoints(draftCharacter, loaded.classData, loaded.bonusFeatureNames, loaded.feats)

	return (
		<div className="hit-points-picker">
			{/* A div, not a p: CalculatedNumber renders a <details>, which is not valid inside a paragraph. */}
			<div className="hit-points-picker__running-total">
				Maximum hit points: <CalculatedNumber result={maxHitPoints} />
			</div>
			{levelUpLevel === undefined && (
				<button type="button" onClick={applyAverageToAll}>
					Use the average ({fixedAverage(faces)}) for every level
				</button>
			)}
			<table className="hit-points-picker__table">
				<thead>
					<tr>
						<th>Level</th>
						<th>Result</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>Level 1</td>
						<td>{faces} (maximum)</td>
					</tr>
					{(levelUpLevel !== undefined
						? [levelUpLevel]
						: Array.from({ length: Math.max(0, totalLevel - 1) }, (_, index) => index + 2)
					).map((level) => {
						const entry = value.find((candidate) => candidate.level === level)
						const groupName = `hit-points-picker__level-${level}`
						return (
							<tr key={level}>
								<td>Level {level}</td>
								<td>
									<label>
										<input
											type="radio"
											name={groupName}
											checked={entry?.kind === 'average'}
											onChange={() => setLevel(level, 'average', fixedAverage(faces))}
										/>
										Average ({fixedAverage(faces)})
									</label>
									<label>
										<input
											type="radio"
											name={groupName}
											checked={entry?.kind === 'roll'}
											onChange={() => setLevel(level, 'roll', rollDie(faces))}
										/>
										Roll (d{faces})
									</label>
									{entry?.kind === 'roll' && (
										<>
											<span>{entry.dieResult}</span>
											<button type="button" onClick={() => setLevel(level, 'roll', rollDie(faces))}>
												Reroll
											</button>
										</>
									)}
									<label>
										<input
											type="radio"
											name={groupName}
											checked={entry?.kind === 'manual'}
											onChange={() => setLevel(level, 'manual', entry?.kind === 'manual' ? entry.dieResult : 0)}
										/>
										Enter manually
									</label>
									{entry?.kind === 'manual' && (
										<input
											type="number"
											aria-label={`Level ${level} manual result`}
											value={entry.dieResult}
											onChange={(event) => setLevel(level, 'manual', Number(event.target.value))}
										/>
									)}
								</td>
							</tr>
						)
					})}
				</tbody>
			</table>
		</div>
	)
}
