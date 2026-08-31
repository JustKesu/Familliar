/*
 * Armour Class (build order step 7, slice b). A NEW file in this folder per
 * D47 — nothing from step 4 is rewritten to make room for it.
 *
 * Pure (D38): the equipped items are resolved against items.json by the
 * caller and handed in, and so is the list of alternative formulas the
 * character is eligible for (src/sheet/armourClassData.ts works those out).
 *
 * Two things the data does NOT say, so they are written here as rules:
 *  - the Dexterity cap per armour category (light uncapped, medium +2, heavy
 *    none). DATA.md, "Armour AC — the data won't tell you": there is no
 *    cap field, only the LA/MA/HA type code.
 *  - which formulas a Shield may be combined with. Each feature's own text
 *    says so (Barbarian "You can use a Shield and still gain this benefit",
 *    Monk "aren't wearing armor or wielding a Shield").
 */

import type { Ability } from '../abilities/abilityScores'
import type { Character } from '../storage/character'
import { ABILITY_ABBREVIATIONS } from './abilityAbbreviations'
import { computeAbilityScore } from './abilityScores'
import type { FeatEffectEntry } from './featEffects'
import { type Calculated, type Contribution, known, unknown } from './types'

export type ArmourCategory = 'light' | 'medium' | 'heavy'

/** The Dex cap is a PHB rule, not a data field (DATA.md, "Armour AC"). Infinity = uncapped, null = no Dexterity bonus at all. */
const DEX_CAP_BY_CATEGORY: Record<ArmourCategory, number | null> = { light: Infinity, medium: 2, heavy: null }

const CATEGORY_LABELS: Record<ArmourCategory, string> = { light: 'light armour', medium: 'medium armour', heavy: 'heavy armour' }

/** One equipped suit of armour, already resolved against items.json by the caller. */
export interface EquippedArmour {
	name: string
	category: ArmourCategory
	/** The suit's base AC (items.json `ac`). */
	ac: number
	/** items.json `strength`, parsed from its string form; null when the suit has no requirement. */
	strengthRequirement: number | null
	stealthDisadvantage: boolean
}

/** An equipped shield. DATA.md: a shield's items.json `ac` is the BONUS it adds (always 2), never a finished Armour Class. */
export interface EquippedShield {
	name: string
	acBonus: number
}

/** What the character has in use, plus what could not be resolved or is owned but not worn. */
export interface EquippedGear {
	armour: EquippedArmour | null
	shield: EquippedShield | null
	/** Equipped items whose (name, source) matched nothing in items.json (D43). */
	unresolved: { name: string; source: string }[]
	/** Names of armour the character owns but is not wearing — so a low AC has a stated reason rather than looking like a bug. */
	carriedArmourNotWorn: string[]
}

export type AcFormulaKey = 'barbarian-unarmored-defense' | 'monk-unarmored-defense' | 'draconic-resilience' | 'dance-unarmored-defense' | 'mage-armor'

interface AcFormula {
	label: string
	base: number
	abilities: Ability[]
	/** The feature's own text decides this; see the module comment. */
	shieldAllowed: boolean
	/**
	 * Set when the app can see the character HAS the effect but not that it is
	 * ACTIVE. Such a formula is listed in the breakdown as considered and never
	 * wins — Daniel's decision this session for Mage Armor: a prepared spell is
	 * not a cast one, and casting is play tracking (build order step 9).
	 */
	notAppliedReason?: string
}

