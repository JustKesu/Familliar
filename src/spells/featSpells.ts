/*
 * Feat-granted spells, fully-fixed only (build order step 6, slice d5a).
 *
 * investigate-feat-spells.js + investigate-feat-spell-ability.js (both in
 * scripts/) found 29 feats grant spells via `additionalSpells` — the SAME
 * field shape subclasses use (subclassPreparedSpells.ts, D46) — of which
 * only 4 grant FIXED spells, and of those 4 only Drow High Magic (CHA) and
 * Fey Teleportation (INT) are ALSO fixed in spellcasting ability. Telekinetic
 * and Telepathic have fixed spells too but a non-fixed ability ("inherit" —
 * derives from whatever ability the character already casts with, a rules
 * call outside this slice); the other 25 spell-granting feats let the player
 * choose the spell itself. All 27 are slice d5b, a picker, not this module.
 *
 * scripts/investigate-fixed-feat-spell-shape.js confirmed the exact shape for
 * the two feats this module handles:
 *   Drow High Magic:  {"ability":"cha","innate":{"_":{"will":["detect magic"],"daily":{"1e":["levitate","dispel magic"]}}}}
 *   Fey Teleportation: {"ability":"int","innate":{"_":{"daily":{"1":["misty step"]}}}}
 * `ability` is a plain lowercase ability-abbreviation string (not "inherit",
 * not a `choose` object) — that alone is what makes a feat's ability fixed,
 * and is the filter this module applies. The `innate` grant is keyed "_"
 * (not a class level — a feat has no class level to gate on) and wrapped
 * again under `will`/`daily`, mirroring the resource-wrapper shape d6a found
 * on 5 subclasses; extractRefs (subclassPreparedSpells.ts) already discards
 * wrapper keys and finds every string at any depth, so it is reused as-is,
 * just without the level-gate loop subclass grants need.
 *
 * A feat is a one-time yes/no grant (the character either took it or
 * didn't, via Character.featAsiChoices) — there is no "granted at level N"
 * concept the way a subclass grant has, so unlike AlwaysPreparedSpell there
 * is no grantedAtLevel field here.
 */

import type { AbilityAbbreviation } from '../calculation/abilityAbbreviations'
import { loadDataFile } from '../dataLoader/dataLoader'
import type { Character, FeatAsiChoice } from '../storage/character'
import { extractRefs, findSpell, hasConcentration, isRawSpell, isRecord, parseSpellRef, type RawSpell } from './subclassPreparedSpells'

export interface FeatGrantedSpell {
	name: string
	source: string
	/** The spell's own level (0 = cantrip). */
	level: number
	ritual: boolean
	concentration: boolean
	/** Provenance (the sheet's "from feat (Feat Name)" label, distinct from subclass's "always prepared (subclass)"): always a feat, never a player pick or a subclass grant. */
	origin: 'feat'
	/** Which feat granted this spell — the name the "from feat (...)" label needs. */
	featName: string
	/** The FIXED spellcasting ability feats.json names for this grant (e.g. "cha" for Drow High Magic) — carried through for a later attack/DC consumer; not computed here. */
	ability: AbilityAbbreviation
}

interface RawFeatEntry {
	name: string
	source: string
	additionalSpells?: unknown
}

function isRawFeatEntry(value: unknown): value is RawFeatEntry {
	return isRecord(value) && typeof value['name'] === 'string' && typeof value['source'] === 'string'
}

const FIXED_ABILITIES: readonly AbilityAbbreviation[] = ['str', 'dex', 'con', 'int', 'wis', 'cha']

/** True only for a plain named ability code — excludes a `choose` object AND the literal string "inherit" (Telekinetic/Telepathic), both of which are d5b's problem, not this module's. */
function isFixedAbility(value: unknown): value is AbilityAbbreviation {
	return typeof value === 'string' && (FIXED_ABILITIES as readonly string[]).includes(value)
}

/** The fixed-grant keys this module derives spells from — same set subclassPreparedSpells.ts reads; `expanded` is excluded for the same reasons documented there. */
const FIXED_GRANT_KEYS = ['prepared', 'known', 'innate'] as const

/**
 * Pure filter (D38). One named feat's fully-fixed granted spells (empty if
 * the feat isn't found, grants no spells, or its ability isn't fixed — i.e.
 * every feat except Drow High Magic and Fey Teleportation, today).
 */
export function extractFixedFeatSpells(parsedFeats: unknown, parsedSpells: unknown, featName: string, featSource: string): FeatGrantedSpell[] {
	if (!Array.isArray(parsedFeats)) {
		throw new Error('feats.json: expected a top-level array.')
	}
	if (!Array.isArray(parsedSpells)) {
		throw new Error('spells.json: expected a top-level array.')
	}

	const feat = parsedFeats.find((candidate): candidate is RawFeatEntry => isRawFeatEntry(candidate) && candidate.name === featName && candidate.source === featSource)
	if (!feat || !Array.isArray(feat.additionalSpells)) return []

	const spells: RawSpell[] = parsedSpells.filter(isRawSpell)
	const result: FeatGrantedSpell[] = []

	for (const entry of feat.additionalSpells) {
		if (!isRecord(entry)) continue

		const ability = entry['ability']
		if (!isFixedAbility(ability)) continue // choice ability, "inherit", or none at all — slice d5b, not this module.

		for (const key of FIXED_GRANT_KEYS) {
			const grant = entry[key]
			if (grant === undefined) continue

			for (const ref of extractRefs(grant)) {
				const spell = findSpell(spells, parseSpellRef(ref))
				if (!spell) continue // reference doesn't resolve against this app's filtered spells.json — skip cleanly (D43).

				result.push({
					name: spell.name,
					source: spell.source,
					level: spell.level,
					ritual: spell.meta?.ritual === true,
					concentration: hasConcentration(spell.duration),
					origin: 'feat',
					featName: feat.name,
					ability,
				})
			}
		}
	}

	return result
}

type FeatChoice = Extract<FeatAsiChoice, { kind: 'feat' }>

function chosenFeats(character: Character): FeatChoice[] {
	return (character.featAsiChoices ?? []).filter((choice): choice is FeatChoice => choice.kind === 'feat')
}

/** Every fully-fixed feat-granted spell the character's taken feats (Character.featAsiChoices) provide. Additional to the class picker's own counts — never subtracted from cantrip/prepared/known limits, same as subclass always-prepared spells. */
export function extractFeatGrantedSpells(parsedFeats: unknown, parsedSpells: unknown, character: Character): FeatGrantedSpell[] {
	const result: FeatGrantedSpell[] = []
	for (const choice of chosenFeats(character)) {
		result.push(...extractFixedFeatSpells(parsedFeats, parsedSpells, choice.name, choice.source))
	}
	return result
}

/** Fetches feats.json and spells.json and returns the character's fully-fixed feat-granted spells. */
export async function loadFeatGrantedSpells(character: Character): Promise<FeatGrantedSpell[]> {
	const [parsedFeats, parsedSpells] = await Promise.all([loadDataFile('data/feats.json'), loadDataFile('data/spells.json')])
	return extractFeatGrantedSpells(parsedFeats, parsedSpells, character)
}
