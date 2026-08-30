/*
 * Currency is stored as one integer of copper (Character.currencyCopper) but
 * a player reads and writes money as gold / silver / copper. These two pure
 * functions are the only conversion, shared by the sheet's display and its
 * three edit fields.
 *
 * D&D 2024: 1 gp = 10 sp = 100 cp. Platinum and electrum are not represented
 * in phase 1 (see Character.currencyCopper) — a player holding platinum
 * enters it as gold.
 */

export interface Coins {
	gp: number
	sp: number
	cp: number
}

/** Splits a copper total into gp/sp/cp the way a player writes it. Negatives and fractions are floored away first. */
export function copperToCoins(totalCopper: number): Coins {
	const total = Math.max(0, Math.floor(totalCopper))
	return {
		gp: Math.floor(total / 100),
		sp: Math.floor((total % 100) / 10),
		cp: total % 10,
	}
}

/** Recombines gp/sp/cp into a copper total. Each field is floored and clamped at 0, so a half-typed edit can never produce a negative or fractional store value. */
export function coinsToCopper({ gp, sp, cp }: Coins): number {
	const whole = (value: number): number => Math.max(0, Math.floor(Number.isFinite(value) ? value : 0))
	return whole(gp) * 100 + whole(sp) * 10 + whole(cp)
}
