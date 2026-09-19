export type RandomSource = () => number

export interface DieRoll {
	die: number
	modifier: number
	total: number
}

/** `random` returns a value in [0, 1), as Math.random does. */
export function rollDie(sides: number, modifier: number, random: RandomSource = Math.random): DieRoll {
	const die = Math.floor(random() * sides) + 1
	return { die, modifier, total: die + modifier }
}
