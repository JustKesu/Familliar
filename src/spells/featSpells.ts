/*
 * Feat-granted spells (build order step 6, slice d5a, extended in d5b-3 to
 * the Eberron "Mark of ..." feats' fixed portion, in d5b-2 to base Magic
 * Initiate's own player-chosen spells, and in d5b-1 — the LAST feat-spell
 * picker — to the 8 remaining reachable filter-choice feats).
 *
 * investigate-feat-spells.js + investigate-feat-spell-ability.js (both in
 * scripts/) found 29 feats grant spells via `additionalSpells` — the SAME
 * field shape subclasses use (subclassPreparedSpells.ts, D46) — of which
 * only 4 grant FIXED spells, and of those 4 only Drow High Magic (CHA) and
 * Fey Teleportation (INT) are ALSO fixed in spellcasting ability. Telekinetic
 * and Telepathic have fixed spells too but a non-fixed ability ("inherit" —
 * derives from whatever ability the character already casts with, a rules
 * call outside this slice, and still deferred — NOT part of d5b-1's scope);
 * the other 25 spell-granting feats let the player choose the spell itself.
 * Of those 25, the 12 Eberron "Mark of ..." feats
 * (investigate-feat-spell-choice-shapes.js) turn out to ALSO carry a fixed
 * spell grant (not a choice) alongside a CHOICE ability (int/wis/cha) and a
 * separate `expanded` pool-widening list — this module now also derives the
 * marks' fixed portion (d5b-3), reading the already-stored D57
 * `chosenAbility` since the mark's own ability field is a choice, not fixed.
 * `expanded` is deliberately never read here — same reasoning as d6a's
 * subclass `expanded` deferral (EK/AT/Divine Soul): it widens a later
 * picker's offered pool, it does not grant a spell outright. Deferred, not
 * built. Of the remaining 13 feats, base Magic Initiate is handled (d5b-2,
 * extractMagicInitiateSpells below) — but it reads the character's OWN
 * stored FeatAsiChoice.magicInitiate pick directly, not additionalSpells,
 * since the player chose the individual spells themselves rather than
 * receiving a fixed grant. d5b-1 (extractFilterChoiceSpells below) handles
 * the same way the 8 feats featSpellChoiceData.ts's FILTER_CHOICE_FEAT_KEYS
 * names (Artificer Initiate, Blessed Warrior, Druidic Warrior, Wood Elf
 * Magic, Aberrant Dragonmark, Fey-Touched, Shadow-Touched, Ritual Caster) —
 * reading FeatAsiChoice.filterChoiceSpells, plus (Fey-Touched/Shadow-Touched
 * only) their fixed companion spell via extractFixedFeatSpells's new
 * filterChoice branch below. The 3 remaining "Magic Initiate; <Class>"
 * feats.json entries in that investigate script's 11-feat group are
 * permanently hidden from the feat picker (featAsiData.ts
 * HIDDEN_FEAT_KEYS) and so can never be chosen — no picker was built for
 * them. Boon of Siberys stays separately deferred (13 named alternatives, a
 * different picker shape).
 *
 * scripts/investigate-fixed-feat-spell-shape.js confirmed the exact shape for
 * the two feats d5a handles:
 *   Drow High Magic:  {"ability":"cha","innate":{"_":{"will":["detect magic"],"daily":{"1e":["levitate","dispel magic"]}}}}
 *   Fey Teleportation: {"ability":"int","innate":{"_":{"daily":{"1":["misty step"]}}}}
 * A short re-read (this task) confirmed the marks' shape, e.g. Mark of Storm:
 *   {"ability":{"choose":["int","wis","cha"]},"known":{"_":["thunderclap"]},"prepared":{"3":{"daily":{"1":["gust of wind"]}}},"expanded":{...}}
 * — `known`/`prepared` are the SAME fixed-grant keys subclasses use, keyed
 * "_" (always granted) or a NUMERIC key that, for a feat, means "granted once
 * the character reaches this TOTAL character level" (D11 — a feat isn't tied
 * to one class, so there is no class level to gate on the way subclass grants
 * do; confirmed no mark's `prepared`/`known` contains a `choose` node — every
 * ref is a literal spell name, so this is genuinely a fixed-grant slice, not
 * a picker). Only Mark feats get this choice-ability + fixed-grant treatment
 * (guarded by name) — other choice-ability feats (Magic Initiate variants,
 * Boon of Siberys) also carry `prepared`/`known` under a choice ability, but
 * theirs is either choice-wrapped (safe, extractRefs finds nothing) or, for
 * Boon of Siberys, an array of 13 full alternatives the player must pick ONE
 * of (d5b-2, not this module) — applying this module's grant logic to every
 * one of those 13 unconditionally would incorrectly grant all 13 at once, so
 * the mark-name guard exists specifically to avoid that scope creep.
 *
 * A feat is a one-time yes/no grant (the character either took it or
 * didn't, via Character.featAsiChoices) — there is no "granted at level N"
 * field on the returned spell the way a subclass grant has one, even for the
 * marks' level-gated portion: the gate only decides whether the character
 * has REACHED that spell yet, it isn't provenance the sheet displays.
 */

