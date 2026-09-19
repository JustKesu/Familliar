import { useState, type ReactNode } from 'react'
import { rollDice, rollKeepOne, type DiceRoll, type KeepOneRoll, type RandomSource, type RollMode } from './roll'

const MODE_LABELS: Record<RollMode, string> = { normal: 'Normal', advantage: 'Advantage', disadvantage: 'Disadvantage' }

function withModifier(dice: string, modifier: number, total: number): string {
	const sign = modifier < 0 ? '−' : '+'
	return `${dice} ${sign} ${Math.abs(modifier)} = ${total}`
}

export function formatRoll(roll: DiceRoll): string {
	return withModifier(roll.dice.join(', '), roll.modifier, roll.total)
}

/** Both d20s are shown so the player can see the roll that was passed over. */
export function formatKeepOneRoll(roll: KeepOneRoll): string {
	const dice = roll.mode === 'normal' ? String(roll.kept) : `${roll.dice.join(', ')} (kept ${roll.kept})`
	return withModifier(dice, roll.modifier, roll.total)
}

function RollResult({ text }: { text: string | null }): ReactNode {
	if (text === null) return null
	return (
		<span className="dice-roll__result" role="status">
			{' '}
			{text}
		</span>
	)
}

/**
 * The result is component state on purpose: a roll is never stored and never
 * changes the printed value it was made from (step 9c1). So is the mode — it is
 * a choice about the next roll, not part of the character.
 */
export function RollButton({ modifier, label, random }: { modifier: number; label: string; random?: RandomSource }): ReactNode {
	const [roll, setRoll] = useState<KeepOneRoll | null>(null)
	const [mode, setMode] = useState<RollMode>('normal')
	return (
		<span className="dice-roll">
			<select className="dice-roll__mode" aria-label={`Roll mode for ${label}`} value={mode} onChange={(event) => setMode(event.target.value as RollMode)}>
				{(Object.keys(MODE_LABELS) as RollMode[]).map((option) => (
					<option key={option} value={option}>
						{MODE_LABELS[option]}
					</option>
				))}
			</select>{' '}
			<button type="button" className="dice-roll__button" aria-label={`Roll ${label}`} onClick={() => setRoll(rollKeepOne(20, modifier, mode, random))}>
				Roll
			</button>
			<RollResult text={roll && formatKeepOneRoll(roll)} />
		</span>
	)
}

/** Damage sums its dice; advantage and disadvantage never apply to it, so it has no mode control. */
export function DamageRollButton({
	count,
	sides,
	modifier,
	label,
	random,
}: {
	count: number
	sides: number
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
			<RollResult text={roll && formatRoll(roll)} />
		</span>
	)
}
