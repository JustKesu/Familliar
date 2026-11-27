import { loadDataFile } from '../dataLoader/dataLoader'
import type { Monster } from '../monsters/monsterData'
import type { EncounterGroup, EncounterParty } from './encounterStore'

export interface XpBudgetRow {
	level: number
	low: number
	moderate: number
	high: number
}

export interface EncounterRules {
	xpBudgetPerCharacter: XpBudgetRow[]
}

export interface Thresholds {
	low: number
	moderate: number
	high: number
}

export type DifficultyLabel = 'Below Low' | 'Low' | 'Moderate' | 'High' | 'Above High'

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

export function extractEncounterRules(parsed: unknown): EncounterRules {
	const rows = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>).xpBudgetPerCharacter : undefined
	if (!Array.isArray(rows)) throw new Error('encounter-rules.json: expected xpBudgetPerCharacter.')
	const xpBudgetPerCharacter = rows.filter((row): row is XpBudgetRow => {
		if (typeof row !== 'object' || row === null) return false
		const entry = row as Record<string, unknown>
		return isNumber(entry.level) && isNumber(entry.low) && isNumber(entry.moderate) && isNumber(entry.high)
	})
	return { xpBudgetPerCharacter }
}

export async function loadEncounterRules(): Promise<EncounterRules> {
	return extractEncounterRules(await loadDataFile('data/encounter-rules.json'))
}

/** XDMG budget per character times the party size. */
export function partyThresholds(rules: EncounterRules, party: EncounterParty | null): Thresholds | null {
	if (!party) return null
	const row = rules.xpBudgetPerCharacter.find((entry) => entry.level === party.level)
	if (!row) return null
	return { low: row.low * party.size, moderate: row.moderate * party.size, high: row.high * party.size }
}

/** Each budget is the threshold the total must reach; only a total over High is "Above High" (D433). */
export function difficultyLabel(total: number, thresholds: Thresholds): DifficultyLabel {
	if (total > thresholds.high) return 'Above High'
	if (total >= thresholds.high) return 'High'
	if (total >= thresholds.moderate) return 'Moderate'
	if (total >= thresholds.low) return 'Low'
	return 'Below Low'
}

export const monsterRefKey = (monster: { name: string; source: string }): string => `${monster.name}|${monster.source}`

export function monsterIndex(monsters: Monster[]): Map<string, Monster> {
	return new Map(monsters.map((monster) => [monsterRefKey(monster), monster]))
}

/** Every member counts its monster's `xp`; `xpLair` is ignored and an unknown monster counts 0. */
export function encounterXp(groups: EncounterGroup[], monsters: Map<string, Monster>): number {
	return groups.reduce((total, group) => total + (monsters.get(monsterRefKey(group.monster))?.xp ?? 0) * group.members.length, 0)
}