import { ABILITY_ABBREVIATIONS, type AbilityAbbreviation } from '../calculation/abilityAbbreviations'
import { loadDataFile } from '../dataLoader/dataLoader'
import type { Character, FeatAsiChoice } from '../storage/character'
import { chosenSpellUsageFor } from './chosenSpellUsage'
import { isFilterChoiceFeat } from './featSpellChoiceData'
import { extractRefsWithUsage, findSpell, hasConcentration, isRawSpell, isRecord, parseSpellRef, spellIdentityKey, type RawSpell, type SpellUsage } from './subclassPreparedSpells'

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
	/** The spellcasting ability for this grant — carried through for a later attack/DC consumer; not computed here. Fixed feats (Drow High Magic, Fey Teleportation) always have one. A Mark feat has one only once the character's D57 `chosenAbility` is on record; absent until then (the spell itself is still granted — the mark's ability choice does not gate whether the spell is granted, only what it's cast with). */
	ability?: AbilityAbbreviation
	/**
	 * How this spell is cast (this task, subclassPreparedSpells.ts's `SpellUsage`
	 * doc) — undefined/null for an ordinary grant, cast with a slot like any
	 * other prepared/known spell (no wrapper found). Unlike
	 * optionalFeatureSpells.ts, a feat's BARE grant is never relabeled
	 * "no spell slot": the only bare fixed-feat grants in the data are the
	 * Eberron marks' base cantrips (e.g. Mark of Making's `known._`), and a
	 * cantrip needs no such label — it's already castable with no slot by the
	 * ordinary cantrip rule, regardless of source.
	 *
	 * A player-CHOSEN feat spell (extractMagicInitiateSpells,
	 * extractFilterChoiceSpells, and Fey-/Shadow-Touched's fixed companion)
	 * has no wrapper to read: its term comes from chosenSpellUsage.ts's hand
	 * table by feat name, and only for a LEVELED pick (D21/D70).
	 */
	usage?: SpellUsage | null
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

/** True for the Magic Initiate/Mark-of-... shape `{choose: ["int","wis","cha"]}` — an ability CHOICE, not a fixed one. */
function isChoiceAbility(value: unknown): boolean {
	return isRecord(value) && Array.isArray(value['choose'])
}

/** Only the Eberron "Mark of ..." feats get the choice-ability + fixed-grant treatment (see module comment for why this is name-guarded rather than applied to every choice-ability feat). */
function isMarkFeat(featName: string): boolean {
	return featName.startsWith('Mark of ')
}

/**
 * D5b-1: 2 of the 8 filter-choice feats (Fey-Touched, Shadow-Touched) also
 * carry a FIXED companion spell (Misty Step, Invisibility) alongside their
 * choice, under additionalSpells `{"ability":"inherit"}` — "derives from
 * whatever ability the character already casts with" per the raw data, but
 * the task decided these resolve through the same stored D57 `chosenAbility`
 * every other choice-ability feat here uses (they have a normal half-feat
 * `ability` field, so `chosenAbility` is always populated once the ability
 * step of the picker is filled in). Reuses isFilterChoiceFeat rather than a
 * second name list — every filter-choice feat's fixed portion (if any) goes
 * through this path; the other 6 already resolve via isFixedAbility.
 */

