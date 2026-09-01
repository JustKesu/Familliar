/*
 * Weapon attacks (build order step 7, slice c). A new file in this folder per
 * D47.
 *
 * Pure (D38): the held inventory rows are resolved against items.json by the
 * caller (src/sheet/weaponAttackData.ts) and handed in, together with the
 * weapon proficiency grants — which come from the shared
 * `weaponProficiencyGrantsFor`, so the Rogue/Monk prose rules and the feat
 * grants are not re-derived here.
 *
 * Which fields the item data actually carries was established by
 * scripts/investigate-weapon-attack-fields.js: 95 weapons, all with `dmg1`
 * and `dmgTypeFull`; `dmg2` on exactly the 42 Versatile ones; `range` on 33
 * (every type-R weapon and all 16 Thrown ones) as a plain "30/120" string.
 *
 * Three rules are written here rather than read, because no data field states
 * them (same situation as the Dex cap in armourClass.ts):
 *  - a ranged weapon attacks with Dexterity, a melee weapon with Strength,
 *    and a Finesse weapon with whichever the player prefers (PHB 2024,
 *    "Weapon Properties" / "Attack Rolls").
 *  - every character is proficient with their Unarmed Strike, whose damage is
 *    1 + Strength modifier, bludgeoning (PHB 2024, "Unarmed Strike").
 *  - a Monk (>= 1 level, signalled by a non-null Martial Arts die) may use
 *    Dexterity instead of Strength for the attack and damage rolls of Unarmed
 *    Strikes and Monk weapons when it is higher; a Monk weapon is Simple Melee
 *    or Light Martial Melee, read structurally, not from prose (D21/D77).
 */

import type { Ability } from '../abilities/abilityScores'
import { TOTAL_ATTACKS_BY_FEATURE_NAME, totalAttacksAmong } from '../attacks/extraAttackData'
import type { Character } from '../storage/character'
import { isProficientWithWeapon, type WeaponProficiencyGrant } from '../weapons/weaponProficiency'
import { computeAbilityScore } from './abilityScores'
import type { FeatEffectEntry } from './featEffects'
import { computeProficiencyBonus } from './proficiencyBonus'
import { type Calculated, type Contribution, known, unknown } from './types'

/** One items.json weapon, reduced to the fields an attack line needs. `weaponCategory`, `propertyFull` and `firearm` are also what `isProficientWithWeapon` matches on. */
export interface ResolvedWeapon {
	name: string
	source: string
	/** items.json `type`, first segment only — "R" is a ranged weapon, "M" a melee one. */
	typeCode?: string
	weaponCategory?: string
	/** The damage dice, e.g. "1d8". */
	dmg1?: string
	/** The two-handed dice of a Versatile weapon, e.g. "1d10". Present on exactly the Versatile weapons. */
	dmg2?: string
	dmgTypeFull?: string
	propertyFull?: string[]
	masteryFull?: string[]
	/** Verbatim from the data ("30/120") — thrown and ranged weapons only. */
	range?: string
	firearm?: boolean
}

/** A weapon the character is holding, already looked up in the item data by the caller. */
export interface HeldWeapon {
	name: string
	source: string
	/** Null when the item data has no entry under this (name, source) — D43: the attack is still listed, with a note. */
	weapon: ResolvedWeapon | null
	/** The player's stored Strength/Dexterity pick for a Finesse weapon; null means the default (the higher of the two). */
	chosenAbility: Ability | null
}

export interface AttackDamage {
	/** The dice expression, or null for an Unarmed Strike's flat 1. */
	dice: string | null
	modifier: number
	damageType: string
	/** Ready to print: "1d8 + 3 slashing". */
	text: string
	/** Versatile — the same weapon used in two hands. Null when the weapon has no Versatile property. */
	twoHandedText: string | null
	breakdown: Contribution[]
}

/**
 * One row of the actions table a later step builds. Its first five fields are
 * that table's columns (name, range, to-hit, damage, notes) in the shape it
 * will consume; `key` and `abilityChoice` are what the sheet needs to render
 * and change the Finesse pick.
 */
