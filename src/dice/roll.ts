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

/** Reads an AttackDamage.dice string such as "2d6"; null for anything that is not exactly one NdS group. */
export function parseDiceExpression(text: string): { count: number; sides: number } | null {
	const match = /^(\d+)d(\d+)$/.exec(text.trim())
	if (!match) return null
	const count = Number(match[1])
	const sides = Number(match[2])
	return count > 0 && sides > 0 ? { count, sides } : null
}
