import { useEffect, useState, type ReactNode } from 'react'
import { ABILITIES, type Ability } from '../abilities/abilityScores'
import type { FeatAsiChoice } from '../storage/character'
import {
	evaluateFeatPrerequisites,
	exceedsAbilityScoreCap,
	featAbilityChoiceOptions,
	isValidAbilityIncrease,
	loadClassPrereqInfo,
	loadFeatAsiGrants,
	loadFeats,
	loadHasFightingStyleFeature,
	loadSpeciesPrereqInfo,
	type ChosenFeatRef,
	type FeatAsiGrant,
	type FeatEntry,
	type PrerequisiteContext,
} from './featAsiData'

/*
 * Feat/ASI picker (build order step 4a). One sub-panel per level that
 * grants a choice (D19/D20): the player picks ASI-or-feat FIRST, then sees
 * only the options for whichever they picked (task instructions, point 3).
 *
 * Mirrors ExpertisePicker/D8: state lives in the wizard (`value`), this
 * component only displays it and reports changes upward. Renders nothing
 * when the class has no grant by `level`.
 */

const ABILITY_LABEL: Record<Ability, string> = {
	strength: 'Strength',
	dexterity: 'Dexterity',
	constitution: 'Constitution',
	intelligence: 'Intelligence',
	wisdom: 'Wisdom',
	charisma: 'Charisma',
}

type LoadState =
	| { status: 'loading' }
	| { status: 'error'; message: string }
	| {
			status: 'ready'
			grants: FeatAsiGrant[]
			feats: FeatEntry[]
			armorProficiencies: string[]
			weaponProficiencies: string[]
			hasSpellcasting: boolean
			hasFightingStyleFeature: boolean
			speciesRaceTags: string[]
			speciesSize: string | null
	  }

