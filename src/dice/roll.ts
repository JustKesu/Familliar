export type RandomSource = () => number

export interface DiceRoll {
	/** Every die in the order rolled, so the breakdown can show each one. */
	dice: number[]
	modifier: number
	total: number
}

/** `random` returns a value in [0, 1), as Math.random does. */
export function rollDice(count: number, sides: number, modifier: number, random: RandomSource = Math.random): DiceRoll {
	const dice = Array.from({ length: count }, () => Math.floor(random() * sides) + 1)
	return { dice, modifier, total: dice.reduce((sum, die) => sum + die, 0) + modifier }
}

export type RollMode = 'normal' | 'advantage' | 'disadvantage'

export interface KeepOneRoll {
	mode: RollMode
	/** One die for a normal roll, two (in the order rolled) for advantage or disadvantage. */
	dice: number[]
	/** The die that counts: the only one, the higher of two, or the lower of two. */
	kept: number
	modifier: number
	total: number
}

/**
 * A d20 check, not a sum: advantage and disadvantage roll two dice and count
 * only one, where rollDice adds every die together.
 */
export function rollKeepOne(sides: number, modifier: number, mode: RollMode, random: RandomSource = Math.random): KeepOneRoll {
	const { dice } = rollDice(mode === 'normal' ? 1 : 2, sides, 0, random)
	const kept = mode === 'advantage' ? Math.max(...dice) : mode === 'disadvantage' ? Math.min(...dice) : dice[0]!
	return { mode, dice, kept, modifier, total: kept + modifier }
}

/** Reads an AttackDamage.dice string such as "2d6"; null for anything that is not exactly one NdS group. */
export function parseDiceExpression(text: string): { count: number; sides: number } | null {
	const match = /^(\d+)d(\d+)$/.exec(text.trim())
	if (!match) return null
	const count = Number(match[1])
	const sides = Number(match[2])
	return count > 0 && sides > 0 ? { count, sides } : null
}
