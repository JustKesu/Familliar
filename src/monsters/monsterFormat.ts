import { SIZE_LABELS, formatModifier, titleCase } from '../sheet/BeastStatBlock'
import { monsterProficiencyBonus, type Monster, type MonsterDefenceEntry, type MonsterEntryBlock, type MonsterSpeedValue, type MonsterSpellcastingBlock } from './monsterData'

const ALIGNMENT_WORDS: Record<string, string> = {
	L: 'Lawful',
	N: 'Neutral',
	C: 'Chaotic',
	G: 'Good',
	E: 'Evil',
	U: 'Unaligned',
	A: 'Any alignment',
}

export function formatAlignment(alignment: string[] | undefined): string {
	if (!alignment || alignment.length === 0) return ''
	return alignment.map((code) => ALIGNMENT_WORDS[code] ?? code).join(' ')
}

export function formatMonsterType(type: Monster['type']): string {
	if (typeof type === 'string') return titleCase(type)
	const base = typeof type.type === 'string' ? titleCase(type.type) : type.type.choose.map(titleCase).join(' or ')
	if (type.swarmSize) return `Swarm of ${SIZE_LABELS[type.swarmSize] ?? type.swarmSize} ${base}s`
	if (type.tags && type.tags.length > 0) return `${base} (${type.tags.map(titleCase).join(', ')})`
	return base
}

function speedValue(value: MonsterSpeedValue): string {
	if (typeof value === 'number') return `${value} ft.`
	const amount = value.number ?? value.amount
	return [amount === undefined ? '' : `${amount} ft.`, value.condition ?? value.note ?? ''].filter(Boolean).join(' ')
}

export function formatMonsterSpeed(speed: Monster['speed']): string {
	const parts: string[] = []
	const walk = speed.walk
	if (typeof walk === 'number' || (typeof walk === 'object' && !Array.isArray(walk))) parts.push(speedValue(walk as MonsterSpeedValue))
	for (const [mode, value] of Object.entries(speed)) {
		if (mode === 'walk' || mode === 'canHover' || typeof value === 'boolean') continue
		if (mode === 'alternate') {
			for (const [altMode, altValues] of Object.entries(value as Record<string, MonsterSpeedValue[]>)) {
				for (const altValue of altValues) parts.push(`${altMode} ${speedValue(altValue)}`)
			}
			continue
		}
		if (mode === 'choose' && typeof value === 'object' && 'from' in value && Array.isArray(value.from)) {
			parts.push(`${value.from.join(' or ')} ${speedValue(value as MonsterSpeedValue)}`)
			continue
		}
		parts.push(`${mode} ${speedValue(value as MonsterSpeedValue)}`)
	}
	return parts.join(', ')
}

export function formatAc(ac: Monster['ac']): string {
	return ac.map((value) => (typeof value === 'number' ? `${value}` : value.from?.length ? `${value.ac} (${value.from.join(', ')})` : `${value.ac}`)).join(', ')
}

export function defenceText(entry: MonsterDefenceEntry): string {
	if (typeof entry === 'string') return titleCase(entry)
	if (typeof entry.special === 'string') return entry.special
	const list = Object.values(entry).find((value): value is string[] => Array.isArray(value)) ?? []
	return [list.map(titleCase).join(', '), typeof entry.note === 'string' ? entry.note : ''].filter(Boolean).join(' ')
}

const DAILY_LABEL = /^(\d)(e?)$/

/** The spell lists a block does not already spell out in its header (`hidden`), as markup lines. */
function spellListLines(block: MonsterSpellcastingBlock): string[] {
	const hidden = new Set(block.hidden ?? [])
	const lines: string[] = []
	if (block.will && !hidden.has('will')) lines.push(`At will: ${block.will.join(', ')}`)
	if (block.daily && !hidden.has('daily')) {
		for (const [key, spells] of Object.entries(block.daily)) {
			const match = DAILY_LABEL.exec(key)
			const label = match ? `${match[1]}/day${match[2] ? ' each' : ''}` : key
			lines.push(`${label}: ${spells.join(', ')}`)
		}
	}
	if (block.restLong && !hidden.has('restLong')) {
		for (const [key, spells] of Object.entries(block.restLong)) lines.push(`${key}/long rest: ${spells.join(', ')}`)
	}
	if (block.recharge && !hidden.has('recharge')) {
		for (const [key, spells] of Object.entries(block.recharge)) lines.push(`{@recharge ${key}}: ${spells.join(', ')}`)
	}
	if (block.legendary && !hidden.has('legendary')) {
		for (const [key, spells] of Object.entries(block.legendary)) lines.push(`Costs ${key}: ${spells.join(', ')}`)
	}
	return lines
}

export type BlockSection = 'action' | 'bonus' | 'reaction' | 'legendary'

export function spellcastingFor(monster: Monster, section: BlockSection): MonsterEntryBlock[] {
	return (monster.spellcasting ?? [])
		.filter((block) => (block.displayAs ?? 'action') === section)
		.map((block) => ({ name: block.name, entries: [...(block.headerEntries ?? []), ...spellListLines(block)] }))
}

export function legendaryUsesText(monster: Pick<Monster, 'legendaryActions' | 'legendaryActionsLair'>): string {
	const uses = monster.legendaryActions ?? 3
	return monster.legendaryActionsLair === undefined ? `Legendary Action Uses: ${uses}.` : `Legendary Action Uses: ${uses} (${monster.legendaryActionsLair} in Lair).`
}

export function challengeText(monster: Monster): string {
	const xp = monster.xp === undefined ? '' : `XP ${monster.xp.toLocaleString('en-US')}`
	const lair = monster.xpLair === undefined ? '' : `, or ${monster.xpLair.toLocaleString('en-US')} in lair`
	const pb = `PB ${formatModifier(monsterProficiencyBonus(monster))}`
	return `${monster.cr} (${xp ? `${xp}${lair}; ` : ''}${pb})`
}
