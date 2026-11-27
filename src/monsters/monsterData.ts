import { loadDataFile } from '../dataLoader/dataLoader'
import { abilityModifier } from '../calculation/abilityScores'
import { proficiencyBonusForLevel } from '../calculation/proficiencyBonus'

export interface MonsterEntryBlock {
	name?: string
	entries?: unknown[]
}

/** `{number, condition}` carries a note such as "(hover)"; `alternate`/`choose` are rare shapes (docs/DATA.md MON-1). */
export type MonsterSpeedValue = number | { number?: number; amount?: number; condition?: string; note?: string; from?: string[] }

export type MonsterSpeed = Record<string, MonsterSpeedValue | boolean | Record<string, MonsterSpeedValue[]>>

export type MonsterType = string | { type: string | { choose: string[] }; tags?: string[]; swarmSize?: string }

/** A damage/condition list entry: a plain name, `{special}`, or a conditional group with a note. */
export type MonsterDefenceEntry = string | { special?: string; note?: string; cond?: boolean; [key: string]: unknown }

export interface MonsterSpellcastingBlock {
	name?: string
	headerEntries?: unknown[]
	will?: string[]
	/** Keys "1".."3" = N/day, "1e".."3e" = N/day each. */
	daily?: Record<string, string[]>
	restLong?: Record<string, string[]>
	recharge?: Record<string, string[]>
	legendary?: Record<string, string[]>
	ability?: string
	displayAs?: 'action' | 'bonus' | 'reaction' | 'legendary'
	/** Lists already spelled out in headerEntries. */
	hidden?: string[]
}

export interface Monster {
	name: string
	source: string
	size: string[]
	type: MonsterType
	alignment?: string[]
	ac: (number | { ac: number; from?: string[] })[]
	hp: { average?: number; formula?: string }
	speed: MonsterSpeed
	str: number
	dex: number
	con: number
	int: number
	wis: number
	cha: number
	save?: Record<string, string>
	skill?: Record<string, string>
	senses?: string[]
	passive?: number
	languages?: string[]
	cr: string
	crNumber: number
	xp?: number
	xpLair?: number
	initiative?: { proficiency?: number; advantageMode?: string }
	immune?: MonsterDefenceEntry[]
	resist?: MonsterDefenceEntry[]
	vulnerable?: MonsterDefenceEntry[]
	conditionImmune?: MonsterDefenceEntry[]
	trait?: MonsterEntryBlock[]
	action?: MonsterEntryBlock[]
	bonus?: MonsterEntryBlock[]
	reaction?: MonsterEntryBlock[]
	legendary?: MonsterEntryBlock[]
	legendaryActions?: number
	legendaryActionsLair?: number
	legendaryGroup?: { name: string; source: string }
	spellcasting?: MonsterSpellcastingBlock[]
	environment?: string[]
}

export interface LegendaryGroup {
	name: string
	source: string
	lairActions?: unknown[]
	regionalEffects?: unknown[]
}

export interface MonsterData {
	monsters: Monster[]
	legendaryGroups: LegendaryGroup[]
}

function isNumber(value: unknown): value is number {
	return typeof value === 'number' && !Number.isNaN(value)
}

function isMonster(value: unknown): value is Monster {
	if (typeof value !== 'object' || value === null) return false
	const entry = value as Record<string, unknown>
	return (
		typeof entry.name === 'string' &&
		typeof entry.source === 'string' &&
		Array.isArray(entry.size) &&
		(typeof entry.type === 'string' || (typeof entry.type === 'object' && entry.type !== null)) &&
		typeof entry.cr === 'string' &&
		isNumber(entry.crNumber) &&
		Array.isArray(entry.ac) &&
		typeof entry.hp === 'object' &&
		entry.hp !== null &&
		typeof entry.speed === 'object' &&
		entry.speed !== null &&
		isNumber(entry.str) &&
		isNumber(entry.dex) &&
		isNumber(entry.con) &&
		isNumber(entry.int) &&
		isNumber(entry.wis) &&
		isNumber(entry.cha)
	)
}

function isLegendaryGroup(value: unknown): value is LegendaryGroup {
	if (typeof value !== 'object' || value === null) return false
	const entry = value as Record<string, unknown>
	return typeof entry.name === 'string' && typeof entry.source === 'string'
}

export function extractMonsters(parsed: unknown): Monster[] {
	if (!Array.isArray(parsed)) throw new Error('monsters.json: expected a top-level array.')
	return parsed.filter(isMonster)
}

export function extractLegendaryGroups(parsed: unknown): LegendaryGroup[] {
	if (!Array.isArray(parsed)) throw new Error('legendary-groups.json: expected a top-level array.')
	return parsed.filter(isLegendaryGroup)
}

export async function loadMonsterData(): Promise<MonsterData> {
	const [monsters, groups] = await Promise.all([loadDataFile('data/monsters.json'), loadDataFile('data/legendary-groups.json')])
	return { monsters: extractMonsters(monsters), legendaryGroups: extractLegendaryGroups(groups) }
}

export function findLegendaryGroup(monster: Monster, groups: LegendaryGroup[]): LegendaryGroup | undefined {
	const ref = monster.legendaryGroup
	if (!ref) return undefined
	return groups.find((group) => group.name === ref.name && group.source === ref.source)
}

/** Monster PB by CR: same 2 + 1-per-4 step as a character level; CR below 1 counts as 1 (CR 21 → +7, checked against Lich saves). */
export function monsterProficiencyBonus(monster: Pick<Monster, 'crNumber'>): number {
	return proficiencyBonusForLevel(Math.max(1, monster.crNumber))
}

export function monsterInitiative(monster: Pick<Monster, 'crNumber' | 'dex' | 'initiative'>): number {
	return abilityModifier(monster.dex) + (monster.initiative?.proficiency ?? 0) * monsterProficiencyBonus(monster)
}

export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'

/** The `save` field lists only proficient saves, already totalled ("+6"); every other save is the plain modifier. */
export function monsterSave(monster: Monster, ability: AbilityKey): { bonus: number; proficient: boolean } {
	const written = monster.save?.[ability]
	if (written !== undefined) {
		const parsed = Number.parseInt(written, 10)
		if (!Number.isNaN(parsed)) return { bonus: parsed, proficient: true }
	}
	return { bonus: abilityModifier(monster[ability]), proficient: false }
}

/** Base creature types; an Empyrean's `{choose: [...]}` counts as each of its options. */
export function monsterTypes(monster: Pick<Monster, 'type'>): string[] {
	const type = monster.type
	if (typeof type === 'string') return [type]
	if (typeof type.type === 'string') return [type.type]
	return type.type.choose
}
