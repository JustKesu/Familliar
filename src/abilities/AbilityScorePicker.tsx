import { useEffect, useState, type ReactNode } from 'react'
import {
	ABILITIES,
	POINT_BUY_BUDGET,
	POINT_BUY_MAX,
	POINT_BUY_MIN,
	STANDARD_ARRAY,
	assignWithSwap,
	pointBuyCost,
	pointBuyTotal,
	randomDie,
	rollSixAbilityScores,
	usesStandardArrayExactly,
	type Ability,
	type AbilityScoreMethod,
	type AbilityScores,
	type CharacterAbilityScores,
	type RolledSet,
} from './abilityScores'
import { AbilityScoreTable } from './AbilityScoreTable'
import type { AbilityBonusMap } from '../storage/character'

const ABILITY_LABELS: Record<Ability, string> = {
	strength: 'Strength',
	dexterity: 'Dexterity',
	constitution: 'Constitution',
	intelligence: 'Intelligence',
	wisdom: 'Wisdom',
	charisma: 'Charisma',
}

const METHOD_LABELS: Record<AbilityScoreMethod, string> = {
	standardArray: 'Standard Array',
	pointBuy: 'Point Buy',
	roll: 'Manual / Rolled',
}

const MIN_ROLLED = 3
const MAX_ROLLED = 18

type Nullable = Record<Ability, number | null>

function perAbility<T>(make: (ability: Ability) => T): Record<Ability, T> {
	return Object.fromEntries(ABILITIES.map((ability) => [ability, make(ability)])) as Record<Ability, T>
}

interface MethodProps {
	value: CharacterAbilityScores | null
	onResult: (result: CharacterAbilityScores | null) => void
	background: AbilityBonusMap | undefined
}

function StandardArrayMethod({ value, onResult, background }: MethodProps): ReactNode {
	const [scores, setScores] = useState<Nullable>(() => perAbility((a) => (value?.method === 'standardArray' ? value.scores[a] : null)))

	function choose(ability: Ability, score: number | null): void {
		const next = assignWithSwap(scores, ability, score)
		setScores(next)
		const complete = ABILITIES.every((a) => next[a] !== null) && usesStandardArrayExactly(next as AbilityScores)
		onResult(complete ? { method: 'standardArray', scores: next as AbilityScores } : null)
	}

	const inputs = perAbility((ability) => (
		<select
			aria-label={ABILITY_LABELS[ability]}
			className="ability-picker__control"
			value={scores[ability] ?? ''}
			onChange={(event) => choose(ability, event.target.value === '' ? null : Number(event.target.value))}
		>
			<option value="">—</option>
			{STANDARD_ARRAY.map((score) => (
				<option key={score} value={score}>
					{score}
				</option>
			))}
		</select>
	))

	return <AbilityScoreTable base={scores} background={background} inputs={inputs} />
}