export interface WeaponAttack {
	/** The inventory row this came from ("Longsword|XPHB"), or UNARMED_STRIKE_KEY. */
	key: string
	name: string
	/** Verbatim from the data ("30/120"); null for a weapon with no range field, i.e. plain melee. */
	range: string | null
	toHit: Calculated<number>
	damage: Calculated<AttackDamage>
	/** Mastery, the other weapon properties, and anything that went wrong — readable lines, no codes. */
	notes: string[]
	/** Non-null only for a Finesse weapon: which ability is being used and what the player may switch to. */
	abilityChoice: { using: Ability; options: Ability[]; isDefault: boolean } | null
}

export const UNARMED_STRIKE_KEY = 'unarmed-strike'

const FINESSE = 'Finesse'
const LIGHT = 'Light'
const VERSATILE = 'Versatile'
const RANGED_TYPE_CODE = 'R'
const MELEE_TYPE_CODE = 'M'

/** Named in the breakdown when Dexterity is used because of the Monk's Martial Arts, not because of Finesse or a ranged weapon (D77). */
const MARTIAL_ARTS_REASON = 'Martial Arts'

function abilityLabel(ability: Ability, reason?: string): string {
	return reason ? `${ability} modifier (${reason})` : `${ability} modifier`
}

function signed(amount: number): string {
	return amount >= 0 ? `+ ${amount}` : `- ${Math.abs(amount)}`
}

function damageText(dice: string | null, modifier: number, damageType: string): string {
	const head = dice ?? '1'
	const withModifier = modifier === 0 ? head : `${head} ${signed(modifier)}`
	return damageType ? `${withModifier} ${damageType}` : withModifier
}

function hasProperty(weapon: ResolvedWeapon, property: string): boolean {
	return (weapon.propertyFull ?? []).includes(property)
}

/**
 * A Monk weapon, read structurally per D21/D77: a Simple Melee weapon, or a
 * Martial Melee weapon with the Light property. Melee is the type code "M"
 * (docs/DATA.md). Never taken from the feature's prose.
 */
function isMonkWeapon(weapon: ResolvedWeapon): boolean {
	if (weapon.typeCode !== MELEE_TYPE_CODE) return false
	if (weapon.weaponCategory === 'simple') return true
	if (weapon.weaponCategory === 'martial') return hasProperty(weapon, LIGHT)
	return false
}

/**
 * Which ability the attack uses, and why.
 *
 *  - A Finesse weapon defaults to whichever of Strength and Dexterity is
 *    higher and keeps its player-switchable selector — a Finesse Monk weapon
 *    (Dagger, Shortsword) is still a Finesse weapon.
 *  - Otherwise, when the character has Martial Arts and the weapon is a Monk
 *    weapon, the rules (not the player) pick the higher of Strength and
 *    Dexterity: no selector, because there is no choice to make (D77). An
 *    explicit stored pick still wins over that default.
 *  - Every other weapon has no choice at all: melee Strength, ranged Dexterity.
 *
 * `reason` is set only when Dexterity is used because of Martial Arts, so the
 * breakdown can say why a non-Finesse weapon is not using Strength (D40).
 */
function abilityFor(
	weapon: ResolvedWeapon,
	modifiers: Record<Ability, number>,
	chosen: Ability | null,
	hasMartialArts: boolean,
): { using: Ability; choice: WeaponAttack['abilityChoice']; reason: string | null } {
	const higher: Ability = modifiers.dexterity > modifiers.strength ? 'dexterity' : 'strength'

	if (hasProperty(weapon, FINESSE)) {
		const using = chosen ?? higher
		return { using, choice: { using, options: ['strength', 'dexterity'], isDefault: chosen === null }, reason: null }
	}

	if (hasMartialArts && isMonkWeapon(weapon)) {
		const using = chosen ?? higher
		return { using, choice: null, reason: using === 'dexterity' ? MARTIAL_ARTS_REASON : null }
	}

	return { using: weapon.typeCode === RANGED_TYPE_CODE ? 'dexterity' : 'strength', choice: null, reason: null }
}

function notesFor(weapon: ResolvedWeapon, proficient: boolean): string[] {
	const notes: string[] = []
	const mastery = weapon.masteryFull ?? []
	if (mastery.length > 0) notes.push(`Mastery: ${mastery.join(', ')}`)
	const properties = weapon.propertyFull ?? []
	if (properties.length > 0) notes.push(`Properties: ${properties.join(', ')}`)
	if (!proficient) notes.push('Not proficient — no proficiency bonus on the attack roll')
	return notes
}

