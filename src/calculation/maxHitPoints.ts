/*
 * Maximum hit points (build order step 8, slice 8a). A new file rather than an
 * addition to the step 4 calculation modules (D47).
 *
 *   sum of the per-level contributions (no Constitution in any of them)
 * + Constitution modifier × total character level
 * + the per-level bonus table below
 *
 * Constitution is applied ONCE here, multiplied by the level count, instead of
 * being baked into each stored level: raising Constitution raises hit points
 * retroactively for every level already gained, and a stored per-level total
 * that included it would quietly stay low (Character.hitPointLevels).
 *
 * THE BONUS TABLE IS A DELIBERATE EXCEPTION TO D21. The prior investigation
 * (docs/REPORT.md) established that the data carry no structured field for a
 * hit point bonus at all — the amount, the frequency and the level it scales
 * on are prose in `entries` and nothing else. A text rule finds candidates but
 * cannot sort them: 7 of its 10 hits do not raise the maximum, and the three
 * that do each phrase the per-level part differently. So the AMOUNT is
 * hand-written; WHETHER the character has the feature is not — that comes from
 * the granted-feature set (D87), the taken feats and the species' own traits,
 * matched by feature name, never by class, species or subclass name.
 */

import type { Character } from '../storage/character'
import { computeAbilityScore } from './abilityScores'
import type { FeatEffectEntry } from './featEffects'
import { computeHitDicePool, type ClassHitDie } from './hitDice'
import { type Calculated, type Contribution, known, unknown } from './types'

/**
 * Which level a bonus' per-level part multiplies. Draconic Resilience scales on
 * SORCERER level, not character level; today the app is single-class so the two
 * always agree, but multiclass is build order step 10 and an axis the table
 * never recorded could not be recovered then.
 */
export type HitPointBonusAxis = { kind: 'characterLevel' } | { kind: 'classLevel'; className: string; classSource: string }

export interface HitPointBonusRule {
	/** Granted once, regardless of level. */
	flat: number
	/** Granted again for every level on `axis`. */
	perLevel: number
	axis: HitPointBonusAxis
}

/**
 * The three features in the whole data set that raise the maximum once per
 * level. Keyed by the feature's own name as the data writes it; all three names
 * are unique across feats.json, subclass-features.json and the species traits
 * (scripts/investigate-hp-bonus-names.js). Boon of Fortitude's one-off +40 at
 * level 19 is deliberately absent — see docs/QUESTIONS.md.
 */
export const HIT_POINT_BONUS_RULES: Readonly<Record<string, HitPointBonusRule>> = {
	Tough: { flat: 0, perLevel: 2, axis: { kind: 'characterLevel' } },
	'Dwarven Toughness': { flat: 0, perLevel: 1, axis: { kind: 'characterLevel' } },
	'Draconic Resilience': { flat: 3, perLevel: 1, axis: { kind: 'classLevel', className: 'Sorcerer', classSource: 'XPHB' } },
}

/** The PHB's fixed value for a level that is neither rolled nor maximised: half the die rounded down, plus one. */
export function fixedAverage(faces: number): number {
	return Math.floor(faces / 2) + 1
}

function describeAxis(axis: HitPointBonusAxis): string {
	return axis.kind === 'characterLevel' ? 'character level' : `${axis.className} level`
}

function levelOnAxis(character: Character, axis: HitPointBonusAxis): number | null {
	if (axis.kind === 'characterLevel') return character.classes.reduce((sum, entry) => sum + entry.level, 0)
	const entry = character.classes.find((c) => c.className === axis.className && c.classSource === axis.classSource)
	return entry ? entry.level : null
}

/**
 * `bonusFeatureNames` is every feature name the character has from any source —
 * granted class/subclass features, taken feats, species traits. Only the three
 * names in HIT_POINT_BONUS_RULES are read from it; the rest are ignored, so the
 * caller can pass its whole list without filtering.
 */