export function FeatAsiPicker({
	className,
	classSource,
	level,
	finalAbilityScores,
	speciesName,
	speciesSource,
	value,
	onChange,
}: {
	className: string
	classSource: string
	level: number
	/** FINAL ability scores (base + background bonus) from the calculation layer — D16/D17. Never combined here with a session ASI pick (see featAsiData.ts module doc). */
	finalAbilityScores: Partial<Record<Ability, number>>
	speciesName: string | null
	speciesSource: string | null
	value: FeatAsiChoice[]
	onChange: (choices: FeatAsiChoice[]) => void
}): ReactNode {
	const [state, setState] = useState<LoadState>({ status: 'loading' })

	useEffect(() => {
		let cancelled = false
		setState({ status: 'loading' })
		Promise.all([
			loadFeatAsiGrants(className, classSource, level),
			loadFeats(),
			loadClassPrereqInfo(className, classSource),
			loadHasFightingStyleFeature(className, classSource, level),
			speciesName && speciesSource ? loadSpeciesPrereqInfo(speciesName, speciesSource) : Promise.resolve(null),
		])
			.then(([grants, feats, classInfo, hasFightingStyleFeature, speciesInfo]) => {
				if (cancelled) return
				setState({
					status: 'ready',
					grants,
					feats,
					armorProficiencies: classInfo?.armorProficiencies ?? [],
					weaponProficiencies: classInfo?.weaponProficiencies ?? [],
					hasSpellcasting: classInfo?.hasSpellcasting ?? false,
					hasFightingStyleFeature,
					speciesRaceTags: speciesInfo?.raceTags ?? [],
					speciesSize: speciesInfo?.size ?? null,
				})
			})
			.catch((error: unknown) => {
				if (!cancelled) setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
			})
		return () => {
			cancelled = true
		}
	}, [className, classSource, level, speciesName, speciesSource])

	if (state.status === 'loading') return null
	if (state.status === 'error') {
		return <p className="error">Could not load feats: {state.message}</p>
	}
	if (state.grants.length === 0) return null

	const { grants, feats } = state

	/** Ability scores after applying every ASI picked at an earlier grant (index < `uptoIndex`) — used ONLY for the level-20 cap, never for feat prerequisites (see featAsiData.ts module doc). */
	function runningAbilityScoresForCap(uptoIndex: number): Partial<Record<Ability, number>> {
		const scores = { ...finalAbilityScores }
		for (let i = 0; i < uptoIndex; i++) {
			const choice = value[i]
			if (choice?.kind === 'asi') {
				for (const [ability, amount] of Object.entries(choice.increases)) {
					scores[ability as Ability] = (scores[ability as Ability] ?? 0) + (amount ?? 0)
				}
			}
		}
		return scores
	}

	function chosenFeatsUpto(uptoIndex: number): ChosenFeatRef[] {
		const refs: ChosenFeatRef[] = []
		for (let i = 0; i < uptoIndex; i++) {
			const choice = value[i]
			if (choice?.kind === 'feat') {
				const entry = feats.find((f) => f.name === choice.name && f.source === choice.source)
				refs.push({ name: choice.name, source: choice.source, category: entry?.category ?? '' })
			}
		}
		return refs
	}

	function setChoiceAt(index: number, choice: FeatAsiChoice): void {
		const next = [...value]
		next[index] = choice
		onChange(next.slice(0, grants.length))
	}

	return (
		<div className="feat-asi-picker">
			{grants.map((grant, index) => {
				const current = value[index]
				const runningScores = runningAbilityScoresForCap(index)
				const ctx: PrerequisiteContext = {
					characterLevel: level,
					abilityScores: finalAbilityScores,
					hasFightingStyleFeature: state.hasFightingStyleFeature,
					hasSpellcasting: state.hasSpellcasting,
					armorProficiencies: state.armorProficiencies,
					weaponProficiencies: state.weaponProficiencies,
					speciesName,
					speciesRaceTags: state.speciesRaceTags,
					speciesSize: state.speciesSize,
					chosenFeats: chosenFeatsUpto(index),
				}

				return (
					<fieldset key={grant.level} className="feat-asi-picker__level">
						<legend>
							Level {grant.level}
							{grant.kind === 'epicBoon' ? ' — Epic Boon' : ''}
						</legend>

						<label>
							<input
								type="radio"
								name={`feat-asi-kind-${grant.level}`}
								checked={current?.kind === 'asi'}
								onChange={() => setChoiceAt(index, { level: grant.level, kind: 'asi', increases: {} })}
							/>
							Ability Score Improvement
						</label>
						<label>
							<input
								type="radio"
								name={`feat-asi-kind-${grant.level}`}
								checked={current?.kind === 'feat'}
								onChange={() => setChoiceAt(index, { level: grant.level, kind: 'feat', name: '', source: '' })}
							/>
							Feat
						</label>

						{current?.kind === 'asi' && (
							<AsiSubPicker
								grantLevel={grant.level}
								increases={current.increases}
								currentScores={runningScores}
								onChange={(increases) => setChoiceAt(index, { level: grant.level, kind: 'asi', increases })}
							/>
						)}

						{current?.kind === 'feat' && (
							<FeatSubPicker
								grantLevel={grant.level}
								grantKind={grant.kind}
								feats={feats}
								context={ctx}
								selected={current.name ? { name: current.name, source: current.source, chosenAbility: current.chosenAbility } : null}
								onSelectFeat={(feat) => setChoiceAt(index, { level: grant.level, kind: 'feat', name: feat.name, source: feat.source })}
								onSelectAbility={(ability) =>
									setChoiceAt(index, { level: grant.level, kind: 'feat', name: current.name, source: current.source, chosenAbility: ability })
								}
							/>
						)}
					</fieldset>
				)
			})}
		</div>
	)
}

