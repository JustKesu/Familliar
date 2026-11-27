import { CONDITION_NAMES, EXHAUSTION } from '../conditions/conditions'
import type { AbilityKey } from '../monsters/monsterData'
import type { EncounterGroup } from './encounterStore'
import { LEGENDARY_ACTIONS_KEY } from './trackedUses'

/** D434: Exhaustion is a plain chip here, without a level. */
export const COMBAT_CONDITIONS: readonly string[] = [...CONDITION_NAMES.slice(0, 3), EXHAUSTION, ...CONDITION_NAMES.slice(3)]

export const SAVE_ABILITIES: readonly AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

export type InitiativeEntry =
	| { kind: 'group'; groupId: string; initiative: number; bonus: number }
	| { kind: 'member'; groupId: string; memberId: string; initiative: number; bonus: number }
	/** null = no number entered; such a player acts last. */
	| { kind: 'player'; name: string; initiative: number | null }

export interface SaveResult {
	ability: AbilityKey
	total: number
	success: boolean
}

export interface Combat {
	round: number
	/** Index into `order` of the entry whose turn it is. */
	turn: number
	order: InitiativeEntry[]
	hp: Record<string, number>
	conditions: Record<string, string[]>
	adv: Record<string, boolean>
	saveResults: Record<string, SaveResult>
	/** D435: used count per member per tracked-use key; absent in combats saved before MON-5 = nothing used. */
	uses?: Record<string, Record<string, number>>
	lair?: Record<string, boolean>
}

export type OnSuccess = 'half' | 'none'

export const rollD20 = (): number => 1 + Math.floor(Math.random() * 20)

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isWhole = (value: unknown, min: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= min
const isInt = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value)
const isNonEmpty = (value: unknown): value is string => typeof value === 'string' && value !== ''

function isEntry(value: unknown): value is InitiativeEntry {
	if (!isRecord(value)) return false
	if (value.kind === 'player') return isNonEmpty(value.name) && (value.initiative === null || isInt(value.initiative))
	if (!isNonEmpty(value.groupId) || !isInt(value.initiative) || !isInt(value.bonus)) return false
	return value.kind === 'group' || (value.kind === 'member' && isNonEmpty(value.memberId))
}

function recordOf<T>(value: unknown, check: (item: unknown) => item is T): value is Record<string, T> {
	return isRecord(value) && Object.values(value).every(check)
}

const isSaveResult = (value: unknown): value is SaveResult =>
	isRecord(value) && SAVE_ABILITIES.includes(value.ability as AbilityKey) && isInt(value.total) && typeof value.success === 'boolean'

export function isCombat(value: unknown): value is Combat {
	return (
		isRecord(value) &&
		isWhole(value.round, 1) &&
		isWhole(value.turn, 0) &&
		Array.isArray(value.order) &&
		value.order.every(isEntry) &&
		(value.order.length === 0 || value.turn < value.order.length) &&
		recordOf(value.hp, (hp): hp is number => isWhole(hp, 0)) &&
		recordOf(value.conditions, (list): list is string[] => Array.isArray(list) && list.every((name) => typeof name === 'string')) &&
		recordOf(value.adv, (flag): flag is boolean => typeof flag === 'boolean') &&
		recordOf(value.saveResults, isSaveResult) &&
		(value.uses === undefined || recordOf(value.uses, (used): used is Record<string, number> => recordOf(used, (n): n is number => isWhole(n, 0)))) &&
		(value.lair === undefined || recordOf(value.lair, (flag): flag is boolean => typeof flag === 'boolean'))
	)
}

export function entryKey(entry: InitiativeEntry): string {
	if (entry.kind === 'player') return `p:${entry.name}`
	return entry.kind === 'group' ? `g:${entry.groupId}` : `m:${entry.memberId}`
}

