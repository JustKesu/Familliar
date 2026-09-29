import type { ReactNode } from 'react'
import { ABILITIES, type Ability } from '../abilities/abilityScores'
import type { CustomItemAbilityScore } from '../storage/character'

/** One row as the form holds it: numbers stay text so a half-typed value is not lost (D116). */
export interface AbilityScoreRow {
	ability: Ability | ''
	kind: 'set' | 'add'
	number: string
	max: string
}

const DEFAULT_MAX = '20'

const capitalised = (text: string): string => text[0].toUpperCase() + text.slice(1)

const wholeNumber = (text: string): number | null => (text.trim() !== '' && Number.isInteger(Number(text)) ? Number(text) : null)

const inRange = (n: number | null): n is number => n !== null && n >= 1 && n <= 30

function entryFromRow(row: AbilityScoreRow): CustomItemAbilityScore | null {
	if (row.ability === '') return null
	const number = wholeNumber(row.number)
	if (row.kind === 'set') return inRange(number) ? { ability: row.ability, kind: 'set', value: number } : null
	const max = wholeNumber(row.max)
	return number !== null && number !== 0 && inRange(max) ? { ability: row.ability, kind: 'add', amount: number, max } : null
}

export function abilityScoreRowsFrom(scores: readonly CustomItemAbilityScore[] | undefined): AbilityScoreRow[] {
	return (scores ?? []).map((score) =>
		score.kind === 'set'
			? { ability: score.ability, kind: 'set', number: String(score.value), max: DEFAULT_MAX }
			: { ability: score.ability, kind: 'add', number: String(score.amount), max: String(score.max) },
	)
}

export const abilityScoreRowsIncomplete = (rows: readonly AbilityScoreRow[]): boolean => rows.some((row) => entryFromRow(row) === null)

export function abilityScoresFromRows(rows: readonly AbilityScoreRow[]): CustomItemAbilityScore[] {
	return rows.flatMap((row) => entryFromRow(row) ?? [])
}

/** R14e2 (D222): scores the custom item sets or raises; the calculation is D221's. */
export function CustomItemAbilityScoreList({ rows, onChange }: { rows: readonly AbilityScoreRow[]; onChange: (rows: AbilityScoreRow[]) => void }): ReactNode {
	function change(index: number, patch: Partial<AbilityScoreRow>): void {
		onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
	}

	return (
		<div className="sheet__custom-item-bonuses" role="group" aria-label="Custom item ability scores">
			<p>Ability scores</p>
			{rows.map((row, index) => {
				const n = index + 1
				const used = new Set(rows.filter((_, i) => i !== index).map((other) => other.ability))
				return (
					<p key={index}>
						<label>
							Ability{' '}
							<select aria-label={`Custom item ability score ${n} ability`} value={row.ability} onChange={(event) => change(index, { ability: event.target.value as Ability | '' })}>
								<option value="">choose…</option>
								{ABILITIES.filter((ability) => !used.has(ability)).map((ability) => (
									<option key={ability} value={ability}>
										{capitalised(ability)}
									</option>
								))}
							</select>
						</label>{' '}
						<select aria-label={`Custom item ability score ${n} kind`} value={row.kind} onChange={(event) => change(index, { kind: event.target.value as 'set' | 'add' })}>
							<option value="set">Set to</option>
							<option value="add">Add</option>
						</select>{' '}
						<input
							type="number"
							step={1}
							className="input--narrow"
							aria-label={`Custom item ability score ${n} number`}
							value={row.number}
							onChange={(event) => change(index, { number: event.target.value })}
						/>{' '}
						{row.kind === 'add' && (
							<>
								<label>
									Max{' '}
									<input
										type="number"
										step={1}
										className="input--narrow"
										aria-label={`Custom item ability score ${n} max`}
										value={row.max}
										onChange={(event) => change(index, { max: event.target.value })}
									/>
								</label>{' '}
							</>
						)}
						<button type="button" aria-label={`Remove custom item ability score ${n}`} onClick={() => onChange(rows.filter((_, i) => i !== index))}>
							Remove
						</button>
					</p>
				)
			})}
			<p>
				<button type="button" onClick={() => onChange([...rows, { ability: '', kind: 'set', number: '', max: DEFAULT_MAX }])}>
					+ Add ability score
				</button>
			</p>
		</div>
	)
}
