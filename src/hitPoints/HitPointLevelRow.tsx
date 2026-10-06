import { useState, type ReactNode } from 'react'
import { fixedAverage } from '../calculation/maxHitPoints'
import type { CharacterHitPointLevel, HitPointLevelKind } from '../storage/character'
import { rollDice, type RandomSource } from '../dice/roll'
import { isValidHitPointEntry } from './hitPointEntry'

/** 0 stands for "nothing usable typed yet" (empty, fractional, negative, "1e1"): it is what the stored-data check still accepts and the wizard gate still refuses (D-W20). */
export function manualResult(text: string): number {
	const trimmed = text.trim()
	return /^\d+$/.test(trimmed) ? Number(trimmed) : 0
}

/** `reapply`: fires on click too, so an already-checked pill can be clicked to rewrite a legacy wrong value (D258). */
function Pill({ name, label, checked, onSelect, reapply = false }: { name: string; label: string; checked: boolean; onSelect: () => void; reapply?: boolean }): ReactNode {
	return (
		<label className={checked ? 'roll-mode__option roll-mode__option--active hit-points-picker__pill' : 'roll-mode__option hit-points-picker__pill'}>
			<input type="radio" name={name} checked={checked} onChange={reapply ? () => {} : onSelect} onClick={reapply ? onSelect : undefined} />
			{label}
		</label>
	)
}

/** One level's row. Mounted per level, so the manual field's text lives here and an empty field survives a re-render. */
export function HitPointLevelRow({
	level,
	faces,
	className,
	entry,
	onSet,
	random,
}: {
	level: number
	faces: number
	/** Set only for a multiclass character: the class this level belongs to (D323). */
	className?: string
	entry: CharacterHitPointLevel | undefined
	onSet: (level: number, kind: HitPointLevelKind, dieResult: number) => void
	random?: RandomSource
}): ReactNode {
	const [manualText, setManualText] = useState(entry?.kind === 'manual' && entry.dieResult > 0 ? String(entry.dieResult) : '')
	const groupName = `hit-points-picker__level-${level}`
	const invalid = entry !== undefined && !isValidHitPointEntry(entry, faces)
	const hintId = `${groupName}-hint`
	const rolled = (): number => rollDice(1, faces, 0, random).total
	const hint = entry?.kind === 'average' ? `Average is ${fixedAverage(faces)}` : entry?.kind === 'maximum' ? `Maximum is ${faces}` : `Whole number 1–${faces}`

	return (
		<tr>
			<td className="hit-points-picker__level">
				Level {level}
				{className ? ` · ${className}` : ''}
			</td>
			<td>
				<div className="hit-points-picker__method">
					<div className="hit-points-picker__pills" role="radiogroup" aria-label={`Level ${level} hit points method`} aria-describedby={invalid ? hintId : undefined}>
						<Pill name={groupName} label={`Average (${fixedAverage(faces)})`} checked={entry?.kind === 'average'} onSelect={() => onSet(level, 'average', fixedAverage(faces))} reapply />
						<Pill name={groupName} label={`Roll (d${faces})`} checked={entry?.kind === 'roll'} onSelect={() => onSet(level, 'roll', rolled())} />
						<Pill
							name={groupName}
							label="Manual"
							checked={entry?.kind === 'manual'}
							onSelect={() => {
								setManualText('')
								onSet(level, 'manual', 0)
							}}
						/>
					</div>
					{entry?.kind === 'roll' && (
						<>
							<span className="ability-roll__die hit-points-picker__die" role="img" aria-label={`Level ${level} rolled ${entry.dieResult}`}>
								{entry.dieResult}
							</span>
							<button type="button" className="btn--accent-outline hit-points-picker__reroll" aria-label={`Reroll level ${level}`} onClick={() => onSet(level, 'roll', rolled())}>
								Reroll
							</button>
						</>
					)}
				</div>
			</td>
			<td className="hit-points-picker__result">
				{entry?.kind === 'manual' ? (
					<input
						type="number"
						inputMode="numeric"
						className="input--narrow hit-points-picker__manual"
						aria-label={`Level ${level} manual result`}
						aria-invalid={invalid}
						aria-describedby={invalid ? hintId : undefined}
						value={manualText}
						onChange={(event) => {
							setManualText(event.target.value)
							onSet(level, 'manual', manualResult(event.target.value))
						}}
					/>
				) : (
					<span className={invalid ? 'hit-points-picker__value hit-points-picker__value--invalid' : 'hit-points-picker__value'}>{entry ? entry.dieResult : '—'}</span>
				)}
				{invalid && (
					<span id={hintId} className="hit-points-picker__hint">
						{hint}
					</span>
				)}
			</td>
		</tr>
	)
}
