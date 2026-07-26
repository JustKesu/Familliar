/*
 * Structural helpers for 5etools `entries` arrays.
 *
 * These are NOT game-data types (no Spell, no Item — those arrive with the
 * features that use them, per PHASE1.md section D). They describe only the
 * shape of the nested prose structure the renderer walks.
 *
 * The data is irregular by nature, so everything here reads defensively from
 * `unknown` rather than asserting a shape that might not hold. Two real
 * examples of why, both from MARKUP-INVENTORY.md:
 *   - a `list` item carries EITHER `entry` (a string) or `entries` (an array);
 *     221 use one, 186 use the other
 *   - `rows` in a table hold strings, arrays, or `cell` objects
 */

/** An entry is a string, a number, or a nested object with a `type`. */
export type EntryNode = unknown

export function isEntryObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function asString(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined
}

export function asNumber(value: unknown): number | undefined {
	return typeof value === 'number' ? value : undefined
}

export function asArray(value: unknown): unknown[] | undefined {
	return Array.isArray(value) ? value : undefined
}

/** The `type` of a nested entry object, if it has one. */
export function entryType(value: unknown): string | undefined {
	return isEntryObject(value) ? asString(value['type']) : undefined
}

/**
 * Reads the body of an entry object, which may be spelled either way.
 * `entries` is an array; `entry` is a single string. Both occur widely.
 */
export function entryBody(node: Record<string, unknown>): unknown[] {
	const entries = asArray(node['entries'])
	if (entries) return entries
	if (node['entry'] !== undefined) return [node['entry']]
	return []
}

/**
 * Pulls the display name out of a 5etools UID string.
 *
 *     "Tools of the Trade|Artificer|EFA|Alchemist|EFA|3|EFA"  ->  "Tools of the Trade"
 *
 * The rest of the UID identifies which class/subclass/level the feature
 * belongs to. We keep the whole string on the rendered element so the feature
 * that eventually resolves these does not have to re-derive it.
 */
export function uidName(uid: string): string {
	const pipe = uid.indexOf('|')
	return pipe === -1 ? uid : uid.slice(0, pipe)
}

/** Formats a number with an explicit sign, as bonuses are written. */
export function signedNumber(value: number): string {
	return `${value >= 0 ? '+' : ''}${value}`
}

/**
 * Renders a `dice` entry's `toRoll` into a dice expression.
 *
 *     [{number:1, faces:6}]  ->  "1d6"
 */
export function formatToRoll(toRoll: unknown): string {
	const parts = asArray(toRoll)
	if (!parts) return ''
	return parts
		.map((part) => {
			if (!isEntryObject(part)) return ''
			const number = asNumber(part['number']) ?? 1
			const faces = asNumber(part['faces'])
			return faces === undefined ? '' : `${number}d${faces}`
		})
		.filter(Boolean)
		.join(' + ')
}

/**
 * Renders a table `cell` object's roll range.
 *
 *     {exact: 3}        ->  "3"
 *     {min: 1, max: 4}  ->  "1-4"
 */
export function formatCellRoll(roll: unknown): string {
	if (!isEntryObject(roll)) return ''
	const exact = asNumber(roll['exact'])
	if (exact !== undefined) return String(exact)
	const min = asNumber(roll['min'])
	const max = asNumber(roll['max'])
	if (min !== undefined && max !== undefined) return `${min}-${max}`
	return ''
}
