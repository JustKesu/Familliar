import { useState, type ReactNode } from 'react'
import { fixedAverage } from '../calculation/maxHitPoints'
import type { CharacterHitPointLevel, HitPointLevelKind } from '../storage/character'
import { isValidHitPointEntry } from './hitPointEntry'

function rollDie(faces: number): number {
	return Math.floor(Math.random() * faces) + 1
}

/** 0 stands for "nothing usable typed yet" (empty, fractional, negative): it is what the stored-data check still accepts and the wizard gate still refuses (D-W20). */
function manualResult(text: string): number {
	const n = Number(text)
	return text.trim() !== '' && Number.isInteger(n) && n >= 0 ? n : 0
}

function Pill({ name, label, checked, onSelect }: { name: string; label: string; checked: boolean; onSelect: () => void }): ReactNode {
	return (
		<label className={checked ? 'roll-mode__option roll-mode__option--active hit-points-picker__pill' : 'roll-mode__option hit-points-picker__pill'}>
			<input type="radio" name={name} checked={checked} onChange={onSelect} />
			{label}
		</label>
	)
}

/** One level's row. Mounted per level, so the manual field's text lives here and an empty field survives a re-render. */
export function HitPointLevelRow({
	level,
	faces,
	entry,
	onSet,
}: {
	level: number
	faces: number
	entry: CharacterHitPointLevel | undefined
	onSet: (level: number, kind: HitPointLevelKind, dieResult: number) => void
}): ReactNode {
	const [manualText, setManualText] = useState(entry?.kind === 'manual' && entry.dieResult > 0 ? String(entry.dieResult) : '')
	const groupName = `hit-points-picker__level-${level}`
	const invalid = entry !== undefined && !isValidHitPointEntry(entry, faces)
	const hintId = `${groupName}-hint`

	return (
		<tr>
			<td className="hit-points-picker__level">Level {level}</td>
			<td>
				<div className="hit-points-picker__method">
					<div className="hit-points-picker__pills" role="radiogroup" aria-label={`Level ${level} hit points method`}>
						<Pill name={groupName} label={`Average (${fixedAverage(faces)})`} checked={entry?.kind === 'average'} onSelect={() => onSet(level, 'average', fixedAverage(faces))} />
						<Pill name={groupName} label={`Roll (d${faces})`} checked={entry?.kind === 'roll'} onSelect={() => onSet(level, 'roll', rollDie(faces))} />
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
							<span className="ability-roll__die hit-points-picker__die" aria-label={`Level ${level} rolled die`}>
								{entry.dieResult}
							</span>
							<button type="button" className="btn--accent-outline hit-points-picker__reroll" onClick={() => onSet(level, 'roll', rollDie(faces))}>
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
					<span id={hintId} className="hit-points-picker__hint" role="alert">
						1–{faces}
					</span>
				)}
			</td>
		</tr>
	)
}
