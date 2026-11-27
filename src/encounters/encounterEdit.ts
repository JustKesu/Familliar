import type { EncounterGroup } from './encounterStore'

export const MAX_GROUP_COUNT = 99

const newId = (): string => crypto.randomUUID()

export function defaultMemberName(monsterName: string, index: number, count: number): string {
	return count === 1 ? monsterName : `${monsterName} ${index + 1}`
}

export function newGroup(monster: { name: string; source: string }): EncounterGroup {
	return { id: newId(), monster: { name: monster.name, source: monster.source }, oneInitiative: false, members: [{ id: newId(), name: monster.name }] }
}

/** Members still carrying their default name follow the new numbering; a renamed one keeps its name. Ids survive (MON-4 keys on them). */
export function setGroupCount(group: EncounterGroup, count: number): EncounterGroup {
	const next = Math.max(1, Math.min(MAX_GROUP_COUNT, Math.trunc(count)))
	const previous = group.members.length
	if (next === previous) return group
	const base = group.monster.name
	const kept = group.members.slice(0, next).map((member, index) =>
		member.name === defaultMemberName(base, index, previous) ? { ...member, name: defaultMemberName(base, index, next) } : member,
	)
	const added = Array.from({ length: Math.max(0, next - previous) }, (_, i) => ({ id: newId(), name: defaultMemberName(base, previous + i, next) }))
	const oneInitiative = previous === 1 && next > 1 ? true : next === 1 ? false : group.oneInitiative
	return { ...group, oneInitiative, members: [...kept, ...added] }
}

/** Adding a monster already in the encounter raises that group's count instead of starting a second group. */
export function addMonster(groups: EncounterGroup[], monster: { name: string; source: string }): EncounterGroup[] {
	const index = groups.findIndex((group) => group.monster.name === monster.name && group.monster.source === monster.source)
	if (index === -1) return [...groups, newGroup(monster)]
	return groups.map((group, i) => (i === index ? setGroupCount(group, group.members.length + 1) : group))
}
