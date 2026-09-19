import { useState, type ReactNode } from 'react'
import { rollDie, type DieRoll, type RandomSource } from './roll'

export function formatRoll(roll: DieRoll): string {
	const sign = roll.modifier < 0 ? '−' : '+'
	return `${roll.die} ${sign} ${Math.abs(roll.modifier)} = ${roll.total}`
}

/**
 * The result is component state on purpose: a roll is never stored and never
 * changes the printed value it was made from (step 9c1).
 */
export function RollButton({ sides, modifier, label, random }: { sides: number; modifier: number; label: string; random?: RandomSource }): ReactNode {
	const [roll, setRoll] = useState<DieRoll | null>(null)
	return (
		<span className="dice-roll">
			<button type="button" className="dice-roll__button" aria-label={`Roll ${label}`} onClick={() => setRoll(rollDie(sides, modifier, random))}>
				Roll
			</button>
			{roll && (
				<span className="dice-roll__result" role="status">
					{' '}
					{formatRoll(roll)}
				</span>
			)}
		</span>
	)
}