function toHitFor(
	weapon: ResolvedWeapon,
	using: Ability,
	modifiers: Record<Ability, number>,
	proficiencyBonus: Calculated<number>,
	proficient: boolean,
	abilityReason: string | null,
): Calculated<number> {
	if (proficiencyBonus.status === 'unknown') return unknown(proficiencyBonus.reason)
	const breakdown: Contribution[] = [{ source: abilityLabel(using, abilityReason ?? undefined), amount: modifiers[using] }]
	breakdown.push(
		proficient
			? { source: 'proficiency bonus', amount: proficiencyBonus.value }
			: { source: 'proficiency bonus', amount: 0, note: `not proficient with ${weapon.name}` },
	)
	return known(
		breakdown.reduce((sum, row) => sum + row.amount, 0),
		breakdown,
	)
}

function damageFor(weapon: ResolvedWeapon, using: Ability, modifiers: Record<Ability, number>, abilityReason: string | null): AttackDamage {
	const dice = weapon.dmg1 ?? null
	const modifier = modifiers[using]
	const damageType = weapon.dmgTypeFull ?? ''
	const breakdown: Contribution[] = [{ source: `${weapon.name} damage dice`, amount: 0, note: dice ?? '1' }]
	breakdown.push({ source: abilityLabel(using, abilityReason ?? undefined), amount: modifier })
	// SPEC section B: damage takes the ability modifier and no proficiency bonus.
	const versatileDice = hasProperty(weapon, VERSATILE) ? (weapon.dmg2 ?? null) : null
	const twoHanded = versatileDice === null ? null : damageText(versatileDice, modifier, damageType)
	if (versatileDice !== null) breakdown.push({ source: 'two-handed (Versatile)', amount: 0, note: versatileDice })
	return { dice, modifier, damageType, text: damageText(dice, modifier, damageType), twoHandedText: twoHanded, breakdown }
}

/**
 * The attack lines for everything the character is holding, plus the Unarmed
 * Strike every character always has. Held rows the item data does not know are
 * kept and named (D43) rather than dropped — the note says the attack could
 * not be worked out.
 *
 * `martialArtsDie` (e.g. "1d6") replaces the Unarmed Strike's flat 1 when the
 * character is a Monk; the caller reads it from the Monk's class table.
 */
export function computeWeaponAttacks(
	character: Character,
	held: HeldWeapon[],
	grants: WeaponProficiencyGrant[],
	feats: FeatEffectEntry[] = [],
	martialArtsDie: string | null = null,
): WeaponAttack[] {
	const abilities: Ability[] = ['strength', 'dexterity']
	const modifiers = {} as Record<Ability, number>
	let scoresUnknown: string | null = null
	for (const ability of abilities) {
		const result = computeAbilityScore(ability, character, feats)
		if (result.status === 'unknown') {
			scoresUnknown = result.reason
			modifiers[ability] = 0
		} else {
			modifiers[ability] = result.value.modifier
		}
	}
	const proficiencyBonus = computeProficiencyBonus(character.classes)
	// Same signal slice c reads for the die: a non-null die means at least one Monk level, so the ability clause and the die never disagree (D77).
	const hasMartialArts = martialArtsDie !== null

	const attacks: WeaponAttack[] = held.map((row) => {
		const key = `${row.name}|${row.source}`
		if (!row.weapon) {
			const reason = `"${row.name}" (${row.source}) is held but was not found in the item data.`
			return { key, name: row.name, range: null, toHit: unknown(reason), damage: unknown(reason), notes: [reason], abilityChoice: null }
		}

		const weapon = row.weapon
		const proficient = isProficientWithWeapon(weapon, grants)
		const { using, choice, reason } = abilityFor(weapon, modifiers, row.chosenAbility, hasMartialArts)
		const damage = damageFor(weapon, using, modifiers, reason)
		return {
			key,
			name: weapon.name,
			range: weapon.range ?? null,
			toHit: scoresUnknown ? unknown(scoresUnknown) : toHitFor(weapon, using, modifiers, proficiencyBonus, proficient, reason),
			damage: scoresUnknown ? unknown(scoresUnknown) : known(damage, damage.breakdown),
			notes: notesFor(weapon, proficient),
			abilityChoice: choice,
		}
	})

	attacks.push(unarmedStrike(modifiers, proficiencyBonus, martialArtsDie, scoresUnknown))
	return attacks
}

