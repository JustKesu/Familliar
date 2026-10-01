import { useEffect, useState, type ReactNode } from 'react'
import { computeHitDicePool, type ClassHitDie } from '../calculation/hitDice'
import { computeMaxHitPoints, fixedAverage } from '../calculation/maxHitPoints'
import { characterFeats, type FeatEffectEntry } from '../calculation/featEffects'
import type { ItemAbilityGrant } from '../calculation/itemAbilityScores'
import type { Contribution } from '../calculation/types'
import { loadItemMaxHpBonuses } from './hpDefault'
import { loadFeatEffectEntries, loadHitDiceClassData } from '../sheet/sheetData'
import { loadGrantedClassFeatures } from '../sheet/grantedClassFeatures'
import { loadSpeciesTraitNames } from '../sheet/speciesTraitNames'
import { UnresolvedValue, ValueBreakdown } from '../sheet/ValueBreakdown'
import { HitPointLevelRow } from './HitPointLevelRow'
import { isValidHitPointEntry } from './hitPointEntry'
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
	/** R14b: the character's item max-HP bonuses, so the total matches the sheet's. */
	itemBonuses: Contribution[]
	/** D221: attuned Constitution items, for the same reason. */
	itemAbilityGrants: ItemAbilityGrant[]
}

export function HitPointsPicker({
	character,
	value,
	onChange,
	levelUpLevel,
}: {
	/** A draft Character carrying classes (single class, D11), species, background and featAsiChoices — everything computeMaxHitPoints and its bonus-feature lookup need. */
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
		Promise.all([loadHitDiceClassData(), loadFeatEffectEntries(), loadGrantedClassFeatures(character), loadSpeciesTraitNames(character), loadItemMaxHpBonuses(character)])
			.then(([classData, feats, grantedFeatures, speciesTraitNames, { itemBonuses, itemAbilityGrants }]) => {
				if (cancelled) return
				setLoaded({
					classData,
					feats,
					bonusFeatureNames: [...grantedFeatures.map((feature) => feature.name), ...characterFeats(character, feats).map((choice) => choice.name), ...speciesTraitNames],
					itemBonuses,
					itemAbilityGrants,
				})
			})
			.catch((error: unknown) => {
				if (!cancelled) setLoadError(error instanceof Error ? error.message : String(error))
			})
		return () => {
			cancelled = true
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the class/species/feat identity via the parent's own draft-character rebuild, not on every keystroke.
	}, [
		character.classes[0]?.className,
		character.classes[0]?.classSource,
		character.classes[0]?.level,
		character.species?.name,
		character.background?.name,
		character.background?.source,
		character.featAsiChoices,
		character.inventory,
	])

	if (loadError) return <p className="error">Could not load hit points: {loadError}</p>
	if (!loaded) return <p>Loading…</p>

	const pool = computeHitDicePool(character.classes, loaded.classData)
	if (pool.status === 'unknown') return <p className="error">Could not determine your hit die: {pool.reason}</p>
	if (pool.value.length > 1) return <p className="error">Hit points across more than one class is build order step 10 (multiclass).</p>

	const { faces, count: totalLevel } = pool.value[0]

	function setLevel(level: number, kind: HitPointLevelKind, dieResult: number): void {
		onChange([...value.filter((entry) => entry.level !== level), { level, kind, dieResult }].sort((a, b) => a.level - b.level))
	}

	function applyAverageToAll(): void {
		const average = fixedAverage(faces)
		const levels: CharacterHitPointLevel[] = []
		for (let level = 2; level <= totalLevel; level++) levels.push({ level, kind: 'average', dieResult: average })
		onChange(levels)
	}

	const levels = levelUpLevel !== undefined ? [levelUpLevel] : Array.from({ length: Math.max(0, totalLevel - 1) }, (_, index) => index + 2)
	// An invalid row (empty Manual, legacy value) must not feed the total: it is left out, so the breakdown shows it as "no choice recorded".
	const isUnset = (entry: CharacterHitPointLevel): boolean => levels.includes(entry.level) && !isValidHitPointEntry(entry, faces)
	const anyUnset = value.some(isUnset)
	const draftCharacter: Character = { ...character, hitPointLevels: value.filter((entry) => !isUnset(entry)) }
	const maxHitPoints = computeMaxHitPoints(draftCharacter, loaded.classData, loaded.bonusFeatureNames, loaded.feats, loaded.itemBonuses, loaded.itemAbilityGrants)

	return (
		<div className="hit-points-picker">
			{/* A div, not a p: ValueBreakdown renders a <details>, which is not valid inside a paragraph. */}
			<div className="hit-points-picker__running-total" data-testid="hit-points-running-total">
				<div className="hit-points-picker__max">
					<span className="hit-points-picker__label">Maximum hit points</span>
					{maxHitPoints.status === 'unknown' ? <UnresolvedValue reason={maxHitPoints.reason} /> : <span className="hit-points-picker__number" data-testid="hit-points-max">{anyUnset ? '—' : maxHitPoints.value}</span>}
				</div>
				{maxHitPoints.status === 'known' && <ValueBreakdown breakdown={maxHitPoints.breakdown} open />}
			</div>
			{levelUpLevel === undefined && (
				<button type="button" className="btn--accent-outline hit-points-picker__average-all" onClick={applyAverageToAll}>
					Use the average for every level
				</button>
			)}
			<div className="hit-points-picker__scroll">
				<table className="hit-points-picker__table">
					<thead>
						<tr>
							<th scope="col">Level</th>
							<th scope="col">Method</th>
							<th scope="col">Result</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td className="hit-points-picker__level">Level 1</td>
							<td>Maximum die (d{faces})</td>
							<td className="hit-points-picker__result">
								<span className="hit-points-picker__value">{faces}</span>
							</td>
						</tr>
						{levels.map((level) => (
							<HitPointLevelRow key={level} level={level} faces={faces} entry={value.find((candidate) => candidate.level === level)} onSet={setLevel} />
						))}
					</tbody>
				</table>
			</div>
		</div>
	)
}
