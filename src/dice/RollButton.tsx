import { useState, type ReactNode } from 'react'
import { rollDice, type DiceRoll, type RandomSource } from './roll'

export function formatRoll(roll: DiceRoll): string {
	const sign = roll.modifier < 0 ? '−' : '+'
	return `${roll.dice.join(', ')} ${sign} ${Math.abs(roll.modifier)} = ${roll.total}`
}

/**
 * The result is component state on purpose: a roll is never stored and never
 * changes the printed value it was made from (step 9c1).
 */
export function RollButton({
	sides,
	count = 1,
	modifier,
	label,
	random,
}: {
	sides: number
	count?: number
	modifier: number
	label: string
	random?: RandomSource
}): ReactNode {
	const [roll, setRoll] = useState<DiceRoll | null>(null)
	return (
		<span className="dice-roll">
			<button type="button" className="dice-roll__button" aria-label={`Roll ${label}`} onClick={() => setRoll(rollDice(count, sides, modifier, random))}>
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