/** The fixed-grant keys this module derives spells from — same set subclassPreparedSpells.ts reads; `expanded` is excluded for the same reasons documented there. */
const FIXED_GRANT_KEYS = ['prepared', 'known', 'innate'] as const

/**
 * Same class of bug as subclassPreparedSpells.ts's dedupeAlwaysPreparedSpells
 * (this task) — this module's FIXED_GRANT_KEYS loop below shares the exact
 * shape, so a feat whose additionalSpells lists the same spell under two keys
 * (no confirmed real instance among the feats checked, but nothing rules one
 * out) would double-emit the same way College of Glamour did. `featName`/
 * `ability` are identical across a duplicate from the SAME feat (the only way
 * extractFixedFeatSpells can produce one — it only ever looks at one feat at
 * a time), so keeping the first occurrence loses nothing.
 */
function dedupeFeatGrantedSpells(spells: FeatGrantedSpell[]): FeatGrantedSpell[] {
	const byKey = new Map<string, FeatGrantedSpell>()
	for (const spell of spells) {
		const key = spellIdentityKey(spell.name, spell.source)
		if (!byKey.has(key)) byKey.set(key, spell)
	}
	return [...byKey.values()]
}

/**
 * Pure filter (D38). One named feat's fully-fixed granted spells (empty if
 * the feat isn't found or grants no spells). `characterLevel` gates a Mark
 * feat's numerically-keyed grants (e.g. `prepared["3"]`, D11 total level —
 * see module comment); a "_"-keyed grant (every d5a feat, and a mark's base
 * spell) is always granted regardless of level. `chosenAbility` is the
 * character's D57 pick, used only for a Mark feat's choice ability — a fixed-
 * ability feat (Drow High Magic, Fey Teleportation) ignores this parameter.
 */
export function extractFixedFeatSpells(
	parsedFeats: unknown,
	parsedSpells: unknown,
	featName: string,
	featSource: string,
	characterLevel: number,
	chosenAbility?: AbilityAbbreviation,
): FeatGrantedSpell[] {
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
	const mark = isMarkFeat(feat.name)
	const filterChoice = isFilterChoiceFeat({ name: feat.name, source: feat.source })

	for (const entry of feat.additionalSpells) {
		if (!isRecord(entry)) continue

		const abilityField = entry['ability']
		// Fey-Touched / Shadow-Touched's fixed companion (Misty Step / Invisibility) is wrapped `daily:{"1e":…}` in the
		// data — "1/day each", the 2014 wording. Its own 2024 text says "once … until you finish a Long Rest" (D68: rules
		// win). Take the term from the same hand table its chosen spell uses so the two rows agree.
		const inheritCompanion = filterChoice && abilityField === 'inherit'
		const companionUsage = inheritCompanion ? chosenSpellUsageFor(feat.name) : undefined
		let ability: AbilityAbbreviation | undefined
		if (isFixedAbility(abilityField)) {
			ability = abilityField
		} else if (mark && isChoiceAbility(abilityField)) {
			ability = chosenAbility // may still be undefined if the character hasn't recorded a choice yet — the spell is granted either way.
		} else if (filterChoice && abilityField === 'inherit') {
			ability = chosenAbility // Fey-Touched/Shadow-Touched's fixed companion spell — see module comment above isMarkFeat.
		} else {
			continue // choice ability on a non-mark, non-filter-choice feat, "inherit" outside that set, or no ability field at all.
		}

		for (const key of FIXED_GRANT_KEYS) {
			const levelMap = entry[key]
			if (levelMap === undefined) continue
			if (!isRecord(levelMap)) continue // unexpected variant of the key itself — skip cleanly, don't invent handling.

			for (const [levelKey, value] of Object.entries(levelMap)) {
				const grantedAtLevel = Number(levelKey)
				// Not finite covers the "_" (always granted) key shared by every d5a feat and each mark's base spell.
				if (Number.isFinite(grantedAtLevel) && grantedAtLevel > characterLevel) continue

				const resourceName = typeof entry['resourceName'] === 'string' ? entry['resourceName'] : undefined
				for (const { ref, usage } of extractRefsWithUsage(value, resourceName, null)) {
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
						usage: inheritCompanion && spell.level >= 1 ? companionUsage : usage,
					})
				}
			}
		}
	}

	return dedupeFeatGrantedSpells(result)
}

