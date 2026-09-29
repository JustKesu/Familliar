import type { Beast, BeastEntryBlock } from '../beasts/beastData'
import { abilityModifier } from '../calculation/abilityScores'
import { isAttuned } from '../calculation/attunement'
import { magicItemLabel } from '../calculation/magicBonus'
import { buildInventoryResolver, isFamiliarBonusTarget, type ItemRef } from '../inventory/inventoryData'
import type { CharacterInventoryItem } from '../storage/character'

/*
 * R14d (D220): what a custom item's Familiar bonuses do to the familiar's stat
 * block. Applied to a COPY of the Beast before it is rendered — data files are
 * never edited. Gate is D216's: the character carries the item, so a bonus
 * applies while the item is attuned (when it needs attunement) or always.
 */

interface Totals {
	ac: number
	maxHp: number
	attack: number
	damage: number
	save: number
	speed: number
}

const TOTAL_KEYS = {
	familiarArmourClass: 'ac',
	familiarMaxHitPoints: 'maxHp',
	familiarAttack: 'attack',
	familiarDamage: 'damage',
	familiarSavingThrows: 'save',
	familiarWalkingSpeed: 'speed',
} as const satisfies Record<string, keyof Totals>

const LABELS: Record<keyof Totals, string> = {
	ac: 'AC',
	maxHp: 'max HP',
	attack: 'attack rolls',
	damage: 'damage rolls',
	save: 'saving throws',
	speed: 'walking speed',
}

export interface FamiliarBonusSource {
	item: string
	/** e.g. "AC +2", "max HP +1 per level (+3)". */
	parts: string[]
	applied: boolean
}

export interface FamiliarItemBonuses extends Totals {
	sources: FamiliarBonusSource[]
}

export const NO_FAMILIAR_BONUSES: FamiliarItemBonuses = { ac: 0, maxHp: 0, attack: 0, damage: 0, save: 0, speed: 0, sources: [] }

function signed(amount: number): string {
	return amount >= 0 ? `+${amount}` : `-${Math.abs(amount)}`
}

/** D43: a row that does not resolve (malformed definition, unknown item) grants nothing. Quantity is ignored, as for the character's own bonuses. */
export function familiarItemBonuses(inventory: readonly CharacterInventoryItem[], itemRefs: readonly ItemRef[], characterLevel: number): FamiliarItemBonuses {
	const resolve = buildInventoryResolver(itemRefs)
	const totals: Totals = { ac: 0, maxHp: 0, attack: 0, damage: 0, save: 0, speed: 0 }
	const sources: FamiliarBonusSource[] = []

	for (const item of inventory) {
		const { ref } = resolve(item)
		if (!ref) continue
		const own = (ref.customBonuses ?? []).filter((bonus) => isFamiliarBonusTarget(bonus.target))
		if (own.length === 0) continue
		const applied = !(ref.requiresAttunement === true && !isAttuned(item))
		const parts: string[] = []
		for (const bonus of own) {
			const key = TOTAL_KEYS[bonus.target as keyof typeof TOTAL_KEYS]
			const perLevel = 'perLevel' in bonus && bonus.perLevel === true
			const amount = perLevel ? bonus.amount * characterLevel : bonus.amount
			if (applied) totals[key] += amount
			parts.push(perLevel ? `${LABELS[key]} ${signed(bonus.amount)} per level (${signed(amount)})` : `${LABELS[key]} ${signed(amount)}`)
		}
		sources.push({ item: magicItemLabel(ref.name, item.magicBonus ?? 0), parts, applied })
	}
	return { ...totals, sources }
}

/** The drawer's "Bonuses from items" lines; an item held but not in effect says why (D76). */
export function familiarBonusLines(bonuses: FamiliarItemBonuses): string[] {
	return bonuses.sources.map((source) => `${source.item}: ${source.parts.join(', ')}${source.applied ? '' : ' — not applied: not attuned'}`)
}

const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const

