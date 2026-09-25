import { useContext, type ReactNode } from 'react'
import { rollDice, rollKeepOne, type DiceRoll, type KeepOneRoll, type RandomSource } from './roll'
import type { RollReport } from './RollHistory'
import { RollModeContext } from './RollUi'

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

/**
 * The result is not shown here: it goes to the sheet's toast and history via
 * onRoll (D165). The advantage mode is the sheet-wide switch, which goes back
 * to Normal after every roll made here.
 */
export function RollButton({
	modifier,
	label,
	random,
	onRoll,
	children,
}: {
	modifier: number
	label: string
	random?: RandomSource
	onRoll?: (report: RollReport) => void
	/** R4b (D166): the value itself is the button — its text, with no "Roll" chrome around it. */
	children?: ReactNode
}): ReactNode {
	const { mode, setMode } = useContext(RollModeContext)
	function makeRoll(): void {
		const next = rollKeepOne(20, modifier, mode, random)
		onRoll?.({ label, text: formatKeepOneRoll(next), detail: { dice: next.dice, keptIndex: next.dice.indexOf(next.kept), modifier, total: next.total } })
		setMode('normal')
	}
	if (children !== undefined) {
		return (
			<button type="button" className="roll-value" aria-label={`Roll ${label}`} onClick={makeRoll}>
				{children}
			</button>
		)
	}
	return (
		<span className="dice-roll">
			<button type="button" className="dice-roll__button" aria-label={`Roll ${label}`} onClick={makeRoll}>
				Roll
			</button>
		</span>
	)
}

/** Damage sums its dice; advantage and disadvantage never apply to it, so it ignores the switch and leaves it alone. */
export function DamageRollButton({
	count,
	sides,
	modifier,
	label,
	random,
	onRoll,
	disabled,
	children,
}: {
	count: number
	sides: number
	modifier: number
	label: string
	random?: RandomSource
	/** Slice 9b6: a hit die with none left to spend. */
	disabled?: boolean
	/** The roll itself rides along as a second argument for a caller that needs the total (slice 9b6: a hit die heals by it); every other caller ignores it. */
	onRoll?: (report: RollReport, roll: DiceRoll) => void
	/** R5a: the damage text itself is the button, as RollButton's children (D166). */
	children?: ReactNode
}): ReactNode {
	function makeRoll(): void {
		const next = rollDice(count, sides, modifier, random)
		onRoll?.({ label, text: formatRoll(next), detail: { dice: next.dice, keptIndex: null, modifier, total: next.total } }, next)
	}
	if (children !== undefined) {
		return (
			<button type="button" className="roll-value" aria-label={`Roll ${label}`} disabled={disabled} onClick={makeRoll}>
				{children}
			</button>
		)
	}
	return (
		<span className="dice-roll">
			<button type="button" className="dice-roll__button" aria-label={`Roll ${label}`} disabled={disabled} onClick={makeRoll}>
				Roll
			</button>
		</span>
	)
}