/** +2 to one ability, or +1 to two — the level-20 cap (D20) disables any option that would exceed it. */
function AsiSubPicker({
	grantLevel,
	increases,
	currentScores,
	onChange,
}: {
	grantLevel: number
	increases: Partial<Record<Ability, number>>
	currentScores: Partial<Record<Ability, number>>
	onChange: (increases: Partial<Record<Ability, number>>) => void
}): ReactNode {
	const mode: 'plusTwo' | 'plusOneTwice' = Object.keys(increases).length === 2 ? 'plusOneTwice' : 'plusTwo'
	const [ability1] = Object.keys(increases)
	const chosenAbilities = Object.keys(increases) as Ability[]

	function wouldExceedCap(ability: Ability, amount: number): boolean {
		return exceedsAbilityScoreCap(currentScores, { [ability]: amount })
	}

	function setPlusTwo(ability: Ability): void {
		const next = { [ability]: 2 }
		if (isValidAbilityIncrease(next) && !wouldExceedCap(ability, 2)) onChange(next)
	}

	function setPlusOne(slot: 0 | 1, ability: Ability): void {
		const others = chosenAbilities.filter((_, i) => i !== slot)
		if (others.includes(ability)) return
		const next: Partial<Record<Ability, number>> = { ...increases }
		const previous = chosenAbilities[slot]
		if (previous) delete next[previous]
		if (wouldExceedCap(ability, 1)) return
		next[ability] = 1
		onChange(next)
	}

	return (
		<div className="feat-asi-picker__asi">
			<label>
				<input type="radio" name={`asi-mode-${grantLevel}`} checked={mode === 'plusTwo'} onChange={() => onChange({})} />
				+2 to one ability
			</label>
			<label>
				<input type="radio" name={`asi-mode-${grantLevel}`} checked={mode === 'plusOneTwice'} onChange={() => onChange({})} />
				+1 to two abilities
			</label>

			{mode === 'plusTwo' ? (
				<select value={ability1 ?? ''} onChange={(event) => setPlusTwo(event.target.value as Ability)}>
					<option value="" disabled>
						Choose an ability
					</option>
					{ABILITIES.map((ability) => (
						<option key={ability} value={ability} disabled={wouldExceedCap(ability, 2)}>
							{ABILITY_LABEL[ability]}
							{wouldExceedCap(ability, 2) ? ' (would exceed 20)' : ''}
						</option>
					))}
				</select>
			) : (
				<>
					{([0, 1] as const).map((slot) => (
						<select key={slot} value={chosenAbilities[slot] ?? ''} onChange={(event) => setPlusOne(slot, event.target.value as Ability)}>
							<option value="" disabled>
								Choose an ability
							</option>
							{ABILITIES.map((ability) => (
								<option
									key={ability}
									value={ability}
									disabled={wouldExceedCap(ability, 1) || (chosenAbilities.includes(ability) && chosenAbilities[slot] !== ability)}
								>
									{ABILITY_LABEL[ability]}
									{wouldExceedCap(ability, 1) ? ' (would exceed 20)' : ''}
								</option>
							))}
						</select>
					))}
				</>
			)}
		</div>
	)
}

/** D19: every feat is listed; ineligible ones stay visible with the reason shown, never hidden. */
function FeatSubPicker({
	grantLevel,
	grantKind,
	feats,
	context,
	selected,
	onSelectFeat,
	onSelectAbility,
}: {
	grantLevel: number
	grantKind: FeatAsiGrant['kind']
	feats: FeatEntry[]
	context: PrerequisiteContext
	selected: { name: string; source: string; chosenAbility?: Ability } | null
	onSelectFeat: (feat: { name: string; source: string }) => void
	onSelectAbility: (ability: Ability) => void
}): ReactNode {
	const evaluated = feats.map((feat) => ({ feat, result: evaluateFeatPrerequisites(feat, context) }))
	// Epic Boon levels show category-EB feats first (the feature's own suggested pool) — still just a sort, D19's "no category filter" is unaffected.
	const sorted =
		grantKind === 'epicBoon'
			? [...evaluated].sort((a, b) => Number(b.feat.category === 'EB') - Number(a.feat.category === 'EB') || a.feat.name.localeCompare(b.feat.name))
			: [...evaluated].sort((a, b) => a.feat.name.localeCompare(b.feat.name))

	const selectedFeat = selected ? feats.find((f) => f.name === selected.name && f.source === selected.source) : undefined
	const abilityOptions = selectedFeat ? featAbilityChoiceOptions(selectedFeat) : null

	return (
		<>
			<ul className="feat-asi-picker__feats" aria-label={`Feats for level ${grantLevel}`}>
				{sorted.map(({ feat, result }) => {
					const isSelected = selected?.name === feat.name && selected.source === feat.source
					return (
						<li key={`${feat.name}|${feat.source}`} className="feat-asi-picker__feat">
							<label>
								<input
									type="radio"
									name={`feat-choice-${grantLevel}`}
									checked={isSelected}
									disabled={!result.eligible}
									onChange={() => onSelectFeat({ name: feat.name, source: feat.source })}
								/>
								{feat.name}
							</label>
							{!result.eligible && (
								<ul className="feat-asi-picker__reasons">
									{result.reasons.map((reason) => (
										<li key={reason}>{reason}</li>
									))}
								</ul>
							)}
						</li>
					)
				})}
			</ul>
			{abilityOptions && (
				<label className="feat-asi-picker__feat-ability">
					Ability
					<select value={selected?.chosenAbility ?? ''} onChange={(event) => onSelectAbility(event.target.value as Ability)}>
						<option value="" disabled>
							Choose an ability
						</option>
						{abilityOptions.map((ability) => (
							<option key={ability} value={ability}>
								{ABILITY_LABEL[ability]}
							</option>
						))}
					</select>
				</label>
			)}
		</>
	)
}