export function computeMaxHitPoints(
	character: Character,
	classData: readonly ClassHitDie[],
	bonusFeatureNames: readonly string[] = [],
	feats: FeatEffectEntry[] = [],
): Calculated<number> {
	const override = character.maxHpOverride
	if (override !== undefined) {
		return known(override, [
			{ source: 'manual maximum', amount: override },
			{ source: 'computed maximum', amount: 0, note: 'not used — the manual maximum replaces it' },
		])
	}

	const pool = computeHitDicePool(character.classes, [...classData])
	if (pool.status === 'unknown') return unknown(pool.reason)
	if (pool.value.length > 1) {
		return unknown('Maximum hit points across more than one class is build order step 10 (multiclass).')
	}

	const { faces, count: totalLevel } = pool.value[0]
	const constitution = computeAbilityScore('constitution', character, feats)
	if (constitution.status === 'unknown') return unknown(constitution.reason)

	const breakdown: Contribution[] = []
	const stored = character.hitPointLevels ?? []
	const usingDefaults = stored.length === 0
	if (usingDefaults) {
		breakdown.push({
			source: 'per-level hit points',
			amount: 0,
			note: 'no choices recorded — level 1 uses the die maximum and every level after it the fixed average',
		})
	}

	for (let level = 1; level <= totalLevel; level++) {
		// Level 1 is the die maximum by rule — never rolled, never averaged — so a stored entry for it cannot change the amount.
		if (level === 1) {
			breakdown.push({ source: `level 1 (d${faces} maximum)`, amount: faces })
			continue
		}
		const entry = stored.find((candidate) => candidate.level === level)
		if (!entry) {
			breakdown.push({ source: `level ${level} (d${faces} average${usingDefaults ? '' : ', no choice recorded'})`, amount: fixedAverage(faces) })
			continue
		}
		breakdown.push({ source: `level ${level} (${entry.kind})`, amount: entry.dieResult })
		// D43: a result a d8 cannot produce is shown rather than silently trusted or silently dropped.
		if (entry.dieResult > faces) {
			breakdown.push({ source: `level ${level}`, amount: 0, note: `recorded as ${entry.dieResult}, which a d${faces} cannot roll — counted as stored` })
		}
	}

	// D43: a level above the character's own is not counted, and says so rather than vanishing.
	for (const entry of stored) {
		if (entry.level > totalLevel) {
			breakdown.push({ source: `level ${entry.level}`, amount: 0, note: `recorded but above your level (${totalLevel}) — not counted` })
		}
	}

	const constitutionModifier = constitution.value.modifier
	breakdown.push({
		source: `constitution modifier (${constitutionModifier >= 0 ? '+' : ''}${constitutionModifier}) × ${totalLevel} level${totalLevel === 1 ? '' : 's'}`,
		amount: constitutionModifier * totalLevel,
	})

	for (const [name, rule] of Object.entries(HIT_POINT_BONUS_RULES)) {
		if (!bonusFeatureNames.includes(name)) continue
		const level = levelOnAxis(character, rule.axis)
		if (level === null) {
			breakdown.push({ source: name, amount: 0, note: `not counted — you have no levels in the class its ${describeAxis(rule.axis)} counts` })
			continue
		}
		const parts = [rule.flat > 0 ? `+${rule.flat}` : null, rule.perLevel > 0 ? `+${rule.perLevel} per ${describeAxis(rule.axis)}` : null].filter(Boolean)
		breakdown.push({ source: `${name} (${parts.join(', ')})`, amount: rule.flat + rule.perLevel * level })
	}

	const total = breakdown.reduce((sum, contribution) => sum + contribution.amount, 0)
	return known(total, breakdown)
}

/**
 * D107: how much `currentHp` should move when maximum hit points goes from
 * `before` to `after` — a level up's exact gain, or a level removal's exact
 * loss. `undefined` when either side is unresolved, so the caller leaves
 * `currentHp` exactly as it was rather than guess.
 */
export function maxHitPointsDelta(before: Calculated<number>, after: Calculated<number>): number | undefined {
	return before.status === 'known' && after.status === 'known' ? after.value - before.value : undefined
}

/**
 * D107: the `currentHp` a level up or a level removal should write — `currentHp`
 * moved by exactly the amount maximum hit points moved from `before` to
 * `after`. `undefined` when `currentHp` was never set (an older character, or
 * one whose player never touched the field) or when the delta can't be
 * resolved — the caller's own "leave it as it was" default already means
 * that, matching manual editing (D9) staying possible at every other moment.
 */
export function currentHpAfterMaxHpChange(currentHp: number | undefined, before: Calculated<number>, after: Calculated<number>): number | undefined {
	if (currentHp === undefined) return undefined
	const delta = maxHitPointsDelta(before, after)
	return delta === undefined ? undefined : currentHp + delta
}
