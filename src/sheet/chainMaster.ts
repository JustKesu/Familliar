import type { Beast, BeastEntryBlock } from '../beasts/beastData'
import { heldInvocations } from '../featAsi/featInstances'
import type { Character, ChainMasterDamage, ChainMasterForm, CharacterFamiliar } from '../storage/character'

/*
 * C-1 (D380): Investment of the Chain Master on the familiar. Applied to a COPY of
 * the Beast like applyFamiliarBonuses (D220) — data files are never edited.
 */

export const INVESTMENT_OF_THE_CHAIN_MASTER = { name: 'Investment of the Chain Master', source: 'XPHB' }

export function holdsChainMaster(character: Pick<Character, 'optionalFeatureChoices' | 'inventory'>): boolean {
	return heldInvocations(character).some((invocation) => invocation.name === INVESTMENT_OF_THE_CHAIN_MASTER.name && (invocation.source ?? 'XPHB') === INVESTMENT_OF_THE_CHAIN_MASTER.source)
}

export interface ChainMasterEffect {
	form?: ChainMasterForm | undefined
	damage?: ChainMasterDamage | undefined
	/** The DC every familiar save uses; null leaves the data's DC. */
	saveDc: number | null
}

export function chainMasterEffect(familiar: CharacterFamiliar, saveDc: number | null): ChainMasterEffect {
	return { form: familiar.chainMasterForm, damage: familiar.chainMasterDamage, saveDc }
}

/** D380 (c): the Warlock's DC; with no Warlock (invocation from an item) the highest the character has; none leaves the data's. */
export function chainMasterSaveDc(sources: readonly { className?: string; spellSaveDC: number }[]): number | null {
	const warlock = sources.find((source) => source.className === 'Warlock')
	if (warlock) return warlock.spellSaveDC
	return sources.length > 0 ? Math.max(...sources.map((source) => source.spellSaveDC)) : null
}

const DAMAGE_LABEL: Record<ChainMasterDamage, string> = { necrotic: 'Necrotic', radiant: 'Radiant' }

/** DATA.md (C-1): every B/P/S type sits in an {@atkr} string as "<Type> damage"; a save DC is always `{@actSave x} {@dc N}` — a bare {@dc} (Raven's Mimicry) is a check, not a save. */
export function rewriteChainMasterText(text: string, effect: ChainMasterEffect): string {
	let next = text
	if (effect.damage && next.includes('{@atkr')) next = next.replace(/\b(?:Bludgeoning|Piercing|Slashing) damage\b/g, `${DAMAGE_LABEL[effect.damage]} damage`)
	if (effect.saveDc !== null) next = next.replace(/(\{@actSave \w+\} )\{@dc \d+\}/g, `$1{@dc ${effect.saveDc}}`)
	return next
}

function rewriteEntries(entries: unknown[], effect: ChainMasterEffect): unknown[] {
	return entries.map((entry) => {
		if (typeof entry === 'string') return rewriteChainMasterText(entry, effect)
		if (typeof entry === 'object' && entry !== null && Array.isArray((entry as { entries?: unknown }).entries)) {
			return { ...entry, entries: rewriteEntries((entry as { entries: unknown[] }).entries, effect) }
		}
		return entry
	})
}

const SPEED_MODE: Record<ChainMasterForm, 'fly' | 'swim'> = { aerial: 'fly', aquatic: 'swim' }

/** A copy of `beast` with the invocation's speed, damage type and save DC. */
export function applyChainMaster(beast: Beast, effect: ChainMasterEffect): Beast {
	const next: Beast = { ...beast }
	if (effect.form) {
		const mode = SPEED_MODE[effect.form]
		const current = beast.speed[mode]
		const amount = typeof current === 'number' ? current : (current?.amount ?? 0)
		if (amount < 40) next.speed = { ...beast.speed, [mode]: typeof current === 'object' ? { ...current, amount: 40 } : 40 }
	}
	if (effect.damage || effect.saveDc !== null) {
		for (const field of ['trait', 'action', 'bonus', 'reaction'] as const) {
			const blocks = beast[field]?.map((block): BeastEntryBlock => (block.entries ? { ...block, entries: rewriteEntries(block.entries, effect) } : block))
			if (blocks) next[field] = blocks
		}
	}
	return next
}
