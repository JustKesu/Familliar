/*
 * Shared result shape for the calculation layer (build order step 4).
 *
 * D40 — every computed value returns a breakdown (a list of contributions),
 * never a bare number. D43 — when a function can't determine a value (e.g.
 * a class not found in the supplied data), it returns 'unknown' rather than
 * throwing, so a missing piece of data never crashes the sheet.
 */

export interface Contribution {
	source: string
	amount: number
	/**
	 * Set for a contribution that documents a KNOWN feat effect this app
	 * does not compute — either a prose feat's effect (D55) or a structured
	 * feat choice with nowhere to store the player's pick. `amount` stays 0
	 * so the note never changes the summed total; it exists purely so the
	 * breakdown says a feat touches this value, and which one.
	 */
	note?: string
}

export type Calculated<T> = { status: 'known'; value: T; breakdown: Contribution[] } | { status: 'unknown'; reason: string }

export function known<T>(value: T, breakdown: Contribution[]): Calculated<T> {
	return { status: 'known', value, breakdown }
}

export function unknown<T>(reason: string): Calculated<T> {
	return { status: 'unknown', reason }
}