export const AC_FORMULAS: Record<AcFormulaKey, AcFormula> = {
	'barbarian-unarmored-defense': {
		label: 'Unarmored Defense (Barbarian)',
		base: 10,
		abilities: ['dexterity', 'constitution'],
		shieldAllowed: true,
	},
	'monk-unarmored-defense': {
		label: 'Unarmored Defense (Monk)',
		base: 10,
		abilities: ['dexterity', 'wisdom'],
		shieldAllowed: false,
	},
	'draconic-resilience': {
		label: 'Draconic Resilience',
		base: 10,
		abilities: ['dexterity', 'charisma'],
		shieldAllowed: true,
	},
	'dance-unarmored-defense': {
		label: 'Unarmored Defense (College of Dance)',
		base: 10,
		abilities: ['dexterity', 'charisma'],
		shieldAllowed: false,
	},
	'mage-armor': {
		label: 'Mage Armor',
		base: 13,
		abilities: ['dexterity'],
		shieldAllowed: true,
		notAppliedReason: 'only while the spell is cast, which this app does not track yet',
	},
}

export interface ArmourClassValue {
	value: number
	/**
	 * Non-empty when an equipped item could not be found in the item data
	 * (D43). The number is still computed from everything that did resolve —
	 * the caller must show that it is incomplete and which item is missing.
	 */
	incomplete: string[]
	/** Equipped armour that imposes disadvantage on Stealth checks. Displayed only; nothing computes with it. */
	stealthDisadvantage: string[]
}

/** One way of arriving at an Armour Class, before the shield is added. */
interface Candidate {
	label: string
	total: number
	/** The rows that make this candidate's own total, used only if it wins. */
	rows: Contribution[]
	/** How the candidate reads in a losing row: "10 + Dex + Con = 15". */
	formula: string
	notAppliedReason?: string
}

function abilityAbbreviation(ability: Ability): string {
	const code = ABILITY_ABBREVIATIONS[ability]
	return code.charAt(0).toUpperCase() + code.slice(1)
}

function armourCandidate(armour: EquippedArmour, dexterity: number): Candidate {
	const cap = DEX_CAP_BY_CATEGORY[armour.category]
	const rows: Contribution[] = [{ source: `${armour.name} (${CATEGORY_LABELS[armour.category]})`, amount: armour.ac }]

	if (cap === null) {
		rows.push({ source: 'dexterity modifier', amount: 0, note: `${CATEGORY_LABELS[armour.category]} allows no Dexterity bonus` })
	} else if (dexterity > cap) {
		rows.push({ source: 'dexterity modifier', amount: cap, note: `capped at +${cap} by ${CATEGORY_LABELS[armour.category]}` })
	} else {
		rows.push({ source: 'dexterity modifier', amount: dexterity })
	}

	const total = rows.reduce((sum, row) => sum + row.amount, 0)
	return { label: armour.name, total, rows, formula: `${armour.ac} + Dex = ${total}` }
}

function unarmouredCandidate(dexterity: number, carriedArmourNotWorn: string[]): Candidate {
	const note =
		carriedArmourNotWorn.length > 0
			? `no armour equipped — ${carriedArmourNotWorn.join(', ')} ${carriedArmourNotWorn.length === 1 ? 'is' : 'are'} carried but not worn`
			: 'no armour equipped'
	return {
		label: 'unarmoured',
		total: 10 + dexterity,
		rows: [
			{ source: 'armour', amount: 0, note },
			{ source: 'unarmoured base', amount: 10 },
			{ source: 'dexterity modifier', amount: dexterity },
		],
		formula: `10 + Dex = ${10 + dexterity}`,
	}
}

function formulaCandidate(key: AcFormulaKey, modifiers: Record<Ability, number>): Candidate {
	const formula = AC_FORMULAS[key]
	const rows: Contribution[] = [
		{ source: `${formula.label} base`, amount: formula.base },
		...formula.abilities.map((ability) => ({ source: `${ability} modifier`, amount: modifiers[ability] })),
	]
	const total = rows.reduce((sum, row) => sum + row.amount, 0)
	return {
		label: formula.label,
		total,
		rows,
		formula: `${formula.base} + ${formula.abilities.map(abilityAbbreviation).join(' + ')} = ${total}`,
		...(formula.notAppliedReason ? { notAppliedReason: formula.notAppliedReason } : {}),
	}
}