function modifierText(modifier: number): string {
	return modifier === 0 ? '' : modifier > 0 ? ` + ${modifier}` : ` - ${-modifier}`
}

/**
 * DATA.md (R14d): every familiar attack is `{@atkr m|r} {@hit N}` … `{@h}A` with an
 * optional `({@damage XdY ± K})`. The hit number and the FIRST hit damage move;
 * a rider ("plus 3 ({@damage 1d6}) Poison damage") is not part of the damage roll a
 * bonus adds to. Save-based actions carry no {@atkr} and stay as they are.
 */
export function rewriteAttackText(text: string, attack: number, damage: number): string {
	if (!text.includes('{@atkr')) return text
	return text
		.replace(/\{@hit (-?\d+)\}/, (_, hit: string) => `{@hit ${Number(hit) + attack}}`)
		.replace(/\{@h\}(\d+)(?: \(\{@damage (\d+d\d+)(?: ([+-]) (\d+))?\}\))?/, (_, flat: string, dice?: string, sign?: string, modifier?: string) => {
			const total = Number(flat) + damage
			if (dice === undefined) return `{@h}${total}`
			return `{@h}${total} ({@damage ${dice}${modifierText((sign === '-' ? -1 : 1) * Number(modifier ?? 0) + damage)}})`
		})
}

function rewriteEntries(entries: unknown[], attack: number, damage: number): unknown[] {
	return entries.map((entry) => {
		if (typeof entry === 'string') return rewriteAttackText(entry, attack, damage)
		if (typeof entry === 'object' && entry !== null && Array.isArray((entry as { entries?: unknown }).entries)) {
			return { ...entry, entries: rewriteEntries((entry as { entries: unknown[] }).entries, attack, damage) }
		}
		return entry
	})
}

function rewriteBlocks(blocks: BeastEntryBlock[] | undefined, attack: number, damage: number): BeastEntryBlock[] | undefined {
	return blocks?.map((block) => (block.entries ? { ...block, entries: rewriteEntries(block.entries, attack, damage) } : block))
}

/** A copy of `beast` with the item bonuses in its numbers; the same object when there is nothing to apply. */
export function applyFamiliarBonuses(beast: Beast, bonuses: FamiliarItemBonuses): Beast {
	if (bonuses.ac === 0 && bonuses.maxHp === 0 && bonuses.attack === 0 && bonuses.damage === 0 && bonuses.save === 0 && bonuses.speed === 0) return beast
	const next: Beast = { ...beast }
	if (bonuses.ac !== 0) next.ac = beast.ac.map((ac) => ac + bonuses.ac)
	if (bonuses.maxHp !== 0 && beast.hp.average !== undefined) {
		next.hp = { average: beast.hp.average + bonuses.maxHp, ...(beast.hp.formula ? { formula: `${beast.hp.formula}${modifierText(bonuses.maxHp)}` } : {}) }
	}
	if (bonuses.save !== 0) {
		next.save = Object.fromEntries(
			ABILITY_KEYS.map((key) => {
				const listed = Number(beast.save?.[key])
				return [key, signed((Number.isFinite(listed) ? listed : abilityModifier(beast[key])) + bonuses.save)]
			}),
		)
	}
	const walk = beast.speed.walk
	const walkAmount = typeof walk === 'number' ? walk : walk?.amount
	if (bonuses.speed !== 0 && walk !== undefined && walkAmount !== undefined && walkAmount > 0) {
		const amount = Math.max(0, walkAmount + bonuses.speed)
		next.speed = { ...beast.speed, walk: typeof walk === 'number' ? amount : { ...walk, amount } }
	}
	if (bonuses.attack !== 0 || bonuses.damage !== 0) {
		for (const field of ['trait', 'action', 'bonus', 'reaction'] as const) {
			const blocks = rewriteBlocks(beast[field], bonuses.attack, bonuses.damage)
			if (blocks) next[field] = blocks
		}
	}
	return next
}