type FeatChoice = Extract<FeatAsiChoice, { kind: 'feat' }>

function chosenFeats(character: Character): FeatChoice[] {
	return (character.featAsiChoices ?? []).filter((choice): choice is FeatChoice => choice.kind === 'feat')
}

/** D11: total level across every class, the same sum proficiencyBonus.ts uses — a Mark feat's numeric grant keys are gated on this, not on any one class's level (a feat isn't tied to a class). */
function totalCharacterLevel(character: Character): number {
	return (character.classes ?? []).reduce((sum, c) => sum + c.level, 0)
}

/**
 * Base Magic Initiate's own stored pick (build order step 6, slice d5b-2:
 * FeatAsiChoice.magicInitiate) — not a feats.json fixed grant at all, since
 * the player chose both the class list AND the individual spells. Reads the
 * character's own choice directly rather than re-deriving from
 * additionalSpells the way extractFixedFeatSpells does; level/ritual/
 * concentration are still looked up from spells.json so the sheet gets the
 * same detail a fixed grant would.
 */
function extractMagicInitiateSpells(parsedSpells: unknown, choice: FeatChoice): FeatGrantedSpell[] {
	if (!choice.magicInitiate) return []
	if (!Array.isArray(parsedSpells)) {
		throw new Error('spells.json: expected a top-level array.')
	}
	const spells: RawSpell[] = parsedSpells.filter(isRawSpell)
	const ability = choice.chosenAbility ? ABILITY_ABBREVIATIONS[choice.chosenAbility] : undefined
	const picks = [...choice.magicInitiate.cantrips, ...(choice.magicInitiate.spell ? [choice.magicInitiate.spell] : [])]

	const result: FeatGrantedSpell[] = []
	for (const pick of picks) {
		const spell = findSpell(spells, { name: pick.name.toLowerCase(), source: pick.source.toUpperCase() })
		if (!spell) continue // reference doesn't resolve against this app's filtered spells.json — skip cleanly (D43).
		result.push({
			name: spell.name,
			source: spell.source,
			level: spell.level,
			ritual: spell.meta?.ritual === true,
			concentration: hasConcentration(spell.duration),
			origin: 'feat',
			featName: choice.name,
			ability,
			// D21/D70: the level-1 pick is "cast once without a slot, regain on a Long Rest"; the cantrips carry no term.
			usage: spell.level >= 1 ? chosenSpellUsageFor(choice.name) : undefined,
		})
	}
	return result
}

/**
 * Resolves the ability tag for a filter-choice feat's own picked spells
 * (extractFilterChoiceSpells below) the same way extractFixedFeatSpells
 * resolves it for that feat's fixed companion spell, if any: a fixed
 * ability (Artificer Initiate/Blessed Warrior/Druidic Warrior/Wood Elf
 * Magic/Aberrant Dragonmark) always wins; otherwise (Fey-Touched/
 * Shadow-Touched/Ritual Caster) falls back to the character's own D57
 * `chosenAbility`.
 */
function resolveFilterChoiceAbility(parsedFeats: unknown, featName: string, featSource: string, chosenAbility: AbilityAbbreviation | undefined): AbilityAbbreviation | undefined {
	if (!Array.isArray(parsedFeats)) {
		throw new Error('feats.json: expected a top-level array.')
	}
	const feat = parsedFeats.find((candidate): candidate is RawFeatEntry => isRawFeatEntry(candidate) && candidate.name === featName && candidate.source === featSource)
	const entry = feat && Array.isArray(feat.additionalSpells) ? feat.additionalSpells[0] : undefined
	const abilityField = isRecord(entry) ? entry['ability'] : undefined
	return isFixedAbility(abilityField) ? abilityField : chosenAbility
}

