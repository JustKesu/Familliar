import { loadDataFile } from '../dataLoader/dataLoader'
import type { ActionType } from './actionTableFeatureData'

/** One data/actions.json entry for the Actions tab's "Actions in Combat" line (D187). */
export interface CombatAction {
	name: string
	group: ActionType
	entries: unknown[]
}

const UNIT_GROUPS: Record<string, ActionType> = { action: 'action', bonus: 'bonus', reaction: 'reaction' }

export const TWO_WEAPON_FIGHTING = 'Two-Weapon Fighting'

/** D187: the group from `time[].unit`; a string time ("Free", "Varies") or an unknown unit is Other. */
export function groupOfTime(time: unknown): ActionType {
	const first: unknown = Array.isArray(time) ? time[0] : undefined
	if (typeof first !== 'object' || first === null) return 'other'
	const unit = (first as Record<string, unknown>)['unit']
	return (typeof unit === 'string' ? UNIT_GROUPS[unit] : undefined) ?? 'other'
}

export function extractCombatActions(parsed: unknown): CombatAction[] {
	if (!Array.isArray(parsed)) throw new Error('actions.json: expected a top-level array.')
	const actions: CombatAction[] = []
	for (const entry of parsed) {
		if (typeof entry !== 'object' || entry === null) continue
		const record = entry as Record<string, unknown>
		if (typeof record['name'] !== 'string') continue
		actions.push({ name: record['name'], group: groupOfTime(record['time']), entries: Array.isArray(record['entries']) ? record['entries'] : [] })
	}
	return actions.sort((a, b) => a.name.localeCompare(b.name))
}

export async function loadCombatActions(): Promise<CombatAction[]> {
	return extractCombatActions(await loadDataFile('data/actions.json'))
}

/**
 * D187: two held entries whose weapon is Light. A held row is one item in one
 * hand (takeInHand counts hands per row, the attack table shows one row per
 * held entry), so a single held row of quantity 2 is still one weapon in hand.
 */
export function holdsTwoLightWeapons(held: readonly { weapon: { propertyFull?: string[] } | null }[]): boolean {
	return held.filter((row) => row.weapon?.propertyFull?.includes('Light')).length >= 2
}

/** The Actions in Combat shown: Two-Weapon Fighting only while it can actually be taken (D187). */
export function visibleCombatActions(actions: readonly CombatAction[], twoLightWeapons: boolean): CombatAction[] {
	return actions.filter((action) => twoLightWeapons || action.name !== TWO_WEAPON_FIGHTING)
}