function PointBuyMethod({ value, onResult, background }: MethodProps): ReactNode {
	const [scores, setScores] = useState<AbilityScores>(value?.method === 'pointBuy' ? value.scores : perAbility(() => POINT_BUY_MIN))
	const remaining = POINT_BUY_BUDGET - pointBuyTotal(scores)

	// Report the initial (all-8) state once so the parent has a value even before any change.
	useEffect(() => {
		onResult({ method: 'pointBuy', scores: { ...scores } })
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	function choose(ability: Ability, score: number): void {
		const next = { ...scores, [ability]: score }
		if (pointBuyTotal(next) > POINT_BUY_BUDGET) return
		setScores(next)
		onResult({ method: 'pointBuy', scores: next })
	}

	const options = Array.from({ length: POINT_BUY_MAX - POINT_BUY_MIN + 1 }, (_, i) => POINT_BUY_MIN + i)
	const inputs = perAbility((ability) => (
		<select
			aria-label={ABILITY_LABELS[ability]}
			className="ability-picker__control"
			value={scores[ability]}
			onChange={(event) => choose(ability, Number(event.target.value))}
		>
			{options.map((score) => (
				<option key={score} value={score} disabled={pointBuyCost(score) - pointBuyCost(scores[ability]) > remaining}>
					{score} ({pointBuyCost(score)})
				</option>
			))}
		</select>
	))

	return (
		<>
			<p className="ability-picker__budget">
				<span className="ability-picker__label">Points remaining</span>{' '}
				<span data-testid="points-remaining">
					{remaining} / {POINT_BUY_BUDGET}
				</span>
			</p>
			<AbilityScoreTable base={scores} background={background} inputs={inputs} />
		</>
	)
}

/** Which rolled set each ability holds, matched back from saved scores in ability order (duplicate totals take the first free set). */
function reconstructSets(sets: RolledSet[] | undefined, scores: AbilityScores | undefined): Nullable {
	const used = new Set<number>()
	return perAbility((ability) => {
		if (!sets || !scores) return null
		const index = sets.findIndex((set, i) => set.total === scores[ability] && !used.has(i))
		if (index === -1) return null
		used.add(index)
		return index
	})
}

function RollResultCard({
	set,
	index,
	holder,
	onAssign,
}: {
	set: RolledSet
	index: number
	holder: Ability | null
	onAssign: (ability: Ability | null) => void
}): ReactNode {
	const dropped = set.dice.indexOf(Math.min(...set.dice))
	return (
		<li className="ability-roll" aria-label={`Roll result ${index + 1}`}>
			<div className="ability-roll__dice">
				{set.dice.map((die, i) => (
					<span key={i} className={i === dropped ? 'ability-roll__die ability-roll__die--dropped' : 'ability-roll__die'}>
						{die}
					</span>
				))}
			</div>
			<div className="ability-roll__total">{set.total}</div>
			<select
				aria-label={`Assign result ${index + 1}`}
				className="ability-picker__control"
				value={holder ?? ''}
				onChange={(event) => onAssign(event.target.value === '' ? null : (event.target.value as Ability))}
			>
				<option value="">Assign to…</option>
				{ABILITIES.map((ability) => (
					<option key={ability} value={ability}>
						{ABILITY_LABELS[ability]}
					</option>
				))}
			</select>
		</li>
	)
}

function ManualRolledMethod({ value, onResult, background }: MethodProps): ReactNode {
	const prior = value?.method === 'roll' ? value : null
	const [sets, setSets] = useState<RolledSet[] | null>(prior?.rolledSets ?? null)
	const [setFor, setSetFor] = useState<Nullable>(() => reconstructSets(prior?.rolledSets, prior?.scores))
	const [values, setValues] = useState<Record<Ability, string>>(() => perAbility((a) => (prior ? String(prior.scores[a]) : '')))

	function report(nextValues: Record<Ability, string>, nextSets: RolledSet[] | null): void {
		const parsed = perAbility((a) => (nextValues[a].trim() === '' ? NaN : Number(nextValues[a])))
		const valid = ABILITIES.every((a) => Number.isInteger(parsed[a]) && parsed[a] >= MIN_ROLLED && parsed[a] <= MAX_ROLLED)
		onResult(valid ? { method: 'roll', scores: parsed, ...(nextSets ? { rolledSets: nextSets } : {}) } : null)
	}

	function update(nextValues: Record<Ability, string>, nextSetFor: Nullable, nextSets: RolledSet[] | null): void {
		setValues(nextValues)
		setSetFor(nextSetFor)
		setSets(nextSets)
		report(nextValues, nextSets)
	}

	function roll(): void {
		const rolled = rollSixAbilityScores(randomDie)
		update(perAbility((a) => (setFor[a] === null ? values[a] : '')), perAbility(() => null), rolled)
	}

	function assign(index: number, ability: Ability | null): void {
		if (!sets) return
		const holder = ABILITIES.find((a) => setFor[a] === index) ?? null
		if (ability === null) {
			if (holder) update({ ...values, [holder]: '' }, { ...setFor, [holder]: null }, sets)
			return
		}
		const nextValues = { ...values, [ability]: String(sets[index].total) }
		if (holder && holder !== ability) nextValues[holder] = values[ability]
		update(nextValues, assignWithSwap(setFor, ability, index), sets)
	}

	const inputs = perAbility((ability) => (
		<input
			type="number"
			aria-label={ABILITY_LABELS[ability]}
			min={MIN_ROLLED}
			max={MAX_ROLLED}
			className="ability-picker__control"
			value={values[ability]}
			onChange={(event) => update({ ...values, [ability]: event.target.value }, { ...setFor, [ability]: null }, sets)}
		/>
	))

	const base = perAbility((a) => {
		const n = Number(values[a])
		return values[a].trim() !== '' && Number.isInteger(n) && n >= MIN_ROLLED && n <= MAX_ROLLED ? n : null
	})

	return (
		<>
			<div className="ability-picker__roll-bar">
				<button type="button" className="ability-picker__roll" onClick={roll}>
					{sets ? 'Reroll' : 'Roll'}
				</button>
				<span className="ability-picker__hint">
					Type your own dice results ({MIN_ROLLED}–{MAX_ROLLED}) or roll 6 × 4d6, drop the lowest.
				</span>
			</div>
			{sets && (
				<ul className="ability-picker__rolls">
					{sets.map((set, index) => (
						<RollResultCard
							key={index}
							set={set}
							index={index}
							holder={ABILITIES.find((a) => setFor[a] === index) ?? null}
							onAssign={(ability) => assign(index, ability)}
						/>
					))}
				</ul>
			)}
			<AbilityScoreTable base={base} background={background} inputs={inputs} />
		</>
	)
}

/**
 * Displays `value` — the result as the caller currently has it — and reports every change upward via
 * `onChange` (null while incomplete), so the choice survives this component remounting.
 */
export function AbilityScorePicker({
	value,
	onChange,
	background,
}: {
	value: CharacterAbilityScores | null
	onChange: (result: CharacterAbilityScores | null) => void
	background?: AbilityBonusMap
}): ReactNode {
	const [method, setMethod] = useState<AbilityScoreMethod>(value?.method ?? 'standardArray')

	function selectMethod(next: AbilityScoreMethod): void {
		if (next === method) return
		setMethod(next)
		onChange(null)
	}

	const props = { value, onResult: onChange, background }
	return (
		<div className="ability-picker">
			<div className="roll-mode ability-picker__methods" role="group" aria-label="Ability score method">
				{(Object.keys(METHOD_LABELS) as AbilityScoreMethod[]).map((option) => (
					<button
						key={option}
						type="button"
						className={option === method ? 'roll-mode__option roll-mode__option--active' : 'roll-mode__option'}
						aria-pressed={option === method}
						onClick={() => selectMethod(option)}
					>
						{METHOD_LABELS[option]}
					</button>
				))}
			</div>
			{method === 'standardArray' && <StandardArrayMethod {...props} />}
			{method === 'pointBuy' && <PointBuyMethod {...props} />}
			{method === 'roll' && <ManualRolledMethod {...props} />}
		</div>
	)
}
