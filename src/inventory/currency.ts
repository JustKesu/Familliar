/*
 * Currency is stored as one integer of copper (Character.currencyCopper) but
 * a player reads and writes money as coins. These two pure functions are the
 * only conversion, shared by the sheet's display and its edit fields.
 *
 * D74: platinum, gold, silver and copper exist only at display and entry —
 * 1 pp = 10 gp = 100 sp = 1000 cp. Electrum is not modelled; the 2024 edition
 * dropped it.
 */

export interface Coins {
	pp: number
	gp: number
	sp: number
	cp: number
}

/** Splits a copper total into pp/gp/sp/cp the way a player writes it. Negatives and fractions are floored away first. */
export function copperToCoins(totalCopper: number): Coins {
	const total = Math.max(0, Math.floor(totalCopper))
	return {
		pp: Math.floor(total / 1000),
		gp: Math.floor((total % 1000) / 100),
		sp: Math.floor((total % 100) / 10),
		cp: total % 10,
	}
}

/** Recombines pp/gp/sp/cp into a copper total. Each field is floored and clamped at 0, so a half-typed edit can never produce a negative or fractional store value. */
export function coinsToCopper({ pp, gp, sp, cp }: Coins): number {
	const whole = (value: number): number => Math.max(0, Math.floor(Number.isFinite(value) ? value : 0))
	return whole(pp) * 1000 + whole(gp) * 100 + whole(sp) * 10 + whole(cp)
}