/** A group with one roll is one entry; otherwise one per member; players one each, number left blank. */
export function initiativeEntries(groups: EncounterGroup[], players: string[], bonusOf: (group: EncounterGroup) => number, roll: () => number = rollD20): InitiativeEntry[] {
	const monsters = groups.flatMap((group): InitiativeEntry[] => {
		const bonus = bonusOf(group)
		if (group.oneInitiative && group.members.length > 1) return [{ kind: 'group', groupId: group.id, initiative: roll() + bonus, bonus }]
		return group.members.map((member) => ({ kind: 'member', groupId: group.id, memberId: member.id, initiative: roll() + bonus, bonus }))
	})
	return [...monsters, ...players.map((name): InitiativeEntry => ({ kind: 'player', name, initiative: null }))]
}

/** Higher total first; on a tie the higher bonus among monsters, a player before a monster (D434); a blank player goes last. */
export function sortInitiative(entries: InitiativeEntry[]): InitiativeEntry[] {
	const indexed = entries.map((entry, index) => ({ entry, index }))
	indexed.sort((a, b) => {
		const ia = a.entry.initiative
		const ib = b.entry.initiative
		if (ia === null || ib === null) return ia === ib ? a.index - b.index : ia === null ? 1 : -1
		if (ia !== ib) return ib - ia
		const pa = a.entry.kind === 'player'
		const pb = b.entry.kind === 'player'
		if (pa !== pb) return pa ? -1 : 1
		if (a.entry.kind !== 'player' && b.entry.kind !== 'player' && a.entry.bonus !== b.entry.bonus) return b.entry.bonus - a.entry.bonus
		return a.index - b.index
	})
	return indexed.map(({ entry }) => entry)
}

export function startCombat(order: InitiativeEntry[], groups: EncounterGroup[], maxHpOf: (group: EncounterGroup) => number): Combat {
	const hp: Record<string, number> = {}
	for (const group of groups) for (const member of group.members) hp[member.id] = maxHpOf(group)
	return { round: 1, turn: 0, order: sortInitiative(order), hp, conditions: {}, adv: {}, saveResults: {} }
}

/** Member ids an entry stands for; members removed in the setup since the start drop out. */
export function entryMemberIds(entry: InitiativeEntry, groups: EncounterGroup[]): string[] {
	if (entry.kind === 'player') return []
	const group = groups.find((g) => g.id === entry.groupId)
	if (!group) return []
	if (entry.kind === 'group') return group.members.map((member) => member.id)
	return group.members.some((member) => member.id === entry.memberId) ? [entry.memberId] : []
}

export const currentHp = (combat: Combat, memberId: string, max: number): number => combat.hp[memberId] ?? max

export const isDown = (combat: Combat, memberId: string): boolean => combat.hp[memberId] === 0

/** Players have no HP here, so they are never down; an entry with no members left counts as down. */
export function isEntryDown(combat: Combat, entry: InitiativeEntry, groups: EncounterGroup[]): boolean {
	if (entry.kind === 'player') return false
	return entryMemberIds(entry, groups).every((id) => isDown(combat, id))
}

/** Skips entries whose every member is down; passing the end of the order starts the next round. */
export function nextTurn(combat: Combat, groups: EncounterGroup[]): Combat {
	const count = combat.order.length
	if (count === 0) return combat
	for (let step = 1; step <= count; step++) {
		const raw = combat.turn + step
		if (!isEntryDown(combat, combat.order[raw % count], groups)) {
			return refillLegendary({ ...combat, turn: raw % count, round: combat.round + Math.floor(raw / count) }, groups)
		}
	}
	return refillLegendary({ ...combat, turn: (combat.turn + 1) % count, round: combat.round + Math.floor((combat.turn + 1) / count) }, groups)
}

/** Legendary actions come back at the start of the monster's own turn. */
function refillLegendary(combat: Combat, groups: EncounterGroup[]): Combat {
	const entry = combat.order[combat.turn]
	if (!entry || !combat.uses) return combat
	let uses = combat.uses
	for (const id of entryMemberIds(entry, groups)) {
		if (uses[id]?.[LEGENDARY_ACTIONS_KEY] === undefined) continue
		const member = { ...uses[id] }
		delete member[LEGENDARY_ACTIONS_KEY]
		uses = { ...uses, [id]: member }
	}
	return uses === combat.uses ? combat : { ...combat, uses }
}

export const usedCount = (combat: Combat, memberId: string, key: string): number => combat.uses?.[memberId]?.[key] ?? 0

