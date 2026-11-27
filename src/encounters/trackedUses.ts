import type { Monster } from '../monsters/monsterData'

export const LEGENDARY_ACTIONS_KEY = 'legendary-actions'

export interface TrackedUse {
	key: string
	name: string
	/** "3/Day", "3 per round, refills at the start of its turn", "Recharge 5-6". */
	note: string
	total: number
	/** Row abbreviation, e.g. "LR" for Legendary Resistance. */
	short: string
	/** Lowest d6 face that recharges it; only on recharge abilities. */
	recharge?: number
}

const BLOCK_KINDS = ['trait', 'action', 'bonus', 'reaction', 'legendary'] as const

/** "{@spell Geas|XPHB}" -> "Geas"; recharge tags are dropped because the note carries them. */
export function plainName(name: string): string {
	return name
		.replace(/\{@recharge[^}]*\}/g, '')
		.replace(/\{@\w+ ([^|}]*)[^}]*\}/g, '$1')
		.replace(/\s+/g, ' ')
		.trim()
}

const withoutParens = (name: string): string => plainName(name.replace(/\s*\([^)]*\)/g, ''))

function abbreviation(name: string): string {
	const words = name.split(/\s+/).filter(Boolean)
	return words.length > 1 ? words.map((word) => word[0].toUpperCase()).join('') : name.slice(0, 6)
}

/** docs/DATA.md MON-5: "in Domain" (17 Ravenloft-style lords) is treated as "in Lair". */
const DAY = /\((?:[^)]*;\s*)?(\d+)\/Day(?:,\s*or\s*(\d+)\/Day in (?:Lair|Domain))?\)/i

export function hasLairUses(monster: Monster): boolean {
	return BLOCK_KINDS.some((kind) => (monster[kind] ?? []).some((block) => DAY.exec(block.name ?? '')?.[2] !== undefined)) || monster.legendaryActionsLair !== undefined
}

function spellUses(monster: Monster): TrackedUse[] {
	const uses: TrackedUse[] = []
	;(monster.spellcasting ?? []).forEach((block, blockIndex) => {
		for (const [field, label] of [
			['daily', 'Day'],
			['restLong', 'Long Rest'],
		] as const) {
			for (const [key, spells] of Object.entries(block[field] ?? {})) {
				const total = Number.parseInt(key, 10)
				if (!Number.isInteger(total) || total < 1) continue
				const note = `${total}/${label}`
				const names = spells.map(plainName)
				if (key.endsWith('e')) {
					names.forEach((name, index) => uses.push({ key: `s:${blockIndex}:${field}:${key}:${index}`, name, note: `${note} each`, total, short: abbreviation(withoutParens(name)) }))
				} else {
					uses.push({ key: `s:${blockIndex}:${field}:${key}`, name: names.join(', '), note: `${note} shared`, total, short: abbreviation(withoutParens(names[0] ?? 'Spell')) })
				}
			}
		}
	})
	return uses
}

export function trackedUses(monster: Monster, inLair: boolean): TrackedUse[] {
	const uses: TrackedUse[] = []
	for (const kind of BLOCK_KINDS) {
		for (const block of monster[kind] ?? []) {
			const raw = block.name ?? ''
			const day = DAY.exec(raw)
			const name = withoutParens(raw)
			if (day) {
				const total = Number(inLair && day[2] ? day[2] : day[1])
				uses.push({ key: `d:${kind}:${name}`, name, note: `${total}/Day`, total, short: abbreviation(name) })
			}
			const recharge = /\{@recharge ?(\d*)\}/.exec(raw)
			if (recharge) {
				const from = recharge[1] === '' ? 6 : Number(recharge[1])
				uses.push({ key: `r:${kind}:${name}`, name, note: from === 6 ? 'Recharge 6' : `Recharge ${from}-6`, total: 1, short: abbreviation(name), recharge: from })
			}
		}
	}
	if ((monster.legendary ?? []).length > 0) {
		const total = (inLair ? monster.legendaryActionsLair : undefined) ?? monster.legendaryActions ?? 3
		uses.push({ key: LEGENDARY_ACTIONS_KEY, name: 'Legendary Actions', note: `${total} per round, refills at the start of its turn`, total, short: 'LA' })
	}
	return [...uses, ...spellUses(monster)]
}
