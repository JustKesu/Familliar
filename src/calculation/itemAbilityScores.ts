import type { Ability } from '../abilities/abilityScores'
import type { Contribution } from './types'

export type ItemAbilityEffect = { kind: 'set'; score: number } | { kind: 'add'; amount: number; max: number }

/** One item's effect on one ability score. `effect` is absent only for an effect the app cannot apply at all (Book of Vile Darkness's choice), which then always carries `withheldReason`. */
export interface ItemAbilityGrant {
	sourceName: string
	ability: Ability
	effect?: ItemAbilityEffect
	withheldReason?: string
}

function describe(effect: ItemAbilityEffect): string {
	return effect.kind === 'set' ? `set to ${effect.score}` : `+${effect.amount}, maximum ${effect.max}`
}

/**
 * D221: additions first, each capped at its own maximum and never lowering a
 * score already above it; then set-to, which applies only when higher, the
 * highest of several winning. `before` is base + background + feats.
 */
export function itemAbilityScoreContributions(ability: Ability, before: number, grants: readonly ItemAbilityGrant[]): Contribution[] {
	const lines: Contribution[] = []
	const adds: { grant: ItemAbilityGrant; effect: Extract<ItemAbilityEffect, { kind: 'add' }> }[] = []
	const sets: { grant: ItemAbilityGrant; effect: Extract<ItemAbilityEffect, { kind: 'set' }> }[] = []

	for (const grant of grants) {
		if (grant.ability !== ability) continue
		const { effect } = grant
		if (grant.withheldReason !== undefined || !effect) {
			const considered = effect ? `considered (${describe(effect)}) — ` : ''
			lines.push({ source: grant.sourceName, amount: 0, note: `${considered}not applied: ${grant.withheldReason}` })
		} else if (effect.kind === 'add') {
			adds.push({ grant, effect })
		} else {
			sets.push({ grant, effect })
		}
	}

	let score = before
	for (const { grant, effect } of adds) {
		const amount = Math.max(0, Math.min(effect.amount, effect.max - score))
		const source = `${grant.sourceName}: ${describe(effect)}`
		if (amount === 0) lines.push({ source, amount: 0, note: `no effect: the score is already ${score}` })
		else lines.push({ source, amount, ...(amount < effect.amount ? { note: `capped at ${effect.max}` } : {}) })
		score += amount
	}

	sets.sort((a, b) => b.effect.score - a.effect.score)
	const winner = sets[0]
	for (const { grant, effect } of sets) {
		const source = `${grant.sourceName}: ${describe(effect)}`
		if (grant === winner.grant && effect.score > score) {
			lines.push({ source, amount: effect.score - score })
		} else if (grant === winner.grant) {
			lines.push({ source, amount: 0, note: `no effect: the score is already ${score}` })
		} else {
			lines.push({ source, amount: 0, note: `no effect: ${winner.grant.sourceName} sets a score at least as high` })
		}
	}
	return lines
}
