import { useEffect, useState, type ReactNode } from 'react'
import {
	ABILITIES,
	POINT_BUY_BUDGET,
	POINT_BUY_MAX,
	POINT_BUY_MIN,
	STANDARD_ARRAY,
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

/*
 * Character creation, ability scores slice (PHASE1.md build order step 3,
 * section A.3). Lets the player pick one of the three methods and produces
 * the final six scores. Does NOT apply the background ability bonus (no
 * background exists yet) and does NOT compute modifiers — both are later
 * steps.
 */

const ABILITY_LABELS: Record<Ability, string> = {
	strength: 'Strength',
	dexterity: 'Dexterity',
	constitution: 'Constitution',
	intelligence: 'Intelligence',
	wisdom: 'Wisdom',
	charisma: 'Charisma',
}

function emptyAssignment(): Record<Ability, number | null> {
	return { strength: null, dexterity: null, constitution: null, intelligence: null, wisdom: null, charisma: null }
}

function isComplete(assignment: Record<Ability, number | null>): assignment is Record<Ability, number> {
	return ABILITIES.every((ability) => assignment[ability] !== null)
}

/**
 * Reconstructs a ValuePoolAssigner's ability->slot-index assignment from a
 * previously reported result, so a remounted picker can redisplay a choice
 * the wizard already has instead of showing blank selects. Matches each
 * ability's stored score to the first not-yet-used pool slot with that
 * value, in ability order — exact for the standard array (no duplicate
 * values) and a reasonable best effort for rolled sets (duplicate totals
 * are possible there).
 */
function reconstructAssignment(values: number[], scores: AbilityScores | undefined): Record<Ability, number | null> {
	const assignment = emptyAssignment()
	if (!scores) return assignment
	const used = new Set<number>()
	for (const ability of ABILITIES) {
		const target = scores[ability]
		const slot = values.findIndex((value, index) => value === target && !used.has(index))
		if (slot !== -1) {
			assignment[ability] = slot
			used.add(slot)
		}
	}
	return assignment
}

/** Assigns a fixed pool of values (standard array values, or rolled totals) to the six abilities, each slot used once. */
function ValuePoolAssigner({
	values,
	assignment,
	onAssign,
	describeValue,
}: {
	values: number[]
	assignment: Record<Ability, number | null>
	onAssign: (ability: Ability, slotIndex: number | null) => void
	describeValue?: (value: number, index: number) => string
}): ReactNode {
	const usedSlots = new Set(
		ABILITIES.map((ability) => assignment[ability]).filter((slot): slot is number => slot !== null),
	)

	return (
		<div className="ability-picker__grid">
			{ABILITIES.map((ability) => {
				const currentSlot = assignment[ability]
				return (
					<label key={ability} className="ability-picker__row">
						{ABILITY_LABELS[ability]}
						<select
							value={currentSlot ?? ''}
							onChange={(event) => {
								const raw = event.target.value
								onAssign(ability, raw === '' ? null : Number(raw))
							}}
						>
							<option value="">Choose…</option>
							{values.map((value, index) => {
								if (usedSlots.has(index) && index !== currentSlot) return null
								return (
									<option key={index} value={index}>
										{describeValue ? describeValue(value, index) : value}
									</option>
								)
							})}
						</select>
					</label>
				)
			})}
		</div>
	)
}

function StandardArrayMethod({
	value,
	onResult,
}: {
	value: CharacterAbilityScores | null
	onResult: (result: CharacterAbilityScores | null) => void
}): ReactNode {
	const [assignment, setAssignment] = useState<Record<Ability, number | null>>(() =>
		reconstructAssignment([...STANDARD_ARRAY], value?.method === 'standardArray' ? value.scores : undefined),
	)

	function handleAssign(ability: Ability, slotIndex: number | null): void {
		const next = { ...assignment, [ability]: slotIndex }
		setAssignment(next)
		if (isComplete(next)) {
			const scores = Object.fromEntries(ABILITIES.map((a) => [a, STANDARD_ARRAY[next[a]]])) as AbilityScores
			onResult(usesStandardArrayExactly(scores) ? { method: 'standardArray', scores } : null)
		} else {
			onResult(null)
		}
	}

	return (
		<div>
			<p className="ability-picker__hint">Assign each value to one ability. Every value is used exactly once.</p>
			<ValuePoolAssigner values={[...STANDARD_ARRAY]} assignment={assignment} onAssign={handleAssign} />
		</div>
	)
}

function PointBuyMethod({
	value,
	onResult,
}: {
	value: CharacterAbilityScores | null
	onResult: (result: CharacterAbilityScores | null) => void
}): ReactNode {
	const [scores, setScores] = useState<AbilityScores>(
		value?.method === 'pointBuy'
			? value.scores
			: {
					strength: POINT_BUY_MIN,
					dexterity: POINT_BUY_MIN,
					constitution: POINT_BUY_MIN,
					intelligence: POINT_BUY_MIN,
					wisdom: POINT_BUY_MIN,
					charisma: POINT_BUY_MIN,
				},
	)

	const spent = pointBuyTotal(scores)
	const remaining = POINT_BUY_BUDGET - spent

	function adjust(ability: Ability, delta: 1 | -1): void {
		const nextScore = scores[ability] + delta
		if (nextScore < POINT_BUY_MIN || nextScore > POINT_BUY_MAX) return
		const nextScores = { ...scores, [ability]: nextScore }
		if (pointBuyTotal(nextScores) > POINT_BUY_BUDGET) return
		setScores(nextScores)
		onResult({ method: 'pointBuy', scores: nextScores })
	}

	// Report the initial (all-8) state once so the parent has a value even before any adjustment.
	useEffect(() => {
		onResult({ method: 'pointBuy', scores: { ...scores } })
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	return (
		<div>
			<p className="ability-picker__hint">
				{remaining} of {POINT_BUY_BUDGET} points remaining.
			</p>
			<div className="ability-picker__grid">
				{ABILITIES.map((ability) => {
					const score = scores[ability]
					const nextStepCost = score < POINT_BUY_MAX ? pointBuyCost(score + 1) - pointBuyCost(score) : null
					return (
						<div key={ability} className="ability-picker__row">
							<span>{ABILITY_LABELS[ability]}</span>
							<button type="button" onClick={() => adjust(ability, -1)} disabled={score <= POINT_BUY_MIN}>
								−
							</button>
							<span className="ability-picker__score">{score}</span>
							<button
								type="button"
								onClick={() => adjust(ability, 1)}
								disabled={score >= POINT_BUY_MAX || (nextStepCost !== null && nextStepCost > remaining)}
							>
								+
							</button>
							{nextStepCost !== null && <span className="ability-picker__cost">next step costs {nextStepCost}</span>}
						</div>
					)
				})}
			</div>
		</div>
	)
}

function RollMethod({
	value,
	onResult,
}: {
	value: CharacterAbilityScores | null
	onResult: (result: CharacterAbilityScores | null) => void
}): ReactNode {
	const priorRoll = value?.method === 'roll' ? value : null
	const [entryMode, setEntryMode] = useState<'roll' | 'manual'>(
		priorRoll && !priorRoll.rolledSets ? 'manual' : 'roll',
	)
	const [rolledSets, setRolledSets] = useState<RolledSet[] | null>(priorRoll?.rolledSets ?? null)
	const [assignment, setAssignment] = useState<Record<Ability, number | null>>(() =>
		priorRoll?.rolledSets
			? reconstructAssignment(
					priorRoll.rolledSets.map((set) => set.total),
					priorRoll.scores,
				)
			: emptyAssignment(),
	)
	const [manualScores, setManualScores] = useState<Record<Ability, string>>(() => {
		if (priorRoll && !priorRoll.rolledSets) {
			return Object.fromEntries(ABILITIES.map((a) => [a, String(priorRoll.scores[a])])) as Record<Ability, string>
		}
		return { strength: '', dexterity: '', constitution: '', intelligence: '', wisdom: '', charisma: '' }
	})

	function handleRoll(): void {
		setRolledSets(rollSixAbilityScores(randomDie))
		setAssignment(emptyAssignment())
		onResult(null)
	}

	function handleAssign(ability: Ability, slotIndex: number | null): void {
		const next = { ...assignment, [ability]: slotIndex }
		setAssignment(next)
		if (rolledSets && isComplete(next)) {
			const scores = Object.fromEntries(ABILITIES.map((a) => [a, rolledSets[next[a]].total])) as AbilityScores
			onResult({ method: 'roll', scores, rolledSets })
		} else {
			onResult(null)
		}
	}

	function handleManualChange(ability: Ability, raw: string): void {
		const next = { ...manualScores, [ability]: raw }
		setManualScores(next)
		const parsed = Object.fromEntries(
			ABILITIES.map((a) => [a, next[a].trim() === '' ? NaN : Number(next[a])]),
		) as AbilityScores
		const allValid = ABILITIES.every(
			(a) => Number.isInteger(parsed[a]) && parsed[a] >= 3 && parsed[a] <= 18,
		)
		onResult(allValid ? { method: 'roll', scores: parsed } : null)
	}

	return (
		<div>
			<div className="ability-picker__mode-toggle">
				<label>
					<input
						type="radio"
						checked={entryMode === 'roll'}
						onChange={() => {
							setEntryMode('roll')
							onResult(null)
						}}
					/>
					Roll for me
				</label>
				<label>
					<input
						type="radio"
						checked={entryMode === 'manual'}
						onChange={() => {
							setEntryMode('manual')
							onResult(null)
						}}
					/>
					Enter physical dice results
				</label>
			</div>

			{entryMode === 'roll' ? (
				<div>
					<button type="button" onClick={handleRoll}>
						Roll 6 sets of 4d6
					</button>
					{rolledSets && (
						<>
							<ul className="ability-picker__rolls">
								{rolledSets.map((set, index) => (
									<li key={index}>
										Set {index + 1}: [{set.dice.join(', ')}] → {set.total}
									</li>
								))}
							</ul>
							<ValuePoolAssigner
								values={rolledSets.map((s) => s.total)}
								assignment={assignment}
								onAssign={handleAssign}
								describeValue={(value, index) => `Set ${index + 1}: ${value}`}
							/>
						</>
					)}
				</div>
			) : (
				<div className="ability-picker__grid">
					{ABILITIES.map((ability) => (
						<label key={ability} className="ability-picker__row">
							{ABILITY_LABELS[ability]}
							<input
								type="number"
								min={3}
								max={18}
								value={manualScores[ability]}
								onChange={(event) => handleManualChange(ability, event.target.value)}
							/>
						</label>
					))}
				</div>
			)}
		</div>
	)
}

/**
 * Lets the player pick one of the three ability score methods and produces
 * the raw six scores. Displays `value` — the result as the caller currently
 * has it — and reports every change upward via `onChange`, matching
 * ClassPicker: the caller owns the selection, so it survives this component
 * (and the per-method sub-components) unmounting and remounting.
 */
export function AbilityScorePicker({
	value,
	onChange,
}: {
	value: CharacterAbilityScores | null
	onChange: (result: CharacterAbilityScores | null) => void
}): ReactNode {
	const [method, setMethod] = useState<AbilityScoreMethod>(value?.method ?? 'standardArray')

	function selectMethod(next: AbilityScoreMethod): void {
		setMethod(next)
		onChange(null)
	}

	return (
		<div className="ability-picker">
			<div className="ability-picker__method-toggle">
				<label>
					<input type="radio" checked={method === 'standardArray'} onChange={() => selectMethod('standardArray')} />
					Standard array
				</label>
				<label>
					<input type="radio" checked={method === 'pointBuy'} onChange={() => selectMethod('pointBuy')} />
					Point buy
				</label>
				<label>
					<input type="radio" checked={method === 'roll'} onChange={() => selectMethod('roll')} />
					Roll
				</label>
			</div>

			{method === 'standardArray' && <StandardArrayMethod value={value} onResult={onChange} />}
			{method === 'pointBuy' && <PointBuyMethod value={value} onResult={onChange} />}
			{method === 'roll' && <RollMethod value={value} onResult={onChange} />}
		</div>
	)
}