/**
 * PHB 2024: an Unarmed Strike is always available and everyone is proficient
 * with it; its damage is 1 + Strength modifier, bludgeoning. A Monk's Martial
 * Arts die replaces that 1 — the die is a real column of the Monk class table
 * (scripts/investigate-weapon-attack-fields.js), so it is read, not tabled.
 *
 * Martial Arts also lets a Monk use Dexterity for the Unarmed Strike's attack
 * and damage rolls when it is higher (D77). A non-null die is the same signal
 * slice c uses, so the die and the ability clause never disagree.
 */
function unarmedStrike(modifiers: Record<Ability, number>, proficiencyBonus: Calculated<number>, martialArtsDie: string | null, scoresUnknown: string | null): WeaponAttack {
	const name = 'Unarmed Strike'
	const notes = martialArtsDie ? [`Martial Arts die (Monk): ${martialArtsDie}`] : []
	if (scoresUnknown) return { key: UNARMED_STRIKE_KEY, name, range: null, toHit: unknown(scoresUnknown), damage: unknown(scoresUnknown), notes, abilityChoice: null }
	if (proficiencyBonus.status === 'unknown') {
		return { key: UNARMED_STRIKE_KEY, name, range: null, toHit: unknown(proficiencyBonus.reason), damage: unknown(proficiencyBonus.reason), notes, abilityChoice: null }
	}

	const hasMartialArts = martialArtsDie !== null
	const using: Ability = hasMartialArts && modifiers.dexterity > modifiers.strength ? 'dexterity' : 'strength'
	const reason = using === 'dexterity' ? MARTIAL_ARTS_REASON : undefined

	const toHitBreakdown: Contribution[] = [
		{ source: abilityLabel(using, reason), amount: modifiers[using] },
		{ source: 'proficiency bonus', amount: proficiencyBonus.value },
	]
	const damageBreakdown: Contribution[] = [
		{ source: martialArtsDie ? 'Martial Arts die' : 'unarmed strike base', amount: 0, note: martialArtsDie ?? '1' },
		{ source: abilityLabel(using, reason), amount: modifiers[using] },
	]
	const damage: AttackDamage = {
		dice: martialArtsDie,
		modifier: modifiers[using],
		damageType: 'bludgeoning',
		text: damageText(martialArtsDie, modifiers[using], 'bludgeoning'),
		twoHandedText: null,
		breakdown: damageBreakdown,
	}
	return {
		key: UNARMED_STRIKE_KEY,
		name,
		range: null,
		toHit: known(
			toHitBreakdown.reduce((sum, row) => sum + row.amount, 0),
			toHitBreakdown,
		),
		damage: known(damage, damageBreakdown),
		notes,
		abilityChoice: null,
	}
}

/**
 * How many attacks the Attack action gives. The count lives in the feature's
 * NAME and nowhere else (D70), so `totalAttacksAmong` looks it up in
 * src/attacks/extraAttackData.ts's table. The features replace each other
 * rather than stacking — a Fighter at 11 holds both "Extra Attack" and "Two
 * Extra Attacks" — so the loser is a zero-amount note saying what it would
 * have given (D60's mechanism, the same way armourClass.ts reconciles its
 * formulas).
 */
export function computeAttacksPerAction(featureNames: readonly string[]): Calculated<number> {
	const granting = featureNames
		.map((name) => ({ name, total: TOTAL_ATTACKS_BY_FEATURE_NAME[name] }))
		.filter((entry): entry is { name: string; total: number } => entry.total !== undefined)

	const total = totalAttacksAmong(featureNames)
	const winner = granting.find((entry) => entry.total === total)

	const breakdown: Contribution[] = [{ source: 'the Attack action', amount: 1 }]
	if (winner) breakdown.push({ source: winner.name, amount: winner.total - 1 })
	for (const entry of granting) {
		if (entry === winner) continue
		breakdown.push({ source: entry.name, amount: 0, note: `considered (${entry.total} attacks) — not applied: ${winner?.name} gives ${total}` })
	}
	return known(total, breakdown)
}