export function setUsed(combat: Combat, memberId: string, key: string, used: number): Combat {
	const member = { ...combat.uses?.[memberId] }
	if (used > 0) member[key] = used
	else delete member[key]
	return { ...combat, uses: { ...combat.uses, [memberId]: member } }
}

/** Clicking a filled box empties it and every box after it; clicking an empty one fills up to it. */
export function toggleUseBox(combat: Combat, memberId: string, key: string, box: number): Combat {
	const used = usedCount(combat, memberId, key)
	return setUsed(combat, memberId, key, box < used ? box : box + 1)
}

export const isInLair = (combat: Combat, memberId: string): boolean => combat.lair?.[memberId] === true

export function toggleLair(combat: Combat, memberId: string): Combat {
	const lair = { ...combat.lair }
	if (lair[memberId]) delete lair[memberId]
	else lair[memberId] = true
	return { ...combat, lair }
}

export const rollD6 = (): number => 1 + Math.floor(Math.random() * 6)

/** A roll at or above the recharge number makes the ability ready again. */
export function rollRecharge(combat: Combat, memberId: string, key: string, from: number, roll: () => number = rollD6): { combat: Combat; roll: number; success: boolean } {
	const value = roll()
	const success = value >= from
	return { combat: success ? setUsed(combat, memberId, key, 0) : combat, roll: value, success }
}

/** With advantage two d20, the higher counts. Down members are not rolled for. */
export function rollSaves(
	combat: Combat,
	memberIds: string[],
	ability: AbilityKey,
	dc: number,
	bonusOf: (memberId: string) => number,
	roll: () => number = rollD20,
): Combat {
	const saveResults = { ...combat.saveResults }
	for (const id of memberIds) {
		if (isDown(combat, id)) continue
		const d20 = combat.adv[id] ? Math.max(roll(), roll()) : roll()
		const total = d20 + bonusOf(id)
		saveResults[id] = { ability, total, success: total >= dc }
	}
	return { ...combat, saveResults }
}

export function flipSave(combat: Combat, memberId: string): Combat {
	const result = combat.saveResults[memberId]
	if (!result) return combat
	return { ...combat, saveResults: { ...combat.saveResults, [memberId]: { ...result, success: !result.success } } }
}

/** Without a chosen save everyone takes full damage; with one, a success takes half (rounded down) or none. Results clear afterwards. */
export function applyDamage(combat: Combat, memberIds: string[], amount: number, saveChosen: boolean, onSuccess: OnSuccess, maxOf: (memberId: string) => number): Combat {
	const hp = { ...combat.hp }
	for (const id of memberIds) {
		const result = saveChosen ? combat.saveResults[id] : undefined
		const taken = result?.success ? (onSuccess === 'half' ? Math.floor(amount / 2) : 0) : amount
		hp[id] = Math.max(0, currentHp(combat, id, maxOf(id)) - taken)
	}
	return { ...combat, hp, saveResults: {} }
}

export function applyHeal(combat: Combat, memberIds: string[], amount: number, maxOf: (memberId: string) => number): Combat {
	const hp = { ...combat.hp }
	for (const id of memberIds) hp[id] = Math.min(maxOf(id), currentHp(combat, id, maxOf(id)) + amount)
	return { ...combat, hp }
}

export function addCondition(combat: Combat, memberIds: string[], condition: string): Combat {
	const conditions = { ...combat.conditions }
	for (const id of memberIds) {
		const current = conditions[id] ?? []
		if (!current.includes(condition)) conditions[id] = [...current, condition]
	}
	return { ...combat, conditions }
}

export function removeCondition(combat: Combat, memberId: string, condition: string): Combat {
	const remaining = (combat.conditions[memberId] ?? []).filter((name) => name !== condition)
	const conditions = { ...combat.conditions }
	if (remaining.length === 0) delete conditions[memberId]
	else conditions[memberId] = remaining
	return { ...combat, conditions }
}

export function toggleAdv(combat: Combat, memberId: string): Combat {
	const adv = { ...combat.adv }
	if (adv[memberId]) delete adv[memberId]
	else adv[memberId] = true
	return { ...combat, adv }
}