/**
 * The alternative formulas do NOT stack: a character eligible for more than
 * one uses the single best result. Every candidate the character was eligible
 * for still appears in the breakdown — the winner with its real rows, each
 * loser as a zero-amount note saying what it would have given and why it did
 * not apply (D60's mechanism, the same way darkvision reconciles its sources).
 */
export function computeArmourClass(character: Character, gear: EquippedGear, formulaKeys: AcFormulaKey[] = [], feats: FeatEffectEntry[] = []): Calculated<ArmourClassValue> {
	const abilities: Ability[] = ['dexterity', 'constitution', 'wisdom', 'charisma']
	const modifiers = {} as Record<Ability, number>
	for (const ability of abilities) {
		const result = computeAbilityScore(ability, character, feats)
		if (result.status === 'unknown') return unknown(result.reason)
		modifiers[ability] = result.value.modifier
	}

	const candidates: Candidate[] = [
		gear.armour ? armourCandidate(gear.armour, modifiers.dexterity) : unarmouredCandidate(modifiers.dexterity, gear.carriedArmourNotWorn),
	]
	// Every alternative formula in the data requires that no armour be worn; a Shield is ruled out by some of them only.
	// An ineligible formula is still listed, so a Barbarian in chain mail can see why Unarmored Defense did not apply.
	for (const key of formulaKeys) {
		const candidate = formulaCandidate(key, modifiers)
		if (gear.armour) candidate.notAppliedReason = `not available while wearing ${gear.armour.name}`
		else if (gear.shield && !AC_FORMULAS[key].shieldAllowed) candidate.notAppliedReason = `not available while wielding ${gear.shield.name}`
		candidates.push(candidate)
	}

	const applicable = candidates.filter((candidate) => candidate.notAppliedReason === undefined)
	let winner = applicable[0]
	for (const candidate of applicable) if (candidate.total > winner.total) winner = candidate

	const breakdown: Contribution[] = []
	for (const item of gear.unresolved) {
		// D43: an equipped item the item data does not know must not vanish from the calculation without saying so.
		breakdown.push({ source: `${item.name} (${item.source})`, amount: 0, note: 'equipped but not found in the item data — this Armour Class is incomplete' })
	}
	breakdown.push(...winner.rows)
	for (const candidate of candidates) {
		if (candidate === winner) continue
		const reason = candidate.notAppliedReason ?? `${winner.label} gives ${winner.total}`
		breakdown.push({ source: candidate.label, amount: 0, note: `considered (${candidate.formula}) — not applied: ${reason}` })
	}
	if (gear.shield) breakdown.push({ source: gear.shield.name, amount: gear.shield.acBonus })

	const value = breakdown.reduce((sum, row) => sum + row.amount, 0)
	return known(
		{
			value,
			incomplete: gear.unresolved.map((item) => `${item.name} (${item.source})`),
			stealthDisadvantage: gear.armour && gear.armour.stealthDisadvantage ? [gear.armour.name] : [],
		},
		breakdown,
	)
}

/**
 * Heavy armour worn without the Strength score it calls for costs 10 feet of
 * speed (PHB 2024). Returned as speed contributions rather than applied here,
 * so the reduction shows up in the breakdown of the number it actually
 * changes — computeSpeed's (speciesTraits.ts).
 */
export function armourSpeedPenalty(character: Character, armour: EquippedArmour | null, feats: FeatEffectEntry[] = []): Contribution[] {
	if (!armour || armour.category !== 'heavy' || armour.strengthRequirement === null) return []

	const strength = computeAbilityScore('strength', character, feats)
	if (strength.status === 'unknown') return []
	if (strength.value.score >= armour.strengthRequirement) return []

	return [
		{
			source: `${armour.name} (Strength ${armour.strengthRequirement} required, you have ${strength.value.score})`,
			amount: -10,
		},
	]
}
