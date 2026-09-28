import { loadDataFile } from '../dataLoader/dataLoader'

export const EXHAUSTION = 'Exhaustion'
export const MAX_EXHAUSTION = 6

/** The 14 conditions kept in Character.play.conditions; Exhaustion has its own level field (D214). */
export const CONDITION_NAMES = [
	'Blinded',
	'Charmed',
	'Deafened',
	'Frightened',
	'Grappled',
	'Incapacitated',
	'Invisible',
	'Paralyzed',
	'Petrified',
	'Poisoned',
	'Prone',
	'Restrained',
	'Stunned',
	'Unconscious',
] as const

/** One data/conditions.json entry (D214): XPHB rule text only. */
export interface ConditionRule {
	name: string
	entries: unknown[]
}

/** D214: shown as text only, never applied to a roll or to speed. */
export function exhaustionPenaltyText(level: number): string {
	return `−${2 * level} d20 · −${5 * level} ft`
}

export function extractConditionRules(parsed: unknown): ConditionRule[] {
	if (!Array.isArray(parsed)) throw new Error('conditions.json: expected a top-level array.')
	const rules: ConditionRule[] = []
	for (const entry of parsed) {
		if (typeof entry !== 'object' || entry === null) continue
		const record = entry as Record<string, unknown>
		if (typeof record['name'] !== 'string') continue
		rules.push({ name: record['name'], entries: Array.isArray(record['entries']) ? record['entries'] : [] })
	}
	return rules.sort((a, b) => a.name.localeCompare(b.name))
}

export async function loadConditionRules(): Promise<ConditionRule[]> {
	return extractConditionRules(await loadDataFile('data/conditions.json'))
}