/**
 * The generic filter-choice feat picker's own stored pick (build order
 * step 6, slice d5b-1: FeatAsiChoice.filterChoiceSpells) — same reasoning as
 * extractMagicInitiateSpells: the player chose the spell itself, so this
 * reads the character's own choice directly rather than re-deriving it from
 * additionalSpells.
 */
function extractFilterChoiceSpells(parsedFeats: unknown, parsedSpells: unknown, choice: FeatChoice): FeatGrantedSpell[] {
	if (!choice.filterChoiceSpells) return []
	if (!Array.isArray(parsedSpells)) {
		throw new Error('spells.json: expected a top-level array.')
	}
	const spells: RawSpell[] = parsedSpells.filter(isRawSpell)
	const chosenAbility = choice.chosenAbility ? ABILITY_ABBREVIATIONS[choice.chosenAbility] : undefined
	const ability = resolveFilterChoiceAbility(parsedFeats, choice.name, choice.source, chosenAbility)
	const picks = [...choice.filterChoiceSpells.cantrips, ...choice.filterChoiceSpells.spells]

	const result: FeatGrantedSpell[] = []
	for (const pick of picks) {
		const spell = findSpell(spells, { name: pick.name.toLowerCase(), source: pick.source.toUpperCase() })
		if (!spell) continue // reference doesn't resolve against this app's filtered spells.json — skip cleanly (D43).
		result.push({
			name: spell.name,
			source: spell.source,
			level: spell.level,
			ritual: spell.meta?.ritual === true,
			concentration: hasConcentration(spell.duration),
			origin: 'feat',
			featName: choice.name,
			ability,
			// D21/D70: Artificer Initiate / Fey-Touched / Shadow-Touched give their leveled pick a "1/long rest, no slot" term; cantrip-only feats (Blessed/Druidic Warrior, Wood Elf Magic) and the cantrip picks carry none.
			usage: spell.level >= 1 ? chosenSpellUsageFor(choice.name) : undefined,
		})
	}
	return result
}

/** Every fully-fixed feat-granted spell the character's taken feats (Character.featAsiChoices) provide. Additional to the class picker's own counts — never subtracted from cantrip/prepared/known limits, same as subclass always-prepared spells. */
export function extractFeatGrantedSpells(parsedFeats: unknown, parsedSpells: unknown, character: Character): FeatGrantedSpell[] {
	const result: FeatGrantedSpell[] = []
	const characterLevel = totalCharacterLevel(character)
	for (const choice of chosenFeats(character)) {
		const chosenAbility = choice.chosenAbility ? ABILITY_ABBREVIATIONS[choice.chosenAbility] : undefined
		result.push(...extractFixedFeatSpells(parsedFeats, parsedSpells, choice.name, choice.source, characterLevel, chosenAbility))
		result.push(...extractMagicInitiateSpells(parsedSpells, choice))
		result.push(...extractFilterChoiceSpells(parsedFeats, parsedSpells, choice))
	}
	return result
}

/** Fetches feats.json and spells.json and returns the character's fully-fixed feat-granted spells. */
export async function loadFeatGrantedSpells(character: Character): Promise<FeatGrantedSpell[]> {
	const [parsedFeats, parsedSpells] = await Promise.all([loadDataFile('data/feats.json'), loadDataFile('data/spells.json')])
	return extractFeatGrantedSpells(parsedFeats, parsedSpells, character)
}

/** Fetches feats.json and spells.json and returns one feat's fixed-grant spells — the async wrapper extractFixedFeatSpells itself lacks. Used by the filter-choice picker (FeatAsiPicker.tsx) to show a feat's fixed companion spell, if any, alongside its choice. */
export async function loadFixedFeatSpells(featName: string, featSource: string, characterLevel: number, chosenAbility?: AbilityAbbreviation): Promise<FeatGrantedSpell[]> {
	const [parsedFeats, parsedSpells] = await Promise.all([loadDataFile('data/feats.json'), loadDataFile('data/spells.json')])
	return extractFixedFeatSpells(parsedFeats, parsedSpells, featName, featSource, characterLevel, chosenAbility)
}
