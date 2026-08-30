/*
 * Currency is stored as one integer of copper (Character.currencyCopper) but
 * a player reads and writes money as coins. These pure functions are the only
 * conversion, shared by the sheet's display and its edit fields.
 *
 * D74: coins exist only at display and entry — 1 gp = 10 sp = 100 cp, and
 * 1 pp = 10 gp. Electrum is not modelled; the 2024 edition dropped it.
 *
 * Platinum is an ENTRY unit only. Daniel's rule: every displayed breakdown
 * reads in gold, silver and copper, so 90 gp reads as 90 gp rather than 9 pp,
 * and platinum typed into the sheet comes back out as gold on the next render.
 * `platinumToCopper` is therefore one-way — there is no copper-to-platinum
 * half, because nothing displays platinum.
 */

export interface Coins {
	gp: number
	sp: number
	cp: number
}

export const COPPER_PER_PLATINUM = 1000

/** Floors and clamps one typed field, so a half-typed edit can never produce a negative or fractional store value. */
function whole(value: number): number {
	return Math.max(0, Math.floor(Number.isFinite(value) ? value : 0))
}

/** Splits a copper total into gp/sp/cp the way a player reads it. Negatives and fractions are floored away first. */
export function copperToCoins(totalCopper: number): Coins {
	const total = Math.max(0, Math.floor(totalCopper))
	return {
		gp: Math.floor(total / 100),
		sp: Math.floor((total % 100) / 10),
		cp: total % 10,
	}
}

/** Recombines gp/sp/cp into a copper total. */
export function coinsToCopper({ gp, sp, cp }: Coins): number {
	return whole(gp) * 100 + whole(sp) * 10 + whole(cp)
}

/** Platinum as typed into the entry field, as copper to add to a stored total. */
export function platinumToCopper(platinum: number): number {
	return whole(platinum) * COPPER_PER_PLATINUM
}
